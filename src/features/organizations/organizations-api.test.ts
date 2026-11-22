import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBusinessArea, createOrganization } from './organizations-api';

afterEach(() => vi.unstubAllGlobals());

describe('contrato de cadastro de organizações e áreas', () => {
  it('cria empresa com sessão sem exigir organização anterior', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        data: {
          organizacao: { id: 'org-nova', nome: 'Estúdio Novo', perfil: 'ADMINISTRADOR' },
          area: { id: 'area-1', nome: 'Pilates', codigo: 'PILATES' },
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const created = await createOrganization('Estúdio Novo', 'Pilates');
    expect(created.organizacao.perfil).toBe('ADMINISTRADOR');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/organizacoes',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        body: JSON.stringify({ nome: 'Estúdio Novo', areaInicial: { nome: 'Pilates' } }),
      }),
    );
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers['x-organizacao-id']).toBeUndefined();
  });

  it('cria nova área apenas dentro da organização informada', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ data: { id: 'area-2', nome: 'Musculação', codigo: 'MUSCULACAO' } }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const result = await createBusinessArea('org-autorizada', 'Musculação');
    expect(result.codigo).toBe('MUSCULACAO');
    expect(fetchMock.mock.calls[0][1].headers['x-organizacao-id']).toBe('org-autorizada');
    expect(fetchMock.mock.calls[0][1].headers['x-area-negocio-id']).toBeUndefined();
  });
});
