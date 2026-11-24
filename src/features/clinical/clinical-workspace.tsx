'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, ClipboardList, FileText, LockKeyhole, RefreshCw, UserRound } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { useSession } from '@/features/auth/session';
import { ApiError } from '@/lib/api';
import {
  clinicalApi, type ClinicalTimelineItem, type ClinicalContext,
  type ClinicalDocumentDetail,
} from './clinical-api';
import {
  AnamneseForm, EvolucaoForm, LaudoForm,
} from './clinical-forms';
import type { AnamneseDraft, EvolucaoDraft, LaudoDraft } from './clinical-contracts';

type Formulario = 'ANAMNESE' | 'EVOLUCAO' | 'LAUDO';
type DadosForm = AnamneseDraft | EvolucaoDraft | LaudoDraft;

const campos: Record<string, string> = {
  queixa_principal: 'Queixa principal',
  historia_condicao_atual: 'História da condição atual',
  antecedentes: 'Antecedentes',
  medicamentos_alergias: 'Medicamentos e alergias',
  limitacoes_funcionais: 'Limitações funcionais',
  objetivos_paciente: 'Objetivos',
  avaliacao_inicial: 'Avaliação inicial',
  finalidade: 'Finalidade',
  fundamentacao_avaliacao: 'Fundamentação',
  achados_funcionais: 'Achados funcionais',
  diagnostico_fisioterapeutico: 'Diagnóstico fisioterapêutico',
  conclusao: 'Conclusão',
  recomendacoes: 'Recomendações',
  data_sessao: 'Data da sessão',
  objetivo_sessao: 'Objetivo da sessão',
  avaliacao_previa: 'Avaliação prévia',
  procedimentos_realizados: 'O que foi trabalhado',
  exercicios_parametros: 'Exercícios e parâmetros',
  resposta_paciente: 'Resposta',
  evolucao: 'Evolução clínica',
  orientacoes: 'Orientações',
  plano_proxima_sessao: 'Próxima sessão',
};

function mensagemErro(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) return 'Acesso clínico não autorizado. Verifique seu vínculo e as permissões com o administrador.';
    if (error.status === 404) return 'A API clínica ainda não está homologada ou o registro não está disponível para esta conta.';
    if (error.status === 409) return 'Este registro foi alterado em outra sessão. Recarregue o histórico antes de tentar novamente.';
    return 'Não foi possível acessar o prontuário. Tente novamente.';
  }
  return error instanceof Error ? error.message : 'Operação clínica não concluída.';
}

function exibirValores(conteudo: Record<string, unknown>) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {Object.entries(conteudo).filter(([key]) => ![
        'cliente_id', 'profissional_id', 'organizacao_id', 'area_negocio_id',
      ].includes(key)).map(([key, value]) => (
        <div key={key} className="min-w-0 border-b border-slate-100 pb-2">
          <dt className="text-xs font-semibold text-slate-600">{campos[key] || key}</dt>
          <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-900">{String(value ?? 'Não informado')}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Tela de integração do prontuário com API autenticada.
 * Não usa o armazenamento .local/ do simulador, não importa PACIENTES_DEMO
 * e permanece inacessível no build de produção até homologação.
 */
export function ClinicalWorkspace() {
  const { session, organization, area } = useSession();
  const orgId = organization?.id ?? '';
  const areaId = area?.id ?? '';
  const usuarioId = session?.usuario.id ?? '';
  const contexto: ClinicalContext = { organizacaoId: orgId, areaId };
  const disponivel = !!orgId && !!areaId && !!usuarioId;

  const queryClient = useQueryClient();
  const [pagina, setPagina] = useState(1);
  const [pacienteId, setPacienteId] = useState<string | null>(null);
  const [entrada, setEntrada] = useState<ClinicalTimelineItem | null>(null);
  const [versaoExibida, setVersaoExibida] = useState<number | null>(null);
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [revisando, setRevisando] = useState(false);
  const [justificativa, setJustificativa] = useState('');
  const [horaSessao, setHoraSessao] = useState('');
  const [fuso, setFuso] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const trava = useRef(false);

  useEffect(() => {
    setPagina(1);
    setPacienteId(null);
    setEntrada(null);
    setFormulario(null);
    setVersaoExibida(null);
    setErro('');
    setMensagem('');
  }, [orgId, areaId, usuarioId]);

  const pacientes = useQuery({
    queryKey: ['clinico', 'pacientes', usuarioId, orgId, areaId, pagina],
    queryFn: () => clinicalApi.pacientesVinculados(contexto, pagina, 20),
    enabled: disponivel,
    retry: false,
  });

  const identidade = useQuery({
    queryKey: ['clinico', 'identidade', usuarioId, orgId, areaId],
    queryFn: () => clinicalApi.minhaIdentidade(contexto),
    enabled: disponivel,
    retry: false,
  });

  const historico = useQuery({
    queryKey: ['clinico', 'timeline', usuarioId, orgId, areaId, pacienteId],
    queryFn: () => clinicalApi.timeline(contexto, pacienteId!),
    enabled: disponivel && !!pacienteId,
    retry: false,
  });

  const detalhe = useQuery({
    queryKey: ['clinico', 'detalhe', usuarioId, orgId, areaId, entrada?.tipo, entrada?.id],
    queryFn: () => entrada?.tipo === 'EVOLUCAO'
      ? clinicalApi.consultarEvolucao(contexto, entrada.id)
      : clinicalApi.consultarDocumento(contexto, entrada!.id),
    enabled: disponivel && !!pacienteId && !!entrada,
    retry: false,
  });

  const documento = entrada?.tipo !== 'EVOLUCAO' && detalhe.data && 'versoes' in detalhe.data
    ? detalhe.data as ClinicalDocumentDetail
    : null;
  const versaoAtual = documento?.versoes.at(-1);
  const versao = documento?.versoes.find((v) => v.versao === versaoExibida) ?? versaoAtual;
  const paciente = pacientes.data?.items.find((item) => item.id === pacienteId);

  function escolherPaciente(id: string) {
    setPacienteId(id);
    setEntrada(null);
    setFormulario(null);
    setVersaoExibida(null);
    setMensagem('');
    setErro('');
  }

  function abrirFormulario(tipo: Formulario, editar = false) {
    setFormulario(tipo);
    setRevisando(editar);
    setJustificativa('');
    setHoraSessao('');
    setFuso('');
    setErro('');
    setMensagem('');
  }

  async function concluir<T>(acao: () => Promise<T>, sucesso: string): Promise<boolean> {
    if (trava.current) return false;
    trava.current = true;
    setSalvando(true);
    setErro('');
    setMensagem('');
    try {
      await acao();
      // Recarrega resumo e detalhes: nenhum sucesso depende de estado local.
      await queryClient.invalidateQueries({ queryKey: ['clinico'] });
      setEntrada(null);
      setFormulario(null);
      setVersaoExibida(null);
      setMensagem(sucesso);
      return true;
    } catch (error) {
      setErro(mensagemErro(error));
      return false;
    } finally {
      trava.current = false;
      setSalvando(false);
    }
  }

  async function salvar(dados: DadosForm) {
    if (!pacienteId || !formulario || !disponivel) return;
    if (revisando) {
      if (!documento || !versaoAtual || formulario === 'EVOLUCAO') return;
      if (justificativa.trim().length < 10) {
        setErro('Informe o motivo da correção ou do adendo, com pelo menos 10 caracteres.');
        return;
      }
      await concluir(() => clinicalApi.revisarDocumento(
        contexto, documento.registro.id, dados as AnamneseDraft | LaudoDraft,
        versaoAtual.estado === 'FINALIZADO' ? 'ADENDO' : 'CORRECAO',
        justificativa.trim(), versaoAtual.versao,
      ), 'Nova versão registrada no banco de homologação.');
      return;
    }

    if (formulario === 'ANAMNESE') {
      await concluir(() => clinicalApi.criarAnamnese(contexto, pacienteId, dados as AnamneseDraft),
        'Anamnese registrada no banco de homologação.');
    } else if (formulario === 'LAUDO') {
      await concluir(() => clinicalApi.criarLaudo(contexto, pacienteId, dados as LaudoDraft),
        'Rascunho de laudo registrado. Nenhuma assinatura foi emitida.');
    } else {
      const profissionalId = identidade.data?.profissional_id;
      if (!profissionalId || !horaSessao || !fuso || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(horaSessao)) {
        setErro('Informe horário, fuso e aguarde a identificação profissional autenticada.');
        return;
      }
      await concluir(() => clinicalApi.criarEvolucao(
        contexto, pacienteId, profissionalId, dados as EvolucaoDraft,
        `${horaSessao}:00${fuso}`,
      ), 'Evolução de sessão registrada no banco de homologação.');
    }
  }

  async function finalizarDocumento() {
    if (!documento || !versaoAtual || versaoAtual.estado !== 'RASCUNHO') return;
    await concluir(() => clinicalApi.finalizarDocumento(
      contexto, documento.registro.id, versaoAtual.versao,
    ), 'Documento finalizado sem assinatura digital. Adendos continuarão versionados.');
  }

  const formsKey = `${formulario}-${pacienteId}-${revisando ? entrada?.id : 'novo'}`;

  return (
    <AppShell>
      <section className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        <div className="flex gap-3">
          <LockKeyhole className="shrink-0" aria-hidden />
          <div>
            <strong>Integração clínica em homologação — somente ambiente local</strong>
            <p className="mt-1">
              Esta tela consulta a API autenticada, não o simulador. As rotas do prontuário estão
              bloqueadas no backend até aprovação. Não utilize dados reais nem altere permissões para
              contornar o bloqueio.
            </p>
          </div>
        </div>
      </section>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="display text-3xl">Prontuário fisioterapêutico</h1>
          <p className="mt-1 text-sm text-slate-600">Pacientes autorizados · {area?.nome || 'Selecione uma área'}</p>
        </div>
        <Button variant="outline" disabled={!disponivel || pacientes.isFetching} onClick={() => {
          void queryClient.invalidateQueries({ queryKey: ['clinico'] });
        }}>
          <RefreshCw size={16} aria-hidden /> Atualizar
        </Button>
      </div>
      {!disponivel ? (
        <p className="surface p-5 text-sm">Selecione uma organização e uma área para continuar.</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[290px_minmax(0,1fr)]">
          <aside className="surface h-fit p-4">
            <h2 className="mb-4 flex items-center gap-2 font-semibold"><UserRound size={18} aria-hidden /> Meus pacientes</h2>
            {pacientes.isPending ? (
              <p role="status" className="text-sm">Buscando pacientes vinculados…</p>
            ) : pacientes.isError ? (
              <div role="alert" className="space-y-3 text-sm text-amber-950">
                <p>{mensagemErro(pacientes.error)}</p>
                <Button variant="outline" onClick={() => void pacientes.refetch()}>Tentar novamente</Button>
              </div>
            ) : pacientes.data?.items.length === 0 ? (
              <p className="text-sm text-slate-600">Nenhum paciente vinculado a este fisioterapeuta.</p>
            ) : (
              <div className="space-y-2">
                {pacientes.data?.items.map((item) => (
                  <button key={item.id} type="button" onClick={() => escolherPaciente(item.id)}
                    aria-pressed={pacienteId === item.id}
                    className={`w-full rounded-xl border p-3 text-left text-sm font-medium focus-visible:outline-2 focus-visible:outline-teal-700 ${pacienteId === item.id ? 'border-teal-700 bg-teal-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                    {item.nome}
                  </button>
                ))}
                <div className="mt-4 flex items-center justify-between gap-2">
                  <Button variant="outline" disabled={pagina <= 1 || pacientes.isFetching}
                    onClick={() => { setPagina((n) => n - 1); setPacienteId(null); setEntrada(null); }}>
                    Anterior
                  </Button>
                  <span className="text-xs text-slate-600">Página {pagina}</span>
                  <Button variant="outline" disabled={!pacientes.data?.temMais || pacientes.isFetching}
                    onClick={() => { setPagina((n) => n + 1); setPacienteId(null); setEntrada(null); }}>
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </aside>

          <div className="min-w-0 space-y-5">
            {!pacienteId ? (
              <section className="surface p-6 text-sm text-slate-600">Selecione um paciente autorizado para consultar a linha do tempo.</section>
            ) : (
              <>
                <section className="surface p-5">
                  <h2 className="display text-2xl">{paciente?.nome || 'Paciente vinculado'}</h2>
                  <p className="mt-2 text-xs text-slate-600">Os detalhes clínicos são consultados apenas sob demanda e com auditoria.</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button disabled={salvando} onClick={() => abrirFormulario('ANAMNESE')}>
                      <ClipboardList size={17} aria-hidden /> Nova anamnese
                    </Button>
                    <Button variant="secondary" disabled={salvando || !identidade.data}
                      onClick={() => abrirFormulario('EVOLUCAO')}>
                      <Activity size={17} aria-hidden /> Nova evolução
                    </Button>
                    <Button variant="outline" disabled={salvando} onClick={() => abrirFormulario('LAUDO')}>
                      <FileText size={17} aria-hidden /> Novo laudo
                    </Button>
                  </div>
                </section>
                {mensagem && <p role="status" className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">{mensagem}</p>}
                {erro && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{erro}</p>}

                {formulario && (
                  <section className="surface space-y-4 p-5" aria-label="Formulário clínico autenticado">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-semibold">{revisando ? 'Nova versão do documento' : 'Novo atendimento'}</h2>
                      <Button variant="ghost" disabled={salvando} onClick={() => setFormulario(null)}>Cancelar</Button>
                    </div>
                    {revisando && (
                      <label className="block">
                        <span className="field-label">Motivo da correção ou adendo *</span>
                        <textarea className="select-field min-h-24" value={justificativa}
                          onChange={(e) => setJustificativa(e.target.value)} />
                      </label>
                    )}
                    {formulario === 'EVOLUCAO' && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label>
                          <span className="field-label">Data e hora do atendimento *</span>
                          <input type="datetime-local" className="select-field" value={horaSessao}
                            onChange={(e) => setHoraSessao(e.target.value)} />
                        </label>
                        <label>
                          <span className="field-label">Fuso horário *</span>
                          <select className="select-field" value={fuso} onChange={(e) => setFuso(e.target.value)}>
                            <option value="">Selecione o fuso</option>
                            <option value="-03:00">UTC−03:00</option>
                            <option value="-04:00">UTC−04:00</option>
                            <option value="-02:00">UTC−02:00</option>
                            <option value="+00:00">UTC+00:00</option>
                          </select>
                        </label>
                      </div>
                    )}
                    {formulario === 'ANAMNESE' && <AnamneseForm key={formsKey} clinical
                      initialValues={revisando ? versaoAtual?.conteudo as AnamneseDraft : undefined}
                      onValidated={salvar} />}
                    {formulario === 'EVOLUCAO' && <EvolucaoForm key={formsKey} clinical onValidated={salvar} />}
                    {formulario === 'LAUDO' && <LaudoForm key={formsKey} clinical
                      initialValues={revisando ? versaoAtual?.conteudo as LaudoDraft : undefined}
                      onValidated={salvar} />}
                    {salvando && <p role="status" className="text-sm text-teal-800">Gravando em transação clínica…</p>}
                  </section>
                )}

                <section className="surface p-5" aria-label="Linha do tempo do paciente">
                  <h2 className="text-xl font-semibold">Histórico do paciente</h2>
                  {historico.isPending ? (
                    <p role="status" className="mt-4 text-sm">Carregando histórico clínico…</p>
                  ) : historico.isError ? (
                    <p role="alert" className="mt-4 text-sm text-red-800">{mensagemErro(historico.error)}</p>
                  ) : historico.data?.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-600">Nenhum registro deste profissional para o paciente.</p>
                  ) : (
                    <ol className="mt-4 space-y-3">
                      {historico.data?.map((item) => (
                        <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                          <div>
                            <p className="text-xs font-semibold text-teal-800">{item.tipo}</p>
                            <p className="text-sm font-semibold">{item.titulo}</p>
                            <p className="text-xs text-slate-600">
                              {item.data.slice(0, 10)} · {item.profissional_nome}
                              {item.versao ? ` · versão ${item.versao}` : ''}
                            </p>
                          </div>
                          <Button variant="outline" onClick={() => {
                            setEntrada(item); setVersaoExibida(null); setFormulario(null);
                          }}>Consultar registro</Button>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>

                {entrada && (
                  <section className="surface space-y-4 p-5" aria-label="Detalhes do registro">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-xl font-semibold">{entrada.titulo}</h2>
                      <Button variant="ghost" onClick={() => { setEntrada(null); setFormulario(null); }}>Fechar</Button>
                    </div>
                    {detalhe.isPending ? <p role="status">Carregando detalhes autorizados…</p>
                      : detalhe.isError ? <p role="alert" className="text-red-800">{mensagemErro(detalhe.error)}</p>
                      : documento && versao ? (
                        <>
                          <div className="flex flex-wrap gap-2">
                            {documento.versoes.map((v) => (
                              <Button key={v.versao} variant={v.versao === versao.versao ? 'default' : 'outline'}
                                onClick={() => setVersaoExibida(v.versao)}>
                                Versão {v.versao}
                              </Button>
                            ))}
                          </div>
                          <p className="text-xs text-slate-600">{versao.estado} · {versao.natureza} · {versao.registrado_em.slice(0, 10)}</p>
                          {exibirValores(versao.conteudo)}
                          <div className="flex flex-wrap gap-2">
                            <Button disabled={salvando} variant="secondary"
                              onClick={() => abrirFormulario(entrada.tipo as 'ANAMNESE' | 'LAUDO', true)}>
                              {versaoAtual?.estado === 'FINALIZADO' ? 'Registrar adendo' : 'Corrigir documento'}
                            </Button>
                            {versaoAtual?.estado === 'RASCUNHO' && (
                              <Button disabled={salvando} variant="outline" onClick={() => void finalizarDocumento()}>
                                Finalizar sem assinatura
                              </Button>
                            )}
                          </div>
                          {entrada.tipo === 'LAUDO' && <p className="text-xs text-amber-800">
                            Rascunho técnico: não há emissão nem assinatura digital nesta etapa.
                          </p>}
                        </>
                      ) : detalhe.data && 'evolucao' in detalhe.data ? (
                        exibirValores(detalhe.data as unknown as Record<string, unknown>)
                      ) : null}
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
