import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ClinicalAssignmentsWorkspace } from './clinical-assignments-workspace';

const ids = vi.hoisted(() => ({
  org: '11111111-1111-4111-8111-111111111111',
  area: '22222222-2222-4222-8222-222222222222',
  paciente: '33333333-3333-4333-8333-333333333333',
  profissional: '44444444-4444-4444-8444-444444444444',
  vinculo: '55555555-5555-4555-8555-555555555555',
}));
const mocks = vi.hoisted(() => ({
  listar: vi.fn(), conceder: vi.fn(), revogar: vi.fn(), autorizarAcessoClinico: vi.fn(),
  consultarUsuarioProfissional: vi.fn(),
  clientes: vi.fn(), profissionais: vi.fn(),
}));
vi.mock('@/features/auth/session', () => ({
  useSession: () => ({
    organization: { id: ids.org, nome: 'Unidade fictícia', perfil: 'ADMINISTRADOR' },
    area: { id: ids.area, nome: 'Fisioterapia' },
    session: { usuario: { id: 'usuario-admin' } },
  }),
}));
vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/lib/api', () => ({
  clientes: mocks.clientes, profissionais: mocks.profissionais,
  ApiError: class ApiError extends Error {
    constructor(message: string, public status: number, public code?: string) { super(message); }
  },
}));
vi.mock('./clinical-assignments-api', () => ({
  vinculosClinicosApi: {
    listar: mocks.listar, conceder: mocks.conceder, revogar: mocks.revogar,
    autorizarAcessoClinico: mocks.autorizarAcessoClinico,
    consultarUsuarioProfissional: mocks.consultarUsuarioProfissional,
  },
}));

let queryClient: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.clientes.mockResolvedValue([{ id: ids.paciente, nome: 'Paciente Inteiramente Fictício' }]);
  mocks.profissionais.mockResolvedValue([{ id: ids.profissional, nome: 'Fisioterapeuta Teste' }]);
  mocks.listar.mockResolvedValue([]);
  mocks.conceder.mockResolvedValue({ id: ids.vinculo });
  mocks.autorizarAcessoClinico.mockResolvedValue({ autorizado: true });
  mocks.consultarUsuarioProfissional.mockResolvedValue({ vinculoAtivo: true, usuario: { id: 'usuario-profissional', nome: 'Teste' } });
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
});
afterEach(() => { cleanup(); queryClient.clear(); });

describe('administração de vínculos de prontuário em banco', () => {
  it('exige confirmação e permite ao administrador autorizar acesso clínico antes do vínculo', async () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);
    try {
      render(<QueryClientProvider client={queryClient}><ClinicalAssignmentsWorkspace /></QueryClientProvider>);
      await screen.findByRole('option', { name: 'Fisioterapeuta Teste' });
      fireEvent.change(screen.getByLabelText('Fisioterapeuta *'), {
        target: { value: ids.profissional },
      });
      await screen.findByText('Usuário profissional ativo confirmado.');
      fireEvent.click(screen.getByRole('button', { name: 'Autorizar acesso clínico' }));
      await waitFor(() => expect(mocks.autorizarAcessoClinico).toHaveBeenCalledOnce());
      expect(confirmar).toHaveBeenCalledOnce();
      expect(mocks.autorizarAcessoClinico).toHaveBeenCalledWith(
        { organizacaoId: ids.org, areaId: ids.area }, ids.profissional,
      );
      expect(await screen.findByText('Acesso clínico autorizado.', { exact: false })).toBeTruthy();
    } finally {
      confirmar.mockRestore();
    }
  });

  it('não autoriza acesso clínico sem confirmação do administrador', async () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    try {
      render(<QueryClientProvider client={queryClient}><ClinicalAssignmentsWorkspace /></QueryClientProvider>);
      await screen.findByRole('option', { name: 'Fisioterapeuta Teste' });
      fireEvent.change(screen.getByLabelText('Fisioterapeuta *'), {
        target: { value: ids.profissional },
      });
      await screen.findByText('Usuário profissional ativo confirmado.');
      fireEvent.click(screen.getByRole('button', { name: 'Autorizar acesso clínico' }));
      expect(mocks.autorizarAcessoClinico).not.toHaveBeenCalled();
    } finally {
      confirmar.mockRestore();
    }
  });

  it('não libera acesso clínico quando profissional não possui usuário ativo', async () => {
    mocks.consultarUsuarioProfissional.mockResolvedValue({ vinculoAtivo: false, usuario: null });
    render(<QueryClientProvider client={queryClient}><ClinicalAssignmentsWorkspace /></QueryClientProvider>);
    await screen.findByRole('option', { name: 'Fisioterapeuta Teste' });
    fireEvent.change(screen.getByLabelText('Fisioterapeuta *'), {
      target: { value: ids.profissional },
    });
    expect(await screen.findByText('Este profissional não possui um usuário ativo vinculado à organização.', { exact: false })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Autorizar acesso clínico' }).hasAttribute('disabled')).toBe(true);
    expect(mocks.autorizarAcessoClinico).not.toHaveBeenCalled();
  });

  it('consulta cadastros e concede vínculo usando organização/área autenticadas', async () => {
    render(<QueryClientProvider client={queryClient}><ClinicalAssignmentsWorkspace /></QueryClientProvider>);
    const paciente = await screen.findByRole('option', { name: 'Paciente Inteiramente Fictício' });
    expect(paciente).toBeTruthy();
    await screen.findByRole('option', { name: 'Fisioterapeuta Teste' });

    fireEvent.change(screen.getByLabelText('Paciente cadastrado *'), {
      target: { value: ids.paciente },
    });
    fireEvent.change(screen.getByLabelText('Fisioterapeuta *'), {
      target: { value: ids.profissional },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Conceder vínculo' }));
    await waitFor(() => expect(mocks.conceder).toHaveBeenCalledOnce());
    expect(mocks.conceder).toHaveBeenCalledWith(
      { organizacaoId: ids.org, areaId: ids.area }, ids.paciente, ids.profissional,
    );
    expect(await screen.findByText('Vínculo registrado no banco.', { exact: false })).toBeTruthy();
  });
});
