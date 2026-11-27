'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { financeErrorMessage, money } from '@/features/finance/finance-utils';
import { formatDate } from '@/lib/format';
import { paymentApi, type PublicCharge } from './payments-api';
import {
  checkoutUrl,
  isPaymentToken,
  paymentStatus,
  shouldPollPayment,
  type PaymentEvidence,
} from './payment-utils';

type PaymentPageProps = { token: string; evidence?: PaymentEvidence | null; returned?: boolean };

export function PaymentPage(props: PaymentPageProps) {
  return <PaymentContent key={props.token} {...props} />;
}

function PaymentContent({ token, evidence, returned = false }: PaymentPageProps) {
  const [charge, setCharge] = useState<PublicCharge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const evidenceKey = evidence ? JSON.stringify(evidence) : '';
  useEffect(() => {
    if (!isPaymentToken(token)) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let current: PublicCharge | null = null;
    let fetching = false;
    const schedule = () => {
      clearTimeout(timer);
      if (
        current &&
        shouldPollPayment(current.status, attempts, document.visibilityState === 'visible')
      )
        timer = setTimeout(() => void load(false), 15000);
    };
    async function load(initial: boolean) {
      if (fetching || controller.signal.aborted) return;
      fetching = true;
      try {
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]);
        const result =
          initial && evidenceKey
            ? await paymentApi.confirm(token, JSON.parse(evidenceKey) as PaymentEvidence, signal)
            : await paymentApi.publicCharge(token, signal);
        if (controller.signal.aborted) return;
        attempts++;
        current = result;
        setCharge(result);
        setError(null);
        schedule();
      } catch (err) {
        if (!controller.signal.aborted)
          setError(
            financeErrorMessage(
              err,
              'Ainda não conseguimos confirmar o pagamento. Consulte a situação antes de tentar novamente.',
            ),
          );
      } finally {
        fetching = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    const visibility = () => {
      if (document.visibilityState !== 'visible') clearTimeout(timer);
      else schedule();
    };
    document.addEventListener('visibilitychange', visibility);
    void load(true);
    return () => {
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [token, evidenceKey, refresh]);
  const settled = charge?.status === 'QUITADO' || charge?.status === 'PAGO_VERIFICADO';
  const feedback = charge ? paymentStatus[charge.status] : null;
  const checkout =
    !loading && !error && charge?.status === 'AGUARDANDO_PAGAMENTO'
      ? checkoutUrl(charge.checkout_url, charge.provedor)
      : null;
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10 sm:px-6">
      <section className="surface w-full max-w-md space-y-6 p-6 sm:p-8" aria-label="Pagamento">
        <header>
          <p className="mb-2 text-sm font-semibold text-teal-800">Orbe</p>
          <h1 className="display text-3xl text-slate-900">Pagamento</h1>
        </header>
        {!isPaymentToken(token) ? (
          <p role="alert" className="text-sm text-red-800">
            Link de pagamento inválido. Solicite o link à administração.
          </p>
        ) : (
          <>
            {loading && (
              <p role="status" className="text-sm text-slate-600">
                Consultando pagamento...
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-800">
                {error}
              </p>
            )}
            {charge && (
              <>
                <div aria-live="polite">
                  <h2 className="font-semibold">{feedback?.title || 'Situação indisponível'}</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    {feedback?.description || 'Entre em contato com a administração.'}
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-4 border-y border-slate-200 py-5 text-sm">
                  <div>
                    <dt className="text-slate-600">Valor</dt>
                    <dd className="mt-1 text-xl font-semibold">{money(charge.valor)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-600">Vencimento</dt>
                    <dd className="mt-1 font-semibold">{formatDate(charge.vencimento_em)}</dd>
                  </div>
                </dl>
                {checkout && (
                  <Button asChild className="w-full">
                    <a href={checkout} rel="noopener noreferrer" referrerPolicy="no-referrer">
                      Pagar com {charge.provedor === 'ABACATEPAY' ? 'AbacatePay' : 'InfinitePay'}
                    </a>
                  </Button>
                )}
              </>
            )}
            {returned && !evidence && !settled && (
              <p className="text-sm text-slate-600">
                Confira a situação do pagamento antes de tentar novamente.
              </p>
            )}
            {!settled && (
              <Button
                variant="outline"
                className="w-full"
                disabled={loading}
                onClick={() => {
                  setLoading(true);
                  setRefresh((value) => value + 1);
                }}
              >
                Atualizar situação
              </Button>
            )}
          </>
        )}
      </section>
    </main>
  );
}
