import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PACIENTES_DEMO, estadoInicialDemo } from './clinical-demo-domain';
import {
  ConflitoDemoError, executarDemo, lerDemo,
} from './clinical-demo-persistence';

let diretorio: string;
let caminho: string;
const anamnese = {
  queixa_principal: 'Queixa exclusivamente fictícia',
  historia_condicao_atual: 'História inteiramente sintética',
  antecedentes: '',
  medicamentos_alergias: '',
  limitacoes_funcionais: 'Limitação fictícia',
  objetivos_paciente: 'Objetivos de treinamento',
  avaliacao_inicial: 'Avaliação fictícia',
};

beforeEach(async () => {
  diretorio = await mkdtemp(join(tmpdir(), 'prontuario-demo-'));
  caminho = join(diretorio, 'estado.json');
});
afterEach(async () => {
  await rm(diretorio, { recursive: true, force: true });
});

describe('persistência local de treinamento no servidor', () => {
  it('inicia com dados fictícios, grava no disco e mantém após nova leitura', async () => {
    const inicial = await lerDemo(caminho);
    expect(inicial.revisao).toBe(0);
    expect(inicial.estado).toEqual(estadoInicialDemo());

    const criado = await executarDemo({
      acao: 'criar', revisao: 0, tipo: 'ANAMNESE',
      pacienteId: PACIENTES_DEMO[2]!.id, dados: anamnese,
    }, caminho);
    expect(criado.registroId).toBeTruthy();
    expect(criado.revisao).toBe(1);

    const outraSessao = await lerDemo(caminho);
    expect(outraSessao.revisao).toBe(1);
    expect(outraSessao.estado.registros.some((r) =>
      r.pacienteId === PACIENTES_DEMO[2]!.id && r.id === criado.registroId,
    )).toBe(true);
  });

  it('preserva versões após correção, finalização e adendo entre leituras', async () => {
    const criado = await executarDemo({
      acao: 'criar', revisao: 0, pacienteId: PACIENTES_DEMO[1]!.id,
      tipo: 'ANAMNESE', dados: anamnese,
    }, caminho);
    const registroId = criado.registroId!;
    const corrigido = await executarDemo({
      acao: 'revisar', revisao: 1, registroId, versaoEsperada: 1,
      justificativa: 'Corrigindo texto exclusivamente fictício',
      dados: { ...anamnese, avaliacao_inicial: 'Avaliação revisada fictícia' },
    }, caminho);
    expect(corrigido.revisao).toBe(2);
    await executarDemo({
      acao: 'finalizar', revisao: 2, registroId, versaoEsperada: 2,
    }, caminho);
    await executarDemo({
      acao: 'revisar', revisao: 3, registroId, versaoEsperada: 3,
      justificativa: 'Complementação fictícia sem valor clínico',
      dados: anamnese,
    }, caminho);

    const persistido = await lerDemo(caminho);
    const registro = persistido.estado.registros.find((r) => r.id === registroId)!;
    expect(registro.versoes.map((v) => v.numero)).toEqual([1, 2, 3, 4]);
    expect(registro.versoes.map((v) => v.natureza)).toEqual(['INICIAL', 'CORRECAO', 'CORRECAO', 'ADENDO']);
    expect(registro.versoes[0]!.dados).toMatchObject(anamnese);
    expect(registro.versoes[3]!.estado).toBe('FINALIZADO');
  });

  it('impede que duas abas sobrescrevam a mesma revisão do servidor', async () => {
    const comando = {
      acao: 'criar', revisao: 0, pacienteId: PACIENTES_DEMO[1]!.id,
      tipo: 'ANAMNESE', dados: anamnese,
    };
    const respostas = await Promise.allSettled([
      executarDemo(comando, caminho), executarDemo(comando, caminho),
    ]);
    expect(respostas.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejeitado = respostas.find((r) => r.status === 'rejected');
    expect(rejeitado).toMatchObject({ reason: expect.any(ConflitoDemoError) });
    expect((await lerDemo(caminho)).revisao).toBe(1);
  });

  it('nega campos extras, pacientes reais e alterações sem revisão atual', async () => {
    await expect(executarDemo({
      acao: 'criar', revisao: 0, pacienteId: 'paciente-real',
      tipo: 'ANAMNESE', dados: anamnese,
    }, caminho)).rejects.toThrow();

    await expect(executarDemo({
      acao: 'criar', revisao: 0, pacienteId: PACIENTES_DEMO[0]!.id,
      tipo: 'ANAMNESE', dados: anamnese, usuarioId: 'forjado',
    }, caminho)).rejects.toThrow();

    const criado = await executarDemo({
      acao: 'criar', revisao: 0, pacienteId: PACIENTES_DEMO[0]!.id,
      tipo: 'ANAMNESE', dados: anamnese,
    }, caminho);
    await expect(executarDemo({
      acao: 'finalizar', revisao: 1, registroId: criado.registroId,
      versaoEsperada: 9,
    }, caminho)).rejects.toBeInstanceOf(ConflitoDemoError);
    expect((await lerDemo(caminho)).revisao).toBe(1);
  });

  it('reinicia o treinamento no arquivo e permanece reiniciado após recarregar', async () => {
    await executarDemo({
      acao: 'criar', revisao: 0, pacienteId: PACIENTES_DEMO[1]!.id,
      tipo: 'ANAMNESE', dados: anamnese,
    }, caminho);
    const retorno = await executarDemo({ acao: 'reiniciar', revisao: 1 }, caminho);
    expect(retorno.revisao).toBe(2);
    expect((await lerDemo(caminho)).estado).toEqual(estadoInicialDemo());
  });
});
