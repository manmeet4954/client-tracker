'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import BrainDumpView from '@/components/BrainDumpView';

export default function BrainPage() {
  const { role } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (role !== 'owner') router.replace('/clients');
  }, [role, router]);

  if (role !== 'owner') return null;
  return <BrainDumpView />;
}
