'use client';

import PreviewsView from '@/components/PreviewsView';

export default function PreviewsPage({ params }: { params: { id: string } }) {
  return <PreviewsView clientId={params.id} />;
}
