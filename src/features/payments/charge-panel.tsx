'use client';
import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ErrorState, LoadingState } from '@/components/query-state';
import { financeKey, useFinanceQuery, type FinanceContext } from '@/features/finance/finance-api';
import { paymentApi, type PaymentProvider } from './payments-api';
import { paymentStatus, platformPaymentUrl } from './payment-utils';
import { financeErrorMessage } from '@/features/finance/finance-utils';

export function ChargePanel({
  context,
  mensalidadeId,
  payable,
  onChanged,
}: {
  context: FinanceContext;
  mensalidadeId: string;
  payable: boolean;
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
  const [copied, setCopied] = useState(false);
  async function generate() {
    if (locked.current || !providerActive || uncertain) return;
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
    if (locked.current) return;
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
  const path =
    charge?.url_plataforma && platformPaymentUrl(charge.url_plataforma, 'https://platform.invalid')
      ? charge.url_plataforma
      : null;
  return (
    <section
      className="mt-6 space-y-3 border-t border-slate-200 pt-4"
      aria-label="Pagamento online"
    >
      <h3 className="font-semibold">Pagamento online</h3>
      {query.isPending ? (
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
              <p className="text-sm text-slate-600">
                {charge.provedor === 'ABACATEPAY' ? 'AbacatePay' : 'InfinitePay'}
              </p>
              <p className="text-sm font-medium">
                {paymentStatus[charge.status]?.title || 'Situação indisponível'}
              </p>
              <p className="text-sm text-slate-600">{paymentStatus[charge.status]?.description}</p>
              {path && (
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline">
                    <a
                      href={path}
                      target="_blank"
                      rel="noopener noreferrer"
                      referrerPolicy="no-referrer"
                    >
                      Abrir página de pagamento
                    </a>
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={async () => {
                      try {
                        const url = platformPaymentUrl(path, window.location.origin);
                        if (!url) throw new Error();
                        await navigator.clipboard.writeText(url);
                        setCopied(true);
                      } catch {
                        setError('Não foi possível copiar. Abra a página e copie o endereço.');
                      }
                    }}
                  >
                    Copiar link para o cliente
                  </Button>
                </div>
              )}
              {copied && (
                <p role="status" className="text-sm text-teal-800">
                  Link copiado.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-600">Nenhum link de pagamento gerado.</p>
          )}
          {payable && (!charge || charge.status === 'EXPIRADO') && (
            <div className="space-y-3">
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
              <Button onClick={generate} disabled={busy || uncertain || !providerActive}>
                {busy ? 'Gerando...' : 'Gerar link de pagamento'}
              </Button>
            </div>
          )}
          <Button variant="outline" onClick={check} disabled={busy}>
            Conferir pagamento
          </Button>
        </>
      )}
      {error && (
        <div role="alert" className="text-sm text-red-800">
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
