'use client';

import JourneyView from '@/components/JourneyView';

export default function JourneyPage({ params }: { params: { id: string } }) {
  return <JourneyView clientId={params.id} />;
}
