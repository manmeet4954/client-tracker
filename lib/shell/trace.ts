// The cascade trace on screen — spec 28 §5.6, rendering spec 22 §8.5's
// requirement: for each switch, "what it turns off if she moves it: the cascade
// set, computed by cascadeOf, showing her side AND the client's."
//
// Three rules, and the first one is the whole point:
//
//   1. It is GENERATED from `cascadeOf(switchId)` and the registries — never
//      hand-written per switch. A screen that forgets to declare its switch is a
//      screen that goes missing from the trace, which is exactly why §17.5 exists.
//   2. It always shows both columns, even when the client column is empty,
//      because switches design her dashboard too (PLAN §3.4).
//   3. It always states what survives at `history`. S9: turning something off
//      never removes its history.

import type { PathState } from '../tree/contract.ts';
import { findDeclaration } from '../tree/declarations.ts';
import { cascadeOf, resolveSwitch } from '../tree/switches.ts';

export interface TraceLine {
  /** The switch or path this line is about. */
  id: string;
  /** One plain line, in her language. */
  words: string;
}

export interface CascadeTrace {
  switch_id: string;
  /** The position she is moving to. */
  to: PathState;
  hers: TraceLine[];
  theirs: TraceLine[];
  /** What stays, read-only. Empty only when the move is to `hidden`. */
  survives: string;
}

/** A path, said the way she would say it. `work-log/creation/review` → "creation review". */
function pathWords(path: string): string {
  return path.split('/').filter(p => p !== '*').slice(-2).join(' ').replace(/-/g, ' ');
}

/** A switch, the same way. `creation.funnel_replies` → "funnel replies". */
function switchWords(id: string): string {
  return id.split('.').slice(1).join(' ').replace(/_/g, ' ') || id;
}

/**
 * The trace for one move. Both columns always, generated, with the survival
 * sentence attached.
 */
export function cascadeTrace(switchId: string, to: PathState): CascadeTrace {
  const own = resolveSwitch(switchId);
  const { switches, paths } = cascadeOf(switchId);

  const hers: TraceLine[] = [];
  const theirs: TraceLine[] = [];

  const place = (id: string, words: string, audience: string | undefined) => {
    if (audience === 'client') { theirs.push({ id, words }); return; }
    if (audience === 'both') { hers.push({ id, words }); theirs.push({ id, words }); return; }
    hers.push({ id, words });
  };

  place(switchId, switchWords(switchId), own?.audience);
  for (const s of switches) place(s, switchWords(s), resolveSwitch(s)?.audience);
  for (const p of [...(own?.owns ?? []), ...paths]) {
    const dec = findDeclaration(p);
    if (!dec) continue;
    place(p, pathWords(p), dec.audience);
  }

  const dedupe = (list: TraceLine[]) => {
    const seen = new Set<string>();
    return list.filter(l => (seen.has(l.id) ? false : (seen.add(l.id), true)));
  };

  return {
    switch_id: switchId,
    to,
    hers: dedupe(hers),
    theirs: dedupe(theirs),
    survives: to === 'history'
      ? 'Everything already recorded stays, readable, and nothing new is written.'
      : 'Everything already recorded stays. Turning this off removes the screen, never the history.',
  };
}
