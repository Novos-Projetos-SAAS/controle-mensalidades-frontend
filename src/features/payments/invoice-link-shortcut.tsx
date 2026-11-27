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
export function InvoiceLinkShortcut({
  context,
  invoice,
}: {
  context: FinanceContext;
  invoice: Mensalidade;
}) {
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
  const path = availablePaymentPath(query.data, payable);
  if (!path) return null;

  return (
    <div className="flex min-w-0 flex-col gap-1.5 sm:items-end" aria-label="Link de pagamento existente">
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
        <Link2 size={14} aria-hidden="true" />
        Link gerado
      </span>
      <CopyPaymentLinkButton path={path} className="w-full whitespace-nowrap sm:w-auto" />
    </div>
  );
}
