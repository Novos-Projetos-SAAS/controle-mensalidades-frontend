export type PaymentEvidence = { order_nsu: string; transaction_nsu: string; slug: string };
export const isPaymentToken = (value: string) => /^[A-Za-z0-9_-]{43}$/.test(value);

export function checkoutUrl(
  value: string | null | undefined,
  provider: 'INFINITEPAY' | 'ABACATEPAY' = 'INFINITEPAY',
): string | null {
  try {
    const url = new URL(value ?? '');
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      (provider === 'ABACATEPAY'
        ? url.hostname === 'app.abacatepay.com' && /^\/pay\/[^/]+\/?$/.test(url.pathname)
        : ['buy.infinitepay.io', 'checkout.infinitepay.io'].includes(url.hostname))
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function parsePaymentReturn(
  params: URLSearchParams,
): { token: string; evidence: PaymentEvidence | null } | null {
  for (const key of params.keys()) if (params.getAll(key).length !== 1) return null;
  const token = params.get('token') || '';
  if (!isPaymentToken(token)) return null;
  const keys = ['order_nsu', 'transaction_nsu', 'slug'] as const;
  if (!keys.some((key) => params.has(key))) return { token, evidence: null };
  const evidence = {} as PaymentEvidence;
  for (const key of keys) {
    const value = params.get(key);
    if (
      !value ||
      value.length > (key === 'order_nsu' ? 100 : 200) ||
      !/^[A-Za-z0-9_.:-]+$/.test(value)
    )
      return null;
    evidence[key] = value;
  }
  if (params.has('invoice_slug') && params.get('invoice_slug') !== evidence.slug) return null;
  return { token, evidence };
}

export function platformPaymentUrl(path: string | null, origin: string): string | null {
  if (!path || !/^\/pagamento\/[A-Za-z0-9_-]{43}$/.test(path)) return null;
  return new URL(path, origin).href;
}

export function shouldPollPayment(status: string, attempts: number, visible: boolean): boolean {
  return (
    visible &&
    attempts < 20 &&
    ['AGUARDANDO_CRIACAO', 'CRIANDO', 'AGUARDANDO_PAGAMENTO'].includes(status)
  );
}

export const paymentStatus: Record<string, { title: string; description: string }> = {
  AGUARDANDO_CRIACAO: {
    title: 'Preparando pagamento',
    description: 'Aguarde a disponibilização do link.',
  },
  CRIANDO: { title: 'Preparando pagamento', description: 'Aguarde a disponibilização do link.' },
  CRIACAO_INCERTA: {
    title: 'Link em conferência',
    description:
      'Não foi possível confirmar a criação do link. Entre em contato com a administração antes de tentar novamente.',
  },
  AGUARDANDO_PAGAMENTO: {
    title: 'Aguardando pagamento',
    description: 'Estamos aguardando a confirmação do pagamento.',
  },
  PAGO_VERIFICADO: {
    title: 'Pagamento confirmado',
    description: 'Pagamento confirmado com sucesso.',
  },
  PAGO_EM_REVISAO: {
    title: 'Pagamento em análise',
    description: 'A administração precisa conferir este pagamento. Não pague novamente.',
  },
  EXPIRADO: {
    title: 'Link expirado',
    description:
      'Se já pagou, entre em contato com a administração. Evite realizar outro pagamento.',
  },
  CANCELADO: {
    title: 'Cobrança encerrada',
    description:
      'Este link não está disponível para pagamento. Em caso de dúvida, entre em contato com a administração.',
  },
};
