'use client';

// The Lock screen — spec 34 §4.
//
// What it used to be: fourteen copies of "it has no decision yet, and no
// explicit not applicable with a reason", a list of switch ids under them, and
// a button. It never said what locking is FOR, which is why she asked what the
// deep idea of it is.
//
// What it is now, in this order:
//
//   1. What locking DOES, in two lines, before she is asked to do it. It opens
//      Creation for writing, and it freezes the version of the strategy every
//      piece made from here on is judged against.
//   2. Only what is MISSING, in her words, each one tappable to go and do it.
//      Nothing already decided appears at all.
//   3. The action, and what it will change.
//   4. Changing it after the lock is possible, and what that costs.
//
// The judge is unchanged: `lockViolations` decides what is missing and
// `lockStrategy` does the act. This screen re-presents their answers, and
// `composeLock` in lib/strategy/plainSwitches.ts is where that translation is
// tested without React.

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Lock as LockIcon } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import {
  LOCKABLE_STRATEGY_PATHS, lockStrategy, lockViolations, readStrategy,
} from '@/lib/strategy/derivation';
import { composeLock, type LockGo } from '@/lib/strategy/plainSwitches';
import ProfileBodyGate from '../ProfileBodyGate';

const KICKER = 'text-[11.5px] font-bold uppercase tracking-[.09em] text-faint';
const BTN_DARK =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-ink px-4 py-2.5 ' +
  'text-[13.5px] font-semibold text-white disabled:opacity-50';

/** Which panel each missing thing is fixed on. */
const PANEL_FOR: Record<LockGo, string> = {
  decide: 'derivation',
  gates: 'gates',
  switches: 'switches',
  channels: 'channels',
};

export default function Lock({ profileId, hrefFor }: {
  profileId: string;
  /** How this surface addresses its own panels. The corner passes its query
   *  string version; the page falls back to the route. */
  hrefFor?: (panel: string) => string;
}) {
  const { role, dispatch } = useApp();
  const { client, data } = useClient(profileId);
  const [said, setSaid] = useState('');

  const body = data.body;
  if (role !== 'owner') return <p className="p-8 text-sm text-faint">This screen is hers.</p>;
  if (!body) return <ProfileBodyGate clientId={profileId} />;

  const href = hrefFor ?? ((panel: string) => `/profile/${profileId}/strategy/${panel}`);

  const input = {
    body,
    lifecycle: client?.lifecycle ?? ('setup' as const),
    owner_kind: client?.ownerKind ?? ('client' as const),
    platforms: data.platforms ?? ['Instagram'],
    now: new Date().toISOString(),
    goals: [],
  };
  const locked = typeof body.strategy_version === 'number';
  const view = composeLock({
    failures: lockViolations(input),
    locked,
    version: body.strategy_version ?? null,
    decisionCount: LOCKABLE_STRATEGY_PATHS.length,
  });

  // Counted from the array it describes: the decisions changed since the lock.
  const waiting = LOCKABLE_STRATEGY_PATHS
    .filter(p => { const v = readStrategy(body, p); return !!v && v.strategy_version === null; });

  function lock() {
    const result = lockStrategy({ ...input, now: new Date().toISOString() });
    if (!result.ok) { setSaid('Not yet. The list above is what is still missing.'); return; }
    dispatch({ type: 'SET_BODY', payload: { clientId: profileId, body: result.body } });
    if (result.lifecycle !== input.lifecycle) {
      dispatch({ type: 'SET_LIFECYCLE', payload: { clientId: profileId, lifecycle: result.lifecycle } });
    }
    setSaid(`Locked as version ${result.strategy_version}. Creation is open.`);
  }

  const showAction = !locked || waiting.length > 0;

  return (
    <div className="mx-auto max-w-3xl">
      {/* 1. What locking does, before she is asked to do it. */}
      <section className="rounded-card border border-hairline bg-white p-[18px]">
        <div className="flex items-start gap-2.5">
          <LockIcon size={17} strokeWidth={2.2} className="mt-0.5 shrink-0 text-accent" />
          <div className="min-w-0">
            <p className="text-[14.5px] font-semibold leading-snug text-text">{view.does[0]}</p>
            <p className="mt-1 text-[13.5px] leading-[1.6] text-muted">{view.does[1]}</p>
          </div>
        </div>
        {locked && (
          <p className="mt-3 border-t border-divider pt-3 text-[13.5px] leading-[1.6] text-muted">
            This strategy is locked as version {body.strategy_version}.
            {waiting.length > 0 && ` ${waiting.length === 1
              ? 'One decision has changed since then and is waiting.'
              : `${waiting.length} decisions have changed since then and are waiting.`}`}
          </p>
        )}
      </section>

      {/* 2. Only what is missing. */}
      {view.missing.length > 0 && (
        <section className="mt-5">
          <h3 className={KICKER}>Still to do</h3>
          <div className="mt-2 space-y-1.5">
            {view.missing.map(m => (
              <Link
                key={m.id}
                href={href(PANEL_FOR[m.go])}
                className="flex items-center gap-3 rounded-[14px] border border-hairline bg-white px-4 py-3 hover:border-[rgba(234,71,17,.3)]"
              >
                <span className="min-w-0 flex-1 text-[14px] font-medium leading-snug text-text">
                  {m.what}
                </span>
                <ArrowRight size={16} strokeWidth={2.2} className="shrink-0 text-faint" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 3. The action, and what it will change. */}
      {showAction && (
        <section className="mt-5 rounded-card border border-hairline bg-white p-[18px]">
          <p className="text-[13.5px] leading-[1.6] text-muted">{view.actionLine}</p>
          <button type="button" onClick={lock} disabled={!view.ready} className={`${BTN_DARK} mt-3`}>
            {view.action}
          </button>
          {!view.ready && (
            <p className="mt-2 text-[12.5px] text-faint">
              The list above has to be empty first.
            </p>
          )}
          {said && <p className="mt-2 text-[12.5px] text-accent-text">{said}</p>}
        </section>
      )}

      {/* 4. Changing it later, and what that costs. */}
      <section className="mt-5 rounded-card border border-hairline bg-sunken p-[18px]">
        <h3 className={KICKER}>{view.changeTitle}</h3>
        {view.changeLines.map(line => (
          <p key={line} className="mt-2 text-[13.5px] leading-[1.6] text-muted">{line}</p>
        ))}
        <Link
          href={href('derivation')}
          className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-accent-text"
        >
          Change a decision <ArrowRight size={15} strokeWidth={2.2} />
        </Link>
      </section>
    </div>
  );
}
