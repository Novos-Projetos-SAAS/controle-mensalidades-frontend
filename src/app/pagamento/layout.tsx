import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Pagamento',
  description: 'Consulte a situação e efetue o pagamento pelo seu link privado.',
  referrer: 'no-referrer',
  robots: { index: false, follow: false, nocache: true },
};

export default function PaymentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
