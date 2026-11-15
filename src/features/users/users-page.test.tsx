import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import UsuariosPage from '@/app/configuracoes/usuarios/page';
import { SessionProvider } from '@/features/auth/session';
import type { OrganizationUser } from './users-api';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/configuracoes/usuarios',
}));

const admin: OrganizationUser = {
  id: 'admin',
  nome: 'Gabriela Admin',
  email: 'admin@example.com',
  perfil: 'ADMINISTRADOR',
  ativo: true,
};
const staff: OrganizationUser = {
  id: 'staff',
  nome: 'Ana Silva',
  email: 'ana@example.com',
  perfil: 'OPERADOR',
  ativo: true,
};
const otherUser = { ...staff, id: 'other', nome: 'Funcionário B', email: 'outra@example.com' };
const lastAdminMessage =
  'Esta organização precisa ter pelo menos um administrador ativo. Defina outro administrador antes de remover esse acesso.';
const password = 'Ficticia2026!';
const fetchMock = vi.fn<typeof fetch>();
type RecordedCall = {
  org: string | null;
  area: string | null;
  method: string;
  path: string;
  body: unknown;
  signal?: AbortSignal | null;
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function setup({
  role = 'ADMINISTRADOR',
  request,
}: {
  role?: OrganizationUser['perfil'];
  request?: (call: RecordedCall) => Response | Promise<Response>;
} = {}) {
  const calls: RecordedCall[] = [];
  const lists: Record<string, OrganizationUser[]> = {
    'org-a': [admin, staff],
    'org-b': [otherUser],
  };
  fetchMock.mockImplementation(async (input, init) => {
    const path = String(input).replace('/api/v1', '');
    if (path === '/auth/me')
      return Response.json({
        data: {
          usuario: { id: admin.id, nome: admin.nome, email: admin.email },
          organizacoes: [
            { id: 'org-a', nome: 'Academia A', perfil: role },
            { id: 'org-b', nome: 'Academia B', perfil: 'ADMINISTRADOR' },
          ],
        },
      });
    if (path === '/areas-negocio') return Response.json({ data: [] });
    const headers = new Headers(init?.headers);
    const call: RecordedCall = {
      org: headers.get('x-organizacao-id'),
      area: headers.get('x-area-negocio-id'),
      method: init?.method ?? 'GET',
      path,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      signal: init?.signal,
    };
    calls.push(call);
    if (request) return request(call);
    const list = lists[call.org ?? ''] ?? [];
    if (call.method === 'GET') return Response.json({ data: list });
    if (call.method === 'POST') {
      const { nome, email, perfil } = call.body as OrganizationUser;
      const created = { id: 'created', nome, email, perfil, ativo: true };
      list.push(created);
      return Response.json({ data: created }, { status: 201 });
    }
    const index = list.findIndex(({ id }) => path === `/usuarios/${id}`);
    if (index === -1) throw new Error('Usuário fora da organização');
    list[index] = { ...list[index], ...(call.body as Partial<OrganizationUser>) };
    return Response.json({ data: list[index] });
  });
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <SessionProvider>
        <UsuariosPage />
      </SessionProvider>
    </QueryClientProvider>,
  );
  return { calls, client };
}

async function openCreate() {
  fireEvent.click(await screen.findByRole('button', { name: 'Adicionar usuário' }));
  return within(screen.getByRole('dialog', { name: 'Adicionar usuário' }));
}

function fillCreate(
  dialog: ReturnType<typeof within>,
  options: { senha?: string; confirmacao?: string } = {},
) {
  fireEvent.change(dialog.getByLabelText('Nome completo'), {
    target: { value: ' Beatriz Nunes ' },
  });
  fireEvent.change(dialog.getByLabelText('E-mail'), { target: { value: 'BIA@example.com' } });
  fireEvent.change(dialog.getByLabelText('Senha inicial'), {
    target: { value: options.senha ?? password },
  });
  fireEvent.change(dialog.getByLabelText('Confirmar senha'), {
    target: { value: options.confirmacao ?? password },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Usuários e Permissões', () => {
  it('exibe o link e lista a organização ativa, com busca e filtros', async () => {
    const { calls } = setup();
    const list = within(await screen.findByRole('list', { name: 'Usuários da organização' }));
    expect(screen.getByRole('heading', { name: 'Usuários e Permissões' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Usuários e Permissões' }).getAttribute('href')).toBe(
      '/configuracoes/usuarios',
    );
    expect(calls[0]).toMatchObject({ org: 'org-a', area: null, path: '/usuarios' });
    expect(list.getByText('ana@example.com')).toBeTruthy();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ANA@EXAMPLE.COM' } });
    expect(list.queryByText(admin.nome)).toBeNull();
    fireEvent.change(screen.getByLabelText('Filtrar por perfil'), {
      target: { value: 'ADMINISTRADOR' },
    });
    expect(screen.getByText('Nenhum usuário corresponde aos filtros.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Filtrar por perfil'), {
      target: { value: 'OPERADOR' },
    });
    fireEvent.change(screen.getByLabelText('Filtrar por situação'), {
      target: { value: 'inactive' },
    });
    expect(screen.getByText('Nenhum usuário corresponde aos filtros.')).toBeTruthy();
  });

  it('bloqueia acesso direto e oculta o link para operador', async () => {
    const { calls } = setup({ role: 'OPERADOR' });
    await screen.findByText('Acesso restrito');
    expect(screen.queryByRole('link', { name: 'Usuários e Permissões' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Adicionar usuário' })).toBeNull();
    expect(calls).toEqual([]);
  });

  it.each(['OPERADOR', 'ADMINISTRADOR'] as const)('cadastra %s e limpa a senha', async (perfil) => {
    const { calls } = setup();
    await screen.findByText(staff.nome);
    const dialog = await openCreate();
    fillCreate(dialog);
    if (perfil === 'ADMINISTRADOR')
      fireEvent.change(dialog.getByLabelText('Perfil'), { target: { value: perfil } });
    fireEvent.click(dialog.getByRole('button', { name: 'Cadastrar usuário' }));
    await screen.findByText('Usuário cadastrado com sucesso.');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Beatriz Nunes')).toBeTruthy();
    expect(calls.find(({ method }) => method === 'POST')).toMatchObject({
      org: 'org-a',
      area: null,
      path: '/usuarios',
      body: { nome: 'Beatriz Nunes', email: 'bia@example.com', senha: password, perfil },
    });
    expect(calls.find(({ method }) => method === 'POST')?.body).not.toHaveProperty(
      'confirmarSenha',
    );
    const reopened = await openCreate();
    expect((reopened.getByLabelText('Senha inicial') as HTMLInputElement).value).toBe('');
    expect((reopened.getByLabelText('Confirmar senha') as HTMLInputElement).value).toBe('');
  });

  it('valida senha e confirmação antes de enviar', async () => {
    const { calls } = setup();
    await screen.findByText(staff.nome);
    const dialog = await openCreate();
    fillCreate(dialog, { senha: 'fraca' });
    fireEvent.click(dialog.getByRole('button', { name: 'Cadastrar usuário' }));
    await dialog.findByText('As senhas não coincidem.');
    expect(dialog.getByLabelText('Senha inicial').getAttribute('aria-invalid')).toBe('true');
    expect(calls.every(({ method }) => method === 'GET')).toBe(true);
  });

  it('exibe conflito de e-mail e mantém o formulário aberto', async () => {
    setup({
      request: ({ method }) =>
        method === 'GET'
          ? Response.json({ data: [staff] })
          : Response.json({ codigo: 'EMAIL_JA_CADASTRADO' }, { status: 409 }),
    });
    await screen.findByText(staff.nome);
    const dialog = await openCreate();
    fillCreate(dialog);
    fireEvent.click(dialog.getByRole('button', { name: 'Cadastrar usuário' }));
    await dialog.findByText('Já existe um usuário com esse e-mail.');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('altera o perfil após a API confirmar', async () => {
    const { calls } = setup();
    fireEvent.click(await screen.findByRole('button', { name: 'Alterar perfil de Ana Silva' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Alterar perfil' }));
    expect(dialog.getByText(/Pode gerenciar usuários/)).toBeTruthy();
    expect(dialog.getByText(/Pode realizar tarefas operacionais/)).toBeTruthy();
    fireEvent.change(dialog.getByLabelText('Novo perfil'), { target: { value: 'ADMINISTRADOR' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Salvar perfil' }));
    await screen.findByText('Perfil atualizado.');
    expect(calls.find(({ method }) => method === 'PATCH')).toMatchObject({
      org: 'org-a',
      path: '/usuarios/staff',
      body: { perfil: 'ADMINISTRADOR' },
    });
    expect(
      within(screen.getByText(staff.nome).closest('li')!).getByText('Administrador'),
    ).toBeTruthy();
  });

  it('desativa e reativa o vínculo com confirmação', async () => {
    const { calls } = setup();
    fireEvent.click(await screen.findByRole('button', { name: 'Desativar acesso de Ana Silva' }));
    let dialog = within(screen.getByRole('dialog'));
    expect(
      dialog.getByText(
        'Este usuário perderá o acesso à organização. Você poderá reativá-lo depois.',
      ),
    ).toBeTruthy();
    fireEvent.click(dialog.getByRole('button', { name: 'Desativar acesso' }));
    await screen.findByText('Acesso desativado.');
    expect(within(screen.getByText(staff.nome).closest('li')!).getByText('Inativo')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reativar acesso de Ana Silva' }));
    dialog = within(screen.getByRole('dialog'));
    fireEvent.click(dialog.getByRole('button', { name: 'Reativar acesso' }));
    await screen.findByText('Acesso reativado.');
    expect(within(screen.getByText(staff.nome).closest('li')!).getByText('Ativo')).toBeTruthy();
    expect(calls.filter(({ method }) => method === 'PATCH').map(({ body }) => body)).toEqual([
      { ativo: false },
      { ativo: true },
    ]);
  });

  it('informa a restrição do último administrador sem alterar a lista', async () => {
    const pending = deferred<Response>();
    const { calls } = setup({
      request: ({ method }) =>
        method === 'GET' ? Response.json({ data: [admin] }) : pending.promise,
    });
    const trigger = await screen.findByRole('button', {
      name: 'Desativar acesso de Gabriela Admin',
    });
    const row = within(trigger.closest('li')!);
    fireEvent.click(trigger);
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.click(dialog.getByRole('button', { name: 'Desativar acesso' }));
    expect(
      ((await dialog.findByRole('button', { name: 'Salvando...' })) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(row.getByText('Ativo')).toBeTruthy();
    pending.resolve(Response.json({ codigo: 'ULTIMO_ADMINISTRADOR' }, { status: 409 }));
    await dialog.findByText(lastAdminMessage);
    expect(calls.filter(({ method }) => method === 'PATCH')).toHaveLength(1);
    expect(row.getByText('Ativo')).toBeTruthy();
  });

  it('remove acesso local ao confirmar a alteração do próprio perfil', async () => {
    const { client } = setup();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Alterar perfil de Gabriela Admin' }),
    );
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Novo perfil'), { target: { value: 'OPERADOR' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Salvar perfil' }));
    await screen.findByText('Acesso restrito');
    expect(screen.queryByRole('link', { name: 'Usuários e Permissões' })).toBeNull();
    expect(client.getQueryData(['usuarios', 'org-a'])).toBeUndefined();
  });

  it('mostra carregamento, erro de consulta e lista vazia após tentar novamente', async () => {
    const response = deferred<Response>();
    let count = 0;
    setup({ request: () => (++count === 1 ? response.promise : Response.json({ data: [] })) });
    await screen.findByText('Carregando dados');
    response.resolve(Response.json({ mensagem: 'Consulta recusada.' }, { status: 400 }));
    await screen.findByText('Consulta recusada.');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await screen.findByText('Nenhum usuário cadastrado');
  });

  it('retira a organização do seletor ao desativar o próprio vínculo', async () => {
    const { calls } = setup();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Desativar acesso de Gabriela Admin' }),
    );
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.click(dialog.getByRole('button', { name: 'Desativar acesso' }));
    await screen.findByText(otherUser.nome);
    expect(screen.queryByRole('option', { name: 'Academia A' })).toBeNull();
    expect((screen.getByLabelText('Organização') as HTMLSelectElement).value).toBe('org-b');
    expect(screen.queryByText(staff.nome)).toBeNull();
    expect(calls.map(({ org, method }) => [org, method])).toEqual([
      ['org-a', 'GET'],
      ['org-a', 'PATCH'],
      ['org-b', 'GET'],
    ]);
  });

  it('descarta uma resposta atrasada da organização anterior', async () => {
    const previous = deferred<Response>();
    const { calls } = setup({
      request: ({ org }) =>
        org === 'org-a' ? previous.promise : Response.json({ data: [otherUser] }),
    });
    await screen.findByText('Carregando dados');
    fireEvent.change(screen.getByLabelText('Organização'), { target: { value: 'org-b' } });
    await screen.findByText(otherUser.nome);
    await act(async () => {
      previous.resolve(Response.json({ data: [staff] }));
    });
    expect(calls.map(({ org }) => org)).toEqual(['org-a', 'org-b']);
    expect(calls[0].signal?.aborted).toBe(true);
    expect(screen.queryByText(staff.nome)).toBeNull();
    expect(screen.getByText(otherUser.nome)).toBeTruthy();
  });
});
