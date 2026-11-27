import { afterEach, describe, expect, it, vi } from 'vitest';
import { financeApi, financeKey } from './finance-api';

afterEach(() => vi.unstubAllGlobals());
describe('API financeira', () => {
  const context = { organizacaoId: 'org-A', areaId: 'area-A' };
  it('isola cache e envia filtros paginados com contexto', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { items: [], pagination: { page: 2, pageSize: 20, total: 0, pages: 0 } },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);
    await financeApi.mensalidades(context, { page: 2, status: 'VENCIDA', competencia: '2026-11' });
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toContain(
      '/api/v1/financeiro/mensalidades?page=2&pageSize=20&status=VENCIDA&competencia=2026-11',
    );
    expect(request.headers).toMatchObject({
      'x-organizacao-id': 'org-A',
      'x-area-negocio-id': 'area-A',
    });
    expect(request.cache).toBe('no-store');
    expect(financeKey(context)).not.toEqual(
      financeKey({ organizacaoId: 'org-B', areaId: 'area-A' }),
    );
    expect(financeKey(context)).not.toEqual(
      financeKey({ organizacaoId: 'org-A', areaId: 'area-B' }),
    );
  });
  it('consulta indicadores com o escopo isolado, sem parametros de pagamento', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { saldo_total: '120.00', saldo_vencido: '50.00' } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await financeApi.indicadores(context);
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/financeiro/indicadores');
    expect(request.method).toBeUndefined();
    expect(request.headers).toMatchObject({
      'x-organizacao-id': context.organizacaoId,
      'x-area-negocio-id': context.areaId,
    });
    expect(request.cache).toBe('no-store');
  });
  it('envia chave de idempotência e o mesmo corpo recebido pela função', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ data: { pagamento: { id: 'p1' }, repetido: false } }),
      });
    vi.stubGlobal('fetch', fetchMock);
    const body = { valor: '20.00', forma_pagamento: 'PIX', pago_em: '2026-11-10T12:00:00.000Z' };
    await financeApi.receber(context, 'm1', 'tentativa-123', body);
    const [, request] = fetchMock.mock.calls[0];
    expect(request.headers['Idempotency-Key']).toBe('tentativa-123');
    expect(request.body).toBe(JSON.stringify(body));
    expect(request.signal).toBeInstanceOf(AbortSignal);
  });
});
