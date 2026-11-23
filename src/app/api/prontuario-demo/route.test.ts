import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

  it('grava em arquivo do servidor e devolve os registros no GET de outra sessão', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const raiz = await mkdtemp(join(tmpdir(), 'prontuario-http-'));
    vi.spyOn(process, 'cwd').mockReturnValue(raiz);
    try {
      const url = 'http://localhost:3000/api/prontuario-demo';
      const cabecalhos = { host: 'localhost:3000', origin: 'http://localhost:3000' };
      const inicial = await GET(new NextRequest(url, { headers: cabecalhos }));
      const estadoInicial = await inicial.json();
      expect(estadoInicial.revisao).toBe(0);

      const enviar = new NextRequest(url, {
        method: 'POST',
        headers: { ...cabecalhos, 'content-type': 'application/json' },
        body: JSON.stringify({
          acao: 'criar', revisao: 0, pacienteId: 'paciente-ficticio-3',
          tipo: 'ANAMNESE',
          dados: {
            queixa_principal: 'Queixa sintética',
            historia_condicao_atual: 'História inteiramente fictícia',
            antecedentes: '', medicamentos_alergias: '',
            limitacoes_funcionais: 'Limitações fictícias',
            objetivos_paciente: 'Objetivos fictícios',
            avaliacao_inicial: 'Avaliação fictícia',
          },
        }),
      });
      const gravacao = await POST(enviar);
      expect(gravacao.status).toBe(200);
      const criado = await gravacao.json();
      expect(criado.revisao).toBe(1);
      expect(criado.registroId).toBeTruthy();

      const seguinte = await GET(new NextRequest(url, { headers: cabecalhos }));
      const persistido = await seguinte.json();
      expect(persistido.revisao).toBe(1);
      expect(persistido.estado.registros.find(
        (r: { id: string }) => r.id === criado.registroId,
      )?.pacienteId).toBe('paciente-ficticio-3');
    } finally {
      vi.restoreAllMocks();
      await rm(raiz, { recursive: true, force: true });
    }
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
