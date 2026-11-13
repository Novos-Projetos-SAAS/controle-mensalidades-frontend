'use client';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { clientes } from '@/lib/api';
import { financeApi, type FinanceContext, type Plano } from './finance-api';
import {
  apiMoney,
  assinaturaSchema,
  competenciaSchema,
  planoSchema,
  todayLocal,
} from './finance-utils';

type BaseProps = { context: FinanceContext; onClose: () => void; onSaved: () => void };
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Não foi possível concluir a operação.';
const fieldError = (message?: string) =>
  message && (
    <span role="alert" className="mt-1 block text-xs text-red-700">
      {message}
    </span>
  );

export function PlanForm({ context, onClose, onSaved }: BaseProps) {
  const form = useForm<z.infer<typeof planoSchema>>({
    resolver: zodResolver(planoSchema),
    defaultValues: { nome: '', descricao: '', valor_base: '' },
  });
  const submit = form.handleSubmit(async (values) => {
    try {
      await financeApi.criarPlano(context, {
        nome: values.nome.trim(),
        ...(values.descricao.trim() ? { descricao: values.descricao.trim() } : {}),
        valor_base: apiMoney(values.valor_base),
      });
      toast.success('Plano criado.');
      onSaved();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogTitle className="display pr-8 text-3xl">Novo plano</DialogTitle>
        <DialogDescription className="mt-2 text-sm text-slate-600">
          O backend cria planos mensais para a área selecionada.
        </DialogDescription>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block">
            <span className="field-label">Nome *</span>
            <Input {...form.register('nome')} aria-invalid={!!form.formState.errors.nome} />
            {fieldError(form.formState.errors.nome?.message)}
          </label>
          <label className="block">
            <span className="field-label">Descrição</span>
            <textarea
              {...form.register('descricao')}
              rows={3}
              className="select-field min-h-24 py-3"
              aria-invalid={!!form.formState.errors.descricao}
            />
            {fieldError(form.formState.errors.descricao?.message)}
          </label>
          <label className="block">
            <span className="field-label">Valor mensal (R$) *</span>
            <Input
              {...form.register('valor_base')}
              inputMode="decimal"
              placeholder="0,00"
              aria-invalid={!!form.formState.errors.valor_base}
            />
            {fieldError(form.formState.errors.valor_base?.message)}
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Salvando...' : 'Criar plano'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SubscriptionForm({
  context,
  plans,
  onClose,
  onSaved,
}: BaseProps & { plans: Plano[] }) {
  const customers = useQuery({
    queryKey: ['clientes', context.organizacaoId, context.areaId, ''],
    queryFn: () => clientes(context.organizacaoId, context.areaId),
  });
  const form = useForm<z.infer<typeof assinaturaSchema>>({
    resolver: zodResolver(assinaturaSchema),
    defaultValues: {
      cliente_id: '',
      plano_comercial_id: '',
      dia_vencimento: 10,
      inicio_em: todayLocal(),
    },
  });
  const submit = form.handleSubmit(async (values) => {
    try {
      await financeApi.criarAssinatura(context, values);
      toast.success('Assinatura criada.');
      onSaved();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogTitle className="display pr-8 text-3xl">Nova assinatura</DialogTitle>
        <DialogDescription className="mt-2 text-sm text-slate-600">
          Associe um cliente ativo a um plano mensal desta área.
        </DialogDescription>
        {customers.isPending ? (
          <p role="status" className="mt-5 text-sm">
            Carregando clientes...
          </p>
        ) : customers.isError ? (
          <p role="alert" className="mt-5 text-sm text-red-700">
            {customers.error.message}
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="field-label">Cliente *</span>
              <select className="select-field" {...form.register('cliente_id')}>
                <option value="">Selecione</option>
                {customers.data
                  .filter((c) => c.ativo)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
              </select>
              {fieldError(form.formState.errors.cliente_id?.message)}
            </label>
            <label className="block">
              <span className="field-label">Plano *</span>
              <select className="select-field" {...form.register('plano_comercial_id')}>
                <option value="">Selecione</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} · {p.periodicidade.toLowerCase()}
                  </option>
                ))}
              </select>
              {fieldError(form.formState.errors.plano_comercial_id?.message)}
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="field-label">Dia de vencimento *</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={31}
                  {...form.register('dia_vencimento')}
                />
                {fieldError(form.formState.errors.dia_vencimento?.message)}
              </label>
              <label className="block">
                <span className="field-label">Início *</span>
                <Input type="date" {...form.register('inicio_em')} />
                {fieldError(form.formState.errors.inicio_em?.message)}
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Salvando...' : 'Criar assinatura'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function GenerateMonthlyForm({
  context,
  subscriptionId,
  onClose,
  onSaved,
}: BaseProps & { subscriptionId: string }) {
  const form = useForm<{ competencia: string }>({
    defaultValues: { competencia: todayLocal().slice(0, 7) },
  });
  const submit = form.handleSubmit(async ({ competencia }) => {
    const checked = competenciaSchema.safeParse(competencia);
    if (!checked.success) {
      form.setError('competencia', { message: checked.error.issues[0]?.message });
      return;
    }
    try {
      const result = await financeApi.gerarMensalidade(context, subscriptionId, competencia);
      toast.success(result.criada ? 'Mensalidade gerada.' : 'Mensalidade já existente.');
      onSaved();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle className="display pr-8 text-3xl">Gerar mensalidade</DialogTitle>
        <DialogDescription className="mt-2 text-sm text-slate-600">
          A API evita gerar duas mensalidades da mesma competência.
        </DialogDescription>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block">
            <span className="field-label">Competência *</span>
            <Input type="month" {...form.register('competencia')} />
            {fieldError(form.formState.errors.competencia?.message)}
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Gerando...' : 'Gerar mensalidade'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
