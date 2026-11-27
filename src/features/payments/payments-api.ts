import { api, ApiError } from '@/lib/api';
import type { FinanceContext } from '@/features/finance/finance-api';
import type { PaymentEvidence } from './payment-utils';

export type PaymentProvider = 'INFINITEPAY' | 'ABACATEPAY';
export type PaymentIntegrationsData = {
  provedor_padrao: PaymentProvider;
  infinitepay: { ativo: boolean };
  abacatepay: { ativo: boolean };
};
export type AbacatePaySettingsData = {
  id: string | null;
  ativo: boolean;
  ambiente: 'TESTE' | 'PRODUCAO';
  has_api_key: boolean;
  has_webhook_secret: boolean;
  recorrencia_habilitada: boolean;
  cartao_recorrente: boolean;
  pix_automatico_disponivel: boolean;
  pix_automatico_estado: 'NAO_VERIFICADO' | 'DISPONIVEL' | 'INDISPONIVEL';
  webhook_path: string | null;
  estado: 'NAO_CONFIGURADA' | 'CONFIGURADA' | 'ATIVA';
  producao_liberada: boolean;
};
export type AbacatePaySettingsInput = Partial<
  Pick<
    AbacatePaySettingsData,
    'ativo' | 'ambiente' | 'recorrencia_habilitada' | 'cartao_recorrente'
  >
> & {
  api_key?: string;
  webhook_secret?: string;
  pix_automatico_solicitado?: boolean;
};
export type Recurrence = {
  id: string;
  assinatura_id: string;
  status:
    | 'PREPARANDO'
    | 'CRIACAO_INCERTA'
    | 'AGUARDANDO_AUTORIZACAO'
    | 'ATIVA'
    | 'FALHA_PAGAMENTO'
    | 'CANCELAMENTO_PENDENTE'
    | 'CANCELADA'
    | 'REVISAO';
  metodo: 'CARD' | 'PIX';
  checkout_url: string | null;
  assinatura_externa_id: string | null;
  ambiente: 'TESTE' | 'PRODUCAO';
  valor: string;
  data_debito: string | null;
  proxima_cobranca_em: string | null;
  ciclo_inicio_em: string | null;
  ciclo_fim_em: string | null;
  ultimo_erro: string | null;
};
export type InfinitePaySettingsData = {
  ativo: boolean;
  geracao_automatica: boolean;
  dias_antecedencia: 1 | 2;
  handle: string | null;
  has_api_key: boolean;
};
export type SettingsInput = Omit<InfinitePaySettingsData, 'has_api_key'> & { api_key?: string };
export type PublicCharge = {
  provedor?: PaymentProvider;
  status: string;
  valor: string;
  vencimento_em: string;
  checkout_url: string | null;
  expira_em: string | null;
};
export type AdminCharge = PublicCharge & {
  id: string;
  url_plataforma: string | null;
  ultimo_erro: string | null;
};

async function publicRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1/pagamentos/publico/${path}`, {
      ...options,
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: options.signal ?? AbortSignal.timeout(15000),
      headers: options.body ? { 'Content-Type': 'application/json' } : {},
    });
  } catch {
    throw new ApiError('Não foi possível consultar o pagamento. Verifique sua conexão.', 0);
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      payload?.mensagem || 'Link indisponível. Entre em contato com a administração.',
      response.status,
    );
  if (!payload?.data)
    throw new ApiError('Resposta de pagamento inválida. Tente atualizar a situação.', 502);
  return payload.data as T;
}

export const paymentApi = {
  integrations: (context: FinanceContext, signal?: AbortSignal) =>
    api<PaymentIntegrationsData>('/financeiro/integracoes-pagamento', { signal }, context),
  setDefaultProvider: (context: FinanceContext, provedor: PaymentProvider) =>
    api<PaymentIntegrationsData>(
      '/financeiro/provedor-padrao',
      { method: 'PATCH', body: JSON.stringify({ provedor }), signal: AbortSignal.timeout(15000) },
      context,
    ),
  abacateSettings: (context: FinanceContext, signal?: AbortSignal) =>
    api<AbacatePaySettingsData>('/financeiro/abacatepay/configuracao', { signal }, context),
  saveAbacateSettings: (context: FinanceContext, body: AbacatePaySettingsInput) =>
    api<AbacatePaySettingsData>(
      '/financeiro/abacatepay/configuracao',
      { method: 'PATCH', body: JSON.stringify(body), signal: AbortSignal.timeout(15000) },
      context,
    ),
  recurrence: (context: FinanceContext, id: string, signal?: AbortSignal) =>
    api<Recurrence | null>(
      `/financeiro/assinaturas/${encodeURIComponent(id)}/recorrencia`,
      { signal },
      context,
    ),
  createRecurrence: (context: FinanceContext, id: string, metodo: 'CARD' | 'PIX') =>
    api<Recurrence>(
      `/financeiro/assinaturas/${encodeURIComponent(id)}/recorrencia`,
      { method: 'POST', body: JSON.stringify({ metodo }), signal: AbortSignal.timeout(30000) },
      context,
    ),
  reconcileRecurrence: (context: FinanceContext, id: string) =>
    api<Recurrence>(
      `/financeiro/assinaturas/${encodeURIComponent(id)}/recorrencia/conciliar`,
      { method: 'POST', body: '{}', signal: AbortSignal.timeout(15000) },
      context,
    ),
  cancelRecurrence: (context: FinanceContext, id: string) =>
    api<Recurrence>(
      `/financeiro/assinaturas/${encodeURIComponent(id)}/recorrencia/cancelar`,
      { method: 'POST', body: '{}', signal: AbortSignal.timeout(15000) },
      context,
    ),
  settings: (context: FinanceContext, signal?: AbortSignal) =>
    api<InfinitePaySettingsData>('/financeiro/infinitepay/configuracao', { signal }, context),
  saveSettings: (context: FinanceContext, body: SettingsInput) =>
    api<InfinitePaySettingsData>(
      '/financeiro/infinitepay/configuracao',
      { method: 'PATCH', body: JSON.stringify(body), signal: AbortSignal.timeout(15000) },
      context,
    ),
  charge: (context: FinanceContext, mensalidadeId: string, signal?: AbortSignal) =>
    api<AdminCharge | null>(
      `/financeiro/mensalidades/${encodeURIComponent(mensalidadeId)}/cobranca`,
      { signal },
      context,
    ),
  generate: (context: FinanceContext, mensalidadeId: string, provedor?: PaymentProvider) =>
    api<AdminCharge>(
      `/financeiro/mensalidades/${encodeURIComponent(mensalidadeId)}/cobranca`,
      {
        method: 'POST',
        ...(provedor ? { body: JSON.stringify({ provedor }) } : {}),
        signal: AbortSignal.timeout(30000),
      },
      context,
    ),
  reconcile: (context: FinanceContext, id: string, body: PaymentEvidence | Record<string, never>) =>
    api<PublicCharge>(
      `/financeiro/cobrancas/${encodeURIComponent(id)}/conciliar`,
      { method: 'POST', body: JSON.stringify(body), signal: AbortSignal.timeout(15000) },
      context,
    ),
  publicCharge: (token: string, signal?: AbortSignal) =>
    publicRequest<PublicCharge>(encodeURIComponent(token), { signal }),
  confirm: (token: string, body: PaymentEvidence, signal?: AbortSignal) =>
    publicRequest<PublicCharge>(`${encodeURIComponent(token)}/confirmar`, {
      method: 'POST',
      body: JSON.stringify(body),
      signal,
    }),
};
