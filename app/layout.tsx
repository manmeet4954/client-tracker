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
