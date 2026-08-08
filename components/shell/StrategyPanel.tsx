'use client';

// The Strategy corner — the restructure handoff, "The Strategy corner".
//
// It is NOT an app and NOT a fourth place. It is a panel that slides over the
// screen the user is already on, driven by a query parameter on the current
// route (`?strategy=switches`), so opening it never leaves the screen
// underneath and closing it just clears the parameter.
//
// The same tab strip and the same panel bodies also render as a page at
// `/profile/<id>/strategy/<panel>`, because those addresses are already
// registered routes and a deep link must not break. One component, two
// surfaces: the panels can never drift apart.
//
// Measurements come straight from the prototype and are not negotiable:
//   panel        470px desktop / full width phone, #faf8f6, shadow -16px 0 40px
//   panel head   #1c1a21, "Strategy" 18px/600, state line 12px white/55
//   tab strip    #f4f1ee, pills 12.5px/600, radius 10, active ink on white text
//   body         padding 18px 20px
//
// Chrome is ink. The profile's hue never appears in here at all.

import { useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import type { Lifecycle } from '@/lib/tree/objects';
import { LIFECYCLE_POLICY } from '@/lib/tree/objects';
import { renderProfile } from '@/lib/shell/profile';
import Decide from '@/components/strategy/Decide';
import Gates from '@/components/strategy/Gates';
import Switches from '@/components/strategy/Switches';
import Lock from '@/components/strategy/Lock';
import BrandKit from '@/components/strategy/BrandKit';
import Channels from '@/components/strategy/Channels';

export interface StrategyTab { id: string; label: string }

/**
 * The design's seven, in the design's order, plus Lifecycle.
 *
 * Lifecycle is the eighth because it is a real registered panel in this app and
 * the corner is the only way she can pause, close or archive a profile. The
 * prototype never had it, so the design could not list it; dropping it would
 * have taken a live control away.
 */
export const STRATEGY_TABS: StrategyTab[] = [
  { id: 'derivation', label: 'Decide' },
  { id: 'gates', label: 'Gates' },
  { id: 'switches', label: 'Switches' },
  { id: 'lock', label: 'Lock' },
  { id: 'channels', label: 'Channels' },
  { id: 'brand', label: 'Brand kit' },
  { id: 'intake-history', label: 'Intake history' },
  { id: 'lifecycle', label: 'Lifecycle' },
];

export const DEFAULT_STRATEGY_TAB = 'derivation';

/** The tab an unknown or missing value falls back to. */
export function strategyTabOf(value: string | null | undefined): string {
  return STRATEGY_TABS.some(t => t.id === value) ? (value as string) : DEFAULT_STRATEGY_TAB;
}

// ── The state line, read from the real lock ─────────────────────────────────

export function useStrategyState(profileId: string): string {
  const { state, role } = useApp();
  const locked = renderProfile(state, profileId, role).strategy_locked;
  return locked
    ? 'Locked. Open it to read, or to change one decision.'
    : 'Not locked. Creation stays read only until it is.';
}

// ── The pieces ───────────────────────────────────────────────────────────────

function TabStrip({ tab, hrefFor }: { tab: string; hrefFor: (id: string) => string }) {
  return (
    <div className="no-scrollbar flex flex-none gap-1 overflow-x-auto bg-control px-4 py-3">
      {STRATEGY_TABS.map(t => {
        const on = t.id === tab;
        return (
          <Link
            key={t.id}
            href={hrefFor(t.id)}
            className={`shrink-0 whitespace-nowrap rounded-[10px] px-[13px] py-[7px] text-[12.5px] font-semibold ${
              on ? 'bg-ink text-white' : 'bg-white text-muted hover:text-text'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

/**
 * The panel's contents. Every one of these screens already exists; this phase
 * routes them into the new shell and rebuilds none of their internals.
 */
export function StrategyBody(
  { profileId, tab, hrefFor }: { profileId: string; tab: string; hrefFor?: (panel: string) => string },
) {
  switch (tab) {
    case 'gates':
      return <Gates profileId={profileId} />;
    case 'switches':
      return <Switches profileId={profileId} />;
    case 'lock':
      return <Lock profileId={profileId} hrefFor={hrefFor} />;
    case 'channels':
      return <Channels profileId={profileId} />;
    case 'brand':
      return <BrandKit profileId={profileId} />;
    case 'intake-history':
      return <IntakeHistory profileId={profileId} />;
    case 'lifecycle':
      return <LifecyclePanel profileId={profileId} />;
    default:
      // Decide. The lock has its own section now (spec 34 §4), so it is not
      // printed underneath as well: fourteen identical sentences under the
      // decisions was most of what made this screen unreadable.
      return <Decide profileId={profileId} brandHref={hrefFor?.('brand') ?? `/profile/${profileId}/strategy/brand`} />;
  }
}

/**
 * The corner as the design has it: a panel over the current screen, sliding in
 * from the right. Closing it clears the parameter and the user is exactly where
 * they were.
 */
export function StrategyOverlay({
  profileId, tab, closeHref, hrefFor,
}: {
  profileId: string;
  tab: string;
  closeHref: string;
  hrefFor: (id: string) => string;
}) {
  const stateLine = useStrategyState(profileId);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[rgba(23,21,26,.34)]">
      <Link href={closeHref} aria-label="Close Strategy" className="flex-1" />
      <div className="flex w-full max-w-full flex-col bg-paper shadow-panel md:w-[470px]">
        <div className="flex flex-none items-center gap-3 bg-ink px-5 py-[18px] text-white">
          <span className="min-w-0 flex-1">
            <span className="block text-[18px] font-semibold tracking-[-.015em]">Strategy</span>
            <span className="mt-0.5 block text-xs text-white/55">{stateLine}</span>
          </span>
          <Link href={closeHref} aria-label="Close Strategy" className="flex text-white/70 hover:text-white">
            <X size={19} strokeWidth={2.2} />
          </Link>
        </div>
        <TabStrip tab={tab} hrefFor={hrefFor} />
        <div className="flex-1 overflow-y-auto px-5 py-[18px]">
          <StrategyBody profileId={profileId} tab={tab} />
        </div>
      </div>
    </div>
  );
}

/**
 * The same corner at its own address. A deep link into
 * `/profile/<id>/strategy/<panel>` still lands on the panel it names; it draws
 * as a page rather than over one, because there is no screen underneath it to
 * slide over.
 */
export function StrategyPage({ profileId, tab }: { profileId: string; tab: string }) {
  const stateLine = useStrategyState(profileId);

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-7">
      <div className="overflow-hidden rounded-frame border border-hairline bg-paper">
        <div className="flex items-center gap-3 bg-ink px-5 py-[18px] text-white">
          <span className="min-w-0 flex-1">
            <span className="block text-[18px] font-semibold tracking-[-.015em]">Strategy</span>
            <span className="mt-0.5 block text-xs text-white/55">{stateLine}</span>
          </span>
        </div>
        <TabStrip tab={tab} hrefFor={id => `/profile/${profileId}/strategy/${id}`} />
        <div className="px-5 py-[18px]">
          <StrategyBody profileId={profileId} tab={tab} />
        </div>
      </div>
    </div>
  );
}

// ── The two panels that live here and nowhere else ───────────────────────────

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
    return <p className="text-sm text-faint">No round has been opened yet.</p>;
  }
  return (
    <div className="space-y-1.5">
      <p className="pb-2 text-[13.5px] leading-[1.6] text-muted">
        Intake goes quiet once it is curated and lives here as history. Reopen a round from the
        Intake app and it comes back as an app.
      </p>
      {rounds.map(r => (
        <div
          key={r.version}
          className="flex items-center justify-between gap-3 border-b border-divider py-3 text-sm"
        >
          <span className="text-[14.5px] font-semibold text-text">Round {r.version}</span>
          <span className="tnum text-[12.5px] text-faint">
            {r.parameters.length} questions · {r.status}
          </span>
        </div>
      ))}
    </div>
  );
}

const LIFECYCLES: Lifecycle[] = ['setup', 'active', 'paused', 'closing', 'archived'];

/**
 * §5.8 / §4.6. Lifecycle changes are DECISIONS, and decisions belong to the
 * world they are about — which is why they live here and not on the shelf.
 * Retention is forever and the shelf never offers a delete (PLAN §11 Q5).
 */
function LifecyclePanel({ profileId }: { profileId: string }) {
  const { dispatch } = useApp();
  const { client } = useClient(profileId);
  const [pending, setPending] = useState<Lifecycle | null>(null);
  const current = (client?.lifecycle ?? 'active') as Lifecycle;

  return (
    <div className="space-y-3">
      <p className="text-[13.5px] leading-[1.6] text-muted">
        This profile is <span className="font-semibold text-text">{current}</span>. Nothing is ever
        removed by a change here.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {LIFECYCLES.map(l => (
          <button
            key={l}
            type="button"
            onClick={() => setPending(l)}
            className={`rounded-[10px] px-[13px] py-[7px] text-[12.5px] font-semibold ${
              l === current ? 'bg-ink text-white' : 'bg-white text-muted'
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      {pending && pending !== current && (
        <div className="rounded-card border border-hairline bg-white p-4 text-sm">
          <p className="font-semibold text-text">Move this profile to {pending}?</p>
          <p className="mt-1 text-muted">{LIFECYCLE_POLICY[pending].switch_behavior}.</p>
          <p className="mt-1 text-muted">
            {LIFECYCLE_POLICY[pending].client_doors.length === 0
              ? 'Their login stays; it simply has nothing behind it.'
              : `They keep: ${LIFECYCLE_POLICY[pending].client_doors.join(', ')}.`}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setPending(null)}
              className="rounded-xl border border-hairline px-[15px] py-2.5 text-[13.5px] font-semibold text-muted"
            >
              Leave it
            </button>
            <button
              type="button"
              onClick={() => {
                dispatch({ type: 'SET_LIFECYCLE', payload: { clientId: profileId, lifecycle: pending } });
                setPending(null);
              }}
              className="rounded-xl bg-ink px-[18px] py-2.5 text-[13.5px] font-semibold text-white"
            >
              Do it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
