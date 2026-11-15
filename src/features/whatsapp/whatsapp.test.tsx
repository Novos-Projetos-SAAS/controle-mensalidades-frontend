import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WhatsappRoute from '@/app/configuracoes/whatsapp/page';
import { SessionProvider } from '@/features/auth/session';
import { PeoplePage } from '@/features/people/people-page';
import type { Configuration, Message, Task, Template } from './whatsapp-api';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/configuracoes/whatsapp',
}));

const fetchMock = vi.fn<typeof fetch>();
const json = (data: unknown) => Response.json({ data });
const when = '2026-11-15T13:30:00.000Z';
const area = { id: 'area-a', nome: 'Área A', ativo: true };
const otherArea = { id: 'area-b', nome: 'Área B', ativo: true };
const config: Configuration = {
  organizacao_id: 'org-a',
  area_negocio_id: 'area-a',
  nome_negocio: 'Academia A',
  numero_exibido: '+55 00 00000-1234',
  whatsapp_business_account_id: '1234',
  phone_number_id: '5678',
  ativo: false,
  situacao_conexao: 'PENDENTE_AUTORIZACAO',
  situacao_autorizacao: 'PENDENTE',
  situacao_templates: 'NAO_VALIDADO',
  ultima_validacao_em: null,
  motivo_indisponibilidade: 'AUTORIZACAO_META_PENDENTE',
};
const template: Template = {
  chave: 'vespera',
  tipo: 'D-1',
  nome: 'Cobrança véspera',
  conteudo: 'Olá, {{cliente}}!',
  variaveis: ['cliente'],
  situacaoMeta: 'NAO_SUBMETIDO',
  aprovadoMeta: false,
  ativo: false,
};
const task: Task = {
  id: 'task-a',
  cliente_id: 'client-a',
  mensalidade_id: 'fee-a',
  tipo: 'WHATSAPP_COBRANCA_D1',
  lembrete_tipo: 'D-1',
  executar_em: when,
  status: 'CANCELADA',
  motivo_cancelamento: 'CONSENTIMENTO_REVOGADO',
  codigo_resultado: null,
};
const message: Message = {
  id: 'message-a',
  cliente_id: 'client-a',
  mensalidade_id: 'fee-a',
  tipo: 'WHATSAPP_COBRANCA_D-1',
  status: 'ENVIADA',
  modo_processamento: 'SIMULADO',
  criado_em: when,
  enviado_em: when,
  entregue_em: null,
  erro_codigo: null,
};
const paginated = (items: unknown[], page = 1, pages = 1) =>
  json({ items, pagination: { page, pageSize: 20, total: items.length, pages } });
type Request = {
  path: string;
  org: string | null;
  area: string | null;
  method: string;
  body: unknown;
};

function setup(
  handle: (call: Request) => Response | Promise<Response>,
  {
    profile = 'ADMINISTRADOR',
    clients = false,
    areas = [area, otherArea],
  }: { profile?: string; clients?: boolean; areas?: (typeof area)[] } = {},
) {
  const calls: Request[] = [];
  fetchMock.mockImplementation(async (input, init) => {
    const path = String(input);
    if (path === '/api/v1/auth/me')
      return json({
        usuario: { id: 'admin', nome: 'Pessoa Teste', email: 'teste@example.com' },
        organizacoes: [{ id: 'org-a', nome: 'Organização A', perfil: profile }],
      });
    if (path === '/api/v1/areas-negocio') return json(areas);
    const headers = new Headers(init?.headers);
    const call = {
      path,
      org: headers.get('x-organizacao-id'),
      area: headers.get('x-area-negocio-id'),
      method: init?.method ?? 'GET',
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    return handle(call);
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SessionProvider>
        {clients ? <PeoplePage kind="clientes" /> : <WhatsappRoute />}
      </SessionProvider>
    </QueryClientProvider>,
  );
  return calls;
}
const show = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('WhatsApp Business', () => {
  it('exibe o painel e o estado não configurado para administrador', async () => {
    const calls = setup(() => json([]));
    await screen.findByText('Não configurado');
    expect(screen.getByRole('heading', { name: 'WhatsApp Business' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'WhatsApp Business' }).getAttribute('href')).toBe(
      '/configuracoes/whatsapp',
    );
    expect(
      screen.getByText('Conexão oficial com a Meta disponível em uma próxima etapa.'),
    ).toBeTruthy();
    expect(calls).toEqual([
      {
        path: '/api/v1/whatsapp/configuracoes',
        org: 'org-a',
        area: null,
        method: 'GET',
        body: undefined,
      },
    ]);
  });

  it('bloqueia o operador no acesso direto sem consultar a API do módulo', async () => {
    const calls = setup(() => json([]), { profile: 'OPERADOR' });
    await screen.findByText('Acesso restrito');
    expect(screen.queryByRole('link', { name: 'WhatsApp Business' })).toBeNull();
    expect(calls).toEqual([]);
  });

  it('filtra configurações por área e mostra erro real da integração', async () => {
    setup(() =>
      json([
        config,
        {
          ...config,
          area_negocio_id: 'area-b',
          nome_negocio: 'Academia B',
          situacao_conexao: 'ERRO',
          motivo_indisponibilidade: 'VALIDACAO_META_PENDENTE',
        },
      ]),
    );
    await screen.findByText('Academia A');
    expect(screen.queryByText('Academia B')).toBeNull();
    fireEvent.change(screen.getByLabelText('Área de negócio'), { target: { value: 'area-b' } });
    await screen.findByText('Academia B');
    expect(screen.queryByText('Academia A')).toBeNull();
    expect(screen.getByText('Erro')).toBeTruthy();
    expect(screen.getByText('Aguardando validação oficial da Meta.')).toBeTruthy();
  });

  it('salva apenas os metadados no escopo da área e mantém a autorização pendente', async () => {
    let configurations: Configuration[] = [];
    const calls = setup(({ method }) => {
      if (method === 'GET') return json(configurations);
      configurations = [config];
      return json(config);
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Cadastrar remetente da área' }));
    show('Salvar remetente');
    await screen.findAllByText('Preencha este campo.');
    expect(calls.every(({ method }) => method === 'GET')).toBe(true);
    fireEvent.change(screen.getByLabelText('Nome do negócio'), {
      target: { value: config.nome_negocio },
    });
    fireEvent.change(screen.getByLabelText('Número remetente'), {
      target: { value: config.numero_exibido },
    });
    fireEvent.change(screen.getByLabelText(/ID da conta WhatsApp/), { target: { value: '1234' } });
    fireEvent.change(screen.getByLabelText('ID do número de telefone'), {
      target: { value: '5678' },
    });
    show('Salvar remetente');
    await screen.findByText('Pendente de autorização');
    expect(calls.find(({ method }) => method === 'PUT')).toMatchObject({
      org: 'org-a',
      area: null,
      body: {
        nomeNegocio: 'Academia A',
        numeroExibido: config.numero_exibido,
        whatsappBusinessAccountId: '1234',
        phoneNumberId: '5678',
        areaNegocioId: 'area-a',
      },
    });
  });

  it('consulta modelos somente leitura, lembretes e histórico na área selecionada', async () => {
    const calls = setup(({ path }) => {
      if (path.endsWith('/modelos')) return json([template]);
      if (path.includes('/tarefas?')) return paginated([task]);
      if (path.includes('/mensagens?'))
        return paginated(path.includes('status=ENVIADA') ? [message] : []);
      return json([]);
    });
    await screen.findByText('Não configurado');
    fireEvent.change(screen.getByLabelText('Área de negócio'), { target: { value: 'area-b' } });
    show('Modelos de mensagem');
    await screen.findByText('Ainda não submetido à Meta');
    expect(screen.getByText('Olá, {{cliente}}!')).toBeTruthy();
    show('Lembretes automáticos');
    await screen.findByText('Consentimento revogado.');
    expect(screen.getByText('D+3')).toBeTruthy();
    expect(screen.getByText('fee-a')).toBeTruthy();
    show('Histórico de mensagens');
    await screen.findByText('Nenhuma mensagem encontrada');
    fireEvent.change(screen.getByLabelText('Situação'), { target: { value: 'ENVIADA' } });
    const history = within(await screen.findByRole('list', { name: 'Histórico de mensagens' }));
    expect(history.getByText('Enviada')).toBeTruthy();
    expect(history.getByText('Simulação')).toBeTruthy();
    expect(history.queryByText('Entregue')).toBeNull();
    expect(
      calls
        .filter(({ path }) => !path.endsWith('/configuracoes'))
        .map(({ org, area, method }) => [org, area, method]),
    ).toEqual(Array.from({ length: 4 }, () => ['org-a', 'area-b', 'GET']));
  });

  it('mostra erro de consulta com nova tentativa', async () => {
    let attempts = 0;
    setup(() =>
      ++attempts === 1
        ? Response.json({ mensagem: 'Falha na consulta.' }, { status: 503 })
        : json([]),
    );
    await screen.findByText('Falha na consulta.');
    show('Tentar novamente');
    await screen.findByText('Não configurado');
  });

  it('pede área ativa antes de consultar registros com escopo de área', async () => {
    const calls = setup(() => json([]), { areas: [] });
    await screen.findByText('Não configurado');
    show('Histórico de mensagens');
    await screen.findByText('Selecione uma área');
    expect(calls).toHaveLength(1);
  });

  it('registra e revoga consentimento no detalhe do cliente com confirmação explícita', async () => {
    let accepted = false;
    const consent = () => ({
      id: 'client-a',
      aceite_whatsapp: accepted,
      aceite_whatsapp_em: accepted ? when : null,
      origem_aceite_whatsapp: accepted ? 'Painel Orbe Gestão' : null,
      opt_out_whatsapp_em: accepted ? null : when,
      origem_opt_out_whatsapp: accepted ? null : 'Painel Orbe Gestão',
    });
    const person = () => ({
      ...consent(),
      nome: 'Cliente Teste',
      cpf: null,
      telefone: null,
      email: null,
      ativo: true,
      areas: [area],
    });
    const calls = setup(
      ({ path, method }) => {
        if (method === 'PATCH') {
          accepted = path.endsWith('/aceitar');
          return json(consent());
        }
        return json(path.includes('/client-a') ? person() : [person()]);
      },
      { clients: true, profile: 'OPERADOR' },
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Ver detalhes de Cliente Teste' }));
    await screen.findByText('WhatsApp: Não autorizado');
    show('Registrar consentimento');
    expect(calls.some(({ method }) => method === 'PATCH')).toBe(false);
    show('Confirmar aceite');
    await screen.findByText('WhatsApp: Autorizado');
    show('Revogar consentimento');
    expect(calls.filter(({ method }) => method === 'PATCH')).toHaveLength(1);
    show('Confirmar revogação');
    await screen.findByText('Consentimento revogado.');
    expect(screen.getByText('WhatsApp: Não autorizado')).toBeTruthy();
    expect(calls.filter(({ method }) => method === 'PATCH')).toEqual(
      ['aceitar', 'revogar'].map((operation) => ({
        org: 'org-a',
        area: null,
        method: 'PATCH',
        path: `/api/v1/clientes/client-a/whatsapp/${operation}`,
        body: { origem: 'Painel Orbe Gestão' },
      })),
    );
  });
});
