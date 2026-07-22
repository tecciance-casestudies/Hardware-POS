import type { Metadata } from 'next';

import { AuthProvider } from '@/lib/auth';
import { ThemeProvider, themeInitScript } from '@/lib/theme';

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
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the stored theme before first paint — no flash of wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
