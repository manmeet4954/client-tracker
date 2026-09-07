'use client';

import MoneyView from '@/components/MoneyView';

export default function MoneyPage({ params }: { params: { id: string } }) {
  return <MoneyView clientId={params.id} />;
}
