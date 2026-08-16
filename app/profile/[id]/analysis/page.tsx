'use client';

// `/profile/<id>/analysis` — her side redirects to Now (§3.1); the client's
// Analysis window renders here, because a client reaches this address through
// `see:analysis` and sees the latest APPROVED PUBLICATION, never a live query
// (spec 27 §14). Renamed from Results on 2026-08-16: her folder, her name.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import { ANALYSIS_TABS, rendered } from '@/lib/shell/nav';
import { renderProfile, shellRole } from '@/lib/shell/profile';
import { AnalysisWindow } from '@/components/shell/ClientWindows';

export default function AnalysisLanding({ params }: { params: { id: string } }) {
  const { state, role } = useApp();
  const router = useRouter();
  const kind = shellRole(state, role, params.id);
  const first = kind === 'owner'
    ? rendered(ANALYSIS_TABS, renderProfile(state, params.id, role), kind)[0]
    : undefined;

  useEffect(() => {
    if (kind !== 'owner') return;
    router.replace(first ? `/profile/${params.id}/analysis/${first.id}` : `/profile/${params.id}`);
  }, [kind, first, params.id, router]);

  if (kind !== 'owner') return <AnalysisWindow profileId={params.id} />;
  return null;
}
