'use client';

// The Switches screen — spec 34 §5.
//
// What it used to show her: `intake.questionnaire`, the words "both sides", and
// an orange line under every row apologising that a suggestion is only a
// suggestion and does not count until she picks it. Seventy-nine rows of that.
//
// What it shows now:
//
//   1. A plain name and a plain line for every switch. Never an id, never a
//      path. The names live in lib/strategy/plainSwitches.ts as data.
//   2. Three groups, and they are the three questions a switch answers: what
//      this client gets, what we do for them, what they can see.
//   3. Only what differs from the sensible default is open. Everything else
//      folds behind one line with a count, and the count is counted from the
//      array it describes, at render.
//   4. No suggestion language at all. A suggestion she has not touched behaves
//      as the suggestion. The lock still needs her yes on every position, so
//      that yes is asked ONCE, as one act, at the fold: "keep the rest as they
//      are". The suggested flag stays in the record for the migration.
//
// Moving a switch still opens the cascade before it commits (spec 28 §5.6), and
// that preview is drawn here from `cascadeTrace` with the plain names on, so no
// id reaches her through the back door either.

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import type { ProfileBody } from '@/lib/tree/body';
import type { PathState } from '@/lib/tree/contract';
import { cascadeTrace } from '@/lib/shell/trace';
import { CHANNELS_PATH, setSwitchPosition, switchConfigFromBody } from '@/lib/strategy/derivation';
import {
  composeMove, composeSwitchboard, positionsToConfirm,
  type MoveView, type SwitchGroupView, type SwitchRow,
} from '@/lib/strategy/plainSwitches';
import ProfileBodyGate from '../ProfileBodyGate';

const KICKER = 'text-[11.5px] font-bold uppercase tracking-[.09em] text-faint';
const BTN_DARK =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-ink px-4 py-2 ' +
  'text-[13px] font-semibold text-white disabled:opacity-50';
const BTN_GHOST =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-[rgba(23,21,26,.14)] ' +
  'px-[15px] py-[7px] text-[13px] font-semibold text-text';

export default function Switches({ profileId }: { profileId: string }) {
  const { role, dispatch } = useApp();
  const { client, data } = useClient(profileId);
  const [showFolded, setShowFolded] = useState(false);
  const [pending, setPending] = useState<{ id: string; state: PathState } | null>(null);

  const body = data.body;
  const platforms = useMemo(() => data.platforms ?? ['Instagram'], [data.platforms]);

  if (role !== 'owner') return <p className="p-8 text-sm text-faint">This screen is hers.</p>;
  if (!body) return <ProfileBodyGate clientId={profileId} />;

  const save = (next: ProfileBody) =>
    dispatch({ type: 'SET_BODY', payload: { clientId: profileId, body: next } });

  // A collector's sensible position depends on whether that platform has a
  // channel connected, so the channels are read here and passed in.
  const connected = (body.paths[CHANNELS_PATH] ?? [])
    .map(e => e.data as { platform?: string; connection?: string })
    .filter(c => c.connection === 'connected')
    .map(c => c.platform ?? '');

  const input = {
    config: switchConfigFromBody(body),
    suggested: client?.suggestedSwitches,
    platforms,
    connected,
  };
  const view = composeSwitchboard(input);

  function move(id: string, state: PathState) {
    save(setSwitchPosition(body!, id, state, new Date().toISOString(), false));
  }

  /** The one act the lock is waiting on, done once instead of seventy-nine times. */
  function confirmTheRest() {
    let next = body!;
    const now = new Date().toISOString();
    for (const w of positionsToConfirm(input)) {
      next = setSwitchPosition(next, w.id, w.state, now, false);
    }
    save(next);
  }

  return (
    <div className="mx-auto max-w-3xl">
      {view.openCount === 0 ? (
        <p className="text-[13.5px] leading-[1.6] text-muted">
          Nothing here is set differently for this client.
        </p>
      ) : (
        <div className="space-y-6">
          {view.open.map(g => (
            <Group key={g.id} group={g} onPick={(id, state) => setPending({ id, state })} />
          ))}
        </div>
      )}

      {/* The fold. One line, and the count comes from the array it describes. */}
      {view.foldedCount > 0 && (
        <section className="mt-6 overflow-hidden rounded-card border border-hairline bg-white">
          <button
            type="button"
            onClick={() => setShowFolded(v => !v)}
            className="flex w-full items-center gap-2 px-[18px] py-3.5 text-left"
          >
            {showFolded
              ? <ChevronDown size={16} className="shrink-0 text-faint" strokeWidth={2.2} />
              : <ChevronRight size={16} className="shrink-0 text-faint" strokeWidth={2.2} />}
            <span className="min-w-0 flex-1 text-[14px] font-semibold text-text">
              {view.foldLine}
            </span>
          </button>

          {showFolded && (
            <div className="space-y-6 border-t border-divider px-[18px] py-4">
              {view.folded.map(g => (
                <div key={g.id}>
                  <h3 className={KICKER}>{g.title}</h3>
                  <div className="mt-2 space-y-1.5">
                    {g.rows.map(r => (
                      <Row key={r.id} row={r} onPick={(id, state) => setPending({ id, state })} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Her yes, asked once. */}
      {view.unconfirmed.length > 0 && (
        <div className="mt-4 rounded-card border border-hairline bg-white p-[18px]">
          <p className="text-[13.5px] leading-[1.6] text-muted">{view.confirmLine}</p>
          <button type="button" onClick={confirmTheRest} className={`${BTN_DARK} mt-3`}>
            Keep them as they are
          </button>
        </div>
      )}

      {pending && (
        <Confirm
          move={composeMove(
            pending.id, pending.state, input.config,
            cascadeTrace(pending.id, pending.state),
          )}
          onCancel={() => setPending(null)}
          onApply={() => { move(pending.id, pending.state); setPending(null); }}
        />
      )}
    </div>
  );
}

function Group({ group, onPick }: {
  group: SwitchGroupView;
  onPick: (id: string, state: PathState) => void;
}) {
  return (
    <section>
      <h3 className={KICKER}>{group.title}</h3>
      <div className="mt-2 space-y-1.5">
        {group.rows.map(r => <Row key={r.id} row={r} onPick={onPick} />)}
      </div>
    </section>
  );
}

/**
 * One switch. Its name, what it does for this client, and the positions it can
 * hold. Nothing about where it came from, nothing about what kind of record it
 * is, and nothing apologising for itself.
 */
function Row({ row, onPick }: { row: SwitchRow; onPick: (id: string, state: PathState) => void }) {
  return (
    <div className="rounded-[14px] border border-hairline bg-white px-4 py-3">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-[14.5px] font-semibold leading-snug text-text">{row.name}</p>
          <p className="mt-0.5 text-[12.5px] leading-[1.5] text-muted">{row.line}</p>
        </div>
        <div className="flex flex-none flex-wrap gap-1.5">
          {row.choices.map(c => (
            <button
              key={c.state}
              type="button"
              onClick={() => { if (!c.on) onPick(row.id, c.state); }}
              className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                c.on ? 'bg-ink text-white' : 'bg-control text-muted hover:text-text'
              }`}
            >
              {c.words}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * What goes with it if she moves it — her side AND the client's, because
 * switches design her dashboard too (PLAN §3.4). Composed by `composeMove`,
 * generated from `cascadeOf`, never hand-written per switch.
 */
function Confirm({ move, onApply, onCancel }: {
  move: MoveView;
  onApply: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(23,21,26,.34)] sm:items-center sm:p-6"
      onClick={onCancel}
    >
      <div
        // The extra bottom padding on phone keeps the two actions clear of the
        // floating chat button, which is fixed to the same corner.
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-frame bg-white p-5 pb-[84px] sm:rounded-frame sm:pb-5"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-[12.5px] text-faint">{move.kicker}</p>
        <h3 className="mt-0.5 font-display text-[21px] font-bold tracking-[-.02em] text-text">
          {move.title}
        </h3>

        {move.takingAway && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className={KICKER}>Goes with it, for you</p>
              <p className="mt-1.5 text-[13.5px] leading-[1.6] text-muted">
                {move.hers.length === 0 ? 'Nothing else on your side.' : `${move.hers.join(', ')}.`}
              </p>
            </div>
            <div>
              <p className={KICKER}>Goes with it, for them</p>
              <p className="mt-1.5 text-[13.5px] leading-[1.6] text-muted">
                {move.theirs.length === 0
                  ? 'Nothing. They never had any of it.'
                  : `${move.theirs.join(', ')}.`}
              </p>
            </div>
          </div>
        )}

        {move.held && (
          <p className="mt-4 text-[13.5px] leading-[1.6] text-accent-text">{move.held}</p>
        )}

        <p className="mt-4 rounded-[14px] bg-sunken px-4 py-3 text-[13.5px] leading-[1.6] text-muted">
          {move.survives}
        </p>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onCancel} className={BTN_GHOST}>Leave it</button>
          <button type="button" onClick={onApply} className={BTN_DARK}>Do it</button>
        </div>
      </div>
    </div>
  );
}
