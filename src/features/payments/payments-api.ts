import { api, ApiError } from '@/lib/api';
import type { FinanceContext } from '@/features/finance/finance-api';
import type { PaymentEvidence } from './payment-utils';

export type InfinitePaySettingsData = {
  ativo: boolean;
  geracao_automatica: boolean;
  dias_antecedencia: 1 | 2;
  handle: string | null;
  has_api_key: boolean;
};
export type SettingsInput = Omit<InfinitePaySettingsData, 'has_api_key'> & { api_key?: string };
export type PublicCharge = {
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
  generate: (context: FinanceContext, mensalidadeId: string) =>
    api<AdminCharge>(
      `/financeiro/mensalidades/${encodeURIComponent(mensalidadeId)}/cobranca`,
      { method: 'POST', signal: AbortSignal.timeout(30000) },
      context,
    ),
  reconcile: (context: FinanceContext, id: string, body: PaymentEvidence) =>
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
