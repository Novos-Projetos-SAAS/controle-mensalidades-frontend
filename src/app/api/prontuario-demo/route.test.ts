import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { GET, POST } from './route';

afterEach(() => { vi.unstubAllEnvs(); });

describe('rota de persistência do prontuário fictício', () => {
  it('permanece 404 em produção e hospedagem, mesmo com parâmetros de teste', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const pedido = new NextRequest('http://localhost:3000/api/prontuario-demo', {
      headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
    });
    expect((await GET(pedido)).status).toBe(404);
    expect((await POST(pedido)).status).toBe(404);
  });

  it('não permite acesso via hostname que não seja loopback no desenvolvimento', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const pedido = new NextRequest('http://exemplo.com/api/prontuario-demo', {
      headers: { host: 'exemplo.com', origin: 'http://exemplo.com' },
    });
    expect((await GET(pedido)).status).toBe(404);
  });

  it('rejeita POST de origem cruzada antes de tocar no arquivo', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const pedido = new NextRequest('http://localhost:3000/api/prontuario-demo', {
      method: 'POST',
      headers: { host: 'localhost:3000', origin: 'https://outro.example' },
      body: JSON.stringify({ acao: 'reiniciar', revisao: 0 }),
    });
    expect((await POST(pedido)).status).toBe(403);
  });

  it('rejeita POST de tamanho acima do limite sem gravar', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const pedido = new NextRequest('http://localhost:3000/api/prontuario-demo', {
      method: 'POST',
      headers: {
        host: 'localhost:3000', origin: 'http://localhost:3000',
        'content-length': '70001',
      },
      body: '{}',
    });
    expect((await POST(pedido)).status).toBe(413);
  });
});
