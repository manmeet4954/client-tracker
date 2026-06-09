import type { Metadata } from 'next';
import './globals.css';
import { AppProvider } from '@/contexts/AppContext';

export const metadata: Metadata = {
  title: 'My Clients',
  description: 'Client content tracker — kanban, brand, studio',
  themeColor: '#1c1917',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'My Clients',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
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
