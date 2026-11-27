import { api } from '@/lib/api';
import type { ClinicalContext } from './clinical-api';

/**
 * Contrato preparatorio do cadastro de vinculos clinicos.
 * NENHUMA tela invoca estas chamadas enquanto o backend permanecer bloqueado.
 * O servidor valida perfil ADMINISTRADOR, organizacao, area, paciente e profissional.
 */
export type VinculoClinico = {
  id: string;
  cliente_id: string;
  profissional_id: string;
  concedido_em: string;
  revogado_em: string | null;
};

export type VinculoClinicoCriado = Pick<
  VinculoClinico,
  'id' | 'cliente_id' | 'profissional_id' | 'concedido_em'
>;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validarId(id: string): string {
  if (!uuid.test(id)) throw new Error('Identificador de vínculo clínico inválido.');
  return encodeURIComponent(id);
}

function validarContexto(contexto: ClinicalContext) {
  validarId(contexto.organizacaoId);
  validarId(contexto.areaId);
  return contexto;
}

export const vinculosClinicosApi = {
  // Consulta administrativa restrita: apenas confirma a identidade profissional,
  // sem carregar nenhum dado do prontuário.
  consultarUsuarioProfissional(contexto: ClinicalContext, profissionalId: string) {
    const id = validarId(profissionalId);
    return api<{ profissionalId: string; usuario: { id: string; nome: string } | null; vinculoAtivo: boolean }>(
      `/profissionais/${id}/usuario`, {}, validarContexto(contexto),
    );
  },

  // A autorização clínica é uma ação administrativa independente do vínculo
  // paciente-profissional. O backend exige usuário profissional ativo e audita.
  autorizarAcessoClinico(contexto: ClinicalContext, profissionalId: string) {
    const id = validarId(profissionalId);
    return api<{ profissionalId: string; areaNegocioId: string; autorizado: boolean }>(
      `/profissionais/${id}/acesso-clinico`,
      { method: 'PATCH', body: JSON.stringify({ autorizado: true }) },
      validarContexto(contexto),
    );
  },

  listar(contexto: ClinicalContext, pacienteId: string) {
    return api<VinculoClinico[]>(
      `/vinculos-clinicos/paciente/${validarId(pacienteId)}`,
      {},
      validarContexto(contexto),
    );
  },

  conceder(contexto: ClinicalContext, pacienteId: string, profissionalId: string) {
    const cliente_id = validarId(pacienteId);
    const profissional_id = validarId(profissionalId);
    return api<VinculoClinicoCriado>('/vinculos-clinicos', {
      method: 'POST',
      body: JSON.stringify({ cliente_id, profissional_id }),
    }, validarContexto(contexto));
  },

  revogar(contexto: ClinicalContext, vinculoId: string, motivo: string) {
    const id = validarId(vinculoId);
    const razao = motivo.trim();
    if (razao.length < 10 || razao.length > 500) {
      throw new Error('Informe um motivo de revogação entre 10 e 500 caracteres.');
    }
    return api<{ id: string; revogado: true }>(
      `/vinculos-clinicos/${id}/revogar`,
      { method: 'POST', body: JSON.stringify({ motivo: razao }) },
      validarContexto(contexto),
    );
  },
} as const;
