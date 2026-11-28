'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Activity, ArrowLeft, ClipboardList, FileText, History,
  Plus, RotateCcw, ShieldAlert, UserRound, Stethoscope, Printer,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { LaudoDemoPrint } from './clinical-demo-print';
import {
  AnamneseForm, EvolucaoForm, LaudoForm, ClinicalTimeline,
} from './clinical-forms';
import {
  FISIOTERAPEUTA_DEMO, PACIENTES_DEMO, estadoInicialDemo,
  finalizarEntrada, novaEntrada, revisarEntrada, ultimaVersao, resumoPaciente,
  type DadosClinicos, type EstadoDemo, type RegistroDemo, type TipoRegistro,
} from './clinical-demo-domain';
import {
  type AnamneseDraft, type EvolucaoDraft, type LaudoDraft,
} from './clinical-contracts';

const tipos: Record<TipoRegistro, string> = {
  ANAMNESE: 'Anamnese',
  EVOLUCAO: 'Evolução de sessão',
  LAUDO: 'Laudo',
};

const rotulosCampos: Record<string, string> = {
  queixa_principal: 'Queixa principal',
  historia_condicao_atual: 'História da condição atual',
  antecedentes: 'Antecedentes',
  medicamentos_alergias: 'Medicamentos e alergias informados',
  limitacoes_funcionais: 'Limitações funcionais',
  objetivos_paciente: 'Objetivos',
  avaliacao_inicial: 'Avaliação inicial',
  data_sessao: 'Data da sessão',
  objetivo_sessao: 'Objetivo da sessão',
  avaliacao_previa: 'Avaliação prévia',
  procedimentos_realizados: 'O que foi trabalhado',
  exercicios_parametros: 'Exercícios e parâmetros',
  resposta_paciente: 'Resposta do paciente',
  evolucao_clinica: 'Evolução observada',
  orientacoes: 'Orientações',
  plano_proxima_sessao: 'Próxima sessão',
  finalidade: 'Finalidade do laudo',
  fundamentacao_avaliacao: 'Fundamentação e avaliação',
  achados_funcionais: 'Achados funcionais',
  diagnostico_fisioterapeutico: 'Diagnóstico fisioterapêutico',
  conclusao: 'Conclusão',
  recomendacoes: 'Recomendações',
};

function registroMaisRecente(registro: RegistroDemo) {
  return ultimaVersao(registro);
}

function dataHora(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo',
  }).format(new Date(value));
}

export function ClinicalDemo({ modo = 'servidor-local' }: {
  modo?: 'servidor-local' | 'previa-temporaria';
}) {
  // Na prévia publicada, todo estado fica exclusivamente na memória da aba.
  // Jamais chama /api/prontuario-demo, APIs clínicas, Neon ou armazenamento local.
  const previaTemporaria = modo === 'previa-temporaria';
  const [estado, setEstado] = useState(estadoInicialDemo);
  const [revisao, setRevisao] = useState(0);
  const [carregando, setCarregando] = useState(!previaTemporaria);
  const [pronto, setPronto] = useState(previaTemporaria);
  const [gravando, setGravando] = useState(false);
  const trava = useRef(false);
  const [pacienteId, setPacienteId] = useState(PACIENTES_DEMO[0]!.id);
  const [busca, setBusca] = useState('');
  const [formulario, setFormulario] = useState<TipoRegistro | null>(null);
  const [editarId, setEditarId] = useState<string | null>(null);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [versaoSelecionada, setVersaoSelecionada] = useState<number | null>(null);
  const [justificativa, setJustificativa] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [formularioSerial, setFormularioSerial] = useState(0);

  // A persistência em arquivo só existe no modo antigo de desenvolvimento local.
  async function carregar() {
    if (previaTemporaria) return;
    const resposta = await fetch('/api/prontuario-demo', {
      cache: 'no-store', credentials: 'same-origin',
    });
    if (!resposta.ok) throw new Error('A persistência local não está disponível.');
    const snapshot = await resposta.json() as { estado: typeof estado; revisao: number };
    setEstado(snapshot.estado);
    setRevisao(snapshot.revisao);
    setPronto(true);
  }

  useEffect(() => {
    if (previaTemporaria) return;
    let ativo = true;
    fetch('/api/prontuario-demo', { cache: 'no-store', credentials: 'same-origin' })
      .then(async (resposta) => {
        if (!resposta.ok) throw new Error('A persistência local não está disponível.');
        return resposta.json() as Promise<{ estado: typeof estado; revisao: number }>;
      })
      .then((snapshot) => {
        if (!ativo) return;
        setEstado(snapshot.estado);
        setRevisao(snapshot.revisao);
        setPronto(true);
      })
      .catch(() => {
        if (ativo) setErro('Não foi possível carregar o histórico do servidor. Nenhuma alteração será feita.');
      })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [previaTemporaria]);

  async function executar(comando: Record<string, unknown>) {
    if (!pronto || trava.current) return null;
    trava.current = true;
    setGravando(true);
    setErro('');
    setMensagem('');
    try {
      if (previaTemporaria) {
        // Nenhum dado é persistido ou enviado à rede; a prévia usa pacientes
        // 100% sintéticos e é reiniciada a cada recarregamento.
        const acao = comando.acao;
        const registroId = typeof comando.registroId === 'string' ? comando.registroId : null;
        const registro = registroId ? estado.registros.find((item) => item.id === registroId) : null;
        const agora = new Date().toISOString();
        let novoId: string | null = null;
        let proximo: EstadoDemo;
        if (acao === 'criar') {
          novoId = `simulado-${revisao + 1}`;
          proximo = novaEntrada(
            estado, comando.pacienteId as string, comando.tipo as TipoRegistro,
            comando.dados as DadosClinicos, novoId, agora,
          );
        } else if (acao === 'revisar' && registro && registroId) {
          if (ultimaVersao(registro).numero !== comando.versaoEsperada) {
            throw new Error('Este registro fictício mudou de versão. Atualize a prévia.');
          }
          novoId = registroId;
          proximo = revisarEntrada(
            estado, registroId, comando.dados as DadosClinicos,
            comando.justificativa as string, agora,
          );
        } else if (acao === 'finalizar' && registro && registroId) {
          if (ultimaVersao(registro).numero !== comando.versaoEsperada) {
            throw new Error('Este registro fictício mudou de versão. Atualize a prévia.');
          }
          novoId = registroId;
          proximo = finalizarEntrada(estado, registroId, agora);
        } else if (acao === 'reiniciar') {
          proximo = estadoInicialDemo();
        } else {
          throw new Error('Operação de prévia indisponível.');
        }
        setEstado(proximo);
        setRevisao((atual) => atual + 1);
        return { estado: proximo, revisao: revisao + 1, registroId: novoId };
      }
      const resposta = await fetch('/api/prontuario-demo', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...comando, revisao }),
      });
      const dados = await resposta.json() as {
        estado?: typeof estado; revisao?: number; registroId?: string | null;
        mensagem?: string;
      };
      if (!resposta.ok) {
        if (resposta.status === 409) await carregar();
        throw new Error(dados.mensagem || 'Falha ao gravar os dados de demonstração.');
      }
      if (!dados.estado || dados.revisao === undefined) {
        throw new Error('Resposta incompleta do armazenamento local.');
      }
      setEstado(dados.estado);
      setRevisao(dados.revisao);
      return dados;
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar o registro fictício.');
      return null;
    } finally {
      trava.current = false;
      setGravando(false);
    }
  }

  const paciente = PACIENTES_DEMO.find((p) => p.id === pacienteId)!;
  const registros = estado.registros.filter((r) => r.pacienteId === pacienteId);
  const selecionado = registros.find((r) => r.id === selecionadoId) || null;
  const versaoAtual = selecionado ? registroMaisRecente(selecionado) : null;
  const versaoExibida = selecionado
    ? selecionado.versoes.find((v) => v.numero === versaoSelecionada) || versaoAtual
    : null;
  const editar = editarId ? registros.find((r) => r.id === editarId) : null;

  function abrirNovo(tipo: TipoRegistro) {
    setFormulario(tipo);
    setEditarId(null);
    setJustificativa('');
    setErro('');
    setMensagem('');
    setFormularioSerial((n) => n + 1);
  }

  function abrirEdicao(registro: RegistroDemo) {
    setFormulario(registro.tipo);
    setEditarId(registro.id);
    setJustificativa('');
    setErro('');
    setMensagem('');
    setFormularioSerial((n) => n + 1);
  }

  async function salvar(dados: DadosClinicos) {
    if (!formulario || !pronto) return;
    const registro = editarId ? estado.registros.find((r) => r.id === editarId) : null;
    if (editarId && !registro) return;
    const retorno = await executar(registro
      ? {
          acao: 'revisar', registroId: registro.id,
          versaoEsperada: ultimaVersao(registro).numero,
          dados, justificativa,
        }
      : { acao: 'criar', pacienteId, tipo: formulario, dados });
    if (!retorno?.registroId) return;
    setSelecionadoId(retorno.registroId);
    setVersaoSelecionada(null);
    setFormulario(null);
    setEditarId(null);
    setMensagem(previaTemporaria
      ? 'Registro fictício atualizado nesta prévia. Ao recarregar a página, as alterações desaparecem.'
      : registro
        ? 'Correção ou adendo salvo no servidor local. Versões anteriores preservadas.'
        : 'Registro fictício salvo no servidor local. Pode atualizar a página.');
  }

  async function finalizar() {
    if (!selecionado || !pronto) return;
    const retorno = await executar({
      acao: 'finalizar', registroId: selecionado.id,
      versaoEsperada: ultimaVersao(selecionado).numero,
    });
    if (!retorno) return;
    setVersaoSelecionada(null);
    setMensagem(previaTemporaria
      ? 'Finalização simulada somente nesta aba, sem assinatura ou persistência.'
      : 'Finalização fictícia persistida no servidor, sem assinatura profissional.');
  }

  function selecionarPaciente(id: string) {
    setPacienteId(id);
    setSelecionadoId(null);
    setVersaoSelecionada(null);
    setFormulario(null);
    setEditarId(null);
    setMensagem('');
    setErro('');
  }

  async function limparDemo() {
    if (!window.confirm(previaTemporaria
      ? 'Reiniciar os registros fictícios temporários desta prévia?'
      : 'Reiniciar todos os registros fictícios salvos neste servidor?')) return;
    const retorno = await executar({ acao: 'reiniciar' });
    if (!retorno) return;
    selecionarPaciente(PACIENTES_DEMO[0]!.id);
    setMensagem(previaTemporaria
      ? 'Prévia reiniciada nesta aba.'
      : 'Treinamento reiniciado e salvo no servidor local.');
  }

  if (carregando) {
    return <main role="status" className="mx-auto max-w-3xl p-8">Carregando registros fictícios do servidor local…</main>;
  }
  if (!pronto) {
    return <main className="mx-auto max-w-3xl p-8" role="alert">
      <h1 className="text-2xl font-bold">Prontuário de treinamento indisponível</h1>
      <p className="mt-3">{erro}</p>
      <Button className="mt-4" onClick={() => window.location.reload()}>Tentar novamente</Button>
    </main>;
  }

  return (
    <main className="mx-auto min-h-screen max-w-[1440px] px-4 py-7 sm:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-teal-800 text-white">
            <Stethoscope size={23} aria-hidden />
          </div>
          <div>
            <p className="text-xs font-semibold tracking-[.18em] text-teal-800 uppercase">
              Fisioterapia · Ambiente de demonstração
            </p>
            <h1 className="display text-3xl font-bold sm:text-4xl">Prontuário do paciente</h1>
          </div>
        </div>
        <Link href={previaTemporaria ? '/' : '/login'} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-teal-800 hover:underline">
          <ArrowLeft size={17} aria-hidden /> Voltar ao sistema
        </Link>
      </div>

      <section aria-label="Aviso de demonstração"
        className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 shrink-0" size={20} aria-hidden />
          <div>
            <strong className="block">SIMULAÇÃO — não inserir dados de pacientes reais</strong>
            <p className="mt-1">
              {previaTemporaria
                ? 'Prévia interativa com pacientes inteiramente fictícios, sem acesso ao banco clínico. As alterações ficam apenas na memória desta aba e desaparecem ao atualizar ou sair. Não há assinatura nem validade profissional. Nunca preencha dados reais.'
                : 'Simulação sem dados reais, sem banco clínico, sem assinatura ou validade profissional. Os registros fictícios são salvos no disco do servidor Next.js de desenvolvimento, inclusive após recarregar ou abrir outro navegador no mesmo servidor. Não é o prontuário clínico definitivo. Nunca preencha dados reais.'}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="surface h-fit p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Pacientes de teste</h2>
            <UserRound size={18} aria-hidden className="text-teal-800" />
          </div>
          <label className="field-label" htmlFor="busca-demo">Pesquisar paciente fictício</label>
          <input
            id="busca-demo"
            className="select-field mb-4"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Nome do paciente"
          />
          <div className="space-y-2">
            {PACIENTES_DEMO.filter((p) => p.nome.toLowerCase().includes(busca.toLowerCase())).map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={p.id === pacienteId}
                onClick={() => selecionarPaciente(p.id)}
                className={`w-full rounded-xl border p-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-teal-700 ${
                  p.id === pacienteId
                    ? 'border-teal-600 bg-teal-50 text-teal-950'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <span className="block font-semibold">{p.nome}</span>
                <span className="mt-1 block text-xs text-slate-600">{p.demanda}</span>
              </button>
            ))}
          </div>
          <div className="mt-6 border-t border-slate-200 pt-4">
            <p className="text-xs text-slate-600">Profissional autenticado nesta simulação</p>
            <p className="mt-1 text-sm font-semibold">{FISIOTERAPEUTA_DEMO.nome}</p>
            <p className="mt-1 text-xs text-slate-500">{FISIOTERAPEUTA_DEMO.registro}</p>
            <Button variant="outline" className="mt-4 w-full" disabled={gravando} onClick={limparDemo}>
              <RotateCcw size={16} aria-hidden /> Reiniciar treinamento
            </Button>
          </div>
        </aside>

        <div className="min-w-0 space-y-5">
          <section className="surface p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold tracking-widest text-teal-700 uppercase">Ficha clínica fictícia</p>
                <h2 className="display mt-1 text-3xl">{paciente.nome}</h2>
                <p className="mt-2 text-sm text-slate-600">
                  {paciente.idade} anos · {paciente.demanda} · {registros.length} registro(s) no histórico
                </p>
              </div>
              <span className="rounded-full bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800">
                Paciente fictício
              </span>
            </div>
            <div className="mt-6 flex flex-wrap gap-2" aria-label="Criar registro clínico">
              <Button disabled={gravando} onClick={() => abrirNovo('ANAMNESE')}>
                <ClipboardList size={17} aria-hidden /> Nova anamnese
              </Button>
              <Button disabled={gravando} onClick={() => abrirNovo('EVOLUCAO')} variant="secondary">
                <Activity size={17} aria-hidden /> Nova evolução
              </Button>
              <Button disabled={gravando} onClick={() => abrirNovo('LAUDO')} variant="outline">
                <FileText size={17} aria-hidden /> Novo laudo
              </Button>
            </div>
          </section>

          {gravando && <p role="status" className="text-sm text-teal-800">{previaTemporaria ? 'Atualizando prévia temporária…' : 'Salvando no servidor local…'}</p>}
          {mensagem && <div role="status" className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">{mensagem}</div>}
          {erro && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{erro}</div>}

          {formulario && (
            <section className="surface space-y-5 p-5 sm:p-7" aria-label="Formulário clínico de treinamento">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold tracking-wide text-teal-800 uppercase">
                    {editar ? 'Nova revisão / adendo' : 'Novo registro'}
                  </p>
                  <h2 className="display mt-1 text-2xl">{tipos[formulario]}</h2>
                </div>
                <Button variant="ghost" onClick={() => { setFormulario(null); setEditarId(null); setErro(''); }}>
                  Cancelar
                </Button>
              </div>
              {editar && (
                <label className="block">
                  <span className="field-label">
                    Motivo da {ultimaVersao(editar).estado === 'FINALIZADO' ? 'inclusão do adendo' : 'correção'} *
                  </span>
                  <textarea
                    aria-label="Motivo da revisão"
                    className="select-field min-h-24 py-3"
                    value={justificativa}
                    onChange={(event) => setJustificativa(event.target.value)}
                    placeholder="Descreva por que esta nova versão é necessária"
                  />
                </label>
              )}
              {formulario === 'ANAMNESE' && (
                <AnamneseForm
                  key={formularioSerial}
                  demo
                  initialValues={editar ? ultimaVersao(editar).dados as AnamneseDraft : undefined}
                  onValidated={salvar}
                />
              )}
              {formulario === 'EVOLUCAO' && (
                <EvolucaoForm
                  key={formularioSerial}
                  demo
                  initialValues={editar ? ultimaVersao(editar).dados as EvolucaoDraft : undefined}
                  onValidated={salvar}
                />
              )}
              {formulario === 'LAUDO' && (
                <LaudoForm
                  key={formularioSerial}
                  demo
                  initialValues={editar ? ultimaVersao(editar).dados as LaudoDraft : undefined}
                  onValidated={salvar}
                />
              )}
            </section>
          )}

          <section className="surface p-5 sm:p-7">
            <ClinicalTimeline
              entries={resumoPaciente(estado, pacienteId)}
              onSelect={(id) => {
                setSelecionadoId(id);
                setVersaoSelecionada(null);
                setFormulario(null);
                setEditarId(null);
                setErro('');
              }}
            />
          </section>

          {selecionado && versaoExibida && versaoAtual && (
            <section className="surface p-5 sm:p-7" aria-label="Detalhe do registro clínico">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold tracking-wide text-teal-800 uppercase">
                    <History className="mr-1 inline-block" size={15} aria-hidden />
                    Histórico de versões
                  </p>
                  <h2 className="display mt-1 text-2xl">{tipos[selecionado.tipo]}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Versão {versaoExibida.numero} · {versaoExibida.natureza.toLowerCase()} · {versaoExibida.estado.toLowerCase()}
                  </p>
                </div>
                <Button variant="ghost" onClick={() => setSelecionadoId(null)}>Fechar detalhes</Button>
              </div>
              <div className="mt-5 flex flex-wrap gap-2" aria-label="Selecionar versão anterior">
                {selecionado.versoes.map((v) => (
                  <Button
                    key={v.numero}
                    size="sm"
                    variant={v.numero === versaoExibida.numero ? 'default' : 'outline'}
                    onClick={() => setVersaoSelecionada(v.numero)}
                  >
                    Versão {v.numero}
                  </Button>
                ))}
              </div>
              <div className="mt-5 rounded-xl bg-slate-50 p-4 text-xs text-slate-600">
                Registrado em {dataHora(versaoExibida.registradaEm)} por {versaoExibida.autor}.
                <p className="mt-1">Justificativa: {versaoExibida.justificativa}</p>
              </div>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                {Object.entries(versaoExibida.dados).map(([campo, valor]) => (
                  <div key={campo} className="min-w-0 border-b border-slate-100 pb-3">
                    <dt className="text-xs font-semibold text-slate-600">
                      {rotulosCampos[campo] || campo}
                    </dt>
                    <dd className="mt-1 whitespace-pre-wrap break-words text-sm font-medium text-slate-900">
                      {String(valor || 'Não informado')}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-200 pt-5">
                <Button onClick={() => abrirEdicao(selecionado)} disabled={gravando} variant="secondary">
                  <Plus size={16} aria-hidden />
                  {versaoAtual.estado === 'FINALIZADO' ? 'Registrar adendo' : 'Corrigir registro'}
                </Button>
                {versaoAtual.estado === 'RASCUNHO' && (
                  <Button onClick={finalizar} disabled={gravando} variant="outline">
                    Finalizar na simulação
                  </Button>
                )}
                {selecionado.tipo === 'LAUDO' && (
                  <Button
                    variant="outline"
                    onClick={() => window.print()}
                    aria-label="Imprimir prévia do laudo fictício"
                  >
                    <Printer size={16} aria-hidden /> Imprimir prévia fictícia
                  </Button>
                )}
              </div>
              {selecionado.tipo === 'LAUDO' && (
                <>
                  <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                    LAUDO FICTÍCIO, SEM ASSINATURA E SEM VALIDADE PROFISSIONAL.
                    A impressão é somente uma prévia de treinamento, com marca d’água.
                  </p>
                  <LaudoDemoPrint paciente={paciente} versao={versaoExibida} />
                </>
              )}
            </section>
          )}
          {!registros.length && !formulario && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">
              Este paciente fictício ainda não possui registros. Use uma das ações acima para começar.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
