'use client';

import BrandView from '@/components/BrandView';

export default function BrandPage({ params }: { params: { id: string } }) {
  return <BrandView clientId={params.id} />;
}
