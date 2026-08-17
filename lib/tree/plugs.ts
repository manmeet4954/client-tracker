// The plug layer — spec 36. What a CLIENT sees, decided in one place.
//
// HER RULING, 2026-08-17: "On the client side, things work in a board. One
// feature is that it should work like a board. There is absolute dumbness in
// not being able to do that."
//
// A PLUG IS A WHOLE FEATURE, and there is ONE binary decision per plug: in, or
// out. She does not decide whether a board can drag. A board drags.
//
// ── What this replaces ───────────────────────────────────────────────────────
//
// Two rules, in two files, each vetoing what the other allowed:
//   render.ts   `if (dec.audience === 'owner') return 'hidden'`   (68 of 96)
//   validate.ts `audience !== 'owner' && !!client_door`           (29 doors)
//
// So 68 of her 96 features were invisible to a client WHATEVER she ticked, and
// a path with no hand-declared door was invisible even with its switch on.
// Every request of hers became a code change across four or five files. That is
// the mechanical reason her toggles felt fake.
//
// `audience` no longer vetoes. It is a fact about who a switch was WRITTEN for,
// and nothing more. This file decides what a client sees.
//
// ── The model ────────────────────────────────────────────────────────────────
//
// A client's position lives in its OWN namespace, `client:<switchId>`, so it
// can never be confused with her own position for the same switch. That
// separation is the whole safety of this design: turning the Engine on for
// HERSELF must never turn it on for a client, and before this file those were
// one value.
//
// Three rules, in order:
//   1. Her explicit `client:<id>` position wins. Always. This is what makes a
//      toggle real, and it is why NOTHING is hard-blocked (spec 36 §4): she can
//      put any plug in, the Engine included.
//   2. With no explicit position, the default below applies.
//   3. A plug is NEVER more alive for a client than for her. A feature she has
//      switched off for herself cannot be live for a client — that would be the
//      client shell inventing something her own screen does not have.
//
// Pure. No clock, no React, no I/O.

import type { PathState, SwitchConfig } from './contract.ts';
import { minState, stateRank } from './contract.ts';
import { SWITCHES, effectiveState, resolveSwitch, switchForPath } from './switches.ts';
import { findDeclaration } from './declarations.ts';

/** Her client-facing position for a switch is stored under this prefix. */
export const CLIENT_PREFIX = 'client:';

export function clientKey(switchId: string): string {
  return `${CLIENT_PREFIX}${switchId}`;
}

/**
 * The plugs that start OUT.
 *
 * Her workshop and her private decisions. Everything else in her navigation
 * starts IN, because the client sees her dashboard.
 *
 * NOTHING HERE IS HARD-BLOCKED. Every id below is still a toggle she can turn
 * on for a client if she wants to — that was her explicit ruling. This list
 * only decides where a plug STARTS.
 *
 * `CLAUDE.md` rule 1 is why the drafting family is here: nothing AI-generated
 * reaches a client without her curating it first. That constrains the DEFAULT.
 * It has never justified shipping a plug with pieces missing.
 */
export const OFF_BY_DEFAULT: readonly string[] = [
  // Creation → Engine. The making of the work is hers.
  'creation.engine', 'creation.seed_extraction', 'creation.costume',
  'creation.brief', 'creation.drafting', 'creation.making',
  // Creation → Logs. Her running record, her effort, her money.
  'logs.tasks', 'logs.decisions', 'logs.requests', 'logs.changes',
  'logs.pipelines.lists', 'logs.pipelines.cold_calls', 'logs.pipelines.orders',
  'logs.observations', 'logs.effort_meter', 'logs.effort_money',
  'creation.funnel_replies',
  // Analysis → Verdicts. Her ruling, 2026-08-17: "real tabs, but Verdicts
  // stays yours." It is a toggle like the rest; it simply starts out.
  'analysis.verdicts',
  // Strategy → the decisions about the engagement itself.
  'strategy.lock', 'strategy.switchboard', 'intake.rounds_reopen',
];

/**
 * The plugs that start IN — every switch named in her navigation
 * (`lib/shell/nav.ts`) that is not on the OFF list above.
 *
 * WRITTEN OUT rather than imported from nav.ts, for two reasons. It would be a
 * circular import (nav → render → plugs → nav). And more importantly, a
 * default that decides what leaves the building should be READ, not computed:
 * a reviewer can see this list. `tests/access.plugs.test.ts` pins it against
 * nav.ts, so a screen she adds fails the build until it is classified here —
 * which is the moment to decide, not a thing to discover later.
 */
export const ON_BY_DEFAULT: readonly string[] = [
  // Intake — the questions she sent them.
  'intake.questionnaire', 'intake.finding_session',
  // Creation → Board. The board, whole: stages, review, scheduling, publishing.
  'creation.board', 'creation.review', 'creation.scheduling',
  'creation.publishing', 'creation.funnel',
  // Creation → Assets.
  'assets.library', 'assets.drive_videos', 'assets.catalogue_export',
  'assets.share_target',
  // Creation → References.
  'references.from_client', 'references.our_vision',
  // Analysis — her real tabs. Her ruling, 2026-08-17: the client sees the real
  // numbers, live, not a curated monthly page.
  'analysis.always_live', 'analysis.bifurcation', 'analysis.scorecard',
  'analysis.funnel', 'analysis.compare', 'analysis.goal_tracking',
  'analysis.sync_health',
  // Strategy — what their brand says. Not how it was decided.
  'strategy.fixed', 'strategy.visual_branding', 'strategy.profile_mockup',
  'creation.channels',
  // Already client-facing before this spec; unchanged in effect.
  'client_access.login', 'client_access.mini_shelf',
  'creation.seed_input_client', 'assets.client_upload',
  'strategy.client_brand', 'analysis.digest_client',
];

const ON = new Set(ON_BY_DEFAULT);
const OFF = new Set(OFF_BY_DEFAULT);

/**
 * Where a plug starts, with no position of hers.
 *
 * Anything NOT named in her navigation defaults OUT. That is deliberate and it
 * is the safety property of this file: inverting a default from hidden to
 * visible means a mistake exposes rather than hides, so only the features she
 * actually has on a screen are opened, and everything else stays shut until
 * someone classifies it above.
 */
export function plugDefault(switchId: string): PathState {
  if (OFF.has(switchId)) return 'hidden';          // her workshop, by her ruling
  if (ON.has(switchId)) return 'active';           // her navigation, newly opened

  // THE INVERSION MAY ONLY EVER ADD (2026-08-17). Anything a client could
  // already reach before spec 36 — every switch written for them or for both —
  // keeps exactly the default it had. Caught by tests 11d and 11g the first
  // time this ran: a bound client's review deep-link stopped resolving, because
  // a list meant to OPEN features had quietly closed one.
  //
  // A change that widens what clients see must never narrow it somewhere else.
  const dec = resolveSwitch(switchId);
  if (dec && dec.audience !== 'owner') return 'active';

  // Everything else — her machinery, unnamed in her navigation — stays out
  // until someone classifies it above. Inverting a default from hidden to
  // visible means a mistake exposes rather than hides, so silence means shut.
  return 'hidden';
}

/**
 * Does this client see this feature, and in what state?
 *
 * THE single answer. `renderState` (what the screen may draw) and
 * `clientMayRead` (what the payload may carry) both ask it, so the two can
 * never disagree again — and they did disagree, which is how the client shell
 * came to show tabs whose data the server had already stripped.
 */
export function plugState(switchId: string, config: SwitchConfig): PathState {
  if (!resolveSwitch(switchId)) return 'hidden';   // unregistered renders nothing
  const explicit = config[clientKey(switchId)]?.state;
  const want: PathState = explicit ?? plugDefault(switchId);
  if (want === 'hidden') return 'hidden';
  // Rule 3: never more alive than her own. The client shell may not invent a
  // feature her own screen does not have.
  return minState(want, effectiveState(switchId, config));
}

/**
 * Paths that NEVER travel to a client, whatever any plug says.
 *
 * This is not a feature list and it is not the OFF list — those are her
 * choices. This is infrastructure: data that exists so the app can work, and
 * which describes her decisions rather than their brand.
 *
 * `toolset` is the switchboard itself: every position she has set, for every
 * switch, including the ones she has HIDDEN. It was caught by test 2 the first
 * time this file ran — a hidden LinkedIn was absent from every path and still
 * named in her settings, which makes "hidden means absent" a lie. A client's
 * payload must never carry her control panel.
 */
const NEVER_TRAVELS: readonly string[] = [
  'context/content-strategy/toolset',
];

function never(path: string): boolean {
  return NEVER_TRAVELS.some(p => path === p || path.startsWith(`${p}/`));
}

/**
 * Every switch that owns this path.
 *
 * More than one switch can own one path, and that is not a mistake in the
 * registry: `work-log/analysis/digests` is owned by BOTH `analysis.digest_owner`
 * and `analysis.digest_client`, because the same store is written by her engine
 * and read by their window. `switchForPath` answers with only one of them, so
 * asking it alone hid the client's own digests behind her owner switch — caught
 * by spec 27's test 10 the first time this file ran.
 *
 * A path travels when ANY switch that owns it is plugged in.
 */
function switchesOwning(path: string): string[] {
  const out = SWITCHES.filter(s => (s.owns ?? []).includes(path)).map(s => s.id);
  const named = switchForPath(path);
  if (named && !out.includes(named)) out.push(named);
  return out;
}

/** The same question for a concrete path in the tree. */
export function plugStateForPath(path: string, config: SwitchConfig): PathState {
  if (never(path)) return 'hidden';
  const ids = switchesOwning(path);
  if (ids.length === 0) return 'hidden';           // unaddressed reaches nobody

  // The most permissive owner wins: one switch being in is enough for the path
  // to travel, exactly as `windowsForBinding` has always granted on `.some`.
  let state: PathState = 'hidden';
  for (const id of ids) {
    const s = plugState(id, config);
    if (stateRank(s) > stateRank(state)) state = s;
  }

  const dec = findDeclaration(path);
  if (!dec) return state;
  // A path can never be more active than its own declaration allows.
  return dec.states.includes(state) ? state : minState(state, dec.states[dec.states.length - 1]);
}
