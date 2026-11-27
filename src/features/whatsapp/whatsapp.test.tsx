import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WhatsappRoute from '@/app/configuracoes/whatsapp/page';
import { SessionProvider } from '@/features/auth/session';
import { PeoplePage } from '@/features/people/people-page';
import type {
  Configuration,
  Message,
  Task,
  Template,
  WhatsappOnboardingStatus,
} from './whatsapp-api';
import { openMetaEmbeddedSignup, prepareMetaEmbeddedSignup } from './whatsapp-meta-sdk';

const metaSdkMock = vi.hoisted(() => ({ open: vi.fn(), prepare: vi.fn() }));
vi.mock('./whatsapp-meta-sdk', () => ({
  openMetaEmbeddedSignup: metaSdkMock.open,
  prepareMetaEmbeddedSignup: metaSdkMock.prepare,
}));
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
const openSignup = vi.mocked(openMetaEmbeddedSignup);
const prepareSignup = vi.mocked(prepareMetaEmbeddedSignup);
const correlationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const authorizationCode = 'meta-authorization-code-once';
const stateValue = 'one-time-state-value-longer-than-thirty-two-characters';
const metaSdkConfiguration = {
  appId: 'public-app-id',
  configurationId: 'public-configuration-id',
  graphApiVersion: 'v27.0',
  permissions: ['whatsapp_business_management', 'whatsapp_business_messaging'],
  responseType: 'code' as const,
  overrideDefaultResponseType: true as const,
  sessionInfoVersion: 3,
  coexistenceEnabled: true,
  featureType: 'whatsapp_business_app_onboarding' as const,
};
const onboardingStatus: WhatsappOnboardingStatus = {
  correlacaoId: correlationId,
  status: 'CONCLUIDO',
  modoOnboarding: 'CLOUD_API',
  erro: null,
  expiraEm: new Date(Date.now() + 600000).toISOString(),
  concluidoEm: when,
  integracao: {
    metaBusinessId: 'business-1',
    whatsappAccountId: null,
    messagingAccountId: 'waba-1',
    wabaId: 'waba-1',
    phoneNumberId: 'phone-1',
    numeroExibido: '+55 11 99999-0000',
    nomeNegocio: 'Empresa de teste',
    autorizacao: 'AUTORIZADO',
    registroNumero: 'PENDENTE',
    webhook: 'ASSINADO',
    templates: 'NAO_VALIDADO',
    conexao: 'PENDENTE_AUTORIZACAO',
    ativa: false,
  },
  requisitosPendentes: ['ATIVACAO_OPERACIONAL_NAO_LIBERADA'],
  prontaParaEnvio: false,
};
function onboardingResponse(status: WhatsappOnboardingStatus = onboardingStatus, httpStatus = 200) {
  return Response.json({ data: status }, { status: httpStatus });
}
function onboardingHandler(
  status: WhatsappOnboardingStatus = onboardingStatus,
  finish: (call: Request) => Response = () => onboardingResponse(status),
  continueResponse: (call: Request) => Response = () => onboardingResponse(status),
  expiration = new Date(Date.now() + 600000).toISOString(),
) {
  return ({ path, method, ...call }: Request) => {
    if (path.endsWith('/onboarding/configuracao-sdk')) return json(metaSdkConfiguration);
    if (path.endsWith('/onboarding/iniciar'))
      return Response.json({
        data: {
          correlacaoId: correlationId,
          state: stateValue,
          expiraEm: expiration,
          sdk: metaSdkConfiguration,
        },
      });
    if (path.endsWith('/onboarding/concluir')) return finish({ path, method, ...call });
    if (path.endsWith('/continuar')) return continueResponse({ path, method, ...call });
    if (path === '/api/v1/whatsapp/onboarding/' + correlationId) return onboardingResponse(status);
    return json([]);
  };
}
async function startMockSignup(button = 'Conectar WhatsApp Business') {
  show(button);
  await waitFor(() => expect(prepareSignup).toHaveBeenCalledTimes(1));
  expect(openSignup).not.toHaveBeenCalled();
  show('Abrir autorização oficial da Meta');
  await waitFor(() => expect(openSignup).toHaveBeenCalledTimes(1));
  return openSignup.mock.calls[0][1];
}

beforeEach(() => {
  fetchMock.mockReset();
  openSignup.mockReset();
  prepareSignup.mockReset();
  prepareSignup.mockResolvedValue(undefined);
  window.sessionStorage.clear();
  window.localStorage.clear();
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
      screen.getByText('Conecte e acompanhe a autorização, o registro e a preparação do número.'),
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

  it('administrador autoriza com os endpoints da área e não expõe código ou state', async () => {
    const calls = setup(onboardingHandler());
    await screen.findByText('Não conectado');
    const callbacks = await startMockSignup();
    act(() => {
      callbacks.onSession({
        event: 'FINISH',
        data: { waba_id: 'waba-1', phone_number_id: 'phone-1', business_id: 'business-1' },
      });
      callbacks.onLogin({ authResponse: { code: authorizationCode } });
      callbacks.onLogin({ authResponse: { code: authorizationCode } });
    });
    await screen.findByText(
      'Autorização confirmada pelo backend. A integração ainda não está pronta para envios.',
    );
    const finishCalls = calls.filter(({ path }) => path.endsWith('/onboarding/concluir'));
    expect(finishCalls).toHaveLength(1);
    expect(finishCalls[0]).toMatchObject({
      method: 'POST',
      org: 'org-a',
      area: 'area-a',
      body: {
        resultado: 'AUTORIZADO',
        correlacaoId: correlationId,
        state: stateValue,
        codigo: authorizationCode,
        wabaId: 'waba-1',
        phoneNumberId: 'phone-1',
        businessId: 'business-1',
        modoOnboarding: 'CLOUD_API',
      },
    });
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.getItem('orbe:whatsapp:onboarding:org-a:area-a')).toBe(
      correlationId,
    );
    expect(document.body.textContent).not.toContain(authorizationCode);
    expect(document.body.textContent).not.toContain(stateValue);
    expect(screen.getByText('Envio liberado:')).toBeTruthy();
    expect(screen.getByText('Não', { selector: 'strong' })).toBeTruthy();
  });

  it('não habilita onboarding sem uma área ativa', async () => {
    const calls = setup(() => json([]), { areas: [] });
    await screen.findByText(
      'Selecione uma área de negócio ativa e o escopo da área para conectar o WhatsApp.',
    );
    expect(
      screen.getByRole('button', { name: 'Conectar WhatsApp Business' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(calls.some(({ path }) => path.includes('/onboarding/'))).toBe(false);
  });

  it('informa que a configuração Meta está ausente sem abrir o SDK', async () => {
    const calls = setup(({ path }) =>
      path.endsWith('/onboarding/configuracao-sdk')
        ? Response.json({ codigo: 'META_EMBEDDED_SIGNUP_NAO_CONFIGURADO' }, { status: 503 })
        : json([]),
    );
    await screen.findByText('Não conectado');
    show('Conectar WhatsApp Business');
    await screen.findByText(
      'A conexão oficial com a Meta ainda não está configurada pelo administrador da plataforma.',
    );
    expect(openSignup).not.toHaveBeenCalled();
    expect(calls.some(({ path }) => path.endsWith('/onboarding/iniciar'))).toBe(false);
  });

  it('cancela no backend quando o SDK não pode ser carregado', async () => {
    prepareSignup.mockRejectedValueOnce(new Error('SDK unavailable'));
    const calls = setup(onboardingHandler());
    await screen.findByText('Não conectado');
    show('Conectar WhatsApp Business');
    await screen.findByText(/Não foi possível preparar o fluxo oficial da Meta/);
    expect(calls.find(({ path }) => path.endsWith('/onboarding/concluir'))?.body).toEqual({
      resultado: 'CANCELADO',
      correlacaoId: correlationId,
      state: stateValue,
    });
  });

  it('trata o evento oficial de coexistência e registra o modo recebido da Meta', async () => {
    const calls = setup(onboardingHandler());
    await screen.findByText('Não conectado');
    const callbacks = await startMockSignup();
    act(() => {
      callbacks.onLogin({ authResponse: { code: authorizationCode } });
      callbacks.onSession({
        event: 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING',
        data: { waba_id: 'waba-1', phone_number_id: 'phone-1' },
      });
    });
    await screen.findByText(
      'Autorização confirmada pelo backend. A integração ainda não está pronta para envios.',
    );
    expect(calls.find(({ path }) => path.endsWith('/onboarding/concluir'))?.body).toMatchObject({
      modoOnboarding: 'COEXISTENCIA',
    });
  });

  it('trata HTTP 202 como pendência e só solicita PIN quando o backend o exige', async () => {
    const pending: WhatsappOnboardingStatus = {
      ...onboardingStatus,
      status: 'FALHA',
      erro: 'PIN_REGISTRO_NECESSARIO',
      requisitosPendentes: ['PIN_REGISTRO_NECESSARIO', 'ASSINATURA_DE_WEBHOOK_PENDENTE'],
    };
    const calls = setup(
      onboardingHandler(
        pending,
        () => onboardingResponse(pending, 202),
        () => onboardingResponse(pending, 202),
      ),
    );
    await screen.findByText('Não conectado');
    const callbacks = await startMockSignup();
    act(() => {
      callbacks.onSession({
        event: 'FINISH',
        data: { waba_id: 'waba-1', phone_number_id: 'phone-1' },
      });
      callbacks.onLogin({ authResponse: { code: authorizationCode } });
    });
    await screen.findByText('PIN de registro solicitado pelo backend');
    expect(screen.getByText(/backend ainda está processando ou aguarda uma ação/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('PIN de registro de seis dígitos'), {
      target: { value: '123456' },
    });
    show('Continuar configuração');
    await waitFor(() => expect(calls.some(({ path }) => path.endsWith('/continuar'))).toBe(true));
    expect(calls.find(({ path }) => path.endsWith('/continuar'))).toMatchObject({
      method: 'POST',
      org: 'org-a',
      area: 'area-a',
      body: { registrationPin: '123456' },
    });
    expect(window.sessionStorage.getItem('orbe:whatsapp:onboarding:org-a:area-a')).toBe(
      correlationId,
    );
    expect(window.localStorage.length).toBe(0);
  });

  it('cancela a tentativa no escopo original quando a área muda', async () => {
    const calls = setup(onboardingHandler());
    await screen.findByText('Não conectado');
    await startMockSignup();
    fireEvent.change(screen.getByLabelText('Área de negócio'), { target: { value: 'area-b' } });
    await waitFor(() =>
      expect(
        calls.some(
          ({ path, body, area }) =>
            path.endsWith('/onboarding/concluir') &&
            area === 'area-a' &&
            (body as { resultado?: string })?.resultado === 'CANCELADO',
        ),
      ).toBe(true),
    );
    expect((screen.getByLabelText('Área de negócio') as HTMLSelectElement).value).toBe('area-b');
  });

  it('não apresenta sucesso quando o backend rejeita as permissões Meta', async () => {
    const calls = setup(
      onboardingHandler(onboardingStatus, () =>
        Response.json(
          { codigo: 'META_PERMISSAO_NEGADA', mensagem: 'Token secreto não deve aparecer' },
          { status: 403 },
        ),
      ),
    );
    await screen.findByText('Não conectado');
    const callbacks = await startMockSignup();
    act(() => {
      callbacks.onSession({
        event: 'FINISH',
        data: { waba_id: 'waba-1', phone_number_id: 'phone-1' },
      });
      callbacks.onLogin({ authResponse: { code: authorizationCode } });
    });
    await screen.findByText(
      'A Meta não autorizou as permissões necessárias. Revise a configuração e as aprovações do aplicativo.',
    );
    expect(document.body.textContent).not.toContain('Token secreto');
    expect(calls.filter(({ path }) => path.endsWith('/onboarding/concluir'))).toHaveLength(1);
  });

  it('oferece reconexão para uma integração já autorizada', async () => {
    const handler = onboardingHandler();
    const calls = setup((request) =>
      request.path.endsWith('/whatsapp/configuracoes')
        ? json([{ ...config, situacao_autorizacao: 'AUTORIZADO' }])
        : handler(request),
    );
    await screen.findByText('Academia A');
    expect(screen.getByRole('button', { name: 'Reconectar WhatsApp Business' })).toBeTruthy();
    await startMockSignup('Reconectar WhatsApp Business');
    expect(calls.some(({ path }) => path.endsWith('/onboarding/iniciar'))).toBe(true);
  });

  it('envia cancelamento ao backend quando o responsável cancela na Meta', async () => {
    const calls = setup(onboardingHandler());
    await screen.findByText('Não conectado');
    const callbacks = await startMockSignup();
    act(() => callbacks.onSession({ event: 'CANCEL', data: {} }));
    await screen.findByText('Onboarding cancelado na janela da Meta.');
    expect(calls.find(({ path }) => path.endsWith('/onboarding/concluir'))?.body).toEqual({
      resultado: 'CANCELADO',
      correlacaoId: correlationId,
      state: stateValue,
    });
  });

  it('invalida a tentativa e envia cancelamento quando o state expira', async () => {
    const expiresSoon = new Date(Date.now() + 25).toISOString();
    const calls = setup(
      onboardingHandler(
        onboardingStatus,
        () => onboardingResponse(onboardingStatus),
        () => onboardingResponse(onboardingStatus),
        expiresSoon,
      ),
    );
    await screen.findByText('Não conectado');
    show('Conectar WhatsApp Business');
    await waitFor(() => expect(prepareSignup).toHaveBeenCalledTimes(1));
    await screen.findByText('A tentativa de autorização expirou. Inicie um novo onboarding.');
    expect(calls.find(({ path }) => path.endsWith('/onboarding/concluir'))?.body).toMatchObject({
      resultado: 'CANCELADO',
      correlacaoId: correlationId,
    });
  });
});
