import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClienteMensalidades } from './cliente-mensalidades';

const clienteId = '33333333-3333-4333-8333-333333333333';
const mensalidadeId = '44444444-4444-4444-8444-444444444444';
const pagamentoId = '55555555-5555-4555-8555-555555555555';
const contexto = {
  organizacaoId: '11111111-1111-4111-8111-111111111111',
  areaId: '22222222-2222-4222-8222-222222222222',
};

const paga = {
  id: mensalidadeId, cliente_id: clienteId, cliente_nome: 'Pessoa Fictícia',
  conta_receber_id: '66666666-6666-4666-8666-666666666666',
  assinatura_id: '77777777-7777-4777-8777-777777777777',
  competencia: '2026-10-01', vencimento_em: '2026-10-15',
  valor_base: '150.00', desconto_recorrente: '0.00', ajuste_competencia: '0.00',
  valor_final: '150.00', valor_pago: '150.00', saldo: '0.00',
  status: 'PAGA' as const, status_conta: 'PAGO',
};

const pendente = {
  ...paga, id: '88888888-8888-4888-8888-888888888888',
  competencia: '2026-11-01', vencimento_em: '2026-11-15',
  valor_pago: '0.00', saldo: '150.00', status: 'PENDENTE' as const, status_conta: 'PENDENTE',
};

const pagamento = {
  id: pagamentoId, valor: '150.00', forma_pagamento: 'PIX', origem: 'MANUAL',
  pago_em: '2026-10-14T17:00:00.000Z', criado_em: '2026-10-14T17:01:00.000Z',
};

function prepararFetch({
  items = [paga, pendente], pagamentos = [pagamento], bloqueado = false,
}: {
  items?: Array<typeof paga | typeof pendente>;
  pagamentos?: typeof pagamento[];
  bloqueado?: boolean;
} = {}) {
  const fetchMock = vi.fn(async (url: string, _options?: RequestInit) => {
    void _options;
    if (bloqueado) return new Response(JSON.stringify({
      codigo: 'PERFIL_NAO_AUTORIZADO', mensagem: 'Acesso negado.',
    }), { status: 403 });
    const isDetail = url.includes('/mensalidades/') && !url.includes('?');
    const data = isDetail
      ? { ...paga, pagamentos }
      : {
        items,
        pagination: { page: 1, pageSize: 20, total: items.length, pages: 1 },
      };
    return new Response(JSON.stringify({ data }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function montar(ctx = contexto) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <ClienteMensalidades
        contexto={ctx} clienteId={clienteId} clienteNome="Pessoa Fictícia"
      />
    </QueryClientProvider>,
  );
  return { ...rendered, queryClient };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('aba financeira de cliente', () => {
  it('mostra pagas, pendentes, vencimento e saldos com API filtrada por cliente, área e organização', async () => {
    const fetchMock = prepararFetch();
    montar();
    expect(await screen.findByText('Competência 2026-10')).toBeTruthy();
    expect(screen.getByText('Competência 2026-11')).toBeTruthy();
    expect(screen.getByText('Paga')).toBeTruthy();
    expect(screen.getAllByText('Aguardando pagamento').length).toBeGreaterThan(0);
    expect(screen.getAllByText('R$ 150,00').length).toBeGreaterThan(0);
    const [url, request] = fetchMock.mock.calls[0]!;
    expect(url).toContain('/api/v1/financeiro/mensalidades?');
    expect(url).toContain('clienteId=' + clienteId);
    expect(request?.headers).toMatchObject({
      'x-organizacao-id': contexto.organizacaoId,
      'x-area-negocio-id': contexto.areaId,
    });
    expect(request?.cache).toBe('no-store');
    expect(screen.queryByText('Comprovante interno do recebimento')).toBeNull();
  });

  it('consulta pagamentos somente quando solicitado e mostra comprovante interno com dados reais da API', async () => {
    const fetchMock = prepararFetch();
    montar();
    const botao = (await screen.findAllByRole('button', { name: 'Ver pagamentos e comprovantes' }))[0]!;
    fireEvent.click(botao);
    expect(await screen.findByText('Pagamentos da mensalidade')).toBeTruthy();
    await waitFor(() => expect(fetchMock.mock.calls.length).toBe(2));
    const [url, request] = fetchMock.mock.calls[1]!;
    expect(url).toContain('/financeiro/mensalidades/' + mensalidadeId);
    expect(request?.headers).toMatchObject({
      'x-organizacao-id': contexto.organizacaoId,
      'x-area-negocio-id': contexto.areaId,
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Ver comprovante' }));
    expect(screen.getByText('Comprovante interno do recebimento')).toBeTruthy();
    expect(screen.getByText(pagamentoId)).toBeTruthy();
    expect(screen.getByText('PIX')).toBeTruthy();
    expect(screen.getByText(/Não substitui comprovante bancário/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('não inventa comprovante quando nenhuma baixa existe na API', async () => {
    prepararFetch({ items: [paga], pagamentos: [] });
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Ver pagamentos e comprovantes' }));
    expect(await screen.findByText('Nenhum pagamento registrado para esta mensalidade.', { exact: false })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ver comprovante' })).toBeNull();
  });

  it('filtra mensalidades no servidor e não tenta buscar dados de outras áreas', async () => {
    const fetchMock = prepararFetch();
    montar();
    await screen.findByText('Competência 2026-10');
    fireEvent.change(screen.getByLabelText('Situação das mensalidades'), {
      target: { value: 'PENDENTE' },
    });
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url]) =>
        url.includes('clienteId=' + clienteId) && url.includes('status=PENDENTE'))).toBe(true);
    });
    expect(fetchMock.mock.calls.every(([, request]) =>
      new Headers(request?.headers).get('x-area-negocio-id') === contexto.areaId)).toBe(true);
  });

  it('trata 403 financeiro sem expor nenhum histórico do cliente', async () => {
    prepararFetch({ bloqueado: true });
    montar();
    expect(await screen.findByText('Acesso negado.')).toBeTruthy();
    expect(screen.queryByText('Competência 2026-10')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ver comprovante' })).toBeNull();
  });
});
