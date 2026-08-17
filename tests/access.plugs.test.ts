// Spec 36 — the plug layer's own tests.
//
// A plug is a WHOLE FEATURE, in or out. These pin the three things that make
// that safe: the defaults are complete, her workshop stays out, and her private
// data does not travel.

import { suite, test, ok, eq } from './harness.ts';
import { fixtureState } from './fixtures.ts';
import { filterStateForRole, normalizeState } from '../lib/access.ts';
import { migrateProfile } from '../lib/tree/migrate.ts';
import { OFF_BY_DEFAULT, ON_BY_DEFAULT, plugDefault } from '../lib/tree/plugs.ts';
import { ANALYSIS_TABS, CREATION_TABS, APPS, ROOM_PANELS } from '../lib/shell/nav.ts';
import { resolveSwitch } from '../lib/tree/switches.ts';

const NOW = '2026-07-25T12:00:00.000Z';

suite('spec 36 §2 — every plug in her navigation is classified');

/** Every switch named anywhere in her own navigation. */
function navSwitches(): string[] {
  const out = new Set<string>();
  const walk = (nodes: { switches: string[]; children?: unknown[] }[]) => {
    for (const n of nodes) {
      for (const s of n.switches) out.add(s);
      if (n.children) walk(n.children as { switches: string[]; children?: unknown[] }[]);
    }
  };
  walk([...APPS, ...CREATION_TABS, ...ANALYSIS_TABS, ...ROOM_PANELS]);
  return [...out];
}

test('every switch on one of her screens is named IN or OUT, deliberately', () => {
  // THE POINT OF THIS TEST: when she adds a screen, the build fails until
  // someone decides whether a client gets it. That decision belongs at the
  // moment the screen is built, not to be discovered by her months later on a
  // live client login — which is exactly how the dissections of 2026-08-17
  // were found.
  const on = new Set(ON_BY_DEFAULT);
  const off = new Set(OFF_BY_DEFAULT);
  const unclassified: string[] = [];
  for (const id of navSwitches()) {
    if (!resolveSwitch(id)) continue;                 // platforms.* and friends
    if (!on.has(id) && !off.has(id)) unclassified.push(id);
  }
  eq(unclassified, [], 'these are on her screens and nobody decided about them');
});

test('no switch is on both lists', () => {
  const off = new Set(OFF_BY_DEFAULT);
  eq(ON_BY_DEFAULT.filter(id => off.has(id)), [], 'a plug cannot start both in and out');
});

test('her workshop starts OUT, and her screens start IN', () => {
  for (const id of ['creation.engine', 'creation.drafting', 'logs.effort_money',
    'analysis.verdicts', 'strategy.lock']) {
    eq(plugDefault(id), 'hidden', `${id} must start out`);
  }
  for (const id of ['creation.board', 'assets.library', 'analysis.scorecard',
    'analysis.compare', 'analysis.goal_tracking']) {
    eq(plugDefault(id), 'active', `${id} is a screen of hers and must start in`);
  }
});

test('the inversion only ever ADDS: what a client already had, they keep', () => {
  // Caught by tests 11d and 11g the first time this ran: a bound client's
  // review deep-link stopped resolving, because a list meant to OPEN features
  // had quietly closed one. A change that widens what clients see must never
  // narrow it somewhere else.
  for (const id of ['creation.review_deeplink', 'creation.review_public_link',
    'creation.review_perception', 'client_access.login']) {
    eq(plugDefault(id), 'active', `${id} was client-facing before spec 36`);
  }
});

suite('spec 36 §8 — her own slices never travel to a client');

test('a client payload carries no private notes, cold calls, orders or money', () => {
  // Found in the 2026-08-17 audit. `filterStateForRole` filtered the body and
  // passed all 30 legacy slices through untouched, so a client's browser
  // downloaded her private strategy notes, cold calls, orders, lead answers and
  // effort figures. Nothing DREW them, so nothing had been seen — and a comment
  // in ClientWindows.tsx claimed brand.strategy was excluded, which was true of
  // what was drawn and false of what was sent.
  //
  // "Nothing renders it" is not a boundary.
  const state = normalizeState(fixtureState());
  const client = state.clients.find(c => c.id === 'career-bubble')!;
  state.clientData['career-bubble'].body =
    migrateProfile(client, state.clientData['career-bubble'], { now: NOW }).body;
  state.clientData['career-bubble'] = {
    ...state.clientData['career-bubble'],
    brand: { ...state.clientData['career-bubble'].brand, strategy: 'HER PRIVATE PLAN' },
    coldCalls: [{ id: 'c1' }] as never,
    orders: [{ id: 'o1' }] as never,
    leadAnswers: [{ id: 'l1' }] as never,
  };

  const served = filterStateForRole(state, 'merushri').clientData['career-bubble'];
  eq(served.brand.strategy, '', 'her private per-profile notes are blank');
  eq(served.coldCalls, [], 'no cold calls');
  eq(served.orders, [], 'no orders');
  eq(served.leadAnswers, [], 'no lead answers');
  eq(served.momentum, undefined, 'no effort or money figures');
  ok(!JSON.stringify(served).includes('HER PRIVATE PLAN'),
    'and the words themselves are nowhere in what is sent');
});

test('what IS theirs still arrives', () => {
  const state = normalizeState(fixtureState());
  const client = state.clients.find(c => c.id === 'career-bubble')!;
  state.clientData['career-bubble'].body =
    migrateProfile(client, state.clientData['career-bubble'], { now: NOW }).body;
  state.clientData['career-bubble'] = {
    ...state.clientData['career-bubble'],
    brand: { ...state.clientData['career-bubble'].brand, tagline: 'THEIR POSITIONING' },
  };
  const served = filterStateForRole(state, 'merushri').clientData['career-bubble'];
  eq(served.brand.tagline, 'THEIR POSITIONING', 'their own brand still reaches them');
  ok(Array.isArray(served.contentCards), 'and their board still does');
});
