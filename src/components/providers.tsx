'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Toaster } from 'sonner';
import { SessionProvider } from '@/features/auth/session';
import { PwaRegister } from '@/components/pwa-register';

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
      }),
  );
  if (pathname === '/pagamento' || pathname.startsWith('/pagamento/')) return children;
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        {children}
        <PwaRegister />
        <Toaster richColors position="top-right" />
      </SessionProvider>
    </QueryClientProvider>
  );
}
