import { describe, expect, it } from 'vitest';
import {
  checkoutUrl,
  parsePaymentReturn,
  platformPaymentUrl,
  shouldPollPayment,
} from './payment-utils';

describe('segurança do pagamento', () => {
  it('aceita somente checkout HTTPS oficial, sem credenciais ou portas alternativas', () => {
    expect(checkoutUrl('https://checkout.infinitepay.io/abc')).toBe(
      'https://checkout.infinitepay.io/abc',
    );
    for (const url of [
      'http://checkout.infinitepay.io/a',
      'https://checkout.infinitepay.io.evil.test/a',
      'https://user@checkout.infinitepay.io/a',
      'https://checkout.infinitepay.io:444/a',
      'javascript:alert(1)',
      '//checkout.infinitepay.io/a',
    ]) {
      expect(checkoutUrl(url)).toBeNull();
    }
  });
  it('não confia em paid, exige identificadores completos e rejeita parâmetros duplicados', () => {
    const token = 'a'.repeat(43);
    const valid = `token=${token}&order_nsu=pedido_1&transaction_nsu=transacao-1&slug=slug_1`;
    expect(parsePaymentReturn(new URLSearchParams(`${valid}&paid=true`))).toEqual({
      token,
      evidence: { order_nsu: 'pedido_1', transaction_nsu: 'transacao-1', slug: 'slug_1' },
    });
    expect(parsePaymentReturn(new URLSearchParams(`token=${token}&paid=true`))).toEqual({
      token,
      evidence: null,
    });
    expect(parsePaymentReturn(new URLSearchParams(`${valid}&order_nsu=outro`))).toBeNull();
    expect(parsePaymentReturn(new URLSearchParams(`${valid}&token=${token}`))).toBeNull();
    expect(parsePaymentReturn(new URLSearchParams(`token=../login`))).toBeNull();
    expect(
      parsePaymentReturn(new URLSearchParams(`${valid.replace('slug_1', 'bad%2Fpath')}`)),
    ).toBeNull();
  });
  it('copia somente o caminho privado relativo da plataforma', () => {
    const path = `/pagamento/${'a'.repeat(43)}`;
    expect(platformPaymentUrl(path, 'https://orbe.test')).toBe(`https://orbe.test${path}`);
    expect(platformPaymentUrl('https://evil.test/pagamento/a', 'https://orbe.test')).toBeNull();
    expect(platformPaymentUrl('//evil.test/pagamento/a', 'https://orbe.test')).toBeNull();
  });
  it('limita consultas automáticas e encerra em estados terminais ou aba oculta', () => {
    expect(shouldPollPayment('AGUARDANDO_PAGAMENTO', 1, true)).toBe(true);
    expect(shouldPollPayment('AGUARDANDO_PAGAMENTO', 20, true)).toBe(false);
    expect(shouldPollPayment('AGUARDANDO_PAGAMENTO', 1, false)).toBe(false);
    for (const status of ['PAGO_VERIFICADO', 'CANCELADO', 'EXPIRADO', 'PAGO_EM_REVISAO'])
      expect(shouldPollPayment(status, 1, true)).toBe(false);
  });
});
