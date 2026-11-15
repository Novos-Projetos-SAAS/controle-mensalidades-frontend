import { api, type Cliente } from '@/lib/api';

export type WhatsappContext = { organizacaoId: string; areaId: string };
export type Configuration = {
  organizacao_id: string;
  area_negocio_id: string | null;
  whatsapp_business_account_id: string | null;
  phone_number_id: string | null;
  numero_exibido: string | null;
  nome_negocio: string | null;
  situacao_conexao: string;
  situacao_autorizacao: string;
  situacao_templates: string;
  ativo: boolean;
  ultima_validacao_em: string | null;
  motivo_indisponibilidade: string | null;
};
export type ConfigurationInput = {
  whatsappBusinessAccountId: string;
  phoneNumberId: string;
  numeroExibido: string;
  nomeNegocio: string;
};

export const reminderTypes = {
  'D-1': 'Cobrança na véspera',
  D0: 'Lembrete no vencimento',
  'D+3': 'Lembrete três dias após o vencimento',
};
export type Template = {
  chave: string;
  tipo: keyof typeof reminderTypes;
  nome: string;
  conteudo: string;
  variaveis: string[];
  situacaoMeta: string;
  aprovadoMeta: boolean;
  ativo: boolean;
};

export const statuses = {
  PENDENTE: 'Pendente',
  PROCESSANDO: 'Processando',
  ENVIADA: 'Enviada',
  ENTREGUE: 'Entregue',
  FALHOU: 'Falhou',
  CANCELADA: 'Cancelada',
  RESULTADO_INCERTO: 'Resultado incerto',
};
export type ActivityStatus = keyof typeof statuses;
type Activity = {
  id: string;
  cliente_id: string | null;
  mensalidade_id: string | null;
  tipo: string;
  status: ActivityStatus;
};
export type Task = Activity & {
  lembrete_tipo: keyof typeof reminderTypes | null;
  executar_em: string;
  motivo_cancelamento: string | null;
  codigo_resultado: string | null;
};
export type Message = Activity & {
  modo_processamento: string | null;
  enviado_em: string | null;
  entregue_em: string | null;
  criado_em: string;
  erro_codigo: string | null;
};
export type ActivityPage<T> = {
  items: T[];
  pagination: { page: number; pageSize: number; total: number; pages: number };
};
export type ConsentState = Pick<Cliente, 'id'> & {
  aceite_whatsapp: boolean;
  aceite_whatsapp_em: string | null;
  origem_aceite_whatsapp: string | null;
  opt_out_whatsapp_em: string | null;
  origem_opt_out_whatsapp: string | null;
};

export const configurationKey = (orgId: string) => ['whatsapp', orgId, 'configuracoes'] as const;
export const activityKey = (context: WhatsappContext, kind: 'tarefas' | 'mensagens') =>
  ['whatsapp', context.organizacaoId, context.areaId, kind] as const;
export const getConfigurations = (organizacaoId: string, signal: AbortSignal) =>
  api<Configuration[]>('/whatsapp/configuracoes', { signal }, { organizacaoId });
export const saveConfiguration = (
  organizacaoId: string,
  areaNegocioId: string | null,
  values: ConfigurationInput,
) =>
  api<Configuration>(
    '/whatsapp/configuracoes',
    { method: 'PUT', body: JSON.stringify({ ...values, areaNegocioId }) },
    { organizacaoId },
  );
export const getTemplates = (context: WhatsappContext, signal: AbortSignal) =>
  api<Template[]>('/whatsapp/modelos', { signal }, context);

export function getActivity<K extends 'tarefas' | 'mensagens'>(
  context: WhatsappContext,
  kind: K,
  page: number,
  status: ActivityStatus | '',
  signal: AbortSignal,
) {
  const params = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (status) params.set('status', status);
  return api<ActivityPage<K extends 'tarefas' ? Task : Message>>(
    `/whatsapp/${kind}?${params}`,
    { signal },
    context,
  );
}

export function saveConsent(organizacaoId: string, clienteId: string, accept: boolean) {
  return api<ConsentState>(
    `/clientes/${encodeURIComponent(clienteId)}/whatsapp/${accept ? 'aceitar' : 'revogar'}`,
    { method: 'PATCH', body: JSON.stringify({ origem: 'Painel Orbe Gestão' }) },
    { organizacaoId },
  );
}
