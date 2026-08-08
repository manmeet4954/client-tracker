// The render resolver — spec 28 §3.2, §6. THE single visibility authority.
//
// Every screen, tab, panel, picker row and field asks ONE function whether it
// exists. It composes, in this order, and takes the most restrictive answer:
//
//   1. the switch cascade   — `effectiveState` in ./switches.ts (spec 21 §5.2)
//   2. the lifecycle        — LIFECYCLE_POLICY (S22, spec 22 §11.1)
//   3. the audience + door  — the declarations' own client_door (S19)
//
// It is built ON the cascade, never around it: nothing here re-implements a
// switch position, and no component may read one directly (§17.5). It weakens
// nothing — the server has already stripped a hidden path from the payload
// (`filterStateForRole` → `filterBodyForNonOwner`), and this is the read-side
// helper that stops a screen drawing something the server never sent.

import type { ClientDoor, PathState, SwitchConfig } from './contract.ts';
import { minState, stateRank } from './contract.ts';
import type { Lifecycle } from './objects.ts';
import { doorsOpenAt } from './objects.ts';
import { doorsForSwitch, effectiveState, resolveSwitch } from './switches.ts';

/** The three logins the shell can render for. Staff is §19's open question. */
export type ShellRole = 'owner' | 'client' | 'staff';

/**
 * A profile, resolved to exactly what the resolver needs. Spec 28 writes the
 * signature as `renderState(profileId, switchId, role)`; a pure module cannot
 * fetch a profile by id, so the id arrives already resolved — same three
 * arguments, same answer, no hidden state. `renderProfile()` in
 * `lib/shell/profile.ts` is the one place that builds it.
 */
export interface RenderProfile {
  id: string;
  /** Her positions for this profile, read out of `context/content-strategy/toolset`. */
  config: SwitchConfig;
  lifecycle: Lifecycle;
  /** PLAN §7: `hers` unlocks the effort and money meters. */
  owner_kind: 'hers' | 'client';
  /** Spec 22 §8.6. Creation and analysis cannot open before strategy locks. */
  strategy_locked: boolean;
  /** The doors THIS login's bindings hold. Ignored for the owner. */
  doors?: ClientDoor[];
}

/** The switch families a profile still in `setup` may render (spec 28 §5.8). */
const SETUP_FAMILIES = ['spine', 'shelf', 'owner', 'client_access', 'intake', 'strategy', 'frozen', 'leaves'];

/** Creation and analysis are shut until strategy locks (spec 22 §8.7). */
const AFTER_LOCK_FAMILIES = ['creation', 'analysis', 'assets', 'references', 'logs', 'platforms'];

function family(switchId: string): string {
  return switchId.split('.')[0];
}

/**
 * Does this thing exist right now, for this login, on this profile?
 *
 *   active  → renders, writable per audience
 *   history → renders READ-ONLY, with one line saying since when
 *   hidden  → nothing. No tab, no label, no placeholder, no disabled control
 */
export function renderState(profile: RenderProfile, switchId: string, role: ShellRole): PathState {
  const dec = resolveSwitch(switchId);
  if (!dec) return 'hidden';                       // an unregistered switch renders nothing

  // 1 — the cascade. The minimum of this switch's own position and every
  //     prerequisite's, computed transitively. Nothing renders on a guess.
  let state: PathState = effectiveState(switchId, profile.config);

  // 2 — the lifecycle (S22, as corrected by spec 22 §11.1).
  const fam = family(switchId);
  if (profile.lifecycle === 'setup' && !SETUP_FAMILIES.includes(fam)) {
    // A fresh profile has Intake and the Strategy corner, and nothing else:
    // creation cannot open until strategy locks.
    return 'hidden';
  }
  if (profile.lifecycle === 'archived') {
    // Everything renders read-only. No write control is rendered anywhere.
    state = minState(state, 'history');
  } else if (profile.lifecycle === 'paused' || profile.lifecycle === 'closing') {
    // Her side keeps working; everything client-facing drops to history.
    if (dec.audience !== 'owner') state = minState(state, 'history');
  }

  // 3 — PLAN §7, and it is a rule rather than a preference: the effort and money
  //     meters survive only inside HER profiles. Hidden on a client profile for
  //     everyone, her included (spec 28 §5.2, test §17.9).
  if (profile.owner_kind === 'client' && (switchId === 'logs.effort_meter' || switchId === 'logs.effort_money')) {
    return 'hidden';
  }

  // 4 — the lock (spec 22 §8.7), as the restructure handoff has it.
  //
  //     Shipped behaviour was: before the lock, every after-lock family is
  //     HIDDEN. Combined with dropping the cutover gate that would have put
  //     seven profiles into a shell with nothing in it, which is worse than the
  //     tab bar it replaced.
  //
  //     Her design says what happens instead, and it says it precisely: an
  //     unlocked profile's board RENDERS and does not move. "Strategy is not
  //     locked yet, so nothing can be written here. Read the board, but the
  //     pieces cannot move." So before the lock these families resolve to
  //     `history` — visible, read-only — for her and for staff.
  //
  //     The client keeps the old answer, `hidden`. A client has no business
  //     seeing a profile's content before its strategy exists, and the workshop
  //     rule only ever gets stronger (CLAUDE.md rule 2).
  //
  //     Writes are untouched: `refusedCreationWrites` still refuses every write
  //     under `work-log/creation/` until the lock, server side. The lock gates
  //     what can be WRITTEN, not which shell she is looking at.
  if (!profile.strategy_locked && AFTER_LOCK_FAMILIES.includes(fam)) {
    if (role === 'client') return 'hidden';
    state = minState(state, 'history');
  }

  // 5 — the audience and the door (S19, PLAN §4).
  if (role === 'owner') return state;
  if (dec.audience === 'owner') return 'hidden';   // the workshop, in any switch position
  if (role === 'staff') return state;              // staff work inside her side (§19, interim)

  const held = profile.doors ?? doorsOpenAt(profile.lifecycle);
  const needed = doorsForSwitch(switchId);
  if (needed.length === 0) return 'hidden';        // no door, no sight
  if (!needed.some(d => held.includes(d))) return 'hidden';
  return state;
}

/**
 * The container rule (spec 28 §5.1): a container renders when at least one of
 * its children renders. A container with no rendering children is NOT rendered —
 * no empty app, no empty tab, no shell with nothing in it.
 */
export function containerState(children: PathState[]): PathState {
  let best: PathState = 'hidden';
  for (const c of children) if (stateRank(c) > stateRank(best)) best = c;
  return best;
}

/** Convenience for a row of switches: every one that is not `hidden`. */
export function renderedOf<T extends { switch: string }>(
  profile: RenderProfile, role: ShellRole, items: T[],
): (T & { state: PathState })[] {
  return items
    .map(i => ({ ...i, state: renderState(profile, i.switch, role) }))
    .filter(i => i.state !== 'hidden');
}
