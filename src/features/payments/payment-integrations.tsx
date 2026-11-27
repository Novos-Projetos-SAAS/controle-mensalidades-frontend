'use client';
import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ErrorState, LoadingState } from '@/components/query-state';
import { financeKey, useFinanceQuery, type FinanceContext } from '@/features/finance/finance-api';
import { financeErrorMessage } from '@/features/finance/finance-utils';
import { InfinitePaySettings } from './infinitepay-settings';
import { AbacatePaySettings } from './abacatepay-settings';
import { paymentApi, type PaymentIntegrationsData, type PaymentProvider } from './payments-api';
function DefaultProvider({
  context,
  integrations,
}: {
  context: FinanceContext;
  integrations: PaymentIntegrationsData;
}) {
  const client = useQueryClient();
  const [selected, setSelected] = useState<PaymentProvider | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const locked = useRef(false);
  const provider = selected ?? integrations.provedor_padrao;
  const active =
    provider === 'ABACATEPAY' ? integrations.abacatepay.ativo : integrations.infinitepay.ativo;
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (locked.current || !active) return;
    locked.current = true;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const result = await paymentApi.setDefaultProvider(context, provider);
      client.setQueryData([...financeKey(context), 'payment-integrations'], result);
      setSelected(null);
      setSaved(true);
    } catch (err) {
      setError(financeErrorMessage(err, 'Não foi possível alterar o provedor padrão.'));
    } finally {
      locked.current = false;
      setSaving(false);
    }
  }
  return (
    <form
      onSubmit={save}
      className="surface space-y-4 p-5 sm:p-6"
      aria-label="Padrão de novas cobranças"
    >
      <div>
        <h2 className="font-semibold">Provedor padrão</h2>
        <p className="mt-1 text-sm text-slate-600">
          Usado nas novas cobranças quando nenhum provedor for escolhido. Links e recorrências
          existentes mantêm seu provedor.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block min-w-0 sm:max-w-sm sm:flex-1">
          <span className="field-label">Provedor padrão</span>
          <select
            className="select-field"
            value={provider}
            disabled={saving}
            onChange={(event) => {
              setSelected(event.target.value as PaymentProvider);
              setSaved(false);
            }}
          >
            <option value="INFINITEPAY" disabled={!integrations.infinitepay.ativo}>
              InfinitePay{!integrations.infinitepay.ativo ? ' (desativado)' : ''}
            </option>
            <option value="ABACATEPAY" disabled={!integrations.abacatepay.ativo}>
              AbacatePay{!integrations.abacatepay.ativo ? ' (desativado)' : ''}
            </option>
          </select>
        </label>
        <Button type="submit" disabled={saving || !active}>
          {saving ? 'Salvando...' : 'Salvar provedor padrão'}
        </Button>
      </div>
      {!active && (
        <p className="text-sm text-slate-600">
          Ative um provedor abaixo para defini-lo como padrão.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-800">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-teal-800">
          Provedor padrão atualizado.
        </p>
      )}
    </form>
  );
}
export function PaymentIntegrations({ context }: { context: FinanceContext }) {
  const query = useFinanceQuery(context, ['payment-integrations'], (signal) =>
    paymentApi.integrations(context, signal),
  );
  return (
    <div className="space-y-5">
      {query.isPending ? (
        <LoadingState rows={1} />
      ) : query.isError ? (
        <ErrorState
          message={financeErrorMessage(query.error, 'Não foi possível carregar o provedor padrão.')}
          retry={() => query.refetch()}
        />
      ) : (
        <DefaultProvider context={context} integrations={query.data} />
      )}
      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-2">
        <InfinitePaySettings context={context} />
        <AbacatePaySettings context={context} />
      </div>
    </div>
  );
}
