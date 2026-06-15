'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import BrainDumpView from '@/components/BrainDumpView';

export default function BrainPage() {
  const { role } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (role === 'intern') router.replace('/clients');
  }, [role, router]);

  if (role === 'intern') return null;
  return <BrainDumpView />;
}
