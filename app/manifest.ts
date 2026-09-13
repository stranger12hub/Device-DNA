import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Device DNA',
    short_name: 'Device DNA',
    description: 'The complete history of your device.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FFFFFF',
    theme_color: '#FFFFFF',
    icons: [
      {
        src: '/assets/icons/device-dna-icon-16.png',
        sizes: '16x16',
        type: 'image/png',
      },
      {
        src: '/assets/icons/device-dna-icon-32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/assets/icons/device-dna-icon-180.png',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        src: '/assets/icons/device-dna-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/assets/icons/device-dna-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
