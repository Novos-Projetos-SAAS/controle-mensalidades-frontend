import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  distDir: process.env.E2E_PAYMENTS_UI === '1' ? '.next/payments-ui' : '.next',
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
      ...['/', '/login', '/clientes', '/profissionais', '/financeiro', '/configuracoes/whatsapp', '/configuracoes/organizacoes', '/configuracoes/usuarios', '/api/:path*'].map(
        (source) => ({
          source,
          headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
        }),
      ),
      {
        source: '/pagamento/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
