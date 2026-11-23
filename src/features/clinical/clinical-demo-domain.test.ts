import { describe, expect, it } from 'vitest';
import {
  PACIENTES_DEMO, estadoInicialDemo, novaEntrada,
  revisarEntrada, finalizarEntrada, resumoPaciente, ultimaVersao,
} from './clinical-demo-domain';
import { anamneseSchema, evolucaoSchema, laudoSchema } from './clinical-contracts';

const paciente = PACIENTES_DEMO[1]!.id;
const momento = '2026-11-22T14:00:00.000Z';

const anamnese = anamneseSchema.parse({
  queixa_principal: 'Queixa fictícia',
  historia_condicao_atual: 'Histórico fictício',
  limitacoes_funcionais: 'Limitações fictícias',
  objetivos_paciente: 'Objetivo fictício',
  avaliacao_inicial: 'Avaliação fictícia',
});
const evolucao = evolucaoSchema.parse({
  data_sessao: '2026-11-22',
  objetivo_sessao: 'Objetivo fictício',
  procedimentos_realizados: 'Mobilidade e treino funcional fictícios',
  resposta_paciente: 'Resposta fictícia',
  evolucao_clinica: 'Evolução fictícia',
});
const laudo = laudoSchema.parse({
  finalidade: 'Avaliação fictícia',
  fundamentacao_avaliacao: 'Fundamentação fictícia',
  achados_funcionais: 'Achados fictícios',
  diagnostico_fisioterapeutico: 'Diagnóstico fictício',
  conclusao: 'Conclusão fictícia',
});

describe('simulador isolado do prontuário da fisioterapeuta', () => {
  it('nasce apenas com pacientes e histórico sintéticos', () => {
    const inicial = estadoInicialDemo();
    expect(PACIENTES_DEMO).toHaveLength(3);
    expect(inicial.registros).toHaveLength(2);
    expect(inicial.registros.every((r) => r.pacienteId === PACIENTES_DEMO[0]!.id)).toBe(true);
    expect(resumoPaciente(inicial, PACIENTES_DEMO[2]!.id)).toEqual([]);
    expect(resumoPaciente(inicial, PACIENTES_DEMO[0]!.id)[0]?.tipo).toBe('EVOLUCAO');
  });

  it('cria e valida anamnese e laudo sem sobrescrever o histórico existente', () => {
    const original = estadoInicialDemo();
    const comAnamnese = novaEntrada(original, paciente, 'ANAMNESE', anamnese, 'novo-1', momento);
    const comLaudo = novaEntrada(comAnamnese, paciente, 'LAUDO', laudo, 'novo-2', momento);
    expect(original.registros).toHaveLength(2);
    expect(comLaudo.registros).toHaveLength(4);
    expect(resumoPaciente(comLaudo, paciente).map((x) => x.tipo).sort()).toEqual(['ANAMNESE', 'LAUDO']);
    expect(ultimaVersao(comLaudo.registros.at(-1)!).estado).toBe('RASCUNHO');
    expect(() => novaEntrada(comLaudo, paciente, 'LAUDO', laudo, 'novo-2', momento)).toThrow();
  });

  it('registra sessão com o que foi trabalhado sem descartar parâmetros', () => {
    const proximo = novaEntrada(estadoInicialDemo(), paciente, 'EVOLUCAO', evolucao, 'sessao-1', momento);
    const registro = proximo.registros.find((r) => r.id === 'sessao-1')!;
    expect(ultimaVersao(registro).dados).toMatchObject({
      procedimentos_realizados: 'Mobilidade e treino funcional fictícios',
      data_sessao: '2026-11-22',
    });
    expect(() => novaEntrada(proximo, paciente, 'EVOLUCAO', {} as typeof evolucao, 'sessao-2', momento)).toThrow();
  });

  it('preserva correção, finalização e adendo como versões sequenciais e distintas', () => {
    const inicial = novaEntrada(estadoInicialDemo(), paciente, 'ANAMNESE', anamnese, 'anamnese-1', momento);
    const corrigida = revisarEntrada(inicial, 'anamnese-1', {
      ...anamnese, queixa_principal: 'Queixa revisada fictícia',
    }, 'Ajustar relato inicial fictício', '2026-11-22T14:01:00Z');
    const finalizada = finalizarEntrada(corrigida, 'anamnese-1', '2026-11-22T14:02:00Z');
    const adendada = revisarEntrada(finalizada, 'anamnese-1', anamnese,
      'Adendo complementar fictício', '2026-11-22T14:03:00Z');
    const versoes = adendada.registros.find((r) => r.id === 'anamnese-1')!.versoes;
    expect(versoes.map((v) => v.numero)).toEqual([1, 2, 3, 4]);
    expect(versoes.map((v) => v.natureza)).toEqual(['INICIAL', 'CORRECAO', 'CORRECAO', 'ADENDO']);
    expect(versoes[0]!.dados).toEqual(anamnese);
    expect(versoes[1]!.dados).toMatchObject({ queixa_principal: 'Queixa revisada fictícia' });
    expect(versoes[3]!.estado).toBe('FINALIZADO');
    expect(ultimaVersao(inicial.registros.find((r) => r.id === 'anamnese-1')!).numero).toBe(1);
    expect(() => finalizarEntrada(adendada, 'anamnese-1', momento)).toThrow();
  });

  it('recusa paciente, ID, data, revisão ou justificativa inválidos', () => {
    expect(() => novaEntrada(estadoInicialDemo(), 'paciente-real', 'LAUDO', laudo, 'id', momento)).toThrow();
    expect(() => novaEntrada(estadoInicialDemo(), paciente, 'LAUDO', laudo, 'id', 'invalida')).toThrow();
    expect(() => revisarEntrada(estadoInicialDemo(), 'inexistente', anamnese, 'Justificativa válida', momento)).toThrow();
    const inicial = novaEntrada(estadoInicialDemo(), paciente, 'ANAMNESE', anamnese, 'id', momento);
    expect(() => revisarEntrada(inicial, 'id', anamnese, 'curta', momento)).toThrow();
  });
});
