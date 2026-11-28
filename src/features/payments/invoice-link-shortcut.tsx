'use client';

import { Link2 } from 'lucide-react';
import { useFinanceQuery, type FinanceContext, type Mensalidade } from '@/features/finance/finance-api';
import { cents } from '@/features/finance/finance-utils';
import { paymentApi } from './payments-api';
import { availablePaymentPath } from './payment-utils';
import { CopyPaymentLinkButton } from './copy-payment-link-button';

/**
 * Consulta a cobrança da mensalidade visível: nunca gera checkout por conta própria.
 * A API já limita o retorno ao escopo administrativo da organização e da área.
 */
function useInvoiceLink(context: FinanceContext, invoice: Mensalidade): string | null {
  const payable =
    invoice.status !== 'PAGA' &&
    invoice.status !== 'CANCELADA' &&
    cents(invoice.saldo) > BigInt(0);
  const query = useFinanceQuery(
    context,
    ['cobranca', invoice.id],
    (signal) => paymentApi.charge(context, invoice.id, signal),
    payable,
  );
  return availablePaymentPath(query.data, payable);
}

/** Indicador visual na coluna esquerda, antes do nome do cliente. */
export function InvoiceLinkBadge({
  context,
  invoice,
}: {
  context: FinanceContext;
  invoice: Mensalidade;
}) {
  const path = useInvoiceLink(context, invoice);
  if (!path) return null;
  return (
    <span className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
      <Link2 size={14} aria-hidden="true" />
      Link gerado
    </span>
  );
}

/** Ação de cópia na coluna direita, imediatamente antes do botão Detalhes. */
export function InvoiceLinkShortcut({
  context,
  invoice,
}: {
  context: FinanceContext;
  invoice: Mensalidade;
}) {
  const path = useInvoiceLink(context, invoice);
  if (!path) return null;
  return (
    <div className="min-w-0" aria-label="Link de pagamento existente">
      <CopyPaymentLinkButton path={path} className="w-full whitespace-nowrap sm:w-auto" />
    </div>
  );
}
