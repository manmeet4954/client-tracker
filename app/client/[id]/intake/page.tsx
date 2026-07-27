'use client';

import IntakeView from '@/components/IntakeView';

export default function IntakePage({ params }: { params: { id: string } }) {
  return <IntakeView clientId={params.id} />;
}
