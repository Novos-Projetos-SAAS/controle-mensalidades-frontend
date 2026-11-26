'use client';
import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ErrorState, LoadingState } from '@/components/query-state';
import { financeKey, useFinanceQuery, type FinanceContext } from '@/features/finance/finance-api';
import { paymentApi } from './payments-api';
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
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  async function generate() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await paymentApi.generate(context, mensalidadeId);
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
    setBusy(true);
    const result = await query.refetch();
    if (!result.isError) {
      setUncertain(false);
      setError(null);
      onChanged();
    }
    setBusy(false);
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
            <Button onClick={generate} disabled={busy || uncertain}>
              {busy ? 'Gerando...' : 'Gerar link de pagamento'}
            </Button>
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
