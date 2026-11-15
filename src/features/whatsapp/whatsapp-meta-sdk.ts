export type MetaSignupSession = {
  event: 'FINISH' | 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING' | 'CANCEL' | 'ERROR';
  data: {
    waba_id?: string;
    phone_number_id?: string;
    business_id?: string;
  };
};

export type MetaLoginResponse = {
  authResponse?: { code?: string } | null;
};

export type MetaSdkCallbacks = {
  onLogin: (response: MetaLoginResponse | null) => void;
  onSession: (session: MetaSignupSession) => void;
};

type FacebookSdk = {
  init: (options: { appId: string; cookie: boolean; xfbml: boolean; version: string }) => void;
  login: (
    callback: (response: MetaLoginResponse | null) => void,
    options: {
      config_id: string;
      response_type: 'code';
      override_default_response_type: true;
      extras: {
        setup: Record<string, never>;
        sessionInfoVersion: string;
        featureType?: 'whatsapp_business_app_onboarding';
      };
    },
  ) => void;
};

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

let sdkPromise: Promise<FacebookSdk> | undefined;
let initializedFor: string | undefined;

function initialize(sdk: FacebookSdk, appId: string, graphApiVersion: string) {
  const identity = appId + ':' + graphApiVersion;
  if (initializedFor && initializedFor !== identity)
    throw new Error('A configuração Meta carregada não corresponde ao ambiente ativo.');
  if (!initializedFor) {
    sdk.init({ appId, cookie: true, xfbml: false, version: graphApiVersion });
    initializedFor = identity;
  }
  return sdk;
}

function loadFacebookSdk(appId: string, graphApiVersion: string): Promise<FacebookSdk> {
  if (typeof window === 'undefined') return Promise.reject(new Error('SDK Meta indisponível.'));
  if (window.FB) {
    try {
      return Promise.resolve(initialize(window.FB, appId, graphApiVersion));
    } catch (error) {
      return Promise.reject(error);
    }
  }
  if (!sdkPromise) {
    sdkPromise = new Promise<FacebookSdk>((resolve, reject) => {
      const scriptId = 'orbe-meta-jssdk';
      const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
      const script = existing ?? document.createElement('script');
      let settled = false;
      const timeout = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error('O SDK da Meta não ficou disponível.'));
      }, 15000);
      const fail = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        script.remove();
        reject(new Error('O SDK da Meta não ficou disponível.'));
      };
      const previousInit = window.fbAsyncInit;
      window.fbAsyncInit = () => {
        try {
          previousInit?.();
        } catch {
          // A inicialização do SDK de terceiros permanece independente de outros handlers.
        }
        if (settled) return;
        const sdk = window.FB;
        if (!sdk) {
          fail();
          return;
        }
        settled = true;
        window.clearTimeout(timeout);
        try {
          resolve(initialize(sdk, appId, graphApiVersion));
        } catch (error) {
          reject(error);
        }
      };
      script.addEventListener('error', fail, { once: true });
      if (!existing) {
        script.id = scriptId;
        script.async = true;
        script.src = 'https://connect.facebook.net/en_US/sdk.js';
        document.head.appendChild(script);
      }
    }).catch((error: unknown) => {
      sdkPromise = undefined;
      throw error;
    });
  }
  return sdkPromise.then((sdk) => initialize(sdk, appId, graphApiVersion));
}

function trustedMetaOrigin(origin: string) {
  try {
    const url = new URL(origin);
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'facebook.com' || url.hostname.endsWith('.facebook.com'))
    );
  } catch {
    return false;
  }
}

export function parseMetaSignupMessage(
  origin: string,
  sourceIsWindow: boolean,
  raw: unknown,
): MetaSignupSession | null {
  if (!trustedMetaOrigin(origin) || sourceIsWindow || typeof raw !== 'string') return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const message = value as { type?: unknown; event?: unknown; data?: unknown };
  if (message.type !== 'WA_EMBEDDED_SIGNUP' || typeof message.event !== 'string') return null;
  const allowedEvents = ['FINISH', 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING', 'CANCEL', 'ERROR'];
  if (!allowedEvents.includes(message.event)) return null;
  const data =
    message.data && typeof message.data === 'object'
      ? (message.data as Record<string, unknown>)
      : {};
  const identifier = (key: string) =>
    typeof data[key] === 'string' && data[key].length > 0 ? (data[key] as string) : undefined;
  return {
    event: message.event as MetaSignupSession['event'],
    data: {
      ...(identifier('waba_id') ? { waba_id: identifier('waba_id') } : {}),
      ...(identifier('phone_number_id') ? { phone_number_id: identifier('phone_number_id') } : {}),
      ...(identifier('business_id') ? { business_id: identifier('business_id') } : {}),
    },
  };
}

export type MetaSignupConfig = {
  appId: string;
  configurationId: string;
  graphApiVersion: string;
  responseType: 'code';
  overrideDefaultResponseType: true;
  sessionInfoVersion: number;
  featureType?: 'whatsapp_business_app_onboarding';
};

export async function prepareMetaEmbeddedSignup(config: MetaSignupConfig): Promise<void> {
  await loadFacebookSdk(config.appId, config.graphApiVersion);
}

export function openMetaEmbeddedSignup(
  config: MetaSignupConfig,
  callbacks: MetaSdkCallbacks,
): () => void {
  if (typeof window === 'undefined' || !window.FB)
    throw new Error('O SDK da Meta ainda não está preparado.');
  const sdk = initialize(window.FB, config.appId, config.graphApiVersion);
  const listener = (event: MessageEvent<unknown>) => {
    if (!event.source || event.source === window) return;
    const session = parseMetaSignupMessage(event.origin, event.source === window, event.data);
    if (session) callbacks.onSession(session);
  };
  window.addEventListener('message', listener);
  const extras: FacebookSdk['login'] extends (callback: never, options: infer Options) => void
    ? Options extends { extras: infer Extras }
      ? Extras
      : never
    : never = {
    setup: {},
    sessionInfoVersion: String(config.sessionInfoVersion),
    ...(config.featureType ? { featureType: config.featureType } : {}),
  };
  try {
    sdk.login(callbacks.onLogin, {
      config_id: config.configurationId,
      response_type: config.responseType,
      override_default_response_type: config.overrideDefaultResponseType,
      extras,
    });
  } catch (error) {
    window.removeEventListener('message', listener);
    throw error;
  }
  return () => window.removeEventListener('message', listener);
}
