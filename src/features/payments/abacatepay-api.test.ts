import { afterEach, describe, expect, it, vi } from 'vitest';
import { paymentApi } from './payments-api';
import { checkoutUrl } from './payment-utils';

afterEach(() => vi.unstubAllGlobals());
const context = { organizacaoId: 'org-A', areaId: 'area-A' };
function requests() {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: null }) });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
describe('contrato AbacatePay', () => {
  it('envia credenciais somente na alteração autenticada e seleciona provedor na cobrança', async () => {
    const fetchMock = requests();
    const body = {
      ativo: true,
      ambiente: 'TESTE' as const,
      api_key: 'test-key',
      webhook_secret: 'test-webhook',
      recorrencia_habilitada: true,
      cartao_recorrente: true,
    };
    await paymentApi.saveAbacateSettings(context, body);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/financeiro/abacatepay/configuracao');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'x-organizacao-id': 'org-A', 'x-area-negocio-id': 'area-A' },
    });
    await paymentApi.generate(context, 'mensalidade/1', 'ABACATEPAY');
    expect(fetchMock.mock.calls[1][0]).toBe(
      '/api/v1/financeiro/mensalidades/mensalidade%2F1/cobranca',
    );
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ provedor: 'ABACATEPAY' });
    await paymentApi.setDefaultProvider(context, 'ABACATEPAY');
    expect(fetchMock.mock.calls[2][0]).toBe('/api/v1/financeiro/provedor-padrao');
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ provedor: 'ABACATEPAY' });
  });
  it('concilia AbacatePay sem evidências InfinitePay e vincula recorrência à assinatura', async () => {
    const fetchMock = requests();
    await paymentApi.reconcile(context, 'charge-1', {});
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({});
    await paymentApi.createRecurrence(context, 'subscription/1', 'CARD');
    expect(fetchMock.mock.calls[1][0]).toBe(
      '/api/v1/financeiro/assinaturas/subscription%2F1/recorrencia',
    );
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ metodo: 'CARD' });
    await paymentApi.reconcileRecurrence(context, 'subscription-1');
    expect(fetchMock.mock.calls[2][0]).toBe(
      '/api/v1/financeiro/assinaturas/subscription-1/recorrencia/conciliar',
    );
    await paymentApi.cancelRecurrence(context, 'subscription-1');
    expect(fetchMock.mock.calls[3][0]).toBe(
      '/api/v1/financeiro/assinaturas/subscription-1/recorrencia/cancelar',
    );
  });
  it('aceita checkout AbacatePay apenas no host/path esperado e mantém isolamento por provedor', () => {
    expect(checkoutUrl('https://app.abacatepay.com/pay/bill_test', 'ABACATEPAY')).toBe(
      'https://app.abacatepay.com/pay/bill_test',
    );
    for (const url of [
      'https://app.abacatepay.com.evil.test/pay/bill_test',
      'https://app.abacatepay.com/settings',
      'https://user@app.abacatepay.com/pay/bill_test',
      'http://app.abacatepay.com/pay/bill_test',
      'https://app.abacatepay.com:444/pay/bill_test',
      'https://buy.infinitepay.io/checkout',
    ])
      expect(checkoutUrl(url, 'ABACATEPAY')).toBeNull();
    expect(checkoutUrl('https://app.abacatepay.com/pay/bill_test', 'INFINITEPAY')).toBeNull();
  });
});
