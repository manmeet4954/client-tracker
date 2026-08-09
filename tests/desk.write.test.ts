// Spec 30 §3.2 and §3.3 — the desk chat's WRITE tools.
//
// The four acceptance tests this half owns, and every one of them is here:
//
//   §6.1 the placement test — the thing lands at its declared address, and a
//        request with no address is refused rather than filed somewhere plausible
//   §6.4 the refusal test  — an unlocked profile, a switched-off feature and an
//        ambiguous name each refuse plainly, with NO partial write
//   §6.5 the one-truth test — a preview made by the chat is attached to its
//        piece, and no flow makes a second copy of a piece
//   §6.7 the honesty test  — a Canva link with no OAuth app explains that, and
//        does not silently produce an empty preview
//
// Runs on plain Node. No fetch, no clock, no randomness: `now` and the id maker
// are injected everywhere.

import { suite, test, ok, eq } from './harness.ts';
import { fixtureState } from './fixtures.ts';
import { normalizeState } from '../lib/access.ts';
import { migrateProfile } from '../lib/tree/migrate.ts';
import { putEntry } from '../lib/tree/body.ts';
import type { ProfileBody } from '../lib/tree/body.ts';
import type { PathState } from '../lib/tree/contract.ts';
import { setSwitchPosition } from '../lib/strategy/derivation.ts';
import { applyScopes, checkScopes, parseScope, scopeKey } from '../lib/tree/scopes.ts';
import { resolvePiece } from '../lib/engine/resolve.ts';
import { foldEntry } from '../lib/creation/logs.ts';
import { stageCounts } from '../lib/shell/shelf.ts';
import type { AppState } from '../types/index.ts';
import type { IdSource, WriteContext } from '../lib/desk/write.ts';
import {
  addNote, addPiece, addSeedCapture, addTask, movePiece, normalizeStage,
  resolveProfile, schedulePiece, setLifecycle, updateTask, writerFor,
  PROFILES_SCOPE,
} from '../lib/desk/write.ts';
import {
  CANVA_NOT_CONNECTED, classifyLink, makePreview,
} from '../lib/desk/preview.ts';

const NOW = '2026-08-05T09:00:00.000Z';
const TODAY = '2026-08-05';

// ── The fixture ──────────────────────────────────────────────────────────────

const POSITIONS: [string, PathState][] = [
  ['creation.board', 'active'],
  ['creation.engine', 'active'],
  ['creation.review', 'active'],
  ['creation.scheduling', 'active'],
  ['logs.tasks', 'active'],
  ['logs.observations', 'active'],
];

function withPositions(body: ProfileBody, positions: [string, PathState][]): ProfileBody {
  let next = body;
  for (const [id, state] of positions) next = setSwitchPosition(next, id, state, NOW, false);
  return next;
}

/** One task, one piece, one locked seed and one draft seed, at their addresses. */
function withWork(body: ProfileBody): ProfileBody {
  let next = putEntry(body, 'work-log/logs/tasks', {
    id: 'task-brief', type: 'task',
    data: { text: 'Send the brief', due_date: '2026-08-04', done: false, month: '2026-08' },
  }, { writer: 'owner', now: NOW });
  next = putEntry(next, 'work-log/creation', {
    id: 'piece-salary', type: 'piece',
    data: {
      seed_id: null, title: 'The salary carousel', hook: 'Nobody tells you this',
      stage: 'review', costume: { pillar_id: 'p-trust', platform: 'Instagram', format: 'Carousel' },
      birth: null, scheduled_date: '', live_link: '', created_month: '2026-08',
    },
  }, { writer: 'owner', now: NOW });
  next = putEntry(next, 'work-log/creation/topics', {
    id: 'seed-locked', type: 'seed',
    data: {
      name: 'The salary question', raw_thought: 'nobody answers it honestly',
      raw_material: [], status: 'locked',
    },
  }, { writer: 'owner', now: NOW });
  next = putEntry(next, 'work-log/creation/topics', {
    id: 'seed-draft', type: 'seed',
    data: { name: 'ATS myths', raw_thought: 'the robot story', raw_material: [], status: 'draft' },
  }, { writer: 'owner', now: NOW });
  return next;
}

/**
 * ResumeGuru locked, Divine Studio migrated but NOT locked. That second one is
 * the honest pre-lock case every refusal test needs.
 */
export function deskState(): AppState {
  const state = normalizeState(fixtureState());
  const rg = state.clients.find(c => c.id === 'resumeguru')!;
  const migrated = migrateProfile(rg, state.clientData.resumeguru, { now: NOW });
  state.clientData.resumeguru.body = {
    ...withWork(withPositions(migrated.body, POSITIONS)),
    strategy_version: 1,
  };

  const divine = state.clients.find(c => c.id === 'divine-studio')!;
  state.clientData['divine-studio'].body = withPositions(
    migrateProfile(divine, state.clientData['divine-studio'], { now: NOW }).body, POSITIONS,
  );
  return state;
}

/** Ids that count instead of rolling dice, so every test is repeatable. */
function ids(): IdSource {
  let n = 0;
  let s = 0;
  return { id: () => `new-${++n}`, shareId: () => `share-${++s}` };
}

function ctxFor(state: AppState = deskState()): WriteContext {
  return { state, now: NOW, ids: ids() };
}

function bodyOf(state: AppState, profileId: string): ProfileBody {
  return state.clientData[profileId].body!;
}

function entriesAt(state: AppState, profileId: string, path: string) {
  return bodyOf(state, profileId).paths?.[path] ?? [];
}

/** The bare paths behind the scope keys a tool returned. */
function pathsOf(keys: string[]): string[] {
  return keys.map(k => parseScope(k).path);
}

function profileOf(keys: string[]): (string | null)[] {
  return [...new Set(keys.map(k => parseScope(k).profileId))];
}

// ── §6.1 The placement test ──────────────────────────────────────────────────

suite('spec 30 §6.1 — the placement test: everything lands at its declared address');

test('add_task lands at work-log/logs/tasks and nowhere else', () => {
  const ctx = ctxFor();
  const r = addTask(ctx, { profile: 'ResumeGuru', text: 'Shoot the reel', dueDate: '2026-08-07' });
  ok(r.ok, 'the task was accepted');
  if (!r.ok) return;

  eq(pathsOf(r.paths), ['work-log/logs/tasks'], 'one scope, and it is the tasks address');
  eq(profileOf(r.paths), ['resumeguru'], 'scoped to the profile she named');

  const rows = entriesAt(r.state, 'resumeguru', 'work-log/logs/tasks');
  eq(rows.length, entriesAt(ctx.state, 'resumeguru', 'work-log/logs/tasks').length + 1,
    'exactly one more task than the profile already had');
  const made = rows.find(e => e.id === 'new-1')!;
  eq(made.type, 'task', 'the declaration\'s own entry type');
  eq(made.path, 'work-log/logs/tasks', 'the entry carries its address');
  eq(foldEntry(made).data.text, 'Shoot the reel', 'her words, unchanged');
  eq(foldEntry(made).data.due_date, '2026-08-07', 'the date she gave');
});

test('the tools never mutate the state they were handed', () => {
  const before = deskState();
  const snapshot = JSON.stringify(before);
  const ctx: WriteContext = { state: before, now: NOW, ids: ids() };
  const r = addTask(ctx, { profile: 'ResumeGuru', text: 'Shoot the reel' });
  ok(r.ok, 'accepted');
  eq(JSON.stringify(before), snapshot, 'the state that went in is byte for byte what it was');
});

test('add_piece lands at work-log/creation, carrying only what she named', () => {
  const ctx = ctxFor();
  const r = addPiece(ctx, {
    profile: 'ResumeGuru', title: 'Three resume lies', pillarId: 'p-trust', format: 'Carousel',
  });
  ok(r.ok, 'the piece was accepted');
  if (!r.ok) return;

  eq(pathsOf(r.paths), ['work-log/creation'], 'the board\'s address');
  const entry = entriesAt(r.state, 'resumeguru', 'work-log/creation').find(e => e.id === r.pieceId)!;
  const piece = resolvePiece(entry);
  eq(piece.stage, 'idea', 'a piece with no stage named is born at idea');
  eq(piece.costume, { pillar_id: 'p-trust', format: 'Carousel' }, 'no platform was invented');
  eq(piece.birth, null, 'no birth record is invented for a piece that was never built');
  eq(piece.seed_id, null, 'no seed was guessed at');
});

test('add_seed_capture files INPUT, byte for byte, and makes no seed', () => {
  const ctx = ctxFor();
  const said = '  they keep asking me the SAME thing about salary…  \n\n  and I never answer it  ';
  const seedsBefore = entriesAt(ctx.state, 'resumeguru', 'work-log/creation/topics').length;
  const r = addSeedCapture(ctx, { profile: 'ResumeGuru', text: said });
  ok(r.ok, 'the capture was accepted');
  if (!r.ok) return;

  eq(pathsOf(r.paths), ['work-log/creation/topics/captures'], 'the captures address');
  const entry = entriesAt(r.state, 'resumeguru', 'work-log/creation/topics/captures')
    .find(e => e.id === r.captureId)!;
  eq(entry.type, 'seed_capture', 'a capture, not a seed');
  eq((entry.data as { text: string }).text, said, 'kept exactly as she said it, whitespace and all');

  eq(entriesAt(r.state, 'resumeguru', 'work-log/creation/topics').length, seedsBefore,
    'not one seed was made from it');
});

test('add_note lands at work-log/logs/observations', () => {
  const ctx = ctxFor();
  const r = addNote(ctx, { profile: 'ResumeGuru', text: 'Reels are landing better than statics', topic: 'formats' });
  ok(r.ok, 'the note was accepted');
  if (!r.ok) return;
  eq(pathsOf(r.paths), ['work-log/logs/observations'], 'the notes address');
  const entry = entriesAt(r.state, 'resumeguru', 'work-log/logs/observations')[0];
  eq(entry.type, 'observation', 'an observation');
  eq((entry.data as { text: string }).text, 'Reels are landing better than statics', 'her words');
});

test('a request with no address is refused, not filed somewhere plausible', () => {
  const ctx = ctxFor();
  const r = addTask(ctx, { profile: '', text: 'Do the thing' });
  ok(!r.ok, 'refused');
  if (r.ok) return;
  ok(r.refusal.includes('Which profile'), 'it asks which profile, in her words');
});

test('the chat writes as the writer the declaration names', () => {
  eq(writerFor('work-log/logs/tasks'), 'pipe:chat', 'tasks declare the chat as a writer');
  eq(writerFor('work-log/logs/observations'), 'pipe:chat', 'notes declare the chat as a writer');
  eq(writerFor('work-log/creation'), 'owner', 'creation does not, so the chat acts as her');
});

// ── update_task, move_piece, schedule_piece ──────────────────────────────────

suite('spec 30 §1 — her four examples, done correctly');

test('1. update_task renames, re-dates and completes, by amendment', () => {
  const ctx = ctxFor();
  const r = updateTask(ctx, {
    profile: 'ResumeGuru', taskId: 'task-brief', text: 'Send the brief and the moodboard',
    dueDate: '2026-08-08', done: true,
  });
  ok(r.ok, 'the update was accepted');
  if (!r.ok) return;

  const entry = entriesAt(r.state, 'resumeguru', 'work-log/logs/tasks')
    .find(e => e.id === 'task-brief')!;
  eq((entry.data as { text: string }).text, 'Send the brief',
    'the birth record is untouched: the path is append-only');
  eq(entry.amendments?.length, 1, 'one dated amendment');
  const folded = foldEntry(entry);
  eq(folded.data.text, 'Send the brief and the moodboard', 'the folded task reads the new words');
  eq(folded.data.due_date, '2026-08-08', 'and the new date');
  eq(folded.done, true, 'and it is ticked off');
});

test('update_task refuses a task that does not exist, and writes nothing', () => {
  const ctx = ctxFor();
  const before = JSON.stringify(ctx.state);
  const r = updateTask(ctx, { profile: 'ResumeGuru', taskId: 'task-nope', done: true });
  ok(!r.ok, 'refused');
  if (r.ok) return;
  ok(r.refusal.includes('no task'), 'it says the task is not there');
  ok(r.refusal.includes('Nothing was written'), 'and that nothing happened');
  eq(JSON.stringify(ctx.state), before, 'the state is untouched');
});

test('update_task refuses a change that changes nothing', () => {
  const ctx = ctxFor();
  const r = updateTask(ctx, { profile: 'ResumeGuru', taskId: 'task-brief', text: 'Send the brief' });
  ok(!r.ok, 'refused rather than writing an empty amendment');
});

test('3. "I posted this today" moves the piece, with the live link and the day', () => {
  const ctx = ctxFor();
  const r = movePiece(ctx, {
    profile: 'ResumeGuru', pieceId: 'piece-salary', to: 'posted',
    liveLink: 'https://instagram.com/p/abc123', postedOn: TODAY,
  });
  ok(r.ok, 'the move was accepted');
  if (!r.ok) return;

  const entry = entriesAt(r.state, 'resumeguru', 'work-log/creation')
    .find(e => e.id === 'piece-salary')!;
  eq((entry.data as { stage: string }).stage, 'review', 'the birth record still says review');
  const piece = resolvePiece(entry);
  eq(piece.stage, 'posted', 'the piece reads as posted');
  eq(piece.live_link, 'https://instagram.com/p/abc123', 'the link she gave');
  eq(piece.scheduled_date, TODAY, 'dated the day she said, never from a clock');
  eq(pathsOf(r.paths), ['work-log/creation'], 'one address touched');
});

test('move_piece takes her words for a stage and refuses an invented one', () => {
  eq(normalizeStage('live'), 'posted', '"live" is posted');
  eq(normalizeStage('ready'), 'approved', 'the legacy board\'s word maps, it does not add a stage');
  eq(normalizeStage('writing'), 'build', '"writing" is build');
  eq(normalizeStage('nearly done'), null, 'anything else is not a stage');

  const ctx = ctxFor();
  const r = movePiece(ctx, { profile: 'ResumeGuru', pieceId: 'piece-salary', to: 'nearly done' });
  ok(!r.ok, 'refused');
  if (r.ok) return;
  ok(r.refusal.includes('not a stage'), 'and it says why');
});

test('move_piece refuses a move that is already done', () => {
  const ctx = ctxFor();
  const r = movePiece(ctx, { profile: 'ResumeGuru', pieceId: 'piece-salary', to: 'review' });
  ok(!r.ok, 'refused rather than reporting a move that did not happen');
});

test('schedule_piece puts a date on a piece, and refuses a half-written one', () => {
  const ctx = ctxFor();
  const r = schedulePiece(ctx, { profile: 'ResumeGuru', pieceId: 'piece-salary', date: '2026-08-19' });
  ok(r.ok, 'accepted');
  if (!r.ok) return;
  eq(resolvePiece(entriesAt(r.state, 'resumeguru', 'work-log/creation')
    .find(e => e.id === 'piece-salary')!).scheduled_date, '2026-08-19', 'the date is on the piece');

  const bad = schedulePiece(ctxFor(), {
    profile: 'ResumeGuru', pieceId: 'piece-salary', date: 'next Tuesday',
  });
  ok(!bad.ok, 'a date it cannot use is refused, never stored as words');
});

test('add_piece refuses a seed that is not locked, and writes nothing', () => {
  const ctx = ctxFor();
  const before = JSON.stringify(ctx.state);
  const r = addPiece(ctx, { profile: 'ResumeGuru', title: 'ATS truths', seedId: 'seed-draft' });
  ok(!r.ok, 'refused');
  if (r.ok) return;
  ok(r.refusal.includes('draft'), 'it names the status the seed is actually at');
  ok(r.refusal.includes('only a locked seed'), 'and the rule');
  eq(JSON.stringify(ctx.state), before, 'no piece was made');

  const good = addPiece(ctxFor(), {
    profile: 'ResumeGuru', title: 'Salary truths', seedId: 'seed-locked',
  });
  ok(good.ok, 'a locked seed mothers a piece');
});

// ── §6.4 The refusal test ────────────────────────────────────────────────────

suite('spec 30 §6.4 — the refusal test: named, plain, and no partial write');

// Her decision, 2026-08-09: recording what is happening always works, locked or
// not. Her clients already exist and the work is already happening; the only
// thing missing is the strategy write-up, and that is not a reason to lose the
// record. Generation is what needs the strategy, and it is gated where it is
// made — the engine surfaces, on their own `strategyLocked` flag.

test('an unlocked profile records exactly like a locked one, through the same door', () => {
  // Divine is migrated and NOT locked. This is the profile the old rule shut.
  const made = addPiece(ctxFor(), { profile: 'Divine Studio', title: 'The 6am flow' });
  ok(made.ok, 'a piece can be made');
  if (!made.ok) return;
  eq(pathsOf(made.paths), ['work-log/creation'], 'at the board’s declared address');

  // Made, then edited, then moved: the three halves of recording.
  const moved = movePiece(ctxFor(made.state), {
    profile: 'Divine Studio', pieceId: made.pieceId, to: 'posted',
    liveLink: 'https://instagram.com/p/abc', postedOn: TODAY,
  });
  ok(moved.ok, 'and moved to another stage');
  if (!moved.ok) return;
  const piece = resolvePiece(
    entriesAt(moved.state, 'divine-studio', 'work-log/creation')
      .find(e => e.id === made.pieceId)!,
  );
  eq(piece.stage, 'posted', 'the stage change landed');
  eq(piece.live_link, 'https://instagram.com/p/abc', 'and the link went on with it');

  const capture = addSeedCapture(ctxFor(), { profile: 'Divine Studio', text: 'the morning class idea' });
  ok(capture.ok, 'a capture lands too: it is a record of something she thought');

  // And the profile that HAS locked behaves identically. The lock changes
  // nothing about recording, in either direction.
  const onLocked = addPiece(ctxFor(), { profile: 'ResumeGuru', title: 'The salary follow-up' });
  ok(onLocked.ok, 'the locked profile records the same way');
});

test('a task and a note land on an unlocked profile too', () => {
  const task = addTask(ctxFor(), { profile: 'Divine Studio', text: 'Ask for the class photos' });
  ok(task.ok, 'a task is not a thing that waits for a strategy');
  if (task.ok) eq(pathsOf(task.paths), ['work-log/logs/tasks'], 'and it goes to the tasks address');

  const note = addNote(ctxFor(), { profile: 'Divine Studio', text: 'They reply fastest on Sundays' });
  ok(note.ok, 'and so is a note');
});

test('an archived profile still reads and never moves', () => {
  // The lock stopped making things read-only. A profile at rest did not: it is
  // kept, whole, and nothing on it is written again.
  const state = deskState();
  state.clients = state.clients.map(c =>
    c.id === 'resumeguru' ? { ...c, lifecycle: 'archived' as const } : c);
  const before = JSON.stringify(state);

  const piece = addPiece(ctxFor(state), { profile: 'ResumeGuru', title: 'One more carousel' });
  ok(!piece.ok, 'a piece is refused');
  if (!piece.ok) {
    ok(piece.refusal.includes('archived'), 'and it says the profile is archived');
    ok(!piece.refusal.includes('switched off'), 'never blaming a switch she did not move');
    ok(piece.refusal.includes('Nothing was written'), 'and that nothing happened');
  }

  const move = movePiece(ctxFor(state), {
    profile: 'ResumeGuru', pieceId: 'piece-salary', to: 'posted',
  });
  ok(!move.ok, 'and so is a stage change');

  const task = addTask(ctxFor(state), { profile: 'ResumeGuru', text: 'Chase the photos' });
  ok(!task.ok, 'and a task');

  eq(JSON.stringify(state), before, 'nothing at all was written');
});

test('a switched-off feature refuses, and writes nothing', () => {
  const state = deskState();
  state.clientData.resumeguru.body =
    setSwitchPosition(bodyOf(state, 'resumeguru'), 'logs.tasks', 'hidden', NOW, false);
  const ctx = ctxFor(state);
  const before = JSON.stringify(state);

  const r = addTask(ctx, { profile: 'ResumeGuru', text: 'Shoot the reel' });
  ok(!r.ok, 'refused');
  if (r.ok) return;
  ok(r.refusal.includes('switched off'), 'it says the feature is off');
  ok(r.refusal.includes('Tasks'), 'and which one, in plain words');
  eq(JSON.stringify(state), before, 'nothing was written');
});

test('a switch at history refuses too: read-only is not writable', () => {
  const state = deskState();
  state.clientData.resumeguru.body =
    setSwitchPosition(bodyOf(state, 'resumeguru'), 'logs.observations', 'history', NOW, false);
  const r = addNote(ctxFor(state), { profile: 'ResumeGuru', text: 'a thought' });
  ok(!r.ok, 'refused');
});

test('scheduling off refuses a date even though the board is on', () => {
  const state = deskState();
  state.clientData.resumeguru.body =
    setSwitchPosition(bodyOf(state, 'resumeguru'), 'creation.scheduling', 'hidden', NOW, false);
  const r = schedulePiece(ctxFor(state), {
    profile: 'ResumeGuru', pieceId: 'piece-salary', date: '2026-08-19',
  });
  ok(!r.ok, 'refused');
  if (r.ok) return;
  ok(r.refusal.includes('Scheduling'), 'and it names scheduling, not the board');
});

test('an ambiguous name asks which, and never guesses', () => {
  const state = deskState();
  state.clients.push({
    ...state.clients.find(c => c.id === 'divine-studio')!,
    id: 'divine-yoga', name: 'Divine Yoga',
  });
  state.clientData['divine-yoga'] = state.clientData['divine-studio'];

  const r = resolveProfile(state, 'Divine');
  ok(!r.ok, 'refused');
  if (r.ok) return;
  ok(r.refusal.includes('Divine Studio'), 'it names the first');
  ok(r.refusal.includes('Divine Yoga'), 'and the second');
  ok(r.refusal.includes('which one'), 'and asks her');

  const exact = resolveProfile(state, 'Divine Yoga');
  ok(exact.ok, 'an exact name is never ambiguous');
});

test('a profile that does not exist is named, not invented', () => {
  const r = resolveProfile(deskState(), 'Nike');
  ok(!r.ok, 'refused');
  if (r.ok) return;
  ok(r.refusal.includes('Nike'), 'it says what she asked for');
});

test('a profile that has not moved into the tree is refused plainly', () => {
  const state = deskState();
  delete state.clientData['divine-studio'].body;
  const r = addTask(ctxFor(state), { profile: 'Divine Studio', text: 'Ask for photos' });
  ok(!r.ok, 'refused');
  if (r.ok) return;
  ok(r.refusal.includes('not moved into the new structure'), 'and it says why, without jargon');
});

test('no refusal reads like a stack trace', () => {
  const switchedOff = deskState();
  switchedOff.clientData.resumeguru.body =
    setSwitchPosition(bodyOf(switchedOff, 'resumeguru'), 'creation.board', 'hidden', NOW, false);

  const refusals = [
    addTask(ctxFor(), { profile: 'Nike', text: 'x' }),
    addPiece(ctxFor(switchedOff), { profile: 'ResumeGuru', title: 'x' }),
    movePiece(ctxFor(), { profile: 'ResumeGuru', pieceId: 'nope', to: 'posted' }),
  ];
  for (const r of refusals) {
    ok(!r.ok, 'refused');
    if (r.ok) continue;
    ok(!r.refusal.includes('[tree]'), 'no internal prefix');
    ok(!r.refusal.includes('work-log/'), 'no path in her face');
    ok(!/—/.test(r.refusal), 'no em dashes');
  }
});

// ── §6.5 The one-truth test ──────────────────────────────────────────────────

suite('spec 30 §6.5 — the one-truth test: a preview is the review state of a piece');

const IMAGE = 'https://res.cloudinary.com/krnl/image/upload/v1/slide-1.jpg';
const IMAGE_2 = 'https://res.cloudinary.com/krnl/image/upload/v1/slide-2.png';

/** The fixture ships one old unattached preview. These are the chat's own. */
function previewsFor(state: AppState, profileId: string, cardId: string) {
  return (state.clientData[profileId].previewPosts ?? []).filter(p => p.cardId === cardId);
}

test('a preview made from a link carries cardId at birth', () => {
  const ctx = ctxFor();
  const r = makePreview(ctx, {
    profile: 'ResumeGuru', pieceId: 'piece-salary', links: [IMAGE, IMAGE_2],
    canvaConfigured: false,
  });
  ok(r.ok, 'the preview was made');
  if (!r.ok) return;

  eq(r.pieceId, 'piece-salary', 'it belongs to the piece she named');
  eq(r.pieceCreated, false, 'no piece was born, because one already existed');
  eq(r.sharePath, '/p/share-1', 'the link she sends the client');

  const mine = previewsFor(r.state, 'resumeguru', 'piece-salary');
  eq(mine.length, 1, 'one preview on that piece');
  eq(mine[0].cardId, 'piece-salary', 'attached at birth, not later');
  eq(mine[0].images, [IMAGE, IMAGE_2], 'both slides, in the order she pasted them');
  eq(mine[0].postType, 'carousel', 'two slides is a carousel');
  eq(pathsOf(r.paths), ['work-log/creation/review'], 'the review address');

  const old = (r.state.clientData.resumeguru.previewPosts ?? []).find(p => p.id === 'pv-1');
  ok(old, 'the profile\'s existing preview is untouched, never replaced');
});

test('a second preview on the same piece grows the first, it never forks it', () => {
  const first = makePreview(ctxFor(), {
    profile: 'ResumeGuru', pieceId: 'piece-salary', links: [IMAGE], canvaConfigured: false,
  });
  ok(first.ok, 'the first was made');
  if (!first.ok) return;

  const second = makePreview(
    { state: first.state, now: NOW, ids: ids() },
    { profile: 'ResumeGuru', pieceId: 'piece-salary', links: [IMAGE_2], canvaConfigured: false },
  );
  ok(second.ok, 'the second was accepted');
  if (!second.ok) return;

  const mine = previewsFor(second.state, 'resumeguru', 'piece-salary');
  eq(mine.length, 1, 'still one preview: a piece has one review state');
  eq(mine[0].images.length, 2, 'the slide was added to it');
  eq(second.shareId, first.shareId, 'the link she already sent still works');
});

test('describing a piece that is not on the board births exactly one piece', () => {
  const ctx = ctxFor();
  const before = entriesAt(ctx.state, 'resumeguru', 'work-log/creation').length;
  const r = makePreview(ctx, {
    profile: 'ResumeGuru',
    newPiece: { title: 'The three-line resume', platform: 'Instagram', format: 'Carousel' },
    links: [IMAGE], canvaConfigured: false,
  });
  ok(r.ok, 'accepted');
  if (!r.ok) return;

  eq(r.pieceCreated, true, 'a piece was born');
  const pieces = entriesAt(r.state, 'resumeguru', 'work-log/creation');
  eq(pieces.length, before + 1, 'exactly one more piece, never two');
  const born = resolvePiece(pieces.find(e => e.id === r.pieceId)!);
  eq(born.title, 'The three-line resume', 'her title');
  eq(born.stage, 'review', 'born at review, because that is what a preview is for');

  const mine = previewsFor(r.state, 'resumeguru', r.pieceId);
  eq(mine.length, 1, 'and one preview points at it');
  eq(pathsOf(r.paths).sort(), ['work-log/creation', 'work-log/creation/review'],
    'both addresses declared, and only those');
});

test('a preview with no piece named and nothing described is refused', () => {
  const r = makePreview(ctxFor(), { profile: 'ResumeGuru', links: [IMAGE], canvaConfigured: false });
  ok(!r.ok, 'refused');
  if (r.ok) return;
  ok(r.refusal.includes('Which piece'), 'it asks which piece');
});

test('a preview on an unlocked profile is made, piece and all', () => {
  // A preview is a record of something she sent for review. It does not wait for
  // a strategy either (her decision, 2026-08-09).
  const r = makePreview(ctxFor(), {
    profile: 'Divine Studio', newPiece: { title: 'The 6am flow' }, links: [IMAGE],
    canvaConfigured: false,
  });
  ok(r.ok, 'it was made');
  if (!r.ok) return;
  const previews = (r.state.clientData['divine-studio'].previewPosts ?? []);
  eq(previews.length, 1, 'one preview, not two');
  ok(!!previews[0].cardId, 'and it is attached to the piece it belongs to');
});

test('a preview on an archived profile is refused, and no piece is left behind', () => {
  const state = deskState();
  state.clients = state.clients.map(c =>
    c.id === 'resumeguru' ? { ...c, lifecycle: 'archived' as const } : c);
  const before = JSON.stringify(state);
  const r = makePreview(ctxFor(state), {
    profile: 'ResumeGuru', newPiece: { title: 'One more carousel' }, links: [IMAGE],
    canvaConfigured: false,
  });
  ok(!r.ok, 'refused');
  eq(JSON.stringify(state), before, 'no half-made piece, no empty preview');
});

test('more slides than a carousel holds is refused, not silently trimmed', () => {
  const many = Array.from({ length: 21 }, (_, i) => `https://cdn.test/slide-${i}.jpg`);
  const r = makePreview(ctxFor(), {
    profile: 'ResumeGuru', pieceId: 'piece-salary', links: many, canvaConfigured: false,
  });
  ok(!r.ok, 'refused');
  if (r.ok) return;
  ok(r.refusal.includes('21'), 'it says how many she gave');
  ok(r.refusal.includes('20'), 'and how many fit');
});

// ── §6.7 The honesty test ────────────────────────────────────────────────────

suite('spec 30 §6.7 — the honesty test: Canva says what is actually true');

test('a link is classified from the link itself, with nothing fetched', () => {
  eq(classifyLink(IMAGE), 'media', 'a direct image');
  eq(classifyLink('https://cdn.test/reel.mp4'), 'media', 'a direct video');
  eq(classifyLink('https://www.canva.com/design/DAF123/view'), 'canva', 'a Canva design');
  eq(classifyLink('https://canva.link/abc123'), 'canva', 'a Canva short link');
  eq(classifyLink('https://notion.so/my-page'), 'other', 'anything else');
  eq(classifyLink('https://evilcanva.com/design/x'), 'other', 'and the host has to really be Canva');
});

test('a Canva link with no registered app explains that, and writes nothing', () => {
  const ctx = ctxFor();
  const before = JSON.stringify(ctx.state);
  const r = makePreview(ctx, {
    profile: 'ResumeGuru', pieceId: 'piece-salary',
    links: ['https://www.canva.com/design/DAF123/view'], canvaConfigured: false,
  });
  ok(!r.ok, 'refused');
  if (r.ok) return;
  eq(r.refusal, CANVA_NOT_CONNECTED, 'the plain explanation, in her words');
  ok(r.refusal.includes('one-time setup'), 'it says whose job it is');
  eq(JSON.stringify(ctx.state), before, 'and no empty preview was made');
  eq(previewsFor(ctx.state, 'resumeguru', 'piece-salary').length, 0, 'no preview on the piece at all');
});

test('one bad link refuses the whole preview, never a partial one', () => {
  const r = makePreview(ctxFor(), {
    profile: 'ResumeGuru', pieceId: 'piece-salary',
    links: [IMAGE, 'https://notion.so/my-page'], canvaConfigured: false,
  });
  ok(!r.ok, 'refused');
  if (r.ok) return;
  ok(r.refusal.includes('notion.so'), 'it names the link it cannot use');
  ok(r.refusal.includes('screenshots'), 'and says it does not screenshot pages');
});

test('no links at all is refused', () => {
  const r = makePreview(ctxFor(), {
    profile: 'ResumeGuru', pieceId: 'piece-salary', links: [], canvaConfigured: false,
  });
  ok(!r.ok, 'refused');
});

// ── What a write does to the counters the desk already has ───────────────────

suite('spec 30 — what a write does to the counts the desk reads');

test('a piece added by the chat is counted by the desk\'s own counter', () => {
  const ctx = ctxFor();
  const before = stageCounts(ctx.state.clientData.resumeguru).idea ?? 0;
  const r = addPiece(ctx, { profile: 'ResumeGuru', title: 'Three resume lies' });
  ok(r.ok, 'accepted');
  if (!r.ok) return;
  eq(stageCounts(r.state.clientData.resumeguru).idea ?? 0, before + 1,
    'stageCounts in lib/shell/shelf.ts sees it, with no second counter written');
});

test('a stage MOVE is an amendment, and every counter folds it', () => {
  // `work-log/creation` is append-only, so a move is a dated amendment and the
  // birth record stays exactly as written. `resolvePiece` folds amendments.
  //
  // This test was written the other way round: it recorded that the shelf's
  // `stageCounts` read `entry.data.stage` directly, so a chat move left every
  // count answering from the birth record. That was harmless only while the sole
  // way to move a piece was dragging it on the board. The desk chat moves pieces
  // through the tree, so it stopped being harmless the moment this shipped:
  // "8 posted, 4 left" would have gone quietly stale, which is the one thing she
  // asked this feature never to do.
  //
  // `stageCounts` now resolves too. This asserts the fix, not the gap.
  const ctx = ctxFor();
  const was = stageCounts(ctx.state.clientData.resumeguru);
  const r = movePiece(ctx, { profile: 'ResumeGuru', pieceId: 'piece-salary', to: 'posted' });
  ok(r.ok, 'the move was accepted');
  if (!r.ok) return;

  const entry = entriesAt(r.state, 'resumeguru', 'work-log/creation')
    .find(e => e.id === 'piece-salary')!;
  eq(resolvePiece(entry).stage, 'posted', 'the piece really is posted');
  eq(String((entry.data as { stage?: unknown }).stage), 'review',
    'and its birth record still says review, because nothing rewrites it');

  const now = stageCounts(r.state.clientData.resumeguru);
  eq(now.posted ?? 0, (was.posted ?? 0) + 1, 'the counter followed the move');
  eq(now.review ?? 0, (was.review ?? 0) - 1, 'and it left the stage it came from');
});

// ── The lifecycle tool ───────────────────────────────────────────────────────
//
// She asked the chat to unarchive something and it told her it had no setting
// for that. It was telling the truth: there was no tool, in either chat. This is
// the same change the "..." menu on a desk profile row makes, reached by asking.
//
// The point of these tests is the DOOR, not the function. A tool that returns a
// happy object and a scope the write door then rejects is worse than no tool, so
// each one below carries the path through `checkScopes` and `applyScopes`, the
// exact sequence `app/api/desk-chat` runs before it saves.

suite('spec 30 — a profile\'s lifecycle, asked for rather than clicked');

test('archiving lands, at the address that owns profiles', () => {
  const ctx = ctxFor();
  const r = setLifecycle(ctx, { profile: 'Divine', to: 'archived' });
  ok(r.ok, 'it should archive');
  if (!r.ok) return;

  eq(r.paths, [scopeKey(null, PROFILES_SCOPE)], 'one owner scope, and it is the profiles one');
  eq(parseScope(r.paths[0]).profileId, null, 'lifecycle is not inside a profile, it is about one');
  eq(checkScopes(r.paths).length, 0, 'the write door must accept that path');

  const saved = applyScopes(ctx.state, r.state, r.paths);
  const divine = saved.clients.find(c => c.id === 'divine-studio')!;
  eq(divine.lifecycle, 'archived', 'and it is archived in what would be stored');
  eq(divine.lifecycleAt, NOW, 'dated, so the desk can say since when');
  ok(r.summary.includes('kept'), 'she is told nothing was lost');
});

test('nothing else moves when one profile is archived', () => {
  const ctx = ctxFor();
  const before = ctx.state.clients.find(c => c.id === 'resumeguru')!.lifecycle ?? 'active';
  const r = setLifecycle(ctx, { profile: 'Divine', to: 'archived' });
  ok(r.ok, 'it should archive');
  if (!r.ok) return;

  const saved = applyScopes(ctx.state, r.state, r.paths);
  eq(saved.clients.find(c => c.id === 'resumeguru')!.lifecycle ?? 'active', before,
    'the other profile is untouched');
  eq(saved.clientData['divine-studio'].body, ctx.state.clientData['divine-studio'].body,
    'and the archived profile keeps every bit of its work');
});

test('and it comes back, which is the thing she actually asked for', () => {
  const first = ctxFor();
  const archived = setLifecycle(first, { profile: 'Divine', to: 'archived' });
  ok(archived.ok, 'archived first');
  if (!archived.ok) return;

  const r = setLifecycle({ ...first, state: archived.state }, { profile: 'Divine', to: 'active' });
  ok(r.ok, 'and back to active');
  if (!r.ok) return;
  const saved = applyScopes(archived.state, r.state, r.paths);
  eq(saved.clients.find(c => c.id === 'divine-studio')!.lifecycle, 'active', 'it is live again');
});

test('asking for the state it is already in changes nothing, and says so', () => {
  const r = setLifecycle(ctxFor(), { profile: 'Divine', to: 'active' });
  ok(!r.ok, 'an already-active profile is not re-activated');
  if (r.ok) return;
  ok(r.refusal.includes('already'), 'and the refusal says why');
});

test('a word that is not a lifecycle is refused, not guessed at', () => {
  const r = setLifecycle(ctxFor(), { profile: 'Divine', to: 'deleted' });
  ok(!r.ok, 'there is no such state');
  if (r.ok) return;
  ok(r.refusal.includes('Nothing was written'), 'and nothing was written');
});

test('an ambiguous name is a question, never a guess', () => {
  const r = setLifecycle(ctxFor(), { profile: '', to: 'archived' });
  ok(!r.ok, 'no profile named is no profile archived');
});
