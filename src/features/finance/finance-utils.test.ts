import { describe, expect, it } from 'vitest';
import {
  apiMoney,
  cents,
  hasNewPayment,
  money,
  planoSchema,
  assinaturaSchema,
  recebimentoSchema,
  sameReceiptPayload,
} from './finance-utils';

describe('contratos financeiros', () => {
  it('formata valores brasileiros e conserva centavos sem arredondar no envio', () => {
    expect(money('1234.50')).toBe('R$ 1.234,50');
    expect(apiMoney('1234,50')).toBe('1234.50');
    expect(cents('1234.50')).toBe(BigInt(123450));
  });
  it('valida plano, assinatura e confirmação explícita', () => {
    expect(
      planoSchema.safeParse({ nome: 'Mensal', descricao: '', valor_base: '0,00' }).success,
    ).toBe(false);
    expect(
      planoSchema.safeParse({ nome: 'Mensal', descricao: '', valor_base: '59,90' }).success,
    ).toBe(true);
    expect(
      assinaturaSchema.safeParse({
        cliente_id: crypto.randomUUID(),
        plano_comercial_id: crypto.randomUUID(),
        dia_vencimento: 32,
        inicio_em: '2026-11-10',
      }).success,
    ).toBe(false);
    expect(
      recebimentoSchema.safeParse({
        valor: '20,00',
        forma_pagamento: 'PIX',
        pago_em: '2026-11-10T12:00',
        confirmado: false,
      }).success,
    ).toBe(false);
  });
  it('reutiliza uma tentativa somente com payload idêntico e detecta mudança no servidor', () => {
    const original = {
      valor: '20.00',
      forma_pagamento: 'PIX',
      pago_em: '2026-11-10T12:00:00.000Z',
    };
    expect(sameReceiptPayload(original, { ...original })).toBe(true);
    expect(sameReceiptPayload(original, { ...original, valor: '21.00' })).toBe(false);
    expect(hasNewPayment(['p1'], [{ id: 'p1' }])).toBe(false);
    expect(hasNewPayment(['p1'], [{ id: 'p1' }, { id: 'p2' }])).toBe(true);
  });
});
