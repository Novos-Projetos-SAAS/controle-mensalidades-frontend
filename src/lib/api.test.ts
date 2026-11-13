import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, login } from './api';

afterEach(() => vi.unstubAllGlobals());
describe('cliente HTTP', () => {
  it('envia credenciais e lê login válido sem persistir token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          usuario: { id: 'u1', nome: 'Teste', email: 'teste@example.com' },
          organizacoes: [],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await login('teste@example.com', 'senha');
    expect(result.usuario.nome).toBe('Teste');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/login',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ email: 'teste@example.com', senha: 'senha' }),
      }),
    );
  });
  it('mostra erro de login inválido retornado pela API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          mensagem: 'Email ou senha inválidos.',
          codigo: 'CREDENCIAIS_INVALIDAS',
        }),
      }),
    );
    await expect(login('teste@example.com', 'invalida')).rejects.toMatchObject({
      message: 'Email ou senha inválidos.',
      status: 401,
      code: 'CREDENCIAIS_INVALIDAS',
    } satisfies Partial<ApiError>);
  });
  it('isola requisições por organização e área e avisa sobre sessão expirada', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ codigo: 'TOKEN_EXPIRADO' }),
      });
    vi.stubGlobal('fetch', fetchMock);
    const listener = vi.fn();
    window.addEventListener('orbe:session-expired', listener);
    await api('/clientes', {}, { organizacaoId: 'org-1', areaId: 'area-1' });
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      'x-organizacao-id': 'org-1',
      'x-area-negocio-id': 'area-1',
    });
    await expect(api('/clientes', {}, { organizacaoId: 'org-2' })).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock.mock.calls[1][1].headers['x-organizacao-id']).toBe('org-2');
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener('orbe:session-expired', listener);
  });
});
