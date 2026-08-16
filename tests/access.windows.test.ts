// "What can this client see" as a choice — 2026-08-11.
//
// The one thing that must never break: this screen is a TRANSLATION of the
// access rules, never a second opinion about them. If lib/access.ts changes
// which switches a window needs, the tick on her screen has to change with it,
// or she will send a link to a window the client cannot open.
//
// So the first test reads the real table out of lib/access.ts and compares.

import { readFileSync } from 'node:fs';
import { suite, test, eq, ok } from './harness.ts';
import {
  ACCESS_PRESETS, WINDOW_CHOICES, accessLine, findWindow,
  movesForPreset, moveFor, windowsOn, type WindowKey,
} from '../lib/access/windowChoice.ts';
import { filterStateForRole, normalizeState, windowsForBinding, type Role } from '../lib/access.ts';
import { bindingsFor, makeInvite, roleForInvite } from '../lib/access/invites.ts';
import { migrateProfile } from '../lib/tree/migrate.ts';
import { putEntry } from '../lib/tree/body.ts';
import { renderState } from '../lib/tree/render.ts';
import { resolveSwitch } from '../lib/tree/switches.ts';
import type { PathState } from '../lib/tree/contract.ts';
import { renderProfile } from '../lib/shell/profile.ts';
import { setSwitchPosition, switchConfigFromBody } from '../lib/strategy/derivation.ts';
import type { AppState } from '../types/index.ts';
import { fixtureState } from './fixtures.ts';

suite('what the client can see, as her choice');

test('every window she can tick is a window the access rules actually have', () => {
  // lib/access.ts is the authority. Its WINDOWS table is data, so it is read
  // rather than imported (importing it would drag the whole state module in).
  const src = readFileSync(new URL('../lib/access.ts', import.meta.url), 'utf8');
  for (const w of WINDOW_CHOICES) {
    ok(src.includes(`id: '${w.key}'`), `access.ts has no window called ${w.key}`);
  }
  // And the reverse: a window added there must be added here, or she will have
  // no way to grant it.
  const declared = [...src.matchAll(/^\s{4}id: '([a-z]+)', label: '/gm)].map(m => m[1]);
  for (const id of declared) {
    ok(WINDOW_CHOICES.some(w => w.key === id), `access.ts has window "${id}" she cannot tick`);
  }
});

test('every switch a window needs is named in the access rules for that window', () => {
  const src = readFileSync(new URL('../lib/access.ts', import.meta.url), 'utf8');
  for (const w of WINDOW_CHOICES) {
    for (const s of w.switches) {
      ok(src.includes(`'${s}'`), `access.ts never mentions ${s}, needed by ${w.key}`);
    }
  }
});

test('a window is on only when ALL its switches are on', () => {
  // Results needs two. One is not enough, and showing a tick for it would be
  // the exact lie this screen exists to prevent.
  eq(windowsOn({ 'analysis.digest_client': 'active' }).includes('results'), false, 'half is not on');
  eq(
    windowsOn({ 'analysis.digest_client': 'active', 'analysis.client_publication': 'active' })
      .includes('results'),
    true,
    'both is on',
  );
});

test('nothing set reads as the defaults, which is what the client actually gets', () => {
  // REWRITTEN 2026-08-16 (the read-back half of the toggles defect). This test
  // pinned `windowsOn({}) === []`, which was the toggle lying in the other
  // direction: on a never-touched profile the default-active windows RENDER
  // for a bound client, so an all-off Settings screen said one thing while the
  // client saw another — her exact complaint. A switch with no position now
  // reads as its suggested default, the same first step effectiveState takes.
  eq(windowsOn({}).sort().join(','), 'assets,brand,content,intake',
    'the suggested defaults, exactly what the server grants a bound client');
  eq(accessLine([]), 'This client cannot open anything yet.', 'the empty line still reads plainly');
});

test('one tick moves every switch that window needs, and only those', () => {
  const on = moveFor('results', true);
  eq(on.length, 2, 'results carries two switches');
  eq(on.every(m => m.state === 'active'), true, 'ticking turns them on');
  const off = moveFor('results', false);
  eq(off.every(m => m.state === 'hidden'), true, 'unticking turns them off');
  eq(moveFor('assets', true).length, 1, 'assets carries one');
});

test('a preset turns the named windows on and everything else off', () => {
  const moves = movesForPreset(['content']);
  const byId = Object.fromEntries(moves.map(m => [m.id, m.state]));
  eq(byId['creation.review'], 'active', 'content is on');
  eq(byId['intake.questionnaire'], 'hidden', 'intake is off');
  eq(byId['analysis.digest_client'], 'hidden', 'results is off');
  // And the round trip: applying those positions reads back as exactly that.
  eq(windowsOn(byId), ['content'], 'reads back as content only');
});

test('every preset round-trips to the windows it promises', () => {
  for (const preset of ACCESS_PRESETS) {
    const byId = Object.fromEntries(movesForPreset(preset.windows).map(m => [m.id, m.state]));
    const got = windowsOn(byId);
    // Brand is the one window that needs a locked strategy on top of switches,
    // and windowsOn does not know about locking, so switches alone must match.
    eq(got.sort().join(','), [...preset.windows].sort().join(','), `preset ${preset.id}`);
  }
});

test('a shared switch is never turned off by a window she left unticked', () => {
  // Guards the dedupe: if two windows ever share a switch, the ticked one wins.
  const shared = WINDOW_CHOICES.flatMap(w => w.switches)
    .filter((s, i, all) => all.indexOf(s) !== i);
  for (const s of shared) {
    const owners = WINDOW_CHOICES.filter(w => w.switches.includes(s)).map(w => w.key);
    const byId = Object.fromEntries(movesForPreset([owners[0]]).map(m => [m.id, m.state]));
    eq(byId[s], 'active', `${s} stayed on for ${owners[0]}`);
  }
  ok(true, 'no shared switch today, and it is now safe when there is');
});

test('no window waits for the lock any more', () => {
  // Her order, 2026-08-11: "get rid of this rule that they can't use or see
  // anything without a set strategy for clients." The rule and its caveat are
  // both gone; this pins that no window carries a lock precondition, so the
  // rule cannot quietly return as a flag on one entry.
  const src = readFileSync(new URL('../lib/access/windowChoice.ts', import.meta.url), 'utf8');
  eq(/needsLockedStrategy: true/.test(src), false, 'no window is gated on the lock');
  const access = readFileSync(new URL('../lib/access.ts', import.meta.url), 'utf8');
  eq(/needsLockedStrategy && !profile\.strategy_locked/.test(access), false,
    'and windowsForBinding no longer checks it');
});

test('the line reads as a sentence, in her words, with no em dash', () => {
  eq(accessLine(['content']), 'They can open content and approvals.', 'one window');
  eq(
    accessLine(['intake', 'assets']),
    'They can open questions for them and sending you material.',
    'two windows joined with and',
  );
  for (const w of WINDOW_CHOICES) {
    eq(w.label.includes('—'), false, w.label);
    eq(w.line.includes('—'), false, w.line);
  }
  for (const p of ACCESS_PRESETS) eq(p.line.includes('—'), false, p.line);
});

test('a window key that does not exist is refused, not guessed', () => {
  let threw = false;
  try { findWindow('nonsense' as WindowKey); } catch { threw = true; }
  eq(threw, true, 'an unknown window throws rather than granting something');
});

suite('what a client would see, asked of the real rules');

// clientView must never re-implement access: these tests exercise it against
// the same fixture the access tests themselves use.

test('an archived profile shows a client nothing, and every reason says why', async () => {
  const { clientView } = await import('../lib/access/clientPreview.ts');
  const base = normalizeState(fixtureState());
  const id = base.clients[0].id;
  const state = {
    ...base,
    clients: base.clients.map(c => (c.id === id ? { ...c, lifecycle: 'archived' as const } : c)),
  };
  const view = clientView(state, id);
  eq(view.nothing, true, 'archived closes every door');
  eq(view.closed.length, WINDOW_CHOICES.length, 'all five explained');
  for (const w of view.closed) {
    ok(w.why.length > 0, `${w.key} has a reason`);
    ok(!w.why.includes('—'), 'no em dash in a line she reads');
  }
});

test('the preview binding leaks nothing into the real state', async () => {
  const { clientView } = await import('../lib/access/clientPreview.ts');
  const state = normalizeState(fixtureState());
  const before = (state.bindings ?? []).length;
  clientView(state, state.clients[0].id);
  eq((state.bindings ?? []).length, before, 'the temporary binding stays temporary');
});

// ── The toggles are the single authority — 2026-08-16 ────────────────────────
//
// The defect this pins dead: her private-window test as SMG's client showed
// Brand + Intake only while her Settings had Content and Assets ON. The
// resolver's step 4 still hid every after-lock family from a client on an
// unlocked profile — the FOURTH home of the rule she killed on 2026-08-11
// ("get rid of this rule that they can't use or see anything without a set
// strategy for clients"). So these tests run the WHOLE wire, on a profile that
// has never locked: her tick → moveFor → setSwitchPosition → windowsForBinding,
// for a guest binding exactly like the ones the invite flow makes.

const NOW = '2026-08-16T12:00:00.000Z';
const PROFILE = 'career-bubble';

/** A guest bound to a cut-over profile that has NEVER locked a strategy.
 *
 *  Deliberately NOTHING else: no strategy_version, and no explicit
 *  `client_access.login` position — nothing in the real app has ever written
 *  that switch, so a fixture that pre-set it would mask exactly the gap that
 *  kept Assets and Results dark on her real profiles. The binding IS the
 *  login (derived, 2026-08-16), and these tests prove it end to end. */
function guestOnUnlockedProfile(): { state: AppState; role: Role } {
  const base = normalizeState(fixtureState());
  const client = base.clients.find(c => c.id === PROFILE)!;
  const migrated = migrateProfile(client, base.clientData[PROFILE], { now: NOW });
  const inv = makeInvite({
    id: 'i-smg', name: 'SMG', code: 'ABCD-EFGH-JKMN', profileIds: [PROFILE], now: NOW,
  });
  const state: AppState = {
    ...base,
    invites: [inv],
    bindings: [...(base.bindings ?? []), ...bindingsFor(inv)],
  };
  state.clientData[PROFILE] = { ...state.clientData[PROFILE], body: migrated.body };
  return { state, role: roleForInvite(inv) as Role };
}

function applyMoves(state: AppState, moves: { id: string; state: PathState }[]): AppState {
  const next = { ...state, clientData: { ...state.clientData } };
  let body = next.clientData[PROFILE].body!;
  for (const m of moves) body = setSwitchPosition(body, m.id, m.state, NOW, false);
  next.clientData[PROFILE] = { ...next.clientData[PROFILE], body };
  return next;
}

suite('her toggles are the whole law — end to end, on an unlocked profile');

test('each of the five windows follows its toggle, lock or no lock', () => {
  const { state, role } = guestOnUnlockedProfile();
  // The same reading `strategy_locked` derives from (lib/shell/profile.ts).
  ok(typeof state.clientData[PROFILE].body!.strategy_version !== 'number',
    'the profile has never locked');
  for (const w of WINDOW_CHOICES) {
    const on = applyMoves(state, moveFor(w.key, true));
    ok(windowsForBinding(on, role, PROFILE).some(x => x.id === w.key),
      `${w.key} ticked ON must reach the client`);
    const off = applyMoves(state, moveFor(w.key, false));
    ok(!windowsForBinding(off, role, PROFILE).some(x => x.id === w.key),
      `${w.key} ticked OFF must be gone`);
  }
});

test('the binding IS the login: nothing ever wrote client_access.login', () => {
  // The gap the first fixture masked (2026-08-16): no code in the app writes
  // `client_access.login`, so on every real profile it sat at its hidden
  // default and vetoed Assets and Results however she set the toggles. It is
  // DERIVED from the live binding now, never stored.
  const { state, role } = guestOnUnlockedProfile();
  const stored = switchConfigFromBody(state.clientData[PROFILE].body!);
  eq(stored['client_access.login'], undefined, 'the switch has no stored position');
  const on = applyMoves(state, moveFor('assets', true));
  ok(windowsForBinding(on, role, PROFILE).some(w => w.id === 'assets'),
    'and Assets still follows its toggle, because the binding derives the login');
  // No binding, no login: a role that reaches nothing derives nothing.
  eq(windowsForBinding(on, 'guest:nobody' as Role, PROFILE), [], 'unbound grants nothing');
});

test('a granted window\'s data travels: not the same lie one layer down', () => {
  const { state, role } = guestOnUnlockedProfile();
  // One real asset set on the profile, then the window granted by her toggle.
  const withAsset = { ...state, clientData: { ...state.clientData } };
  withAsset.clientData[PROFILE] = {
    ...withAsset.clientData[PROFILE],
    body: putEntry(withAsset.clientData[PROFILE].body!, 'work-log/assets/sets', {
      id: 'set-cb', type: 'asset_set', data: { name: 'August shoot' },
    }, { writer: 'owner', now: NOW }),
  };
  const granted = applyMoves(withAsset, moveFor('assets', true));
  ok(windowsForBinding(granted, role, PROFILE).some(w => w.id === 'assets'), 'the window renders');
  const served = filterStateForRole(granted, role);
  ok(Object.keys(served.clientData[PROFILE].body?.paths ?? {}).includes('work-log/assets/sets'),
    'and the served payload carries the sets the window shows');
});

test('a never-touched profile reads exactly what a bound client sees', () => {
  // The read-back half (2026-08-16): windowsOn folds each switch's suggested
  // default in, and the login derives from the binding — so the Settings
  // toggles and the server's grant can no longer disagree, window by window.
  const { state, role } = guestOnUnlockedProfile();
  const positions: Record<string, PathState | undefined> = Object.fromEntries(
    Object.entries(switchConfigFromBody(state.clientData[PROFILE].body!)).map(([id, v]) => [id, v.state]),
  );
  const read = windowsOn(positions).sort().join(',');
  const granted = windowsForBinding(state, role, PROFILE).map(w => w.id).sort().join(',');
  eq(read, granted, 'the toggles read the truth the client gets');
  ok(read.length > 0, 'and the defaults are not nothing');
});

test('every preset round-trips through the real grant, not just the read-back', () => {
  const { state, role } = guestOnUnlockedProfile();
  for (const preset of ACCESS_PRESETS) {
    const applied = applyMoves(state, movesForPreset(preset.windows));
    const got = windowsForBinding(applied, role, PROFILE).map(w => w.id);
    eq(got.sort().join(','), [...preset.windows].sort().join(','),
      `preset ${preset.id} grants exactly what it promises`);
  }
});

test('Brand off moves nothing on HER side: the cascade hazard is dead', () => {
  // The old wiring hung "Their brand" on `strategy.fixed`, a prerequisite of
  // half the board — one tick would have written a forbidden position and the
  // cascade would have obeyed it, for her too. Pin: the owner renders the same
  // before and after, on every switch that requires strategy.
  const HERS = [
    'strategy.fixed', 'strategy.visual_branding', 'creation.board', 'creation.review',
    'creation.scheduling', 'creation.channels', 'platforms.instagram', 'assets.library',
    'logs.tasks', 'analysis.tracking',
  ];
  const { state } = guestOnUnlockedProfile();
  const before = renderProfile(state, PROFILE, 'owner');
  const after = renderProfile(applyMoves(state, moveFor('brand', false)), PROFILE, 'owner');
  for (const id of HERS) {
    eq(renderState(after, id, 'owner'), renderState(before, id, 'owner'),
      `${id} changed for the owner when Brand was hidden from the client`);
  }
});

test('a fixed switch is refused at the write door', () => {
  const { state } = guestOnUnlockedProfile();
  const body = state.clientData[PROFILE].body!;
  for (const id of ['strategy.fixed', 'spine.fixed', 'creation.gates', 'logs.feedback']) {
    let threw = false;
    try { setSwitchPosition(body, id, 'hidden', NOW, false); } catch { threw = true; }
    eq(threw, true, `${id} is structural, and writing it must throw`);
  }
});

test('no switch a window hangs on is fixed, and every one can be shown AND hidden', () => {
  // The class of bug behind the Brand toggle, made impossible to regrow: a
  // window whose switch cannot honestly hold both positions is a lying toggle.
  const referenced = WINDOW_CHOICES.flatMap(w => [
    ...w.switches, ...(w.parts ?? []).map(p => p.switch),
  ]);
  for (const id of referenced) {
    const dec = resolveSwitch(id);
    ok(!!dec, `${id} is not in the registry`);
    eq(dec!.fixed ?? false, false, `${id} is fixed, so its toggle would lie`);
    ok(dec!.allowed_states.includes('active') && dec!.allowed_states.includes('hidden'),
      `${id} cannot hold both positions a toggle writes`);
  }
});

test('a window with parts is on when ANY part is, exactly as the server grants it', async () => {
  const { movePart } = await import('../lib/access/windowChoice.ts');
  // Only approvals on: the window must read as on, because windowsForBinding
  // grants it on `.some` — an off-toggle over an open window would lie.
  eq(windowsOn({ 'creation.review': 'active', 'creation.scheduling': 'hidden' }).includes('content'),
    true, 'one part is enough');
  eq(windowsOn({ 'creation.review': 'hidden', 'creation.scheduling': 'active' }).includes('content'),
    true, 'either part');
  // Both EXPLICITLY off — since 2026-08-16 an unset part reads as its default,
  // so "off" here has to be her position, not an absence.
  eq(windowsOn({ 'creation.review': 'hidden', 'creation.scheduling': 'hidden' }).includes('content'),
    false, 'both off is off');
  // A part moves only its own switch.
  eq(movePart('content', 'approvals', false), [{ id: 'creation.review', state: 'hidden' }], 'one switch, no more');
  // The master still moves both.
  eq(moveFor('content', false).length, 2, 'the window toggle closes both parts');
});
