import { expect, test } from '@playwright/test';

const token = 'a'.repeat(43);
const charge = {
  status: 'AGUARDANDO_PAGAMENTO',
  valor: '50.00',
  vencimento_em: '2026-11-30',
  checkout_url: 'https://buy.infinitepay.io/checkout-teste',
  expira_em: null,
};

test('página privada mobile sem sessão, cache ou referrer e sem consulta de cliente', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const requests: string[] = [];
  page.on('request', (request) => requests.push(new URL(request.url()).pathname));
  await page.route('**/api/**', (route) =>
    route.fulfill({ json: { status: 'success', data: charge } }),
  );
  const response = await page.goto(`/pagamento/${token}`);
  expect(response?.headers()['cache-control']).toContain('no-store');
  expect(response?.headers()['referrer-policy']).toBe('no-referrer');
  expect(response?.headers()['x-robots-tag']).toContain('noindex');
  await expect(page.getByRole('heading', { name: 'Aguardando pagamento' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Pagar com InfinitePay' })).toHaveAttribute(
    'href',
    charge.checkout_url,
  );
  await expect(page.getByText(/50,00/)).toBeVisible();
  expect(requests.filter((path) => path.startsWith('/api/'))).toEqual([
    `/api/v1/pagamentos/publico/${token}`,
  ]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: '.tmp/infinitepay-mobile.png', fullPage: true });
});

test('retorno envia identificadores ao servidor e não aceita paid=true como confirmação', async ({
  page,
}) => {
  let method = '';
  let body: unknown;
  await page.route('**/api/**', async (route) => {
    method = route.request().method();
    body = route.request().postDataJSON();
    await route.fulfill({ json: { status: 'success', data: { ...charge, checkout_url: null } } });
  });
  await page.goto(
    `/pagamento/retorno?token=${token}&order_nsu=pedido-1&transaction_nsu=transacao-1&slug=slug-1&paid=true`,
  );
  await expect(page.getByRole('heading', { name: 'Aguardando pagamento' })).toBeVisible();
  expect(method).toBe('POST');
  expect(body).toEqual({ order_nsu: 'pedido-1', transaction_nsu: 'transacao-1', slug: 'slug-1' });
  await expect(page.getByText('Pagamento confirmado')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Pagar/ })).toHaveCount(0);
  await page.goto(`/pagamento/retorno?token=${token}&token=${token}&paid=true`);
  await expect(
    page.getByRole('alert').filter({ hasText: 'Link de pagamento inválido' }),
  ).toBeVisible();
});

test('administrador configura geração em 2 dias e gera link por mensalidade preservando recebimento manual', async ({
  page,
}) => {
  const invoice = {
    id: 'm1',
    cliente_nome: 'Cliente de teste',
    competencia: '2026-11-01',
    valor_final: '50.00',
    valor_pago: '0.00',
    saldo: '50.00',
    vencimento_em: '2026-11-30',
    status: 'PENDENTE',
    pagamentos: [],
  };
  const settings = {
    ativo: true,
    geracao_automatica: false,
    dias_antecedencia: 1,
    handle: 'conta-teste',
    has_api_key: true,
  };
  let saved: unknown;
  let generated = false;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = [];
    if (path === '/api/v1/auth/me')
      data = {
        usuario: { id: 'u1', nome: 'Admin', email: 'admin@example.test' },
        organizacoes: [{ id: 'o1', nome: 'Organização Teste', perfil: 'ADMINISTRADOR' }],
      };
    else if (path === '/api/v1/areas-negocio') data = [{ id: 'a1', nome: 'Área Teste' }];
    else if (path === '/api/v1/financeiro/resumo')
      data = {
        valor_em_aberto: '50.00',
        valor_vencido: '0.00',
        recebido_periodo: '0.00',
        mensalidades_em_aberto: '1',
        mensalidades_vencidas: '0',
      };
    else if (path === '/api/v1/financeiro/mensalidades')
      data = { items: [invoice], pagination: { page: 1, pageSize: 20, total: 1, pages: 1 } };
    else if (path === '/api/v1/financeiro/mensalidades/m1') data = invoice;
    else if (path === '/api/v1/financeiro/infinitepay/configuracao') {
      if (route.request().method() === 'PATCH') saved = route.request().postDataJSON();
      data = { ...settings, ...(saved || {}) };
    } else if (path === '/api/v1/financeiro/mensalidades/m1/cobranca') {
      if (route.request().method() === 'POST') generated = true;
      data = generated
        ? { ...charge, id: 'c1', url_plataforma: `/pagamento/${token}`, ultimo_erro: null }
        : null;
    }
    await route.fulfill({ json: { status: 'success', data } });
  });
  await page.goto('/financeiro');
  await page.getByRole('tab', { name: 'InfinitePay' }).click();
  const settingsCard = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Salvar configuração' }) });
  const futureCard = page.getByRole('region', { name: 'Outras opções de pagamento' });
  const futureControl = futureCard.getByRole('switch', { name: 'Outras opções de pagamento' });
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 375, height: 812 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(futureCard.getByText('Em breve')).toBeVisible();
    await expect(
      futureCard.getByText('Novas formas de receber pagamentos estarão disponíveis futuramente.'),
    ).toBeVisible();
    await expect(futureControl).toBeDisabled();
    await expect(futureControl).toHaveAttribute('aria-checked', 'false');
    const current = await settingsCard.boundingBox();
    const future = await futureCard.boundingBox();
    expect(current).not.toBeNull();
    expect(future).not.toBeNull();
    if (!current || !future) throw new Error('Os cards devem estar visíveis.');
    if (viewport.width >= 1024) {
      expect(future.x).toBeGreaterThanOrEqual(current.x + current.width);
      expect(Math.abs(future.y - current.y)).toBeLessThanOrEqual(1);
    } else {
      expect(future.y).toBeGreaterThanOrEqual(current.y + current.height);
      expect(Math.abs(future.x - current.x)).toBeLessThanOrEqual(1);
    }
    await futureControl.scrollIntoViewIfNeeded();
    const controlBox = await futureControl.boundingBox();
    if (!controlBox) throw new Error('O controle desabilitado deve estar visível.');
    await page.mouse.click(
      controlBox.x + controlBox.width / 2,
      controlBox.y + controlBox.height / 2,
    );
    await futureControl.focus();
    await expect(futureControl).not.toBeFocused();
    await page.keyboard.press('Space');
    await page.keyboard.press('Enter');
    await expect(futureControl).toHaveAttribute('aria-checked', 'false');
    await expect(futureControl).toBeDisabled();
    expect(saved).toBeUndefined();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    console.info(
      JSON.stringify({ viewport: viewport.width, settingsCard: current, futureCard: future }),
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `.tmp/infinitepay-settings-${viewport.width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('checkbox', { name: 'Gerar links automaticamente' }).check();
  await page.getByLabel('Antecedência').selectOption('2');
  await page.getByRole('button', { name: 'Salvar configuração' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Configuração salva' })).toBeVisible();
  expect(saved).toEqual({
    ativo: true,
    geracao_automatica: true,
    dias_antecedencia: 2,
    handle: 'conta-teste',
  });
  await page.screenshot({ path: '.tmp/infinitepay-settings.png', fullPage: true });
  await page.getByRole('tab', { name: 'Mensalidades' }).click();
  await page.getByRole('button', { name: 'Detalhes', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Registrar recebimento' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Conferir pagamento' })).toBeVisible();
  await expect(page.getByText(/servidor|conforme a API/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Gerar link de pagamento' }).click();
  await expect(page.getByRole('link', { name: 'Abrir página de pagamento' })).toHaveAttribute(
    'href',
    `/pagamento/${token}`,
  );
  await expect(page.getByRole('button', { name: 'Copiar link para o cliente' })).toBeVisible();
});
