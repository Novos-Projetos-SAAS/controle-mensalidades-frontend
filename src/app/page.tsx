'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, BriefcaseBusiness, Building2, Layers3, UsersRound } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { ErrorState, LoadingState } from '@/components/query-state';
import { useSession } from '@/features/auth/session';
import { api, clientes, profissionais } from '@/lib/api';
import { financeApi, useFinanceQuery } from '@/features/finance/finance-api';
import { currentPeriod, money } from '@/features/finance/finance-utils';

type Modulo = { id: string; codigo: string; nome: string };
function DashboardContent() {
  const { session, organization, area, availableAreas } = useSession();
  const orgId = organization?.id || '';
  const areaId = area?.id || '';
  const period = currentPeriod();
  const financial = useFinanceQuery(
    { organizacaoId: orgId, areaId },
    ['resumo', period.inicio, period.fim],
    (signal) =>
      financeApi.resumo({ organizacaoId: orgId, areaId }, period.inicio, period.fim, signal),
    organization?.perfil === 'ADMINISTRADOR',
  );
  const modules = useQuery({
    queryKey: ['modules', orgId, areaId],
    queryFn: () => api<Modulo[]>(`/areas-negocio/${areaId}/modulos`, {}, { organizacaoId: orgId }),
    enabled: !!orgId && !!areaId,
  });
  const agendaEnabled = modules.data?.some((item) => item.codigo === 'AGENDA') || false;
  const customerQuery = useQuery({
    queryKey: ['clientes', orgId, areaId, ''],
    queryFn: () => clientes(orgId, areaId),
    enabled: !!orgId && !!areaId,
  });
  const professionalQuery = useQuery({
    queryKey: ['profissionais', orgId, areaId, ''],
    queryFn: () => profissionais(orgId, areaId),
    enabled: !!orgId && !!areaId && agendaEnabled,
  });
  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-2 text-xs font-bold tracking-[.17em] text-teal-700 uppercase">
            Sua operação, em perspectiva
          </p>
          <h1 className="display text-4xl text-slate-900 sm:text-5xl">
            Bom trabalho, {session?.usuario.nome.split(' ')[0]}.
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            Acompanhe o que está disponível em {area?.nome || 'sua área'}.
          </p>
        </div>
        <div className="rounded-full border border-teal-200 bg-white px-4 py-2 text-xs font-semibold text-teal-800">
          {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(new Date())}
        </div>
      </div>
      {!area ? (
        <div className="surface p-8 text-sm text-slate-600">
          Nenhuma área de negócio disponível nesta organização. Selecione outra organização ou
          solicite acesso ao administrador.
        </div>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-3" aria-label="Indicadores">
            <div className="surface p-6">
              <div className="mb-8 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-600">Clientes nesta área</span>
                <UsersRound size={21} className="text-teal-700" />
              </div>
              <strong className="display text-5xl text-slate-900">
                {customerQuery.isPending
                  ? '—'
                  : customerQuery.isError
                    ? '—'
                    : customerQuery.data?.length}
              </strong>
              <p className="mt-2 text-xs text-slate-500">Registros retornados pela API</p>
            </div>
            <div className="surface p-6">
              <div className="mb-8 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-600">
                  Profissionais nesta área
                </span>
                <BriefcaseBusiness size={21} className="text-teal-700" />
              </div>
              <strong className="display text-5xl text-slate-900">
                {!agendaEnabled
                  ? '—'
                  : professionalQuery.isPending || professionalQuery.isError
                    ? '—'
                    : professionalQuery.data?.length}
              </strong>
              <p className="mt-2 text-xs text-slate-500">
                {agendaEnabled ? 'Registros retornados pela API' : 'Módulo Agenda indisponível'}
              </p>
            </div>
            <div className="surface surface-dark p-6">
              <div className="mb-8 flex items-center justify-between">
                <span className="text-sm font-semibold text-teal-100">Áreas disponíveis</span>
                <Layers3 size={21} className="text-teal-200" />
              </div>
              <strong className="display text-5xl">{availableAreas.length}</strong>
              <p className="mt-2 text-xs text-teal-100">Na organização selecionada</p>
            </div>
          </section>
          {organization?.perfil === 'ADMINISTRADOR' && (
            <section className="mt-6" aria-label="Resumo financeiro">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold tracking-[.12em] text-slate-700 uppercase">
                  Financeiro da área
                </h2>
                <Link
                  href="/financeiro"
                  className="text-sm font-semibold text-teal-800 underline-offset-4 hover:underline"
                >
                  Abrir financeiro
                </Link>
              </div>
              {financial.isPending ? (
                <LoadingState rows={1} />
              ) : financial.isError ? (
                <ErrorState message={financial.error.message} retry={() => financial.refetch()} />
              ) : (
                financial.data && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="surface min-w-0 p-5">
                      <p className="text-sm text-slate-600">Em aberto</p>
                      <strong className="display mt-3 block break-words text-2xl">
                        {money(financial.data.valor_em_aberto)}
                      </strong>
                    </div>
                    <div className="surface min-w-0 p-5">
                      <p className="text-sm text-slate-600">Vencido</p>
                      <strong className="display mt-3 block break-words text-2xl text-red-800">
                        {money(financial.data.valor_vencido)}
                      </strong>
                    </div>
                    <div className="surface min-w-0 p-5">
                      <p className="text-sm text-slate-600">Recebido neste mês</p>
                      <strong className="display mt-3 block break-words text-2xl text-teal-800">
                        {money(financial.data.recebido_periodo)}
                      </strong>
                    </div>
                  </div>
                )
              )}
            </section>
          )}
          {customerQuery.isError && (
            <div className="mt-6">
              <ErrorState
                message={customerQuery.error.message}
                retry={() => customerQuery.refetch()}
              />
            </div>
          )}
          <section className="mt-10">
            <div className="mb-4 flex items-center gap-3">
              <span className="h-px w-8 bg-[#c67b3e]" />
              <h2 className="text-sm font-bold tracking-[.12em] text-slate-700 uppercase">
                Acesso rápido
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Link
                href="/clientes"
                className="surface group flex items-center justify-between p-6 transition-shadow hover:shadow-lg focus-visible:outline-2 focus-visible:outline-teal-700"
              >
                <div className="flex items-center gap-4">
                  <div className="grid size-12 place-items-center rounded-xl bg-teal-50 text-teal-700">
                    <UsersRound size={22} />
                  </div>
                  <div>
                    <h3 className="font-semibold">Gerenciar clientes</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Consulte, cadastre e atualize registros.
                    </p>
                  </div>
                </div>
                <ArrowUpRight size={20} className="text-slate-400 group-hover:text-teal-700" />
              </Link>
              <Link
                href="/profissionais"
                className="surface group flex items-center justify-between p-6 transition-shadow hover:shadow-lg focus-visible:outline-2 focus-visible:outline-teal-700"
              >
                <div className="flex items-center gap-4">
                  <div className="grid size-12 place-items-center rounded-xl bg-amber-50 text-amber-800">
                    <BriefcaseBusiness size={22} />
                  </div>
                  <div>
                    <h3 className="font-semibold">Ver profissionais</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {agendaEnabled
                        ? 'Equipe vinculada à área selecionada.'
                        : 'Disponível quando o módulo Agenda estiver habilitado.'}
                    </p>
                  </div>
                </div>
                <ArrowUpRight size={20} className="text-slate-400 group-hover:text-teal-700" />
              </Link>
            </div>
          </section>
          <div className="mt-10 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            <Building2 className="shrink-0 text-teal-700" size={20} />
            <span>
              <strong className="text-slate-800">{organization?.nome}</strong> · perfil{' '}
              {organization?.perfil.toLowerCase()} · área {area.nome}
            </span>
          </div>
        </>
      )}
      {modules.isPending && area && (
        <div className="mt-6">
          <LoadingState rows={1} />
        </div>
      )}
    </>
  );
}
export default function Home() {
  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  );
}
