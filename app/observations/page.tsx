'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import ObservationsView from '@/components/ObservationsView';

export default function ObservationsPage() {
  const { role } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (role !== 'owner') router.replace('/clients');
  }, [role, router]);

  if (role !== 'owner') return null;
  return <ObservationsView />;
}
