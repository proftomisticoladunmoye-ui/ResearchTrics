import type { MetadataRoute } from 'next';

/** Web app manifest with the ResearchTrics brand mark and palette (Spec §81, §96). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ResearchTrics',
    short_name: 'ResearchTrics',
    description: 'Make Research Visible. Discoverable. Connected. Measurable.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FFFFFF',
    theme_color: '#0B3A82',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
