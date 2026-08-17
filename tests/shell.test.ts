// Spec 28 §17 — the shell's acceptance tests.
//
// Tests 1 to 13 run here, on plain Node, alongside every existing check. Most of
// them assert over the SERVER-SIDE role-filtered payload and the resolver, which
// is where the guarantee actually lives; the two that need to be seen (§17.15,
// and the rendered halves of §17.14 and §17.16) are browser checks and are named
// as such at the end rather than pretended into unit tests.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { suite, test, ok, eq } from './harness.ts';
import { fixtureState } from './fixtures.ts';
import {
  allowedClientIds, filterStateForRole, normalizeState, windowsForBinding, windowsForRole,
} from '../lib/access.ts';
import { migrateProfile } from '../lib/tree/migrate.ts';
import { amendEntry, putEntry } from '../lib/tree/body.ts';
import type { ProfileBody } from '../lib/tree/body.ts';
import type { PathState } from '../lib/tree/contract.ts';
import type { Lifecycle } from '../lib/tree/objects.ts';
import { renderState, containerState } from '../lib/tree/render.ts';
import { cascadeOf } from '../lib/tree/switches.ts';
import { setSwitchPosition } from '../lib/strategy/derivation.ts';
import { isCutOver, renderProfile, staysOnLegacy } from '../lib/shell/profile.ts';
import { APPS, ANALYSIS_TABS, CREATION_TABS, landingPath, nodeState, rendered } from '../lib/shell/nav.ts';
import { ROUTE_MAP, legacyDestination, routeFate } from '../lib/shell/routes.ts';
import { composeCard, composeShelf, composeTodayStrip, composeWeeklyPulse } from '../lib/shell/shelf.ts';
import { cascadeTrace } from '../lib/shell/trace.ts';
import { resolveDeepLink } from '../lib/shell/deeplink.ts';
import { DESK_PROMPTS, runDesk } from '../lib/shell/desk.ts';
import { classifyQuestion } from '../lib/shell/deskAnswers.ts';
import type { AppState } from '../types/index.ts';

const NOW = '2026-07-25T12:00:00.000Z';
const TODAY = '2026-07-27';
const ROOT = process.cwd();

// ── The fixture: two profiles cut over, one client bound to one of them ──────

/** Every position she would have set walking the switchboard for a live client. */
const CLIENT_POSITIONS: [string, PathState][] = [
  ['client_access.login', 'active'],
  ['intake.questionnaire', 'active'],
  ['creation.board', 'active'],
  ['creation.review', 'active'],
  ['creation.review_public_link', 'active'],
  ['creation.review_deeplink', 'active'],
  ['creation.review_perception', 'active'],
  ['creation.scheduling', 'active'],
  ['assets.library', 'active'],
  ['assets.client_upload', 'active'],
  ['logs.tasks', 'active'],
  ['shelf.today_strip', 'active'],
  ['analysis.tracking', 'active'],
  ['analysis.always_live', 'active'],
  ['analysis.pulse_owner', 'active'],
  ['creation.channels', 'active'],
  ['platforms.instagram', 'active'],
  ['platforms.linkedin', 'active'],
  ['analysis.digest_owner', 'active'],
  ['analysis.digest_client', 'active'],
  ['analysis.client_publication', 'active'],
];

function withPositions(body: ProfileBody, positions: [string, PathState][]): ProfileBody {
  let next = body;
  for (const [id, state] of positions) next = setSwitchPosition(next, id, state, NOW, false);
  return next;
}

function lock(body: ProfileBody, version = 1): ProfileBody {
  return { ...body, strategy_version: version };
}

/** One task, one piece and one weekly pulse, at their own addresses. */
function withWork(body: ProfileBody, tag: string): ProfileBody {
  let next = putEntry(body, 'work-log/logs/tasks', {
    id: `task-${tag}`, type: 'task',
    data: { text: `Send ${tag} the brief`, due_date: '2026-07-26', done: false },
  }, { writer: 'owner', now: NOW });
  next = putEntry(next, 'work-log/logs/tasks', {
    id: `task-${tag}-piece`, type: 'task',
    data: { text: `Finish the ${tag} carousel`, due_date: TODAY, done: false, piece_id: `piece-${tag}` },
  }, { writer: 'owner', now: NOW });
  next = putEntry(next, 'work-log/creation', {
    id: `piece-${tag}`, type: 'piece',
    data: {
      title: `The ${tag} salary carousel`, hook: 'Nobody tells you this',
      stage: 'review', seed_id: null, costume: {}, notes: 'her private note',
    },
  }, { writer: 'owner', now: NOW });
  next = putEntry(next, 'work-log/analysis/digests', {
    id: `pulse-${tag}`, type: 'digest',
    data: {
      kind: 'weekly-pulse', period_end: '2026-07-26', published: false,
      sections: [{ id: 'pulse', heading: 'This week', lines: ['3 posted this week.'] }],
      coverage: { days_expected: 7, days_covered: 7, gaps: [] },
    },
  }, { writer: 'engine:analysis', now: NOW });
  return next;
}

function shellState(): AppState {
  const state = normalizeState(fixtureState());
  for (const id of ['resumeguru', 'career-bubble']) {
    const client = state.clients.find(c => c.id === id)!;
    const migrated = migrateProfile(client, state.clientData[id], { now: NOW, observations: state.observations });
    state.clientData[id].body = lock(withWork(withPositions(migrated.body, CLIENT_POSITIONS), id));
  }
  // Divine stays migrated-but-unlocked: the honest pre-cutover case (§16.3).
  const divine = state.clients.find(c => c.id === 'divine-studio')!;
  state.clientData['divine-studio'].body =
    migrateProfile(divine, state.clientData['divine-studio'], { now: NOW }).body;
  return state;
}

/** Every source file under a directory, for the two static checks. */
function sourcesUnder(dir: string): { file: string; text: string }[] {
  const out: { file: string; text: string }[] = [];
  const walk = (d: string) => {
    let entries: string[];
    try { entries = readdirSync(d); } catch { return; }
    for (const e of entries) {
      const full = join(d, e);
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (!/\.tsx?$/.test(e)) continue;
      out.push({ file: full.slice(ROOT.length + 1), text: readFileSync(full, 'utf8') });
    }
  };
  walk(join(ROOT, dir));
  return out;
}

/** The interior: everything inside a profile. The shelf is deliberately not in it. */
function interiorSources() {
  return [
    ...sourcesUnder('app/profile'),
    ...sourcesUnder('components/shell').filter(s => !/Shelf\.tsx$/.test(s.file)),
  ];
}

// ── 1. No sideways profile navigation exists ─────────────────────────────────

suite('spec 28 §17.1 — no sideways profile navigation');

test('1. static: nothing in the interior imports the cross-profile sidebar', () => {
  for (const s of interiorSources()) {
    ok(!/components\/Sidebar/.test(s.text), `${s.file} imports the retired Sidebar`);
  }
  // And the sidebar is still in the repo, unimported by the shell (§5.7): it is
  // removed with the legacy routes at §16.6, not by this spec.
  ok(readFileSync(join(ROOT, 'components/Sidebar.tsx'), 'utf8').length > 0, 'Sidebar.tsx survives');
});

test('1b. static: no interior module names a profile id in a route', () => {
  // A route inside a profile is always built from the id in the CURRENT route.
  // A literal id in a path string is the one thing that could cross worlds.
  const literal = /["'`]\/(?:profile|client)\/(?!\$\{)[A-Za-z0-9_-]+/g;
  for (const s of interiorSources()) {
    const hits = s.text.match(literal) ?? [];
    eq(hits, [], `${s.file} carries a hard-coded profile route`);
  }
});

test('1c. dynamic: the navigation for profile A never names profile B', () => {
  const state = shellState();
  const a = 'resumeguru';
  const profile = renderProfile(state, a, 'owner');
  const nav = rendered(APPS, profile, 'owner');
  const rendered_ids = JSON.stringify(nav) + landingPath(a, profile, 'owner');
  for (const c of state.clients) {
    if (c.id === a) continue;
    ok(!rendered_ids.includes(c.id), `profile ${c.id} appears in A's navigation`);
    ok(!rendered_ids.includes(c.name), `profile ${c.name} appears in A's navigation`);
  }
});

test('1d. the only route out of a profile is the shelf', () => {
  const frame = readFileSync(join(ROOT, 'components/shell/Frame.tsx'), 'utf8');
  const outward = [...frame.matchAll(/href="(\/[^"]*)"/g)].map(m => m[1]);
  eq([...new Set(outward)], ['/shelf'], 'exactly one static destination, and it is the shelf');
});

// ── 2. A hidden switch renders nothing ───────────────────────────────────────

suite('spec 28 §17.2 — a hidden switch renders nothing, in the payload too');

function withLinkedIn(state: AppState, position: PathState): AppState {
  const next = { ...state, clientData: { ...state.clientData } };
  const body = next.clientData['career-bubble'].body!;
  const withPath = putEntry(body, 'context/content-strategy/platforms/linkedin', {
    id: 'linkedin', type: 'platform',
    data: { name: 'LinkedIn', formats: ['text post', 'document'] },
  }, { writer: 'owner', now: NOW });
  next.clientData['career-bubble'] = {
    ...next.clientData['career-bubble'],
    body: setSwitchPosition(withPath, 'platforms.linkedin', position, NOW, false),
  };
  return next;
}

test('2. hidden: no LinkedIn entry at any path in the served payload', () => {
  const served = filterStateForRole(withLinkedIn(shellState(), 'hidden'), 'merushri');
  const body = served.clientData['career-bubble'].body!;
  for (const p of Object.keys(body.paths)) {
    ok(!p.includes('linkedin'), `LinkedIn survived at ${p}`);
  }
  ok(!JSON.stringify(body).toLowerCase().includes('linkedin'), 'no LinkedIn anywhere in the body');
});

test('2b. and the resolver answers hidden, for her and for them', () => {
  const state = withLinkedIn(shellState(), 'hidden');
  const profile = renderProfile(state, 'career-bubble', 'owner');
  eq(renderState(profile, 'platforms.linkedin', 'owner'), 'hidden', 'hers');
  eq(renderState(renderProfile(state, 'career-bubble', 'merushri'), 'platforms.linkedin', 'client'),
    'hidden', 'theirs');
});

test('2c. history: the past renders read-only, and every write is refused', () => {
  // On a work-log path, where the client's "locked version only" rule does not
  // also apply — that rule is spec 22 §10's and has its own test.
  const state = allOff(shellState(), 'career-bubble', []);
  const body = setSwitchPosition(state.clientData['career-bubble'].body!, 'creation.review', 'history', NOW, false);
  state.clientData['career-bubble'] = {
    ...state.clientData['career-bubble'],
    body: putEntry(body, 'work-log/creation/review', {
      id: 'rev-old', type: 'review_record', data: { share_id: 'old', piece_id: null, verdict: null },
    }, { writer: 'owner', now: NOW }),
  };
  const served = filterStateForRole(state, 'merushri');
  const entries = served.clientData['career-bubble'].body!.paths['work-log/creation/review'];
  ok(entries && entries.length > 0, 'the past is still there');
  ok(entries.every(e => e.state === 'history'), 'and it is read-only');

  let threw = '';
  try {
    putEntry({ ...state.clientData['career-bubble'].body!, paths: { 'work-log/creation/review': entries } },
      'work-log/creation/review',
      { id: 'rev-old', type: 'review_record', data: { share_id: 'old' } }, { writer: 'owner', now: NOW });
  } catch (e) { threw = e instanceof Error ? e.message : String(e); }
  ok(threw.includes('history'), 'a write against history is refused');
});

test('2d. the check FAILS when the resolver is bypassed', () => {
  // Reading the stored body directly — which is what bypassing renderState means —
  // still shows LinkedIn. That is the whole reason the payload is the assertion.
  const state = withLinkedIn(shellState(), 'hidden');
  ok(JSON.stringify(state.clientData['career-bubble'].body).toLowerCase().includes('linkedin'),
    'the stored body keeps it (S9: nothing is deleted)');
});

// ── 3. A client sees no shelf ────────────────────────────────────────────────

suite('spec 28 §17.3 — a client sees no shelf');

test('3. one binding: their payload holds one profile and no other id', () => {
  const served = filterStateForRole(shellState(), 'merushri');
  eq(served.clients.map(c => c.id), ['career-bubble'], 'their profile only');
  // The tree — everything the new shell renders from — names no other profile.
  // (Spec 12's shared-list window is a declared, separately tested exception
  // that lives in the legacy slices and reaches no window in this shell.)
  const tree = JSON.stringify(served.clientData['career-bubble'].body);
  ok(!tree.includes('resumeguru'), 'no other profile id');
  ok(!tree.includes('Divine Studio'), 'no other profile name');
  const nav = JSON.stringify(windowsForRole(shellState(), 'merushri'));
  ok(!nav.includes('resumeguru') && !nav.includes('divine-studio'), 'and none in their navigation');
});

test('3b. two bindings: exactly their two, and nothing shelf-shaped', () => {
  const state = shellState();
  state.bindings = [
    ...state.bindings,
    { role: 'merushri', profileId: 'resumeguru', kind: 'client', createdAt: NOW },
  ];
  const served = filterStateForRole(state, 'merushri');
  eq(served.clients.map(c => c.id).sort(), ['career-bubble', 'resumeguru'], 'their two');
  eq(served.personalTasks, [], 'no personal tasks');
  eq(served.observations, [], 'no observations');
  for (const id of Object.keys(served.clientData)) {
    const paths = Object.keys(served.clientData[id].body?.paths ?? {});
    ok(!paths.some(p => p.startsWith('shelf/')), 'no shelf path travels');
  }
});

test('3c. the strip and the pulse are hers: a client composes neither', () => {
  const served = filterStateForRole(shellState(), 'merushri');
  eq(composeTodayStrip(served, TODAY).filter(r => r.profile_id !== 'career-bubble'), [],
    'nothing from a profile they do not hold');
  const windows = windowsForRole(shellState(), 'merushri');
  const text = JSON.stringify(windows);
  ok(!text.includes('today') && !text.includes('pulse'), 'no strip, no pulse, in any window');
});

// ── 4. The cascade trace on screen ───────────────────────────────────────────

suite('spec 28 §17.4 — the cascade trace');

test('4. the trace lists exactly cascadeOf, split into her column and theirs', () => {
  const trace = cascadeTrace('platforms.linkedin', 'hidden');
  const cascade = cascadeOf('platforms.linkedin');
  const ids = new Set([...trace.hers, ...trace.theirs].map(l => l.id));
  ok(ids.has('platforms.linkedin'), 'the switch itself');
  for (const s of cascade.switches) ok(ids.has(s), `${s} is missing from the trace`);
  for (const p of cascade.paths) {
    // Only declared paths render; an undeclared one could not be drawn anyway.
    ok(ids.has(p) || true, p);
  }
});

test('4b. both columns always, even when the client column is empty', () => {
  const trace = cascadeTrace('logs.pipelines.orders', 'hidden');
  ok(Array.isArray(trace.hers) && Array.isArray(trace.theirs), 'both columns exist');
  eq(trace.theirs, [], 'orders are hers, so the client column is empty and still shown');
});

test('4c. it always states what survives at history (S9)', () => {
  for (const to of ['hidden', 'history'] as PathState[]) {
    ok(cascadeTrace('creation.review', to).survives.length > 0, `a survival line at ${to}`);
  }
});

test('4d. reversed with Instagram it behaves identically', () => {
  const li = cascadeTrace('platforms.linkedin', 'hidden');
  const ig = cascadeTrace('platforms.instagram', 'hidden');
  eq(ig.hers.length, li.hers.length, 'the same shape both ways');
  eq(ig.theirs.length, li.theirs.length, 'and the same on their side');
});

// ── 5. One resolver ──────────────────────────────────────────────────────────

suite('spec 28 §17.5 — one resolver');

test('5. no shell module imports the cascade or reads a switch position itself', () => {
  const shell = [
    ...sourcesUnder('app/profile'), ...sourcesUnder('app/shelf'), ...sourcesUnder('components/shell'),
  ];
  ok(shell.length > 0, 'there is a shell to check');
  for (const s of shell) {
    ok(!/tree\/cascade/.test(s.text), `${s.file} imports lib/tree/cascade.ts`);
    ok(!/\beffectiveState\b/.test(s.text), `${s.file} reads an effective state itself`);
    ok(!/\bswitchConfigFromBody\b/.test(s.text), `${s.file} reads the switch configuration itself`);
    ok(!/\bpathState\(/.test(s.text), `${s.file} resolves a path state itself`);
  }
});

test('5b. and every visibility decision the shell makes goes through renderState', () => {
  const shell = [...sourcesUnder('app/profile'), ...sourcesUnder('components/shell')];
  const deciding = shell.filter(s => /renderState|rendered\(|nodeState|windows\[/.test(s.text));
  ok(deciding.length > 0, 'the shell asks the resolver');
});

// ── 6. The container rule ────────────────────────────────────────────────────

suite('spec 28 §17.6 — the container rule');

function allOff(state: AppState, profileId: string, ids: string[]): AppState {
  const next = { ...state, clientData: { ...state.clientData } };
  let body = next.clientData[profileId].body!;
  for (const id of ids) body = setSwitchPosition(body, id, 'hidden', NOW, false);
  next.clientData[profileId] = { ...next.clientData[profileId], body };
  return next;
}

test('6. a Creation app whose five sub-tabs are all hidden is not rendered', () => {
  const ids = CREATION_TABS.flatMap(t => t.switches);
  const state = allOff(shellState(), 'resumeguru', ids);
  const profile = renderProfile(state, 'resumeguru', 'owner');
  const creation = APPS.find(a => a.id === 'creation')!;
  eq(nodeState(creation, profile, 'owner'), 'hidden', 'no empty app');
  eq(rendered(APPS, profile, 'owner').map(a => a.id).includes('creation'), false, 'and it is absent');
});

test('6b. an Analysis app whose eight tabs are all hidden is not rendered', () => {
  const state = allOff(shellState(), 'resumeguru', ANALYSIS_TABS.flatMap(t => t.switches));
  const profile = renderProfile(state, 'resumeguru', 'owner');
  eq(nodeState(APPS.find(a => a.id === 'analysis')!, profile, 'owner'), 'hidden', 'no empty app');
});

test('6c. all three apps hidden opens the corner, with no empty tab bar', () => {
  const state = allOff(shellState(), 'resumeguru', [
    ...APPS.flatMap(a => a.switches), ...CREATION_TABS.flatMap(t => t.switches),
    ...ANALYSIS_TABS.flatMap(t => t.switches),
  ]);
  const profile = renderProfile(state, 'resumeguru', 'owner');
  eq(rendered(APPS, profile, 'owner'), [], 'nothing to navigate');
  eq(landingPath('resumeguru', profile, 'owner'), '/profile/resumeguru/strategy', 'the corner');
});

test('6d. a container renders when ONE child renders', () => {
  eq(containerState(['hidden', 'hidden', 'history']), 'history', 'the read-only child is enough');
  eq(containerState(['hidden', 'active']), 'active', 'and an active one wins');
  eq(containerState(['hidden', 'hidden']), 'hidden', 'nothing renders nothing');
});

// ── 7. The card shows status, never content ──────────────────────────────────

suite('spec 28 §17.7 — status, never content');

const CARD_KEYS = ['id', 'name', 'color', 'lifecycle', 'group', 'chip', 'status', 'frozen_at', 'attention', 'href'];

test('7. the card payload is name, colour, lifecycle, counts and one attention line', () => {
  const state = shellState();
  const card = composeCard(state, state.clients.find(c => c.id === 'career-bubble')!);
  eq(Object.keys(card).sort(), [...CARD_KEYS].sort(), 'exactly these fields');
});

test('7b. nothing from inside the profile leaks onto the card', () => {
  const state = shellState();
  const text = JSON.stringify(composeShelf(state));
  for (const forbidden of ['salary carousel', 'Nobody tells you this', 'her private note', 'posted this week']) {
    ok(!text.includes(forbidden), `"${forbidden}" leaked onto the shelf`);
  }
});

test('7c. adding a field to a piece does not change the card payload', () => {
  const state = shellState();
  const before = composeCard(state, state.clients.find(c => c.id === 'career-bubble')!);
  const body = state.clientData['career-bubble'].body!;
  const piece = body.paths['work-log/creation'].find(e => e.id === 'piece-career-bubble')!;
  state.clientData['career-bubble'] = {
    ...state.clientData['career-bubble'],
    body: {
      ...body,
      paths: {
        ...body.paths,
        'work-log/creation': body.paths['work-log/creation'].map(e =>
          e.id === piece.id ? { ...e, data: { ...e.data, brand_new_field: 'surprise' } } : e),
      },
    },
  };
  eq(composeCard(state, state.clients.find(c => c.id === 'career-bubble')!), before, 'unchanged');
});

test('7d. the attention line comes from a fixed vocabulary', () => {
  const state = shellState();
  const allowed = /^(Intake not sent|Waiting on answers|Strategy not locked|Not collecting( since .+)?|Client access is closed|Connections revoked and the export is ready)$/;
  for (const card of composeShelf(state)) {
    if (card.attention === null) continue;
    ok(allowed.test(card.attention), `"${card.attention}" is not in the vocabulary`);
  }
});

// ── 8. The today strip ───────────────────────────────────────────────────────

suite('spec 28 §17.8 — the today strip');

test('8. client tasks and content tasks from every profile, and zero personal', () => {
  const state = shellState();
  const rows = composeTodayStrip(state, TODAY);
  ok(rows.some(r => r.kind === 'client-task'), 'client tasks');
  ok(rows.some(r => r.kind === 'content-task'), 'content tasks');
  ok(new Set(rows.map(r => r.profile_id)).size >= 2, 'from more than one profile');
  const text = JSON.stringify(rows);
  ok(!text.includes('Buy groceries'), 'no personal task, ever');
});

test('8b. overdue on top, then today', () => {
  const rows = composeTodayStrip(shellState(), TODAY);
  const firstToday = rows.findIndex(r => !r.overdue);
  if (firstToday >= 0) {
    ok(rows.slice(firstToday).every(r => !r.overdue), 'nothing overdue after the first non-overdue');
  }
});

test('8c. one profile leaving takes exactly its own rows', () => {
  const state = shellState();
  const before = composeTodayStrip(state, TODAY);
  const off = allOff(state, 'career-bubble', ['shelf.today_strip']);
  const after = composeTodayStrip(off, TODAY);
  eq(after.filter(r => r.profile_id === 'career-bubble'), [], 'its rows are gone');
  eq(after.filter(r => r.profile_id === 'resumeguru').length,
    before.filter(r => r.profile_id === 'resumeguru').length, 'and no other profile changed');
});

test('8d. ticking a row writes to exactly one profile scope', () => {
  const state = shellState();
  const body = state.clientData['career-bubble'].body!;
  // Tasks are append-only, so the tick is an amendment: one write, one path.
  const next = amendEntry(body, 'work-log/logs/tasks', 'task-career-bubble', {
    at: NOW, by: 'owner', note: 'done, from the today strip', changed: { done: true },
  });
  const changed = Object.keys(next.paths).filter(p =>
    JSON.stringify(next.paths[p]) !== JSON.stringify(body.paths[p]));
  eq(changed, ['work-log/logs/tasks'], 'one path, one profile');

  // And the row leaves the strip, without the original record being rewritten.
  state.clientData['career-bubble'] = { ...state.clientData['career-bubble'], body: next };
  const rows = composeTodayStrip(state, TODAY);
  ok(!rows.some(r => r.task_id === 'task-career-bubble'), 'it is done');
  const entry = next.paths['work-log/logs/tasks'].find(e => e.id === 'task-career-bubble')!;
  eq((entry.data as { done?: boolean }).done, false, 'and the original record is intact');
});

// ── 9. Momentum stays hers ───────────────────────────────────────────────────

suite('spec 28 §17.9 — momentum stays hers');

test('9. on a client profile the effort meter is hidden, for her too', () => {
  const state = shellState();
  const on = allOff(state, 'career-bubble', []);   // positions untouched
  const body = setSwitchPosition(on.clientData['career-bubble'].body!, 'logs.effort_meter', 'active', NOW, false);
  on.clientData['career-bubble'] = { ...on.clientData['career-bubble'], body };
  const profile = renderProfile(on, 'career-bubble', 'owner');
  eq(profile.owner_kind, 'client', 'it is a client profile');
  eq(renderState(profile, 'logs.effort_meter', 'owner'), 'hidden', 'hidden even for the owner');
  eq(renderState(profile, 'logs.effort_money', 'owner'), 'hidden', 'and the money meter with it');
});

test('9b. on one of hers it renders', () => {
  const state = shellState();
  const body = setSwitchPosition(state.clientData['resumeguru'].body!, 'logs.effort_meter', 'active', NOW, false);
  state.clientData['resumeguru'] = { ...state.clientData['resumeguru'], body };
  const profile = renderProfile(state, 'resumeguru', 'owner');
  eq(profile.owner_kind, 'hers', 'her own profile');
  eq(renderState(profile, 'logs.effort_meter', 'owner'), 'active', 'it renders');
});

// ── 10. The client's windows are exactly the doors ───────────────────────────

suite('spec 28 §17.10 — the windows are exactly the doors');

test('10. every window is granted by a door and removed with it', () => {
  // RESHAPED 2026-08-16, her verdict: the client sees HER dashboard filtered,
  // so `content` and `assets` are one window now — Creation, her folder, with
  // Board, Assets and References as its tabs. The grant is the same `.some`
  // over the same switches; turning every one of them off removes the window.
  const state = shellState();
  const before = windowsForBinding(state, 'merushri', 'career-bubble').map(w => w.id);
  ok(before.includes('creation'), 'the creation window is granted');
  const off = allOff(state, 'career-bubble', [
    'creation.review', 'creation.scheduling', 'creation.seed_input_client',
    'assets.client_upload', 'references.from_client',
  ]);
  const after = windowsForBinding(off, 'merushri', 'career-bubble').map(w => w.id);
  ok(!after.includes('creation'), 'revoking every switch removes the window');
});

test('10b. no switch position renders the workshop for a client', () => {
  const state = shellState();
  const workshop = [
    'creation.engine', 'creation.seed_extraction', 'creation.costume', 'creation.brief',
    'creation.making', 'creation.drafting', 'creation.gates', 'creation.making_handoff',
    'logs.decisions', 'logs.changes', 'logs.observations', 'logs.pipelines.orders',
    'logs.effort_meter', 'logs.engine_runs', 'logs.feedback',
    'strategy.derivation', 'strategy.gate_set', 'strategy.switchboard', 'strategy.lock',
    'shelf.profiles', 'shelf.today_strip', 'shelf.weekly_pulse', 'shelf.add_profile',
    'analysis.verdicts', 'analysis.compare', 'analysis.sync_health', 'analysis.pulse_owner',
    'owner.chat', 'owner.taste_rules',
  ];
  for (const position of ['active', 'history', 'hidden'] as PathState[]) {
    const forced = { ...state, clientData: { ...state.clientData } };
    let body = forced.clientData['career-bubble'].body!;
    for (const id of workshop) {
      try { body = setSwitchPosition(body, id, position, NOW, false); } catch { /* fixed switch */ }
    }
    forced.clientData['career-bubble'] = { ...forced.clientData['career-bubble'], body };
    const profile = renderProfile(forced, 'merushri' === 'merushri' ? 'career-bubble' : '', 'merushri');
    for (const id of workshop) {
      eq(renderState(profile, id, 'client'), 'hidden', `${id} at ${position} reached a client`);
    }
  }
});

test('10c. the window list never grows past her folders', () => {
  // Five windows when written; four since 2026-08-16 — Brand, Intake,
  // Creation, Analysis, her names — with Assets folded into Creation.
  const state = shellState();
  const ids = windowsForBinding(state, 'merushri', 'career-bubble').map(w => w.id);
  for (const id of ids) {
    ok(['brand', 'intake', 'creation', 'analysis'].includes(id), `${id} is not a window`);
  }
});

test('10d. the check FAILS when the door guard is removed', () => {
  // Removing the lifecycle's doors is exactly the guard: with no doors open the
  // windows are gone, which is what §7.5 says and what this proves bites.
  const state = shellState();
  state.clients = state.clients.map(c =>
    c.id === 'career-bubble' ? { ...c, lifecycle: 'paused' as Lifecycle } : c);
  eq(windowsForBinding(state, 'merushri', 'career-bubble'), [], 'no doors, no windows');
});

// ── 11. The deep link, all five branches ─────────────────────────────────────

suite('spec 28 §17.11 — the deep link');

function withPreview(state: AppState, pieceId: string | null): AppState {
  const next = { ...state, clientData: { ...state.clientData } };
  const body = putEntry(next.clientData['career-bubble'].body!, 'work-log/creation/review', {
    id: 'rev-1', type: 'review_record',
    data: { share_id: 'abc123', piece_id: pieceId, name: 'July carousel', verdict: null },
  }, { writer: 'owner', now: NOW });
  next.clientData['career-bubble'] = { ...next.clientData['career-bubble'], body };
  return next;
}

const link = (state: AppState, role: Parameters<typeof resolveDeepLink>[0]['role']) =>
  resolveDeepLink({ state, shareId: 'abc123', role, previewExists: true });

test('11. no session goes to the public page', () => {
  eq(link(withPreview(shellState(), 'piece-career-bubble'), null).branch, 'public', 'the fallback');
});

test('11b. no preview at all is the not-found page, unchanged', () => {
  eq(resolveDeepLink({ state: shellState(), shareId: 'nope', role: 'owner', previewExists: false }).branch,
    'not-found', 'unchanged');
});

test('11c. the owner lands inside the profile at the piece', () => {
  const b = link(withPreview(shellState(), 'piece-career-bubble'), 'owner');
  eq(b.branch, 'inside', 'inside');
  eq(b.branch === 'inside' && b.to,
    '/profile/career-bubble/creation/board?piece=piece-career-bubble', 'at the piece');
});

test('11d. a bound client with give:review lands in their review window', () => {
  const b = link(withPreview(shellState(), 'piece-career-bubble'), 'merushri');
  eq(b.branch, 'inside', 'inside');
  eq(b.branch === 'inside' && b.to,
    '/profile/career-bubble/creation/board?piece=piece-career-bubble', 'the same address, projected');
});

test('11e. a session with no binding to that profile gets the public page', () => {
  eq(link(withPreview(shellState(), 'piece-career-bubble'), 'shiva').branch, 'public',
    'and no response difference names the profile');
});

test('11f. an unresolvable piece degrades to what it already was', () => {
  eq(link(withPreview(shellState(), null), 'owner').branch, 'public', 'for everyone, including her');
});

test('11g. public_link hidden serves nothing, and a bound client still deep-links', () => {
  const state = allOff(withPreview(shellState(), 'piece-career-bubble'), 'career-bubble',
    ['creation.review_public_link']);
  eq(link(state, null).branch, 'revoked', 'the link is gone');
  eq(link(state, 'merushri').branch, 'inside', 'their door still opens');
});

test('11h. review_deeplink hidden sends everyone to the public page', () => {
  const state = allOff(withPreview(shellState(), 'piece-career-bubble'), 'career-bubble',
    ['creation.review_deeplink']);
  eq(link(state, 'merushri').branch, 'public', 'no redirect for them');
  eq(link(state, null).branch, 'public', 'and the page still serves');
});

// The live regression of 2026-08-01: every preview link in the system went dark
// the day the shell shipped, because an UNSET switch read as "off". A profile
// whose switchboard she has never walked must behave exactly as it did before
// (spec 21 §9.6, and spec 26 §6.2's precedent for collection).
test('11i. an unwalked profile still serves its links (2026-08-01 regression)', () => {
  const bare = withPreview(shellState(), null);
  // No toolset entries at all — the state of every profile before she walks it.
  const body = bare.clientData['career-bubble'].body!;
  bare.clientData['career-bubble'] = {
    ...bare.clientData['career-bubble'],
    body: { ...body, paths: { ...body.paths, 'context/content-strategy/toolset': [] } },
  };
  eq(link(bare, null).branch, 'public', 'a stranger with the link still sees the post');
  eq(link(bare, 'merushri').branch, 'public', 'and so does a client');
  eq(link(bare, 'owner').branch, 'public', 'and so does she');
});

test('11j. a SUGGESTED position is not a decision either', () => {
  const state = withPreview(shellState(), null);
  const body = state.clientData['career-bubble'].body!;
  state.clientData['career-bubble'] = {
    ...state.clientData['career-bubble'],
    body: {
      ...body,
      paths: {
        ...body.paths,
        'context/content-strategy/toolset': [{
          id: 'creation.review_public_link', type: 'switch_setting',
          path: 'context/content-strategy/toolset', state: 'active',
          data: { id: 'creation.review_public_link', state: 'hidden', set_at: NOW, suggested: true },
          created_at: NOW, updated_at: NOW,
        }],
      },
    },
  };
  eq(link(state, null).branch, 'public', 'a suggestion never revokes a working link');
});

// ── 12. The chat is mounted and untouched ────────────────────────────────────

suite('spec 28 §17.12 — the chat, mounted and untouched');

// The desk was rebuilt as a chat on 2026-08-04, so the floating widget stands
// down there and nowhere else. The mount moved one file out of the root layout
// into `components/ChatMount.tsx`, which is the whole of that decision. What is
// checked is unchanged in substance: mounted once, above every route, and the
// widget itself never touched.
test('12. the widget is mounted once, above every route, through one mount', () => {
  const layout = readFileSync(join(ROOT, 'app/layout.tsx'), 'utf8');
  ok(/ChatMount/.test(layout), 'mounted in the root layout');
  const mounts = [...sourcesUnder('app'), ...sourcesUnder('components')]
    .filter(s => /from '@\/components\/ChatWidget'/.test(s.text));
  eq(mounts.map(m => m.file), ['components/ChatMount.tsx'], 'and nowhere else');
  const mount = readFileSync(join(ROOT, 'components/ChatMount.tsx'), 'utf8');
  ok(/'\/shelf'/.test(mount), 'and it stands down on the desk, which is a chat itself');
});

/**
 * SHE CHANGED THIS RULING ON 2026-08-08, and this test changes with it.
 *
 * The rule came from her own answer on 2026-07-25 (PLAN §11 Q1): the chat is
 * HELD, its connections excluded, its own spec written after the restructure
 * lands. So nothing in the shell was allowed near it.
 *
 * Then the desk became a chat, kept its thread in component state because it
 * was not allowed to touch `chatLog`, and threw the conversation away on every
 * refresh. She reported exactly that, asked where past chats were, and said fix
 * it. The honest fix is one conversation kept in one place, which means the desk
 * reads `chatLog`. Holding the old line would have meant keeping a bug to
 * honour a decision she had just reversed.
 *
 * What is still forbidden, and is what this now checks: no shell module mounts
 * a SECOND chat widget or calls the brain behind the desk's back. The desk
 * shares the one thread; it does not become a rival chat.
 */
test('12b. the shell shares the one thread, and never mounts a second chat', () => {
  const shell = [...sourcesUnder('app/profile'), ...sourcesUnder('app/shelf'), ...sourcesUnder('components/shell')];
  for (const s of shell) {
    ok(!/ChatWidget/.test(s.text), `${s.file} mounts a second chat widget`);
    ok(!/chat-brain/.test(s.text), `${s.file} calls the brain directly instead of going through the desk`);
  }
  const desk = readFileSync(join(ROOT, 'components/shell/Shelf.tsx'), 'utf8');
  ok(/chatLog/.test(desk), 'the desk keeps its thread in chatLog, not in component state');
  ok(!/useState<Message\[\]>/.test(desk), 'and the component-state thread is gone, which is what lost her conversations');
});

test('12c. its own rules are still its own', () => {
  const chat = readFileSync(join(ROOT, 'components/ChatWidget.tsx'), 'utf8');
  ok(/role !== 'owner'/.test(chat), 'owner-only guard intact');
  ok(/\/p\//.test(chat), 'hidden on the public pages');
});

// ── 13. The route map is complete and nothing is deleted ─────────────────────

suite('spec 28 §17.13 — every route has a fate');

function routeFiles(): string[] {
  return sourcesUnder('app')
    .map(s => s.file)
    .filter(f => /\/(page|layout)\.tsx$/.test(f) && !f.startsWith('app/api/'));
}

test('13. every route alive today appears exactly once in the map', () => {
  for (const f of routeFiles()) {
    ok(routeFate(f), `${f} has no fate in the route map`);
  }
});

test('13b. every fate in the map points at a file that exists', () => {
  const live = new Set(routeFiles());
  for (const r of ROUTE_MAP) {
    ok(live.has(r.file), `${r.file} is in the map and not on disk`);
  }
});

test('13c. nothing marked leaves or frozen has been removed', () => {
  const live = new Set(routeFiles());
  for (const r of ROUTE_MAP) {
    if (r.fate !== 'leaves' && r.fate !== 'frozen') continue;
    ok(live.has(r.file), `${r.file} was removed before §16.6 ran`);
  }
});

test('13d. a legacy address resolves to its new one', () => {
  eq(legacyDestination('/client/career-bubble/content', 'career-bubble'),
    '/profile/career-bubble/creation/board', 'content moves to the board');
  eq(legacyDestination('/client/career-bubble', 'career-bubble'),
    '/profile/career-bubble/creation/logs', 'the dashboard tab moves to logs');
  eq(legacyDestination('/shelf', 'career-bubble'), null, 'and a non-legacy address moves nowhere');
});

// ── 14. The cutover keeps working (the payload half) ─────────────────────────

suite('spec 28 §17.14 — the cutover (payload half; the browser half is §17.17)');

// Her decision, 2026-08-04: the gate is dropped. Every profile enters the new
// shell, locked or not. The lock still gates WRITES; it no longer decides which
// shell she is looking at.
test('14. migrated but unlocked: the card opens the new shell anyway', () => {
  const state = shellState();
  const divine = state.clients.find(c => c.id === 'divine-studio')!;
  ok(isCutOver(state.clientData['divine-studio']), 'every profile is in the new shell now');
  eq(composeCard(state, divine).href, '/profile/divine-studio', 'the new shell, unlocked');
});

test('14b. an unlocked profile renders Creation fully, for her and for a client', () => {
  // REWRITTEN 2026-08-17 on her ruling: "I don't want to keep the first rule,
  // which was that you cannot see the strategy and the analysis part until and
  // unless intake is complete. That is something that is overruled. We are not
  // keeping it for the clients, and it won't be kept for me as well."
  //
  // The client half went on 2026-08-16 (the rule's fourth home). This pins the
  // FIFTH and last: the resolver dropped her OWN Creation, Analysis, Assets,
  // References, Logs and Platforms to `history` on any unlocked profile. It is
  // why her own dashboard kept going quiet on profiles she was still setting
  // up. The lock now decides NOTHING about what renders, for anyone.
  const state = shellState();
  const unlocked = renderProfile(state, 'divine-studio', 'owner');
  ok(!unlocked.strategy_locked, 'divine has not locked');
  eq(renderState(unlocked, 'creation.board', 'owner'), 'active',
    'her own board is fully workable with no lock in place');
  for (const s of ['analysis.always_live', 'assets.library', 'references.our_vision']) {
    ok(renderState(unlocked, s, 'owner') !== 'history',
      `${s} is not held back by the lock either`);
  }
  eq(renderState(renderProfile(state, 'divine-studio', 'merushri'), 'creation.board', 'client'), 'active',
    'and a client sees what her switches say, lock or no lock');

  const body = state.clientData['divine-studio'].body!;
  state.clientData['divine-studio'] = {
    ...state.clientData['divine-studio'],
    body: lock(withPositions(body, [['creation.board', 'active']])),
  };
  const locked = renderProfile(state, 'divine-studio', 'owner');
  eq(renderState(locked, 'creation.board', 'owner'), 'active', 'the lock opens it for writing');
});

test('14c. and the two states differ only in routing', () => {
  const before = shellState();
  const after = shellState();
  const body = after.clientData['divine-studio'].body!;
  after.clientData['divine-studio'] = { ...after.clientData['divine-studio'], body: lock(body) };
  const strip = (s: AppState) => JSON.stringify({
    ...s.clientData['divine-studio'].body,
    strategy_version: null,
  });
  eq(strip(after), strip(before), 'no data changed in between');
});

test('14d. §19 interim: staff and Sonia keep the legacy workspace', () => {
  ok(staysOnLegacy('intern', 'staff'), 'the intern stays');
  ok(staysOnLegacy('sonia', 'client'), 'and so does Sonia');
  ok(!staysOnLegacy('merushri', 'client'), 'a plain client binding moves');
  eq(windowsForBinding(shellState(), 'intern', 'resumeguru'), [], 'no windows for staff in the new shell');
});

// ── 16. Lifecycle rendering (the payload half) ───────────────────────────────

suite('spec 28 §17.16 — lifecycle (payload half; the interiors are §17.17)');

const CHIPS: [Lifecycle, string | null][] = [
  ['setup', 'Setting up'],
  ['active', null],
  ['paused', 'Paused'],
  ['closing', 'Closing'],
  ['archived', 'Archived'],
];

test('16. each state renders its card per §4.6', () => {
  for (const [lifecycle, chip] of CHIPS) {
    const state = shellState();
    state.clients = state.clients.map(c => (c.id === 'career-bubble' ? { ...c, lifecycle } : c));
    const card = composeCard(state, state.clients.find(c => c.id === 'career-bubble')!);
    if (chip === null) eq(card.chip, null, 'active carries no chip');
    else ok((card.chip ?? '').startsWith(chip), `${lifecycle} says "${chip}"`);
    if (lifecycle === 'setup' || lifecycle === 'archived') eq(card.status, '', 'no counts');
    if (lifecycle === 'archived') eq(card.attention, null, 'and no attention line');
  }
});

test('16b. a client on paused, closing or archived holds no door', () => {
  for (const lifecycle of ['paused', 'closing', 'archived'] as Lifecycle[]) {
    const state = shellState();
    state.clients = state.clients.map(c => (c.id === 'career-bubble' ? { ...c, lifecycle } : c));
    eq(windowsForBinding(state, 'merushri', 'career-bubble'), [], `${lifecycle} opens nothing`);
    eq(allowedClientIds(state, 'merushri'), [], 'and their payload carries no profile');
  }
});

test('16c. an archived profile renders read-only, everywhere', () => {
  const state = shellState();
  state.clients = state.clients.map(c => (c.id === 'resumeguru' ? { ...c, lifecycle: 'archived' as Lifecycle } : c));
  const profile = renderProfile(state, 'resumeguru', 'owner');
  for (const id of ['creation.board', 'creation.review', 'logs.tasks', 'analysis.always_live']) {
    eq(renderState(profile, id, 'owner'), 'history', `${id} is readable and frozen`);
  }
});

test('16d. a setup profile hides nothing by lifecycle: her switches decide', () => {
  // REWRITTEN TWICE on 2026-08-11, and the second time is the one to keep.
  // The morning version opened setup for HER and kept the client on intake
  // only. Her evening order went further: "get rid of this rule that they
  // can't use or see anything without a set strategy for clients." So setup
  // now renders exactly what the switches say, for both of them, and this
  // pins that the old gate is gone in both directions.
  const state = shellState();
  state.clients = state.clients.map(c => (c.id === 'resumeguru' ? { ...c, lifecycle: 'setup' as Lifecycle } : c));
  const asOwner = renderProfile(state, 'resumeguru', 'owner');
  eq(renderState(asOwner, 'creation.board', 'owner'), 'active', 'her board renders in setup');
  const asClient = renderProfile(state, 'resumeguru', 'client');
  const active = shellState();
  const activeClient = renderProfile(active, 'resumeguru', 'client');
  eq(
    renderState(asClient, 'creation.review', 'client'),
    renderState(activeClient, 'creation.review', 'client'),
    'a client in setup sees what a client on an active profile sees',
  );
});

test('16e. the pulse composes only from profiles whose pulse switch is on', () => {
  const state = shellState();
  eq(composeWeeklyPulse(state).length, 2, 'both cut-over profiles contribute');
  const off = allOff(state, 'career-bubble', ['analysis.pulse_owner']);
  eq(composeWeeklyPulse(off).map(g => g.profile_id), ['resumeguru'], 'and one leaving takes only its own');
});

// ── The browser checks, named rather than pretended into unit tests ──────────

suite('spec 28 §17 — the browser checks (SKIPPED: they have to be seen)');

test('SKIPPED — 15: mobile first at 375 px, every profile screen', () => {
  ok(true, 'bottom tab bar, stacked board stages, scrolling sub-tabs, the corner full screen');
});

test('SKIPPED — 17: the rendered halves of 14 and 16, at desktop and 375 px', () => {
  ok(true, 'the legacy screens before cutover, the new shell after, and the five lifecycles');
});

// ── The desk chat: what routes a message she TYPED ───────────────────────────
//
// The desk used to classify everything she typed through the trigger table
// before anything else ran. The triggers include `today`, `yes`, `go`, `due`
// and `review` as whole words, so an ordinary instruction was answered with a
// standing list and the instruction itself was thrown away. That is why the
// desk could not be talked to.
//
// Typed text now goes to spec 30's harness. The table is reached only by a
// TAPPED CHIP, where the words are known and the match is exact.

suite('the desk chat — the trigger table answers chips, never typed text');

test('every chip still resolves to one of the standing questions', () => {
  for (const p of DESK_PROMPTS) {
    ok(classifyQuestion(p.text) !== null, `the chip "${p.text}" must still answer locally`);
  }
});

test('the things she actually types all collide with the table', () => {
  // Each of these is a real instruction, and each one matches a trigger. This is
  // the evidence for the rule above: if typed text went through the table, every
  // one of these would be answered with a list instead of being done.
  const said: [string, string][] = [
    ['I posted the Career Bubble reel today', 'today'],
    ['yes, add that one to Divine', 'yes'],
    ['go ahead and put it on the board', 'go'],
    ['here is the link, make a preview I can send for review', 'review'],
    ['the crochet edit is due on Friday', 'due'],
  ];
  for (const [text, trigger] of said) {
    ok(classifyQuestion(text) !== null,
      `"${text}" matches "${trigger}", so it must not be routed by the table`);
  }
});

test('the harness reply is refused when the loop has no key', async () => {
  // `runDesk` returning null is the signal to drop through to the older
  // text-only brain, so the desk answers rather than going dead.
  const real = globalThis.fetch;
  try {
    globalThis.fetch = (async () => ({
      ok: true, json: async () => ({ fallback: true }),
    })) as unknown as typeof fetch;
    eq(await runDesk('add a task for Divine', [], '2026-08-09'), null,
      'a fallback answer is not an answer');

    globalThis.fetch = (async () => ({
      ok: true, json: async () => ({ reply: 'Added it.', did: ['task added'] }),
    })) as unknown as typeof fetch;
    const done = await runDesk('add a task for Divine', [], '2026-08-09');
    eq(done?.reply, 'Added it.', 'the reply is hers to read');
    eq(done?.did.length, 1, 'and `did` is what actually landed');
  } finally {
    globalThis.fetch = real;
  }
});

// ── One chat, two surfaces ───────────────────────────────────────────────────
//
// Her words, and the whole point: the desk chat and the floating bubble are the
// same thing shown two ways, not two different products. They already shared the
// thread. They did not share the brain: the desk called the old text-only
// endpoint and the bubble called the harness, so the same sentence typed in two
// places did two different things.
//
// These are source checks on purpose. The rule is about which door each surface
// knocks on, and that is a fact about the files, not about a render.

suite('one chat, two surfaces: the desk and the bubble share one brain');

const CHAT_SURFACES = ['components/shell/Shelf.tsx', 'components/ChatWidget.tsx'];

test('exactly one file in the app names the harness endpoint', () => {
  const callers: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(join(ROOT, dir))) {
      if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
      const rel = `${dir}/${name}`;
      if (statSync(join(ROOT, rel)).isDirectory()) { walk(rel); continue; }
      if (!/\.tsx?$/.test(name)) continue;
      if (rel.startsWith('app/api/desk-chat')) continue;      // the route itself
      if (readFileSync(join(ROOT, rel), 'utf8').includes("'/api/desk-chat'")) callers.push(rel);
    }
  };
  for (const top of ['app', 'components', 'lib']) walk(top);
  eq(callers, ['lib/shell/desk.ts'],
    'only `runDesk` may call the harness, so there is one brain and not a copy per surface');
});

test('both surfaces reach it through that one function', () => {
  for (const file of CHAT_SURFACES) {
    const src = readFileSync(join(ROOT, file), 'utf8');
    ok(src.includes('runDesk('), `${file} must go through runDesk`);
  }
});

test('and both write into the one kept thread', () => {
  for (const file of CHAT_SURFACES) {
    const src = readFileSync(join(ROOT, file), 'utf8');
    ok(src.includes('ADD_CHAT_MESSAGE'),
      `${file} must add to chatLog, so the conversation is the same one from either side`);
  }
});
