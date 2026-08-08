// Spec 30 §3.1 — the desk chat's READ tools, tested.
//
// Two things are being proved here, and they are the spec's two laws.
//
//  LAW ONE, nothing without an address. A folder that is switched off is
//  refused by name, not read around, and a profile that was never migrated says
//  so instead of returning a board of zeros. §6.4's refusal test, read half.
//
//  LAW TWO, every number computed. §6.2's arithmetic test. Each count is
//  re-derived here from the raw array it describes, and the tools' answer must
//  equal it. Where the desk already owns a counter — `stageCounts`, `pieceClock`,
//  `composeTodayStrip`, the five `answer*` functions — the tools' answer is
//  pinned to it, so no second counter can drift into existence.

import { suite, test, ok, eq } from './harness.ts';
import { fixtureState } from './fixtures.ts';
import { normalizeState } from '../lib/access.ts';
import { migrateProfile } from '../lib/tree/migrate.ts';
import { amendEntry, putEntry } from '../lib/tree/body.ts';
import type { ProfileBody } from '../lib/tree/body.ts';
import type { PathState } from '../lib/tree/contract.ts';
import { setSwitchPosition } from '../lib/strategy/derivation.ts';
import { pieceClock, stageCounts, composeTodayStrip } from '../lib/shell/shelf.ts';
import {
  answerLocks, answerQuiet, answerReview, answerToday, answerWeek,
} from '../lib/shell/desk.ts';
import {
  acrossProfiles, findPieces, findProfile, findSeeds, findTasks, profileStatus,
} from '../lib/desk/read.ts';
import { cadenceTarget, pillarDefs, postedPieces } from '../lib/desk/status.ts';
import type { AppState } from '../types/index.ts';

const NOW = '2026-07-25T12:00:00.000Z';
const TODAY = '2026-07-27';

// ── The fixture ──────────────────────────────────────────────────────────────

const POSITIONS: [string, PathState][] = [
  ['creation.board', 'active'],
  ['creation.engine', 'active'],
  ['creation.review', 'active'],
  ['creation.scheduling', 'active'],
  ['logs.tasks', 'active'],
  ['shelf.today_strip', 'active'],
  ['analysis.pulse_owner', 'active'],
];

function withPositions(body: ProfileBody, positions = POSITIONS): ProfileBody {
  let next = body;
  for (const [id, state] of positions) next = setSwitchPosition(next, id, state, NOW, false);
  return next;
}

function piece(
  body: ProfileBody, id: string,
  d: { stage: string; date?: string; pillar?: string; platform?: string; format?: string; title?: string },
): ProfileBody {
  return putEntry(body, 'work-log/creation', {
    id, type: 'piece',
    data: {
      title: d.title ?? id,
      hook: '',
      stage: d.stage,
      seed_id: null,
      scheduled_date: d.date ?? null,
      live_link: null,
      costume: {
        pillar_id: d.pillar ?? null,
        platform: d.platform ?? 'Instagram',
        format: d.format ?? 'Carousel',
      },
    },
  }, { writer: 'owner', now: NOW });
}

function task(
  body: ProfileBody, id: string,
  d: { text: string; due?: string; done?: boolean; piece_id?: string },
): ProfileBody {
  return putEntry(body, 'work-log/logs/tasks', {
    id, type: 'task',
    data: { text: d.text, due_date: d.due ?? null, done: d.done ?? false, piece_id: d.piece_id ?? null },
  }, { writer: 'owner', now: NOW });
}

/**
 * ResumeGuru: migrated, locked, and loaded with a month that has real shape —
 * three posted in July, one in June, one posted with no date at all, plus a
 * fourth pillar she never gave a job or a mix target. Divine: migrated and
 * UNLOCKED. Career Bubble: migrated, empty, and with `postTarget: 0` so "not
 * set" has somewhere to be tested. Fresh Co: never migrated at all.
 */
function deskState(): AppState {
  const state = normalizeState(fixtureState());

  for (const id of ['resumeguru', 'divine-studio', 'career-bubble']) {
    const client = state.clients.find(c => c.id === id)!;
    const migrated = migrateProfile(client, state.clientData[id], { now: NOW, observations: state.observations });
    state.clientData[id].body = withPositions(migrated.body);
  }

  let rg = state.clientData['resumeguru'].body!;
  rg = { ...rg, strategy_version: 1 };
  rg = piece(rg, 'piece-jul-a', { stage: 'posted', date: '2026-07-02', pillar: 'p-ai', format: 'Reel' });
  rg = piece(rg, 'piece-jul-b', { stage: 'posted', date: '2026-07-15', pillar: 'p-ai', format: 'Static' });
  rg = piece(rg, 'piece-jun-a', { stage: 'posted', date: '2026-06-20', pillar: 'p-trust' });
  rg = piece(rg, 'piece-nodate', { stage: 'posted', pillar: 'p-trust' });
  // A pillar with no job and no mix target: two "not set" answers in one row.
  rg = putEntry(rg, 'context/content-strategy/pillars/extra', {
    id: 'p-extra', type: 'pillar',
    data: { name: 'Behind the scenes', color: '#888', legacy_id: 'p-extra' },
  }, { writer: 'owner', now: NOW });
  rg = task(rg, 'task-late', { text: 'Send the July recap', due: '2026-07-20' });
  rg = task(rg, 'task-now', { text: 'Approve the reel', due: TODAY, piece_id: 'piece-jul-b' });
  rg = task(rg, 'task-soon', { text: 'Book the shoot', due: '2026-07-30' });
  rg = task(rg, 'task-far', { text: 'Plan September', due: '2026-09-01' });
  rg = task(rg, 'task-nodate', { text: 'Think about the pricing page' });
  rg = task(rg, 'task-ticked', { text: 'Write the caption', due: '2026-07-10' });
  rg = amendEntry(rg, 'work-log/logs/tasks', 'task-ticked', {
    at: NOW, by: 'owner', note: 'done', changed: { done: true },
  });
  state.clientData['resumeguru'].body = rg;

  // Career Bubble: nothing on its board, and no target ever set.
  state.clientData['career-bubble'].postTarget = 0;

  state.clients.push({
    id: 'fresh', name: 'Fresh Co', color: '#111111', createdAt: '2026-07-01T10:00:00.000Z',
  });

  return state;
}

/** Career Bubble with its board switched off, for the refusal tests. */
function boardOff(state: AppState): AppState {
  const next = { ...state, clientData: { ...state.clientData } };
  const data = { ...next.clientData['career-bubble'] };
  data.body = setSwitchPosition(data.body!, 'creation.board', 'hidden', NOW, false);
  next.clientData['career-bubble'] = data;
  return next;
}

function must<T extends { ok: boolean }>(v: T, what: string): Extract<T, { ok: true }> {
  if (!v.ok) throw new Error(`${what}\n    it refused: ${JSON.stringify(v)}`);
  return v as Extract<T, { ok: true }>;
}

// ── find_profile ─────────────────────────────────────────────────────────────

suite('spec 30 §3.1 — find_profile: one id, or the question back');

test('an exact name resolves, whatever the spacing and case', () => {
  const s = deskState();
  const r = findProfile(s, '  DIVINE   studio ');
  eq(r.ok && r.profile.id, 'divine-studio', 'the exact name resolved');
  eq(r.ok && r.match, 'exact', 'and it says how it matched');
});

test('the profile id resolves too', () => {
  const r = findProfile(deskState(), 'career-bubble');
  eq(r.ok && r.profile.id, 'career-bubble', 'the id resolved');
});

test('a prefix resolves when exactly one profile starts with it', () => {
  const r = findProfile(deskState(), 'resume');
  eq(r.ok && r.profile.id, 'resumeguru', 'one prefix hit is an answer');
  eq(r.ok && r.match, 'prefix', 'and it says it was a prefix');
});

test('two matches NEVER pick one: ambiguity is the answer', () => {
  const s = deskState();
  s.clients.push({ id: 'cb-media', name: 'Career Bubble Media', color: '#222', createdAt: NOW });
  const r = findProfile(s, 'career');
  eq(r.ok, false, 'it refused to choose');
  eq(!r.ok && r.reason, 'ambiguous', 'and named the reason');
  eq(!r.ok && r.reason === 'ambiguous' && r.candidates.map(c => c.id).sort(),
    ['career-bubble', 'cb-media'], 'both candidates come back for her to pick');
});

test('an exact name still wins over a longer name that contains it', () => {
  const s = deskState();
  s.clients.push({ id: 'cb-media', name: 'Career Bubble Media', color: '#222', createdAt: NOW });
  const r = findProfile(s, 'Career Bubble');
  eq(r.ok && r.profile.id, 'career-bubble', 'the exact tier decides before the prefix tier');
});

test('no match returns what IS known, and no profile', () => {
  const r = findProfile(deskState(), 'Acme Yoga');
  eq(!r.ok && r.reason, 'no-match', 'it said no match');
  ok(!r.ok && r.reason === 'no-match' && r.known.length === 4, 'and listed the profiles it does have');
});

test('an empty name is not a guess when there is more than one profile', () => {
  const r = findProfile(deskState(), '');
  eq(r.ok, false, 'nothing typed, nothing picked');
});

// ── profile_status: the arithmetic ───────────────────────────────────────────

suite('spec 30 §6.2 — profile_status: every number computed, none worded');

test('the board counts equal the arrays they describe', () => {
  const s = deskState();
  const r = must(profileStatus(s, 'resumeguru', TODAY), 'status');

  // Re-derived here from the raw entries, not from the tool.
  const raw = s.clientData['resumeguru'].body!.paths['work-log/creation'];
  const by = (stage: string) => raw.filter(e => (e.data as { stage?: string }).stage === stage).length;

  eq(r.counts.posted_all_time, by('posted'), 'posted all time');
  eq(r.counts.ideas, by('idea'), 'ideas waiting');
  eq(r.counts.approved, by('approved'), 'approved');
  eq(r.counts.scheduled, by('scheduled'), 'scheduled');
  eq(r.counts.review, by('review'), 'in review');
  eq(r.counts.build, by('build'), 'in build');
  eq(r.counts.on_board, raw.length, 'the whole board');
  eq(r.counts.posted_all_time, 5, 'five posted, counted');
  eq(r.counts.ideas, 1, 'one idea waiting');
});

test('the tool never counts a second time: it agrees with stageCounts', () => {
  const s = deskState();
  const r = must(profileStatus(s, 'resumeguru', TODAY), 'status');
  const desk = stageCounts(s.clientData['resumeguru'], null);
  eq(r.counts.posted_all_time, desk.posted ?? 0, 'posted matches the desk counter');
  eq(r.counts.review, desk.review ?? 0, 'review matches the desk counter');
  eq(r.counts.ideas, desk.idea ?? 0, 'ideas match the desk counter');
  eq(postedPieces(s.clientData['resumeguru'], null).length, desk.posted ?? 0,
    'the posted walk and the desk counter cannot disagree');
});

test('posted THIS MONTH is a real month window, not the whole board', () => {
  const s = deskState();
  const july = must(profileStatus(s, 'resumeguru', TODAY), 'july');
  eq(july.month, '2026-07', 'the window is named');
  eq(july.counts.posted_this_month, 3, 'three posted in July');
  eq(july.counts.posted_undated, 1, 'and one posted with no date, said out loud');

  const june = must(profileStatus(s, 'resumeguru', '2026-06'), 'june');
  eq(june.counts.posted_this_month, 1, 'one posted in June');
  eq(june.counts.posted_all_time, 5, 'the board count does not move with the window');
});

test('the last thing posted, and when, agree with pieceClock', () => {
  const s = deskState();
  const r = must(profileStatus(s, 'resumeguru', TODAY), 'status');
  eq(r.last_posted?.piece_id, 'piece-jul-b', 'the latest dated posted piece');
  eq(r.last_posted?.date, pieceClock(s.clientData['resumeguru'], TODAY, null).last_posted,
    'and the date is the desk clock’s own answer');
  eq(r.last_posted?.days_ago, 12, 'twelve days ago, computed');
});

test('the cadence target and what remains are both computed', () => {
  const r = must(profileStatus(deskState(), 'resumeguru', TODAY), 'status');
  eq(r.cadence.target, 12, 'twelve a month');
  eq(r.cadence.source, 'strategy', 'read from the tree, not the legacy slice');
  eq(r.cadence.posted, 3, 'three posted');
  eq(r.cadence.remaining, 9, 'nine left — the model is never asked to subtract');
  eq(r.cadence.over_by, 0, 'and nothing over');
  eq(r.cadence.not_set, false, 'a target exists');
});

test('NOT SET and ZERO are different answers', () => {
  const r = must(profileStatus(deskState(), 'career-bubble', TODAY), 'status');
  eq(r.cadence.target, null, 'no target, and null says so');
  eq(r.cadence.not_set, true, 'named plainly');
  eq(r.cadence.remaining, null, 'nothing can be "left" against a target that does not exist');
  eq(r.cadence.source, 'none', 'and it says where it looked');
  eq(r.counts.posted_this_month, 0, 'zero posted IS a zero, and stays one');
});

test('postTarget 0 is read as not set, and a tree cadence of 0 as a set zero', () => {
  const s = deskState();
  eq(cadenceTarget(s.clientData['career-bubble']), { target: null, source: 'none' },
    'the old zero was never a target');
  const cb = { ...s.clientData['career-bubble'] };
  cb.body = putEntry(cb.body!, 'context/content-strategy/cadence', {
    id: 'cadence-paused', type: 'strategy_parameter', data: { posts_per_month: 0 },
  }, { writer: 'owner', now: NOW });
  eq(cadenceTarget(cb), { target: 0, source: 'strategy' }, 'a declared zero is a decision');
});

test('the pillar mix: name, job, target, actual share, gap — all computed', () => {
  const r = must(profileStatus(deskState(), 'resumeguru', TODAY), 'status');
  eq(r.pillars.declared, 4, 'four pillars declared');
  eq(r.pillars.counted, 3, 'three posted pieces carry a pillar');
  eq(r.pillars.unassigned, 0, 'none posted without one');
  eq(r.pillars.no_basis, false, 'there is something to share out');

  const byId = new Map(r.pillars.shares.map(s => [s.pillar_id, s]));
  const ai = byId.get('p-ai')!;
  eq([ai.name, ai.job, ai.target_pct, ai.posted, ai.actual_pct, ai.gap_pct],
    ['AI for job hunting', 'reach', 40, 2, 67, 27], 'the reach pillar, whole');
  const trust = byId.get('p-trust')!;
  eq([trust.job, trust.target_pct, trust.posted, trust.actual_pct, trust.gap_pct],
    ['trust', 35, 1, 33, -2], 'the trust pillar, whole');
  const convert = byId.get('p-convert')!;
  eq([convert.posted, convert.actual_pct, convert.gap_pct], [0, 0, -25],
    'a pillar with nothing posted is a real zero when there IS a basis');
});

test('a pillar with no job and no target says null, never zero', () => {
  const r = must(profileStatus(deskState(), 'resumeguru', TODAY), 'status');
  const extra = r.pillars.shares.find(s => s.pillar_id === 'p-extra')!;
  eq(extra.job, null, 'she has not given it a job');
  eq(extra.target_pct, null, 'and no mix target');
  eq(extra.posted, 0, 'nothing posted in it');
  eq(extra.gap_pct, null, 'so there is no gap to state');
});

test('with nothing posted, a share is null and not a zero percent', () => {
  const r = must(profileStatus(deskState(), 'resumeguru', '2026-01'), 'january');
  eq(r.pillars.no_basis, true, 'no basis for a mix');
  eq(r.pillars.counted, 0, 'nothing counted');
  for (const s of r.pillars.shares) {
    eq(s.actual_pct, null, `${s.name}: no share to state`);
    eq(s.gap_pct, null, `${s.name}: and no gap`);
  }
});

test('whether strategy is locked is reported, per profile', () => {
  const s = deskState();
  eq(must(profileStatus(s, 'resumeguru', TODAY), 'rg').strategy_locked, true, 'ResumeGuru is locked');
  eq(must(profileStatus(s, 'divine-studio', TODAY), 'dv').strategy_locked, false, 'Divine is not');
});

test('a profile with no body says so, instead of a board of zeros', () => {
  const r = must(profileStatus(deskState(), 'fresh', TODAY), 'fresh');
  eq(r.has_body, false, 'never migrated, and it says so');
  eq(r.counts.on_board, 0, 'nothing countable');
  eq(r.cadence.not_set, true, 'and no target either');
  eq(r.profile.name, 'Fresh Co', 'the name still comes back');
});

test('a date that is not a date is refused, not guessed', () => {
  const r = profileStatus(deskState(), 'resumeguru', 'yesterday');
  eq(r.ok, false, 'refused');
  eq(!r.ok && r.reason, 'bad-filter', 'and named the field');
  eq(!r.ok && r.field, 'today', 'which field');
});

test('pillarDefs reads the pillar folders and their parameters', () => {
  const defs = pillarDefs(deskState().clientData['resumeguru'].body!);
  eq(defs.length, 4, 'four pillars');
  eq(defs.filter(d => d.job !== null).length, 3, 'three have a job');
  eq(defs.filter(d => d.target_pct !== null).length, 3, 'three have a mix target');
});

// ── find_pieces ──────────────────────────────────────────────────────────────

suite('spec 30 §3.1 — find_pieces: filtered, and counted by code');

test('by stage', () => {
  const r = must(findPieces(deskState(), 'resumeguru', { stage: 'posted' }), 'posted');
  eq(r.count, 5, 'five posted');
  eq(r.pieces.length, 5, 'and five rows');
  eq(r.total_on_board, 7, 'out of seven on the board');
  ok(r.pieces.every(p => p.stage === 'posted'), 'nothing else came back');
});

test('by several stages at once', () => {
  const r = must(findPieces(deskState(), 'resumeguru', { stage: ['idea', 'approved'] }), 'stages');
  eq(r.count, 2, 'one idea and one approved');
});

test('by pillar, platform and format', () => {
  const s = deskState();
  eq(must(findPieces(s, 'resumeguru', { pillar_id: 'p-ai' }), 'pillar').count, 3, 'three in the AI pillar');
  eq(must(findPieces(s, 'resumeguru', { platform: 'linkedin' }), 'platform').count, 1,
    'platform matching is not case sensitive');
  eq(must(findPieces(s, 'resumeguru', { format: 'Reel' }), 'format').count, 2, 'two reels');
});

test('by month, and by a date range', () => {
  const s = deskState();
  eq(must(findPieces(s, 'resumeguru', { month: '2026-07' }), 'month').count, 3,
    'three pieces carry a July date');
  eq(must(findPieces(s, 'resumeguru', { from: '2026-07-01', to: '2026-07-10' }), 'range').count, 2,
    'two inside the range');
  eq(must(findPieces(s, 'resumeguru', { undated: true }), 'undated').count, 3,
    'three carry no date at all');
});

test('the count is the whole count even when the rows are capped', () => {
  const r = must(findPieces(deskState(), 'resumeguru', { limit: 2 }), 'capped');
  eq(r.count, 7, 'seven matched');
  eq(r.pieces.length, 2, 'two rows came back');
  eq(r.truncated, true, 'and it says the list was cut');
});

test('a month that is not a month is refused', () => {
  const r = findPieces(deskState(), 'resumeguru', { month: 'July' });
  eq(!r.ok && r.reason, 'bad-filter', 'refused');
  eq(!r.ok && r.field, 'month', 'and named the field');
});

test('a switched-off board is refused by name, never read around', () => {
  const r = findPieces(boardOff(deskState()), 'career-bubble', {});
  eq(!r.ok && r.reason, 'switched-off', 'the door is shut');
  eq(!r.ok && r.switch_id, 'creation.board', 'and the switch is named');
  eq(!r.ok && r.path, 'work-log/creation', 'with the path it wanted');
});

test('a profile that was never migrated is refused, not answered with zeros', () => {
  const r = findPieces(deskState(), 'fresh', {});
  eq(!r.ok && r.reason, 'no-body', 'no addresses, no read');
});

test('a profile that does not exist is refused', () => {
  const r = findPieces(deskState(), 'not-a-profile', {});
  eq(!r.ok && r.reason, 'no-such-profile', 'refused');
});

// ── find_tasks ───────────────────────────────────────────────────────────────

suite('spec 30 §3.1 — find_tasks: overdue kept apart from due today');

test('overdue and due today are separate lists with separate counts', () => {
  const r = must(findTasks(deskState(), 'resumeguru', { today: TODAY }), 'due');
  eq(r.counts.overdue, 1, 'one has slipped');
  eq(r.counts.due_today, 1, 'one is today');
  eq(r.overdue[0].id, 'task-late', 'the late one');
  eq(r.overdue[0].days_late, 7, 'seven days late, computed');
  eq(r.due_today[0].id, 'task-now', 'the one due today');
  eq(r.due_today[0].days_late, null, 'today is not late');
});

test('a content task is marked as one, because it points at a piece', () => {
  const r = must(findTasks(deskState(), 'resumeguru', { today: TODAY }), 'due');
  eq(r.due_today[0].kind, 'content-task', 'it carries a piece id');
  eq(r.overdue[0].kind, 'client-task', 'this one does not');
});

test('a tick is an amendment, and an amended task is not open', () => {
  const s = deskState();
  const open = must(findTasks(s, 'resumeguru', { today: TODAY, scope: 'open' }), 'open');
  const ids = [...open.overdue, ...open.due_today, ...open.later, ...open.undated].map(t => t.id);
  ok(!ids.includes('task-ticked'), 'the ticked task is not in the open lists');
  const all = must(findTasks(s, 'resumeguru', { today: TODAY, scope: 'all' }), 'all');
  eq(all.done.map(t => t.id).includes('task-ticked'), true, 'it is in the done list instead');
});

test('the scopes reach exactly as far as they say', () => {
  const s = deskState();
  const due = must(findTasks(s, 'resumeguru', { today: TODAY, scope: 'due' }), 'due');
  eq([due.counts.later, due.counts.undated], [0, 0], 'due reaches no further than today');
  const week = must(findTasks(s, 'resumeguru', { today: TODAY, scope: 'week' }), 'week');
  eq(week.counts.later, 1, 'the 30 July one is inside the week');
  const open = must(findTasks(s, 'resumeguru', { today: TODAY, scope: 'open' }), 'open');
  eq(open.counts.later, 2, 'September comes in too');
  eq(open.counts.undated, 1, 'and the one with no date, kept separate');
});

test('across all profiles it skips what it cannot see, and names it', () => {
  const r = must(findTasks(boardOff(deskState()), null, { today: TODAY }), 'across');
  eq(r.profile_id, null, 'the question was across all of them');
  ok(r.skipped.some(s => s.profile_id === 'fresh' && s.reason === 'no-body'),
    'the unmigrated profile is named, not silently dropped');
  ok(r.counts.overdue + r.counts.due_today > 0, 'and the rest still answered');
});

test('asked about ONE profile whose tasks are off, it refuses', () => {
  const s = deskState();
  const data = { ...s.clientData['career-bubble'] };
  data.body = setSwitchPosition(data.body!, 'logs.tasks', 'hidden', NOW, false);
  s.clientData['career-bubble'] = data;
  const r = findTasks(s, 'career-bubble', { today: TODAY });
  eq(!r.ok && r.reason, 'switched-off', 'refused');
  eq(!r.ok && r.switch_id, 'logs.tasks', 'and the switch is named');
});

test('the task walk cannot disagree with the desk’s own today strip', () => {
  const s = deskState();
  const mine = must(findTasks(s, null, { today: TODAY }), 'across');
  const strip = composeTodayStrip(s, TODAY);
  eq([...mine.overdue, ...mine.due_today].map(t => t.id).sort(),
    strip.map(r => r.task_id).sort(),
    'the same tasks, the same day, one answer');
  eq(mine.overdue.map(t => t.id).sort(),
    strip.filter(r => r.overdue).map(r => r.task_id).sort(),
    'and the same ones are late');
});

// ── find_seeds ───────────────────────────────────────────────────────────────

suite('spec 30 §3.1 — find_seeds: the bank, with its status');

test('the whole bank is counted by status, whatever the filter asks for', () => {
  const r = must(findSeeds(deskState(), 'resumeguru'), 'seeds');
  eq(r.total, 3, 'three in the bank');
  eq(r.by_status.draft, 3, 'all three are drafts');
  eq(r.by_status.locked, 0, 'and none locked');
  eq(r.count, r.seeds.length, 'the count is the rows');
});

test('a migrated subject is marked as having no raw thought (S24)', () => {
  const r = must(findSeeds(deskState(), 'resumeguru'), 'seeds');
  eq(r.without_raw_thought, 3, 'they are subjects, not seeds, and it says so');
  ok(r.seeds.every(s => s.has_raw_thought === false), 'per row as well');
});

test('the status filter narrows the rows but not the tally', () => {
  const r = must(findSeeds(deskState(), 'resumeguru', 'locked'), 'locked');
  eq(r.count, 0, 'nothing locked');
  eq(r.total, 3, 'the bank is still three');
  eq(r.status, 'locked', 'and it says what it filtered by');
});

test('a status that is not a status is refused', () => {
  const r = findSeeds(deskState(), 'resumeguru', 'nearly' as never);
  eq(!r.ok && r.reason, 'bad-filter', 'refused');
});

test('the seed bank switched off is refused by name', () => {
  const s = deskState();
  const data = { ...s.clientData['resumeguru'] };
  data.body = setSwitchPosition(data.body!, 'creation.engine', 'hidden', NOW, false);
  s.clientData['resumeguru'] = data;
  const r = findSeeds(s, 'resumeguru');
  eq(!r.ok && r.reason, 'switched-off', 'refused');
  eq(!r.ok && r.switch_id, 'creation.engine', 'and the switch is named');
});

// ── across_profiles ──────────────────────────────────────────────────────────

suite('spec 30 §3.1 — across_profiles: the desk’s five, called not rebuilt');

test('every standing answer is the desk’s own, counted once', () => {
  const s = deskState();
  const r = must(acrossProfiles(s, TODAY), 'across');
  eq(r.answers.today.count, answerToday(s, TODAY).rows.length, 'today');
  eq(r.answers.review.count, answerReview(s).rows.length, 'review');
  eq(r.answers.locks.count, answerLocks(s).rows.length, 'locks');
  eq(r.answers.quiet.count, answerQuiet(s).rows.length, 'quiet');
  eq(r.answers.week.count, answerWeek(s).rows.length, 'week');
});

test('the flagged count and the flag word both come from the desk', () => {
  const s = deskState();
  const r = must(acrossProfiles(s, TODAY), 'across');
  const desk = answerToday(s, TODAY);
  eq(r.answers.today.flagged, desk.rows.filter(x => x.late).length, 'how many slipped');
  eq(r.answers.today.flag, desk.flag, 'and what a flagged row IS');
  eq(r.answers.locks.flag, 'not locked', 'the locks answer names its own flag');
});

test('the rows are the desk’s rows, unchanged', () => {
  const s = deskState();
  const r = must(acrossProfiles(s, TODAY), 'across');
  eq(r.answers.review.rows, answerReview(s).rows, 'no second composition');
});

test('the desk’s composed SENTENCE is not passed on: wording is the model’s job', () => {
  const r = must(acrossProfiles(deskState(), TODAY), 'across');
  const json = JSON.stringify(r.answers.today);
  ok(!json.includes('"text"'), 'no headline travels with the numbers');
  ok(!json.includes('"note"'), 'and no note either');
});

test('a bad date is refused here too', () => {
  const r = acrossProfiles(deskState(), '2026-07');
  eq(!r.ok && r.reason, 'bad-filter', 'a month is not a day');
});

// ── Law two, stated as its own test ──────────────────────────────────────────

suite('spec 30 §6.2 — the arithmetic test');

test('every remainder in the payload is already final', () => {
  const r = must(profileStatus(deskState(), 'resumeguru', TODAY), 'status');
  // The model is handed target, posted AND remaining. It never subtracts.
  ok(r.cadence.target !== null, 'the target is there');
  eq(r.cadence.remaining, r.cadence.target! - r.cadence.posted, 'and so is the answer');
  for (const s of r.pillars.shares) {
    if (s.actual_pct === null || s.target_pct === null) { eq(s.gap_pct, null, 'no gap to state'); continue; }
    eq(s.gap_pct, s.actual_pct - s.target_pct, `${s.name}: the gap is computed, not implied`);
  }
});

test('no read result carries an English sentence of its own', () => {
  const s = deskState();
  const payloads: unknown[] = [
    findProfile(s, 'resume'),
    profileStatus(s, 'resumeguru', TODAY),
    findPieces(s, 'resumeguru', {}),
    findSeeds(s, 'resumeguru'),
    findTasks(s, 'resumeguru', { today: TODAY }),
  ];
  // A sentence is what this half must never write. The only long strings that
  // may travel are HER OWN words — a piece title, a task, a seed name — and
  // those are content, carried on named fields, not prose the tool composed.
  const HER_FIELDS = new Set([
    'title', 'hook', 'text', 'name', 'live_link', 'href', 'typed', 'id',
    'pillar_name', 'profile_name',
  ]);
  const walk = (v: unknown, key: string): void => {
    if (typeof v === 'string') {
      if (HER_FIELDS.has(key)) return;
      ok(!/[a-z] [a-z]+ [a-z]/.test(v), `a composed sentence escaped at "${key}": ${v}`);
      return;
    }
    if (Array.isArray(v)) { v.forEach(x => walk(x, key)); return; }
    if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) walk(x, k);
    }
  };
  payloads.forEach(p => walk(p, 'root'));
});
