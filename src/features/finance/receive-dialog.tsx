'use client';
import { useRef, useState, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ErrorState, LoadingState } from '@/components/query-state';
import { ApiError } from '@/lib/api';
import { financeApi, useFinanceQuery, type FinanceContext, type Mensalidade } from './finance-api';
import {
  apiMoney,
  cents,
  hasNewPayment,
  money,
  recebimentoSchema,
  sameReceiptPayload,
} from './finance-utils';

type Values = z.infer<typeof recebimentoSchema>;
type Attempt = {
  key: string;
  payload: { valor: string; forma_pagamento: string; pago_em: string };
  before: string[];
};
const pendingAttempts = new Map<string, Attempt>();
const localDateTime = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

export function ReceiveDialog({
  context,
  id,
  onClose,
  onSaved,
}: {
  context: FinanceContext;
  id: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const scope = `${context.organizacaoId}:${context.areaId}:${id}`;
  const pending = pendingAttempts.get(scope);
  const detail = useFinanceQuery(context, ['mensalidade', id], (signal) =>
    financeApi.mensalidade(context, id, signal),
  );
  const form = useForm<Values>({
    resolver: zodResolver(recebimentoSchema),
    defaultValues: pending
      ? {
          valor: pending.payload.valor,
          forma_pagamento: pending.payload.forma_pagamento,
          pago_em: (() => {
            const date = new Date(pending.payload.pago_em);
            return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
              .toISOString()
              .slice(0, 16);
          })(),
          confirmado: true,
        }
      : { valor: '', forma_pagamento: '', pago_em: localDateTime(), confirmado: false },
  });
  const attempt = useRef<Attempt | null>(pending || null);
  const locked = useRef(false);
  const [sending, setSending] = useState(false);
  const [uncertain, setUncertain] = useState(!!pending);
  const [verified, setVerified] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [message, setMessage] = useState('');

  async function verify() {
    try {
      const fresh = await financeApi.mensalidade(context, id);
      const before = attempt.current?.before || [];
      if (
        hasNewPayment(before, fresh.pagamentos || []) ||
        fresh.status === 'PAGA' ||
        fresh.status === 'CANCELADA'
      ) {
        setBlocked(true);
        setUncertain(false);
        pendingAttempts.delete(scope);
        setMessage(
          'O estado no servidor mudou. Confira o histórico do recebimento antes de qualquer nova operação.',
        );
      } else {
        setVerified(true);
        setMessage(
          'Nenhum novo recebimento consta agora. Você pode repetir somente a mesma tentativa; o servidor usará a mesma chave.',
        );
      }
      await detail.refetch();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível consultar o servidor.');
    }
  }

  async function onValid(values: Values) {
    if (locked.current || blocked || (uncertain && !verified)) return;
    locked.current = true;
    setSending(true);
    setMessage('');
    try {
      const payload = {
        valor: apiMoney(values.valor),
        forma_pagamento: values.forma_pagamento.trim(),
        pago_em: new Date(values.pago_em).toISOString(),
      };
      if (attempt.current && !sameReceiptPayload(attempt.current.payload, payload)) {
        setBlocked(true);
        setMessage(
          'Os dados da tentativa mudaram. Confira o servidor antes de iniciar outra operação.',
        );
        return;
      }
      if (!attempt.current) {
        const fresh: Mensalidade = await financeApi.mensalidade(context, id);
        if (
          fresh.status === 'PAGA' ||
          fresh.status === 'CANCELADA' ||
          cents(payload.valor) > cents(fresh.saldo)
        ) {
          setBlocked(true);
          setMessage(
            'O saldo ou a situação mudou no servidor. Reabra a mensalidade para conferir.',
          );
          return;
        }
        attempt.current = {
          key: crypto.randomUUID(),
          payload,
          before: (fresh.pagamentos || []).map((p) => p.id),
        };
        pendingAttempts.set(scope, attempt.current);
      }
      const result = await financeApi.receber(
        context,
        id,
        attempt.current.key,
        attempt.current.payload,
      );
      toast.success(result.repetido ? 'Recebimento já registrado.' : 'Recebimento registrado.');
      pendingAttempts.delete(scope);
      onSaved();
      onClose();
    } catch (error) {
      if (error instanceof ApiError && (error.status === 0 || error.status >= 500)) {
        if (attempt.current) {
          setUncertain(true);
          setVerified(false);
          setMessage(
            'Não foi possível confirmar o resultado. Consulte o servidor antes de repetir a mesma tentativa.',
          );
        } else setMessage('Não foi possível consultar o saldo. Nenhum recebimento foi enviado.');
      } else {
        attempt.current = null;
        pendingAttempts.delete(scope);
        setUncertain(false);
        setVerified(false);
        setMessage(error instanceof Error ? error.message : 'Falha ao registrar recebimento.');
      }
    } finally {
      locked.current = false;
      setSending(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    void form.handleSubmit(onValid)(event);
  }

  const invoice = detail.data;
  const canReceive =
    invoice &&
    invoice.status !== 'PAGA' &&
    invoice.status !== 'CANCELADA' &&
    cents(invoice.saldo) > BigInt(0);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !sending && !uncertain) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogTitle className="display pr-8 text-3xl">Registrar recebimento</DialogTitle>
        <DialogDescription className="mt-2 text-sm text-slate-600">
          Esta ação grava um recebimento manual real. Confira os dados antes de confirmar.
        </DialogDescription>
        {detail.isPending ? (
          <div className="mt-5">
            <LoadingState rows={2} />
          </div>
        ) : detail.isError ? (
          <div className="mt-5">
            <ErrorState message={detail.error.message} retry={() => detail.refetch()} />
          </div>
        ) : (
          invoice && (
            <>
              <dl className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm">
                <div className="col-span-2">
                  <dt className="text-slate-500">Cliente</dt>
                  <dd className="font-semibold">{invoice.cliente_nome}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Valor original</dt>
                  <dd className="font-semibold">{money(invoice.valor_final)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Saldo no servidor</dt>
                  <dd className="font-semibold">{money(invoice.saldo)}</dd>
                </div>
              </dl>
              {!canReceive ? (
                <p role="alert" className="mt-4 text-sm text-amber-800">
                  Esta mensalidade não aceita novo recebimento.
                </p>
              ) : (
                <form onSubmit={submit} className="mt-5 space-y-4">
                  <label className="block">
                    <span className="field-label">Valor a receber (R$) *</span>
                    <Input
                      {...form.register('valor')}
                      inputMode="decimal"
                      placeholder="0,00"
                      disabled={uncertain || sending}
                    />
                    {form.formState.errors.valor && (
                      <span role="alert" className="text-xs text-red-700">
                        {form.formState.errors.valor.message}
                      </span>
                    )}
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="field-label">Data do recebimento *</span>
                      <Input
                        type="datetime-local"
                        {...form.register('pago_em')}
                        disabled={uncertain || sending}
                      />
                      {form.formState.errors.pago_em && (
                        <span role="alert" className="text-xs text-red-700">
                          {form.formState.errors.pago_em.message}
                        </span>
                      )}
                    </label>
                    <label className="block">
                      <span className="field-label">Forma de pagamento *</span>
                      <Input
                        {...form.register('forma_pagamento')}
                        maxLength={30}
                        placeholder="Ex.: PIX"
                        disabled={uncertain || sending}
                      />
                      {form.formState.errors.forma_pagamento && (
                        <span role="alert" className="text-xs text-red-700">
                          {form.formState.errors.forma_pagamento.message}
                        </span>
                      )}
                    </label>
                  </div>
                  <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1 size-5 shrink-0 accent-teal-700"
                      {...form.register('confirmado')}
                      disabled={uncertain || sending}
                    />
                    <span>
                      Confirmo que este valor foi recebido e deve ser registrado no servidor.
                    </span>
                  </label>
                  {form.formState.errors.confirmado && (
                    <span role="alert" className="text-xs text-red-700">
                      {form.formState.errors.confirmado.message}
                    </span>
                  )}
                  {message && (
                    <p
                      role="alert"
                      className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
                    >
                      {message}
                    </p>
                  )}
                  {uncertain && (
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" onClick={verify}>
                        Verificar no servidor
                      </Button>
                      {verified && !blocked && (
                        <Button type="submit" disabled={sending}>
                          Repetir a mesma tentativa
                        </Button>
                      )}
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onClose}
                      disabled={uncertain || sending}
                    >
                      Cancelar
                    </Button>
                    {!uncertain && (
                      <Button type="submit" disabled={sending || blocked}>
                        {sending ? 'Registrando...' : 'Confirmar recebimento'}
                      </Button>
                    )}
                  </div>
                </form>
              )}
            </>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
