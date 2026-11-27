'use client';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorState, LoadingState } from '@/components/query-state';
import { financeKey, useFinanceQuery, type FinanceContext } from '@/features/finance/finance-api';
import { paymentApi, type InfinitePaySettingsData } from './payments-api';
import { financeErrorMessage } from '@/features/finance/finance-utils';

function SettingsForm({
  context,
  settings,
}: {
  context: FinanceContext;
  settings: InfinitePaySettingsData;
}) {
  const queryClient = useQueryClient();
  const [active, setActive] = useState(settings.ativo);
  const [automatic, setAutomatic] = useState(settings.geracao_automatica);
  const [days, setDays] = useState<1 | 2>(settings.dias_antecedencia);
  const [handle, setHandle] = useState(settings.handle || '');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const result = await paymentApi.saveSettings(context, {
        ativo: active,
        geracao_automatica: automatic,
        dias_antecedencia: days,
        handle: handle.trim() || null,
        ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}),
      });
      setApiKey('');
      queryClient.setQueryData([...financeKey(context), 'infinitepay-settings'], result);
      setMessage('Configuração salva.');
    } catch (err) {
      setError(
        financeErrorMessage(err, 'Não foi possível salvar a configuração. Tente novamente.'),
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <form onSubmit={save} className="surface w-full max-w-2xl space-y-5 p-5 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">InfinitePay</h2>
        <p className="mt-1 text-sm text-slate-600">
          Configure os links de pagamento desta organização. A geração automática usa o saldo das
          mensalidades existentes.
        </p>
      </div>
      <fieldset disabled={saving} className="space-y-5">
        <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            className="size-5 accent-teal-800"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />{' '}
          Ativar InfinitePay
        </label>
        <label className="block">
          <span className="field-label">InfiniteTag da conta</span>
          <Input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            autoComplete="off"
            maxLength={100}
            placeholder="Sua InfiniteTag"
          />
        </label>
        <label className="block">
          <span className="field-label">Nova chave da conta</span>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="new-password"
            maxLength={512}
            aria-describedby="infinitepay-key-help"
          />
        </label>
        <p id="infinitepay-key-help" className="-mt-3 text-sm text-slate-600">
          {settings.has_api_key
            ? 'Chave cadastrada. Deixe em branco para manter a atual.'
            : 'Informe a chave da conta para ativar a integração.'}
        </p>
        <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            className="size-5 accent-teal-800"
            checked={automatic}
            disabled={!active}
            onChange={(e) => setAutomatic(e.target.checked)}
          />{' '}
          Gerar links automaticamente
        </label>
        <label className="block">
          <span className="field-label">Antecedência</span>
          <select
            className="select-field"
            value={days}
            onChange={(e) => setDays(Number(e.target.value) as 1 | 2)}
            disabled={!active || !automatic}
          >
            <option value="1">1 dia antes do vencimento</option>
            <option value="2">2 dias antes do vencimento</option>
          </select>
        </label>
      </fieldset>
      <p className="text-sm text-slate-600">
        Ao desativar, novos links deixam de ser gerados. Pagamentos em andamento continuam sendo
        conferidos.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-800">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-teal-800">
          {message}
        </p>
      )}
      <Button type="submit" disabled={saving}>
        {saving ? 'Salvando...' : 'Salvar configuração'}
      </Button>
    </form>
  );
}

export function InfinitePaySettings({ context }: { context: FinanceContext }) {
  const query = useFinanceQuery(context, ['infinitepay-settings'], (signal) =>
    paymentApi.settings(context, signal),
  );
  if (query.isPending) return <LoadingState rows={3} />;
  if (query.isError)
    return (
      <ErrorState
        message={financeErrorMessage(
          query.error,
          'Não foi possível carregar a configuração. Tente novamente.',
        )}
        retry={() => query.refetch()}
      />
    );
  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <SettingsForm context={context} settings={query.data} />
      <section
        className="surface space-y-4 p-5 sm:p-6"
        aria-labelledby="other-payment-options-heading"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="other-payment-options-heading" className="text-lg font-semibold">
              Outras opções de pagamento
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">Em breve</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={false}
            aria-labelledby="other-payment-options-heading"
            disabled
            className="mt-1 flex h-6 w-11 shrink-0 cursor-not-allowed items-center rounded-full border border-slate-300 bg-slate-200 p-0.5"
          >
            <span aria-hidden="true" className="size-4 rounded-full bg-white" />
          </button>
        </div>
        <p className="text-sm text-slate-600">
          Novas formas de receber pagamentos estarão disponíveis futuramente.
        </p>
      </section>
    </div>
  );
}
