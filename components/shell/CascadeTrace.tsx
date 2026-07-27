'use client';

// The cascade trace on screen — spec 28 §5.6.
//
// Moving any switch opens this preview BEFORE it commits. Three rules:
//   1. it is generated from `cascadeOf(switchId)` and the registries, never
//      hand-written per switch;
//   2. it always shows both columns, even when the client column is empty,
//      because switches design her dashboard too (PLAN §3.4);
//   3. it always states what survives at `history` (S9).

import type { PathState } from '@/lib/tree/contract';
import { cascadeTrace } from '@/lib/shell/trace';

const STATE_WORDS: Record<PathState, string> = {
  active: 'on',
  history: 'off, keep the history',
  hidden: 'off, not for this client',
};

export default function CascadeTrace({
  switchId, to, onApply, onCancel, accent,
}: {
  switchId: string;
  to: PathState;
  onApply: () => void;
  onCancel: () => void;
  accent: string;
}) {
  const trace = cascadeTrace(switchId, to);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-6"
      onClick={onCancel}>
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
        onClick={e => e.stopPropagation()}>
        <p className="text-sm text-stone-500">Turning this to</p>
        <h3 className="text-base font-semibold text-stone-900">
          {switchId} — {STATE_WORDS[to]}
        </h3>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Disappears for you</p>
            <ul className="mt-1.5 space-y-1 text-sm text-stone-700">
              {trace.hers.length === 0
                ? <li className="text-stone-400">nothing on your side</li>
                : trace.hers.map(l => <li key={l.id}>· {l.words}</li>)}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Disappears for them</p>
            <ul className="mt-1.5 space-y-1 text-sm text-stone-700">
              {trace.theirs.length === 0
                ? <li className="text-stone-400">nothing, they had none of it</li>
                : trace.theirs.map(l => <li key={l.id}>· {l.words}</li>)}
            </ul>
          </div>
        </div>

        <p className="mt-4 rounded-xl bg-stone-100 px-4 py-3 text-sm text-stone-700">{trace.survives}</p>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel}
            className="rounded-lg border border-stone-200 px-3.5 py-2 text-sm text-stone-600">
            Leave it
          </button>
          <button type="button" onClick={onApply}
            className="rounded-lg px-3.5 py-2 text-sm text-white" style={{ backgroundColor: accent }}>
            Do it
          </button>
        </div>
      </div>
    </div>
  );
}
