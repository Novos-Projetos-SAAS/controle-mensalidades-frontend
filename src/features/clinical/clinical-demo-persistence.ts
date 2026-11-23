/**
 * Persistencia EXCLUSIVA da simulacao de fisioterapia.
 *
 * Nunca usar para pacientes reais. O estado eh gravado no disco do servidor
 * Next.js local, nao em localStorage, sessionStorage, Neon ou banco clinico.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { z } from 'zod';

import { anamneseSchema, evolucaoSchema, laudoSchema } from './clinical-contracts';
import {
  PACIENTES_DEMO, estadoInicialDemo, finalizarEntrada, novaEntrada,
  revisarEntrada, ultimaVersao, type DadosClinicos, type EstadoDemo,
  type TipoRegistro,
} from './clinical-demo-domain';

const versaoSchema = z.object({
  numero: z.number().int().positive(),
  registradaEm: z.string().datetime({ offset: true }),
  autor: z.string().min(1).max(100),
  natureza: z.enum(['INICIAL', 'CORRECAO', 'ADENDO']),
  estado: z.enum(['RASCUNHO', 'FINALIZADO']),
  justificativa: z.string().max(1000),
  dados: z.union([anamneseSchema, evolucaoSchema, laudoSchema]),
}).strict();

const registroSchema = z.object({
  id: z.string().min(1).max(100),
  pacienteId: z.enum([
    'paciente-ficticio-1', 'paciente-ficticio-2', 'paciente-ficticio-3',
  ]),
  tipo: z.enum(['ANAMNESE', 'EVOLUCAO', 'LAUDO']),
  versoes: z.array(versaoSchema).min(1).max(100),
}).strict();

const arquivoSchema = z.object({
  revisao: z.number().int().nonnegative(),
  estado: z.object({ registros: z.array(registroSchema).max(300) }).strict(),
}).strict();

const dadosSchema = z.union([anamneseSchema, evolucaoSchema, laudoSchema]);
const comandoSchema = z.discriminatedUnion('acao', [
  z.object({
    acao: z.literal('criar'),
    revisao: z.number().int().nonnegative(),
    pacienteId: z.enum(['paciente-ficticio-1', 'paciente-ficticio-2', 'paciente-ficticio-3']),
    tipo: z.enum(['ANAMNESE', 'EVOLUCAO', 'LAUDO']),
    dados: dadosSchema,
  }).strict(),
  z.object({
    acao: z.literal('revisar'),
    revisao: z.number().int().nonnegative(),
    registroId: z.string().min(1).max(100),
    versaoEsperada: z.number().int().positive(),
    dados: dadosSchema,
    justificativa: z.string().trim().min(10).max(1000),
  }).strict(),
  z.object({
    acao: z.literal('finalizar'),
    revisao: z.number().int().nonnegative(),
    registroId: z.string().min(1).max(100),
    versaoEsperada: z.number().int().positive(),
  }).strict(),
  z.object({
    acao: z.literal('reiniciar'),
    revisao: z.number().int().nonnegative(),
  }).strict(),
]);

export type ComandoDemo = z.infer<typeof comandoSchema>;
export type SnapshotDemo = { revisao: number; estado: EstadoDemo };
export type ResultadoDemo = SnapshotDemo & { registroId: string | null };

export class ConflitoDemoError extends Error {
  constructor() {
    super('Os dados de demonstração foram modificados em outra aba. Atualize a página antes de continuar.');
  }
}

function validarArquivo(json: unknown): SnapshotDemo {
  const arquivo = arquivoSchema.parse(json);
  const ids = new Set<string>();
  for (const registro of arquivo.estado.registros) {
    if (!PACIENTES_DEMO.some((p) => p.id === registro.pacienteId)) {
      throw new Error('Paciente fictício desconhecido.');
    }
    if (ids.has(registro.id)) throw new Error('Registro de treinamento duplicado.');
    ids.add(registro.id);
    const validator = registro.tipo === 'ANAMNESE' ? anamneseSchema
      : registro.tipo === 'EVOLUCAO' ? evolucaoSchema : laudoSchema;
    let anteriorFinalizado = false;
    registro.versoes.forEach((v, i) => {
      if (v.numero !== i + 1 || !validator.safeParse(v.dados).success) {
        throw new Error('Versões do treinamento inválidas.');
      }
      if (i === 0 && (v.natureza !== 'INICIAL' || v.estado !== 'RASCUNHO')) {
        throw new Error('Primeira versão inválida.');
      }
      if (i > 0) {
        if (v.natureza === 'INICIAL') throw new Error('Versão inicial repetida.');
        if (anteriorFinalizado && (v.natureza !== 'ADENDO' || v.estado !== 'FINALIZADO')) {
          throw new Error('Histórico de adendos inconsistente.');
        }
        if (!anteriorFinalizado && v.natureza === 'ADENDO') {
          throw new Error('Adendo antes da finalização.');
        }
      }
      anteriorFinalizado = v.estado === 'FINALIZADO';
    });
  }
  return arquivo as SnapshotDemo;
}

function valorPadrao(): SnapshotDemo {
  return { revisao: 0, estado: estadoInicialDemo() };
}

// Um servidor de desenvolvimento compartilha uma fila de gravacoes.
// O contador e conferido *dentro* da fila para impedir sobrescrita entre abas.
let fila: Promise<void> = Promise.resolve();

async function exclusivo<T>(operacao: () => Promise<T>): Promise<T> {
  const anterior = fila;
  let liberar!: () => void;
  fila = new Promise<void>((resolve) => { liberar = resolve; });
  await anterior;
  try { return await operacao(); } finally { liberar(); }
}

export function caminhoArquivoDemo(): string {
  return join(process.cwd(), '.local', 'prontuario-demo.json');
}

export async function lerDemo(caminho = caminhoArquivoDemo()): Promise<SnapshotDemo> {
  try {
    const info = await stat(caminho);
    if (info.size > 2_000_000) throw new Error('Arquivo de demonstração ultrapassou o limite.');
    return validarArquivo(JSON.parse(await readFile(caminho, 'utf8')));
  } catch (erro) {
    if ((erro as NodeJS.ErrnoException).code === 'ENOENT') return valorPadrao();
    // Não apagar um arquivo ilegível, para que nenhum registro seja perdido silenciosamente.
    throw erro;
  }
}

async function salvarArquivo(caminho: string, snapshot: SnapshotDemo) {
  await mkdir(dirname(caminho), { recursive: true, mode: 0o700 });
  const temporario = `${caminho}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporario, JSON.stringify(snapshot), { flag: 'wx', mode: 0o600 });
    await rename(temporario, caminho);
  } finally {
    await unlink(temporario).catch((erro: NodeJS.ErrnoException) => {
      if (erro.code !== 'ENOENT') throw erro;
    });
  }
}

export async function executarDemo(
  entrada: unknown,
  caminho = caminhoArquivoDemo(),
): Promise<ResultadoDemo> {
  const comando = comandoSchema.parse(entrada);
  return exclusivo(async () => {
    const atual = await lerDemo(caminho);
    if (atual.revisao !== comando.revisao) throw new ConflitoDemoError();
    const agora = new Date().toISOString();
    let proximo: EstadoDemo;
    let registroId: string | null = null;

    if (comando.acao === 'criar') {
      registroId = randomUUID();
      proximo = novaEntrada(
        atual.estado, comando.pacienteId, comando.tipo as TipoRegistro,
        comando.dados as DadosClinicos, registroId, agora,
      );
    } else if (comando.acao === 'revisar') {
      const registro = atual.estado.registros.find((r) => r.id === comando.registroId);
      if (!registro) throw new Error('Registro fictício não encontrado.');
      if (ultimaVersao(registro).numero !== comando.versaoEsperada) throw new ConflitoDemoError();
      registroId = comando.registroId;
      proximo = revisarEntrada(
        atual.estado, registroId, comando.dados as DadosClinicos,
        comando.justificativa, agora,
      );
    } else if (comando.acao === 'finalizar') {
      const registro = atual.estado.registros.find((r) => r.id === comando.registroId);
      if (!registro) throw new Error('Registro fictício não encontrado.');
      if (ultimaVersao(registro).numero !== comando.versaoEsperada) throw new ConflitoDemoError();
      registroId = comando.registroId;
      proximo = finalizarEntrada(atual.estado, registroId, agora);
    } else {
      proximo = estadoInicialDemo();
    }

    const resultado = validarArquivo({ revisao: atual.revisao + 1, estado: proximo });
    await salvarArquivo(caminho, resultado);
    return { ...resultado, registroId };
  });
}
