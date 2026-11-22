'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  anamneseSchema,
  evolucaoSchema,
  laudoSchema,
  type AnamneseDraft,
  type EvolucaoDraft,
  type LaudoDraft,
  type ClinicalTimelineEntry,
} from './clinical-contracts';

function Field({
  label, error, children,
}: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
      {error && <span role="alert" className="mt-1 block text-xs text-red-700">{error}</span>}
    </label>
  );
}

const areaClasse = 'select-field min-h-28 py-3';

function AvisoRascunho() {
  return (
    <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      Prévia de formulário clínico: os dados preenchidos aqui não são salvos. A publicação e a
      assinatura só serão habilitadas após a homologação do acesso profissional.
    </p>
  );
}

export function AnamneseForm({
  onValidated,
}: { onValidated: (dados: AnamneseDraft) => void }) {
  const form = useForm<z.input<typeof anamneseSchema>, unknown, AnamneseDraft>({
    resolver: zodResolver(anamneseSchema),
    defaultValues: {
      queixa_principal: '',
      historia_condicao_atual: '',
      antecedentes: '',
      medicamentos_alergias: '',
      limitacoes_funcionais: '',
      objetivos_paciente: '',
      avaliacao_inicial: '',
    },
  });
  const erros = form.formState.errors;
  return (
    <form onSubmit={form.handleSubmit(onValidated)} className="space-y-4" noValidate>
      <h2 className="text-xl font-semibold">Histórico e avaliação inicial</h2>
      <AvisoRascunho />
      <Field label="Queixa principal *" error={erros.queixa_principal?.message}>
        <textarea {...form.register('queixa_principal')} className={areaClasse} />
      </Field>
      <Field label="História da condição atual *" error={erros.historia_condicao_atual?.message}>
        <textarea {...form.register('historia_condicao_atual')} className={areaClasse} />
      </Field>
      <Field label="Antecedentes e cirurgias">
        <textarea {...form.register('antecedentes')} className={areaClasse} />
      </Field>
      <Field label="Medicamentos, alergias e cuidados informados">
        <textarea {...form.register('medicamentos_alergias')} className={areaClasse} />
      </Field>
      <Field label="Limitações funcionais *" error={erros.limitacoes_funcionais?.message}>
        <textarea {...form.register('limitacoes_funcionais')} className={areaClasse} />
      </Field>
      <Field label="Objetivos do paciente *" error={erros.objetivos_paciente?.message}>
        <textarea {...form.register('objetivos_paciente')} className={areaClasse} />
      </Field>
      <Field label="Avaliação inicial do fisioterapeuta *" error={erros.avaliacao_inicial?.message}>
        <textarea {...form.register('avaliacao_inicial')} className={areaClasse} />
      </Field>
      <Button type="submit">Validar rascunho de anamnese</Button>
    </form>
  );
}

export function EvolucaoForm({
  onValidated,
}: { onValidated: (dados: EvolucaoDraft) => void }) {
  const form = useForm<z.input<typeof evolucaoSchema>, unknown, EvolucaoDraft>({
    resolver: zodResolver(evolucaoSchema),
    defaultValues: {
      data_sessao: '',
      objetivo_sessao: '',
      avaliacao_previa: '',
      procedimentos_realizados: '',
      exercicios_parametros: '',
      resposta_paciente: '',
      evolucao_clinica: '',
      orientacoes: '',
      plano_proxima_sessao: '',
    },
  });
  const erros = form.formState.errors;
  return (
    <form onSubmit={form.handleSubmit(onValidated)} className="space-y-4" noValidate>
      <h2 className="text-xl font-semibold">Evolução da sessão</h2>
      <AvisoRascunho />
      <Field label="Data da sessão *" error={erros.data_sessao?.message}>
        <Input type="date" {...form.register('data_sessao')} />
      </Field>
      <Field label="Objetivo da sessão *" error={erros.objetivo_sessao?.message}>
        <textarea {...form.register('objetivo_sessao')} className={areaClasse} />
      </Field>
      <Field label="Avaliação antes do atendimento">
        <textarea {...form.register('avaliacao_previa')} className={areaClasse} />
      </Field>
      <Field label="O que foi trabalhado na sessão *" error={erros.procedimentos_realizados?.message}>
        <textarea {...form.register('procedimentos_realizados')} className={areaClasse}
          placeholder="Técnicas, atividades e regiões trabalhadas" />
      </Field>
      <Field label="Exercícios, séries, tempo e parâmetros">
        <textarea {...form.register('exercicios_parametros')} className={areaClasse} />
      </Field>
      <Field label="Resposta e tolerância do paciente *" error={erros.resposta_paciente?.message}>
        <textarea {...form.register('resposta_paciente')} className={areaClasse} />
      </Field>
      <Field label="Evolução clínica observada *" error={erros.evolucao_clinica?.message}>
        <textarea {...form.register('evolucao_clinica')} className={areaClasse} />
      </Field>
      <Field label="Orientações e cuidados">
        <textarea {...form.register('orientacoes')} className={areaClasse} />
      </Field>
      <Field label="Conduta planejada para próxima sessão">
        <textarea {...form.register('plano_proxima_sessao')} className={areaClasse} />
      </Field>
      <Button type="submit">Validar rascunho da evolução</Button>
    </form>
  );
}

export function LaudoForm({
  onValidated,
}: { onValidated: (dados: LaudoDraft) => void }) {
  const form = useForm<z.input<typeof laudoSchema>, unknown, LaudoDraft>({
    resolver: zodResolver(laudoSchema),
    defaultValues: {
      finalidade: '',
      fundamentacao_avaliacao: '',
      achados_funcionais: '',
      diagnostico_fisioterapeutico: '',
      conclusao: '',
      recomendacoes: '',
    },
  });
  const erros = form.formState.errors;
  return (
    <form onSubmit={form.handleSubmit(onValidated)} className="space-y-4" noValidate>
      <h2 className="text-xl font-semibold">Laudo fisioterapêutico</h2>
      <AvisoRascunho />
      <p className="text-sm text-slate-600">
        O conteúdo técnico e a conclusão devem ser elaborados e revisados pelo profissional
        responsável. Este formulário não emite documento assinado.
      </p>
      <Field label="Finalidade do laudo *" error={erros.finalidade?.message}>
        <textarea {...form.register('finalidade')} className={areaClasse} />
      </Field>
      <Field label="Fundamentação e avaliação *" error={erros.fundamentacao_avaliacao?.message}>
        <textarea {...form.register('fundamentacao_avaliacao')} className={areaClasse} />
      </Field>
      <Field label="Achados funcionais *" error={erros.achados_funcionais?.message}>
        <textarea {...form.register('achados_funcionais')} className={areaClasse} />
      </Field>
      <Field label="Diagnóstico fisioterapêutico *" error={erros.diagnostico_fisioterapeutico?.message}>
        <textarea {...form.register('diagnostico_fisioterapeutico')} className={areaClasse} />
      </Field>
      <Field label="Conclusão profissional *" error={erros.conclusao?.message}>
        <textarea {...form.register('conclusao')} className={areaClasse} />
      </Field>
      <Field label="Recomendações">
        <textarea {...form.register('recomendacoes')} className={areaClasse} />
      </Field>
      <Button type="submit">Validar rascunho de laudo</Button>
    </form>
  );
}

const rotulos: Record<ClinicalTimelineEntry['tipo'], string> = {
  ANAMNESE: 'Avaliação inicial',
  EVOLUCAO: 'Evolução de sessão',
  LAUDO: 'Laudo',
};

export function ClinicalTimeline({
  entries, onSelect,
}: {
  entries: ClinicalTimelineEntry[];
  onSelect: (id: string) => void;
}) {
  const ordenados = [...entries].sort((a, b) => b.data.localeCompare(a.data));
  return (
    <section aria-label="Histórico clínico">
      <h2 className="text-xl font-semibold">Histórico do paciente</h2>
      {!ordenados.length ? (
        <p className="mt-3 text-sm text-slate-600">Nenhum registro clínico disponível neste contexto.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {ordenados.map((item) => (
            <li key={item.id} className="surface flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-xs font-medium text-teal-800">{rotulos[item.tipo]}</p>
                <p className="font-semibold">{item.titulo}</p>
                <p className="text-xs text-slate-600">
                  {item.data.slice(0, 10)} · {item.profissional_nome}
                </p>
              </div>
              <Button type="button" variant="outline" onClick={() => onSelect(item.id)}>
                Consultar registro
              </Button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
