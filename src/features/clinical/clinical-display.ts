/**
 * Formatação de prontuários para leitura clínica.
 * Nunca renderizar o objeto bruto da API: identificadores e campos internos
 * pertencem ao banco/auditoria, não à interface para o fisioterapeuta.
 */
const camposAnamnese = [
  ['queixa_principal', 'Queixa principal'],
  ['historia_condicao_atual', 'História da condição atual'],
  ['antecedentes', 'Antecedentes e cirurgias'],
  ['medicamentos_alergias', 'Medicamentos, alergias e cuidados'],
  ['limitacoes_funcionais', 'Limitações funcionais'],
  ['objetivos_paciente', 'Objetivos do paciente'],
  ['avaliacao_inicial', 'Avaliação inicial'],
] as const;

const camposLaudo = [
  ['finalidade', 'Finalidade do laudo'],
  ['fundamentacao_avaliacao', 'Fundamentação e avaliação'],
  ['achados_funcionais', 'Achados funcionais'],
  ['diagnostico_fisioterapeutico', 'Diagnóstico fisioterapêutico'],
  ['conclusao', 'Conclusão profissional'],
  ['recomendacoes', 'Recomendações'],
] as const;

const camposEvolucao = [
  ['objetivo_sessao', 'Objetivo da sessão'],
  ['avaliacao_previa', 'Avaliação antes do atendimento'],
  ['procedimentos_realizados', 'O que foi trabalhado na sessão'],
  ['exercicios_parametros', 'Exercícios, séries e parâmetros'],
  ['resposta_paciente', 'Resposta do paciente'],
  ['evolucao', 'Evolução clínica observada'],
  ['orientacoes', 'Orientações e cuidados'],
  ['plano_proxima_sessao', 'Conduta para a próxima sessão'],
  ['diagnostico_fisioterapeutico', 'Diagnóstico fisioterapêutico'],
  ['prognostico', 'Prognóstico'],
  ['plano_terapeutico', 'Plano terapêutico'],
  ['observacoes', 'Observações clínicas'],
] as const;

export type TipoLeituraClinica = 'ANAMNESE' | 'LAUDO' | 'EVOLUCAO';

/** Apresenta somente campos clínicos reconhecidos e preenchidos. */
export function camposClinicosParaLeitura(
  conteudo: Record<string, unknown>,
  tipo: TipoLeituraClinica,
): Array<{ rotulo: string; valor: string }> {
  const permitidos = tipo === 'ANAMNESE'
    ? camposAnamnese
    : tipo === 'LAUDO' ? camposLaudo : camposEvolucao;

  return permitidos.flatMap(([chave, rotulo]) => {
    const valor = conteudo[chave];
    if (typeof valor !== 'string' || !valor.trim()) return [];
    return [{ rotulo, valor: valor.trim() }];
  });
}

/** Formata instante UTC/offset real em horário de Brasília, sem exibir ISO cru. */
export function formatarDataHoraClinica(valor: string): string {
  const data = new Date(valor);
  if (!Number.isFinite(data.getTime())) return 'Data não disponível';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(data);
}
