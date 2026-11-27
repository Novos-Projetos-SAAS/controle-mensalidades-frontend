'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import type { ClinicalContext, ClinicalSessionDetail } from './clinical-api';
import { clinicalApi } from './clinical-api';
import { formatarDataHoraClinica } from './clinical-display';

/** Somente campos clínicos: identidade do paciente, autoria e data não são editáveis. */
const campos = [
  { chave: 'objetivo_sessao', rotulo: 'Objetivo da sessão' },
  { chave: 'avaliacao_previa', rotulo: 'Avaliação antes do atendimento' },
  { chave: 'procedimentos_realizados', rotulo: 'O que foi trabalhado na sessão' },
  { chave: 'exercicios_parametros', rotulo: 'Exercícios, séries e parâmetros' },
  { chave: 'resposta_paciente', rotulo: 'Resposta do paciente' },
  { chave: 'evolucao', rotulo: 'Evolução clínica observada' },
  { chave: 'orientacoes', rotulo: 'Orientações e cuidados' },
  { chave: 'plano_proxima_sessao', rotulo: 'Conduta para a próxima sessão' },
  { chave: 'diagnostico_fisioterapeutico', rotulo: 'Diagnóstico fisioterapêutico' },
  { chave: 'prognostico', rotulo: 'Prognóstico' },
  { chave: 'plano_terapeutico', rotulo: 'Plano terapêutico' },
  { chave: 'observacoes', rotulo: 'Observações clínicas' },
] as const;

type Campo = (typeof campos)[number]['chave'];
type Alteracoes = Partial<Pick<ClinicalSessionDetail, Campo>>;

function mensagemErro(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível consultar as correções autorizadas.';
}

/**
 * Corrige apenas o que mudou, nunca sobrescrevendo a sessão completa.
 * O backend registra cada alteração no histórico e na auditoria transacional.
 */
export function RevisaoEvolucao({
  contexto, usuarioId, sessao, salvando, onSalvar,
}: {
  contexto: ClinicalContext;
  usuarioId: string;
  sessao: ClinicalSessionDetail;
  salvando: boolean;
  onSalvar: (alteracoes: Alteracoes) => Promise<boolean>;
}) {
  const [editando, setEditando] = useState(false);
  const [erro, setErro] = useState('');
  const [valores, setValores] = useState<Record<Campo, string>>(() =>
    Object.fromEntries(campos.map(({ chave }) => [chave, sessao[chave] ?? ''])) as Record<Campo, string>,
  );
  const historico = useQuery({
    queryKey: ['clinico', 'correcoes', usuarioId, contexto.organizacaoId, contexto.areaId, sessao.id],
    queryFn: () => clinicalApi.historicoCorrecoes(contexto, sessao.id),
    retry: false,
  });

  async function salvar() {
    setErro('');
    const alteracoes: Alteracoes = {};
    for (const { chave } of campos) {
      const antes = (sessao[chave] ?? '').trim();
      const depois = valores[chave].trim();
      if (depois === antes) continue;
      if (depois.length > 10000) {
        setErro('Cada campo clínico pode conter no máximo 10.000 caracteres.');
        return;
      }
      if (chave === 'evolucao') {
        if (!depois) {
          setErro('A evolução clínica observada não pode ficar vazia.');
          return;
        }
        alteracoes.evolucao = depois;
      } else {
        alteracoes[chave] = depois || null;
      }
    }
    if (!Object.keys(alteracoes).length) {
      setErro('Altere pelo menos um campo para registrar uma correção.');
      return;
    }
    if (await onSalvar(alteracoes)) setEditando(false);
  }

  return (
    <section className="space-y-4 border-t border-slate-200 pt-4" aria-label="Revisões da evolução">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Correções e histórico da evolução</h3>
        <Button variant="outline" disabled={salvando} onClick={() => { setEditando((ativo) => !ativo); setErro(''); }}>
          {editando ? 'Cancelar correção' : 'Corrigir evolução'}
        </Button>
      </div>
      {editando && (
        <form className="space-y-4 rounded-xl border border-slate-200 p-4"
          onSubmit={(event) => { event.preventDefault(); void salvar(); }}>
          <p className="text-sm text-slate-700">
            Modifique somente os campos necessários. A data do atendimento, o paciente e o
            profissional não podem ser alterados; o histórico anterior é preservado.
          </p>
          <fieldset disabled={salvando} className="space-y-3">
            {campos.map(({ chave, rotulo }) => (
              <label className="block" key={chave}>
                <span className="field-label">{rotulo}</span>
                <textarea className="select-field min-h-24" value={valores[chave]}
                  maxLength={10000} onChange={(event) => {
                    setValores((atual) => ({ ...atual, [chave]: event.target.value }));
                  }} />
              </label>
            ))}
            {erro && <p role="alert" className="text-sm text-red-800">{erro}</p>}
            <Button type="submit">Registrar correção auditada</Button>
          </fieldset>
        </form>
      )}
      <div>
        <h4 className="text-sm font-semibold">Histórico de correções registradas</h4>
        {historico.isPending ? <p role="status" className="mt-2 text-sm">Consultando histórico autorizado…</p>
          : historico.isError ? <p role="alert" className="mt-2 text-sm text-red-800">{mensagemErro(historico.error)}</p>
          : !historico.data?.length ? <p className="mt-2 text-sm text-slate-600">Ainda não há correções nesta evolução.</p>
          : <ol className="mt-3 space-y-3">
            {historico.data.map((revisao, indice) => (
              <li key={`${revisao.criado_em}:${indice}`} className="rounded-lg border border-slate-200 p-3">
                <p className="text-sm font-semibold">Correção registrada em {formatarDataHoraClinica(revisao.criado_em)}</p>
                <dl className="mt-3 space-y-3">
                  {campos.filter(({ chave }) => revisao.campos_alterados.includes(chave)).map(({ chave, rotulo }) => (
                    <div key={chave} className="text-sm">
                      <dt className="font-medium">{rotulo}</dt>
                      <dd className="mt-1 whitespace-pre-wrap break-words text-slate-600">
                        Antes: {revisao.dados_anteriores[chave] || 'Não preenchido'}
                      </dd>
                      <dd className="mt-1 whitespace-pre-wrap break-words text-slate-900">
                        Depois: {revisao.dados_novos[chave] || 'Não preenchido'}
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ol>}
      </div>
    </section>
  );
}
