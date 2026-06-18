'use client';

import ReferencesView from '@/components/ReferencesView';

export default function ReferencesPage({ params }: { params: { id: string } }) {
  return <ReferencesView clientId={params.id} />;
}
