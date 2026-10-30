import type { MetadataRoute } from 'next';

/** Served at /manifest.webmanifest, so the app installs to the home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mates Rates',
    short_name: 'Mates Rates',
    description: "The crew's food and drink deals, on a map.",
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0E1013',
    theme_color: '#0E1013',
    icons: [
      { src: '/icons/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
