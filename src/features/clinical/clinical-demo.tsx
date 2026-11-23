'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Activity, ArrowLeft, ClipboardList, FileText, History,
  Plus, RotateCcw, ShieldAlert, UserRound, Stethoscope,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  AnamneseForm, EvolucaoForm, LaudoForm, ClinicalTimeline,
} from './clinical-forms';
import {
  FISIOTERAPEUTA_DEMO, PACIENTES_DEMO, estadoInicialDemo,
  novaEntrada, revisarEntrada, finalizarEntrada, ultimaVersao, resumoPaciente,
  type DadosClinicos, type RegistroDemo, type TipoRegistro,
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

export function ClinicalDemo() {
  const [estado, setEstado] = useState(estadoInicialDemo);
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

  function salvar(dados: DadosClinicos) {
    if (!formulario) return;
    try {
      const agora = new Date().toISOString();
      const id = editarId || crypto.randomUUID();
      const proximo = editarId
        ? revisarEntrada(estado, editarId, dados, justificativa, agora)
        : novaEntrada(estado, pacienteId, formulario, dados, id, agora);
      setEstado(proximo);
      setSelecionadoId(id);
      setVersaoSelecionada(null);
      setFormulario(null);
      setEditarId(null);
      setErro('');
      setMensagem(editarId
        ? 'Nova versão adicionada ao histórico fictício. O registro anterior foi preservado.'
        : 'Registro fictício criado nesta simulação.');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível registrar a simulação.');
    }
  }

  function finalizar() {
    if (!selecionado) return;
    try {
      setEstado(finalizarEntrada(estado, selecionado.id, new Date().toISOString()));
      setVersaoSelecionada(null);
      setErro('');
      setMensagem('Registro finalizado apenas na simulação. Não há assinatura nem validade documental.');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível finalizar.');
    }
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

  function limparDemo() {
    setEstado(estadoInicialDemo());
    selecionarPaciente(PACIENTES_DEMO[0]!.id);
    setMensagem('Os dados do treinamento foram reiniciados.');
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
        <Link href="/login" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-teal-800 hover:underline">
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
              Sem acesso ao banco, sem API clínica, sem assinatura e sem valor de laudo.
              As alterações existem somente na memória desta página e desaparecem ao recarregar.
              Esta tela só existe no servidor Next.js em desenvolvimento.
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
            <Button variant="outline" className="mt-4 w-full" onClick={limparDemo}>
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
              <Button onClick={() => abrirNovo('ANAMNESE')}>
                <ClipboardList size={17} aria-hidden /> Nova anamnese
              </Button>
              <Button onClick={() => abrirNovo('EVOLUCAO')} variant="secondary">
                <Activity size={17} aria-hidden /> Nova evolução
              </Button>
              <Button onClick={() => abrirNovo('LAUDO')} variant="outline">
                <FileText size={17} aria-hidden /> Novo laudo
              </Button>
            </div>
          </section>

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
                <Button onClick={() => abrirEdicao(selecionado)} variant="secondary">
                  <Plus size={16} aria-hidden />
                  {versaoAtual.estado === 'FINALIZADO' ? 'Registrar adendo' : 'Corrigir registro'}
                </Button>
                {versaoAtual.estado === 'RASCUNHO' && (
                  <Button onClick={finalizar} variant="outline">
                    Finalizar na simulação
                  </Button>
                )}
              </div>
              {selecionado.tipo === 'LAUDO' && (
                <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                  LAUDO FICTÍCIO, SEM ASSINATURA, SEM VALIDADE PROFISSIONAL. Esta página não exporta
                  nem emite laudos oficiais.
                </p>
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
