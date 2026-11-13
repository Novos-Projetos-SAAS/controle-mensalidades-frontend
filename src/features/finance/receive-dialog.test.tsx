import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiError } from '@/lib/api';
import { financeApi, useFinanceQuery, type Mensalidade } from './finance-api';
import { ReceiveDialog } from './receive-dialog';

vi.mock('./finance-api', () => ({
  financeApi: { mensalidade: vi.fn(), receber: vi.fn() },
  useFinanceQuery: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('recebimento manual', () => {
  it('bloqueia duplo envio e repete uma tentativa incerta com a mesma chave e payload', async () => {
    const invoice = {
      id: 'm1',
      conta_receber_id: 'conta-1',
      assinatura_id: 'assinatura-1',
      cliente_id: 'cliente-1',
      cliente_nome: 'Cliente Teste',
      competencia: '2026-11-01',
      valor_base: '50.00',
      desconto_recorrente: '0.00',
      ajuste_competencia: '0.00',
      valor_final: '50.00',
      vencimento_em: '2026-11-10',
      status_conta: 'PENDENTE',
      valor_pago: '0.00',
      saldo: '50.00',
      status: 'PENDENTE',
      pagamentos: [],
    } satisfies Mensalidade;
    const refetch = vi.fn().mockResolvedValue({ data: invoice });
    vi.mocked(useFinanceQuery).mockReturnValue({
      data: invoice,
      isPending: false,
      isError: false,
      refetch,
    } as never);
    vi.mocked(financeApi.mensalidade).mockResolvedValue(invoice);
    let failFirst: (error: Error) => void = () => undefined;
    vi.mocked(financeApi.receber)
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            failFirst = reject;
          }),
      )
      .mockResolvedValueOnce({ pagamento: { id: 'p1' } as never, repetido: false });
    const onClose = vi.fn();
    const onSaved = vi.fn();
    render(
      <ReceiveDialog
        context={{ organizacaoId: 'org-test', areaId: 'area-test' }}
        id="m1"
        onClose={onClose}
        onSaved={onSaved}
      />,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Valor a receber (R$) *' }), {
      target: { value: '20,00' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Forma de pagamento *' }), {
      target: { value: 'PIX' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar recebimento' }));
    await waitFor(() => expect(financeApi.receber).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: 'Registrando...' }));
    expect(financeApi.receber).toHaveBeenCalledOnce();
    failFirst(new ApiError('Tempo esgotado', 0));
    expect(await screen.findByText(/Não foi possível confirmar o resultado/)).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Verificar no servidor' }));
    await screen.findByRole('button', { name: 'Repetir a mesma tentativa' });
    fireEvent.click(screen.getByRole('button', { name: 'Repetir a mesma tentativa' }));
    await waitFor(() => expect(financeApi.receber).toHaveBeenCalledTimes(2));
    expect(vi.mocked(financeApi.receber).mock.calls[1][2]).toBe(
      vi.mocked(financeApi.receber).mock.calls[0][2],
    );
    expect(vi.mocked(financeApi.receber).mock.calls[1][3]).toEqual(
      vi.mocked(financeApi.receber).mock.calls[0][3],
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(onClose).toHaveBeenCalledOnce();
  });
  it('após 503 e pagamento confirmado, consulta o servidor e impede outro envio', async () => {
    const invoice = {
      id: 'm2',
      conta_receber_id: 'conta-2',
      assinatura_id: 'assinatura-2',
      cliente_id: 'cliente-2',
      cliente_nome: 'Cliente Teste',
      competencia: '2026-11-01',
      valor_base: '50.00',
      desconto_recorrente: '0.00',
      ajuste_competencia: '0.00',
      valor_final: '50.00',
      vencimento_em: '2026-11-10',
      status_conta: 'PENDENTE',
      valor_pago: '0.00',
      saldo: '50.00',
      status: 'PENDENTE',
      pagamentos: [],
    } satisfies Mensalidade;
    const paid = {
      ...invoice,
      saldo: '0.00',
      status: 'PAGA' as const,
      pagamentos: [
        {
          id: 'p2',
          valor: '20.00',
          forma_pagamento: 'PIX',
          origem: 'MANUAL',
          pago_em: '2026-11-10T12:00:00.000Z',
          criado_em: '2026-11-10T12:00:00.000Z',
        },
      ],
    } satisfies Mensalidade;
    vi.mocked(useFinanceQuery).mockReturnValue({
      data: invoice,
      isPending: false,
      isError: false,
      refetch: vi.fn().mockResolvedValue({ data: paid }),
    } as never);
    vi.mocked(financeApi.mensalidade).mockResolvedValueOnce(invoice).mockResolvedValueOnce(paid);
    vi.mocked(financeApi.receber).mockRejectedValueOnce(new ApiError('Serviço indisponível', 503));
    const onSaved = vi.fn();
    render(
      <ReceiveDialog
        context={{ organizacaoId: 'org-test', areaId: 'area-test' }}
        id="m2"
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Valor a receber (R$) *' }), {
      target: { value: '20,00' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Forma de pagamento *' }), {
      target: { value: 'PIX' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar recebimento' }));
    expect(await screen.findByText(/Não foi possível confirmar o resultado/)).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Verificar no servidor' }));
    expect(await screen.findByText(/O estado no servidor mudou/)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Confirmar recebimento' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(financeApi.receber).toHaveBeenCalledOnce();
  });
});
