import { afterEach, describe, expect, it, vi } from 'vitest';
import { paymentApi } from './payments-api';

afterEach(() => vi.unstubAllGlobals());
describe('contrato InfinitePay', () => {
  it('envia configurações e geração com organização/área e sem nova URL configurável', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: null }) });
    vi.stubGlobal('fetch', fetchMock);
    const context = { organizacaoId: 'org-A', areaId: 'area-A' };
    const body = {
      ativo: true,
      geracao_automatica: true,
      dias_antecedencia: 2 as const,
      handle: 'clinica',
      api_key: 'credential',
    };
    await paymentApi.saveSettings(context, body);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/financeiro/infinitepay/configuracao');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'x-organizacao-id': 'org-A', 'x-area-negocio-id': 'area-A' },
    });
    await paymentApi.generate(context, 'mensalidade-1');
    expect(fetchMock.mock.calls[1][0]).toBe(
      '/api/v1/financeiro/mensalidades/mensalidade-1/cobranca',
    );
    expect(fetchMock.mock.calls[1][1].method).toBe('POST');
  });
  it('consulta e confirma página privada sem cookies/contexto ou evento de sessão expirada', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ data: { status: 'PENDENTE' } }) });
    vi.stubGlobal('fetch', fetchMock);
    const token = 'a'.repeat(43);
    await paymentApi.publicCharge(token);
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/v1/pagamentos/publico/${token}`);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('x-organizacao-id');
    const evidence = { order_nsu: 'o1', transaction_nsu: 't1', slug: 's1' };
    await paymentApi.confirm(token, evidence);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify(evidence),
    });
    const listener = vi.fn();
    window.addEventListener('orbe:session-expired', listener);
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ mensagem: 'Link inválido.' }),
    });
    await expect(paymentApi.publicCharge(token)).rejects.toThrow('Link inválido.');
    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener('orbe:session-expired', listener);
  });
});
