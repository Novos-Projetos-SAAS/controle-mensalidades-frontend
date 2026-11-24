import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ApiError } from '@/lib/api';
import { ClinicalWorkspace } from './clinical-workspace';

const ids = {
  org: '11111111-1111-4111-8111-111111111111',
  area: '22222222-2222-4222-8222-222222222222',
  paciente: '33333333-3333-4333-8333-333333333333',
  profissional: '44444444-4444-4444-8444-444444444444',
  anamnese: '55555555-5555-4555-8555-555555555555',
};

const apiMock = vi.hoisted(() => ({
  minhaIdentidade: vi.fn(),
  pacientesVinculados: vi.fn(),
  timeline: vi.fn(),
  consultarDocumento: vi.fn(),
  consultarEvolucao: vi.fn(),
  criarAnamnese: vi.fn(),
  criarLaudo: vi.fn(),
  criarEvolucao: vi.fn(),
  revisarDocumento: vi.fn(),
  finalizarDocumento: vi.fn(),
}));

vi.mock('@/features/auth/session', () => ({
  useSession: () => ({
    session: { usuario: { id: 'usuario-teste', nome: 'Profissional fictício' } },
    organization: { id: ids.org, nome: 'Organização fictícia', perfil: 'OPERADOR' },
    area: { id: ids.area, nome: 'Fisioterapia' },
  }),
}));

vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('./clinical-api', () => ({ clinicalApi: apiMock }));

const conteudo = {
  queixa_principal: 'Queixa fictícia',
  historia_condicao_atual: 'História fictícia',
  antecedentes: '',
  medicamentos_alergias: '',
  limitacoes_funcionais: 'Limitações fictícias',
  objetivos_paciente: 'Objetivos fictícios',
  avaliacao_inicial: 'Avaliação fictícia',
};

let client: QueryClient;
function montar() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><ClinicalWorkspace /></QueryClientProvider>);
}
beforeEach(() => {
  vi.clearAllMocks();
  apiMock.minhaIdentidade.mockResolvedValue({ profissional_id: ids.profissional });
  apiMock.pacientesVinculados.mockResolvedValue({
    items: [{ id: ids.paciente, nome: 'Paciente Teste A' }],
    pagina: 1, limite: 20, temMais: false,
  });
  apiMock.timeline.mockResolvedValue([{
    id: ids.anamnese, tipo: 'ANAMNESE', paciente_id: ids.paciente,
    data: '2026-11-21T14:00:00.000Z', profissional_id: ids.profissional,
    profissional_nome: 'Profissional fictício', titulo: 'Anamnese e avaliação inicial',
    versao: 1, estado: 'RASCUNHO',
  }]);
  apiMock.consultarDocumento.mockResolvedValue({
    registro: {
      id: ids.anamnese, cliente_id: ids.paciente, profissional_id: ids.profissional,
      organizacao_id: ids.org, area_negocio_id: ids.area, tipo: 'ANAMNESE',
    },
    versoes: [{
      id: 'versao-ficticia', registro_id: ids.anamnese, autor_usuario_id: 'usuario-teste',
      versao: 1, natureza: 'INICIAL', estado: 'RASCUNHO',
      conteudo, justificativa: null, registrado_em: '2026-11-21T14:00:00.000Z',
    }],
  });
  apiMock.criarAnamnese.mockResolvedValue({ id: ids.anamnese, versao: 1 });
  apiMock.criarEvolucao.mockResolvedValue({ id: 'sessao-sintetica' });
});
afterEach(() => {
  cleanup();
  client?.clear();
});

describe('área clínica autenticada em homologação', () => {
  it('mostra somente pacientes da API clínica e histórico do paciente selecionado', async () => {
    montar();
    expect(await screen.findByText('Paciente Teste A')).toBeTruthy();
    expect(apiMock.pacientesVinculados).toHaveBeenCalledWith(
      { organizacaoId: ids.org, areaId: ids.area }, 1, 20,
    );
    expect(apiMock.minhaIdentidade).toHaveBeenCalledWith({
      organizacaoId: ids.org, areaId: ids.area,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Paciente Teste A' }));
    expect(await screen.findByText('Anamnese e avaliação inicial')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Consultar registro' }));
    expect(await screen.findByText('Queixa fictícia')).toBeTruthy();
    expect(apiMock.consultarDocumento).toHaveBeenCalledWith(
      { organizacaoId: ids.org, areaId: ids.area }, ids.anamnese,
    );
  });

  it('não usa simulador nem cadastro geral ao receber gate 403 da API', async () => {
    apiMock.pacientesVinculados.mockRejectedValue(new ApiError('Acesso clínico bloqueado.', 403, 'ACESSO_CLINICO_NAO_CONFIGURADO'));
    montar();
    expect(await screen.findByText('Acesso clínico não autorizado.', { exact: false })).toBeTruthy();
    expect(screen.queryByText('Paciente Teste A')).toBeNull();
    expect(apiMock.timeline).not.toHaveBeenCalled();
    expect(apiMock.criarAnamnese).not.toHaveBeenCalled();
  });

  it('valida anamnese e envia ao backend autenticado, sem dados na URL', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Paciente Teste A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nova anamnese' }));
    const campos = [
      ['Queixa principal *', 'Queixa sintética para homologação'],
      ['História da condição atual *', 'História fictícia'],
      ['Limitações funcionais *', 'Limitações fictícias'],
      ['Objetivos do paciente *', 'Objetivos fictícios'],
      ['Avaliação inicial do fisioterapeuta *', 'Avaliação fictícia'],
    ] as const;
    for (const [rotulo, valor] of campos) {
      fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Salvar anamnese na homologação' }));
    await waitFor(() => expect(apiMock.criarAnamnese).toHaveBeenCalledOnce());
    expect(apiMock.criarAnamnese).toHaveBeenCalledWith(
      { organizacaoId: ids.org, areaId: ids.area }, ids.paciente,
      expect.objectContaining({ queixa_principal: 'Queixa sintética para homologação' }),
    );
  });

  it('exige hora e fuso explícitos e usa a identidade da sessão ao criar evolução', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Paciente Teste A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nova evolução' }));
    const campos = [
      ['Data da sessão *', '2026-11-22'],
      ['Objetivo da sessão *', 'Mobilidade fictícia'],
      ['O que foi trabalhado na sessão *', 'Treino de marcha fictício'],
      ['Resposta e tolerância do paciente *', 'Boa tolerância fictícia'],
      ['Evolução clínica observada *', 'Evolução fictícia'],
    ] as const;
    for (const [rotulo, valor] of campos) {
      fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Salvar evolução na homologação' }));
    expect(await screen.findByText('Informe horário, fuso e aguarde a identificação profissional autenticada.')).toBeTruthy();
    expect(apiMock.criarEvolucao).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Data e hora do atendimento *'), {
      target: { value: '2026-11-22T14:30' },
    });
    fireEvent.change(screen.getByLabelText('Fuso horário *'), {
      target: { value: '-03:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar evolução na homologação' }));
    await waitFor(() => expect(apiMock.criarEvolucao).toHaveBeenCalledOnce());
    expect(apiMock.criarEvolucao).toHaveBeenCalledWith(
      { organizacaoId: ids.org, areaId: ids.area },
      ids.paciente, ids.profissional,
      expect.objectContaining({ procedimentos_realizados: 'Treino de marcha fictício' }),
      '2026-11-22T14:30:00-03:00',
    );
  });
});
