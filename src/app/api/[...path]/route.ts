import type { NextRequest } from 'next/server';

type Context = { params: Promise<{ path: string[] }> };
const forwardedHeaders = [
  'accept',
  'content-type',
  'cookie',
  'idempotency-key',
  'x-organizacao-id',
  'x-area-negocio-id',
  'user-agent',
];

export const dynamic = 'force-dynamic';

async function forward(request: NextRequest, { params }: Context) {
  const { path } = await params;
  if (path.some((segment) => segment === '.' || segment === '..' || /[/\\]/.test(segment))) {
    return Response.json(
      { mensagem: 'Caminho de API inválido.', codigo: 'CAMINHO_INVALIDO' },
      { status: 400, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
  const base =
    process.env.BACKEND_URL ||
    (process.env.NODE_ENV === 'development' ? 'http://localhost:3333' : null);
  if (!base) {
    return Response.json(
      { mensagem: 'API indisponível.', codigo: 'API_INDISPONIVEL' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
  let target: URL;
  try {
    const origin = new URL(base);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
    if (
      origin.username ||
      origin.password ||
      origin.pathname !== '/' ||
      origin.search ||
      origin.hash ||
      (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && local))
    )
      throw new Error('URL inválida');
    target = new URL(`/api/${path.map(encodeURIComponent).join('/')}`, origin);
  } catch {
    return Response.json(
      { mensagem: 'API indisponível.', codigo: 'API_INDISPONIVEL' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
  target.search = request.nextUrl.search;
  const headers = new Headers();
  for (const name of forwardedHeaders) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body:
        request.method === 'GET' || request.method === 'HEAD'
          ? undefined
          : await request.arrayBuffer(),
      cache: 'no-store',
      redirect: 'manual',
      signal: request.signal,
    });
    const responseHeaders = new Headers({ 'Cache-Control': 'private, no-store' });
    for (const name of ['content-type', 'set-cookie', 'x-request-id', 'location']) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return Response.json(
      { mensagem: 'Não foi possível conectar ao servidor.', codigo: 'API_INDISPONIVEL' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const PUT = forward;
export const DELETE = forward;
