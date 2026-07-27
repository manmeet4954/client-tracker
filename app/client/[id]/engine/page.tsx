'use client';

import EngineRoomView from '@/components/EngineRoomView';

export default function EnginePage({ params }: { params: { id: string } }) {
  return <EngineRoomView clientId={params.id} />;
}
