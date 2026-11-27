import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFinanceQuery } from '@/features/finance/finance-api';
import { paymentApi } from './payments-api';
import { ChargePanel } from './charge-panel';
import { PaymentPage } from './payment-page';
import { shouldPollPayment } from './payment-utils';

vi.mock('@/features/finance/finance-api', () => ({
  useFinanceQuery: vi.fn(),
  financeKey: (c: { organizacaoId: string; areaId: string }) => [
    'financeiro',
    c.organizacaoId,
    c.areaId,
  ],
}));
vi.mock('./payments-api', () => ({
  paymentApi: {
    charge: vi.fn(),
    generate: vi.fn(),
    reconcile: vi.fn(),
    publicCharge: vi.fn(),
    confirm: vi.fn(),
    integrations: vi.fn(),
  },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const context = { organizacaoId: 'org-settlement', areaId: 'area-settlement' };
const charge = {
  id: 'charge',
  provedor: 'ABACATEPAY' as const,
  status: 'AGUARDANDO_PAGAMENTO',
  valor: '100.00',
  vencimento_em: '2026-11-25',
  expira_em: null,
  checkout_url: 'https://app.abacatepay.com/pay/bill_test',
  url_plataforma: `/pagamento/${'a'.repeat(43)}`,
  ultimo_erro: null,
};
function mockQueries(
  value:
    | typeof charge
    | (Omit<typeof charge, 'status'> & { status: string; requer_conferencia?: boolean }),
) {
  vi.mocked(useFinanceQuery).mockImplementation(
    (_c, key) =>
      ({
        data:
          key[0] === 'cobranca'
            ? value
            : {
                provedor_padrao: 'ABACATEPAY',
                infinitepay: { ativo: true },
                abacatepay: { ativo: true },
              },
        isPending: false,
        isError: false,
        refetch: vi.fn().mockResolvedValue({ data: value }),
      }) as never,
  );
}
function panel() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ChargePanel
        context={context}
        mensalidadeId="m"
        payable={false}
        quitada
        onChanged={vi.fn()}
      />
    </QueryClientProvider>,
  );
}
describe('quitação financeira na interface', () => {
  it('esconde ações de cobrança imediatamente após quitação, mesmo com cache antigo', () => {
    mockQueries(charge);
    panel();
    expect(screen.getByText('Mensalidade quitada')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Conferir pagamento' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copiar link para o cliente' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Abrir página de pagamento' })).toBeNull();
    expect(paymentApi.reconcile).not.toHaveBeenCalled();
    expect(paymentApi.generate).not.toHaveBeenCalled();
  });
  it('mantém alerta administrativo de pagamento externo posterior sem reabrir link', () => {
    mockQueries({ ...charge, status: 'QUITADO', requer_conferencia: true });
    panel();
    expect(screen.getByText('Mensalidade quitada')).toBeTruthy();
    expect(screen.getByText(/recebimento externo.*conferência/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Conferir pagamento' })).toBeNull();
  });
  it('recebimento externo após baixa parcial permanece em análise sem oferecer link', () => {
    mockQueries({ ...charge, status: 'PAGO_EM_REVISAO', requer_conferencia: true });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ChargePanel context={context} mensalidadeId="m" payable onChanged={vi.fn()} />
      </QueryClientProvider>,
    );
    expect(screen.getByText('Pagamento em análise')).toBeTruthy();
    expect(screen.getByText(/administração precisa conferir este pagamento/i)).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Abrir página de pagamento' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copiar link para o cliente' })).toBeNull();
  });
  it('página privada informa quitação sem exigir nova conferência no retorno', async () => {
    vi.mocked(paymentApi.publicCharge).mockResolvedValue({ ...charge, status: 'QUITADO' });
    render(<PaymentPage token={'a'.repeat(43)} returned />);
    expect(await screen.findByRole('heading', { name: 'Mensalidade quitada' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Pagar com/ })).toBeNull();
    expect(
      screen.queryByText('Confira a situação do pagamento antes de tentar novamente.'),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: 'Atualizar situação' })).toBeNull();
    await waitFor(() => expect(paymentApi.publicCharge).toHaveBeenCalledTimes(1));
    expect(shouldPollPayment('QUITADO', 1, true)).toBe(false);
  });
});
