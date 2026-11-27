import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PaymentPage } from './payment-page';
import { paymentApi } from './payments-api';

vi.mock('./payments-api', () => ({ paymentApi: { publicCharge: vi.fn(), confirm: vi.fn() } }));
const token = 'a'.repeat(43);
const charge = {
  status: 'AGUARDANDO_PAGAMENTO',
  valor: '50.00',
  vencimento_em: '2026-11-30',
  expira_em: null,
  checkout_url: 'https://buy.infinitepay.io/abc',
};
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('página privada', () => {
  it('explica a espera e o retorno sem evidências em linguagem simples', async () => {
    vi.mocked(paymentApi.publicCharge).mockResolvedValue(charge);
    render(<PaymentPage token={token} returned />);
    await screen.findByText('Estamos aguardando a confirmação do pagamento.');
    expect(screen.queryByText(/servidor|checkout não comprova/i)).toBeNull();
  });
  it('substitui erros técnicos por orientação segura sem expor detalhes internos', async () => {
    vi.mocked(paymentApi.publicCharge).mockRejectedValue(
      new Error('Internal server error: webhook payload'),
    );
    render(<PaymentPage token={token} />);
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Ainda não conseguimos confirmar o pagamento. Consulte a situação antes de tentar novamente.',
    );
    expect(screen.queryByRole('link', { name: /Pagar/ })).toBeNull();
  });

  it('descarta dados da cobrança anterior ao trocar o token', async () => {
    vi.mocked(paymentApi.publicCharge)
      .mockResolvedValueOnce(charge)
      .mockImplementationOnce(() => new Promise(() => undefined));
    const page = render(<PaymentPage token={token} />);
    await screen.findByRole('link', { name: /Pagar com InfinitePay/ });
    page.rerender(<PaymentPage token={'b'.repeat(43)} />);
    expect(screen.queryByRole('link', { name: /Pagar com InfinitePay/ })).toBeNull();
    expect(screen.queryByText(/50,00/)).toBeNull();
  });
  it('mostra valor/vencimento sem sessão e abre somente checkout seguro', async () => {
    vi.mocked(paymentApi.publicCharge).mockResolvedValue(charge);
    render(<PaymentPage token={token} />);
    const link = await screen.findByRole('link', { name: /Pagar com InfinitePay/ });
    expect(link.getAttribute('href')).toBe(charge.checkout_url);
    expect(link.getAttribute('rel')).toContain('noreferrer');
    expect(screen.getByText(/50,00/)).toBeTruthy();
    expect(screen.queryByText(/Cliente|CPF|observação clínica/)).toBeNull();
  });
  it('retorno forjado não marca pagamento: confirma no backend e usa somente o status dele', async () => {
    const evidence = { order_nsu: 'pedido', transaction_nsu: 'transacao', slug: 'abc' };
    vi.mocked(paymentApi.confirm).mockResolvedValue({ ...charge, checkout_url: null });
    vi.mocked(paymentApi.publicCharge).mockResolvedValue(charge);
    render(<PaymentPage token={token} evidence={evidence} returned />);
    await screen.findByText('Aguardando pagamento');
    expect(paymentApi.confirm).toHaveBeenCalledWith(token, evidence, expect.any(AbortSignal));
    expect(screen.queryByText('Pagamento confirmado com sucesso.')).toBeNull();
    expect(screen.queryByRole('link', { name: /Pagar/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar situação' }));
    await waitFor(() => expect(paymentApi.confirm).toHaveBeenCalledTimes(2));
  });
  it('repete confirmação idempotente pelo servidor ao atualizar após falha no retorno', async () => {
    const evidence = { order_nsu: 'pedido', transaction_nsu: 'transacao', slug: 'abc' };
    vi.mocked(paymentApi.confirm)
      .mockRejectedValueOnce(new Error('Conexão interrompida.'))
      .mockResolvedValueOnce({ ...charge, status: 'PAGO_VERIFICADO', checkout_url: null });
    render(<PaymentPage token={token} evidence={evidence} returned />);
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar situação' }));
    await screen.findByText('Pagamento confirmado com sucesso.');
    expect(paymentApi.confirm).toHaveBeenCalledTimes(2);
    expect(paymentApi.publicCharge).not.toHaveBeenCalled();
  });
  it('não exibe checkout quando a URL é inválida ou a cobrança está encerrada', async () => {
    vi.mocked(paymentApi.publicCharge).mockResolvedValue({
      ...charge,
      status: 'PAGO_VERIFICADO',
      checkout_url: 'https://evil.test',
    });
    render(<PaymentPage token={token} />);
    await screen.findByText('Pagamento confirmado com sucesso.');
    expect(screen.queryByRole('link')).toBeNull();
  });
  it('suspende consultas com aba oculta e encerra após confirmação oficial', async () => {
    vi.useFakeTimers();
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    vi.mocked(paymentApi.publicCharge)
      .mockResolvedValueOnce(charge)
      .mockResolvedValue({ ...charge, status: 'PAGO_VERIFICADO', checkout_url: null });
    await act(async () => {
      render(<PaymentPage token={token} />);
    });
    visibility.mockReturnValue('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(paymentApi.publicCharge).toHaveBeenCalledOnce();
    visibility.mockReturnValue('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });
    expect(paymentApi.publicCharge).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Pagamento confirmado com sucesso.')).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300000);
    });
    expect(paymentApi.publicCharge).toHaveBeenCalledTimes(2);
    visibility.mockRestore();
  });
});
