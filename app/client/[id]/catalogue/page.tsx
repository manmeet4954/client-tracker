'use client';

import CatalogueView from '@/components/CatalogueView';

export default function CataloguePage({ params }: { params: { id: string } }) {
  return <CatalogueView clientId={params.id} />;
}
