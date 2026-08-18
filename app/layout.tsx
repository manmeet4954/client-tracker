import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppProvider } from '@/contexts/AppContext';
import ChatMount from '@/components/ChatMount';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#1c1917',
};

export const metadata: Metadata = {
  title: 'KRNL',
  description: 'Plan the content, review the work, and see how it performs.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'KRNL',
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
        <AppProvider>
          {children}
          {/* The ChatWidget, mounted above every route except the desk, which
              is itself a chat. See components/ChatMount.tsx. */}
          <ChatMount />
        </AppProvider>
      </body>
    </html>
  );
}
