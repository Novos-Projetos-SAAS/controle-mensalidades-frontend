import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useFinanceQuery, type Mensalidade } from '@/features/finance/finance-api';
import { InvoiceLinkBadge, InvoiceLinkShortcut } from './invoice-link-shortcut';

vi.mock('@/features/finance/finance-api', () => ({ useFinanceQuery: vi.fn() }));

const context = { organizacaoId: 'org', areaId: 'area' };
const path = '/pagamento/' + 'a'.repeat(43);
const invoice = {
  id: 'mensalidade-ficticia',
  status: 'PENDENTE',
  saldo: '42.00',
} as Mensalidade;
const active = {
  id: 'cobranca-ficticia',
  provedor: 'ABACATEPAY',
  status: 'AGUARDANDO_PAGAMENTO',
  url_plataforma: path,
};

function query(charge: typeof active | null) {
  vi.mocked(useFinanceQuery).mockReturnValue({
    data: charge,
    isPending: false,
    isError: false,
  } as never);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('atalho do link na lista de mensalidades', () => {
  it('identifica a cobrança existente e copia o link sem criar outra', async () => {
    query(active);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    render(
      <>
        <InvoiceLinkBadge context={context} invoice={invoice} />
        <InvoiceLinkShortcut context={context} invoice={invoice} />
      </>,
    );

    expect(screen.getByText('Link gerado')).toBeTruthy();
    expect(screen.getByLabelText('Link de pagamento existente').textContent)
      .not.toContain('Link gerado');
    fireEvent.click(screen.getByRole('button', { name: 'Copiar link' }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        new URL(path, window.location.origin).href,
      ),
    );
    expect((await screen.findByRole('status')).textContent).toContain('Link copiado');
  });

  it('não disponibiliza link expirado, em análise ou com caminho adulterado', () => {
    for (const charge of [
      { ...active, status: 'EXPIRADO' },
      { ...active, status: 'PAGO_EM_REVISAO' },
      { ...active, url_plataforma: '//evil.example/pagamento/roubo' },
    ]) {
      query(charge);
      const view = render(
        <>
          <InvoiceLinkBadge context={context} invoice={invoice} />
          <InvoiceLinkShortcut context={context} invoice={invoice} />
        </>,
      );
      expect(screen.queryByRole('button', { name: 'Copiar link' })).toBeNull();
      expect(screen.queryByText('Link gerado')).toBeNull();
      view.unmount();
    }
  });

  it('não consulta nem compartilha cobrança de mensalidade quitada', () => {
    query(active);
    render(
      <>
        <InvoiceLinkBadge
          context={context}
          invoice={{ ...invoice, status: 'PAGA', saldo: '0.00' }}
        />
        <InvoiceLinkShortcut
          context={context}
          invoice={{ ...invoice, status: 'PAGA', saldo: '0.00' }}
        />
      </>,
    );
    expect(vi.mocked(useFinanceQuery).mock.calls[0]?.[3]).toBe(false);
    expect(screen.queryByRole('button', { name: 'Copiar link' })).toBeNull();
    expect(screen.queryByText('Link gerado')).toBeNull();
  });
});
