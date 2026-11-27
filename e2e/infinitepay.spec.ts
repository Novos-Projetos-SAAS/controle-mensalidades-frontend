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
    else if (path === '/api/v1/financeiro/integracoes-pagamento')
      data = {
        provedor_padrao: 'INFINITEPAY',
        infinitepay: { ativo: true },
        abacatepay: { ativo: false },
      };
    else if (path === '/api/v1/financeiro/abacatepay/configuracao')
      data = {
        id: null,
        ativo: false,
        ambiente: 'TESTE',
        has_api_key: false,
        has_webhook_secret: false,
        recorrencia_habilitada: false,
        cartao_recorrente: false,
        pix_automatico_disponivel: false,
        pix_automatico_estado: 'NAO_VERIFICADO',
        webhook_path: null,
        estado: 'NAO_CONFIGURADA',
        producao_liberada: false,
      };
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
  await page.getByRole('tab', { name: 'Integrações de pagamento' }).click();
  const settingsCard = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Salvar configuração' }) });
  const futureCard = page.getByRole('form', { name: 'Configuração AbacatePay' });
  const futureControl = futureCard.getByRole('checkbox', { name: 'Pix Automático', exact: true });
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 375, height: 812 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(futureCard.getByRole('heading', { name: 'AbacatePay' })).toBeVisible();
    await expect(
      futureCard.getByText(/depende de liberação confirmada pelo provedor/),
    ).toBeVisible();
    await expect(futureControl).toBeDisabled();
    await expect(futureControl).not.toBeChecked();
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
    await expect(futureControl).not.toBeChecked();
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

test('AbacatePay configura credenciais, escolhe provedor e autoriza/cancela recorrência por assinatura', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-11-25T15:00:00-03:00'));
  const subscription = {
    id: 's1',
    cliente_id: 'customer-1',
    cliente_nome: 'Cliente de teste',
    plano_comercial_id: 'p1',
    plano_nome: 'Mensal',
    valor_contratado: '50.00',
    desconto_recorrente: '0.00',
    dia_vencimento: 25,
    inicio_em: '2026-11-01',
    fim_em: null,
    status: 'ATIVA',
    criado_em: '2026-11-01',
  };
  const invoice = {
    id: 'm1',
    assinatura_id: 's1',
    cliente_nome: 'Cliente de teste',
    competencia: '2026-11-01',
    valor_final: '50.00',
    valor_pago: '0.00',
    saldo: '50.00',
    vencimento_em: '2026-11-25',
    status: 'PENDENTE',
    pagamentos: [],
  };
  const abacate = {
    id: 'config-1',
    ativo: true,
    ambiente: 'TESTE',
    has_api_key: true,
    has_webhook_secret: true,
    recorrencia_habilitada: true,
    cartao_recorrente: true,
    pix_automatico_disponivel: false,
    pix_automatico_estado: 'INDISPONIVEL',
    webhook_path: '/api/v1/webhooks/abacatepay/config-1',
    estado: 'ATIVA',
    producao_liberada: false,
  };
  let defaultProvider = 'INFINITEPAY';
  let saved: Record<string, unknown> | null = null;
  let generated: Record<string, unknown> | null = null;
  let recurring: Record<string, unknown> | null = null;
  let recurringCreates = 0;
  let reconciled = 0;
  let cancelRequested = 0;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
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
    else if (path === '/api/v1/financeiro/integracoes-pagamento')
      data = {
        provedor_padrao: defaultProvider,
        infinitepay: { ativo: true },
        abacatepay: { ativo: true },
      };
    else if (path === '/api/v1/financeiro/provedor-padrao') {
      defaultProvider = route.request().postDataJSON().provedor;
      data = {
        provedor_padrao: defaultProvider,
        infinitepay: { ativo: true },
        abacatepay: { ativo: true },
      };
    } else if (path === '/api/v1/financeiro/infinitepay/configuracao')
      data = {
        ativo: true,
        geracao_automatica: false,
        dias_antecedencia: 1,
        handle: 'test',
        has_api_key: true,
      };
    else if (path === '/api/v1/financeiro/abacatepay/configuracao') {
      if (method === 'PATCH') saved = route.request().postDataJSON();
      data = abacate;
    } else if (path === '/api/v1/financeiro/planos')
      data = [
        {
          id: 'p1',
          nome: 'Mensal',
          valor_base: '50.00',
          periodicidade: 'MENSAL',
          descricao: null,
          area_negocio_id: 'a1',
        },
      ];
    else if (path === '/api/v1/financeiro/assinaturas')
      data = { items: [subscription], pagination: { page: 1, pageSize: 20, total: 1, pages: 1 } };
    else if (path === '/api/v1/financeiro/assinaturas/s1') data = subscription;
    else if (path === '/api/v1/financeiro/mensalidades')
      data = { items: [invoice], pagination: { page: 1, pageSize: 20, total: 1, pages: 1 } };
    else if (path === '/api/v1/financeiro/mensalidades/m1') data = invoice;
    else if (path === '/api/v1/financeiro/mensalidades/m1/cobranca') {
      if (method === 'POST') generated = route.request().postDataJSON();
      data = generated
        ? {
            ...charge,
            provedor: 'ABACATEPAY',
            checkout_url: 'https://app.abacatepay.com/pay/bill_test',
            id: 'c1',
            url_plataforma: `/pagamento/${token}`,
            ultimo_erro: null,
          }
        : null;
    } else if (path === '/api/v1/financeiro/cobrancas/c1/conciliar') {
      reconciled++;
      expect(route.request().postDataJSON()).toEqual({});
      data = { ...charge, provedor: 'ABACATEPAY' };
    } else if (path === '/api/v1/financeiro/assinaturas/s1/recorrencia') {
      if (method === 'POST') {
        recurringCreates++;
        expect(route.request().postDataJSON()).toEqual({ metodo: 'CARD' });
        recurring = {
          id: 'r1',
          assinatura_id: 's1',
          status: 'AGUARDANDO_AUTORIZACAO',
          metodo: 'CARD',
          checkout_url: 'https://app.abacatepay.com/pay/bill_recurring',
          assinatura_externa_id: 'sub_test',
          ambiente: 'TESTE',
          valor: '50.00',
          data_debito: null,
          proxima_cobranca_em: null,
          ciclo_inicio_em: null,
          ciclo_fim_em: null,
          ultimo_erro: null,
        };
      }
      data = recurring;
    } else if (path === '/api/v1/financeiro/assinaturas/s1/recorrencia/conciliar') {
      recurring = { ...recurring, status: 'ATIVA', checkout_url: null };
      data = recurring;
    } else if (path === '/api/v1/financeiro/assinaturas/s1/recorrencia/cancelar') {
      cancelRequested++;
      recurring = { ...recurring, status: 'CANCELAMENTO_PENDENTE', checkout_url: null };
      data = recurring;
    } else if (path === `/api/v1/pagamentos/publico/${token}`)
      data = {
        ...charge,
        provedor: 'ABACATEPAY',
        checkout_url: 'https://app.abacatepay.com/pay/bill_test',
      };
    await route.fulfill({ json: { status: 'success', data } });
  });
  await page.goto('/financeiro');
  await page.getByRole('tab', { name: 'Integrações de pagamento' }).click();
  const abacateCard = page.getByRole('form', { name: 'Configuração AbacatePay' });
  await expect(abacateCard.getByLabel('Pix Automático', { exact: true })).toBeDisabled();
  await abacateCard.getByLabel('Nova API Key AbacatePay').fill('fixture-replacement-key');
  await abacateCard
    .getByLabel('Novo segredo do webhook AbacatePay')
    .fill('fixture-replacement-secret');
  await abacateCard.getByRole('button', { name: 'Salvar AbacatePay' }).click();
  await expect(abacateCard.getByRole('status')).toHaveText('Configuração AbacatePay salva.');
  expect(saved).toMatchObject({
    api_key: 'fixture-replacement-key',
    webhook_secret: 'fixture-replacement-secret',
    ambiente: 'TESTE',
  });
  await expect(abacateCard.getByLabel('Nova API Key AbacatePay')).toHaveValue('');
  await expect(abacateCard.getByLabel('Novo segredo do webhook AbacatePay')).toHaveValue('');
  await page.getByRole('combobox', { name: 'Provedor padrão' }).selectOption('ABACATEPAY');
  await page.getByRole('button', { name: 'Salvar provedor padrão' }).click();
  await expect(page.getByText('Provedor padrão atualizado.')).toBeVisible();
  await page.getByRole('tab', { name: 'Mensalidades' }).click();
  await page.getByRole('button', { name: 'Detalhes', exact: true }).click();
  await expect(page.getByLabel('Provedor da cobrança')).toHaveValue('ABACATEPAY');
  await page.getByRole('button', { name: 'Gerar link de pagamento' }).click();
  await expect(page.getByRole('link', { name: 'Abrir página de pagamento' })).toBeVisible();
  expect(generated).toEqual({ provedor: 'ABACATEPAY' });
  await page.getByRole('button', { name: 'Conferir pagamento' }).click();
  await expect.poll(() => reconciled).toBe(1);
  await expect(page.getByText('Pagamento confirmado')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'Assinaturas' }).click();
  await page.getByRole('button', { name: 'Detalhes', exact: true }).click();
  await page.getByRole('button', { name: 'Gerar adesão recorrente' }).click();
  await expect(page.getByText('Aguardando autorização', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Abrir adesão AbacatePay' })).toHaveAttribute(
    'href',
    'https://app.abacatepay.com/pay/bill_recurring',
  );
  expect(recurringCreates).toBe(1);
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.tmp/abacatepay-recurring-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Conferir recorrência' }).click();
  await expect(page.getByText('Recorrência ativa', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar recorrência', exact: true }).click();
  expect(cancelRequested).toBe(0);
  await page.getByRole('button', { name: 'Confirmar cancelamento' }).click();
  await expect(page.getByText('Cancelamento pendente', { exact: true })).toBeVisible();
  expect(cancelRequested).toBe(1);
  await page.goto(`/pagamento/${token}`);
  await expect(page.getByRole('link', { name: 'Pagar com AbacatePay' })).toHaveAttribute(
    'href',
    'https://app.abacatepay.com/pay/bill_test',
  );
  await page.screenshot({ path: '.tmp/abacatepay-public-mobile.png', fullPage: true });
});
