'use client';

import ColdCallsView from '@/components/ColdCallsView';

export default function ColdCallsPage({ params }: { params: { id: string } }) {
  return <ColdCallsView clientId={params.id} />;
}
