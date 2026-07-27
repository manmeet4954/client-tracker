'use client';

// The corner's seven panels — spec 28 §5.5, §5.4, §5.7.
//
// Derivation · Gate set · Switches · Channels · Brand book · Intake history ·
// Lifecycle. Owner only, in every position of every switch.
//
// §3.3's placement rule is what allows a creation path like
// `work-log/creation/channels` to render here: the corner is STRICTER than the
// path's own audience, and the rule only ever works that way round.

import { useState } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { useApp, useClient } from '@/contexts/AppContext';
import { CORNER_PANELS } from '@/lib/shell/nav';
import { accentFor, shellRole } from '@/lib/shell/profile';
import type { Lifecycle } from '@/lib/tree/objects';
import { LIFECYCLE_POLICY } from '@/lib/tree/objects';
import StrategyDerivationView from '@/components/StrategyDerivationView';
import GateSetView from '@/components/GateSetView';
import SwitchboardView from '@/components/SwitchboardView';
import StrategyLockView from '@/components/StrategyLockView';
import BrandView from '@/components/BrandView';
import ChannelsPanel from '@/components/shell/Channels';

const LIFECYCLES: Lifecycle[] = ['setup', 'active', 'paused', 'closing', 'archived'];

export default function CornerPanelPage({ params }: { params: { id: string; panel: string } }) {
  const { state, role } = useApp();
  const { client, data } = useClient(params.id);

  const known = CORNER_PANELS.find(p => p.id === params.panel);
  if (!known) notFound();
  if (shellRole(state, role, params.id) !== 'owner') notFound();

  const accent = accentFor(client, data);

  return (
    <div className="p-4 md:p-8">
      <nav className="no-scrollbar mx-auto mb-5 flex max-w-4xl gap-1.5 overflow-x-auto">
        {CORNER_PANELS.map(p => {
          const on = p.id === params.panel;
          return (
            <Link key={p.id} href={`/profile/${params.id}/strategy/${p.id}`}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm ${
                on ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 text-stone-600'
              }`}>
              {p.label}
            </Link>
          );
        })}
      </nav>

      {params.panel === 'derivation' && (
        <div className="space-y-8">
          <StrategyDerivationView clientId={params.id} />
          <StrategyLockView clientId={params.id} />
        </div>
      )}
      {params.panel === 'gates' && <GateSetView clientId={params.id} />}
      {params.panel === 'switches' && <SwitchboardView clientId={params.id} />}
      {params.panel === 'channels' && <ChannelsPanel profileId={params.id} accent={accent} />}
      {params.panel === 'brand' && <BrandView clientId={params.id} />}
      {params.panel === 'intake-history' && <IntakeHistory profileId={params.id} />}
      {params.panel === 'lifecycle' && <LifecyclePanel profileId={params.id} accent={accent} />}
    </div>
  );
}

/**
 * §5.4's quiet done. When every round is curated, Intake stops being navigation
 * and becomes this: the round list, one line each, and the reopen action.
 * Nothing is deleted, ever (S9).
 */
function IntakeHistory({ profileId }: { profileId: string }) {
  const { data } = useClient(profileId);
  const rounds = (data.body?.paths?.['context/intake'] ?? [])
    .map(e => e.data as unknown as { version: number; status: string; parameters: string[] })
    .sort((a, b) => a.version - b.version);

  if (rounds.length === 0) {
    return <p className="mx-auto max-w-3xl text-sm text-stone-400">No round has been opened yet.</p>;
  }
  return (
    <div className="mx-auto max-w-3xl space-y-1.5">
      {rounds.map(r => (
        <div key={r.version} className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm">
          <span className="text-stone-900">Round {r.version}</span>
          <span className="text-stone-500">{r.parameters.length} questions · {r.status}</span>
        </div>
      ))}
      <p className="pt-2 text-xs text-stone-500">
        Reopening a round brings Intake back into the navigation on both sides, holding only the
        parameters you reopen. Open it from the Intake app.
      </p>
    </div>
  );
}

/**
 * §5.8 / §4.6. Lifecycle changes are DECISIONS, and decisions belong to the
 * world they are about — which is why they live here and not on the shelf.
 * Retention is forever and the shelf never offers a delete (PLAN §11 Q5).
 */
function LifecyclePanel({ profileId, accent }: { profileId: string; accent: string }) {
  const { dispatch } = useApp();
  const { client } = useClient(profileId);
  const [pending, setPending] = useState<Lifecycle | null>(null);
  const current = (client?.lifecycle ?? 'active') as Lifecycle;

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <p className="text-sm text-stone-600">
        This profile is <span className="font-semibold text-stone-900">{current}</span>.
        Nothing is ever removed by a change here.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {LIFECYCLES.map(l => (
          <button key={l} type="button" onClick={() => setPending(l)}
            className={`rounded-full border px-3.5 py-1.5 text-sm ${
              l === current ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 text-stone-600'
            }`}>
            {l}
          </button>
        ))}
      </div>
      {pending && pending !== current && (
        <div className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
          <p className="text-stone-900">Move this profile to {pending}?</p>
          <p className="mt-1 text-stone-600">{LIFECYCLE_POLICY[pending].switch_behavior}.</p>
          <p className="mt-1 text-stone-600">
            {LIFECYCLE_POLICY[pending].client_doors.length === 0
              ? 'Their login stays; it simply has nothing behind it.'
              : `They keep: ${LIFECYCLE_POLICY[pending].client_doors.join(', ')}.`}
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setPending(null)}
              className="rounded-lg border border-stone-200 px-3.5 py-2 text-sm text-stone-600">
              Leave it
            </button>
            <button type="button"
              onClick={() => {
                dispatch({ type: 'SET_LIFECYCLE', payload: { clientId: profileId, lifecycle: pending } });
                setPending(null);
              }}
              className="rounded-lg px-3.5 py-2 text-sm text-white" style={{ backgroundColor: accent }}>
              Do it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
