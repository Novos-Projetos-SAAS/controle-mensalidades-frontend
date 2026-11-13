import type { Metadata, Viewport } from 'next';
import { Providers } from '@/components/providers';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Orbe | Gestão', template: '%s | Orbe' },
  description: 'Gestão de clientes, profissionais e áreas de negócio em um só lugar.',
  applicationName: 'Orbe Gestão',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Orbe' },
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#116b71',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
