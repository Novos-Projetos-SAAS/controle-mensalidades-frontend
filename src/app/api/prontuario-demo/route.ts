import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { ConflitoDemoError, executarDemo, lerDemo } from '@/features/clinical/clinical-demo-persistence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const local = new Set(['localhost', '127.0.0.1', '[::1]']);

function permitido(req: NextRequest): boolean {
  // Sem qualquer fallback para ambiente de homologação/produção.
  if (process.env.NODE_ENV !== 'development') return false;
  try {
    const url = new URL(req.url);
    const host = req.headers.get('host')?.split(':')[0] || '';
    return local.has(url.hostname) && local.has(host);
  } catch {
    return false;
  }
}

function resposta(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'Pragma': 'no-cache',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

export async function GET(req: NextRequest) {
  if (!permitido(req)) return resposta({ codigo: 'ROTA_NAO_ENCONTRADA' }, 404);
  try {
    return resposta(await lerDemo());
  } catch {
    return resposta({ codigo: 'ARQUIVO_DEMO_INDISPONIVEL', mensagem: 'Não foi possível abrir o histórico local.' }, 503);
  }
}

export async function POST(req: NextRequest) {
  if (!permitido(req)) return resposta({ codigo: 'ROTA_NAO_ENCONTRADA' }, 404);

  // Bloqueio CSRF de chamadas originadas de páginas de terceiros.
  const origem = req.headers.get('origin');
  const host = req.headers.get('host');
  if (!origem || !host || new URL(origem).host !== host) {
    return resposta({ codigo: 'ORIGEM_NAO_AUTORIZADA' }, 403);
  }

  if (Number(req.headers.get('content-length') ?? 0) > 70_000) {
    return resposta({ codigo: 'LIMITE_DEMO_EXCEDIDO' }, 413);
  }
  try {
    const texto = await req.text();
    if (texto.length > 70_000) return resposta({ codigo: 'LIMITE_DEMO_EXCEDIDO' }, 413);
    return resposta(await executarDemo(JSON.parse(texto)));
  } catch (erro) {
    if (erro instanceof ConflitoDemoError) {
      return resposta({ codigo: 'CONFLITO_DEMO', mensagem: erro.message }, 409);
    }
    if (erro instanceof SyntaxError ||
      (erro instanceof Error && (erro.name === 'ZodError' ||
        /inválid|inexistente|já finalizado|mínimo|versão|Registro/.test(erro.message)))) {
      return resposta({ codigo: 'DADOS_DEMO_INVALIDOS', mensagem: 'Verifique os dados do treinamento.' }, 400);
    }
    return resposta({ codigo: 'GRAVACAO_DEMO_INDISPONIVEL', mensagem: 'Não foi possível salvar os dados fictícios.' }, 503);
  }
}
