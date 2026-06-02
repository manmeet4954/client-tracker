'use client';

import EvergreenView from '@/components/EvergreenView';

export default function EvergreenPage({ params }: { params: { id: string } }) {
  return <EvergreenView clientId={params.id} />;
}
