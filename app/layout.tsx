import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppProvider } from '@/contexts/AppContext';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#1c1917',
};

export const metadata: Metadata = {
  title: 'My Clients',
  description: 'Client content tracker — kanban, brand, studio',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'My Clients',
  },
  icons: {
    icon: [
      { url: '/favicon.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon', sizes: '512x512', type: 'image/png' },
    ],
    apple: { url: '/apple-icon', sizes: '180x180', type: 'image/png' },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
