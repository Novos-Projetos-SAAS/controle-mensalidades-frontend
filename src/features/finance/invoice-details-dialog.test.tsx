import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useFinanceQuery, type Mensalidade } from './finance-api';
import { InvoiceDetailsDialog } from './invoice-details-dialog';

vi.mock('./finance-api', () => ({
  financeApi: { mensalidade: vi.fn() },
  useFinanceQuery: vi.fn(),
}));
vi.mock('@/features/payments/charge-panel', () => ({
  ChargePanel: () => <section aria-label="Pagamento online">Cobrança da mensalidade</section>,
}));

const context = { organizacaoId: 'org', areaId: 'area' };
const mensalidade = {
  id: 'mensalidade-ficticia',
  cliente_nome: 'Cliente fictício E2E',
  competencia: '2026-11-01',
  vencimento_em: '2026-11-30',
  valor_final: '150.00',
  valor_pago: '50.00',
  saldo: '100.00',
  status: 'PARCIAL',
  pagamentos: [{
    id: 'pagamento-ficticio',
    valor: '50.00',
    forma_pagamento: 'PIX',
    pago_em: '2026-11-24T17:00:00.000Z',
  }],
} as Mensalidade;
const onClose = vi.fn();
const onReceive = vi.fn();
const onChanged = vi.fn();

function show(invoice: Mensalidade) {
  vi.mocked(useFinanceQuery).mockReturnValue({
    data: invoice,
    isPending: false,
    isError: false,
  } as never);
  return render(
    <InvoiceDetailsDialog
      context={context}
      invoiceId={invoice.id}
      onClose={onClose}
      onReceive={onReceive}
      onChanged={onChanged}
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('modal renovado de detalhes da mensalidade', () => {
  it('mostra valores separados, histórico, vencimento e painel de link', () => {
    show(mensalidade);
    const dialog = screen.getByRole('dialog', { name: 'Detalhes da mensalidade' });
    const normalizedText = dialog.textContent?.replace(/\u00a0/g, ' ');
    expect(normalizedText).toContain('Cliente fictício E2E');
    expect(normalizedText).toContain('Parcialmente paga');
    expect(normalizedText).toContain('R$ 150,00');
    expect(normalizedText).toContain('R$ 50,00');
    expect(normalizedText).toContain('R$ 100,00');
    expect(dialog.querySelectorAll('li')).toHaveLength(1);
    expect(screen.getByRole('region', { name: 'Pagamento online' })).toBeTruthy();
  });

  it('oferece registro manual somente para mensalidade que aceita recebimento', () => {
    show(mensalidade);
    fireEvent.click(screen.getByRole('button', { name: 'Registrar recebimento' }));
    expect(onReceive).toHaveBeenCalledWith(mensalidade.id);
  });

  it('não oferece novo recebimento quando já está paga', () => {
    show({ ...mensalidade, status: 'PAGA', valor_pago: '150.00', saldo: '0.00' });
    expect(screen.getByText('Paga')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Registrar recebimento' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar à lista' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
