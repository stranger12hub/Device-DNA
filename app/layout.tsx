import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { AppProviders } from '@/components/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Device DNA',
  description: 'The complete history of your device.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/assets/icons/favicon.ico', sizes: 'any' },
      { url: '/assets/icons/device-dna-icon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/assets/icons/device-dna-icon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/assets/icons/device-dna-icon-180.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
