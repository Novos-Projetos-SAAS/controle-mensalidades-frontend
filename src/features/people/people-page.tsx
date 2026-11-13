'use client';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, UserRound, ArrowRight, CircleHelp } from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from '@/features/auth/session';
import { PersonForm } from '@/features/people/person-form';
import { LinkUserDialog } from '@/features/people/link-user-dialog';
import {
  api,
  cliente,
  clientes,
  profissional,
  profissionais,
  type Cliente,
  type Profissional,
} from '@/lib/api';
import { formatCpf, formatDate, initials } from '@/lib/format';
import { AppShell } from '@/components/app-shell';
import { LoadingState, ErrorState, EmptyState } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

type Modulo = { codigo: string };
export function PeoplePage({ kind }: { kind: 'clientes' | 'profissionais' }) {
  const isClient = kind === 'clientes';
  const singular = isClient ? 'cliente' : 'profissional';
  const { organization, area, availableAreas } = useSession();
  const queryClient = useQueryClient();
  const orgId = organization?.id || '',
    areaId = area?.id || '';
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState('todos');
  const [editing, setEditing] = useState<Cliente | Profissional | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [linkId, setLinkId] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);
  const modules = useQuery({
    queryKey: ['modules', orgId, areaId],
    queryFn: () => api<Modulo[]>(`/areas-negocio/${areaId}/modulos`, {}, { organizacaoId: orgId }),
    enabled: !isClient && !!orgId && !!areaId,
  });
  const allowed = isClient || modules.data?.some((module) => module.codigo === 'AGENDA') === true;
  const key = [kind, orgId, areaId, debounced];
  const list = useQuery({
    queryKey: key,
    queryFn: () =>
      isClient ? clientes(orgId, areaId, debounced) : profissionais(orgId, areaId, debounced),
    enabled: !!orgId && !!areaId && allowed,
  });
  const detail = useQuery({
    queryKey: [kind, 'detail', orgId, areaId, detailId],
    queryFn: () => (isClient ? cliente(detailId!, orgId) : profissional(detailId!, orgId, areaId)),
    enabled: !!detailId && !!orgId && allowed,
  });
  const rows = (list.data || []).filter(
    (person) => status === 'todos' || person.ativo === (status === 'ativos'),
  );
  const canManage = isClient || organization?.perfil === 'ADMINISTRADOR';
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: [kind, orgId] });
    queryClient.invalidateQueries({ queryKey: [kind, 'detail', orgId] });
    queryClient.invalidateQueries({ queryKey: ['clientes', orgId] });
    queryClient.invalidateQueries({ queryKey: ['profissionais', orgId] });
  };
  const openEdit = async (id: string) => {
    try {
      const record = isClient ? await cliente(id, orgId) : await profissional(id, orgId, areaId);
      setEditing(record);
      setDetailId(null);
      setFormOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível abrir o cadastro.');
    }
  };
  const toggle = async () => {
    const person = list.data?.find((item) => item.id === confirmId);
    if (!person) return;
    try {
      await api(
        `/${kind}/${person.id}/${person.ativo ? 'inativar' : 'reativar'}`,
        { method: 'PATCH' },
        { organizacaoId: orgId, areaId },
      );
      toast.success(person.ativo ? 'Cadastro inativado.' : 'Cadastro reativado.');
      setConfirmId(null);
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível alterar o cadastro.');
    }
  };
  return (
    <AppShell>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-bold tracking-[.16em] text-teal-700 uppercase">
            Cadastros · {area?.nome || 'Área'}
          </p>
          <h1 className="display text-4xl text-slate-900 sm:text-5xl">
            {isClient ? 'Clientes' : 'Profissionais'}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {isClient
              ? 'Pessoas e informações de contato da organização.'
              : 'Equipe vinculada à área de negócio selecionada.'}
          </p>
        </div>
        {canManage && allowed && (
          <Button
            disabled={!area}
            onClick={() => {
              if (!area) return;
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus size={18} aria-hidden="true" /> Novo {singular}
          </Button>
        )}
      </div>
      {!area ? (
        <EmptyState
          title="Selecione uma área"
          description="Escolha uma área de negócio no topo da página para consultar os registros."
        />
      ) : !isClient && modules.isPending ? (
        <LoadingState />
      ) : !isClient && modules.isError ? (
        <ErrorState message={modules.error.message} retry={() => modules.refetch()} />
      ) : !allowed ? (
        <div className="surface flex items-start gap-4 p-7">
          <CircleHelp className="shrink-0 text-amber-700" />
          <div>
            <h2 className="font-semibold">Profissionais indisponíveis nesta área</h2>
            <p className="mt-2 text-sm text-slate-600">
              O módulo Agenda não está habilitado para a área selecionada. Solicite acesso ao
              administrador.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="surface mb-5 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
            <label className="flex-1">
              <span className="field-label">Buscar por nome, CPF ou contato</span>
              <span className="relative block">
                <Search
                  size={17}
                  className="absolute left-3.5 top-3.5 text-slate-400"
                  aria-hidden="true"
                />
                <Input
                  className="pl-10"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={`Buscar ${isClient ? 'clientes' : 'profissionais'}`}
                />
              </span>
            </label>
            <label className="sm:w-44">
              <span className="field-label">Situação</span>
              <select
                className="select-field"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="todos">Todos</option>
                <option value="ativos">Ativos</option>
                <option value="inativos">Inativos</option>
              </select>
            </label>
          </div>
          {list.isPending ? (
            <LoadingState />
          ) : list.isError ? (
            <ErrorState message={list.error.message} retry={() => list.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              title={debounced ? 'Nenhum resultado encontrado' : `Nenhum ${singular} encontrado`}
              description={
                debounced
                  ? 'Tente buscar por outro nome ou contato.'
                  : `Cadastre o primeiro ${singular} para começar.`
              }
              action={
                canManage && !debounced ? (
                  <Button
                    onClick={() => {
                      setEditing(null);
                      setFormOpen(true);
                    }}
                  >
                    Novo {singular}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="surface overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-4 text-xs font-semibold text-slate-500">
                {rows.length} {rows.length === 1 ? 'registro' : 'registros'} exibidos
              </div>
              <div className="divide-y divide-slate-100">
                {rows.map((person) => (
                  <div
                    key={person.id}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-5 sm:px-5"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-teal-50 text-sm font-bold text-teal-800">
                        {initials(person.nome) || <UserRound size={18} />}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{person.nome}</p>
                        <p className="truncate text-xs text-slate-500">
                          {person.email || person.telefone || formatCpf(person.cpf)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${person.ativo ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}
                      >
                        {person.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDetailId(person.id)}
                        aria-label={`Ver detalhes de ${person.nome}`}
                      >
                        Detalhes <ArrowRight size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      <PersonForm
        kind={kind}
        open={formOpen}
        onOpenChange={setFormOpen}
        person={editing}
        areas={availableAreas}
        organizationId={orgId}
        areaId={areaId}
        onSaved={refresh}
      />
      <Dialog open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent>
          <DialogTitle className="display pr-10 text-3xl">
            {detail.data?.nome || 'Detalhes do cadastro'}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-slate-600">
            Informações registradas na organização atual.
          </DialogDescription>
          {detail.isPending ? (
            <div className="mt-6">
              <LoadingState rows={3} />
            </div>
          ) : detail.isError ? (
            <div className="mt-6">
              <ErrorState message={detail.error.message} retry={() => detail.refetch()} />
            </div>
          ) : (
            detail.data && (
              <>
                <dl className="mt-6 grid gap-4 rounded-xl bg-slate-50 p-5 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-500">CPF</dt>
                    <dd className="mt-1 font-medium">{formatCpf(detail.data.cpf)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Telefone</dt>
                    <dd className="mt-1 font-medium">{detail.data.telefone || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">E-mail</dt>
                    <dd className="mt-1 break-all font-medium">{detail.data.email || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Situação</dt>
                    <dd className="mt-1 font-medium">{detail.data.ativo ? 'Ativo' : 'Inativo'}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-slate-500">Áreas</dt>
                    <dd className="mt-1 font-medium">
                      {detail.data.areas.map((item) => item.nome).join(', ') || '—'}
                    </dd>
                  </div>
                  {isClient ? (
                    <>
                      <div>
                        <dt className="text-slate-500">Nascimento</dt>
                        <dd className="mt-1 font-medium">
                          {formatDate((detail.data as Cliente).data_nascimento)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Cidade</dt>
                        <dd className="mt-1 font-medium">
                          {(detail.data as Cliente).cidade || '—'}
                        </dd>
                      </div>
                    </>
                  ) : (
                    <div className="sm:col-span-2">
                      <dt className="text-slate-500">Conselho profissional</dt>
                      <dd className="mt-1 font-medium">
                        {[
                          (detail.data as Profissional).conselho,
                          (detail.data as Profissional).numero_conselho,
                          (detail.data as Profissional).uf_conselho,
                        ]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </dd>
                    </div>
                  )}
                </dl>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  {canManage && (
                    <>
                      {!isClient && detail.data.ativo && (
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setLinkId(detail.data!.id);
                            setDetailId(null);
                          }}
                        >
                          Vincular usuário
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        onClick={() => {
                          setConfirmId(detail.data!.id);
                          setDetailId(null);
                        }}
                      >
                        {detail.data.ativo ? 'Inativar' : 'Reativar'}
                      </Button>
                      <Button onClick={() => openEdit(detail.data!.id)}>Editar cadastro</Button>
                    </>
                  )}
                </div>
              </>
            )
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!confirmId} onOpenChange={(open) => !open && setConfirmId(null)}>
        <DialogContent className="max-w-md">
          <DialogTitle className="display pr-10 text-3xl">Confirmar alteração</DialogTitle>
          <DialogDescription className="mt-3 text-sm text-slate-600">
            A situação deste cadastro será alterada na organização atual.
          </DialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmId(null)}>
              Cancelar
            </Button>
            <Button onClick={toggle}>Confirmar</Button>
          </div>
        </DialogContent>
      </Dialog>
      {!isClient && organization?.perfil === 'ADMINISTRADOR' && (
        <LinkUserDialog
          professionalId={linkId}
          organizationId={orgId}
          areaId={areaId}
          onClose={() => setLinkId(null)}
          onLinked={refresh}
        />
      )}
    </AppShell>
  );
}
