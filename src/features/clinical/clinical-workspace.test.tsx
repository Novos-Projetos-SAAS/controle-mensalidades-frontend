import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ApiError } from '@/lib/api';
import { ClinicalWorkspace } from './clinical-workspace';

const ids = vi.hoisted(() => ({
  org: '11111111-1111-4111-8111-111111111111',
  area: '22222222-2222-4222-8222-222222222222',
  paciente: '33333333-3333-4333-8333-333333333333',
  profissional: '44444444-4444-4444-8444-444444444444',
  anamnese: '55555555-5555-4555-8555-555555555555',
}));

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
  corrigirEvolucao: vi.fn(),
  historicoCorrecoes: vi.fn(),
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
  apiMock.corrigirEvolucao.mockResolvedValue({ id: ids.anamnese });
  apiMock.historicoCorrecoes.mockResolvedValue([]);
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

  it('apresenta evolução clínica legível, sem ids, colunas do banco ou horários UTC crus', async () => {
    apiMock.timeline.mockResolvedValue([{
      id: ids.anamnese, tipo: 'EVOLUCAO', paciente_id: ids.paciente,
      data: '2026-11-26T00:59:00.000Z', profissional_id: ids.profissional,
      profissional_nome: 'Profissional fictício', titulo: 'Evolução da sessão',
      versao: null, estado: null,
    }]);
    apiMock.consultarEvolucao.mockResolvedValue({
      id: ids.anamnese,
      cliente_id: ids.paciente,
      cliente_nome: 'Paciente Teste A',
      profissional_id: ids.profissional,
      profissional_nome: 'Profissional fictício',
      data_sessao: '2026-11-26T00:59:00.000Z',
      agendamento_id: null,
      corrigido_em: null,
      corrigido_por_usuario_id: null,
      objetivo_sessao: 'Mobilidade',
      avaliacao_previa: 'Rigidez',
      procedimentos_realizados: 'Alongamentos',
      exercicios_parametros: '3 séries',
      resposta_paciente: 'Boa resposta',
      evolucao: 'Mobilidade melhorou',
      prognostico: null,
      plano_terapeutico: null,
      orientacoes: null,
    });
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Paciente Teste A' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Consultar registro' }));
    expect(await screen.findByText('Alongamentos')).toBeTruthy();
    expect(screen.getByText('O que foi trabalhado na sessão')).toBeTruthy();
    expect(screen.getByText('Data e hora da sessão (Brasília)')).toBeTruthy();
    expect(screen.getAllByText(/25\/11\/2026/).length).toBeGreaterThan(0);
    expect(screen.queryByText('agendamento_id')).toBeNull();
    expect(screen.queryByText('corrigido_por_usuario_id')).toBeNull();
    expect(screen.queryByText(ids.anamnese)).toBeNull();
    expect(screen.queryByText('2026-11-26T00:59:00.000Z')).toBeNull();
    expect(screen.queryByText('Não informado')).toBeNull();
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

  it('permite evolução em data posterior à avaliação com um único campo de data/hora', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Paciente Teste A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nova evolução' }));
    expect(screen.queryByLabelText('Data da sessão *')).toBeNull();

    const campos = [
      ['Objetivo da sessão *', 'Mobilidade fictícia'],
      ['O que foi trabalhado na sessão *', 'Treino de marcha fictício'],
      ['Resposta e tolerância do paciente *', 'Boa tolerância fictícia'],
      ['Evolução clínica observada *', 'Evolução fictícia'],
      ['Diagnóstico fisioterapêutico', 'Diagnóstico funcional fictício'],
      ['Prognóstico fisioterapêutico', 'Boa evolução sintética'],
      ['Plano terapêutico', 'Plano de marcha sintético'],
      ['Observações clínicas', 'Sem intercorrências simuladas'],
    ] as const;
    for (const [rotulo, valor] of campos) {
      fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Salvar evolução na homologação' }));
    expect(apiMock.criarEvolucao).not.toHaveBeenCalled();

    // Avaliação simulada em 21/11; evolução realizada em 22/11.
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
      expect.objectContaining({
        data_sessao: '2026-11-22',
        procedimentos_realizados: 'Treino de marcha fictício',
        diagnostico_fisioterapeutico: 'Diagnóstico funcional fictício',
        prognostico: 'Boa evolução sintética',
        plano_terapeutico: 'Plano de marcha sintético',
        observacoes: 'Sem intercorrências simuladas',
      }),
      '2026-11-22T14:30:00-03:00',
    );
  });

  it('impede registrar atendimento ainda futuro com mensagem compreensível', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Paciente Teste A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nova evolução' }));
    fireEvent.change(screen.getByLabelText('Data e hora do atendimento *'), {
      target: { value: '2099-12-30T14:30' },
    });
    fireEvent.change(screen.getByLabelText('Fuso horário *'), {
      target: { value: '-03:00' },
    });
    const campos = [
      ['Objetivo da sessão *', 'Mobilidade fictícia'],
      ['O que foi trabalhado na sessão *', 'Treino fictício'],
      ['Resposta e tolerância do paciente *', 'Boa tolerância fictícia'],
      ['Evolução clínica observada *', 'Evolução fictícia'],
    ] as const;
    for (const [rotulo, valor] of campos) {
      fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Salvar evolução na homologação' }));
    expect(await screen.findByText('A evolução só pode ser registrada após o atendimento.', { exact: false })).toBeTruthy();
    expect(apiMock.criarEvolucao).not.toHaveBeenCalled();
  });

  it('consulta o histórico persistido pelo backend após desmontar e abrir uma sessão nova', async () => {
    let gravado = false;
    apiMock.timeline.mockImplementation(async () => gravado ? [{
      id: ids.anamnese, tipo: 'ANAMNESE', paciente_id: ids.paciente,
      data: '2026-11-25T15:00:00.000Z', profissional_id: ids.profissional,
      profissional_nome: 'Profissional fictício', titulo: 'Anamnese e avaliação inicial',
      versao: 1, estado: 'RASCUNHO',
    }] : []);
    apiMock.criarAnamnese.mockImplementation(async () => {
      gravado = true;
      return { id: ids.anamnese, versao: 1, estado: 'RASCUNHO' };
    });

    const primeira = montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Paciente Teste A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nova anamnese' }));
    const campos = [
      ['Queixa principal *', 'Queixa sintética de reabertura'],
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
    await waitFor(() => expect(screen.getByText('Anamnese registrada no banco de homologação.')).toBeTruthy());

    primeira.unmount();
    client.clear();
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Paciente Teste A' }));
    expect(await screen.findByText('Anamnese e avaliação inicial')).toBeTruthy();
    expect(apiMock.timeline.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(gravado).toBe(true);
  });


  it('mostra histórico de correções e permite corrigir a evolução mantendo data e identidade', async () => {
    apiMock.timeline.mockResolvedValue([{
      id: ids.anamnese, tipo: 'EVOLUCAO', paciente_id: ids.paciente,
      data: '2026-11-22T17:30:00.000Z', profissional_id: ids.profissional,
      profissional_nome: 'Profissional fictício', titulo: 'Evolução da sessão',
      versao: null, estado: null,
    }]);
    apiMock.consultarEvolucao.mockResolvedValue({
      id: ids.anamnese, cliente_id: ids.paciente, profissional_id: ids.profissional,
      cliente_nome: 'Paciente Teste A', profissional_nome: 'Profissional fictício',
      data_sessao: '2026-11-22T17:30:00.000Z', corrigido_em: null,
      evolucao: 'Evolução fictícia anterior',
      objetivo_sessao: 'Mobilidade',
      avaliacao_previa: null, procedimentos_realizados: 'Alongamentos',
      exercicios_parametros: null, resposta_paciente: 'Boa tolerância',
      orientacoes: null, plano_proxima_sessao: null,
      diagnostico_fisioterapeutico: null, prognostico: null,
      plano_terapeutico: null, observacoes: null,
    });
    apiMock.historicoCorrecoes.mockResolvedValue([{
      sessao_clinica_id: ids.anamnese,
      corrigido_por_usuario_id: 'usuario-teste',
      campos_alterados: ['procedimentos_realizados'],
      dados_anteriores: { procedimentos_realizados: 'Mobilidade inicial' },
      dados_novos: { procedimentos_realizados: 'Alongamentos' },
      criado_em: '2026-11-23T14:00:00.000Z',
    }]);
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Paciente Teste A' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Consultar registro' }));
    expect(await screen.findByText('Correções e histórico da evolução')).toBeTruthy();
    expect(await screen.findByText('Antes: Mobilidade inicial')).toBeTruthy();
    expect(screen.getByText('Depois: Alongamentos')).toBeTruthy();
    expect(apiMock.historicoCorrecoes).toHaveBeenCalledWith(
      { organizacaoId: ids.org, areaId: ids.area }, ids.anamnese,
    );
    expect(screen.queryByText('corrigido_por_usuario_id')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Corrigir evolução' }));
    expect(screen.queryByLabelText('Data e hora do atendimento *')).toBeNull();
    fireEvent.change(screen.getByLabelText('O que foi trabalhado na sessão'), {
      target: { value: 'Treino de marcha revisado' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar correção auditada' }));
    await waitFor(() => expect(apiMock.corrigirEvolucao).toHaveBeenCalledOnce());
    expect(apiMock.corrigirEvolucao).toHaveBeenCalledWith(
      { organizacaoId: ids.org, areaId: ids.area }, ids.anamnese,
      { procedimentos_realizados: 'Treino de marcha revisado' },
    );
    expect(screen.getByText('Correção registrada no histórico clínico.')).toBeTruthy();
  });

  it('não envia uma correção vazia ao backend', async () => {
    apiMock.timeline.mockResolvedValue([{
      id: ids.anamnese, tipo: 'EVOLUCAO', paciente_id: ids.paciente,
      data: '2026-11-22T17:30:00.000Z', profissional_id: ids.profissional,
      profissional_nome: 'Profissional fictício', titulo: 'Evolução da sessão',
      versao: null, estado: null,
    }]);
    apiMock.consultarEvolucao.mockResolvedValue({
      id: ids.anamnese, cliente_id: ids.paciente, profissional_id: ids.profissional,
      cliente_nome: 'Paciente Teste A', profissional_nome: 'Profissional fictício',
      data_sessao: '2026-11-22T17:30:00.000Z',
      evolucao: 'Evolução fictícia', objetivo_sessao: 'Mobilidade',
      procedimentos_realizados: 'Alongamentos', resposta_paciente: 'Boa tolerância',
    });
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Paciente Teste A' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Consultar registro' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Corrigir evolução' }));
    fireEvent.click(screen.getByRole('button', { name: 'Registrar correção auditada' }));
    expect(await screen.findByText('Altere pelo menos um campo para registrar uma correção.')).toBeTruthy();
    expect(apiMock.corrigirEvolucao).not.toHaveBeenCalled();
  });

  it('carrega páginas adicionais da linha do tempo sem perder registros anteriores', async () => {
    const paginaInicial = Array.from({ length: 50 }, (_, indice) => ({
      id: `00000000-0000-4000-8000-${String(indice + 1).padStart(12, '0')}`,
      tipo: 'EVOLUCAO',
      paciente_id: ids.paciente, profissional_id: ids.profissional,
      profissional_nome: 'Profissional fictício',
      data: '2026-11-25T14:00:00.000Z',
      titulo: `Sessão fictícia ${indice + 1}`,
      versao: null, estado: null,
    }));
    const registroAntigo = [{
      id: ids.anamnese, tipo: 'LAUDO', paciente_id: ids.paciente,
      profissional_id: ids.profissional, profissional_nome: 'Profissional fictício',
      data: '2026-11-20T14:00:00.000Z', titulo: 'Laudo histórico nº 51',
      versao: 1, estado: 'FINALIZADO',
    }];
    apiMock.timeline.mockImplementation(async (_ctx, _id, _limite, deslocamento = 0) =>
      deslocamento === 0 ? paginaInicial : registroAntigo);
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Paciente Teste A' }));
    expect(await screen.findByText('Sessão fictícia 1')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Carregar registros anteriores' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Carregar registros anteriores' }));
    expect(await screen.findByText('Laudo histórico nº 51')).toBeTruthy();
    expect(screen.getByText('Sessão fictícia 1')).toBeTruthy();
    expect(apiMock.timeline).toHaveBeenCalledWith(
      { organizacaoId: ids.org, areaId: ids.area }, ids.paciente, 50, 50,
    );
    expect(screen.queryByRole('button', { name: 'Carregar registros anteriores' })).toBeNull();
  });
});
