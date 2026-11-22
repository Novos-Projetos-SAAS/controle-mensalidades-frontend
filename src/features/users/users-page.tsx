'use client';

import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/app-shell';
import { EmptyState, ErrorState, LoadingState } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSession } from '@/features/auth/session';
import { ApiError, type Organizacao } from '@/lib/api';
import { CreateUserDialog, UpdateUserDialog } from './user-dialogs';
import { listUsers, profileInfo, profiles, userError, type OrganizationUser } from './users-api';

type SelectedAction = { kind: 'create' } | { kind: 'profile' | 'status'; user: OrganizationUser };

export function UsersPage() {
  const { organization, session } = useSession();
  return (
    <AppShell>
      {session && organization?.perfil === 'ADMINISTRADOR' ? (
        <UsersContent
          key={`${session.usuario.id}:${organization.id}`}
          organization={organization}
        />
      ) : (
        <EmptyState
          title="Acesso restrito"
          description="A gestão de usuários está disponível para administradores da organização."
        />
      )}
    </AppShell>
  );
}

function UsersContent({ organization }: { organization: Organizacao }) {
  const { session, updateOwnMembership } = useSession();
  const actorId = session?.usuario.id;
  const [search, setSearch] = useState('');
  const [profile, setProfile] = useState('');
  const [status, setStatus] = useState('');
  const [action, setAction] = useState<SelectedAction | null>(null);
  const [notice, setNotice] = useState('');
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const queryClient = useQueryClient();
  const queryKey = ['usuarios', organization.id] as const;
  const users = useQuery({
    queryKey,
    queryFn: ({ signal }) => listUsers(organization.id, signal),
    retry: (failures, error) =>
      failures < 1 && (!(error instanceof ApiError) || error.status === 0 || error.status >= 500),
  });
  const needle = search.trim().toLocaleLowerCase('pt-BR');
  const filtered =
    users.data?.filter(
      (user) =>
        (user.nome.toLocaleLowerCase('pt-BR').includes(needle) ||
          user.email.toLowerCase().includes(needle)) &&
        (!profile || user.perfil === profile) &&
        (!status || user.ativo === (status === 'active')),
    ) ?? [];

  function openAction(next: SelectedAction, trigger: HTMLButtonElement) {
    triggerRef.current = trigger;
    setNotice('');
    setAction(next);
  }

  function onSaved(user: OrganizationUser, message: string) {
    setAction(null);
    if (actorId === user.id && (!user.ativo || user.perfil !== organization.perfil)) {
      updateOwnMembership(actorId, organization.id, user);
      queryClient.removeQueries({ queryKey, exact: true });
      toast.success(message);
      return;
    }
    setNotice(message);
    queryClient.setQueryData<OrganizationUser[]>(queryKey, (current) => {
      if (!current) return current;
      return current.some(({ id }) => id === user.id)
        ? current.map((item) => (item.id === user.id ? user : item))
        : [...current, user].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    });
    void queryClient.invalidateQueries({ queryKey, exact: true });
  }

  const dialogProps = {
    organizationId: organization.id,
    organizationName: organization.nome,
    onClose: () => setAction(null),
    onSaved,
    restoreFocus: () => {
      if (triggerRef.current?.isConnected) triggerRef.current.focus();
      else titleRef.current?.focus();
    },
  };

  return (
    <section className="space-y-5 pb-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[.15em] text-teal-700 uppercase">
            Configurações
          </p>
          <h1
            ref={titleRef}
            tabIndex={-1}
            className="display mt-1 text-3xl text-slate-900 sm:text-4xl"
          >
            Usuários e Permissões
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Gerencie quem pode acessar sua organização e o que cada pessoa pode fazer.
          </p>
        </div>
        <Button
          disabled={!users.isSuccess}
          onClick={(event) => openAction({ kind: 'create' }, event.currentTarget)}
        >
          <UserPlus size={18} aria-hidden="true" /> Adicionar usuário
        </Button>
      </header>
      <div role="status" aria-atomic="true">
        {notice && <p className="rounded-xl bg-teal-50 p-3 text-sm text-teal-900">{notice}</p>}
      </div>
      {users.isPending ? (
        <LoadingState />
      ) : users.isError ? (
        <ErrorState
          message={userError(
            users.error,
            'Não foi possível consultar os usuários. Tente novamente.',
          )}
          retry={() => users.refetch()}
        />
      ) : !users.data?.length ? (
        <EmptyState
          title="Nenhum usuário cadastrado"
          description="Adicione uma conta para quem trabalha na organização."
        />
      ) : (
        <div className="surface divide-y divide-slate-200">
          <div className="grid gap-3 p-4 sm:grid-cols-[2fr_1fr_1fr] sm:p-5">
            <label>
              <span className="field-label">Buscar usuários</span>
              <Input
                type="search"
                value={search}
                placeholder="Nome ou e-mail"
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label>
              <span className="field-label">Filtrar por perfil</span>
              <select
                className="select-field"
                value={profile}
                onChange={(event) => setProfile(event.target.value)}
              >
                <option value="">Todos os perfis</option>
                {profiles.map((item) => (
                  <option key={item} value={item}>
                    {profileInfo[item].label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="field-label">Filtrar por situação</span>
              <select
                className="select-field"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">Todas as situações</option>
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </label>
          </div>
          {filtered.length ? (
            <ul aria-label="Usuários da organização" className="divide-y divide-slate-100">
              {filtered.map((user) => {
                const actionLabel = user.ativo ? 'Desativar acesso' : 'Reativar acesso';
                return (
                  <li
                    key={user.id}
                    className="grid items-center gap-3 px-4 py-4 sm:px-5 xl:grid-cols-[minmax(0,1fr)_auto_auto]"
                  >
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-slate-900">{user.nome}</p>
                      <p className="break-all text-sm text-slate-600">{user.email}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">
                        {profileInfo[user.perfil].label}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 font-medium ${user.ativo ? 'bg-teal-100 text-teal-900' : 'bg-slate-100 text-slate-600'}`}
                      >
                        {user.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        aria-label={`Alterar perfil de ${user.nome}`}
                        onClick={(event) =>
                          openAction({ kind: 'profile', user }, event.currentTarget)
                        }
                      >
                        Alterar perfil
                      </Button>
                      <Button
                        variant="outline"
                        aria-label={`${actionLabel} de ${user.nome}`}
                        onClick={(event) =>
                          openAction({ kind: 'status', user }, event.currentTarget)
                        }
                      >
                        {actionLabel}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-5 py-8 text-center text-sm text-slate-600">
              Nenhum usuário corresponde aos filtros.
            </p>
          )}
        </div>
      )}
      {action?.kind === 'create' ? (
        <CreateUserDialog {...dialogProps} />
      ) : action ? (
        <UpdateUserDialog {...dialogProps} user={action.user} action={action.kind} />
      ) : null}
    </section>
  );
}
