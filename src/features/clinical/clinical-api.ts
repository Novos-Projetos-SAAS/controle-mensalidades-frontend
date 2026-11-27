import { ApiError, api } from '@/lib/api';
import type { AnamneseDraft, LaudoDraft, EvolucaoDraft } from './clinical-contracts';

// Contrato tipado para o futuro prontuario real. Nao aciona nada sozinho:
// as rotas correspondentes continuam bloqueadas no backend ate a homologacao.
export type PacienteClinicoVinculado = { id: string; nome: string };
export type ListagemPacientesClinicos = {
  items: PacienteClinicoVinculado[];
  pagina: number;
  limite: number;
  temMais: boolean;
};
export type MinhaIdentidadeClinica = { profissional_id: string };

export type ClinicalContext = {
  organizacaoId: string;
  areaId: string;
};

export type ClinicalDocumentType = 'ANAMNESE' | 'LAUDO';
export type ClinicalDocumentState = 'RASCUNHO' | 'FINALIZADO';
export type ClinicalDocumentNature = 'INICIAL' | 'CORRECAO' | 'ADENDO';

export type ClinicalTimelineItem = {
  id: string;
  tipo: ClinicalDocumentType | 'EVOLUCAO';
  paciente_id: string;
  data: string;
  profissional_id: string;
  profissional_nome: string;
  titulo: string;
  versao: number | null;
  estado: ClinicalDocumentState | null;
};

export type ClinicalDocumentVersion = {
  id: string;
  registro_id: string;
  autor_usuario_id: string;
  versao: number;
  natureza: ClinicalDocumentNature;
  estado: ClinicalDocumentState;
  conteudo: AnamneseDraft | LaudoDraft;
  justificativa: string | null;
  registrado_em: string;
};

export type ClinicalDocumentDetail = {
  registro: {
    id: string;
    organizacao_id: string;
    area_negocio_id: string;
    cliente_id: string;
    profissional_id: string;
    tipo: ClinicalDocumentType;
  };
  versoes: ClinicalDocumentVersion[];
};

export type ClinicalDocumentSummary = {
  id: string;
  tipo: ClinicalDocumentType;
  cliente_id: string;
  profissional_id: string;
  criado_em: string;
};

export type ClinicalDocumentWrite = {
  id: string;
  versao: number;
  estado: ClinicalDocumentState;
  tipo?: ClinicalDocumentType;
};

export type ClinicalSessionSummary = {
  id: string;
  cliente_id: string;
  profissional_id: string;
  data_sessao: string;
  corrigido_em: string | null;
  cliente_nome: string;
  profissional_nome: string;
};

export type ClinicalSessionDetail = ClinicalSessionSummary & {
  evolucao: string;
  objetivo_sessao: string | null;
  avaliacao_previa: string | null;
  procedimentos_realizados: string | null;
  exercicios_parametros: string | null;
  resposta_paciente: string | null;
  orientacoes: string | null;
  plano_proxima_sessao: string | null;
  diagnostico_fisioterapeutico: string | null;
  prognostico: string | null;
  plano_terapeutico: string | null;
  observacoes: string | null;
};

export type ClinicalSessionCorrection = {
  sessao_clinica_id: string;
  corrigido_por_usuario_id: string;
  campos_alterados: string[];
  dados_anteriores: Record<string, string | null>;
  dados_novos: Record<string, string | null>;
  criado_em: string;
};

function identificar(valor: string): string {
  // Path params sempre validados e codificados antes de serem concatenados à rota.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor)) {
    throw new Error('Identificador clínico inválido.');
  }
  return encodeURIComponent(valor);
}

function json(body: unknown): RequestInit {
  return { method: 'POST', body: JSON.stringify(body) };
}

function context(c: ClinicalContext) {
  if (!c.organizacaoId || !c.areaId) throw new Error('Selecione organização e área de negócio.');
  return c;
}

export const clinicalApi = {
  // O backend deriva identidade profissional da sessão autenticada;
  // o frontend nunca pede que um usuário informe ou escolha seu próprio ID.
  minhaIdentidade(c: ClinicalContext) {
    return api<MinhaIdentidadeClinica>('/prontuario/identidade', {}, context(c));
  },

  pacientesVinculados(c: ClinicalContext, pagina = 1, limite = 20) {
    if (!Number.isInteger(pagina) || pagina < 1 || pagina > 100 ||
        !Number.isInteger(limite) || limite < 1 || limite > 50) {
      throw new Error('Paginação clínica inválida.');
    }
    return api<ListagemPacientesClinicos>(
      `/prontuario/pacientes?pagina=${pagina}&limite=${limite}`,
      {},
      context(c),
    );
  },

  // Apenas metadados; cada detalhe exige outra autorização e auditoria.
  timeline(c: ClinicalContext, pacienteId: string, limite = 50) {
    if (!Number.isInteger(limite) || limite < 1 || limite > 100) {
      throw new Error('Limite do histórico inválido.');
    }
    return api<ClinicalTimelineItem[]>(
      `/prontuario/pacientes/${identificar(pacienteId)}/historico?limite=${limite}`,
      {},
      context(c),
    );
  },

  listarDocumentos(c: ClinicalContext, pacienteId: string) {
    return api<ClinicalDocumentSummary[]>(
      `/documentos-clinicos/paciente/${identificar(pacienteId)}`,
      {},
      context(c),
    );
  },

  consultarDocumento(c: ClinicalContext, documentoId: string) {
    return api<ClinicalDocumentDetail>(
      `/documentos-clinicos/${identificar(documentoId)}`,
      {},
      context(c),
    );
  },

  criarAnamnese(c: ClinicalContext, pacienteId: string, conteudo: AnamneseDraft) {
    return api<ClinicalDocumentWrite>('/documentos-clinicos', json({
      tipo: 'ANAMNESE', cliente_id: identificar(pacienteId), conteudo,
    }), context(c));
  },

  criarLaudo(c: ClinicalContext, pacienteId: string, conteudo: LaudoDraft) {
    return api<ClinicalDocumentWrite>('/documentos-clinicos', json({
      tipo: 'LAUDO', cliente_id: identificar(pacienteId), conteudo,
    }), context(c));
  },

  /**
   * Retorna PDF binário sob a sessão e escopo atuais, sem passar token ou
   * dados clínicos na URL. O backend revalida vínculo e audita a exportação.
   */
  async pdfLaudo(c: ClinicalContext, documentoId: string, versao: number): Promise<Blob> {
    if (!Number.isInteger(versao) || versao < 1 || versao > 999999) {
      throw new Error('Versão do laudo inválida.');
    }
    const contexto = context(c);
    const url = '/api/v1/documentos-clinicos/' + identificar(documentoId) +
      '/pdf?versao=' + versao;
    let response: Response;
    try {
      response = await fetch(url, {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          Accept: 'application/pdf',
          'x-organizacao-id': contexto.organizacaoId,
          'x-area-negocio-id': contexto.areaId,
        },
      });
    } catch {
      throw new ApiError('Não foi possível conectar ao servidor para gerar o PDF.', 0);
    }
    if (!response.ok) {
      const erro = await response.json().catch(() => null) as
        { mensagem?: string; codigo?: string } | null;
      throw new ApiError(
        erro?.mensagem || 'Não foi possível gerar o laudo em PDF.',
        response.status, erro?.codigo,
      );
    }
    if (!response.headers.get('content-type')?.includes('application/pdf')) {
      throw new ApiError('Resposta de PDF inválida.', 502, 'PDF_INVALIDO');
    }
    const arquivo = await response.blob();
    if (!arquivo.size || arquivo.size > 10_000_000) {
      throw new ApiError('O PDF retornado está vazio ou excede o tamanho permitido.', 502, 'PDF_INVALIDO');
    }
    return arquivo;
  },

  revisarDocumento(
    c: ClinicalContext,
    documentoId: string,
    conteudo: AnamneseDraft | LaudoDraft,
    natureza: 'CORRECAO' | 'ADENDO',
    justificativa: string,
    ultimaVersaoEsperada: number,
  ) {
    return api<ClinicalDocumentWrite>(
      `/documentos-clinicos/${identificar(documentoId)}/revisoes`,
      json({
        conteudo, natureza, justificativa, ultima_versao_esperada: ultimaVersaoEsperada,
      }),
      context(c),
    );
  },

  finalizarDocumento(c: ClinicalContext, documentoId: string, ultimaVersaoEsperada: number) {
    return api<ClinicalDocumentWrite>(
      `/documentos-clinicos/${identificar(documentoId)}/finalizar`,
      json({ ultima_versao_esperada: ultimaVersaoEsperada }),
      context(c),
    );
  },

  criarEvolucao(
    c: ClinicalContext,
    pacienteId: string,
    profissionalId: string,
    dados: EvolucaoDraft,
    dataHoraSessao: string,
  ) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(dataHoraSessao) ||
      !Number.isFinite(Date.parse(dataHoraSessao))) {
      throw new Error('Informe a data e a hora reais da sessão, com fuso horário.');
    }
    if (dataHoraSessao.slice(0, 10) !== dados.data_sessao) {
      throw new Error('A data e a hora da sessão não correspondem ao formulário.');
    }
    const { evolucao_clinica, objetivo_sessao, avaliacao_previa, procedimentos_realizados, exercicios_parametros, resposta_paciente, orientacoes, plano_proxima_sessao } = dados;
    // A autoria e checada no servidor contra o usuario autenticado.
    // Nenhum campo estruturado da sessao e descartado.
    return api<ClinicalSessionDetail>('/sessoes-clinicas', json({
      cliente_id: identificar(pacienteId),
      profissional_id: identificar(profissionalId),
      data_sessao: dataHoraSessao,
      evolucao: evolucao_clinica,
      objetivo_sessao,
      ...(avaliacao_previa ? { avaliacao_previa } : {}),
      procedimentos_realizados,
      ...(exercicios_parametros ? { exercicios_parametros } : {}),
      resposta_paciente,
      ...(orientacoes ? { orientacoes } : {}),
      ...(plano_proxima_sessao ? { plano_proxima_sessao } : {}),
    }), context(c));
  },

  consultarEvolucao(c: ClinicalContext, sessaoId: string) {
    return api<ClinicalSessionDetail>(
      `/sessoes-clinicas/${identificar(sessaoId)}`, {}, context(c),
    );
  },

  corrigirEvolucao(c: ClinicalContext, sessaoId: string, dados: Partial<ClinicalSessionDetail>) {
    // A chamada PATCH nao aceita alteracoes de identidades, data nem de relacionamento.
    const campos = [
      'evolucao', 'objetivo_sessao', 'avaliacao_previa', 'procedimentos_realizados',
      'exercicios_parametros', 'resposta_paciente', 'orientacoes',
      'plano_proxima_sessao', 'diagnostico_fisioterapeutico', 'prognostico',
      'plano_terapeutico', 'observacoes',
    ] as const;
    const alteracoes: Record<string, string | null> = {};
    for (const campo of campos) {
      const valor = dados[campo];
      if (valor !== undefined) alteracoes[campo] = valor;
    }
    if (!Object.keys(alteracoes).length) throw new Error('Nenhuma correção informada.');
    return api<ClinicalSessionDetail>(
      `/sessoes-clinicas/${identificar(sessaoId)}`,
      { method: 'PATCH', body: JSON.stringify(alteracoes) },
      context(c),
    );
  },

  historicoCorrecoes(c: ClinicalContext, sessaoId: string) {
    return api<ClinicalSessionCorrection[]>(
      `/sessoes-clinicas/${identificar(sessaoId)}/historico`,
      {},
      context(c),
    );
  },
} as const;
