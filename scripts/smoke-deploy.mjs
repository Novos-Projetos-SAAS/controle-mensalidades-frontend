#!/usr/bin/env node
// Smoke test SOMENTE LEITURA: não usa cookies, conta real, Neon, POST ou migrations.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function validarOrigem(value) {
  if (typeof value !== 'string') throw new Error('Informe uma URL HTTPS.');
  const parsed = new URL(value);
  if (
    parsed.protocol !== 'https:' ||
    parsed.username || parsed.password ||
    parsed.pathname !== '/' ||
    parsed.search || parsed.hash
  ) {
    throw new Error('Use apenas a origem HTTPS, sem path, token, query ou credenciais.');
  }
  return parsed.origin;
}

export async function conferirDeploy({ frontend, backend, fetcher = fetch }) {
  const frontendUrl = validarOrigem(frontend);
  const backendUrl = validarOrigem(backend);
  const idFicticio = '00000000-0000-4000-8000-000000000001';
  const checks = [
    { nome: 'Saúde do backend', url: `${backendUrl}/api/v1/health`, esperado: 200 },
    { nome: 'Proxy do frontend para a saúde do backend', url: `${frontendUrl}/api/v1/health`, esperado: 200 },
    { nome: 'Sessão anônima não autenticada', url: `${frontendUrl}/api/v1/auth/me`, esperado: 401 },
    { nome: 'Simulador local desativado no deploy', url: `${frontendUrl}/api/prontuario-demo`, esperado: 404 },
    { nome: 'Documentos clínicos indisponíveis', url: `${frontendUrl}/api/v1/documentos-clinicos/paciente/${idFicticio}`, esperado: 404 },
    { nome: 'Histórico clínico indisponível', url: `${frontendUrl}/api/v1/prontuario/pacientes/${idFicticio}/historico`, esperado: 404 },
    { nome: 'Vínculos clínicos indisponíveis', url: `${frontendUrl}/api/v1/vinculos-clinicos/paciente/${idFicticio}`, esperado: 404 },
  ];

  const resultados = [];
  for (const check of checks) {
    try {
      const resposta = await fetcher(check.url, {
        method: 'GET',
        redirect: 'manual',
        cache: 'no-store',
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
      resultados.push({
        nome: check.nome,
        esperado: check.esperado,
        recebido: resposta.status,
        ok: resposta.status === check.esperado,
      });
    } catch {
      resultados.push({
        nome: check.nome, esperado: check.esperado, recebido: null, ok: false,
      });
    }
  }
  return resultados;
}

async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((arg) => {
      const [chave, ...partes] = arg.split('=');
      return [chave, partes.join('=')];
    }),
  );
  if (!args['--frontend'] || !args['--backend']) {
    throw new Error('Uso: npm run smoke:deploy -- --frontend=https://seu-front --backend=https://seu-back');
  }
  const resultados = await conferirDeploy({
    frontend: args['--frontend'], backend: args['--backend'],
  });
  for (const item of resultados) {
    const resultado = item.recebido === null ? 'ERRO_CONEXAO' : `HTTP_${item.recebido}`;
    console.log(`${item.ok ? 'OK' : 'FALHA'}: ${item.nome} (${resultado}; esperado HTTP_${item.esperado})`);
  }
  if (resultados.some((item) => !item.ok)) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((erro) => {
    console.error(erro instanceof Error ? erro.message : 'Erro de smoke test.');
    process.exitCode = 1;
  });
}
