import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type FinanceContext = { organizacaoId: string; areaId: string };
export type Plano = {
  id: string;
  nome: string;
  descricao: string | null;
  valor_base: string;
  periodicidade: string;
  area_negocio_id: string | null;
  ativo?: boolean;
};
export type Assinatura = {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  plano_comercial_id: string;
  plano_nome: string;
  valor_contratado: string;
  desconto_recorrente: string;
  dia_vencimento: number;
  inicio_em: string;
  fim_em: string | null;
  status: 'ATIVA' | 'CANCELADA' | 'ENCERRADA';
  criado_em: string;
};
export type Pagamento = {
  id: string;
  valor: string;
  forma_pagamento: string;
  origem: string;
  pago_em: string;
  criado_em: string;
};
export type Mensalidade = {
  id: string;
  conta_receber_id: string;
  assinatura_id: string;
  cliente_id: string;
  cliente_nome: string;
  competencia: string;
  valor_base: string;
  desconto_recorrente: string;
  ajuste_competencia: string;
  valor_final: string;
  vencimento_em: string;
  status_conta: string;
  valor_pago: string;
  saldo: string;
  status: 'PENDENTE' | 'PARCIAL' | 'VENCIDA' | 'PAGA' | 'CANCELADA';
  pagamentos?: Pagamento[];
};
export type Resumo = {
  clientes_ativos: string;
  profissionais_ativos: string;
  mensalidades_em_aberto: string;
  mensalidades_vencidas: string;
  valor_em_aberto: string;
  valor_vencido: string;
  recebido_periodo: string;
  periodo: { inicio: string; fim: string };
};
export type Pagina<T> = {
  items: T[];
  pagination: { page: number; pageSize: number; total: number; pages: number };
};
export type Filtros = {
  page: number;
  status?: string;
  clienteId?: string;
  competencia?: string;
  vencimentoDe?: string;
  vencimentoAte?: string;
};

export const financeKey = (context: FinanceContext) =>
  ['financeiro', context.organizacaoId, context.areaId] as const;
const ctx = (context: FinanceContext) => context;
const search = (values: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined && value !== '') params.set(key, String(value));
  return params.toString();
};

export const financeApi = {
  planos: (context: FinanceContext, signal?: AbortSignal) =>
    api<Plano[]>('/financeiro/planos', { signal }, ctx(context)),
  plano: (context: FinanceContext, id: string, signal?: AbortSignal) =>
    api<Plano>(`/financeiro/planos/${id}`, { signal }, ctx(context)),
  criarPlano: (
    context: FinanceContext,
    body: { nome: string; descricao?: string; valor_base: string },
  ) =>
    api<Plano>('/financeiro/planos', { method: 'POST', body: JSON.stringify(body) }, ctx(context)),
  assinaturas: (context: FinanceContext, filtros: Filtros, signal?: AbortSignal) =>
    api<Pagina<Assinatura>>(
      `/financeiro/assinaturas?${search({ page: filtros.page, pageSize: 20, status: filtros.status, clienteId: filtros.clienteId })}`,
      { signal },
      ctx(context),
    ),
  assinatura: (context: FinanceContext, id: string, signal?: AbortSignal) =>
    api<Assinatura>(`/financeiro/assinaturas/${id}`, { signal }, ctx(context)),
  criarAssinatura: (
    context: FinanceContext,
    body: {
      cliente_id: string;
      plano_comercial_id: string;
      dia_vencimento: number;
      inicio_em: string;
    },
  ) =>
    api<Assinatura>(
      '/financeiro/assinaturas',
      { method: 'POST', body: JSON.stringify(body) },
      ctx(context),
    ),
  gerarMensalidade: (context: FinanceContext, id: string, competencia: string) =>
    api<{ mensalidade: Mensalidade; criada: boolean }>(
      `/financeiro/assinaturas/${id}/mensalidades`,
      { method: 'POST', body: JSON.stringify({ competencia }) },
      ctx(context),
    ),
  mensalidades: (context: FinanceContext, filtros: Filtros, signal?: AbortSignal) =>
    api<Pagina<Mensalidade>>(
      `/financeiro/mensalidades?${search({ page: filtros.page, pageSize: 20, status: filtros.status, clienteId: filtros.clienteId, competencia: filtros.competencia, vencimentoDe: filtros.vencimentoDe, vencimentoAte: filtros.vencimentoAte })}`,
      { signal },
      ctx(context),
    ),
  mensalidade: (context: FinanceContext, id: string, signal?: AbortSignal) =>
    api<Mensalidade>(`/financeiro/mensalidades/${id}`, { signal }, ctx(context)),
  resumo: (context: FinanceContext, inicio: string, fim: string, signal?: AbortSignal) =>
    api<Resumo>(`/financeiro/resumo?${search({ inicio, fim })}`, { signal }, ctx(context)),
  receber: (
    context: FinanceContext,
    id: string,
    key: string,
    body: { valor: string; forma_pagamento: string; pago_em: string },
  ) =>
    api<{ pagamento: Pagamento; repetido: boolean }>(
      `/financeiro/mensalidades/${id}/recebimentos`,
      {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      },
      ctx(context),
    ),
};

export function useFinanceQuery<T>(
  context: FinanceContext,
  suffix: readonly unknown[],
  queryFn: (signal: AbortSignal) => Promise<T>,
  enabled = true,
) {
  return useQuery({
    queryKey: [...financeKey(context), ...suffix],
    queryFn: ({ signal }) => queryFn(signal),
    enabled: enabled && !!context.organizacaoId && !!context.areaId,
  });
}
