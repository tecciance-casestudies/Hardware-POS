import type { Metadata } from 'next';

import { AuthProvider } from '@/lib/auth';

import './globals.css';

export const metadata: Metadata = {
  title: 'Hardware POS',
  description: 'Cashier sales front-end for hardware retail, synced with QuickBooks Online.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
