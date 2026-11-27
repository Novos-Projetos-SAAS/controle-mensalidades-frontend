'use client';
import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorState, LoadingState } from '@/components/query-state';
import { financeKey, useFinanceQuery, type FinanceContext } from '@/features/finance/finance-api';
import { financeErrorMessage } from '@/features/finance/finance-utils';
import { paymentApi, type AbacatePaySettingsData } from './payments-api';
function SettingsForm({
  context,
  settings,
}: {
  context: FinanceContext;
  settings: AbacatePaySettingsData;
}) {
  const client = useQueryClient();
  const locked = useRef(false);
  const [active, setActive] = useState(settings.ativo);
  const [environment, setEnvironment] = useState(settings.ambiente);
  const [recurring, setRecurring] = useState(settings.recorrencia_habilitada);
  const [card, setCard] = useState(settings.cartao_recorrente);
  const [apiKey, setApiKey] = useState('');
  const [secret, setSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const productionBlocked = environment === 'PRODUCAO' && !settings.producao_liberada;
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (locked.current) return;
    locked.current = true;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const result = await paymentApi.saveAbacateSettings(context, {
        ativo: active && !productionBlocked,
        ambiente: environment,
        recorrencia_habilitada: recurring,
        cartao_recorrente: card,
        ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}),
        ...(secret.trim() ? { webhook_secret: secret.trim() } : {}),
      });
      setApiKey('');
      setSecret('');
      setActive(result.ativo);
      setRecurring(result.recorrencia_habilitada);
      setCard(result.cartao_recorrente);
      client.setQueryData([...financeKey(context), 'abacatepay-settings'], result);
      await client.invalidateQueries({
        queryKey: [...financeKey(context), 'payment-integrations'],
      });
      setMessage('Configuração AbacatePay salva.');
    } catch (err) {
      setError(
        financeErrorMessage(
          err,
          'Não foi possível salvar a configuração AbacatePay. Confira os dados e tente novamente.',
        ),
      );
    } finally {
      locked.current = false;
      setSaving(false);
    }
  }
  return (
    <form
      onSubmit={save}
      className="surface min-w-0 space-y-5 p-5 sm:p-6"
      aria-label="Configuração AbacatePay"
    >
      <div>
        <h2 className="text-lg font-semibold">AbacatePay</h2>
        <p className="mt-1 text-sm text-slate-600">
          Cobranças e adesões recorrentes desta organização.
        </p>
      </div>
      <fieldset disabled={saving} className="space-y-5">
        <label className="block">
          <span className="field-label">Ambiente AbacatePay</span>
          <select
            className="select-field"
            value={environment}
            onChange={(event) => {
              const next = event.target.value as 'TESTE' | 'PRODUCAO';
              setEnvironment(next);
              if (next === 'PRODUCAO' && !settings.producao_liberada) setActive(false);
            }}
          >
            <option value="TESTE">Teste</option>
            <option value="PRODUCAO">Produção</option>
          </select>
        </label>
        <p className="text-sm text-slate-600">
          {environment === 'TESTE'
            ? 'Ambiente de teste: pagamentos simulados, sem débito real.'
            : 'Produção depende de homologação externa. Você pode salvar as credenciais; a ativação continua indisponível.'}
        </p>
        <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            className="size-5 accent-teal-800"
            checked={active && !productionBlocked}
            disabled={productionBlocked}
            onChange={(event) => setActive(event.target.checked)}
          />
          Ativar AbacatePay
        </label>
        <label className="block">
          <span className="field-label">Nova API Key AbacatePay</span>
          <Input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            autoComplete="new-password"
            maxLength={512}
            aria-describedby="abacatepay-api-help"
          />
        </label>
        <p id="abacatepay-api-help" className="-mt-3 text-sm text-slate-600">
          {settings.has_api_key
            ? 'Chave cadastrada. Deixe em branco para manter a atual.'
            : 'Informe a API Key do ambiente escolhido.'}
        </p>
        <label className="block">
          <span className="field-label">Novo segredo do webhook AbacatePay</span>
          <Input
            type="password"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            autoComplete="new-password"
            maxLength={512}
            aria-describedby="abacatepay-webhook-help"
          />
        </label>
        <p id="abacatepay-webhook-help" className="-mt-3 text-sm text-slate-600">
          {settings.has_webhook_secret
            ? 'Segredo cadastrado. Deixe em branco para manter o atual.'
            : 'Cadastre o segredo usado para verificar as notificações de pagamento.'}
        </p>
        {environment !== settings.ambiente && (
          <p className="text-sm text-amber-900">
            Ao trocar de ambiente, informe as credenciais correspondentes. Cobranças em andamento
            podem impedir a troca.
          </p>
        )}
        <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            className="size-5 accent-teal-800"
            checked={recurring}
            onChange={(event) => setRecurring(event.target.checked)}
          />
          Habilitar recorrência AbacatePay
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            className="size-5 accent-teal-800"
            checked={card}
            disabled={!recurring}
            onChange={(event) => setCard(event.target.checked)}
          />
          Cartão recorrente
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            className="size-5 accent-teal-800"
            checked={settings.pix_automatico_disponivel}
            disabled
          />
          Pix Automático
        </label>
        <p className="-mt-3 text-sm text-slate-600">
          {settings.pix_automatico_disponivel
            ? 'Disponibilidade confirmada pelo provedor.'
            : 'Indisponível. A adesão por Pix Automático depende de liberação confirmada pelo provedor.'}
        </p>
      </fieldset>
      {settings.webhook_path && (
        <div className="space-y-2 text-sm">
          <p className="font-semibold">Caminho para notificações</p>
          <code className="block rounded-lg bg-slate-50 p-3 text-slate-700 [overflow-wrap:anywhere]">
            {settings.webhook_path}
          </code>
          <p className="text-slate-600">
            Use este caminho com o domínio público da plataforma no cadastro do webhook.
          </p>
        </div>
      )}
      <p className="text-sm text-slate-600">
        Desativar impede novas cobranças. Recorrências já autorizadas precisam ser canceladas
        individualmente.
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
        {saving ? 'Salvando...' : 'Salvar AbacatePay'}
      </Button>
    </form>
  );
}
export function AbacatePaySettings({ context }: { context: FinanceContext }) {
  const query = useFinanceQuery(context, ['abacatepay-settings'], (signal) =>
    paymentApi.abacateSettings(context, signal),
  );
  if (query.isPending) return <LoadingState rows={3} />;
  if (query.isError)
    return (
      <ErrorState
        message={financeErrorMessage(
          query.error,
          'Não foi possível carregar a configuração AbacatePay.',
        )}
        retry={() => query.refetch()}
      />
    );
  return <SettingsForm key={context.organizacaoId} context={context} settings={query.data} />;
}
