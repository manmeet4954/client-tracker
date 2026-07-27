'use client';

// The Analysis app — spec 27 §5. One app inside a profile, eight tabs.
//
// A tab whose switch is not `active` is NOT RENDERED. Not greyed out, not shown
// with a lock: absent (PLAN §2 item 2). A tab at `history` renders read-only with
// a line saying since when.
//
// Spec 28 re-homes these screens into the profile shell. Until then they mount
// on the existing /client/[id]/analytics route, and a profile that has not moved
// into the tree keeps rendering exactly what it renders today.

import { useCallback, useEffect, useState } from 'react';
import {
  CompareTab, FunnelTab, GoalsTab, HealthTab, NowTab, ScorecardTab, SlicesTab, VerdictsTab,
} from './Tabs';

const TAB_LABEL: Record<string, string> = {
  now: 'Now',
  slices: 'Slices',
  scorecard: 'Scorecard',
  funnel: 'Funnel',
  compare: 'Compare',
  goals: 'Goals',
  verdicts: 'Verdicts',
  health: 'Health',
};

interface TabState { id: string; switch: string; state: 'active' | 'history' | 'hidden' }

/* eslint-disable @typescript-eslint/no-explicit-any */
type Payload = Record<string, any>;

/**
 * Spec 28 §5.3 supplies the frame — the desktop tab row and the mobile
 * bottom-sheet picker — so when the shell drives the tab from the route, this
 * component renders the CONTENT only. Uncontrolled (no `tab` prop) it behaves
 * exactly as it did on the legacy analytics route. Nothing about the eight tabs
 * themselves changed.
 */
export default function AnalysisApp({
  clientId, accent, tab: routeTab,
}: { clientId: string; accent?: string; tab?: string }) {
  const [ownTab, setTab] = useState('now');
  const controlled = typeof routeTab === 'string';
  const tab = controlled ? routeTab : ownTab;
  const [dimension, setDimension] = useState('hook_type');
  const [cross, setCross] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [tabs, setTabs] = useState<TabState[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ clientId, tab, dimension });
    if (cross) params.set('cross', cross);
    if (selected.length >= 2) params.set('pieces', selected.join(','));
    try {
      const res = await fetch(`/api/analysis?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        setTabs(json.tabs ?? []);
        setError(json.detail ?? json.error ?? 'Could not load this.');
        setPayload(null);
      } else {
        setPayload(json);
        setTabs(json.tabs ?? []);
      }
    } catch {
      setError('Could not reach the engine. Nothing was lost.');
    } finally {
      setLoading(false);
    }
  }, [clientId, tab, dimension, cross, selected]);

  useEffect(() => { void load(); }, [load]);

  const visible = tabs.filter(t => t.state !== 'hidden');
  const current = tabs.find(t => t.id === tab);
  const toggle = (id: string) =>
    setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div className={`flex flex-wrap gap-2 border-b border-stone-200 pb-2 ${controlled ? 'hidden' : ''}`}>
        {(visible.length ? visible : Object.keys(TAB_LABEL).map(id => ({ id, switch: '', state: 'active' as const })))
          .map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                tab === t.id ? 'text-white' : 'text-stone-600 hover:bg-stone-100'
              }`}
              style={tab === t.id ? { backgroundColor: accent ?? '#1c1917' } : undefined}
            >
              {TAB_LABEL[t.id] ?? t.id}
            </button>
          ))}
      </div>

      {current?.state === 'history' ? (
        <div className="rounded-lg border border-stone-300 bg-stone-50 px-4 py-2 text-sm text-stone-600">
          This one is switched to history. Everything below is readable and nothing new is computed.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      ) : null}

      {loading && !payload ? (
        <div className="px-4 py-8 text-center text-sm text-stone-500">Reading what was collected...</div>
      ) : null}

      {payload ? (
        <>
          {tab === 'now' ? <NowTab payload={payload} /> : null}
          {tab === 'slices' ? (
            <SlicesTab
              payload={payload} dimension={dimension} cross={cross}
              onDimension={setDimension} onCross={setCross}
            />
          ) : null}
          {tab === 'scorecard' ? <ScorecardTab payload={payload} /> : null}
          {tab === 'funnel' ? <FunnelTab payload={payload} /> : null}
          {tab === 'compare' ? <CompareTab payload={payload} selected={selected} onToggle={toggle} /> : null}
          {tab === 'goals' ? <GoalsTab payload={payload} /> : null}
          {tab === 'verdicts' ? <VerdictsTab payload={payload} /> : null}
          {tab === 'health' ? <HealthTab payload={payload} /> : null}
        </>
      ) : null}

      {payload?.suggested_values?.length ? (
        <details className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600">
          <summary className="cursor-pointer font-medium text-stone-700">
            Three values still waiting on your call
          </summary>
          <ul className="mt-2 space-y-2">
            {payload.suggested_values.map((v: Payload) => (
              <li key={v.id}>
                <span className="font-medium text-stone-800">{v.what}.</span> Suggested: {v.suggested}. {v.question}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
