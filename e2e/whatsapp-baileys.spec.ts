import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('Baileys: painel solicita confirmação e distingue envio de entrega', async ({ page }) => {
  let status = 'DESCONECTADO';
  let testado = false;
  let requisicoes = 0;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/auth/me') return route.fulfill({ json: { data: {
      usuario: { id: 'u1', nome: 'Pessoa Teste', email: 'teste@example.com' },
      organizacoes: [{ id: 'org1', nome: 'Organização de teste', perfil: 'ADMINISTRADOR' }],
    } } });
    if (path === '/api/v1/areas-negocio') return route.fulfill({ json: { data: [{ id: 'area1', nome: 'Área de teste', ativo: true }] } });
    if (path === '/api/v1/whatsapp/configuracoes') return route.fulfill({ json: { data: [] } });
    if (path === '/api/v1/whatsapp/baileys/conectar') status = 'CONECTADO';
    if (path === '/api/v1/whatsapp/baileys/testar') {
      expect(route.request().postDataJSON()).toEqual({ confirmado: true });
      requisicoes++;
      testado = true;
      return route.fulfill({ json: { data: { status: 'SUBMETIDO' } } });
    }
    if (path.startsWith('/api/v1/whatsapp/baileys/')) return route.fulfill({ json: { data: {
      habilitado: true, status, salvo: status === 'CONECTADO', qr: null,
      ultimoTeste: testado ? 'SUBMETIDO' : null, destinatarioTeste: '+5511999999999',
      modo: status === 'CONECTADO' ? 'DEMO' : null, testado, rotinaAtiva: false,
    } } });
    return route.abort();
  });
  await page.goto('/configuracoes/whatsapp');
  await page.getByRole('button', { name: 'Conexão Baileys' }).click();
  const enviar = page.getByRole('button', { name: 'Enviar mensagem de teste' });
  await expect(enviar).toBeDisabled();
  await page.getByRole('button', { name: 'Conectar WhatsApp', exact: true }).click();
  await page.getByRole('checkbox').check();
  await expect(enviar).toBeEnabled();
  await enviar.click();
  await expect(page.getByText('Mensagem submetida. Confirme o recebimento no celular de teste.')).toBeVisible();
  await expect(enviar).toBeDisabled();
  expect(requisicoes).toBe(1);
});
