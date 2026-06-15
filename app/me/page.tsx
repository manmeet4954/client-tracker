'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import PersonalDashboard from '@/components/PersonalDashboard';

export default function MyDayPage() {
  const { role } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (role === 'intern') router.replace('/clients');
  }, [role, router]);

  if (role === 'intern') return null;
  return <PersonalDashboard />;
}
