'use client';

// The Analysis app — spec 28 §5.3, regrouped by phase 4 of the restructure.
//
// The eight screens are not gone: each is still its own switch, its own read and
// its own payload. What changed is what the NAVIGATION addresses. They present
// as three groups — Where we are, What happened, What it means — and AnalysisApp
// draws that title and that control itself.
//
// So this page draws no heading, no tab row and no phone picker. It used to draw
// all three; leaving them would give two "Analysis" titles and two navigations.
//
// The route segment is still `[tab]`, one of the eight, deliberately: every link
// and bookmark that exists keeps working, and AnalysisApp resolves an old
// address to the group that screen now lives in. Renaming it to `[group]` is a
// tidy-up for later, not a thing to do on the way past.
//
// Coverage is still the first block on screen, and the shell still may not move
// it, collapse it, or trade it for a badge in a corner.

import { notFound } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import { ANALYSIS_TABS, rendered } from '@/lib/shell/nav';
import { renderProfile, shellRole } from '@/lib/shell/profile';
import AnalysisApp from '@/components/analysis/AnalysisApp';
import { ANALYSIS_GROUPS } from '@/lib/analysis/groups';
import { Screen } from '@/components/shell/Screen';

export default function AnalysisTabPage({ params }: { params: { id: string; tab: string } }) {
  const { state, role } = useApp();

  const known = ANALYSIS_TABS.find(t => t.id === params.tab);
  if (!known) notFound();

  const kind = shellRole(state, role, params.id);
  if (kind !== 'owner') notFound();   // a client's analysis is the Results window

  const tabs = rendered(ANALYSIS_TABS, renderProfile(state, params.id, role), kind)
    .map(t => ({ id: t.id, label: t.label, state: t.state }));

  // A group's address is the first of its screens that this profile actually
  // renders. A group whose screens are all switched off has no href, and the
  // control simply does not offer it.
  function hrefForGroup(groupId: string): string {
    const group = ANALYSIS_GROUPS.find(g => g.id === groupId);
    const first = group?.screens.find(s => tabs.some(t => t.id === s));
    return `/profile/${params.id}/analysis/${first ?? params.tab}`;
  }

  return (
    <Screen>
      <div className="-mx-4 md:-mx-7">
        <AnalysisApp
          clientId={params.id}
          tabs={tabs}
          tab={params.tab}
          hrefForGroup={hrefForGroup}
        />
      </div>
    </Screen>
  );
}
