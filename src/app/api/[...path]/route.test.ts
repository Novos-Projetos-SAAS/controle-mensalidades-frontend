import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { GET, POST } from './route';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('API intermediária em hospedagem', () => {
  it('deriva origem no servidor e não encaminha contexto ou cookies aos pagamentos públicos', async () => {
    vi.stubEnv('BACKEND_URL', 'https://backend.test');
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"data":null}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const request = {
      method: 'POST',
      nextUrl: new URL('https://orbe.test/api/v1/pagamentos/publico/token/confirmar'),
      headers: new Headers({
        'x-platform-origin': 'https://evil.test',
        cookie: 'session=secret',
        'x-organizacao-id': 'forged',
        'content-type': 'application/json',
      }),
      arrayBuffer: async () => new TextEncoder().encode('{}').buffer,
    } as unknown as NextRequest;
    const response = await POST(request, {
      params: Promise.resolve({ path: ['v1', 'pagamentos', 'publico', 'token', 'confirmar'] }),
    });
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('x-platform-origin')).toBe('https://orbe.test');
    expect(headers.has('cookie')).toBe(false);
    expect(headers.has('x-organizacao-id')).toBe(false);
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(response.headers.get('X-Robots-Tag')).toContain('noindex');
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });
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
});
