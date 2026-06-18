'use client';

import DashboardView from '@/components/DashboardView';

export default function DashboardPage({ params }: { params: { id: string } }) {
  return <DashboardView clientId={params.id} />;
}
