import { ApiError } from '@/lib/api';
import { reminderTypes, type Task, type Message } from './whatsapp-api';

const labels: Record<string, string> = {
  NAO_CONFIGURADO: 'Não configurado',
  PENDENTE_AUTORIZACAO: 'Pendente de autorização',
  CONFIGURADO: 'Configurado',
  ATIVO: 'Ativo',
  ERRO: 'Erro',
  DESCONECTADO: 'Desconectado',
  PENDENTE: 'Pendente',
  AUTORIZADO: 'Autorizado',
  REVOGADO: 'Revogado',
  NAO_VALIDADO: 'Não validado',
  VALIDADO: 'Validado',
  AUTORIZACAO_META_PENDENTE: 'Aguardando autorização oficial da Meta.',
  VALIDACAO_META_PENDENTE: 'Aguardando validação oficial da Meta.',
  CONSENTIMENTO_REVOGADO: 'Consentimento revogado.',
  CONSENTIMENTO_NAO_ATIVO: 'Cliente sem consentimento.',
  CONSENTIMENTO_REVOGADO_ANTES_DO_ENVIO: 'Consentimento revogado antes do envio.',
  MENSALIDADE_QUITADA: 'Mensalidade quitada.',
  MENSALIDADE_CANCELADA: 'Mensalidade cancelada.',
  RECONCILIACAO_FINANCEIRA_PENDENTE: 'Reconciliação financeira pendente.',
  TEMPLATE_META_NAO_APROVADO: 'Modelo ainda não aprovado pela Meta.',
};
const formatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export function displayDate(value: string | null | undefined) {
  const timestamp = value ? Date.parse(value) : NaN;
  return Number.isFinite(timestamp) ? formatter.format(timestamp) : '—';
}

export function displayState(value: string) {
  return labels[value] ?? value;
}

export function activityType(item: Task | Message) {
  if ('lembrete_tipo' in item && item.lembrete_tipo) return reminderTypes[item.lembrete_tipo];
  const suffix = /^WHATSAPP_COBRANCA_(D-?1|D0|D\+?3)$/.exec(item.tipo)?.[1];
  if (suffix === 'D-1' || suffix === 'D1') return reminderTypes['D-1'];
  if (suffix === 'D0') return reminderTypes.D0;
  if (suffix === 'D+3' || suffix === 'D3') return reminderTypes['D+3'];
  return item.tipo;
}

export function queryError(error: Error) {
  if (error instanceof ApiError && error.status === 404)
    return 'Esta consulta do WhatsApp ainda não está disponível na API.';
  return error.message;
}
