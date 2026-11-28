'use client';

import { CalendarDays, CreditCard, FileText, ReceiptText, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ErrorState, LoadingState } from '@/components/query-state';
import { ChargePanel } from '@/features/payments/charge-panel';
import { formatDate } from '@/lib/format';
import { cents, financeErrorMessage, money } from './finance-utils';
import { financeApi, useFinanceQuery, type FinanceContext, type Mensalidade } from './finance-api';

const statusColors: Record<Mensalidade['status'], string> = {
  PAGA: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  PENDENTE: 'border-amber-200 bg-amber-50 text-amber-900',
  PARCIAL: 'border-blue-200 bg-blue-50 text-blue-800',
  VENCIDA: 'border-red-200 bg-red-50 text-red-800',
  CANCELADA: 'border-slate-200 bg-slate-100 text-slate-700',
};
const statusLabels: Record<Mensalidade['status'], string> = {
  PAGA: 'Paga',
  PENDENTE: 'Pendente',
  PARCIAL: 'Parcialmente paga',
  VENCIDA: 'Vencida',
  CANCELADA: 'Cancelada',
};

export function InvoiceDetailsDialog({
  context,
  invoiceId,
  onClose,
  onReceive,
  onChanged,
}: {
  context: FinanceContext;
  invoiceId: string;
  onClose: () => void;
  onReceive: (id: string) => void;
  onChanged: () => void;
}) {
  const detail = useFinanceQuery(context, ['mensalidade', invoiceId], (signal) =>
    financeApi.mensalidade(context, invoiceId, signal),
  );
  const invoice = detail.data;
  const payable =
    !!invoice &&
    !['PAGA', 'CANCELADA'].includes(invoice.status) &&
    cents(invoice.saldo) > BigInt(0);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl p-0">
        <header className="border-b border-teal-100 bg-gradient-to-br from-teal-50 via-white to-white px-5 pb-5 pt-6 sm:px-7">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-teal-700">
            Financeiro / Mensalidades
          </p>
          <DialogTitle className="display mt-2 pr-9 text-3xl leading-tight text-slate-900 sm:text-4xl">
            Detalhes da mensalidade
          </DialogTitle>
          <DialogDescription className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
            Acompanhe os valores, os recebimentos e o link de pagamento desta mensalidade.
          </DialogDescription>
        </header>

        <div className="space-y-5 px-4 py-5 sm:px-7 sm:py-6">
          {detail.isPending ? (
            <LoadingState rows={3} />
          ) : detail.isError ? (
            <ErrorState
              message={financeErrorMessage(
                detail.error,
                'Não foi possível carregar a mensalidade. Tente novamente.',
              )}
              retry={() => detail.refetch()}
            />
          ) : invoice ? (
            <>
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cliente</p>
                  <h2 className="mt-1 break-words text-lg font-semibold text-slate-900 sm:text-xl">
                    {invoice.cliente_nome}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Competência {invoice.competencia.slice(0, 7)}
                  </p>
                </div>
                <span
                  className={'inline-flex w-fit shrink-0 items-center rounded-full border px-3 py-1.5 text-xs font-semibold ' + statusColors[invoice.status]}
                >
                  {statusLabels[invoice.status]}
                </span>
              </div>

              <section aria-label="Valores da mensalidade" className="grid gap-3 sm:grid-cols-3">
                <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm text-slate-600">
                    <FileText size={17} className="text-slate-500" aria-hidden="true" />
                    Valor total
                  </div>
                  <strong className="display block break-words text-2xl text-slate-900">
                    {money(invoice.valor_final)}
                  </strong>
                </div>
                <div className="min-w-0 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm text-emerald-800">
                    <CreditCard size={17} aria-hidden="true" />
                    Recebido
                  </div>
                  <strong className="display block break-words text-2xl text-emerald-900">
                    {money(invoice.valor_pago)}
                  </strong>
                </div>
                <div className="min-w-0 rounded-2xl border border-teal-200 bg-teal-50 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm text-teal-800">
                    <Wallet size={17} aria-hidden="true" />
                    Em aberto
                  </div>
                  <strong className="display block break-words text-2xl text-teal-950">
                    {money(invoice.saldo)}
                  </strong>
                </div>
              </section>

              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <CalendarDays size={17} className="shrink-0 text-teal-700" aria-hidden="true" />
                <span className="text-slate-600">Vencimento</span>
                <strong className="font-semibold text-slate-900">{formatDate(invoice.vencimento_em)}</strong>
              </div>

              <section aria-label="Recebimentos registrados" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <ReceiptText size={19} className="text-teal-700" aria-hidden="true" />
                  <h3 className="font-semibold text-slate-900">Recebimentos registrados</h3>
                </div>
                {invoice.pagamentos?.length ? (
                  <ul className="mt-4 space-y-2">
                    {invoice.pagamentos.map((payment) => (
                      <li
                        key={payment.id}
                        className="flex min-w-0 flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span className="min-w-0 break-words text-slate-700">
                          {formatDate(payment.pago_em)} · {payment.forma_pagamento}
                        </span>
                        <strong className="shrink-0 font-semibold text-slate-900">
                          {money(payment.valor)}
                        </strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">Nenhum recebimento registrado.</p>
                )}
              </section>

              <ChargePanel
                context={context}
                mensalidadeId={invoice.id}
                payable={payable}
                quitada={invoice.status === 'PAGA'}
                onChanged={onChanged}
              />

              <footer className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">
                  As informações são consultadas no financeiro da organização.
                </p>
                <div className="grid w-full shrink-0 gap-2 sm:flex sm:w-auto sm:items-center">
                  <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onClose}>
                    Voltar à lista
                  </Button>
                  {payable && (
                    <Button type="button" className="w-full sm:w-auto" onClick={() => onReceive(invoice.id)}>
                      Registrar recebimento
                    </Button>
                  )}
                </div>
              </footer>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
