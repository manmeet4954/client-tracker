'use client';

import AssetsView from '@/components/AssetsView';

export default function AssetsPage({ params }: { params: { id: string } }) {
  return <AssetsView clientId={params.id} />;
}
