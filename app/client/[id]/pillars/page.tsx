'use client';

import PillarsView from '@/components/PillarsView';

export default function PillarsPage({ params }: { params: { id: string } }) {
  return <PillarsView clientId={params.id} />;
}
