import { describe, expect, it } from 'vitest';
import { camposClinicosParaLeitura, formatarDataHoraClinica } from './clinical-display';

describe('apresentação do prontuário para fisioterapeutas', () => {
  it('não mostra ids, colunas internas, campos vazios nem chaves desconhecidas da API', () => {
    const campos = camposClinicosParaLeitura({
      id: '11111111-1111-4111-8111-111111111111',
      agendamento_id: null,
      corrigido_em: null,
      corrigido_por_usuario_id: null,
      cliente_nome: 'Paciente fictício',
      profissional_nome: 'Profissional fictício',
      data_sessao: '2026-11-26T00:59:00.000Z',
      objetivo_sessao: 'Mobilidade',
      avaliacao_previa: 'Rigidez',
      procedimentos_realizados: 'Alongamentos',
      exercicios_parametros: '3 séries de 10',
      resposta_paciente: 'Boa resposta',
      evolucao: 'Mobilidade melhorou',
      prognostico: null,
      plano_terapeutico: '',
      observacoes: '   ',
      chave_interna_que_nao_existia: 'segredo técnico',
    }, 'EVOLUCAO');

    expect(campos).toEqual([
      { rotulo: 'Objetivo da sessão', valor: 'Mobilidade' },
      { rotulo: 'Avaliação antes do atendimento', valor: 'Rigidez' },
      { rotulo: 'O que foi trabalhado na sessão', valor: 'Alongamentos' },
      { rotulo: 'Exercícios, séries e parâmetros', valor: '3 séries de 10' },
      { rotulo: 'Resposta do paciente', valor: 'Boa resposta' },
      { rotulo: 'Evolução clínica observada', valor: 'Mobilidade melhorou' },
    ]);
  });

  it('preserva a leitura profissional da anamnese e do laudo sem dados internos', () => {
    expect(camposClinicosParaLeitura({
      queixa_principal: 'Dor sintética',
      historia_condicao_atual: 'Sintomas fictícios',
      profissional_id: 'tecnico',
    }, 'ANAMNESE')).toEqual([
      { rotulo: 'Queixa principal', valor: 'Dor sintética' },
      { rotulo: 'História da condição atual', valor: 'Sintomas fictícios' },
    ]);
    expect(camposClinicosParaLeitura({
      conclusao: 'Conclusão fictícia',
      id: 'tecnico',
    }, 'LAUDO')).toEqual([{ rotulo: 'Conclusão profissional', valor: 'Conclusão fictícia' }]);
  });

  it('converte UTC ao horário de Brasília e não mostra timestamp ISO', () => {
    expect(formatarDataHoraClinica('2026-11-26T00:59:00.000Z')).toMatch(/25\/11\/2026.*21:59/);
    expect(formatarDataHoraClinica('inválida')).toBe('Data não disponível');
  });
});
