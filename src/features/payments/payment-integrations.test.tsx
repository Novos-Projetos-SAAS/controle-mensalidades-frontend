import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaymentIntegrations } from './payment-integrations';
import { paymentApi } from './payments-api';
vi.mock('./payments-api', () => ({
  paymentApi: {
    integrations: vi.fn(),
    setDefaultProvider: vi.fn(),
    settings: vi.fn(),
    abacateSettings: vi.fn(),
  },
}));
const context = { organizacaoId: 'org', areaId: 'area' };
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe('integrações de pagamento', () => {
  it('exibe provedores reais e só altera o padrão por ação explícita', async () => {
    vi.mocked(paymentApi.integrations).mockResolvedValue({
      provedor_padrao: 'INFINITEPAY',
      infinitepay: { ativo: true },
      abacatepay: { ativo: true },
    });
    vi.mocked(paymentApi.setDefaultProvider).mockResolvedValue({
      provedor_padrao: 'ABACATEPAY',
      infinitepay: { ativo: true },
      abacatepay: { ativo: true },
    });
    vi.mocked(paymentApi.settings).mockResolvedValue({
      ativo: true,
      geracao_automatica: false,
      dias_antecedencia: 1,
      handle: 'test',
      has_api_key: true,
    });
    vi.mocked(paymentApi.abacateSettings).mockResolvedValue({
      id: null,
      ativo: true,
      ambiente: 'TESTE',
      has_api_key: true,
      has_webhook_secret: true,
      recorrencia_habilitada: true,
      cartao_recorrente: true,
      pix_automatico_disponivel: false,
      pix_automatico_estado: 'INDISPONIVEL',
      webhook_path: null,
      estado: 'ATIVA',
      producao_liberada: false,
    });
    render(<PaymentIntegrations context={context} />, { wrapper });
    const selector = await screen.findByLabelText('Provedor padrão');
    expect(paymentApi.setDefaultProvider).not.toHaveBeenCalled();
    expect(await screen.findByRole('heading', { name: 'InfinitePay' })).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'AbacatePay' })).toBeTruthy();
    expect(screen.queryByText('Em breve')).toBeNull();
    fireEvent.change(selector, { target: { value: 'ABACATEPAY' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar provedor padrão' }));
    await screen.findByText('Provedor padrão atualizado.');
    expect(paymentApi.setDefaultProvider).toHaveBeenCalledWith(context, 'ABACATEPAY');
  });
});
