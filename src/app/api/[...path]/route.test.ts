import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PATCH, POST } from './route';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('API intermediária em hospedagem', () => {
  it('falha sem URL explícita ou com HTTP público, sem encaminhar o cookie', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('NODE_ENV', 'production');
    const request = {} as NextRequest;
    const context = { params: Promise.resolve({ path: ['v1', 'auth', 'me'] }) };

    vi.stubEnv('BACKEND_URL', '');
    expect((await GET(request, context)).status).toBe(503);
    vi.stubEnv('BACKEND_URL', 'http://api.example.com');
    expect((await GET(request, context)).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('bloqueia POST clínico de origem cruzada antes de encaminhar cookies', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('BACKEND_URL', 'http://localhost:3333');
    const pedido = new NextRequest('http://localhost:3000/api/v1/documentos-clinicos', {
      method: 'POST',
      headers: {
        host: 'localhost:3000',
        origin: 'https://site-externo.example',
        cookie: 'token=NAO_ENVIAR',
        'sec-fetch-site': 'cross-site',
      },
      body: '{}',
    });
    const r = await POST(pedido, { params: Promise.resolve({ path: ['v1', 'documentos-clinicos'] }) });
    expect(r.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('bloqueia autorização administrativa clínica de origem cruzada', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('BACKEND_URL', 'http://localhost:3333');
    const profissional = '11111111-1111-4111-8111-111111111111';
    const path = ['v1', 'profissionais', profissional, 'acesso-clinico'];
    const pedido = new NextRequest(
      `http://localhost:3000/api/v1/profissionais/${profissional}/acesso-clinico`,
      {
        method: 'PATCH',
        headers: {
          host: 'localhost:3000',
          origin: 'https://site-externo.example',
          cookie: 'token=NAO_ENVIAR',
          'sec-fetch-site': 'cross-site',
        },
        body: JSON.stringify({ autorizado: true }),
      },
    );
    const r = await PATCH(pedido, { params: Promise.resolve({ path }) });
    expect(r.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('encaminha POST clínico autorizado de mesma origem sem cache', async () => {
    vi.stubEnv('BACKEND_URL', 'http://localhost:3333');
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ data: { id: 'registro-teste' } }), {
        status: 201, headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const pedido = new NextRequest('http://localhost:3000/api/v1/documentos-clinicos', {
      method: 'POST',
      headers: {
        host: 'localhost:3000',
        origin: 'http://localhost:3000',
        'sec-fetch-site': 'same-origin',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ tipo: 'ANAMNESE' }),
    });
    const r = await POST(pedido, { params: Promise.resolve({ path: ['v1', 'documentos-clinicos'] }) });
    expect(r.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

});
