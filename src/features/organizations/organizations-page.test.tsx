import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionProvider } from '@/features/auth/session';
import OrganizationsRoute from '@/app/configuracoes/organizacoes/page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/configuracoes/organizacoes',
}));

const fetchMock = vi.fn<typeof fetch>();
const initialOrganizations = [
  { id: 'org-antiga', nome: 'Academia Antiga', perfil: 'OPERADOR' },
  { id: 'org-admin', nome: 'Clínica Atual', perfil: 'ADMINISTRADOR' },
];
let memberships = [...initialOrganizations];
let areasByOrg: Record<string, { id: string; nome: string }[]> = {};

type Call = { path: string; method: string; organizationId: string | null; body: unknown };

function setup() {
  const calls: Call[] = [];
  fetchMock.mockImplementation(async (input, options) => {
    const path = String(input).replace('/api/v1', '');
    const headers = new Headers(options?.headers);
    const organizationId = headers.get('x-organizacao-id');
    const method = options?.method ?? 'GET';
    const body = options?.body ? JSON.parse(String(options.body)) : null;
    calls.push({ path, method, organizationId, body });
    if (path === '/auth/me') {
      return Response.json({
        data: {
          usuario: { id: 'user', nome: 'Pessoa Exemplo', email: 'pessoa@example.com' },
          organizacoes: memberships,
        },
      });
    }
    if (path === '/areas-negocio' && method === 'GET') {
      return Response.json({ data: areasByOrg[organizationId ?? ''] ?? [] });
    }
    if (path === '/organizacoes' && method === 'POST') {
      const value = body as { nome: string; areaInicial: { nome: string } };
      const organizacao = { id: 'org-nova', nome: value.nome, perfil: 'ADMINISTRADOR' };
      const area = { id: 'area-inicial', nome: value.areaInicial.nome, codigo: 'PILATES' };
      memberships = [...memberships, organizacao];
      areasByOrg[organizacao.id] = [area];
      return Response.json({ data: { organizacao, area } }, { status: 201 });
    }
    if (path === '/areas-negocio' && method === 'POST') {
      const area = { id: 'area-extra', nome: (body as { nome: string }).nome, codigo: 'MUSCULACAO' };
      areasByOrg[organizationId ?? ''] = [...(areasByOrg[organizationId ?? ''] ?? []), area];
      return Response.json({ data: area }, { status: 201 });
    }
    throw new Error(`Rota não prevista no teste: ${path}`);
  });
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={cache}>
      <SessionProvider>
        <OrganizationsRoute />
      </SessionProvider>
    </QueryClientProvider>,
  );
  return { calls, cache };
}

beforeEach(() => {
  memberships = [...initialOrganizations];
  areasByOrg = {
    'org-antiga': [{ id: 'area-a', nome: 'Fisioterapia' }],
    'org-admin': [{ id: 'area-b', nome: 'Pilates' }],
  };
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Organizações e áreas', () => {
  it('mantém perfis separados e permite abrir outra organização sem cabeçalho de tenant', async () => {
    const { calls } = setup();
    expect(await screen.findByRole('heading', { name: 'Organizações e áreas' })).toBeTruthy();
    expect(screen.getAllByText('Academia Antiga').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Adicionar área' })).toBeNull();

    fireEvent.change(screen.getByLabelText('Nome da empresa'), {
      target: { value: ' Academia Nova ' },
    });
    fireEvent.change(screen.getByLabelText('Primeira área de negócio'), {
      target: { value: ' Pilates ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Criar organização' }));
    await waitFor(() => {
      expect(screen.getAllByText('Academia Nova').length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: 'Adicionar área' })).toBeTruthy();
    });
    const post = calls.find((call) => call.path === '/organizacoes' && call.method === 'POST');
    expect(post?.organizationId).toBeNull();
    expect(post?.body).toEqual({
      nome: 'Academia Nova',
      areaInicial: { nome: 'Pilates' },
    });
    expect(
      calls.some((call) => call.path === '/areas-negocio' && call.organizationId === 'org-nova'),
    ).toBe(true);
  });

  it('autoriza nova área apenas na organização onde é administrador e atualiza seleção', async () => {
    const { calls } = setup();
    await screen.findByRole('heading', { name: 'Organizações e áreas' });
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar' }));
    await screen.findByRole('button', { name: 'Adicionar área' });
    fireEvent.change(screen.getByLabelText('Nome da nova área'), {
      target: { value: 'Musculação' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar área' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Musculação' })).toBeTruthy(),
    );
    expect(
      calls.find((call) => call.path === '/areas-negocio' && call.method === 'POST'),
    ).toMatchObject({ organizationId: 'org-admin', body: { nome: 'Musculação' } });
  });

  it('não envia cadastro vazio', async () => {
    const { calls } = setup();
    await screen.findByRole('heading', { name: 'Organizações e áreas' });
    fireEvent.click(screen.getByRole('button', { name: 'Criar organização' }));
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });
});
