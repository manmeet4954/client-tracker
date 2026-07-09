'use client';

import AnswersView from '@/components/AnswersView';

export default function AnswersPage({ params }: { params: { id: string } }) {
  return <AnswersView clientId={params.id} />;
}
