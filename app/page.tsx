'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';

export default function Home() {
  const { state } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (state.clients.length > 0) {
      router.replace(`/client/${state.clients[0].id}`);
    }
  }, [state.clients, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F7F5]">
      <div className="text-stone-400 text-sm">Loading...</div>
    </div>
  );
}
