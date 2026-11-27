import { describe, expect, it } from 'vitest';
import {
  apiMoney,
  financeErrorMessage,
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

describe('mensagens financeiras', () => {
  it.each([
    [
      'Chave de criptografia ausente ou inválida.',
      'A configuração de pagamentos precisa ser concluída. Entre em contato com o suporte.',
    ],
    [
      'Criptografia InfinitePay não configurada.',
      'A configuração de pagamentos precisa ser concluída. Entre em contato com o suporte.',
    ],
    [
      'Trocar a InfiniteTag exige nova API Key.',
      'Ao trocar a InfiniteTag, informe uma nova chave da conta.',
    ],
    [
      'Configure a InfiniteTag e a API Key para ativar.',
      'Informe a InfiniteTag e a chave da conta para ativar.',
    ],
  ])('traduz orientação da conta sem perder a ação necessária: %s', (message, expected) => {
    expect(financeErrorMessage(new Error(message), 'Não foi possível salvar.')).toBe(expected);
  });

  it.each([
    'Falha na API',
    'Webhook inválido',
    'Payload inválido',
    'Chave de idempotência em uso',
    'Não foi possível conectar ao servidor.',
    'Internal server error',
    'TypeError: Failed to fetch',
    'duplicate key value violates unique constraint',
  ])('oculta detalhe técnico: %s', (message) => {
    expect(
      financeErrorMessage(new Error(message), 'Não foi possível carregar os pagamentos.'),
    ).toBe('Não foi possível carregar os pagamentos.');
  });
  it.each([
    'A mensalidade já está paga.',
    'Informe a chave da conta para ativar a integração.',
    'Você não tem permissão para esta operação.',
    'O valor deve ser maior que zero.',
  ])('preserva orientação de negócio: %s', (message) => {
    expect(financeErrorMessage(new Error(message), 'Não foi possível concluir.')).toBe(message);
  });
  it('usa mensagem segura quando o erro não contém texto', () => {
    expect(financeErrorMessage(null, 'Não foi possível concluir.')).toBe(
      'Não foi possível concluir.',
    );
    expect(financeErrorMessage(new Error(''), 'Não foi possível concluir.')).toBe(
      'Não foi possível concluir.',
    );
  });
});
