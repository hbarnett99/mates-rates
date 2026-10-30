import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mates Rates',
  description: "The crew's food and drink deals, on a map.",
  applicationName: 'Mates Rates',
  appleWebApp: { capable: true, title: 'Mates Rates', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: '#0E1013',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-AU">
      <body className="antialiased">{children}</body>
    </html>
  );
}
