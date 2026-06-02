'use client';

import { Suspense } from 'react';
import KanbanView from '@/components/KanbanView';

export default function KanbanPage({ params }: { params: { id: string } }) {
  return (
    <Suspense>
      <KanbanView clientId={params.id} />
    </Suspense>
  );
}
