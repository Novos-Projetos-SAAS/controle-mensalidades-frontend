'use client';
import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ErrorState, LoadingState } from '@/components/query-state';
import {
  financeKey,
  useFinanceQuery,
  type Assinatura,
  type FinanceContext,
} from '@/features/finance/finance-api';
import { financeErrorMessage, money, todayLocal } from '@/features/finance/finance-utils';
import { formatDate } from '@/lib/format';
import { paymentApi, type Recurrence } from './payments-api';
import { checkoutUrl } from './payment-utils';
const statusLabels: Record<Recurrence['status'], string> = {
  PREPARANDO: 'Preparando adesão',
  CRIACAO_INCERTA: 'Criação em conferência',
  AGUARDANDO_AUTORIZACAO: 'Aguardando autorização',
  ATIVA: 'Recorrência ativa',
  FALHA_PAGAMENTO: 'Falha no pagamento recorrente',
  CANCELAMENTO_PENDENTE: 'Cancelamento pendente',
  CANCELADA: 'Recorrência cancelada',
  REVISAO: 'Recorrência em revisão',
};
export function RecurrencePanel({
  context,
  subscription,
  onChanged,
}: {
  context: FinanceContext;
  subscription: Assinatura;
  onChanged: () => void;
}) {
  const client = useQueryClient();
  const key = [...financeKey(context), 'recorrencia', subscription.id];
  const query = useFinanceQuery(context, ['recorrencia', subscription.id], (signal) =>
    paymentApi.recurrence(context, subscription.id, signal),
  );
  const settings = useFinanceQuery(context, ['abacatepay-settings'], (signal) =>
    paymentApi.abacateSettings(context, signal),
  );
  const [method, setMethod] = useState<'CARD' | 'PIX'>('CARD');
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  const recurrence = query.data;
  const config = settings.data;
  const today = todayLocal();
  const aligned =
    subscription.dia_vencimento >= 1 &&
    subscription.dia_vencimento <= 28 &&
    subscription.dia_vencimento === Number(today.slice(-2)) &&
    subscription.inicio_em.slice(0, 10) <= today;
  const configReady =
    !!config?.ativo &&
    config.recorrencia_habilitada &&
    (config.ambiente === 'TESTE' || config.producao_liberada);
  const methodReady =
    method === 'CARD' ? !!config?.cartao_recorrente : !!config?.pix_automatico_disponivel;
  const canCreate = subscription.status === 'ATIVA' && aligned && configReady && methodReady;
  const checkout =
    recurrence?.status === 'AGUARDANDO_AUTORIZACAO'
      ? checkoutUrl(recurrence.checkout_url, 'ABACATEPAY')
      : null;
  async function act(action: 'create' | 'check' | 'cancel') {
    if (locked.current || (action === 'create' && (!canCreate || uncertain || recurrence))) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      const result =
        action === 'create'
          ? await paymentApi.createRecurrence(context, subscription.id, method)
          : action === 'cancel'
            ? await paymentApi.cancelRecurrence(context, subscription.id)
            : await paymentApi.reconcileRecurrence(context, subscription.id);
      client.setQueryData(key, result);
      setUncertain(false);
      setConfirmCancel(false);
      onChanged();
    } catch (err) {
      if (action === 'create' || action === 'cancel') setUncertain(true);
      setError(
        financeErrorMessage(
          err,
          'Não foi possível confirmar a operação. Confira a recorrência antes de tentar novamente.',
        ),
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      aria-label="Recorrência AbacatePay"
      className="mt-6 space-y-4 border-t border-slate-200 pt-5"
    >
      <div>
        <h3 className="font-semibold">Recorrência AbacatePay</h3>
        <p className="mt-1 text-sm text-slate-600">
          A autorização acontece na página do provedor. A data do débito é definida pelo primeiro
          pagamento.
        </p>
      </div>
      {query.isPending || settings.isPending ? (
        <LoadingState rows={2} />
      ) : query.isError ? (
        <ErrorState
          message={financeErrorMessage(query.error, 'Não foi possível consultar a recorrência.')}
          retry={() => query.refetch()}
        />
      ) : (
        <>
          {recurrence ? (
            <>
              <p role="status" className="text-sm font-semibold">
                {statusLabels[recurrence.status]}
              </p>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-slate-600">Método</dt>
                  <dd>{recurrence.metodo === 'CARD' ? 'Cartão' : 'Pix Automático'}</dd>
                </div>
                <div>
                  <dt className="text-slate-600">Valor</dt>
                  <dd>{money(recurrence.valor)}</dd>
                </div>
                <div>
                  <dt className="text-slate-600">Ambiente</dt>
                  <dd>{recurrence.ambiente === 'TESTE' ? 'Teste, sem débito real' : 'Produção'}</dd>
                </div>
                {recurrence.proxima_cobranca_em && (
                  <div>
                    <dt className="text-slate-600">Próxima cobrança</dt>
                    <dd>{formatDate(recurrence.proxima_cobranca_em)}</dd>
                  </div>
                )}
                {recurrence.data_debito && (
                  <div>
                    <dt className="text-slate-600">Data do débito</dt>
                    <dd>{formatDate(recurrence.data_debito)}</dd>
                  </div>
                )}
              </dl>
              {recurrence.status === 'CRIACAO_INCERTA' && (
                <p className="text-sm text-amber-900">
                  A criação está em conferência. Não gere outra adesão enquanto esta situação não
                  for resolvida.
                </p>
              )}
              {recurrence.status === 'CANCELAMENTO_PENDENTE' && (
                <p className="text-sm text-amber-900">
                  O cancelamento ainda precisa ser confirmado pelo provedor. Consulte novamente
                  antes de assumir que os débitos cessaram.
                </p>
              )}
              {recurrence.status === 'REVISAO' && (
                <p className="text-sm text-amber-900">
                  A administração precisa conferir esta recorrência antes de uma nova tentativa.
                </p>
              )}
              {checkout && (
                <Button asChild variant="outline" className="w-full">
                  <a
                    href={checkout}
                    target="_blank"
                    rel="noopener noreferrer"
                    referrerPolicy="no-referrer"
                  >
                    Abrir adesão AbacatePay
                  </a>
                </Button>
              )}
              {recurrence.status !== 'CANCELADA' &&
                recurrence.status !== 'CANCELAMENTO_PENDENTE' &&
                !confirmCancel && (
                  <Button
                    variant="outline"
                    disabled={busy || uncertain}
                    onClick={() => setConfirmCancel(true)}
                  >
                    Cancelar recorrência
                  </Button>
                )}
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                Nenhuma recorrência vinculada. A adesão vale somente para esta assinatura e usa o
                cadastro do cliente.
              </p>
              {settings.isError ? (
                <ErrorState
                  message={financeErrorMessage(
                    settings.error,
                    'Não foi possível consultar a configuração AbacatePay.',
                  )}
                  retry={() => settings.refetch()}
                />
              ) : (
                <>
                  {!configReady && (
                    <p className="text-sm text-amber-900">
                      Ative a integração e habilite a recorrência em Integrações de pagamento.
                    </p>
                  )}
                  {!aligned && (
                    <p className="text-sm text-amber-900">
                      Neste MVP, a adesão exige vencimento de hoje e dia entre 1 e 28, com contrato
                      já iniciado.
                    </p>
                  )}
                  <label className="block">
                    <span className="field-label">Método da recorrência</span>
                    <select
                      className="select-field"
                      value={method}
                      disabled={busy}
                      onChange={(event) => setMethod(event.target.value as 'CARD' | 'PIX')}
                    >
                      <option value="CARD" disabled={!config?.cartao_recorrente}>
                        Cartão recorrente
                      </option>
                      <option value="PIX" disabled={!config?.pix_automatico_disponivel}>
                        {config?.pix_automatico_disponivel
                          ? 'Pix Automático'
                          : 'Pix Automático indisponível'}
                      </option>
                    </select>
                  </label>
                  <Button disabled={busy || uncertain || !canCreate} onClick={() => act('create')}>
                    {busy ? 'Processando...' : 'Gerar adesão recorrente'}
                  </Button>
                </>
              )}
            </>
          )}
          {confirmCancel && (
            <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
              <p className="text-sm text-amber-900">
                Solicitar o cancelamento dos próximos débitos desta recorrência? O contrato e
                pagamentos anteriores serão mantidos.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy || uncertain} onClick={() => act('cancel')}>
                  Confirmar cancelamento
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => setConfirmCancel(false)}>
                  Manter recorrência
                </Button>
              </div>
            </div>
          )}
          {(recurrence || uncertain) && (
            <Button variant="outline" disabled={busy} onClick={() => act('check')}>
              Conferir recorrência
            </Button>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-800">
          {error}
        </p>
      )}
    </section>
  );
}
