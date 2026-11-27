'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  continueWhatsappOnboarding,
  finishWhatsappOnboarding,
  getWhatsappOnboardingStatus,
  getWhatsappSdkConfiguration,
  onboardingKey,
  startWhatsappOnboarding,
  type MetaSdkConfiguration,
  type WhatsappContext,
  type WhatsappOnboardingStatus,
} from './whatsapp-api';
import {
  openMetaEmbeddedSignup,
  prepareMetaEmbeddedSignup,
  type MetaLoginResponse,
  type MetaSignupSession,
} from './whatsapp-meta-sdk';
import { displayDate, displayState, queryError } from './whatsapp-display';

type Props = {
  orgId: string;
  areaId?: string;
  enabled: boolean;
  hasAuthorizedIntegration: boolean;
  onAttemptingChange?: (active: boolean) => void;
};

type Attempt = {
  context: WhatsappContext;
  correlationId: string;
  state: string;
  expiresAt: number;
  closed: boolean;
  callbackReceived: boolean;
  code?: string;
  session?: MetaSignupSession;
  cleanupSdk?: () => void;
  expiryTimer?: number;
  waitTimer?: number;
  noCodeTimer?: number;
  finishing: boolean;
};

function storageKey(orgId: string, areaId: string) {
  return 'orbe:whatsapp:onboarding:' + encodeURIComponent(orgId) + ':' + encodeURIComponent(areaId);
}

function readCorrelation(key: string) {
  try {
    const value = window.sessionStorage.getItem(key);
    return value && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
  } catch {
    return null;
  }
}

const correlationListeners = new Map<string, Set<() => void>>();

function subscribeToCorrelation(key: string, listener: () => void) {
  if (!key) return () => undefined;
  const listeners = correlationListeners.get(key) ?? new Set<() => void>();
  listeners.add(listener);
  correlationListeners.set(key, listeners);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) correlationListeners.delete(key);
  };
}

function saveCorrelation(key: string, correlationId: string) {
  if (!key) return;
  try {
    window.sessionStorage.setItem(key, correlationId);
  } catch {
    // A consulta continua disponível durante a sessão mesmo sem sessionStorage.
  }
  correlationListeners.get(key)?.forEach((listener) => listener());
}

function publicError(error: unknown) {
  if (error instanceof ApiError && error.code === 'META_EMBEDDED_SIGNUP_NAO_CONFIGURADO')
    return 'A conexão oficial com a Meta ainda não está configurada pelo administrador da plataforma.';
  if (
    error instanceof ApiError &&
    (error.code?.includes('PERMISSAO') ||
      error.code?.includes('PERMISSION') ||
      error.code?.includes('META_PERMISSION'))
  )
    return 'A Meta não autorizou as permissões necessárias. Revise a configuração e as aprovações do aplicativo.';
  return error instanceof Error
    ? queryError(error)
    : 'Não foi possível concluir o onboarding Meta.';
}

function pendingMessage(status: WhatsappOnboardingStatus | undefined, httpStatus?: number) {
  if (httpStatus === 202)
    return 'A Meta confirmou o retorno, mas o backend ainda está processando ou aguarda uma ação.';
  if (status?.status === 'CONCLUIDO')
    return 'Autorização confirmada pelo backend. A integração ainda não está pronta para envios.';
  if (status?.status === 'FALHA')
    return 'O backend identificou uma pendência no onboarding. Confira os requisitos abaixo.';
  return 'A autorização foi recebida e o backend está concluindo a configuração.';
}

function clearAttempt(attempt: Attempt) {
  attempt.closed = true;
  if (attempt.expiryTimer) window.clearTimeout(attempt.expiryTimer);
  if (attempt.waitTimer) window.clearTimeout(attempt.waitTimer);
  if (attempt.noCodeTimer) window.clearTimeout(attempt.noCodeTimer);
  attempt.cleanupSdk?.();
  attempt.cleanupSdk = undefined;
}

export function WhatsappOnboarding({
  orgId,
  areaId,
  enabled,
  hasAuthorizedIntegration,
  onAttemptingChange,
}: Props) {
  const context = areaId ? { organizacaoId: orgId, areaId } : null;
  const cache = useQueryClient();
  const storeKey = areaId ? storageKey(orgId, areaId) : '';
  const attemptRef = useRef<Attempt | null>(null);
  const launchRef = useRef<(() => void) | null>(null);
  const correlationId = useSyncExternalStore(
    (listener) => subscribeToCorrelation(storeKey, listener),
    () => (storeKey ? readCorrelation(storeKey) : null),
    () => null,
  );
  const [attempting, setAttempting] = useState(false);
  const [launchReady, setLaunchReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [pin, setPin] = useState('');

  const statusQuery = useQuery({
    queryKey:
      context && correlationId
        ? onboardingKey(context, correlationId)
        : ['whatsapp', 'onboarding', 'none'],
    queryFn: ({ signal }) =>
      context && correlationId
        ? getWhatsappOnboardingStatus(context, correlationId, signal)
        : Promise.reject(new Error('Área de negócio não disponível.')),
    enabled: Boolean(context && correlationId),
    refetchInterval: (query) =>
      ['INICIADO', 'PROCESSANDO'].includes(query.state.data?.status ?? '') ? 2000 : false,
  });
  const status = statusQuery.data;
  const requirements = status?.requisitosPendentes ?? [];
  const pinRequired = requirements.includes('PIN_REGISTRO_NECESSARIO');
  const canContinue =
    Boolean(context && status?.integracao) &&
    status?.status !== 'CONCLUIDO' &&
    (pinRequired ||
      requirements.includes('REGISTRO_DO_NUMERO_PENDENTE') ||
      requirements.includes('ASSINATURA_DE_WEBHOOK_PENDENTE'));

  useEffect(
    () => () => {
      const active = attemptRef.current;
      if (!active) return;
      clearAttempt(active);
      attemptRef.current = null;
      const state = active.state;
      active.state = '';
      void finishWhatsappOnboarding(active.context, {
        resultado: 'CANCELADO',
        correlacaoId: active.correlationId,
        state,
      }).catch(() => undefined);
    },
    [orgId, areaId],
  );

  async function refreshStatus(id: string, target: WhatsappContext) {
    const queryKey = onboardingKey(target, id);
    try {
      const latest = await getWhatsappOnboardingStatus(target, id);
      cache.setQueryData(queryKey, latest);
      await cache.invalidateQueries({
        queryKey: ['whatsapp', target.organizacaoId, 'configuracoes'],
        exact: true,
      });
      return latest;
    } catch {
      await cache.invalidateQueries({ queryKey });
      return undefined;
    }
  }

  async function cancelAttempt(attempt: Attempt, message: string, sendCancellation = true) {
    if (attempt.closed) return;
    clearAttempt(attempt);
    if (attemptRef.current === attempt) attemptRef.current = null;
    const state = attempt.state;
    attempt.state = '';
    setAttempting(false);
    setLaunchReady(false);
    launchRef.current = null;
    onAttemptingChange?.(false);
    setBusy(true);
    setNotice(message);
    if (sendCancellation) {
      try {
        await finishWhatsappOnboarding(attempt.context, {
          resultado: 'CANCELADO',
          correlacaoId: attempt.correlationId,
          state,
        });
        await refreshStatus(attempt.correlationId, attempt.context);
      } catch {
        // A tentativa local é invalidada mesmo quando a Meta/backend já a expirou.
      }
    }
    setBusy(false);
  }

  async function completeAttempt(attempt: Attempt) {
    const session = attempt.session;
    if (
      attempt.closed ||
      attempt.finishing ||
      !attempt.code ||
      !session ||
      (session.event !== 'FINISH' && session.event !== 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING')
    )
      return;
    const wabaId = session.data.waba_id;
    const phoneNumberId = session.data.phone_number_id;
    if (!wabaId || !phoneNumberId) {
      await cancelAttempt(
        attempt,
        'A Meta não retornou todos os identificadores da conta. A autorização não foi confirmada; inicie uma nova tentativa.',
      );
      return;
    }
    attempt.finishing = true;
    clearAttempt(attempt);
    if (attemptRef.current === attempt) attemptRef.current = null;
    const state = attempt.state;
    attempt.state = '';
    setAttempting(false);
    setLaunchReady(false);
    launchRef.current = null;
    onAttemptingChange?.(false);
    setBusy(true);
    setNotice('Enviando a confirmação ao backend…');
    saveCorrelation(storeKey, attempt.correlationId);
    try {
      const callback = {
        resultado: 'AUTORIZADO' as const,
        correlacaoId: attempt.correlationId,
        state,
        codigo: attempt.code,
        wabaId,
        phoneNumberId,
        ...(session.data.business_id ? { businessId: session.data.business_id } : {}),
        modoOnboarding:
          session.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'
            ? ('COEXISTENCIA' as const)
            : ('CLOUD_API' as const),
      };
      const finishRequest = finishWhatsappOnboarding(attempt.context, callback);
      attempt.code = undefined;
      attempt.state = '';
      const result = await finishRequest;
      const latest = await refreshStatus(attempt.correlationId, attempt.context);
      setNotice(pendingMessage(latest ?? result.data, result.status));
      setPin('');
    } catch (error) {
      await refreshStatus(attempt.correlationId, attempt.context);
      setNotice(publicError(error));
    } finally {
      setBusy(false);
    }
  }

  async function continueOnboarding() {
    if (!context || !correlationId || !canContinue || busy || attempting) return;
    if (pinRequired && !/^\d{6}$/.test(pin)) {
      setNotice('Informe o PIN de seis dígitos solicitado pelo backend.');
      return;
    }
    const registrationPin = pinRequired ? pin : undefined;
    setPin('');
    setBusy(true);
    setNotice('Continuando o provisionamento no backend…');
    try {
      const result = await continueWhatsappOnboarding(context, correlationId, registrationPin);
      const latest = await refreshStatus(correlationId, context);
      setPin('');
      setNotice(pendingMessage(latest ?? result.data, result.status));
    } catch (error) {
      setNotice(publicError(error));
      await refreshStatus(correlationId, context);
    } finally {
      setBusy(false);
    }
  }

  async function startOnboarding() {
    if (!context || !enabled || busy || attempting) return;
    setNotice('');
    setBusy(true);
    setLaunchReady(false);
    launchRef.current = null;
    let active: Attempt | null = null;
    try {
      const sdkConfiguration: MetaSdkConfiguration = await getWhatsappSdkConfiguration(context);
      if (!sdkConfiguration.appId || !sdkConfiguration.configurationId)
        throw new ApiError(
          'A conexão oficial com a Meta ainda não está configurada pelo administrador da plataforma.',
          503,
          'META_EMBEDDED_SIGNUP_NAO_CONFIGURADO',
        );
      const start = await startWhatsappOnboarding(context);
      const expiresAt = Date.parse(start.expiraEm);
      if (!start.state || !start.correlacaoId || !Number.isFinite(expiresAt))
        throw new Error('O backend retornou uma tentativa inválida.');
      const sdkConfig = start.sdk ?? sdkConfiguration;
      active = {
        context,
        correlationId: start.correlacaoId,
        state: start.state,
        expiresAt,
        closed: false,
        callbackReceived: false,
        finishing: false,
      };
      attemptRef.current = active;
      saveCorrelation(storeKey, start.correlacaoId);
      setAttempting(true);
      onAttemptingChange?.(true);

      const current = active;
      const isCurrent = () => attemptRef.current === current && !current.closed;
      const finishWhenReady = () => {
        if (!isCurrent()) return;
        const session = current.session;
        if (session?.event === 'CANCEL') {
          void cancelAttempt(current, 'Onboarding cancelado na janela da Meta.');
          return;
        }
        if (session?.event === 'ERROR') {
          void cancelAttempt(
            current,
            'A Meta informou uma falha durante a autorização. Confira a configuração e tente novamente.',
          );
          return;
        }
        if (current.code && session?.event?.startsWith('FINISH')) {
          void completeAttempt(current);
          return;
        }
        if (current.callbackReceived && !current.code) {
          if (!current.noCodeTimer) {
            current.noCodeTimer = window.setTimeout(() => {
              void cancelAttempt(
                current,
                'A janela da Meta foi fechada sem confirmar a autorização.',
              );
            }, 1200);
          }
          return;
        }
        if (current.code && !current.waitTimer) {
          current.waitTimer = window.setTimeout(() => {
            void cancelAttempt(
              current,
              'A Meta não confirmou os identificadores da conta. A tentativa foi invalidada por segurança.',
            );
          }, 15000);
        }
      };

      const callbacks = {
        onLogin: (response: MetaLoginResponse | null) => {
          if (!isCurrent()) return;
          current.callbackReceived = true;
          const code = response?.authResponse?.code;
          if (typeof code === 'string' && code.length >= 16) current.code = code;
          finishWhenReady();
        },
        onSession: (session: MetaSignupSession) => {
          if (!isCurrent()) return;
          if (session.event === 'CANCEL' || session.event === 'ERROR') {
            current.session = session;
          } else {
            current.session = {
              ...session,
              data: { ...(current.session?.data ?? {}), ...session.data },
            };
          }
          finishWhenReady();
        },
      };

      const remaining = Math.max(0, current.expiresAt - Date.now());
      current.expiryTimer = window.setTimeout(
        () => {
          void cancelAttempt(
            current,
            'A tentativa de autorização expirou. Inicie um novo onboarding.',
          );
        },
        Math.min(remaining, 10 * 60 * 1000),
      );

      await prepareMetaEmbeddedSignup(sdkConfig);
      if (!isCurrent()) return;
      launchRef.current = () => {
        if (!isCurrent()) return;
        launchRef.current = null;
        setLaunchReady(false);
        setNotice('Aguardando a conclusão do fluxo oficial da Meta…');
        try {
          const cleanup = openMetaEmbeddedSignup(sdkConfig, callbacks);
          if (isCurrent()) current.cleanupSdk = cleanup;
          else cleanup();
        } catch {
          void cancelAttempt(
            current,
            'Não foi possível abrir o fluxo oficial da Meta. Confira o bloqueio de pop-ups e tente novamente.',
          );
        }
      };
      setLaunchReady(true);
      setBusy(false);
      setNotice(
        'Configuração pronta. Clique em “Abrir autorização oficial da Meta” para continuar.',
      );
    } catch (error) {
      if (active && attemptRef.current === active) {
        await cancelAttempt(
          active,
          'Não foi possível preparar o fluxo oficial da Meta: ' + publicError(error),
        );
      } else {
        setNotice(publicError(error));
        setBusy(false);
      }
    }
  }

  function launchMetaSignup() {
    launchRef.current?.();
  }

  function cancelCurrentAttempt() {
    const active = attemptRef.current;
    if (active) void cancelAttempt(active, 'Tentativa de autorização cancelada.');
  }
  const registeredNumber = status?.integracao;
  const startBlockedByPending = ['INICIADO', 'PROCESSANDO'].includes(status?.status ?? '');
  const connectionDisabled = !areaId || !enabled || busy || attempting || startBlockedByPending;
  const authorized = hasAuthorizedIntegration || registeredNumber?.autorizacao === 'AUTORIZADO';

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">Conexão oficial com a Meta</h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Autorize uma conta WhatsApp Business nesta área. A autorização, o registro do número, o
            webhook, os templates e a liberação de envios são etapas separadas.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-800">
          {attempting || startBlockedByPending
            ? 'Aguardando autorização'
            : status
              ? displayState(status.status)
              : authorized
                ? 'Autorizado'
                : 'Não conectado'}
        </span>
      </div>

      {!areaId || !enabled ? (
        <p className="text-sm text-amber-900">
          Selecione uma área de negócio ativa e o escopo da área para conectar o WhatsApp.
        </p>
      ) : null}

      {registeredNumber ? (
        <>
          <dl className="grid gap-3 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-slate-600">Número remetente</dt>
              <dd className="mt-1 font-medium">{registeredNumber.numeroExibido || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-600">Nome do negócio</dt>
              <dd className="mt-1 font-medium">{registeredNumber.nomeNegocio || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-600">Autorização</dt>
              <dd className="mt-1 font-medium">{displayState(registeredNumber.autorizacao)}</dd>
            </div>
            <div>
              <dt className="text-slate-600">Registro do número</dt>
              <dd className="mt-1 font-medium">{displayState(registeredNumber.registroNumero)}</dd>
            </div>
            <div>
              <dt className="text-slate-600">Webhook</dt>
              <dd className="mt-1 font-medium">{displayState(registeredNumber.webhook)}</dd>
            </div>
            <div>
              <dt className="text-slate-600">Templates</dt>
              <dd className="mt-1 font-medium">{displayState(registeredNumber.templates)}</dd>
            </div>
            <div>
              <dt className="text-slate-600">Conexão</dt>
              <dd className="mt-1 font-medium">{displayState(registeredNumber.conexao)}</dd>
            </div>
            <div>
              <dt className="text-slate-600">Autorizado em</dt>
              <dd className="mt-1 font-medium">{displayDate(status?.concluidoEm)}</dd>
            </div>
          </dl>
          <p className="text-sm text-slate-700">
            Envio liberado: <strong>{status.prontaParaEnvio ? 'Sim' : 'Não'}</strong>
          </p>
        </>
      ) : null}

      {status?.requisitosPendentes.length ? (
        <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-medium">Pendências antes da ativação</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {status.requisitosPendentes.map((requirement) => (
              <li key={requirement}>{displayState(requirement)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {statusQuery.isError ? (
        <p role="alert" className="text-sm text-red-700">
          {queryError(statusQuery.error)}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm text-teal-900">
          {notice}
        </p>
      ) : null}

      {pinRequired ? (
        <label className="block max-w-xs">
          <span className="field-label">PIN de registro solicitado pelo backend</span>
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
            aria-label="PIN de registro de seis dígitos"
          />
          <span className="mt-1 block text-xs text-slate-600">
            O PIN será enviado somente ao backend e não será salvo nesta tela.
          </span>
        </label>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canContinue ? (
          <Button
            type="button"
            variant="secondary"
            disabled={busy || attempting || (pinRequired && !/^\d{6}$/.test(pin))}
            onClick={() => void continueOnboarding()}
          >
            {busy ? 'Processando…' : 'Continuar configuração'}
          </Button>
        ) : null}
        {attempting && launchReady ? (
          <Button type="button" disabled={busy || !areaId || !enabled} onClick={launchMetaSignup}>
            Abrir autorização oficial da Meta
          </Button>
        ) : (
          <Button
            type="button"
            disabled={connectionDisabled || Boolean(canContinue)}
            onClick={() => void startOnboarding()}
          >
            {busy
              ? 'Preparando autorização…'
              : attempting
                ? 'Aguardando autorização…'
                : authorized
                  ? 'Reconectar WhatsApp Business'
                  : 'Conectar WhatsApp Business'}
          </Button>
        )}
        {attempting && !launchReady ? (
          <Button type="button" variant="outline" disabled={busy} onClick={cancelCurrentAttempt}>
            Cancelar tentativa
          </Button>
        ) : null}
      </div>
    </div>
  );
}
