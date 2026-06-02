'use client';

import KanbanView from '@/components/KanbanView';

export default function KanbanPage({ params }: { params: { id: string } }) {
  return <KanbanView clientId={params.id} />;
}
