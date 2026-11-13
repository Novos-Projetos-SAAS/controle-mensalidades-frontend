import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createHmac } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backend = path.resolve(frontend, '..', 'controle-mensalidades-backend');
const fixtureScript = path.join(frontend, 'scripts', 'e2e-fixture.mts');
const stateFile = path.join(frontend, '.e2e-fixture.json');
const backendURL = 'http://127.0.0.1:3340';
const frontendURL = 'http://127.0.0.1:3010';
const nextBin = path.join(frontend, 'node_modules', 'next', 'dist', 'bin', 'next');
const playwrightBin = path.join(frontend, 'node_modules', '@playwright', 'test', 'cli.js');

function parseEnv(file) {
  return Object.fromEntries(
    readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .filter((line) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, '')];
      }),
  );
}
const testEnv = parseEnv(path.join(backend, '.env.test'));
const devEnv = parseEnv(path.join(backend, '.env'));
if (
  testEnv.NODE_ENV !== 'test' ||
  testEnv.AMBIENTE_BANCO !== 'teste' ||
  !testEnv.DATABASE_URL_TEST ||
  testEnv.DATABASE_URL_TEST === devEnv.DATABASE_URL
) {
  throw new Error('A execução E2E exige banco exclusivo configurado em .env.test.');
}
if (!testEnv.JWT_SECRET_TEST) throw new Error('JWT_SECRET_TEST não está configurado.');
if (existsSync(stateFile))
  throw new Error('Há uma fixture E2E pendente de limpeza. Não será criada outra.');
const isolatedEnv = { ...process.env };
for (const key of [
  'NODE_ENV',
  'AMBIENTE_BANCO',
  'DATABASE_URL',
  'DATABASE_URL_TEST',
  'JWT_SECRET',
  'JWT_SECRET_TEST',
  'PORT',
])
  delete isolatedEnv[key];

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || frontend,
      env: options.env || process.env,
      windowsHide: true,
    });
    let stdout = '',
      stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) return resolve(stdout);
      let detail = options.showOutput ? `${stdout}\n${stderr}` : '';
      for (const secret of options.redact || [])
        if (secret) detail = detail.replaceAll(secret, '[redigido]');
      reject(
        new Error(`${options.label || 'Comando'} falhou (código ${code}). ${detail.slice(-12000)}`),
      );
    });
  });
}
async function waitFor(url, child) {
  for (let i = 0; i < 60; i++) {
    if (child.exitCode !== null) throw new Error(`Servidor encerrou antes de responder: ${url}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      /* aguarda inicialização */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Servidor não respondeu: ${url}`);
}
function stop(child) {
  if (!child || child.exitCode !== null) return Promise.resolve();
  if (process.platform === 'win32')
    return run('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
      label: 'Parada do servidor',
    }).catch(() => undefined);
  child.kill('SIGTERM');
  return Promise.resolve();
}

let fixture,
  apiServer,
  webServer,
  failed = false;
try {
  process.stdout.write('Compilando frontend para o ambiente E2E...\n');
  await run(process.execPath, [nextBin, 'build', '--webpack'], {
    env: { ...process.env, BACKEND_URL: backendURL },
    label: 'Build',
    showOutput: true,
  });
  const setupOutput = await run(
    process.execPath,
    ['--env-file=.env.test', '--import', 'tsx', fixtureScript, 'setup'],
    { cwd: backend, env: isolatedEnv, label: 'Fixture' },
  );
  fixture = JSON.parse(setupOutput.trim().split(/\r?\n/).at(-1));
  const { adminPassword, operatorPassword, adminEmail, operatorEmail, ...fixtureIds } = fixture;
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const payload = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: fixture.adminId, exp: Math.floor(Date.now() / 1000) - 60 })}`;
  const expiredToken = `${payload}.${createHmac('sha256', testEnv.JWT_SECRET_TEST).update(payload).digest('base64url')}`;
  writeFileSync(stateFile, JSON.stringify(fixtureIds), { mode: 0o600 });
  apiServer = spawn(
    process.execPath,
    ['--env-file=.env.test', '--import', 'tsx', 'src/server.ts'],
    { cwd: backend, env: { ...isolatedEnv, PORT: '3340' }, windowsHide: true, stdio: 'ignore' },
  );
  await waitFor(`${backendURL}/api/v1/health`, apiServer);
  webServer = spawn(
    process.execPath,
    [nextBin, 'start', '--hostname', '127.0.0.1', '--port', '3010'],
    {
      cwd: frontend,
      env: { ...process.env, BACKEND_URL: backendURL },
      windowsHide: true,
      stdio: 'ignore',
    },
  );
  await waitFor(`${frontendURL}/login`, webServer);
  process.stdout.write('API e frontend locais prontos. Executando Playwright...\n');
  const testOutput = await run(process.execPath, [playwrightBin, 'test'], {
    env: {
      ...process.env,
      E2E_BASE_URL: frontendURL,
      E2E_ADMIN_EMAIL: adminEmail,
      E2E_ADMIN_PASSWORD: adminPassword,
      E2E_OPERATOR_EMAIL: operatorEmail,
      E2E_OPERATOR_PASSWORD: operatorPassword,
      E2E_EXPIRED_TOKEN: expiredToken,
      E2E_FIXTURE_JSON: JSON.stringify(fixtureIds),
    },
    label: 'Playwright',
    showOutput: true,
    redact: [adminEmail, adminPassword, operatorEmail, operatorPassword, expiredToken],
  });
  process.stdout.write(
    `Testes E2E concluídos: ${testOutput.match(/\d+ passed[^\r\n]*/)?.[0] || 'sem resumo disponível'}.\n`,
  );
  await run(
    process.execPath,
    ['--env-file=.env.test', '--import', 'tsx', fixtureScript, 'verify'],
    {
      cwd: backend,
      env: { ...isolatedEnv, E2E_FIXTURE_IDS: JSON.stringify(fixtureIds) },
      label: 'Verificação do vínculo',
    },
  );
  process.stdout.write('Vínculo confirmado no banco, sem acesso clínico.\n');
} catch (error) {
  failed = true;
  process.stderr.write(`${error instanceof Error ? error.message : 'Falha E2E.'}\n`);
} finally {
  await Promise.all([stop(webServer), stop(apiServer)]);
  if (fixture) {
    try {
      await run(
        process.execPath,
        ['--env-file=.env.test', '--import', 'tsx', fixtureScript, 'cleanup'],
        {
          cwd: backend,
          env: { ...isolatedEnv, E2E_FIXTURE_IDS: readFileSync(stateFile, 'utf8') },
          label: 'Limpeza da fixture',
        },
      );
      unlinkSync(stateFile);
      process.stdout.write('Fixture fictícia removida.\n');
    } catch {
      failed = true;
      process.stderr.write(
        'A limpeza da fixture falhou; IDs preservados em .e2e-fixture.json para recuperação.\n',
      );
    }
  }
}
if (failed) process.exitCode = 1;
