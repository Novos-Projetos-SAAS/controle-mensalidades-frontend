import { z } from 'zod';

// Rascunhos preenchidos somente pelo profissional. Não são laudos assinados.
// Os campos textuais clínicos não são enviados a APIs enquanto o módulo está bloqueado.
const texto = (rotulo: string, limite = 10000) =>
  z.string().trim().min(1, `Preencha ${rotulo}.`).max(limite, 'Texto muito extenso.');

const opcional = z.string().trim().max(10000).default('');

export const anamneseSchema = z.object({
  queixa_principal: texto('a queixa principal'),
  historia_condicao_atual: texto('a história da condição atual'),
  antecedentes: opcional,
  medicamentos_alergias: opcional,
  limitacoes_funcionais: texto('as limitações funcionais'),
  objetivos_paciente: texto('os objetivos do paciente'),
  avaliacao_inicial: texto('a avaliação inicial'),
});

export const evolucaoSchema = z.object({
  data_sessao: z.iso.date(),
  objetivo_sessao: texto('o objetivo da sessão'),
  avaliacao_previa: opcional,
  procedimentos_realizados: texto('o que foi trabalhado na sessão'),
  exercicios_parametros: opcional,
  resposta_paciente: texto('a resposta do paciente'),
  evolucao_clinica: texto('a evolução clínica'),
  orientacoes: opcional,
  plano_proxima_sessao: opcional,
  diagnostico_fisioterapeutico: z.string().trim().max(10000).optional(),
  prognostico: z.string().trim().max(10000).optional(),
  plano_terapeutico: z.string().trim().max(10000).optional(),
  observacoes: z.string().trim().max(10000).optional(),
});

export const laudoSchema = z.object({
  finalidade: texto('a finalidade do laudo'),
  fundamentacao_avaliacao: texto('a fundamentação clínica'),
  achados_funcionais: texto('os achados funcionais'),
  diagnostico_fisioterapeutico: texto('o diagnóstico fisioterapêutico'),
  conclusao: texto('a conclusão profissional'),
  recomendacoes: opcional,
});

export type AnamneseDraft = z.infer<typeof anamneseSchema>;
export type EvolucaoDraft = z.infer<typeof evolucaoSchema>;
export type LaudoDraft = z.infer<typeof laudoSchema>;

export type ClinicalTimelineEntry = {
  id: string;
  tipo: 'ANAMNESE' | 'EVOLUCAO' | 'LAUDO';
  data: string;
  profissional_nome: string;
  titulo: string;
  // Somente metadados; detalhes devem ser carregados após autorização específica.
};

export function sessaoClinicaLegada(dados: EvolucaoDraft) {
  // Compatibilidade futura com o contrato de sessão clínica existente.
  // Campos estruturados que não existem no banco NÃO são silenciosamente descartados.
  return {
    data_sessao: dados.data_sessao,
    evolucao: dados.evolucao_clinica,
    intervencoes_pendentes_de_modelagem: {
      objetivo_sessao: dados.objetivo_sessao,
      avaliacao_previa: dados.avaliacao_previa,
      procedimentos_realizados: dados.procedimentos_realizados,
      exercicios_parametros: dados.exercicios_parametros,
      resposta_paciente: dados.resposta_paciente,
      orientacoes: dados.orientacoes,
      plano_proxima_sessao: dados.plano_proxima_sessao,
      diagnostico_fisioterapeutico: dados.diagnostico_fisioterapeutico,
      prognostico: dados.prognostico,
      plano_terapeutico: dados.plano_terapeutico,
      observacoes: dados.observacoes,
    },
  };
}
