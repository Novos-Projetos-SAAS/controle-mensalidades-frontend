'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CalendarDays, FileText, Plus } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { EmptyState, ErrorState, LoadingState } from '@/components/query-state';
import { useSession } from '@/features/auth/session';
import { clientes } from '@/lib/api';
import { formatDate } from '@/lib/format';
import {
  financeApi,
  financeKey,
  useFinanceQuery,
  type FinanceContext,
  type Filtros,
  type Pagina,
} from './finance-api';
import { currentPeriod, money } from './finance-utils';
import { GenerateMonthlyForm, PlanForm, SubscriptionForm } from './finance-forms';
import { ReceiveDialog } from './receive-dialog';

type Tab = 'planos' | 'assinaturas' | 'mensalidades';
const statusClass: Record<string, string> = {
  ATIVA: 'bg-emerald-50 text-emerald-800',
  PAGA: 'bg-emerald-50 text-emerald-800',
  PENDENTE: 'bg-amber-50 text-amber-900',
  PARCIAL: 'bg-blue-50 text-blue-800',
  VENCIDA: 'bg-red-50 text-red-800',
  CANCELADA: 'bg-slate-100 text-slate-700',
  ENCERRADA: 'bg-slate-100 text-slate-700',
};
const statusLabel: Record<string, string> = {
  ATIVA: 'Ativa',
  PAGA: 'Paga',
  PENDENTE: 'Pendente',
  PARCIAL: 'Parcial',
  VENCIDA: 'Vencida',
  CANCELADA: 'Cancelada',
  ENCERRADA: 'Encerrada',
};
const pill = (status: string) => (
  <span
    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass[status] || 'bg-slate-100 text-slate-700'}`}
  >
    {statusLabel[status] || status}
  </span>
);

function Pager({
  pagination,
  onPage,
}: {
  pagination: Pagina<unknown>['pagination'];
  onPage: (page: number) => void;
}) {
  if (pagination.pages <= 1) return null;
  return (
    <nav aria-label="Paginação" className="mt-5 flex items-center justify-between gap-3 text-sm">
      <Button
        variant="outline"
        disabled={pagination.page <= 1}
        onClick={() => onPage(pagination.page - 1)}
      >
        Anterior
      </Button>
      <span>
        Página {pagination.page} de {pagination.pages}
      </span>
      <Button
        variant="outline"
        disabled={pagination.page >= pagination.pages}
        onClick={() => onPage(pagination.page + 1)}
      >
        Próxima
      </Button>
    </nav>
  );
}

function FinanceContent({ context }: { context: FinanceContext }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('mensalidades');
  const [period] = useState(currentPeriod);
  const [planSearch, setPlanSearch] = useState('');
  const [subscriptionSearch, setSubscriptionSearch] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [subscriptionFilters, setSubscriptionFilters] = useState<Filtros>({ page: 1 });
  const [invoiceFilters, setInvoiceFilters] = useState<Filtros>({ page: 1 });
  const [form, setForm] = useState<'plan' | 'subscription' | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [generateId, setGenerateId] = useState<string | null>(null);
  const [receiveId, setReceiveId] = useState<string | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: financeKey(context) });

  const summary = useFinanceQuery(context, ['resumo', period.inicio, period.fim], (signal) =>
    financeApi.resumo(context, period.inicio, period.fim, signal),
  );
  const plans = useFinanceQuery(
    context,
    ['planos'],
    (signal) => financeApi.planos(context, signal),
    tab === 'planos' || tab === 'assinaturas',
  );
  const subscriptions = useFinanceQuery(
    context,
    ['assinaturas', subscriptionFilters],
    (signal) => financeApi.assinaturas(context, subscriptionFilters, signal),
    tab === 'assinaturas',
  );
  const invoices = useFinanceQuery(
    context,
    ['mensalidades', invoiceFilters],
    (signal) => financeApi.mensalidades(context, invoiceFilters, signal),
    tab === 'mensalidades',
  );
  const customerOptions = useQuery({
    queryKey: ['clientes', context.organizacaoId, context.areaId, ''],
    queryFn: () => clientes(context.organizacaoId, context.areaId),
    enabled: tab !== 'planos',
  });
  const planDetail = useFinanceQuery(
    context,
    ['plano', planId],
    (signal) => financeApi.plano(context, planId!, signal),
    !!planId,
  );
  const subscriptionDetail = useFinanceQuery(
    context,
    ['assinatura', subscriptionId],
    (signal) => financeApi.assinatura(context, subscriptionId!, signal),
    !!subscriptionId,
  );
  const invoiceDetail = useFinanceQuery(
    context,
    ['mensalidade', invoiceId],
    (signal) => financeApi.mensalidade(context, invoiceId!, signal),
    !!invoiceId,
  );
  const changeSubscriptionFilter = (patch: Partial<Filtros>) =>
    setSubscriptionFilters((prev) => ({ ...prev, ...patch, page: 1 }));
  const changeInvoiceFilter = (patch: Partial<Filtros>) =>
    setInvoiceFilters((prev) => ({ ...prev, ...patch, page: 1 }));
  const visiblePlans =
    plans.data?.filter(
      (p) =>
        p.nome.toLocaleLowerCase('pt-BR').includes(planSearch.toLocaleLowerCase('pt-BR')) ||
        (p.descricao || '')
          .toLocaleLowerCase('pt-BR')
          .includes(planSearch.toLocaleLowerCase('pt-BR')),
    ) || [];
  const visibleSubscriptions =
    subscriptions.data?.items.filter((s) =>
      `${s.cliente_nome} ${s.plano_nome}`
        .toLocaleLowerCase('pt-BR')
        .includes(subscriptionSearch.toLocaleLowerCase('pt-BR')),
    ) || [];
  const visibleInvoices =
    invoices.data?.items.filter((m) =>
      m.cliente_nome.toLocaleLowerCase('pt-BR').includes(invoiceSearch.toLocaleLowerCase('pt-BR')),
    ) || [];

  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-2 text-xs font-bold tracking-[.17em] text-teal-700 uppercase">
            Controle da receita
          </p>
          <h1 className="display text-4xl text-slate-900 sm:text-5xl">Financeiro</h1>
          <p className="mt-2 text-sm text-slate-600">
            Planos, assinaturas e recebimentos da área selecionada.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-teal-200 bg-white px-4 py-2 text-xs font-semibold text-teal-800">
          <CalendarDays size={15} aria-hidden="true" /> {formatDate(period.inicio)} a{' '}
          {formatDate(period.fim)}
        </div>
      </div>
      <section aria-label="Resumo financeiro" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {summary.isPending ? (
          <div className="sm:col-span-2 xl:col-span-3">
            <LoadingState rows={2} />
          </div>
        ) : summary.isError ? (
          <div className="sm:col-span-2 xl:col-span-3">
            <ErrorState message={summary.error.message} retry={() => summary.refetch()} />
          </div>
        ) : (
          summary.data && (
            <>
              <div className="surface surface-dark min-w-0 p-5">
                <p className="text-sm text-teal-100">Em aberto</p>
                <strong className="display mt-3 block break-words text-3xl sm:text-4xl">
                  {money(summary.data.valor_em_aberto)}
                </strong>
                <p className="mt-3 text-xs text-teal-100">
                  {summary.data.mensalidades_em_aberto} mensalidade(s), conforme a API
                </p>
              </div>
              <div className="surface min-w-0 p-5">
                <p className="text-sm text-slate-600">Vencidas</p>
                <strong className="display mt-3 block break-words text-3xl text-red-800 sm:text-4xl">
                  {money(summary.data.valor_vencido)}
                </strong>
                <p className="mt-3 text-xs text-slate-500">
                  {summary.data.mensalidades_vencidas} mensalidade(s)
                </p>
              </div>
              <div className="surface min-w-0 p-5">
                <p className="text-sm text-slate-600">Recebido no período</p>
                <strong className="display mt-3 block break-words text-3xl text-teal-800 sm:text-4xl">
                  {money(summary.data.recebido_periodo)}
                </strong>
                <p className="mt-3 text-xs text-slate-500">Valor confirmado no servidor</p>
              </div>
            </>
          )
        )}
      </section>
      <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Seções financeiras">
          {(['mensalidades', 'assinaturas', 'planos'] as Tab[]).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`min-h-11 rounded-xl px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-teal-700 ${tab === value ? 'bg-teal-800 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}
            >
              {value === 'mensalidades'
                ? 'Mensalidades'
                : value === 'assinaturas'
                  ? 'Assinaturas'
                  : 'Planos'}
            </button>
          ))}
        </div>
        {tab === 'planos' ? (
          <Button onClick={() => setForm('plan')}>
            <Plus size={17} aria-hidden="true" /> Novo plano
          </Button>
        ) : tab === 'assinaturas' ? (
          <Button onClick={() => setForm('subscription')} disabled={!plans.data?.length}>
            <Plus size={17} aria-hidden="true" /> Nova assinatura
          </Button>
        ) : null}
      </div>

      {tab === 'planos' && (
        <section role="tabpanel" className="mt-5">
          <div className="surface mb-4 p-4">
            <label className="field-label" htmlFor="plan-search">
              Buscar planos
            </label>
            <Input
              id="plan-search"
              value={planSearch}
              onChange={(e) => setPlanSearch(e.target.value)}
              placeholder="Nome ou descrição"
            />
          </div>
          {plans.isPending ? (
            <LoadingState />
          ) : plans.isError ? (
            <ErrorState message={plans.error.message} retry={() => plans.refetch()} />
          ) : !visiblePlans.length ? (
            <EmptyState
              title="Nenhum plano encontrado"
              description={
                planSearch ? 'Ajuste a busca.' : 'Crie o primeiro plano mensal desta área.'
              }
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visiblePlans.map((plan) => (
                <article key={plan.id} className="surface flex min-w-0 flex-col p-5">
                  <div className="mb-4 flex items-start justify-between gap-2">
                    <FileText className="text-teal-700" aria-hidden="true" />
                    {pill('ATIVA')}
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900">{plan.nome}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                    {plan.descricao || 'Sem descrição'}
                  </p>
                  <strong className="display mt-6 block text-3xl">{money(plan.valor_base)}</strong>
                  <p className="mt-1 text-xs text-slate-500">
                    {plan.periodicidade} ·{' '}
                    {plan.area_negocio_id ? 'Nesta área' : 'Toda a organização'}
                  </p>
                  <Button
                    variant="outline"
                    className="mt-5 w-full"
                    onClick={() => setPlanId(plan.id)}
                  >
                    Ver detalhes <ArrowRight size={16} aria-hidden="true" />
                  </Button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'assinaturas' && (
        <section role="tabpanel" className="mt-5">
          <div className="surface mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <label>
              <span className="field-label">Situação</span>
              <select
                className="select-field"
                value={subscriptionFilters.status || ''}
                onChange={(e) => changeSubscriptionFilter({ status: e.target.value || undefined })}
              >
                <option value="">Todas</option>
                <option value="ATIVA">Ativa</option>
                <option value="CANCELADA">Cancelada</option>
                <option value="ENCERRADA">Encerrada</option>
              </select>
            </label>
            <label>
              <span className="field-label">Cliente</span>
              <select
                className="select-field"
                value={subscriptionFilters.clienteId || ''}
                onChange={(e) =>
                  changeSubscriptionFilter({ clienteId: e.target.value || undefined })
                }
                disabled={customerOptions.isPending}
              >
                <option value="">Todos</option>
                {customerOptions.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="field-label">Buscar nesta página</span>
              <Input
                value={subscriptionSearch}
                onChange={(e) => setSubscriptionSearch(e.target.value)}
                placeholder="Cliente ou plano"
              />
            </label>
          </div>
          {subscriptions.isPending ? (
            <LoadingState />
          ) : subscriptions.isError ? (
            <ErrorState
              message={subscriptions.error.message}
              retry={() => subscriptions.refetch()}
            />
          ) : !visibleSubscriptions.length ? (
            <EmptyState
              title="Nenhuma assinatura encontrada"
              description={
                subscriptionSearch
                  ? 'A busca abrange apenas esta página. Ajuste os filtros ou avance.'
                  : 'Associe um cliente a um plano para começar.'
              }
            />
          ) : (
            <div className="space-y-3">
              {visibleSubscriptions.map((item) => (
                <article
                  key={item.id}
                  className="surface flex min-w-0 flex-col gap-3 p-5 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{item.cliente_nome}</h2>
                      {pill(item.status)}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {item.plano_nome} · vence dia {item.dia_vencimento}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Início {formatDate(item.inicio_em)}
                      {item.fim_em ? ` · fim ${formatDate(item.fim_em)}` : ''}
                    </p>
                  </div>
                  <strong className="text-lg">{money(item.valor_contratado)}</strong>
                  <Button variant="outline" onClick={() => setSubscriptionId(item.id)}>
                    Detalhes
                  </Button>
                </article>
              ))}
            </div>
          )}
          {subscriptions.data && (
            <Pager
              pagination={subscriptions.data.pagination}
              onPage={(page) => setSubscriptionFilters((prev) => ({ ...prev, page }))}
            />
          )}
        </section>
      )}

      {tab === 'mensalidades' && (
        <section role="tabpanel" className="mt-5">
          <div className="surface mb-4 grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
            <label>
              <span className="field-label">Situação</span>
              <select
                className="select-field"
                value={invoiceFilters.status || ''}
                onChange={(e) => changeInvoiceFilter({ status: e.target.value || undefined })}
              >
                <option value="">Todas</option>
                {(['PENDENTE', 'PARCIAL', 'VENCIDA', 'PAGA', 'CANCELADA'] as const).map((s) => (
                  <option key={s} value={s}>
                    {statusLabel[s]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="field-label">Cliente</span>
              <select
                className="select-field"
                value={invoiceFilters.clienteId || ''}
                onChange={(e) => changeInvoiceFilter({ clienteId: e.target.value || undefined })}
                disabled={customerOptions.isPending}
              >
                <option value="">Todos</option>
                {customerOptions.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="field-label">Competência</span>
              <Input
                type="month"
                value={invoiceFilters.competencia || ''}
                onChange={(e) => changeInvoiceFilter({ competencia: e.target.value || undefined })}
              />
            </label>
            <label>
              <span className="field-label">Buscar nesta página</span>
              <Input
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
                placeholder="Nome do cliente"
              />
            </label>
            <label>
              <span className="field-label">Vencimento de</span>
              <Input
                type="date"
                value={invoiceFilters.vencimentoDe || ''}
                onChange={(e) => changeInvoiceFilter({ vencimentoDe: e.target.value || undefined })}
              />
            </label>
            <label>
              <span className="field-label">Vencimento até</span>
              <Input
                type="date"
                min={invoiceFilters.vencimentoDe}
                value={invoiceFilters.vencimentoAte || ''}
                onChange={(e) =>
                  changeInvoiceFilter({ vencimentoAte: e.target.value || undefined })
                }
              />
            </label>
          </div>
          {invoices.isPending ? (
            <LoadingState />
          ) : invoices.isError ? (
            <ErrorState message={invoices.error.message} retry={() => invoices.refetch()} />
          ) : !visibleInvoices.length ? (
            <EmptyState
              title="Nenhuma mensalidade encontrada"
              description={
                invoiceSearch
                  ? 'A busca abrange apenas esta página. Ajuste os filtros ou avance.'
                  : 'Gere uma mensalidade a partir de uma assinatura ativa.'
              }
            />
          ) : (
            <div className="space-y-3">
              {visibleInvoices.map((item) => (
                <article
                  key={item.id}
                  className="surface grid min-w-0 gap-3 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{item.cliente_nome}</h2>
                      {pill(item.status)}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      Competência {item.competencia.slice(0, 7)} · vencimento{' '}
                      {formatDate(item.vencimento_em)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Pago {money(item.valor_pago)} · saldo {money(item.saldo)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                    <strong className="text-lg">{money(item.valor_final)}</strong>
                    <Button variant="outline" onClick={() => setInvoiceId(item.id)}>
                      Detalhes
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
          {invoices.data && (
            <Pager
              pagination={invoices.data.pagination}
              onPage={(page) => setInvoiceFilters((prev) => ({ ...prev, page }))}
            />
          )}
        </section>
      )}

      {form === 'plan' && (
        <PlanForm context={context} onClose={() => setForm(null)} onSaved={refresh} />
      )}
      {form === 'subscription' && (
        <SubscriptionForm
          context={context}
          plans={plans.data || []}
          onClose={() => setForm(null)}
          onSaved={refresh}
        />
      )}
      {generateId && (
        <GenerateMonthlyForm
          context={context}
          subscriptionId={generateId}
          onClose={() => setGenerateId(null)}
          onSaved={refresh}
        />
      )}
      {receiveId && (
        <ReceiveDialog
          context={context}
          id={receiveId}
          onClose={() => setReceiveId(null)}
          onSaved={refresh}
        />
      )}

      <Dialog open={!!planId} onOpenChange={(open) => !open && setPlanId(null)}>
        <DialogContent>
          <DialogTitle className="display pr-8 text-3xl">Detalhes do plano</DialogTitle>
          <DialogDescription className="sr-only">
            Informações do plano selecionado.
          </DialogDescription>
          {planDetail.isPending ? (
            <LoadingState rows={2} />
          ) : planDetail.isError ? (
            <ErrorState message={planDetail.error.message} retry={() => planDetail.refetch()} />
          ) : (
            planDetail.data && (
              <dl className="mt-5 space-y-3 text-sm">
                <div>
                  <dt className="text-slate-500">Nome</dt>
                  <dd className="font-semibold">{planDetail.data.nome}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Descrição</dt>
                  <dd>{planDetail.data.descricao || '—'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Valor</dt>
                  <dd className="font-semibold">{money(planDetail.data.valor_base)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Periodicidade</dt>
                  <dd>{planDetail.data.periodicidade}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Situação</dt>
                  <dd>{planDetail.data.ativo ? 'Ativo' : 'Inativo'}</dd>
                </div>
              </dl>
            )
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!subscriptionId} onOpenChange={(open) => !open && setSubscriptionId(null)}>
        <DialogContent>
          <DialogTitle className="display pr-8 text-3xl">Detalhes da assinatura</DialogTitle>
          <DialogDescription className="sr-only">
            Informações da assinatura selecionada.
          </DialogDescription>
          {subscriptionDetail.isPending ? (
            <LoadingState rows={2} />
          ) : subscriptionDetail.isError ? (
            <ErrorState
              message={subscriptionDetail.error.message}
              retry={() => subscriptionDetail.refetch()}
            />
          ) : (
            subscriptionDetail.data && (
              <>
                <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                  <div className="col-span-2">
                    <dt className="text-slate-500">Cliente</dt>
                    <dd className="font-semibold">{subscriptionDetail.data.cliente_nome}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Plano</dt>
                    <dd>{subscriptionDetail.data.plano_nome}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Situação</dt>
                    <dd>{pill(subscriptionDetail.data.status)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Valor contratado</dt>
                    <dd>{money(subscriptionDetail.data.valor_contratado)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Desconto recorrente</dt>
                    <dd>{money(subscriptionDetail.data.desconto_recorrente)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Vencimento</dt>
                    <dd>Dia {subscriptionDetail.data.dia_vencimento}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Início</dt>
                    <dd>{formatDate(subscriptionDetail.data.inicio_em)}</dd>
                  </div>
                  {subscriptionDetail.data.fim_em && (
                    <div>
                      <dt className="text-slate-500">Fim</dt>
                      <dd>{formatDate(subscriptionDetail.data.fim_em)}</dd>
                    </div>
                  )}
                </dl>
                {subscriptionDetail.data.status === 'ATIVA' && (
                  <Button
                    className="mt-6 w-full"
                    onClick={() => {
                      setGenerateId(subscriptionDetail.data!.id);
                      setSubscriptionId(null);
                    }}
                  >
                    Gerar mensalidade
                  </Button>
                )}
              </>
            )
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!invoiceId} onOpenChange={(open) => !open && setInvoiceId(null)}>
        <DialogContent>
          <DialogTitle className="display pr-8 text-3xl">Detalhes da mensalidade</DialogTitle>
          <DialogDescription className="sr-only">
            Situação e histórico do recebimento.
          </DialogDescription>
          {invoiceDetail.isPending ? (
            <LoadingState rows={2} />
          ) : invoiceDetail.isError ? (
            <ErrorState
              message={invoiceDetail.error.message}
              retry={() => invoiceDetail.refetch()}
            />
          ) : (
            invoiceDetail.data && (
              <>
                <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                  <div className="col-span-2">
                    <dt className="text-slate-500">Cliente</dt>
                    <dd className="font-semibold">{invoiceDetail.data.cliente_nome}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Competência</dt>
                    <dd>{invoiceDetail.data.competencia.slice(0, 7)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Vencimento</dt>
                    <dd>{formatDate(invoiceDetail.data.vencimento_em)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Situação</dt>
                    <dd>{pill(invoiceDetail.data.status)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Valor final</dt>
                    <dd>{money(invoiceDetail.data.valor_final)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Valor pago</dt>
                    <dd>{money(invoiceDetail.data.valor_pago)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Saldo</dt>
                    <dd className="font-semibold">{money(invoiceDetail.data.saldo)}</dd>
                  </div>
                </dl>
                <div className="mt-6 border-t border-slate-200 pt-4">
                  <h3 className="font-semibold">Recebimentos registrados</h3>
                  {invoiceDetail.data.pagamentos?.length ? (
                    <ul className="mt-3 space-y-2">
                      {invoiceDetail.data.pagamentos.map((payment) => (
                        <li
                          key={payment.id}
                          className="flex flex-wrap justify-between gap-2 rounded-xl bg-slate-50 p-3 text-sm"
                        >
                          <span>
                            {formatDate(payment.pago_em)} · {payment.forma_pagamento}
                          </span>
                          <strong>{money(payment.valor)}</strong>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">Nenhum recebimento registrado.</p>
                  )}
                </div>
                {!['PAGA', 'CANCELADA'].includes(invoiceDetail.data.status) && (
                  <Button
                    className="mt-6 w-full"
                    onClick={() => {
                      setReceiveId(invoiceDetail.data!.id);
                      setInvoiceId(null);
                    }}
                  >
                    Registrar recebimento
                  </Button>
                )}
              </>
            )
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function FinancePage() {
  const { organization, area } = useSession();
  const context = { organizacaoId: organization?.id || '', areaId: area?.id || '' };
  return (
    <AppShell>
      {organization?.perfil !== 'ADMINISTRADOR' ? (
        <EmptyState
          title="Acesso restrito"
          description="O financeiro está disponível para administradores da organização."
        />
      ) : !area ? (
        <EmptyState
          title="Selecione uma área"
          description="Escolha uma área de negócio para consultar o financeiro."
        />
      ) : (
        <FinanceContent key={`${context.organizacaoId}:${context.areaId}`} context={context} />
      )}
    </AppShell>
  );
}
