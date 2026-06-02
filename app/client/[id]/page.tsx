'use client';

import { Suspense } from 'react';
import DashboardView from '@/components/DashboardView';

export default function DashboardPage({ params }: { params: { id: string } }) {
  return (
    <Suspense>
      <DashboardView clientId={params.id} />
    </Suspense>
  );
}
