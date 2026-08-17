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
import { plugState } from './plugs.ts';

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

// AFTER_LOCK_FAMILIES and family() lived here and are gone (2026-08-17). They
// existed only to shut Creation, Analysis, Assets, References, Logs and
// Platforms until a strategy was locked. She overruled that rule for everyone,
// herself included, so the list has nothing left to name.

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

  // 4 — THE LOCK GATE IS GONE ENTIRELY (2026-08-17, her ruling).
  //
  //     Her words: "I don't want to keep the first rule, which was that you
  //     cannot see the strategy and the analysis part until and unless intake
  //     is complete. That is something that is overruled. We are not keeping it
  //     for the clients, and it won't be kept for me as well."
  //
  //     This was the FIFTH home of that rule. The client branch went on
  //     2026-08-16; three more went on 2026-08-11 (setup's one-door policy, the
  //     setup branch above, the Brand window's needsLockedStrategy). This last
  //     one hit HER: on any profile whose strategy was not locked, her own
  //     Creation, Analysis, Assets, References, Logs and Platforms all dropped
  //     to `history` — read-only, with a line explaining nothing moves. It is
  //     why her own dashboard kept going quiet on profiles she was mid-way
  //     through setting up.
  //
  //     `strategy_locked` stays on the profile because the ENGINE still reads
  //     it: generation needs a strategy, and each engine surface gates itself
  //     on its own flag (lib/strategy/derivation.ts §8.7). What the lock no
  //     longer does is decide whether a SHELL renders. Her switches are the one
  //     authority on that, for her and for a client alike, bounded only by the
  //     resting lifecycles (step 2) and the doors (step 5).
  //
  //     THE CLIENT BRANCH THAT LIVED HERE WENT FIRST (2026-08-16). It returned
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
  //     (the gate that stood here is removed; see the note above)

  // 5 — the plug (spec 36). ONE question, asked in one place.
  if (role === 'owner') return state;
  if (role === 'staff') return state;              // staff work inside her side (§19, interim)

  // THE TWO VETOES THAT STOOD HERE ARE GONE (2026-08-17, spec 36):
  //
  //   if (dec.audience === 'owner') return 'hidden';   // 68 of 96 switches
  //   if (needed.length === 0) return 'hidden';        // "no door, no sight"
  //
  // Between them they made 68 of her 96 features invisible to a client
  // WHATEVER she ticked, and made a path with no hand-declared door invisible
  // even with its switch on. Adding one feature to a client's view meant
  // editing four or five files, which is why every request of hers became a
  // build and why her toggles felt fake. Her words: "I just have to tell you
  // what things I don't want them to have."
  //
  // `audience` is now a fact about who a switch was written for, not a veto.
  // `lib/tree/plugs.ts` decides, and the payload filter asks the SAME function,
  // so a screen can never again be drawn over data the server stripped.
  const plug = plugState(switchId, profile.config);
  if (plug === 'hidden') return 'hidden';
  state = minState(state, plug);

  // The doors still govern WRITING, where they are the real boundary and
  // CLAUDE.md rule 2 applies. They no longer govern sight. A switch with no
  // door is readable when her plug says so; it is still unwritable, because
  // `clientMayWriteAt` is a separate question with a separate answer.
  const held = profile.doors ?? doorsOpenAt(profile.lifecycle);
  const needed = doorsForSwitch(switchId);
  if (needed.length > 0 && !needed.some(d => held.includes(d))) {
    // Their binding does not hold this door: readable, never writable.
    return minState(state, 'history');
  }
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
