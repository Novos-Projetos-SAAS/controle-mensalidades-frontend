import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RecurrencePanel } from './recurrence-panel';
import { paymentApi, type Recurrence } from './payments-api';
import type { Assinatura } from '@/features/finance/finance-api';
vi.mock('./payments-api', () => ({
  paymentApi: {
    abacateSettings: vi.fn(),
    recurrence: vi.fn(),
    createRecurrence: vi.fn(),
    reconcileRecurrence: vi.fn(),
    cancelRecurrence: vi.fn(),
  },
}));
const context = { organizacaoId: 'org', areaId: 'area' };
const subscription: Assinatura = {
  id: 'subscription-1',
  cliente_id: 'customer-1',
  cliente_nome: 'Cliente teste',
  plano_comercial_id: 'plan-1',
  plano_nome: 'Mensal',
  valor_contratado: '100.00',
  desconto_recorrente: '0.00',
  dia_vencimento: 25,
  inicio_em: '2026-11-01',
  fim_em: null,
  status: 'ATIVA',
  criado_em: '2026-11-01',
};
const recurrence: Recurrence = {
  id: 'recurrence-1',
  assinatura_id: subscription.id,
  status: 'AGUARDANDO_AUTORIZACAO',
  metodo: 'CARD',
  checkout_url: 'https://app.abacatepay.com/pay/bill_test',
  assinatura_externa_id: 'sub_test',
  ambiente: 'TESTE',
  valor: '100.00',
  data_debito: null,
  proxima_cobranca_em: null,
  ciclo_inicio_em: null,
  ciclo_fim_em: null,
  ultimo_erro: null,
};
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 25, 12));
  vi.mocked(paymentApi.abacateSettings).mockResolvedValue({
    id: 'config-1',
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
  vi.mocked(paymentApi.recurrence).mockResolvedValue(null);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});
describe('recorrência individual', () => {
  it('gera adesão uma vez e aguarda autorização do cliente, sem prometer pagamento', async () => {
    let finish!: (value: Recurrence) => void;
    vi.mocked(paymentApi.createRecurrence).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    render(
      <RecurrencePanel context={context} subscription={subscription} onChanged={() => undefined} />,
      { wrapper },
    );
    const button = await screen.findByRole('button', { name: 'Gerar adesão recorrente' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(paymentApi.createRecurrence).toHaveBeenCalledOnce();
    expect(paymentApi.createRecurrence).toHaveBeenCalledWith(context, 'subscription-1', 'CARD');
    finish(recurrence);
    expect(
      (await screen.findByRole('link', { name: 'Abrir adesão AbacatePay' })).getAttribute('href'),
    ).toBe('https://app.abacatepay.com/pay/bill_test');
    expect(screen.getByText('Aguardando autorização')).toBeTruthy();
    expect(screen.queryByText('Pagamento confirmado')).toBeNull();
  });
  it('bloqueia nova tentativa após falha incerta até conferir no servidor', async () => {
    vi.mocked(paymentApi.createRecurrence).mockRejectedValueOnce(new Error('fetch failed'));
    vi.mocked(paymentApi.reconcileRecurrence).mockResolvedValue({
      ...recurrence,
      status: 'CRIACAO_INCERTA',
    });
    render(
      <RecurrencePanel context={context} subscription={subscription} onChanged={() => undefined} />,
      { wrapper },
    );
    const button = await screen.findByRole('button', { name: 'Gerar adesão recorrente' });
    fireEvent.click(button);
    await screen.findByRole('alert');
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(paymentApi.createRecurrence).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Conferir recorrência' }));
    await screen.findByText('Criação em conferência');
    expect(screen.queryByRole('button', { name: 'Gerar adesão recorrente' })).toBeNull();
  });
  it('confirma cancelamento e mantém cancelamento pendente informado pelo servidor', async () => {
    vi.mocked(paymentApi.recurrence).mockResolvedValue({ ...recurrence, status: 'ATIVA' });
    vi.mocked(paymentApi.cancelRecurrence).mockResolvedValue({
      ...recurrence,
      status: 'CANCELAMENTO_PENDENTE',
      checkout_url: null,
    });
    render(
      <RecurrencePanel context={context} subscription={subscription} onChanged={() => undefined} />,
      { wrapper },
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar recorrência' }));
    expect(paymentApi.cancelRecurrence).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cancelamento' }));
    await screen.findByText('Cancelamento pendente');
    expect(screen.queryByRole('link', { name: 'Abrir adesão AbacatePay' })).toBeNull();
    expect(paymentApi.cancelRecurrence).toHaveBeenCalledOnce();
  });
  it('impede adesão fora do vencimento alinhado e mantém Pix indisponível', async () => {
    render(
      <RecurrencePanel
        context={context}
        subscription={{ ...subscription, dia_vencimento: 30 }}
        onChanged={() => undefined}
      />,
      { wrapper },
    );
    const button = await screen.findByRole('button', { name: 'Gerar adesão recorrente' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/vencimento de hoje e dia entre 1 e 28/)).toBeTruthy();
    expect(
      (screen.getByRole('option', { name: 'Pix Automático indisponível' }) as HTMLOptionElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(button);
    expect(paymentApi.createRecurrence).not.toHaveBeenCalled();
  });
});
