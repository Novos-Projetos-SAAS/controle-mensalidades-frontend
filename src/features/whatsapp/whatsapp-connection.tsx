'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorState, LoadingState } from '@/components/query-state';
import {
  configurationKey,
  getConfigurations,
  saveConfiguration,
  type Configuration,
} from './whatsapp-api';
import { displayDate, displayState, queryError } from './whatsapp-display';
import { WhatsappOnboarding } from './whatsapp-onboarding';

const fields = [
  { name: 'nomeNegocio', label: 'Nome do negócio', max: 150 },
  { name: 'numeroExibido', label: 'Número remetente', max: 30 },
  { name: 'whatsappBusinessAccountId', label: 'ID da conta WhatsApp Business (WABA)', max: 100 },
  { name: 'phoneNumberId', label: 'ID do número de telefone', max: 100 },
] as const;
const required = (max: number) =>
  z.string().trim().min(1, 'Preencha este campo.').max(max, `Use até ${max} caracteres.`);
const schema = z.object({
  nomeNegocio: required(150),
  numeroExibido: required(30),
  whatsappBusinessAccountId: required(100),
  phoneNumberId: required(100),
});

type ScopeProps = {
  orgId: string;
  areaId?: string;
  areaName?: string;
};

export function WhatsappConnection(props: ScopeProps) {
  const { orgId, areaId } = props;
  const configurations = useQuery({
    queryKey: configurationKey(orgId),
    queryFn: ({ signal }) => getConfigurations(orgId, signal),
  });
  if (configurations.isPending) return <LoadingState rows={2} />;
  if (configurations.isError)
    return (
      <ErrorState
        message={queryError(configurations.error)}
        retry={() => configurations.refetch()}
      />
    );
  return (
    <ConnectionDetails
      key={areaId ?? 'organization'}
      {...props}
      configurations={configurations.data}
    />
  );
}

function ConnectionDetails({
  orgId,
  areaId,
  areaName,
  configurations,
}: ScopeProps & {
  configurations: Configuration[];
}) {
  const queryClient = useQueryClient();
  const key = configurationKey(orgId);
  const [scope, setScope] = useState(areaId ? 'area' : 'organization');
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState('');
  const [onboardingActive, setOnboardingActive] = useState(false);
  const areaScope = scope === 'area';
  const target = areaScope ? (areaId ?? null) : null;
  const scoped = configurations.filter((config) => config.organizacao_id === orgId);
  const exact = scoped.find((config) => config.area_negocio_id === target);
  const fallback = areaScope ? scoped.find((config) => config.area_negocio_id === null) : undefined;
  const current = exact ?? fallback;
  const facts = [
    ['Nome do negócio', current?.nome_negocio],
    ['Número remetente', current?.numero_exibido],
    ['ID da conta WhatsApp Business', current?.whatsapp_business_account_id],
    ['Autorização', current ? displayState(current.situacao_autorizacao) : null],
    ['Última validação', displayDate(current?.ultima_validacao_em)],
  ];

  return (
    <section className="surface space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Conexão</h2>
          <p className="mt-1 text-sm text-slate-600">
            Conecte e acompanhe a autorização, o registro e a preparação do número.
          </p>
        </div>
        <span className="rounded-full bg-teal-50 px-3 py-1 text-sm font-medium text-teal-900">
          {current ? displayState(current.situacao_conexao) : 'Não configurado'}
        </span>
      </div>
      <WhatsappOnboarding
        orgId={orgId}
        areaId={areaId}
        enabled={areaScope}
        hasAuthorizedIntegration={exact?.situacao_autorizacao === 'AUTORIZADO'}
        onAttemptingChange={setOnboardingActive}
      />
      {areaId && (
        <label className="block max-w-sm">
          <span className="field-label">Escopo da configuração</span>
          <select
            className="select-field"
            value={scope}
            disabled={editing || onboardingActive}
            onChange={(event) => {
              setScope(event.target.value);
              setNotice('');
            }}
          >
            <option value="area">Área: {areaName}</option>
            <option value="organization">Padrão da organização</option>
          </select>
        </label>
      )}
      {current && !exact && (
        <p className="text-sm text-slate-600">
          Esta área não tem remetente próprio. Dados do padrão da organização:
        </p>
      )}
      <dl className="grid gap-4 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
        {facts.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-slate-600">{label}</dt>
            <dd className="mt-1 font-medium break-words">{value || '—'}</dd>
          </div>
        ))}
      </dl>
      {current?.motivo_indisponibilidade && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm break-words text-amber-950">
          {displayState(current.motivo_indisponibilidade)}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-teal-900">
          {notice}
        </p>
      )}
      {editing ? (
        <ConfigurationForm
          current={exact}
          orgId={orgId}
          target={target}
          cancel={() => setEditing(false)}
          saved={(config) => {
            setEditing(false);
            setNotice(
              'Dados do remetente salvos. A autorização oficial da Meta continua pendente.',
            );
            queryClient.setQueryData<Configuration[]>(
              key,
              (previous) =>
                previous && [...previous.filter((item) => item.area_negocio_id !== target), config],
            );
            void queryClient.invalidateQueries({ queryKey: key, exact: true });
          }}
        />
      ) : (
        <Button
          onClick={() => {
            setNotice('');
            setEditing(true);
          }}
        >
          {exact
            ? 'Editar remetente'
            : areaScope
              ? 'Cadastrar remetente da área'
              : 'Cadastrar remetente padrão'}
        </Button>
      )}
    </section>
  );
}

function ConfigurationForm({
  current,
  orgId,
  target,
  cancel,
  saved,
}: {
  current?: Configuration;
  orgId: string;
  target: string | null;
  cancel: () => void;
  saved: (configuration: Configuration) => void;
}) {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      nomeNegocio: current?.nome_negocio ?? '',
      numeroExibido: current?.numero_exibido ?? '',
      whatsappBusinessAccountId: current?.whatsapp_business_account_id ?? '',
      phoneNumberId: current?.phone_number_id ?? '',
    },
  });
  const { errors, isSubmitting, isDirty } = form.formState;
  const submit = form.handleSubmit(async (values) => {
    form.clearErrors('root');
    try {
      saved(await saveConfiguration(orgId, target, values));
    } catch (error) {
      const message =
        error instanceof Error ? queryError(error) : 'Não foi possível salvar o remetente.';
      form.setError('root', { message });
    }
  });
  return (
    <form onSubmit={submit} noValidate className="space-y-4 border-t border-slate-200 pt-5">
      <fieldset disabled={isSubmitting} className="grid gap-4 sm:grid-cols-2">
        {fields.map(({ name, label }) => (
          <div key={name}>
            <label htmlFor={name} className="field-label">
              {label}
            </label>
            <Input
              id={name}
              type={name === 'numeroExibido' ? 'tel' : 'text'}
              {...form.register(name)}
              aria-invalid={!!errors[name]}
              aria-describedby={errors[name] ? `whatsapp-${name}-error` : undefined}
            />
            {errors[name] && (
              <p id={`whatsapp-${name}-error`} role="alert" className="mt-1 text-xs text-red-700">
                {errors[name].message}
              </p>
            )}
          </div>
        ))}
      </fieldset>
      {current && (
        <p className="text-sm text-slate-600">
          Ao salvar, esta configuração ficará inativa e voltará a aguardar autorização da Meta.
        </p>
      )}
      {errors.root && (
        <p role="alert" className="text-sm text-red-700">
          {errors.root.message}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isSubmitting || (!!current && !isDirty)}>
          {isSubmitting ? 'Salvando...' : 'Salvar remetente'}
        </Button>
        <Button type="button" variant="outline" disabled={isSubmitting} onClick={cancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
