import { expect, test, type Page } from '@playwright/test';

const fixture = JSON.parse(process.env.E2E_FIXTURE_JSON || '{}') as {
  orgA: string;
  orgB: string;
  areaA1: string;
  areaA2: string;
  areaB1: string;
  clientA1: string;
};

async function signIn(page: Page, role: 'ADMIN' | 'OPERATOR' = 'ADMIN') {
  const prefix = role === 'ADMIN' ? 'E2E_ADMIN' : 'E2E_OPERATOR';
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'E-mail' }).fill(process.env[`${prefix}_EMAIL`] || '');
  await page.getByLabel('Senha', { exact: true }).fill(process.env[`${prefix}_PASSWORD`] || '');
  await page.getByRole('button', { name: 'Entrar na plataforma' }).click();
  await expect(page).toHaveURL('/', { timeout: 20_000 });
}

test('administrador integra remetente, modelos, estados vazios e consentimento', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await signIn(page);
  await page.goto('/configuracoes/whatsapp');
  await expect(page.getByRole('heading', { name: 'WhatsApp Business' })).toBeVisible();
  await expect(page.getByText('Não configurado')).toBeVisible();

  await page.getByRole('button', { name: 'Cadastrar remetente da área' }).click();
  await page.getByLabel('Nome do negócio').fill('Orbe Fictícia');
  await page.getByLabel('Número remetente').fill('+5511999999999');
  await page.getByLabel('ID da conta WhatsApp Business (WABA)').fill('waba-ficticia');
  await page.getByLabel('ID do número de telefone').fill('phone-ficticio');
  await page.getByRole('button', { name: 'Salvar remetente' }).click();
  await expect(
    page.getByText('Dados do remetente salvos. A autorização oficial da Meta continua pendente.'),
  ).toBeVisible();
  const configurations = await page.request.get('/api/v1/whatsapp/configuracoes', {
    headers: { 'x-organizacao-id': fixture.orgA },
  });
  expect(configurations.status()).toBe(200);
  expect((await configurations.json()).data).toEqual([
    expect.objectContaining({
      organizacao_id: fixture.orgA,
      area_negocio_id: fixture.areaA1,
      numero_exibido: '+5511999999999',
      ativo: false,
      situacao_conexao: 'PENDENTE_AUTORIZACAO',
    }),
  ]);

  await page.getByLabel('Área de negócio').selectOption(fixture.areaA2);
  await expect(page.getByText('Não configurado')).toBeVisible();
  await page.getByRole('button', { name: 'Histórico de mensagens' }).click();
  const history = page.getByRole('list', { name: 'Histórico de mensagens' });
  await expect(history.getByText('Simulação')).toBeVisible();
  await expect(history.getByText('Lembrete três dias após o vencimento')).toBeVisible();
  await page.getByRole('combobox', { name: /^Organização/ }).selectOption(fixture.orgB);
  await expect(page.getByLabel('Área de negócio')).toHaveValue(fixture.areaB1);
  await page.getByRole('button', { name: 'Histórico de mensagens' }).click();
  await expect(page.getByRole('heading', { name: 'Nenhuma mensagem encontrada' })).toBeVisible();
  await page.getByRole('button', { name: 'Conexão' }).click();
  await expect(page.getByText('Não configurado')).toBeVisible();
  await page.getByRole('combobox', { name: /^Organização/ }).selectOption(fixture.orgA);
  await page.getByLabel('Área de negócio').selectOption(fixture.areaA1);
  await expect(page.getByText('Orbe Fictícia')).toBeVisible();

  await page.getByRole('button', { name: 'Modelos de mensagem' }).click();
  await expect(page.locator('section[aria-label="Modelos de mensagem"] article')).toHaveCount(3);
  const templates = await page.request.get('/api/v1/whatsapp/modelos', {
    headers: { 'x-organizacao-id': fixture.orgA, 'x-area-negocio-id': fixture.areaA1 },
  });
  expect(templates.status()).toBe(200);
  expect((await templates.json()).data.map((item: { tipo: string }) => item.tipo)).toEqual([
    'D-1',
    'D0',
    'D+3',
  ]);

  await page.getByRole('button', { name: 'Lembretes automáticos' }).click();
  await expect(page.getByRole('heading', { name: 'Nenhum lembrete encontrado' })).toBeVisible();
  await page.getByRole('button', { name: 'Histórico de mensagens' }).click();
  await expect(page.getByRole('heading', { name: 'Nenhuma mensagem encontrada' })).toBeVisible();

  await page.getByRole('link', { name: 'Clientes', exact: true }).click();
  await page.getByRole('button', { name: 'Ver detalhes de Cliente E2E A1' }).click();
  await expect(page.getByText('WhatsApp: Não autorizado')).toBeVisible();
  await page.getByRole('button', { name: 'Registrar consentimento' }).click();
  await page.getByRole('button', { name: 'Confirmar aceite' }).click();
  await expect(page.getByText('WhatsApp: Autorizado')).toBeVisible();
  await page.getByRole('button', { name: 'Revogar consentimento' }).click();
  await page.getByRole('button', { name: 'Confirmar revogação' }).click();
  await expect(page.getByText('WhatsApp: Não autorizado')).toBeVisible();
  const client = await page.request.get(`/api/v1/clientes/${fixture.clientA1}`, {
    headers: { 'x-organizacao-id': fixture.orgA },
  });
  expect(client.status()).toBe(200);
  expect((await client.json()).data.aceite_whatsapp).toBe(false);
  expect(pageErrors).toEqual([]);
});

test('401 e 403 protegem o contexto WhatsApp', async ({ page }) => {
  const unauthenticated = await page.request.get('/api/v1/whatsapp/configuracoes', {
    headers: { 'x-organizacao-id': fixture.orgA },
  });
  expect(unauthenticated.status()).toBe(401);

  await signIn(page, 'OPERATOR');
  await page.goto('/configuracoes/whatsapp');
  await expect(page.getByRole('heading', { name: 'Acesso restrito' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'WhatsApp Business' })).toHaveCount(0);
  const forbidden = await page.request.get('/api/v1/whatsapp/configuracoes', {
    headers: { 'x-organizacao-id': fixture.orgA },
  });
  expect(forbidden.status()).toBe(403);
  const otherOrganization = await page.request.get('/api/v1/whatsapp/configuracoes', {
    headers: { 'x-organizacao-id': fixture.orgB },
  });
  expect(otherOrganization.status()).toBe(403);
});

test('falha de conexão mostra erro e permite tentar novamente', async ({ page }) => {
  test.setTimeout(60_000);
  await signIn(page);
  await page.route('**/api/v1/whatsapp/configuracoes', (route) => route.abort('failed'));
  await page.goto('/configuracoes/whatsapp');
  await expect(
    page.getByText('Não foi possível conectar ao servidor. Verifique sua conexão.'),
  ).toBeVisible();
  await page.unroute('**/api/v1/whatsapp/configuracoes');
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByRole('heading', { name: 'Conexão' }).last()).toBeVisible();
});
