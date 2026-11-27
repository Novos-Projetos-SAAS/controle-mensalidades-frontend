import { PaymentPage } from '@/features/payments/payment-page';
import { parsePaymentReturn } from '@/features/payments/payment-utils';

export default async function PaymentReturnPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const values = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) for (const item of value) params.append(key, item);
    else if (value !== undefined) params.append(key, value);
  }
  const result = parsePaymentReturn(params);
  return <PaymentPage token={result?.token || ''} evidence={result?.evidence} returned />;
}
