'use client';

import ListsView from '@/components/ListsView';

export default function ListsPage({ params }: { params: { id: string } }) {
  return <ListsView clientId={params.id} />;
}
