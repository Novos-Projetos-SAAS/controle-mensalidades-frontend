'use client';
import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorState, LoadingState } from '@/components/query-state';
import { financeKey, useFinanceQuery, type FinanceContext } from '@/features/finance/finance-api';
import { paymentApi, type PaymentProvider } from './payments-api';
import { availablePaymentPath, paymentStatus } from './payment-utils';
import { CopyPaymentLinkButton } from './copy-payment-link-button';
import { financeErrorMessage } from '@/features/finance/finance-utils';

export function ChargePanel({
  context,
  mensalidadeId,
  payable,
  quitada = false,
  onChanged,
}: {
  context: FinanceContext;
  mensalidadeId: string;
  payable: boolean;
  quitada?: boolean;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const queryKey = [...financeKey(context), 'cobranca', mensalidadeId];
  const query = useFinanceQuery(context, ['cobranca', mensalidadeId], (signal) =>
    paymentApi.charge(context, mensalidadeId, signal),
  );
  const integrations = useFinanceQuery(context, ['payment-integrations'], (signal) =>
    paymentApi.integrations(context, signal),
  );
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider | null>(null);
  const provider = selectedProvider ?? integrations.data?.provedor_padrao ?? 'INFINITEPAY';
  const providerActive =
    provider === 'ABACATEPAY'
      ? integrations.data?.abacatepay.ativo
      : integrations.data?.infinitepay.ativo;
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const settled =
    quitada || query.data?.status === 'QUITADO' || query.data?.status === 'PAGO_VERIFICADO';
  const terminal = settled || !payable;
  async function generate() {
    if (terminal || locked.current || !providerActive || uncertain) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await paymentApi.generate(context, mensalidadeId, provider);
      queryClient.setQueryData(queryKey, result);
      onChanged();
    } catch (err) {
      setUncertain(true);
      setError(financeErrorMessage(err, 'Não foi possível gerar o link de pagamento.'));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function check() {
    if (terminal || locked.current) return;
    locked.current = true;
    setBusy(true);
    try {
      if (query.data?.provedor === 'ABACATEPAY')
        await paymentApi.reconcile(context, query.data.id, {});
      const result = await query.refetch();
      if (!result.isError) {
        setUncertain(false);
        setError(null);
        onChanged();
      }
    } catch (err) {
      setError(financeErrorMessage(err, 'Não foi possível conferir o pagamento. Tente novamente.'));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const charge = query.data;
  const path = availablePaymentPath(charge, !settled && payable);
  return (
    <section
      className="min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
      aria-label="Pagamento online"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800">
          <Link2 size={19} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900">Pagamento online</h3>
          <p className="text-xs text-slate-500">Situação e acesso seguro à cobrança</p>
        </div>
      </div>
      {settled ? (
        <div aria-live="polite" className="space-y-2">
          <p className="text-sm font-medium">
            {
              paymentStatus[charge?.status === 'PAGO_VERIFICADO' ? 'PAGO_VERIFICADO' : 'QUITADO']
                .title
            }
          </p>
          <p className="text-sm text-slate-600">
            {
              paymentStatus[charge?.status === 'PAGO_VERIFICADO' ? 'PAGO_VERIFICADO' : 'QUITADO']
                .description
            }
          </p>
          {charge?.requer_conferencia && (
            <p role="alert" className="text-sm text-amber-800">
              Um recebimento externo precisa de conferência. Consulte o histórico antes de qualquer
              ajuste.
            </p>
          )}
        </div>
      ) : query.isPending ? (
        <LoadingState rows={1} />
      ) : query.isError ? (
        <ErrorState
          message={financeErrorMessage(
            query.error,
            'Não foi possível consultar o pagamento. Tente novamente.',
          )}
          retry={() => query.refetch()}
        />
      ) : (
        <>
          {charge ? (
            <>
              <div className="min-w-0 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {charge.provedor === 'ABACATEPAY' ? 'AbacatePay' : 'InfinitePay'}
                  </p>
                  {path && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
                      <Link2 size={14} aria-hidden="true" />
                      Link gerado
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-slate-900">
                  {paymentStatus[charge.status]?.title || 'Situação indisponível'}
                </p>
                <p className="text-sm leading-6 text-slate-600">
                  {paymentStatus[charge.status]?.description}
                </p>
              </div>
              {path && (
                <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                  <Button asChild variant="outline" className="w-full">
                    <a
                      href={path}
                      target="_blank"
                      rel="noopener noreferrer"
                      referrerPolicy="no-referrer"
                    >
                      <ExternalLink size={16} aria-hidden="true" />
                      Abrir página de pagamento
                    </a>
                  </Button>
                  <CopyPaymentLinkButton
                    path={path}
                    label="Copiar link para o cliente"
                    className="w-full"
                  />
                </div>
              )}

            </>
          ) : (
            <p className="text-sm text-slate-600">Nenhum link de pagamento gerado.</p>
          )}
          {payable && (!charge || charge.status === 'EXPIRADO') && (
            <div className="space-y-3 rounded-xl border border-teal-100 bg-teal-50/40 p-3 sm:p-4">
              {integrations.isPending ? (
                <LoadingState rows={1} />
              ) : integrations.isError ? (
                <ErrorState
                  message="Não foi possível carregar os provedores de pagamento."
                  retry={() => integrations.refetch()}
                />
              ) : (
                <label className="block">
                  <span className="field-label">Provedor da cobrança</span>
                  <select
                    className="select-field"
                    value={provider}
                    disabled={busy || uncertain}
                    onChange={(event) => setSelectedProvider(event.target.value as PaymentProvider)}
                  >
                    <option value="INFINITEPAY" disabled={!integrations.data?.infinitepay.ativo}>
                      InfinitePay
                    </option>
                    <option value="ABACATEPAY" disabled={!integrations.data?.abacatepay.ativo}>
                      AbacatePay
                    </option>
                  </select>
                </label>
              )}
              <Button className="w-full sm:w-auto" onClick={generate} disabled={busy || uncertain || !providerActive}>
                {busy ? 'Gerando...' : 'Gerar link de pagamento'}
              </Button>
            </div>
          )}
          {payable && (
            <Button className="w-full sm:w-auto" variant="outline" onClick={check} disabled={busy}>
              Conferir pagamento
            </Button>
          )}
        </>
      )}
      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p>{error}</p>
          {uncertain && (
            <p>
              Ainda não conseguimos confirmar o pagamento. Consulte a situação antes de tentar
              novamente.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
