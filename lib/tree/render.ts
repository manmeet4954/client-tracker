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
  // The setup gate LIVED HERE and is gone (2026-08-11, her order: "get rid of
  // this rule that they can't use or see anything without a set strategy for
  // clients"). It hid every non-setup family from clients on a new profile,
  // over a lock rule that stopped binding anything on 2026-08-09. Her switches
  // are the one authority on what a client sees, at every lifecycle short of
  // paused, closing and archived.
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

  // 4 — the lock (spec 22 §8.7), OWNER AND STAFF ONLY.
  //
  //     Her design says what happens on her side before the lock: an unlocked
  //     profile's board RENDERS. So these families resolve to `history` — the
  //     quiet, waiting shell — for her and for staff. That half is untouched;
  //     she works inside it every day.
  //
  //     THE CLIENT BRANCH THAT LIVED HERE IS GONE (2026-08-16). It returned
  //     `hidden` for every after-lock family on an unlocked profile, whatever
  //     her switches said — and it was the FOURTH home of the rule she killed
  //     on 2026-08-11: "get rid of this rule that they can't use or see
  //     anything without a set strategy for clients." Three homes were removed
  //     that day (setup's one-door policy, the setup branch above, the Brand
  //     window's needsLockedStrategy); this one hid behind a comment claiming a
  //     client has no business seeing content before a strategy exists — which
  //     is the dead rule restated, not a reason to keep it. It is why her
  //     Settings toggles for Content, Assets and Results moved nothing: the
  //     client sidebar asked this resolver and this line overruled every
  //     switch. For a client the lock plays NO part in visibility. Her
  //     switches are the single authority, bounded only by the resting
  //     lifecycles (step 2) and the doors (step 5).
  //
  //     WHAT THIS IS NOT, since 2026-08-09: it is not a rule about writing.
  //     `refusedCreationWrites` no longer refuses anything, because recording
  //     what is happening always works, locked or not — see
  //     lib/strategy/derivation.ts §8.7 for her decision and why. Generation is
  //     what needs the strategy, and each engine surface gates itself on its own
  //     `strategyLocked` flag.
  //
  //     So the two places that ask whether something can be WRITTEN — the desk
  //     chat's `guardPath` and the Creation screen — ask this resolver with the
  //     lock set aside, and read the answer as "is this switched on, on a
  //     profile that is still working?". Only the SHELL is decided here.
  if (!profile.strategy_locked && AFTER_LOCK_FAMILIES.includes(fam) && role !== 'client') {
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
