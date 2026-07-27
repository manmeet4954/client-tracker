'use client';

import AnalyticsView from '@/components/AnalyticsView';
import AnalysisApp from '@/components/analysis/AnalysisApp';
import { useApp, useClient } from '@/contexts/AppContext';

/**
 * Spec 27 §22.3: the eight surfaces mount on the EXISTING analytics route for
 * now; spec 28 re-homes them into the profile shell.
 *
 * A profile that has not moved into the tree, or has not locked a strategy, keeps
 * rendering exactly what it renders today — spec 22 §13's rule, kept. Nothing is
 * deleted and nothing changes under her until she walks a profile through.
 */
export default function AnalyticsPage({ params }: { params: { id: string } }) {
  const { role } = useApp();
  const { client, data } = useClient(params.id);
  const onTheNewLayer = role === 'owner'
    && !!data?.body
    && typeof data.body.strategy_version === 'number';

  if (!onTheNewLayer) return <AnalyticsView clientId={params.id} />;
  return <AnalysisApp clientId={params.id} accent={client?.color} />;
}
