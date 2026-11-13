import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { GET } from './route';

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
});
