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
  // 2026-08-17, spec 36: EVERYONE lands on the first tab their plugs render.
  // This used to branch — she went to her tabs, a client got a single curated
  // summary — and that branch was the dissection: her eight Analysis tabs
  // reduced to one page. Her ruling: the client sees the real tabs, live.
  const kind = shellRole(state, role, params.id);
  const first = rendered(ANALYSIS_TABS, renderProfile(state, params.id, role), kind)[0];

  useEffect(() => {
    if (first) router.replace(`/profile/${params.id}/analysis/${first.id}`);
  }, [first, params.id, router]);

  if (first) return null;
  // No Analysis tab is plugged in. The published summary is still a real
  // feature of hers, so it is what stands here rather than an empty screen —
  // and if she has that switched off too, it says so itself.
  return <AnalysisWindow profileId={params.id} />;
}
