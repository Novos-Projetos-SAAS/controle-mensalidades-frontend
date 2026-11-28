'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ErrorState, LoadingState, EmptyState } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import {
  activityKey,
  getActivity,
  getTemplates,
  reminderTypes,
  statuses,
  type WhatsappContext,
  type ActivityStatus,
  type Message,
  type Task,
} from './whatsapp-api';
import { activityType, displayDate, displayState, queryError } from './whatsapp-display';

export function WhatsappTemplates({ context }: { context: WhatsappContext }) {
  const templates = useQuery({
    queryKey: ['whatsapp', context.organizacaoId, context.areaId, 'modelos'],
    queryFn: ({ signal }) => getTemplates(context, signal),
  });
  if (templates.isPending) return <LoadingState rows={3} />;
  if (templates.isError)
    return <ErrorState message={queryError(templates.error)} retry={() => templates.refetch()} />;
  if (!templates.data.length)
    return (
      <EmptyState
        title="Nenhum modelo disponível"
        description="Os modelos internos aparecerão aqui quando estiverem disponíveis na API."
      />
    );

  return (
    <section aria-label="Modelos de mensagem" className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {templates.data.map((template) => (
        <article key={template.chave} className="surface min-w-0 space-y-3 p-4 sm:p-5">
          <p className="text-sm font-semibold text-teal-800">{reminderTypes[template.tipo]}</p>
          <h2 className="text-lg font-semibold">{template.nome}</h2>
          <p className="rounded-xl bg-slate-50 p-3 text-sm leading-relaxed break-words whitespace-pre-wrap">
            {template.conteudo}
          </p>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="font-medium">Variáveis</dt>
              <dd className="break-words text-slate-600">{template.variaveis.join(', ') || '—'}</dd>
            </div>
            <div>
              <dt className="font-medium">Situação</dt>
              <dd className="text-slate-600">{template.ativo ? 'Ativo' : 'Inativo'}</dd>
            </div>
            <div>
              <dt className="font-medium">Aprovação Meta</dt>
              <dd className="text-slate-600">
                {template.aprovadoMeta
                  ? 'Aprovado'
                  : template.situacaoMeta === 'NAO_SUBMETIDO'
                    ? 'Ainda não submetido à Meta'
                    : 'Não aprovado'}
              </dd>
            </div>
          </dl>
        </article>
      ))}
    </section>
  );
}

export function ReminderCalendar() {
  return (
    <section className="surface space-y-4 p-4 sm:p-6">
      <h2 className="text-xl font-semibold">Calendário de lembretes</h2>
      <dl className="grid gap-2 md:grid-cols-3">
        {Object.entries(reminderTypes).map(([day, label]) => (
          <div key={day} className="rounded-xl bg-teal-50 p-3 text-sm">
            <dt className="font-semibold text-teal-900">{day}</dt>
            <dd className="mt-1">{label}</dd>
          </div>
        ))}
      </dl>
      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
        <li>Mensalidades quitadas ou canceladas não recebem novos lembretes.</li>
        <li>Clientes sem consentimento não recebem mensagens.</li>
        <li>Cobranças ficam suspensas quando o estado financeiro é incerto.</li>
      </ul>
      <p className="text-sm text-slate-600">
        Os envios dependem da configuração do provedor e do agendador. A Baileys está restrita à demonstração.
      </p>
    </section>
  );
}

function useWhatsappActivity(
  context: WhatsappContext,
  kind: 'tarefas' | 'mensagens',
  page: number,
  status: ActivityStatus | '',
) {
  return useQuery({
    queryKey: [...activityKey(context, kind), page, status],
    queryFn: ({ signal }) => getActivity(context, kind, page, status, signal),
  });
}

export function WhatsappActivity({
  context,
  kind,
}: {
  context: WhatsappContext;
  kind: 'tarefas' | 'mensagens';
}) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ActivityStatus | ''>('');
  const [type, setType] = useState('');
  const entries = useWhatsappActivity(context, kind, page, status);
  const tasks = kind === 'tarefas';
  const items = entries.data?.items ?? [];
  const types = [...new Set(items.map(activityType))];
  const selectedType = types.includes(type) ? type : '';
  const visible = selectedType
    ? items.filter((item) => activityType(item) === selectedType)
    : items;
  const pagination = entries.data?.pagination;
  const title = tasks ? 'Lembretes programados' : 'Histórico de mensagens';

  return (
    <section aria-label={title} className="space-y-4">
      <div className="surface space-y-3 p-4 sm:p-5">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-slate-600">
          {tasks
            ? 'A API identifica clientes e mensalidades por referência.'
            : 'Enviada indica aceitação do envio. Entregue indica confirmação de entrega. A API do histórico não fornece os números nem a data programada.'}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="field-label">Situação</span>
            <select
              className="select-field"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as ActivityStatus | '');
                setType('');
                setPage(1);
              }}
            >
              <option value="">Todas as situações</option>
              {Object.entries(statuses).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {types.length > 0 && (
            <label>
              <span className="field-label">Tipo nesta página</span>
              <select
                className="select-field"
                value={selectedType}
                onChange={(event) => setType(event.target.value)}
              >
                <option value="">Todos os tipos</option>
                {types.map((label) => (
                  <option key={label}>{label}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>
      {entries.isPending ? (
        <LoadingState rows={3} />
      ) : entries.isError ? (
        <ErrorState message={queryError(entries.error)} retry={() => entries.refetch()} />
      ) : visible.length ? (
        <ul aria-label={title} className="surface divide-y divide-slate-200">
          {visible.map((item) => (
            <ActivityRow key={item.id} item={item} />
          ))}
        </ul>
      ) : (
        <EmptyState
          title={tasks ? 'Nenhum lembrete encontrado' : 'Nenhuma mensagem encontrada'}
          description={
            status || selectedType
              ? 'Ajuste os filtros para ampliar a consulta.'
              : 'Ainda não há registros para esta área.'
          }
        />
      )}
      {pagination && (page > 1 || pagination.pages > 1) && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => {
              setType('');
              setPage(page - 1);
            }}
          >
            Anterior
          </Button>
          <span>
            Página {pagination.page} de {Math.max(pagination.page, pagination.pages)}
          </span>
          <Button
            variant="outline"
            disabled={page >= pagination.pages}
            onClick={() => {
              setType('');
              setPage(page + 1);
            }}
          >
            Próxima
          </Button>
        </div>
      )}
    </section>
  );
}

function ActivityRow({ item }: { item: Task | Message }) {
  const task = 'executar_em' in item ? item : null;
  const message = 'enviado_em' in item ? item : null;
  const details = [
    ['Cliente (referência)', item.cliente_id],
    ['Mensalidade (referência)', item.mensalidade_id],
    ...(task ? [['Programado para', displayDate(task.executar_em)]] : []),
    ...(message
      ? [
          ['Registrada em', displayDate(message.criado_em)],
          ['Data do envio', displayDate(message.enviado_em)],
          ['Data da entrega', displayDate(message.entregue_em)],
        ]
      : []),
  ];
  const issues = [
    ...new Set(
      [task?.motivo_cancelamento, task?.codigo_resultado, message?.erro_codigo].filter(Boolean),
    ),
  ];
  return (
    <li className="space-y-3 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold break-words">{activityType(item)}</h3>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium">
          {statuses[item.status] ?? item.status}
        </span>
        {message?.modo_processamento === 'BAILEYS' && (
          <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-900">
            Baileys — demonstração
          </span>
        )}
        {message?.modo_processamento === 'SIMULADO' && (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-950">
            Simulação
          </span>
        )}
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
        {details.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-slate-600">{label}</dt>
            <dd className="break-all">{value ?? '—'}</dd>
          </div>
        ))}
      </dl>
      {issues.map(
        (reason) =>
          reason && (
            <p key={reason} className="text-sm break-words text-amber-900">
              {displayState(reason)}
            </p>
          ),
      )}
    </li>
  );
}
