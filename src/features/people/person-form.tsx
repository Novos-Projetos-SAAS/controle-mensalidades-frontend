'use client';
import { useEffect, useRef } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { api, type Area, type Cliente, type Profissional } from '@/lib/api';

const schema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome.').max(150),
  cpf: z
    .string()
    .refine(
      (value) => !value || value.replace(/\D/g, '').length === 11,
      'CPF deve ter 11 dígitos.',
    ),
  email: z.union([z.email('E-mail inválido.'), z.literal('')]),
  telefone: z
    .string()
    .refine(
      (value) => !value || /^\d{8,15}$/.test(value.replace(/\D/g, '')),
      'Telefone deve ter de 8 a 15 dígitos.',
    ),
  data_nascimento: z.string(),
  conselho: z.string(),
  numero_conselho: z.string(),
  uf_conselho: z.string(),
  areas: z.array(z.string()).min(1, 'Selecione pelo menos uma área.'),
});
type Values = z.infer<typeof schema>;
const defaults: Values = {
  nome: '',
  cpf: '',
  email: '',
  telefone: '',
  data_nascimento: '',
  conselho: '',
  numero_conselho: '',
  uf_conselho: '',
  areas: [],
};
type Props = {
  kind: 'clientes' | 'profissionais';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person?: Cliente | Profissional | null;
  areas: Area[];
  organizationId: string;
  areaId?: string;
  onSaved: () => void;
};
export function PersonForm({
  kind,
  open,
  onOpenChange,
  person,
  areas,
  organizationId,
  areaId,
  onSaved,
}: Props) {
  const isClient = kind === 'clientes';
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults });
  const { reset } = form;
  const initializedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!open) {
      initializedFor.current = null;
      return;
    }
    const formKey = person?.id || 'new';
    if (initializedFor.current === formKey) return;
    initializedFor.current = formKey;
    reset({
      nome: person?.nome || '',
      cpf: person?.cpf || '',
      email: person?.email || '',
      telefone: person?.telefone || '',
      data_nascimento: isClient ? (person as Cliente)?.data_nascimento?.slice(0, 10) || '' : '',
      conselho: !isClient ? (person as Profissional)?.conselho || '' : '',
      numero_conselho: !isClient ? (person as Profissional)?.numero_conselho || '' : '',
      uf_conselho: !isClient ? (person as Profissional)?.uf_conselho || '' : '',
      areas: person?.areas?.map((area) => area.id) || (areaId ? [areaId] : []),
    });
  }, [open, person, areaId, reset, isClient]);
  const submit = form.handleSubmit(async (values) => {
    const optional = (value: string) => value.trim() || (person ? null : undefined);
    const body: Record<string, unknown> = {
      nome: values.nome.trim(),
      areas: values.areas,
      cpf: optional(values.cpf.replace(/\D/g, '')),
      email: optional(values.email.toLowerCase()),
      telefone: optional(values.telefone.replace(/\D/g, '')),
    };
    if (isClient) body.data_nascimento = optional(values.data_nascimento);
    else {
      body.conselho = optional(values.conselho);
      body.numero_conselho = optional(values.numero_conselho);
      body.uf_conselho = optional(values.uf_conselho.toUpperCase());
    }
    Object.keys(body).forEach((key) => {
      if (body[key] === undefined) delete body[key];
    });
    try {
      await api(
        `/${kind}${person ? `/${person.id}` : ''}`,
        { method: person ? 'PATCH' : 'POST', body: JSON.stringify(body) },
        { organizacaoId: organizationId, areaId },
      );
      toast.success(person ? 'Cadastro atualizado.' : 'Cadastro criado.');
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar.');
    }
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle className="display pr-10 text-3xl">
          {person ? 'Editar' : 'Novo'} {isClient ? 'cliente' : 'profissional'}
        </DialogTitle>
        <DialogDescription className="mt-2 text-sm text-slate-600">
          Preencha os dados e escolha as áreas de negócio vinculadas.
        </DialogDescription>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block">
            <span className="field-label">Nome completo *</span>
            <Input {...form.register('nome')} aria-invalid={!!form.formState.errors.nome} />
            {form.formState.errors.nome && (
              <span role="alert" className="text-xs text-red-700">
                {form.formState.errors.nome.message}
              </span>
            )}
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="field-label">CPF</span>
              <Input
                inputMode="numeric"
                placeholder="Somente números"
                {...form.register('cpf')}
                aria-invalid={!!form.formState.errors.cpf}
              />
              {form.formState.errors.cpf && (
                <span role="alert" className="text-xs text-red-700">
                  {form.formState.errors.cpf.message}
                </span>
              )}
            </label>
            <label className="block">
              <span className="field-label">Telefone</span>
              <Input
                type="tel"
                {...form.register('telefone')}
                aria-invalid={!!form.formState.errors.telefone}
              />
              {form.formState.errors.telefone && (
                <span role="alert" className="text-xs text-red-700">
                  {form.formState.errors.telefone.message}
                </span>
              )}
            </label>
          </div>
          <label className="block">
            <span className="field-label">E-mail</span>
            <Input
              type="email"
              {...form.register('email')}
              aria-invalid={!!form.formState.errors.email}
            />
            {form.formState.errors.email && (
              <span role="alert" className="text-xs text-red-700">
                {form.formState.errors.email.message}
              </span>
            )}
          </label>
          {isClient ? (
            <label className="block">
              <span className="field-label">Data de nascimento</span>
              <Input type="date" {...form.register('data_nascimento')} />
            </label>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <label>
                <span className="field-label">Conselho</span>
                <Input {...form.register('conselho')} />
              </label>
              <label>
                <span className="field-label">Número</span>
                <Input {...form.register('numero_conselho')} />
              </label>
              <label>
                <span className="field-label">UF</span>
                <Input maxLength={2} {...form.register('uf_conselho')} />
              </label>
            </div>
          )}
          <fieldset>
            <legend className="field-label">Áreas de negócio *</legend>
            <div className="flex flex-wrap gap-2">
              {areas.map((area) => (
                <label
                  key={area.id}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm hover:border-teal-500"
                >
                  <input
                    type="checkbox"
                    value={area.id}
                    {...form.register('areas')}
                    className="accent-teal-700"
                  />
                  {area.nome}
                </label>
              ))}
            </div>
            {form.formState.errors.areas && (
              <span role="alert" className="text-xs text-red-700">
                {form.formState.errors.areas.message}
              </span>
            )}
          </fieldset>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Salvando...' : 'Salvar cadastro'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
