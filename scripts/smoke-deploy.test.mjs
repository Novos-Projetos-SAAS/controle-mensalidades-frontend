import { describe, expect, it, vi } from 'vitest';
import { conferirDeploy, validarOrigem } from './smoke-deploy.mjs';

describe('smoke test seguro do deploy', () => {
  it('recusa HTTP, URL com credenciais ou caminho adicional', () => {
    expect(() => validarOrigem('http://example.org')).toThrow();
    expect(() => validarOrigem('https://usuario:senha@example.org')).toThrow();
    expect(() => validarOrigem('https://example.org/api')).toThrow();
    expect(() => validarOrigem('https://example.org/?token=abc')).toThrow();
    expect(validarOrigem('https://example.org')).toBe('https://example.org');
  });

  it('consulta somente GET e valida saúde, proxy e bloqueio clínico', async () => {
    const fetcher = vi.fn(async (url, options) => {
      expect(options.method).toBe('GET');
      expect(options.redirect).toBe('manual');
      expect(options.cache).toBe('no-store');
      expect(options.headers).toEqual({ accept: 'application/json' });
      let status = 404;
      if (url.endsWith('/api/v1/health')) status = 200;
      if (url.endsWith('/api/v1/auth/me')) status = 401;
      return { status };
    });
    const resultados = await conferirDeploy({
      frontend: 'https://frontend.example.org',
      backend: 'https://backend.example.org',
      fetcher,
    });
    expect(resultados).toHaveLength(7);
    expect(resultados.every((r) => r.ok)).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(7);
  });

  it('sinaliza rota clínica exposta e indisponibilidade de conexão', async () => {
    const resultados = await conferirDeploy({
      frontend: 'https://frontend.example.org',
      backend: 'https://backend.example.org',
      fetcher: async (url) => {
        if (url.includes('vinculos-clinicos')) return { status: 200 };
        if (url.endsWith('/api/v1/health')) throw new Error('offline');
        return { status: url.endsWith('/auth/me') ? 401 : 404 };
      },
    });
    expect(resultados.some((r) => !r.ok)).toBe(true);
    expect(resultados.find((r) => r.nome === 'Vínculos clínicos indisponíveis')?.recebido).toBe(200);
    expect(resultados.find((r) => r.nome === 'Saúde do backend')?.recebido).toBeNull();
  });
});
