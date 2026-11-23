import {
  anamneseSchema, evolucaoSchema, laudoSchema,
  type AnamneseDraft, type EvolucaoDraft, type LaudoDraft, type ClinicalTimelineEntry,
} from './clinical-contracts';

export type TipoRegistro = 'ANAMNESE' | 'EVOLUCAO' | 'LAUDO';
export type DadosClinicos = AnamneseDraft | EvolucaoDraft | LaudoDraft;
export type NaturezaVersao = 'INICIAL' | 'CORRECAO' | 'ADENDO';
export type EstadoVersao = 'RASCUNHO' | 'FINALIZADO';

export type PacienteDemo = {
  id: string;
  nome: string;
  idade: number;
  demanda: string;
};

export type VersaoDemo = {
  numero: number;
  registradaEm: string;
  autor: string;
  natureza: NaturezaVersao;
  estado: EstadoVersao;
  justificativa: string;
  dados: DadosClinicos;
};

export type RegistroDemo = {
  id: string;
  pacienteId: string;
  tipo: TipoRegistro;
  versoes: VersaoDemo[];
};

export type EstadoDemo = { registros: RegistroDemo[] };

export const FISIOTERAPEUTA_DEMO = {
  nome: 'Fisioterapeuta de demonstração',
  registro: 'CREFITO FICTÍCIO — NÃO VÁLIDO',
} as const;

export const PACIENTES_DEMO: PacienteDemo[] = [
  { id: 'paciente-ficticio-1', nome: 'Paciente Exemplo A', idade: 46, demanda: 'Mobilidade e atividades funcionais' },
  { id: 'paciente-ficticio-2', nome: 'Paciente Exemplo B', idade: 62, demanda: 'Reabilitação funcional' },
  { id: 'paciente-ficticio-3', nome: 'Paciente Exemplo C', idade: 34, demanda: 'Avaliação inicial pendente' },
];

function validar(tipo: TipoRegistro, dados: DadosClinicos): DadosClinicos {
  if (tipo === 'ANAMNESE') return anamneseSchema.parse(dados);
  if (tipo === 'EVOLUCAO') return evolucaoSchema.parse(dados);
  return laudoSchema.parse(dados);
}

function ultima(registro: RegistroDemo): VersaoDemo {
  const versao = registro.versoes.at(-1);
  if (!versao) throw new Error('Registro sem histórico de versões.');
  return versao;
}

export function novaEntrada(
  estado: EstadoDemo,
  pacienteId: string,
  tipo: TipoRegistro,
  dados: DadosClinicos,
  id: string,
  dataAtual: string,
): EstadoDemo {
  if (!PACIENTES_DEMO.some((p) => p.id === pacienteId)) throw new Error('Paciente de teste inexistente.');
  if (estado.registros.some((r) => r.id === id)) throw new Error('Registro já existente.');
  if (!Number.isFinite(Date.parse(dataAtual))) throw new Error('Data inválida.');
  const entrada: RegistroDemo = {
    id, pacienteId, tipo,
    versoes: [{
      numero: 1, registradaEm: dataAtual,
      autor: FISIOTERAPEUTA_DEMO.nome, natureza: 'INICIAL',
      estado: 'RASCUNHO', justificativa: 'Criação',
      dados: validar(tipo, dados),
    }],
  };
  return { registros: [...estado.registros, entrada] };
}

export function revisarEntrada(
  estado: EstadoDemo,
  id: string,
  dados: DadosClinicos,
  justificativa: string,
  dataAtual: string,
): EstadoDemo {
  if (justificativa.trim().length < 10) throw new Error('Informe o motivo da correção ou adendo (mínimo de 10 caracteres).');
  if (!Number.isFinite(Date.parse(dataAtual))) throw new Error('Data inválida.');
  let encontrado = false;
  const registros = estado.registros.map((r): RegistroDemo => {
    if (r.id !== id) return r;
    encontrado = true;
    const anterior = ultima(r);
    const finalizado = anterior.estado === 'FINALIZADO';
    return {
      ...r,
      versoes: [...r.versoes, {
        numero: anterior.numero + 1,
        registradaEm: dataAtual,
        autor: FISIOTERAPEUTA_DEMO.nome,
        natureza: finalizado ? 'ADENDO' : 'CORRECAO',
        estado: anterior.estado,
        justificativa: justificativa.trim(),
        dados: validar(r.tipo, dados),
      }],
    };
  });
  if (!encontrado) throw new Error('Registro não localizado.');
  return { registros };
}

export function finalizarEntrada(estado: EstadoDemo, id: string, dataAtual: string): EstadoDemo {
  if (!Number.isFinite(Date.parse(dataAtual))) throw new Error('Data inválida.');
  let encontrado = false;
  const registros = estado.registros.map((r): RegistroDemo => {
    if (r.id !== id) return r;
    encontrado = true;
    const anterior = ultima(r);
    if (anterior.estado === 'FINALIZADO') throw new Error('Registro já finalizado.');
    return {
      ...r,
      versoes: [...r.versoes, {
        ...anterior,
        numero: anterior.numero + 1,
        registradaEm: dataAtual,
        natureza: 'CORRECAO',
        estado: 'FINALIZADO',
        justificativa: 'Finalização da simulação; sem assinatura ou valor documental.',
      }],
    };
  });
  if (!encontrado) throw new Error('Registro não localizado.');
  return { registros };
}

export function ultimaVersao(registro: RegistroDemo) {
  return ultima(registro);
}

export function resumoPaciente(estado: EstadoDemo, pacienteId: string): ClinicalTimelineEntry[] {
  return estado.registros
    .filter((registro) => registro.pacienteId === pacienteId)
    .map((registro) => {
      const versao = ultima(registro);
      const titulo = registro.tipo === 'ANAMNESE'
        ? 'Anamnese e avaliação inicial'
        : registro.tipo === 'LAUDO'
          ? 'Laudo fisioterapêutico (simulado)'
          : 'Evolução e conduta da sessão';
      return {
        id: registro.id,
        tipo: registro.tipo,
        titulo: `${titulo} · v${versao.numero}`,
        data: registro.tipo === 'EVOLUCAO'
          ? (versao.dados as EvolucaoDraft).data_sessao
          : versao.registradaEm,
        profissional_nome: versao.autor,
      };
    })
    .sort((a, b) => b.data.localeCompare(a.data));
}

export function estadoInicialDemo(): EstadoDemo {
  const inicio: EstadoDemo = { registros: [] };
  const anamnese: AnamneseDraft = {
    queixa_principal: 'Dificuldade fictícia para realizar movimentos funcionais.',
    historia_condicao_atual: 'Caso sintético criado exclusivamente para treinamento do sistema.',
    antecedentes: 'Antecedentes simulados.',
    medicamentos_alergias: 'Não informados (caso fictício).',
    limitacoes_funcionais: 'Dificuldade funcional descrita para treinamento.',
    objetivos_paciente: 'Ganhar autonomia em atividades cotidianas simuladas.',
    avaliacao_inicial: 'Avaliação funcional de exemplo, sem valor clínico.',
  };
  const evolucao: EvolucaoDraft = {
    data_sessao: '2026-11-18',
    objetivo_sessao: 'Treinar padrão de movimento funcional (exemplo).',
    avaliacao_previa: 'Avaliação prévia simulada.',
    procedimentos_realizados: 'Treino de marcha, mobilidade e exercícios funcionais (dados fictícios).',
    exercicios_parametros: '2 séries de 8 repetições (apenas demonstração).',
    resposta_paciente: 'Resposta favorável simulada, sem intercorrências.',
    evolucao_clinica: 'Melhora funcional fictícia observada para o teste.',
    orientacoes: 'Orientações simuladas, não utilizar como prescrição.',
    plano_proxima_sessao: 'Reavaliar metas funcionais fictícias.',
  };
  const comAnamnese = novaEntrada(
    inicio, PACIENTES_DEMO[0]!.id, 'ANAMNESE', anamnese,
    'exemplo-anamnese', '2026-11-17T14:00:00.000Z',
  );
  return novaEntrada(
    comAnamnese, PACIENTES_DEMO[0]!.id, 'EVOLUCAO', evolucao,
    'exemplo-evolucao', '2026-11-18T14:00:00.000Z',
  );
}
