'use client';

// The Analysis app — spec 27 §5, restructured by the design handoff, "ANALYSIS".
//
// Eight screens became THREE GROUPS. The eight are not gone: each is still its
// own read, its own switch and its own payload. What changed is what the
// navigation addresses. A phone cannot carry eight tabs, and the operator does
// not think in eight questions — she thinks in three: where are we, what
// happened, what does it mean.
//
//   Where we are   Now · Goals · Health
//   What happened  Slices · Scorecard · Funnel
//   What it means  Compare · Verdicts
//
// A screen whose switch is not `active` is NOT RENDERED. Not greyed, not shown
// with a lock: absent. A group left with no screens is not rendered either, and
// with all eight off there is no Analysis app at all.

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { ScreenHeader } from '@/components/shell/Screen';
import AnalysisGroup from './AnalysisGroup';
import { Empty } from './Shared';
import { defaultGroupId, groupOf, groupsFor, resolveGroup } from '@/lib/analysis/groups';
import type { TabNode } from '@/lib/analysis/groups';

/** The eight, as the API answers with them when nothing else supplies the list. */
async function readTabs(clientId: string): Promise<{ tabs?: TabNode[]; error?: string }> {
  try {
    const res = await fetch(`/api/analysis?clientId=${encodeURIComponent(clientId)}&tab=now`);
    const json = await res.json();
    if (Array.isArray(json.tabs)) return { tabs: json.tabs as TabNode[] };
    return { error: json.detail ?? json.error ?? 'Could not load the analysis configuration.' };
  } catch {
    return { error: 'Could not connect. No data has been lost.' };
  }
}

export default function AnalysisApp({
  clientId, tabs: given, group, tab, hrefForGroup, fixHref, engineHref,
}: {
  clientId: string;
  /**
   * The eight screens with their switch states, from
   * `rendered(ANALYSIS_TABS, renderProfile(...), role)`. Pass it: it is the one
   * source of truth for what is switched on. Without it this component reads
   * the list from the API, which costs an extra request.
   */
  tabs?: TabNode[];
  /** The group the route addresses: `where`, `what` or `means`. */
  group?: string;
  /** An old eight-tab address. It resolves to the group that screen now lives in. */
  tab?: string;
  /** Makes the segmented control navigate. Without it the control is local state. */
  hrefForGroup?: (id: string) => string;
  /** Where "Fix the connection" goes. Defaults to the Strategy corner's Channels panel. */
  fixHref?: string;
  /** Where "Send this back to Engine" goes. */
  engineHref?: string;
  /** Accepted and ignored: the chrome is ink everywhere now. */
  accent?: string;
}) {
  const pathname = usePathname() ?? '';
  const search = useSearchParams();
  const [tabs, setTabs] = useState<TabNode[] | undefined>(given);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!given);
  const [ownGroup, setOwnGroup] = useState<string | undefined>();

  const load = useCallback(async () => {
    if (given) { setTabs(given); setLoading(false); return; }
    setLoading(true);
    const { tabs: read, error: failed } = await readTabs(clientId);
    setTabs(read);
    setError(failed ?? '');
    setLoading(false);
  }, [clientId, given]);

  useEffect(() => { void load(); }, [load]);

  if (loading && !tabs) return <Empty>Loading analysis&hellip;</Empty>;

  if (error && !tabs) {
    return (
      <div className="rounded-card border border-[rgba(234,71,17,.3)] bg-surface px-[18px] py-3 text-sm text-accent-text">
        {error}
      </div>
    );
  }

  const groups = groupsFor(tabs ?? []);

  // Off means absent, all the way up: with every screen switched off there is no
  // Analysis app, and this says so in one line instead of drawing an empty shell.
  if (groups.length === 0) {
    return <Empty>Analytics are not enabled for this profile.</Empty>;
  }

  const asked = group ?? (tab ? groupOf(tab) : undefined) ?? ownGroup ?? defaultGroupId(tabs ?? []) ?? '';
  const active = resolveGroup(tabs ?? [], asked);
  if (!active) return null;

  // "Fix the connection" opens the Strategy corner's Channels panel OVER this
  // screen — the corner is a panel, not a place, so the rest of the query is
  // carried through and closing it returns to exactly here.
  const corner = new URLSearchParams(search?.toString() ?? '');
  corner.set('strategy', 'channels');

  return (
    <div className="flex flex-col gap-3.5">
      <ScreenHeader
        title="Analysis"
        segments={groups.map(g => ({
          id: g.id, label: g.label, href: hrefForGroup ? hrefForGroup(g.id) : undefined,
        }))}
        active={active.id}
        onSelect={setOwnGroup}
      />

      <AnalysisGroup
        clientId={clientId}
        screens={active.screens}
        fixHref={fixHref ?? (pathname ? `${pathname}?${corner.toString()}` : undefined)}
        engineHref={engineHref ?? `/profile/${clientId}/creation/engine`}
      />
    </div>
  );
}
