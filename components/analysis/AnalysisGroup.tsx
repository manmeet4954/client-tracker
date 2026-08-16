'use client';

// One Analysis GROUP — the restructure's Level 3, "ANALYSIS".
//
// Eight screens became three groups. A group is what the route addresses and
// what the segmented control switches; the screens inside it STACK, in the order
// the handoff lists them, each under its own heading. A screen whose switch does
// not render is simply absent, and the group itself is never rendered empty —
// both of those decisions are made upstream by `groupsFor()`, never here.
//
// Coverage is the first block, above every screen in the group, because the
// whole point of this phase is that no number is read before the days behind it
// are. Each screen still reads its own period, so a screen whose coverage does
// not match the block above it says so in one line rather than borrowing it.

import { useCallback, useEffect, useState } from 'react';
import { CoverageDiffers, CoverageFirst, Empty, ScreenTitle } from './Shared';
import type { Coverage } from './Shared';
import {
  CompareTab, FunnelTab, GoalsTab, HealthTab, NowTab, ScorecardTab, SlicesTab, VerdictsTab,
} from './Tabs';
import { HistoryLine } from '@/components/shell/Screen';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Payload = Record<string, any>;

export interface GroupScreen {
  id: string;
  label: string;
  /** `active` or `history`. A hidden screen never reaches this component. */
  state: string;
}

export default function AnalysisGroup({
  clientId, screens, fixHref, engineHref,
}: {
  clientId: string;
  screens: GroupScreen[];
  /** Where "Fix the connection" goes. Absent means no action is drawn. */
  fixHref?: string;
  /** Where "Send this back to Engine" goes. Absent means no action is drawn. */
  engineHref?: string;
}) {
  const [coverage, setCoverage] = useState<Coverage | undefined>();

  // The group renders nothing rather than an empty frame. `groupsFor()` already
  // drops a group with no screens; this is the belt on top of the braces.
  if (screens.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <CoverageFirst coverage={coverage} fixHref={fixHref} />

      {screens.map((screen, i) => (
        <ScreenBlock
          key={screen.id}
          clientId={clientId}
          screen={screen}
          titled={screens.length > 1}
          fixHref={fixHref}
          engineHref={engineHref}
          groupCoverage={i === 0 ? undefined : coverage}
          onCoverage={i === 0 ? setCoverage : undefined}
        />
      ))}
    </div>
  );
}

function ScreenBlock({
  clientId, screen, titled, fixHref, engineHref, groupCoverage, onCoverage,
}: {
  clientId: string;
  screen: GroupScreen;
  titled: boolean;
  fixHref?: string;
  engineHref?: string;
  groupCoverage?: Coverage;
  onCoverage?: (c: Coverage | undefined) => void;
}) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Slices and Compare are the two screens that take a control. Their state
  // lives here so a chip tap re-reads that screen and leaves the others alone.
  const [dimension, setDimension] = useState('hook_type');
  const [cross, setCross] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ clientId, tab: screen.id });
    if (screen.id === 'slices') {
      params.set('dimension', dimension);
      if (cross) params.set('cross', cross);
    }
    if (screen.id === 'compare' && selected.length >= 2) params.set('pieces', selected.join(','));
    try {
      const res = await fetch(`/api/analysis?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        setPayload(null);
        setError(json.detail ?? json.error ?? 'Could not load this section.');
      } else {
        setPayload(json);
      }
    } catch {
      setPayload(null);
      setError('Could not connect. No data has been lost.');
    } finally {
      setLoading(false);
    }
  }, [clientId, screen.id, dimension, cross, selected]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    onCoverage?.(payload?.coverage as Coverage | undefined);
    // The reporter is the group's first screen only, and it reports the payload
    // it actually drew. Re-running on a new identity of the callback would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload]);

  // A screen reading its own period says so, rather than borrowing the number
  // in the block above it.
  const own = (payload?.slice?.coverage ?? payload?.coverage) as Coverage | undefined;

  return (
    <section className="flex flex-col gap-3">
      {titled ? <ScreenTitle>{screen.label}</ScreenTitle> : null}

      {screen.state === 'history' ? (
        <HistoryLine>
          Data collection is paused for this section. Existing data remains available.
        </HistoryLine>
      ) : null}

      <CoverageDiffers screen={own} group={groupCoverage} />

      {error ? (
        <div className="rounded-card border border-[rgba(234,71,17,.3)] bg-surface px-[18px] py-3 text-sm text-accent-text">
          {error}
        </div>
      ) : null}

      {loading && !payload ? <Empty>Loading&hellip;</Empty> : null}

      {payload ? (
        <>
          {screen.id === 'now' ? <NowTab payload={payload} /> : null}
          {screen.id === 'goals' ? <GoalsTab payload={payload} /> : null}
          {screen.id === 'health' ? <HealthTab payload={payload} fixHref={fixHref} /> : null}
          {screen.id === 'slices' ? (
            <SlicesTab
              payload={payload} dimension={dimension} cross={cross}
              onDimension={setDimension} onCross={setCross}
            />
          ) : null}
          {screen.id === 'scorecard' ? <ScorecardTab payload={payload} /> : null}
          {screen.id === 'funnel' ? <FunnelTab payload={payload} /> : null}
          {screen.id === 'compare' ? (
            <CompareTab
              payload={payload}
              selected={selected}
              onToggle={id => setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]))}
            />
          ) : null}
          {screen.id === 'verdicts' ? <VerdictsTab payload={payload} engineHref={engineHref} /> : null}
        </>
      ) : null}
    </section>
  );
}
