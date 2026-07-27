'use client';

import CurationView from '@/components/CurationView';

export default function CurationPage({ params }: { params: { id: string } }) {
  return <CurationView clientId={params.id} />;
}
