import { PaymentPage } from '@/features/payments/payment-page';

export default async function PrivatePaymentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PaymentPage token={token} />;
}
