'use client';

import AnalyticsView from '@/components/AnalyticsView';

export default function AnalyticsPage({ params }: { params: { id: string } }) {
  return <AnalyticsView clientId={params.id} />;
}
