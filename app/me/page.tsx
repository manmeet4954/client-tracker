'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import PersonalDashboard from '@/components/PersonalDashboard';

export default function MyDayPage() {
  const { role } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (role !== 'owner') router.replace('/clients');
  }, [role, router]);

  if (role !== 'owner') return null;
  return <PersonalDashboard />;
}
