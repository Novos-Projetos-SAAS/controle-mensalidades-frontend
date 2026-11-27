import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AbacatePaySettings } from './abacatepay-settings';
import { paymentApi } from './payments-api';
vi.mock('./payments-api', () => ({
  paymentApi: { abacateSettings: vi.fn(), saveAbacateSettings: vi.fn() },
}));
const context = { organizacaoId: 'org', areaId: 'area' };
const settings = {
  id: 'config-1',
  ativo: true,
  ambiente: 'TESTE' as const,
  has_api_key: true,
  has_webhook_secret: true,
  recorrencia_habilitada: true,
  cartao_recorrente: true,
  pix_automatico_disponivel: false,
  pix_automatico_estado: 'INDISPONIVEL' as const,
  webhook_path: '/api/v1/webhooks/abacatepay/config-1',
  estado: 'ATIVA' as const,
  producao_liberada: false,
};
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe('configuração AbacatePay', () => {
  it('mantém credenciais ausentes da leitura e limpa novas credenciais após salvar', async () => {
    vi.mocked(paymentApi.abacateSettings).mockResolvedValue(settings);
    vi.mocked(paymentApi.saveAbacateSettings).mockResolvedValue(settings);
    render(<AbacatePaySettings context={context} />, { wrapper });
    const key = await screen.findByLabelText('Nova API Key AbacatePay');
    const secret = screen.getByLabelText('Novo segredo do webhook AbacatePay');
    expect((key as HTMLInputElement).value).toBe('');
    expect((secret as HTMLInputElement).type).toBe('password');
    fireEvent.change(key, { target: { value: 'replacement-key' } });
    fireEvent.change(secret, { target: { value: 'replacement-secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar AbacatePay' }));
    await screen.findByRole('status');
    expect(paymentApi.saveAbacateSettings).toHaveBeenCalledWith(
      context,
      expect.objectContaining({ api_key: 'replacement-key', webhook_secret: 'replacement-secret' }),
    );
    expect((key as HTMLInputElement).value).toBe('');
    expect((secret as HTMLInputElement).value).toBe('');
  });
  it('permite salvar produção desativada e informa Pix sem liberar capability por checkbox', async () => {
    vi.mocked(paymentApi.abacateSettings).mockResolvedValue(settings);
    vi.mocked(paymentApi.saveAbacateSettings).mockResolvedValue({
      ...settings,
      ativo: false,
      ambiente: 'PRODUCAO',
    });
    render(<AbacatePaySettings context={context} />, { wrapper });
    fireEvent.change(await screen.findByLabelText('Ambiente AbacatePay'), {
      target: { value: 'PRODUCAO' },
    });
    const activate = screen.getByLabelText('Ativar AbacatePay') as HTMLInputElement;
    expect(activate.disabled).toBe(true);
    expect(activate.checked).toBe(false);
    const pix = screen.getByLabelText('Pix Automático') as HTMLInputElement;
    expect(pix.disabled).toBe(true);
    expect(pix.checked).toBe(false);
    expect(screen.getByText(/Produção depende de homologação/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar AbacatePay' }));
    await waitFor(() =>
      expect(paymentApi.saveAbacateSettings).toHaveBeenCalledWith(
        context,
        expect.objectContaining({ ativo: false, ambiente: 'PRODUCAO' }),
      ),
    );
  });
});
