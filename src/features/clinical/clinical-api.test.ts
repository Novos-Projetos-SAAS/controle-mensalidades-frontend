import { afterEach, describe, expect, it, vi } from 'vitest';

import { clinicalApi } from './clinical-api';
import type { AnamneseDraft, EvolucaoDraft } from './clinical-contracts';

const org = '11111111-1111-4111-8111-111111111111';
const area = '22222222-2222-4222-8222-222222222222';
const paciente = '33333333-3333-4333-8333-333333333333';
const profissional = '44444444-4444-4444-8444-444444444444';
const documento = '55555555-5555-4555-8555-555555555555';
const ctx = { organizacaoId: org, areaId: area };

const anamnese: AnamneseDraft = {
  queixa_principal: 'Queixa ficticia',
  historia_condicao_atual: 'Historia ficticia',
  antecedentes: '',
  medicamentos_alergias: '',
  limitacoes_funcionais: 'Limitacao ficticia',
  objetivos_paciente: 'Objetivo ficticio',
  avaliacao_inicial: 'Avaliacao ficticia',
};

const evolucao: EvolucaoDraft = {
  data_sessao: '2026-11-20',
  objetivo_sessao: 'Mobilidade ficticia',
  avaliacao_previa: '',
  procedimentos_realizados: 'Treino de marcha ficticio',
  exercicios_parametros: '3 series de teste',
  resposta_paciente: 'Boa tolerancia ficticia',
  evolucao_clinica: 'Evolucao ficticia',
  orientacoes: '',
  plano_proxima_sessao: '',
};

function simularSucesso(dados: unknown) {
  const fetchMock = vi.fn(async (_url: string, _options?: RequestInit) =>
    new Response(JSON.stringify({ data: dados }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('contrato de API do prontuario protegido', () => {
  it('obtém a identidade profissional no contexto autenticado, nunca de um ID informado', async () => {
    const fetchMock = simularSucesso({ profissional_id: profissional });
    await expect(clinicalApi.minhaIdentidade(ctx)).resolves.toEqual({ profissional_id: profissional });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/v1/prontuario/identidade');
    expect(init?.headers).toMatchObject({
      'x-organizacao-id': org,
      'x-area-negocio-id': area,
    });
    expect(init?.method).toBeUndefined();
  });

  it('consulta lista paginada de pacientes vinculados, sem usar cadastro geral', async () => {
    const resposta = { items: [{ id: paciente, nome: 'Paciente fictício' }], pagina: 2, limite: 1, temMais: false };
    const fetchMock = simularSucesso(resposta);
    await expect(clinicalApi.pacientesVinculados(ctx, 2, 1)).resolves.toEqual(resposta);
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/v1/prontuario/pacientes?pagina=2&limite=1');
    expect(url).not.toContain('cpf');
    expect(() => clinicalApi.pacientesVinculados(ctx, 0)).toThrow('Paginação');
    expect(() => clinicalApi.pacientesVinculados(ctx, 1, 51)).toThrow('Paginação');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('consulta timeline com credenciais e contexto, sem texto clinico na URL', async () => {
    const fetchMock = simularSucesso([]);
    await expect(clinicalApi.timeline(ctx, paciente, 30)).resolves.toEqual([]);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`/api/v1/prontuario/pacientes/${paciente}/historico?limite=30`);
    expect(init?.credentials).toBe('same-origin');
    expect(init?.cache).toBe('no-store');
    expect(init?.headers).toMatchObject({
      'x-organizacao-id': org,
      'x-area-negocio-id': area,
    });
  });

  it('não permite tentativa de URL injection, contexto vazio nem limite fora do contrato', async () => {
    const fetchMock = simularSucesso([]);
    expect(() => clinicalApi.timeline(ctx, `${paciente}/segredo`)).toThrow('Identificador');
    expect(() => clinicalApi.timeline(ctx, paciente, 101)).toThrow('Limite');
    expect(() => clinicalApi.timeline({ ...ctx, areaId: '' }, paciente)).toThrow('Selecione');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envia anamnese com corpo completo, sem abandonar campos sensiveis em query string', async () => {
    const fetchMock = simularSucesso({ id: documento, estado: 'RASCUNHO', versao: 1 });
    await clinicalApi.criarAnamnese(ctx, paciente, anamnese);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/v1/documentos-clinicos');
    expect(init?.method).toBe('POST');
    expect(url).not.toContain(anamnese.queixa_principal);
    expect(JSON.parse(String(init?.body))).toMatchObject({
      tipo: 'ANAMNESE', cliente_id: paciente, conteudo: anamnese,
    });
  });

  it('baixa PDF autenticado por versão sem enviar identidade no corpo', async () => {
    const fetchMock = vi.fn(async (_url: string, _options?: RequestInit) => new Response(new Blob(['%PDF-1.4', 'laudo-ficticio'], {
      type: 'application/pdf',
    }), { status: 200, headers: { 'content-type': 'application/pdf' } }));
    vi.stubGlobal('fetch', fetchMock);
    const arquivo = await clinicalApi.pdfLaudo(ctx, documento, 3);
    expect(arquivo.size).toBeGreaterThan(0);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/v1/documentos-clinicos/' + documento + '/pdf?versao=3');
    expect(init).toMatchObject({
      credentials: 'same-origin', cache: 'no-store',
      headers: {
        Accept: 'application/pdf',
        'x-organizacao-id': org,
        'x-area-negocio-id': area,
      },
    });
    expect(init.method).toBeUndefined();
    expect(init.body).toBeUndefined();
  });

  it('nega PDF sem permissão e rejeita resposta que não seja PDF', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ codigo: 'ACESSO_CLINICO_NEGADO', mensagem: 'Sem vínculo' }),
      { status: 403, headers: { 'content-type': 'application/json' } },
    )));
    await expect(clinicalApi.pdfLaudo(ctx, documento, 1)).rejects.toMatchObject({
      status: 403, code: 'ACESSO_CLINICO_NEGADO',
    });
    expect(clinicalApi.pdfLaudo(ctx, documento, 0)).rejects.toThrow('Versão');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Erro de proxy', {
      status: 200, headers: { 'content-type': 'text/html' },
    })));
    await expect(clinicalApi.pdfLaudo(ctx, documento, 1)).rejects.toMatchObject({
      code: 'PDF_INVALIDO',
    });
  });

  it('revisa documento com controle de concorrência e natureza do adendo', async () => {
    const fetchMock = simularSucesso({ id: documento, estado: 'FINALIZADO', versao: 4 });
    await clinicalApi.revisarDocumento(
      ctx, documento, anamnese, 'ADENDO', 'Complementacao ficticia da avaliacao', 3,
    );
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`/api/v1/documentos-clinicos/${documento}/revisoes`);
    expect(JSON.parse(String(init?.body))).toEqual({
      conteudo: anamnese,
      natureza: 'ADENDO',
      justificativa: 'Complementacao ficticia da avaliacao',
      ultima_versao_esperada: 3,
    });
  });

  it('não inventa horário da sessão e preserva procedimentos, resposta e parâmetros', async () => {
    const fetchMock = simularSucesso({ id: documento });
    await clinicalApi.criarEvolucao(ctx, paciente, profissional, evolucao, '2026-11-20T14:30:00-03:00');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/v1/sessoes-clinicas');
    expect(JSON.parse(String(init?.body))).toMatchObject({
      cliente_id: paciente,
      profissional_id: profissional,
      data_sessao: '2026-11-20T14:30:00-03:00',
      objetivo_sessao: 'Mobilidade ficticia',
      procedimentos_realizados: 'Treino de marcha ficticio',
      exercicios_parametros: '3 series de teste',
      resposta_paciente: 'Boa tolerancia ficticia',
      evolucao: 'Evolucao ficticia',
    });
  });

  it('rejeita fuso ausente ou data divergente sem enviar ao servidor', async () => {
    const fetchMock = simularSucesso(null);
    expect(() => clinicalApi.criarEvolucao(
      ctx, paciente, profissional, evolucao, '2026-11-20T14:30:00',
    )).toThrow('hora reais');
    expect(() => clinicalApi.criarEvolucao(
      ctx, paciente, profissional, evolucao, '2026-11-21T14:30:00-03:00',
    )).toThrow('não correspondem');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('limita o payload de correção aos campos clínicos autorizados', async () => {
    const fetchMock = simularSucesso({ id: documento });
    await clinicalApi.corrigirEvolucao(ctx, documento, {
      cliente_id: 'NAO_ACEITO',
      evolucao: 'Correcao ficticia',
      procedimentos_realizados: 'Exercicios corrigidos',
    });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(String(init?.body))).toEqual({
      evolucao: 'Correcao ficticia',
      procedimentos_realizados: 'Exercicios corrigidos',
    });
  });

  it('preserva o erro de gate fechado no backend e não tenta contorna-lo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      mensagem: 'Acesso clínico ainda não configurado.',
      codigo: 'ACESSO_CLINICO_NAO_CONFIGURADO',
    }), { status: 403, headers: { 'content-type': 'application/json' } })));

    await expect(clinicalApi.timeline(ctx, paciente)).rejects.toMatchObject({
      status: 403, code: 'ACESSO_CLINICO_NAO_CONFIGURADO',
    });
  });
});
