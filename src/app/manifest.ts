import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Orbe Gestão',
    short_name: 'Orbe',
    description: 'Gestão de clientes, profissionais e áreas de negócio.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f6f9f8',
    theme_color: '#116b71',
    lang: 'pt-BR',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
