import { api, ApiError, type Usuario } from '@/lib/api';

export const profiles = ['ADMINISTRADOR', 'OPERADOR'] as const;
export type Profile = (typeof profiles)[number];
export type OrganizationUser = Usuario & { perfil: Profile; ativo: boolean };

export const profileInfo = {
  ADMINISTRADOR: {
    label: 'Administrador',
    description: 'Pode gerenciar usuários, configurações e financeiro da organização.',
  },
  OPERADOR: {
    label: 'Operador',
    description:
      'Pode realizar tarefas operacionais, como cadastro de clientes e operação da agenda, conforme os módulos habilitados.',
  },
} satisfies Record<Profile, { label: string; description: string }>;

type NewUser = Pick<Usuario, 'nome' | 'email'> & { senha: string; perfil: Profile };
type MembershipUpdate = { perfil: Profile; ativo?: boolean } | { perfil?: Profile; ativo: boolean };

export function listUsers(organizacaoId: string, signal: AbortSignal) {
  return api<OrganizationUser[]>('/usuarios', { signal }, { organizacaoId });
}

export function createUser(organizacaoId: string, user: NewUser) {
  return api<OrganizationUser>(
    '/usuarios',
    { method: 'POST', body: JSON.stringify(user) },
    { organizacaoId },
  );
}

export function updateUser(organizacaoId: string, usuarioId: string, membership: MembershipUpdate) {
  return api<OrganizationUser>(
    `/usuarios/${encodeURIComponent(usuarioId)}`,
    { method: 'PATCH', body: JSON.stringify(membership) },
    { organizacaoId },
  );
}

export function userError(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) return fallback;
  if (error.code === 'ULTIMO_ADMINISTRADOR')
    return 'Esta organização precisa ter pelo menos um administrador ativo. Defina outro administrador antes de remover esse acesso.';
  if (error.code === 'EMAIL_JA_CADASTRADO') return 'Já existe um usuário com esse e-mail.';
  if (error.status === 403) return 'Você não tem permissão para esta operação nesta organização.';
  if (error.status >= 500) return fallback;
  return error.message;
}
