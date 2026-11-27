import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('painel do WhatsApp cabe em 320, 375, 768 e 1440 px com API simulada', async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== 'GET') return route.abort();
    switch (path) {
      case '/api/v1/auth/me':
        return route.fulfill({
          json: {
            data: {
              usuario: { id: 'u1', nome: 'Pessoa Teste', email: 'teste@example.com' },
              organizacoes: [{ id: 'org1', nome: 'Organização de teste', perfil: 'ADMINISTRADOR' }],
            },
          },
        });
      case '/api/v1/areas-negocio':
        return route.fulfill({
          json: { data: [{ id: 'area1', nome: 'Área de teste', ativo: true }] },
        });
      case '/api/v1/whatsapp/configuracoes':
        return route.fulfill({ json: { data: [] } });
      case '/api/v1/whatsapp/mensagens':
        return route.fulfill({
          json: {
            data: {
              items: [
                {
                  id: 'm1',
                  cliente_id: '67f09974-9025-4076-ad5c-64d8d580d676',
                  mensalidade_id: '67f09974-9025-4076-ad5c-64d8d580d677',
                  tipo: 'WHATSAPP_COBRANCA_D+3',
                  status: 'RESULTADO_INCERTO',
                  modo_processamento: 'SIMULADO',
                  criado_em: '2026-11-15T14:00:00.000Z',
                  enviado_em: null,
                  entregue_em: null,
                  erro_codigo: null,
                },
              ],
              pagination: { page: 1, pageSize: 20, pages: 1, total: 1 },
            },
          },
        });
      default:
        return route.abort();
    }
  });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/configuracoes/whatsapp');
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await expect(
    page.getByRole('dialog').getByRole('link', { name: 'WhatsApp Business' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Fechar menu' }).click();
  await page.getByRole('button', { name: 'Cadastrar remetente da área' }).click();
  await expect(page.getByLabel('ID da conta WhatsApp Business (WABA)')).toBeVisible();
  const horizontalOverflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(await horizontalOverflow()).toBe(false);
  await page.getByRole('button', { name: 'Histórico de mensagens' }).click();
  const history = page.getByRole('list', { name: 'Histórico de mensagens' });
  await expect(history.getByText('Resultado incerto')).toBeVisible();
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(history).toBeVisible();
    expect(await horizontalOverflow(), `largura de ${width} px`).toBe(false);
  }
});
