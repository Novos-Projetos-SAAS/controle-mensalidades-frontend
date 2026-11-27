'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ErrorState, LoadingState } from '@/components/query-state';
import { ApiError } from '@/lib/api';
import { useSession } from '@/features/auth/session';
import { financeApi, useFinanceQuery, type FinanceContext, type Mensalidade } from './finance-api';
import {
  apiMoney,
  financeErrorMessage,
  cents,
  hasNewPayment,
  money,
  recebimentoSchema,
} from './finance-utils';

type Values = z.infer<typeof recebimentoSchema>;
type Attempt = {
  key: string;
  payload: { valor: string; forma_pagamento: string; pago_em: string };
  before: string[];
};
const storedAttemptSchema = z.strictObject({
  version: z.literal(1),
  scope: z.string(),
  attempt: z.strictObject({
    key: z.uuid(),
    payload: z.strictObject({
      valor: z
        .string()
        .regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/)
        .refine((value) => cents(value) > BigInt(0)),
      forma_pagamento: z
        .string()
        .min(1)
        .max(30)
        .refine((value) => value.trim() === value),
      pago_em: z.iso.datetime().refine((value) => Number.isFinite(Date.parse(value))),
    }),
    before: z.array(z.string().min(1)),
  }),
});
const storageKey = (scope: string) => `financeiro:recebimento:v1:${scope}`;
function readAttempt(scope: string | null): { attempt: Attempt | null; message: string } {
  if (!scope)
    return { attempt: null, message: 'Não foi possível identificar sua sessão. Entre novamente.' };
  try {
    const stored = sessionStorage.getItem(storageKey(scope));
    if (!stored) return { attempt: null, message: '' };
    const parsed = storedAttemptSchema.safeParse(JSON.parse(stored));
    if (!parsed.success || parsed.data.scope !== scope) throw new Error('Tentativa inválida');
    return { attempt: parsed.data.attempt, message: '' };
  } catch {
    return {
      attempt: null,
      message:
        'Não foi possível recuperar a tentativa de recebimento. Confira o histórico e procure o suporte antes de tentar novamente.',
    };
  }
}
function removeAttempt(scope: string) {
  try {
    sessionStorage.removeItem(storageKey(scope));
  } catch {
    // Uma entrada remanescente será conferida no servidor antes de qualquer repetição.
  }
}
const localDateTime = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

type ReceiveDialogProps = {
  context: FinanceContext;
  id: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

export function ReceiveDialog(props: ReceiveDialogProps) {
  const { session } = useSession();
  const userId = session?.usuario.id;
  const scope =
    userId && props.context.organizacaoId && props.context.areaId
      ? JSON.stringify([userId, props.context.organizacaoId, props.context.areaId, props.id])
      : null;
  return <ReceiveContent key={scope ?? 'sem-sessao'} {...props} scope={scope} />;
}

function ReceiveContent({
  context,
  id,
  onClose,
  onSaved,
  scope,
}: ReceiveDialogProps & { scope: string | null }) {
  const [recovery] = useState(() => readAttempt(scope));
  const pending = recovery.attempt;
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
  const completed = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const [sending, setSending] = useState(false);
  const [uncertain, setUncertain] = useState(!!pending);
  const [verified, setVerified] = useState(false);
  const [blocked, setBlocked] = useState(!!recovery.message);
  const [message, setMessage] = useState(recovery.message);

  async function finish(message: string) {
    completed.current = true;
    setBlocked(true);
    setUncertain(false);
    if (scope) removeAttempt(scope);
    toast.success(message);
    try {
      await onSaved();
      if (active.current) onClose();
    } catch {
      if (active.current)
        setMessage(`${message} Não foi possível atualizar a tela. Feche e consulte o histórico.`);
    }
  }

  async function verify() {
    if (locked.current || completed.current || !scope) return;
    locked.current = true;
    try {
      const fresh = await financeApi.mensalidade(context, id);
      if (!active.current) return;
      const before = attempt.current?.before || [];
      if (fresh.status === 'PAGA') {
        await finish('Mensalidade quitada.');
        return;
      }
      if (fresh.status === 'CANCELADA') {
        setBlocked(true);
        setUncertain(false);
        removeAttempt(scope);
        setMessage('Esta mensalidade foi cancelada e não aceita novo recebimento.');
      } else if (hasNewPayment(before, fresh.pagamentos || [])) {
        setBlocked(true);
        setVerified(false);
        setMessage(
          'A situação do pagamento mudou. Confira o histórico de recebimentos antes de continuar.',
        );
      } else {
        setVerified(true);
        setMessage(
          'Nenhum novo recebimento foi encontrado. Você pode tentar novamente com os mesmos dados.',
        );
      }
      await detail.refetch();
    } catch (error) {
      if (active.current)
        setMessage(
          financeErrorMessage(error, 'Não foi possível conferir o recebimento. Tente novamente.'),
        );
    } finally {
      locked.current = false;
    }
  }

  async function onValid(values: Values) {
    if (locked.current || completed.current || blocked || !scope || (uncertain && !verified))
      return;
    locked.current = true;
    setSending(true);
    setMessage('');
    let posted = false;
    let result: Awaited<ReturnType<typeof financeApi.receber>>;
    try {
      const payload = attempt.current?.payload ?? {
        valor: apiMoney(values.valor),
        forma_pagamento: values.forma_pagamento.trim(),
        pago_em: new Date(values.pago_em).toISOString(),
      };
      if (!attempt.current) {
        const fresh: Mensalidade = await financeApi.mensalidade(context, id);
        if (!active.current) return;
        if (fresh.status === 'PAGA') {
          await finish('Mensalidade quitada.');
          return;
        }
        if (fresh.status === 'CANCELADA' || cents(payload.valor) > cents(fresh.saldo)) {
          setBlocked(true);
          setMessage(
            'O valor em aberto ou a situação do pagamento mudou. Reabra a mensalidade para conferir.',
          );
          return;
        }
        attempt.current = {
          key: crypto.randomUUID(),
          payload,
          before: (fresh.pagamentos || []).map((p) => p.id),
        };
      }
      try {
        sessionStorage.setItem(
          storageKey(scope),
          JSON.stringify({ version: 1, scope, attempt: attempt.current }),
        );
      } catch {
        setBlocked(true);
        setMessage(
          'Não foi possível guardar a tentativa de recebimento neste navegador. Nenhum novo envio foi feito. Habilite o armazenamento e reabra esta janela.',
        );
        return;
      }
      posted = true;
      result = await financeApi.receber(context, id, attempt.current.key, attempt.current.payload);
    } catch (error) {
      if (!active.current) return;
      if (!posted) {
        setMessage('Não foi possível consultar o saldo. Nenhum recebimento foi enviado.');
      } else if (
        !(error instanceof ApiError) ||
        error.status === 0 ||
        error.status === 408 ||
        error.status >= 500 ||
        error.code === 'MENSALIDADE_JA_PAGA'
      ) {
        setUncertain(true);
        setVerified(false);
        setMessage(
          'Ainda não conseguimos confirmar o pagamento. Consulte a situação antes de tentar novamente.',
        );
        if (error instanceof ApiError && error.code === 'MENSALIDADE_JA_PAGA') {
          locked.current = false;
          await verify();
        }
      } else {
        attempt.current = null;
        removeAttempt(scope);
        setUncertain(false);
        setVerified(false);
        setMessage(
          financeErrorMessage(error, 'Não foi possível registrar o recebimento. Tente novamente.'),
        );
      }
      return;
    } finally {
      locked.current = false;
      setSending(false);
    }
    if (active.current)
      await finish(result.repetido ? 'Recebimento já registrado.' : 'Recebimento registrado.');
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
        if (!open && !sending) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogTitle className="display pr-8 text-3xl">Registrar recebimento</DialogTitle>
        <DialogDescription className="mt-2 text-sm text-slate-600">
          Esta ação grava um recebimento manual real. Confira os dados antes de confirmar.
        </DialogDescription>
        {message && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
          >
            {message}
          </p>
        )}
        {detail.isPending ? (
          <div className="mt-5">
            <LoadingState rows={2} />
          </div>
        ) : detail.isError ? (
          <div className="mt-5">
            <ErrorState
              message={financeErrorMessage(
                detail.error,
                'Não foi possível carregar a mensalidade. Tente novamente.',
              )}
              retry={() => detail.refetch()}
            />
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
                  <dt className="text-slate-500">Valor em aberto</dt>
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
                      Confirmo que este valor foi recebido e desejo registrar o pagamento.
                    </span>
                  </label>
                  {form.formState.errors.confirmado && (
                    <span role="alert" className="text-xs text-red-700">
                      {form.formState.errors.confirmado.message}
                    </span>
                  )}
                  {uncertain && (
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" onClick={verify}>
                        Conferir recebimento
                      </Button>
                      {verified && !blocked && (
                        <Button type="submit" disabled={sending}>
                          Tentar novamente
                        </Button>
                      )}
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={onClose} disabled={sending}>
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
