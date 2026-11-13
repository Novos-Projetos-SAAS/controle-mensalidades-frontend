import { z } from 'zod';

export const decimal = z
  .string()
  .trim()
  .regex(/^(?:0|[1-9]\d{0,9})(?:[.,]\d{1,2})?$/, 'Informe um valor válido.')
  .refine((value) => cents(value) > BigInt(0), 'O valor deve ser maior que zero.');
export const planoSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome.').max(150),
  descricao: z.string().trim().max(2000),
  valor_base: decimal,
});
export const assinaturaSchema = z.object({
  cliente_id: z.uuid('Selecione um cliente.'),
  plano_comercial_id: z.uuid('Selecione um plano.'),
  dia_vencimento: z.coerce.number<number>().int().min(1).max(31),
  inicio_em: z.iso.date('Informe uma data válida.'),
});
export const competenciaSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Informe uma competência válida.');
export const recebimentoSchema = z.object({
  valor: decimal,
  forma_pagamento: z.string().trim().min(1, 'Informe a forma de pagamento.').max(30),
  pago_em: z.string().min(1, 'Informe a data do recebimento.'),
  confirmado: z.boolean().refine((value) => value, 'Confirme o recebimento antes de enviar.'),
});

export function cents(value: string): bigint {
  const [whole, fraction = ''] = value.replace(',', '.').split('.');
  if (!/^(?:0|[1-9]\d*)$/.test(whole) || !/^\d{0,2}$/.test(fraction)) return BigInt(0);
  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, '0'));
}
export function apiMoney(value: string): string {
  return value.trim().replace(',', '.');
}
export type ReceiptPayload = { valor: string; forma_pagamento: string; pago_em: string };
export const sameReceiptPayload = (a: ReceiptPayload, b: ReceiptPayload) =>
  a.valor === b.valor && a.forma_pagamento === b.forma_pagamento && a.pago_em === b.pago_em;
export const hasNewPayment = (before: string[], after: { id: string }[]) =>
  after.some((payment) => !before.includes(payment.id));
export function money(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number(value),
  );
}
export function currentPeriod(): { inicio: string; fim: string } {
  const now = new Date();
  const date = (day: number) =>
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return {
    inicio: date(1),
    fim: date(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()),
  };
}
export function todayLocal(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
