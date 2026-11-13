export type Usuario = { id: string; nome: string; email: string };
export type Organizacao = { id: string; nome: string; perfil: string };
export type Area = { id: string; nome: string; ativo?: boolean };
export type Sessao = { usuario: Usuario; organizacoes: Organizacao[] };
export type Pessoa = {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  ativo: boolean;
  areas: Area[];
};
export type Cliente = Pessoa & {
  data_nascimento?: string | null;
  sexo?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  observacao?: string | null;
  aceite_whatsapp?: boolean;
};
export type Profissional = Pessoa & {
  conselho: string | null;
  numero_conselho: string | null;
  uf_conselho: string | null;
};

type ApiEnvelope<T> = { data: T; mensagem?: string; message?: string };

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
  context?: { organizacaoId?: string; areaId?: string },
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      ...options,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(context?.organizacaoId ? { 'x-organizacao-id': context.organizacaoId } : {}),
        ...(context?.areaId ? { 'x-area-negocio-id': context.areaId } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError('Não foi possível conectar ao servidor. Verifique sua conexão.', 0);
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload as { mensagem?: string; codigo?: string } | null;
    if (response.status === 401 && !path.startsWith('/auth/'))
      window.dispatchEvent(new Event('orbe:session-expired'));
    throw new ApiError(
      error?.mensagem ||
        (response.status === 401
          ? 'Sessão expirada. Entre novamente.'
          : 'Não foi possível concluir a operação.'),
      response.status,
      error?.codigo,
    );
  }
  if (Array.isArray(payload)) return payload as T;
  return (payload as ApiEnvelope<T>).data;
}

export const login = (email: string, senha: string) =>
  api<Sessao>('/auth/login', { method: 'POST', body: JSON.stringify({ email, senha }) });
export const me = () => api<Sessao>('/auth/me');
export const logout = () => api<null>('/auth/logout', { method: 'POST' });
export const areas = (organizacaoId: string) =>
  api<Area[]>('/areas-negocio', {}, { organizacaoId });
export const clientes = (organizacaoId: string, areaId?: string, busca?: string) => {
  const params = new URLSearchParams();
  if (areaId) params.set('areaNegocioId', areaId);
  if (busca) params.set('busca', busca);
  return api<Cliente[]>(`/clientes?${params}`, {}, { organizacaoId });
};
export const cliente = (id: string, organizacaoId: string) =>
  api<Cliente>(`/clientes/${id}`, {}, { organizacaoId });
export const profissionais = (organizacaoId: string, areaId: string, busca?: string) => {
  const params = new URLSearchParams({ areaNegocioId: areaId });
  if (busca) params.set('busca', busca);
  return api<Profissional[]>(`/profissionais?${params}`, {}, { organizacaoId, areaId });
};
export const profissional = (id: string, organizacaoId: string, areaId: string) =>
  api<Profissional>(`/profissionais/${id}`, {}, { organizacaoId, areaId });
