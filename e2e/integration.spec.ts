import { expect, test, type Page } from '@playwright/test';

const fixture = JSON.parse(process.env.E2E_FIXTURE_JSON || '{}') as {
  runId: string;
  orgA: string;
  orgB: string;
  areaA1: string;
  areaA2: string;
  areaB1: string;
  clientA1: string;
  clientA2: string;
  clientB1: string;
  professionalA1: string;
  availableUserId: string;
};
const admin = {
  email: process.env.E2E_ADMIN_EMAIL || '',
  password: process.env.E2E_ADMIN_PASSWORD || '',
};
const operator = {
  email: process.env.E2E_OPERATOR_EMAIL || '',
  password: process.env.E2E_OPERATOR_PASSWORD || '',
};
if (!fixture.runId || !admin.email || !admin.password || !operator.email || !operator.password) {
  throw new Error('Fixture e credenciais E2E ausentes. Use npm run test:e2e.');
}

async function signIn(page: Page, account = admin) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'E-mail' }).fill(account.email);
  await page.getByLabel('Senha', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Entrar na plataforma' }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: /Bom trabalho/ })).toBeVisible();
}

test('protege páginas privadas e rejeita login inválido', async ({ page }) => {
  await page.goto('/clientes');
  await expect(page).toHaveURL('/login');
  await expect(page.getByRole('heading', { name: 'Clientes' })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'E-mail' }).fill(admin.email);
  await page.getByLabel('Senha', { exact: true }).fill('SenhaInvalida!123');
  await page.getByRole('button', { name: 'Entrar na plataforma' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Email ou senha inválidos.' }),
  ).toBeVisible();
  await expect(page).toHaveURL('/login');
});

test('login, sessão, áreas, módulos, clientes e isolamento entre contextos', async ({ page }) => {
  await signIn(page);
  const me = await page.request.get('/api/v1/auth/me');
  expect(me.status()).toBe(200);
  expect((await me.json()).data.organizacoes).toHaveLength(2);
  await expect(page.getByLabel('Organização')).toHaveValue(fixture.orgA);
  await expect(page.getByLabel('Área de negócio')).toHaveValue(fixture.areaA1);
  await expect(
    page.getByText('Clientes nesta área').locator('..').locator('..').locator('strong'),
  ).toHaveText('1');
  await expect(
    page.getByText('Profissionais nesta área').locator('..').locator('..').locator('strong'),
  ).toHaveText('1');
  const modules = await page.request.get(`/api/v1/areas-negocio/${fixture.areaA1}/modulos`, {
    headers: { 'x-organizacao-id': fixture.orgA },
  });
  expect(modules.status()).toBe(200);
  expect(
    (await modules.json()).data.some((item: { codigo: string }) => item.codigo === 'AGENDA'),
  ).toBe(true);
  await page.getByRole('link', { name: 'Clientes', exact: true }).click();
  await expect(page.getByText('Cliente E2E A1')).toBeVisible();
  await expect(page.getByText('Cliente E2E A2')).toHaveCount(0);
  await page.getByPlaceholder('Buscar clientes').fill('Cliente E2E A1');
  await expect(page.getByText('Cliente E2E A1')).toBeVisible();
  await page.getByPlaceholder('Buscar clientes').fill('');
  await page.getByLabel('Área de negócio').selectOption(fixture.areaA2);
  await expect(page.getByText('Cliente E2E A2')).toBeVisible();
  await expect(page.getByText('Cliente E2E A1')).toHaveCount(0);
  await page.getByLabel('Organização').selectOption(fixture.orgB);
  await expect(page.getByLabel('Área de negócio')).toHaveValue(fixture.areaB1);
  await expect(page.getByText('Cliente E2E B1')).toBeVisible();
  await expect(page.getByText('Cliente E2E A2')).toHaveCount(0);
});

test('cadastra e edita cliente fictício pela interface', async ({ page }) => {
  await signIn(page);
  await page.goto('/clientes');
  const name = `Cliente E2E criado ${fixture.runId.slice(0, 8)}`;
  const edited = `Cliente E2E editado ${fixture.runId.slice(0, 8)}`;
  await page.getByRole('button', { name: 'Novo cliente' }).click();
  await page
    .getByRole('dialog')
    .getByRole('textbox', { name: /Nome completo/ })
    .fill(name);
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar cadastro' }).click();
  await expect(page.getByText(name)).toBeVisible();
  await page.getByRole('button', { name: `Ver detalhes de ${name}` }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Editar cadastro' }).click();
  await page
    .getByRole('dialog')
    .getByRole('textbox', { name: /Nome completo/ })
    .fill(edited);
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar cadastro' }).click();
  await expect(page.getByText(edited)).toBeVisible();
  await expect(page.getByText(name)).toHaveCount(0);
});

test('lista profissionais e respeita permissões de operador', async ({ page }) => {
  await signIn(page);
  await page.goto('/profissionais');
  await expect(page.getByText('Profissional E2E A1')).toBeVisible();
  await page.getByRole('button', { name: 'Ver detalhes de Profissional E2E A1' }).click();
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Profissional E2E A1' }),
  ).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar' }).click();
  await page.getByRole('button', { name: 'Sair da conta' }).click();
  await expect(page).toHaveURL('/login');
  await signIn(page, operator);
  await page.goto('/profissionais');
  await expect(page.getByText('Profissional E2E A1')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Novo profissional' })).toHaveCount(0);
  const forbidden = await page.request.post('/api/v1/profissionais', {
    headers: { 'x-organizacao-id': fixture.orgA, 'x-area-negocio-id': fixture.areaA1 },
    data: { nome: 'Profissional Negado E2E', areas: [fixture.areaA1] },
  });
  expect(forbidden.status()).toBe(403);
  const forbiddenLink = await page.request.patch(
    `/api/v1/profissionais/${fixture.professionalA1}/usuario`,
    {
      headers: { 'x-organizacao-id': fixture.orgA, 'x-area-negocio-id': fixture.areaA1 },
      data: { usuarioId: fixture.availableUserId },
    },
  );
  expect(forbiddenLink.status()).toBe(403);
});

test('administrador cadastra e edita profissional fictício pela interface', async ({ page }) => {
  await signIn(page);
  await page.goto('/profissionais');
  const name = `Profissional E2E criado ${fixture.runId.slice(0, 8)}`;
  const edited = `Profissional E2E editado ${fixture.runId.slice(0, 8)}`;
  await page.getByRole('button', { name: 'Novo profissional' }).click();
  await page
    .getByRole('dialog')
    .getByRole('textbox', { name: /Nome completo/ })
    .fill(name);
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar cadastro' }).click();
  await expect(page.getByText(name)).toBeVisible();
  await page.getByRole('button', { name: `Ver detalhes de ${name}` }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Editar cadastro' }).click();
  await page
    .getByRole('dialog')
    .getByRole('textbox', { name: /Nome completo/ })
    .fill(edited);
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar cadastro' }).click();
  await expect(page.getByText(edited)).toBeVisible();
  await expect(page.getByText(name)).toHaveCount(0);
});

test('administrador vincula usuário sem conceder acesso clínico', async ({ page }) => {
  await signIn(page);
  await page.goto('/profissionais');
  await page.getByRole('button', { name: 'Ver detalhes de Profissional E2E A1' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Vincular usuário' }).click();
  await page.getByRole('dialog').getByLabel('Usuário').selectOption(fixture.availableUserId);
  await page.getByRole('dialog').getByRole('button', { name: 'Vincular usuário' }).click();
  await expect(page.getByText('Usuário vinculado ao profissional.')).toBeVisible();
  await page.getByRole('button', { name: 'Ver detalhes de Profissional E2E A1' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Vincular usuário' }).click();
  await expect(page.getByText('Usuário disponível E2E')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Remover vínculo' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar remoção' }).click();
  await expect(page.getByText('Nenhum usuário vinculado nesta área.')).toBeVisible();
  await page.getByRole('dialog').getByLabel('Usuário').selectOption(fixture.availableUserId);
  await page.getByRole('dialog').getByRole('button', { name: 'Vincular usuário' }).click();
  await expect(page.getByText('Usuário vinculado ao profissional.')).toBeVisible();
});

test('financeiro consulta dados reais e isola o contexto administrativo', async ({ page }) => {
  await signIn(page);
  await page.getByRole('link', { name: 'Financeiro', exact: true }).click();
  await expect(page).toHaveURL('/financeiro');
  await expect(page.getByRole('heading', { name: 'Financeiro' })).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Resumo financeiro' }).locator('strong'),
  ).toHaveCount(3);
  await expect(page.getByText('Nenhuma mensalidade encontrada')).toBeVisible();
  await page.getByRole('tab', { name: 'Planos' }).click();
  await expect(page.getByText('Nenhum plano encontrado')).toBeVisible();
  await page.getByRole('tab', { name: 'Assinaturas' }).click();
  await expect(page.getByText('Nenhuma assinatura encontrada')).toBeVisible();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const cached = await page.evaluate(async () =>
    (
      await Promise.all(
        (await caches.keys()).map(async (key) =>
          (await (await caches.open(key)).keys()).map((request) => new URL(request.url).pathname),
        ),
      )
    ).flat(),
  );
  expect(cached.some((path) => path.startsWith('/api/') || path.startsWith('/financeiro'))).toBe(
    false,
  );
  await page.getByLabel('Organização').selectOption(fixture.orgB);
  await expect(page.getByLabel('Área de negócio')).toHaveValue(fixture.areaB1);
  await page.getByRole('tab', { name: 'Assinaturas' }).click();
  await expect(page.getByText('Nenhuma assinatura encontrada')).toBeVisible();
  await page.getByRole('button', { name: 'Sair da conta' }).click();
  await expect(page).toHaveURL('/login');
  await signIn(page, operator);
  await expect(page.getByRole('link', { name: 'Financeiro', exact: true })).toHaveCount(0);
  const forbidden = await page.request.get('/api/v1/financeiro/planos', {
    headers: { 'x-organizacao-id': fixture.orgA, 'x-area-negocio-id': fixture.areaA1 },
  });
  expect(forbidden.status()).toBe(403);
});

test('cria plano, assinatura e mensalidade reais no banco de testes', async ({ page }) => {
  await signIn(page);
  await page.goto('/financeiro');
  await page.getByRole('tab', { name: 'Planos' }).click();
  const name = `Plano E2E ${fixture.runId.slice(0, 8)}`;
  await page.getByRole('button', { name: 'Novo plano' }).click();
  await page.getByRole('dialog').getByRole('textbox', { name: 'Nome *' }).fill(name);
  await page
    .getByRole('dialog')
    .getByRole('textbox', { name: 'Valor mensal (R$) *' })
    .fill('49,90');
  await page.getByRole('dialog').getByRole('button', { name: 'Criar plano' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await page.getByRole('tab', { name: 'Assinaturas' }).click();
  await page.getByRole('button', { name: 'Nova assinatura' }).click();
  await page.getByRole('dialog').getByLabel('Cliente *').selectOption(fixture.clientA1);
  await page.getByRole('dialog').getByLabel('Plano *').selectOption({ index: 1 });
  await page.getByRole('dialog').getByRole('button', { name: 'Criar assinatura' }).click();
  await expect(page.getByRole('heading', { name: 'Cliente E2E A1' })).toBeVisible();
  await page.getByRole('button', { name: 'Detalhes' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Gerar mensalidade' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Gerar mensalidade' }).click();
  await expect(page.getByRole('dialog', { name: 'Gerar mensalidade' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Mensalidades' }).click();
  await expect(page.getByRole('heading', { name: 'Cliente E2E A1' })).toBeVisible();
  await page.getByRole('button', { name: 'Detalhes' }).click();
  await expect(page.getByRole('dialog').getByText('Nenhum recebimento registrado.')).toBeVisible();
  const receiptResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().includes('/recebimentos'),
  );
  await page.getByRole('dialog').getByRole('button', { name: 'Registrar recebimento' }).click();
  await page.getByLabel('Valor a receber (R$) *').fill('49,90');
  await page.getByLabel('Forma de pagamento *').fill('PIX');
  await page.getByRole('checkbox').check();
  await page.setViewportSize({ width: 320, height: 640 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Confirmar recebimento' }),
  ).toBeVisible();

  const otherTab = await page.context().newPage();
  await otherTab.goto('/financeiro');
  await expect(otherTab.getByRole('heading', { name: 'Cliente E2E A1' })).toBeVisible();
  await otherTab.getByRole('button', { name: 'Detalhes' }).click();
  await otherTab.getByRole('dialog').getByRole('button', { name: 'Registrar recebimento' }).click();
  await otherTab.getByLabel('Valor a receber (R$) *').fill('49,90');
  await otherTab.getByLabel('Forma de pagamento *').fill('PIX');
  await otherTab.getByRole('checkbox').check();
  let otherTabPosts = 0;
  otherTab.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/recebimentos')) otherTabPosts += 1;
  });
  await page.getByRole('button', { name: 'Confirmar recebimento' }).click();

  const receiptResponse = await receiptResponsePromise;
  expect(receiptResponse.status()).toBe(201);
  const firstResult = await receiptResponse.json();
  expect(firstResult.data.repetido).toBe(false);
  expect(firstResult.data.pagamento.valor).toBe('49.90');
  await otherTab.getByRole('button', { name: 'Confirmar recebimento' }).click();
  await expect(
    otherTab.getByRole('alert').filter({ hasText: 'O saldo ou a situação mudou no servidor' }),
  ).toBeVisible();
  expect(otherTabPosts).toBe(0);
  await otherTab.close();

  const receiptRequest = receiptResponse.request();
  const idempotencyKey = receiptRequest.headers()['idempotency-key'];
  expect(idempotencyKey).toBeTruthy();
  const receiptPath = new URL(receiptRequest.url()).pathname;
  const contextHeaders = {
    'x-organizacao-id': fixture.orgA,
    'x-area-negocio-id': fixture.areaA1,
  };
  const replayResponse = await page.request.post(receiptPath, {
    headers: { ...contextHeaders, 'Idempotency-Key': idempotencyKey },
    data: receiptRequest.postDataJSON(),
  });
  expect(replayResponse.status()).toBe(200);
  const replayResult = await replayResponse.json();
  expect(replayResult.data.repetido).toBe(true);
  expect(replayResult.data.pagamento.id).toBe(firstResult.data.pagamento.id);

  const alteredReplay = await page.request.post(receiptPath, {
    headers: { ...contextHeaders, 'Idempotency-Key': idempotencyKey },
    data: { ...receiptRequest.postDataJSON(), valor: '49.89' },
  });
  expect(alteredReplay.status()).toBe(409);

  const persistedResponse = await page.request.get(receiptPath.replace(/\/recebimentos$/, ''), {
    headers: contextHeaders,
  });
  expect(persistedResponse.status()).toBe(200);
  const persisted = await persistedResponse.json();
  expect(persisted.data.status).toBe('PAGA');
  expect(persisted.data.valor_pago).toBe('49.90');
  expect(persisted.data.pagamentos).toHaveLength(1);

  const cacheKeysAfterPayment = await page.evaluate(async () =>
    (await Promise.all((await caches.keys()).map(async (key) => (await caches.open(key)).keys())))
      .flat()
      .map((request) => new URL(request.url).pathname),
  );
  expect(
    cacheKeysAfterPayment.some(
      (path) => path.startsWith('/api/') || path.startsWith('/financeiro'),
    ),
  ).toBe(false);

  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Detalhes' }).click();
  const updatedInvoice = page.getByRole('dialog');
  await expect(updatedInvoice.getByText('Paga')).toBeVisible();
  await expect(updatedInvoice.getByText(/PIX/)).toBeVisible();
  await expect(updatedInvoice.getByRole('listitem')).toHaveCount(1);
  await updatedInvoice.getByRole('button', { name: 'Fechar' }).click();
  await page.getByLabel('Organiza\u00e7\u00e3o').selectOption(fixture.orgB);
  await expect(page.getByText('Nenhuma mensalidade encontrada')).toBeVisible();
});

test('financeiro cabe em telas de 320 a 1280 pixels', async ({ page }) => {
  await signIn(page);
  await page.goto('/financeiro');
  await expect(page.getByRole('heading', { name: 'Financeiro' })).toBeVisible();
  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 812 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
  }
  await page.setViewportSize({ width: 320, height: 812 });
  await page.getByRole('tab', { name: 'Planos' }).click();
  await page.getByRole('button', { name: 'Novo plano' }).click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar' }).click();
  await page.getByRole('tab', { name: 'Assinaturas' }).click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Menu principal' }).getByRole('link', { name: 'Financeiro' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Fechar menu' }).click();
});

test('mostra erros 400 e 401, expiração e logout', async ({ page, context }) => {
  await signIn(page);
  const bad = await page.request.post('/api/v1/clientes', {
    headers: { 'x-organizacao-id': fixture.orgA },
    data: { nome: '' },
  });
  expect(bad.status()).toBe(400);
  await page.getByRole('button', { name: 'Sair da conta' }).click();
  await expect(page).toHaveURL('/login');
  expect((await page.request.get('/api/v1/auth/me')).status()).toBe(401);
  await page.goto('/clientes');
  await expect(page).toHaveURL('/login');
  await context.addCookies([
    {
      name: 'token',
      value: process.env.E2E_EXPIRED_TOKEN || '',
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  await page.goto('/clientes');
  await expect(page).toHaveURL('/login');
  await expect(
    page.getByRole('alert').filter({ hasText: 'Sua sessão expirou. Entre novamente.' }),
  ).toBeVisible();
});

test('PWA guarda apenas recursos públicos e exibe indisponibilidade offline', async ({
  page,
  context,
}) => {
  await page.goto('/login');
  const manifest = await page.request.get('/manifest.webmanifest');
  expect(manifest.status()).toBe(200);
  expect((await manifest.json()).display).toBe('standalone');
  for (const path of ['/icon-192.png', '/icon-512.png', '/sw.js', '/offline.html'])
    expect((await page.request.get(path)).status()).toBe(200);
  expect((await page.request.get('/financeiro')).headers()['cache-control']).toContain('no-store');
  expect((await page.request.get('/api/v1/auth/me')).headers()['cache-control']).toContain(
    'no-store',
  );
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, undefined, {
    timeout: 15_000,
  });
  const keys = await page.evaluate(async () => {
    const cache = await caches.open('orbe-static-v2');
    return (await cache.keys()).map((request) => new URL(request.url).pathname).sort();
  });
  expect(keys).toEqual(['/icon-192.png', '/icon-512.png', '/offline.html']);
  await context.setOffline(true);
  try {
    await page.goto('/clientes');
    await expect(page.getByRole('heading', { name: 'Sem conexão' })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});

test('login mobile não apresenta rolagem horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Acesse sua conta' })).toBeVisible();
  await expect
    .poll(async () => {
      try {
        return await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      } catch {
        return true;
      }
    })
    .toBe(false);
});
