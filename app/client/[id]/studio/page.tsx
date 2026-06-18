'use client';

import StudioView from '@/components/StudioView';

export default function StudioPage({ params }: { params: { id: string } }) {
  return <StudioView clientId={params.id} />;
}
