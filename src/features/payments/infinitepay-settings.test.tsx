import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InfinitePaySettings } from './infinitepay-settings';
import { ChargePanel } from './charge-panel';
import { paymentApi } from './payments-api';

vi.mock('./payments-api', () => ({
  paymentApi: { settings: vi.fn(), saveSettings: vi.fn(), charge: vi.fn(), generate: vi.fn() },
}));
const context = { organizacaoId: 'org', areaId: 'area' };
const settings = {
  ativo: true,
  geracao_automatica: false,
  dias_antecedencia: 1 as const,
  handle: 'clinica',
  has_api_key: true,
};
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider
    client={
      new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      })
    }
  >
    {children}
  </QueryClientProvider>
);
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('administração InfinitePay', () => {
  it.each([
    [
      'Chave de criptografia ausente ou inválida.',
      'A configuração de pagamentos precisa ser concluída. Entre em contato com o suporte.',
    ],
    [
      'Criptografia InfinitePay não configurada.',
      'A configuração de pagamentos precisa ser concluída. Entre em contato com o suporte.',
    ],
    [
      'Trocar a InfiniteTag exige nova API Key.',
      'Ao trocar a InfiniteTag, informe uma nova chave da conta.',
    ],
    [
      'Configure a InfiniteTag e a API Key para ativar.',
      'Informe a InfiniteTag e a chave da conta para ativar.',
    ],
  ])('explica a correção da configuração quando recusada: %s', async (message, expected) => {
    vi.mocked(paymentApi.settings).mockResolvedValue(settings);
    vi.mocked(paymentApi.saveSettings).mockRejectedValueOnce(new Error(message));
    render(<InfinitePaySettings context={context} />, { wrapper });
    fireEvent.click(await screen.findByRole('button', { name: 'Salvar configuração' }));
    expect((await screen.findByRole('alert')).textContent).toBe(expected);
    expect(screen.queryByText('Configuração salva.')).toBeNull();
    expect(paymentApi.saveSettings).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('InfiniteTag da conta')).toBeTruthy();
    expect(screen.getByLabelText('Nova chave da conta')).toBeTruthy();
  });

  it('mostra outras opções em breve, desligadas e sem alterar a configuração', async () => {
    vi.mocked(paymentApi.settings).mockResolvedValue(settings);
    render(<InfinitePaySettings context={context} />, { wrapper });
    const card = await screen.findByRole('region', { name: 'Outras opções de pagamento' });
    expect(within(card).getByText('Em breve')).toBeTruthy();
    expect(
      within(card).getByText('Novas formas de receber pagamentos estarão disponíveis futuramente.'),
    ).toBeTruthy();
    const control = within(card).getByRole('switch', {
      name: 'Outras opções de pagamento',
    }) as HTMLButtonElement;
    expect(control.disabled).toBe(true);
    expect(control.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(control);
    fireEvent.keyDown(control, { key: ' ' });
    expect(control.getAttribute('aria-checked')).toBe('false');
    expect(paymentApi.saveSettings).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Ativar InfinitePay')).toBeTruthy();
  });
  it('mantém a recuperação da cobrança com orientação simples após erro técnico', async () => {
    vi.mocked(paymentApi.charge).mockResolvedValue(null);
    vi.mocked(paymentApi.generate).mockRejectedValue(new Error('Webhook payload inválido'));
    render(
      <ChargePanel
        context={context}
        mensalidadeId="m-uncertain"
        payable
        onChanged={() => undefined}
      />,
      { wrapper },
    );
    const generate = await screen.findByRole('button', { name: 'Gerar link de pagamento' });
    fireEvent.click(generate);
    await screen.findByText(
      'Ainda não conseguimos confirmar o pagamento. Consulte a situação antes de tentar novamente.',
    );
    expect(screen.queryByText(/webhook|payload|servidor/i)).toBeNull();
    expect((generate as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(generate);
    expect(paymentApi.generate).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Conferir pagamento' }));
    await waitFor(() => expect((generate as HTMLButtonElement).disabled).toBe(false));
    expect(paymentApi.generate).toHaveBeenCalledOnce();
  });

  it('salva geração automática 2 dias antes, mantém chave atual sem revelar segredo e limpa nova credencial', async () => {
    vi.mocked(paymentApi.settings).mockResolvedValue(settings);
    vi.mocked(paymentApi.saveSettings).mockImplementation(async (_, body) => ({
      ...settings,
      ...body,
      has_api_key: true,
    }));
    render(<InfinitePaySettings context={context} />, { wrapper });
    const key = await screen.findByLabelText('Nova chave da conta');
    expect((key as HTMLInputElement).type).toBe('password');
    expect((key as HTMLInputElement).value).toBe('');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Gerar links automaticamente' }));
    fireEvent.change(screen.getByLabelText('Antecedência'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar configuração' }));
    await waitFor(() => expect(paymentApi.saveSettings).toHaveBeenCalled());
    expect(vi.mocked(paymentApi.saveSettings).mock.calls[0][1]).toEqual({
      ativo: true,
      geracao_automatica: true,
      dias_antecedencia: 2,
      handle: 'clinica',
    });
    fireEvent.change(key, { target: { value: 'nova-chave' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar configuração' }));
    await waitFor(() => expect(paymentApi.saveSettings).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect((screen.getByLabelText('Nova chave da conta') as HTMLInputElement).value).toBe(''),
    );
  });
  it('gera apenas por ação explícita, bloqueia clique duplicado e mostra link privado da plataforma', async () => {
    vi.mocked(paymentApi.charge).mockResolvedValue(null);
    let finish: (value: never) => void = () => undefined;
    vi.mocked(paymentApi.generate).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(
      <ChargePanel context={context} mensalidadeId="m1" payable onChanged={() => undefined} />,
      { wrapper },
    );
    const button = await screen.findByRole('button', { name: 'Gerar link de pagamento' });
    expect(paymentApi.generate).not.toHaveBeenCalled();
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(paymentApi.generate).toHaveBeenCalledOnce());
    finish({
      id: 'c1',
      status: 'AGUARDANDO_PAGAMENTO',
      valor: '50.00',
      vencimento_em: '2026-11-30',
      checkout_url: 'https://buy.infinitepay.io/abc',
      url_plataforma: `/pagamento/${'a'.repeat(43)}`,
      expira_em: null,
      ultimo_erro: null,
    } as never);
    const link = await screen.findByRole('link', { name: 'Abrir página de pagamento' });
    expect(link.getAttribute('href')).toContain('/pagamento/');
    expect(screen.getByRole('button', { name: 'Copiar link para o cliente' })).toBeTruthy();
  });
});
