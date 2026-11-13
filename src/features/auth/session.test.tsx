import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider, useSession } from './session';
import { AppShell } from '@/components/app-shell';
import { ApiError, areas, login, logout, me } from '@/lib/api';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }), usePathname: () => '/' }));
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  me: vi.fn(),
  areas: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));

const session = {
  usuario: { id: 'u1', nome: 'Usuário de Teste', email: 'user@example.com' },
  organizacoes: [
    { id: 'org-a', nome: 'Organização A', perfil: 'ADMINISTRADOR' },
    { id: 'org-b', nome: 'Organização B', perfil: 'OPERADOR' },
  ],
};
function Controls() {
  const value = useSession();
  return (
    <>
      <span data-testid="loading">{value.loading ? 'loading' : 'ready'}</span>
      <span data-testid="organization">{value.organization?.nome || 'sem organização'}</span>
      <span data-testid="area">{value.area?.nome || 'sem área'}</span>
      <button onClick={() => value.selectOrganization('org-b')}>Trocar organização</button>
      <button onClick={() => value.selectArea('area-2')}>Trocar área</button>
      <button onClick={() => value.signOut()}>Sair</button>
      <button onClick={() => value.signIn('user@example.com', 'senha')}>Entrar</button>
    </>
  );
}
function setup(children: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <SessionProvider>{children}</SessionProvider>
    </QueryClientProvider>,
  );
  return queryClient;
}
beforeEach(() => {
  replace.mockReset();
  vi.mocked(me).mockReset();
  vi.mocked(areas).mockReset();
  vi.mocked(login).mockReset();
  vi.mocked(logout).mockReset();
});
afterEach(cleanup);
describe('sessão e contexto', () => {
  it('impede conteúdo privado sem autenticação e redireciona para login', async () => {
    vi.mocked(me).mockRejectedValue(new ApiError('Autenticação necessária.', 401));
    setup(
      <AppShell>
        <div>conteúdo privado</div>
      </AppShell>,
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(screen.queryByText('conteúdo privado')).toBeNull();
  });
  it('isola o cache ao trocar organização e área e limpa a sessão no logout', async () => {
    vi.mocked(me).mockResolvedValue(session);
    vi.mocked(areas).mockImplementation(async (orgId) =>
      orgId === 'org-a'
        ? [
            { id: 'area-1', nome: 'Área A' },
            { id: 'area-2', nome: 'Área A2' },
          ]
        : [{ id: 'area-3', nome: 'Área B' }],
    );
    vi.mocked(logout).mockResolvedValue(null);
    const cache = setup(<Controls />);
    await screen.findByText('Organização A');
    await screen.findByText('Área A');
    cache.setQueryData(['clientes', 'org-a'], [{ id: 'private' }]);
    fireEvent.click(screen.getByText('Trocar área'));
    expect(cache.getQueryData(['clientes', 'org-a'])).toBeUndefined();
    expect(screen.getByTestId('area').textContent).toBe('Área A2');
    cache.setQueryData(['clientes', 'org-a'], [{ id: 'private' }]);
    fireEvent.click(screen.getByText('Trocar organização'));
    await screen.findByText('Organização B');
    await screen.findByText('Área B');
    expect(cache.getQueryData(['clientes', 'org-a'])).toBeUndefined();
    await act(async () => fireEvent.click(screen.getByText('Sair')));
    expect(vi.mocked(logout)).toHaveBeenCalledOnce();
    expect(screen.getByTestId('organization').textContent).toBe('sem organização');
  });
  it('aceita login válido e atualiza o contexto', async () => {
    vi.mocked(me).mockRejectedValue(new ApiError('Autenticação necessária.', 401));
    vi.mocked(login).mockResolvedValue(session);
    vi.mocked(areas).mockResolvedValue([{ id: 'area-1', nome: 'Área A' }]);
    setup(<Controls />);
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('ready'));
    await act(async () => fireEvent.click(screen.getByText('Entrar')));
    await screen.findByText('Organização A');
    expect(vi.mocked(login)).toHaveBeenCalledWith('user@example.com', 'senha');
  });
});
