// The restructure, phase 2 — Creation → Logs.
//
// Five things are held here, because all five are the kind of thing a later
// "tidy up" would quietly undo:
//
//   1. Off means absent. A tab whose switches are all off is not in the list,
//      not a disabled tab and not a "not available for this profile" line.
//   2. One thing, one home. A client task on her day POINTS at an agenda item
//      here; it is drawn once, not twice under two names.
//   3. Missing data is shown as missing. No date reads "no date", never a zero
//      and never a made-up today.
//   4. Decisions and requests are APPEND-ONLY. "Done" is an amendment on top of
//      the birth record; the record itself is never rewritten.
//   5. Every count and every ageing figure is derived from the array it
//      describes, at render time.

import { eq, ok, suite, test, throws } from './harness.ts';
import { emptyBody } from '../lib/tree/body.ts';
import {
  DOT_DONE, DOT_DUE, DOT_QUIET, DOT_RECORDED, DOT_WAITING,
  LOG_FOOTNOTES, LOG_TAB_ORDER, PIPELINES,
  addLogEntry, addNote, counted, daysBetween, decisionRows, foldEntry, liveLogTabs,
  livePipelines, markLogEntryDone, noteRows, openFor, requestRows, shortDay,
  sortRows, taskRows,
} from '../lib/creation/logs.ts';
import type { LogRow } from '../lib/creation/logs.ts';
import type { PathState } from '../lib/tree/contract.ts';

type Task = Parameters<typeof taskRows>[0]['personalTasks'][number];
type Note = Parameters<typeof noteRows>[0]['observations'][number];

const agendaItem = (over: Partial<{ id: string; text: string; dueDate: string; done: boolean }>) => ({
  id: 'a1', text: 'An item', dueDate: '', done: false, ...over,
});

const clientTask = (over: Partial<Task>): Task => ({
  id: 't1', text: 'A task', bucket: 'today', taskType: 'client-task',
  clientIds: ['p1'], done: false, createdAt: '2026-08-01T00:00:00.000Z',
  ...over,
} as Task);

const note = (over: Partial<Note>): Note => ({
  id: 'o1', topic: 'Reels', text: 'Answers fastest on Tuesday evenings',
  clientId: 'p1', createdAt: '2026-08-02T00:00:00.000Z',
  updatedAt: '2026-08-02T00:00:00.000Z',
  ...over,
} as Note);

/** A resolver in the shape of `renderState(profile, switchId, role)`. */
const resolver = (positions: Record<string, PathState>) =>
  (switchId: string): PathState => positions[switchId] ?? 'hidden';

const ALL_ON: Record<string, PathState> = {
  'logs.tasks': 'active', 'logs.decisions': 'active', 'logs.requests': 'active',
  'logs.observations': 'active', 'logs.pipelines.lists': 'active',
  'logs.pipelines.cold_calls': 'active', 'logs.pipelines.orders': 'active',
  'creation.funnel_replies': 'active',
};

// ── 1. Off means absent ──────────────────────────────────────────────────────

suite('logs — off means absent');

test('1. all five are there when all five are switched on', () => {
  eq(liveLogTabs(resolver(ALL_ON)).map(t => t.item.id),
    ['tasks', 'decisions', 'requests', 'pipelines', 'notes'],
    'the design\'s five, in the design\'s order');
});

test('1b. a switched-off tab is NOT RENDERED, not disabled', () => {
  const tabs = liveLogTabs(resolver({ ...ALL_ON, 'logs.decisions': 'hidden' }));
  eq(tabs.map(t => t.item.id), ['tasks', 'requests', 'pipelines', 'notes'],
    'Decisions is simply gone');
  ok(!tabs.some(t => t.item.id === 'decisions'), 'and there is no disabled remnant of it');
});

test('1c. Pipelines is absent for a profile that uses no pipeline', () => {
  const none = resolver({
    'logs.tasks': 'active', 'logs.decisions': 'active',
    'logs.requests': 'active', 'logs.observations': 'active',
  });
  eq(liveLogTabs(none).map(t => t.item.id), ['tasks', 'decisions', 'requests', 'notes'],
    'four tabs, not five with an empty one');
  eq(livePipelines(none), [], 'and no pipeline underneath it either');
});

test('1d. Pipelines appears the moment ONE pipeline is on (the container rule)', () => {
  const one = resolver({ 'logs.pipelines.orders': 'active' });
  eq(liveLogTabs(one).map(t => t.item.id), ['pipelines'], 'that tab alone');
  eq(livePipelines(one).map(p => p.item.id), ['orders'], 'holding only the one that is on');
});

test('1e. a switched-off pipeline is kept, read-only, when it holds history (S9)', () => {
  const live = livePipelines(resolver({ ...ALL_ON, 'logs.pipelines.lists': 'history' }));
  eq(live.map(p => `${p.item.id}:${p.state}`),
    ['lists:history', 'cold-calls:active', 'orders:active', 'replies:active'],
    'history renders, hidden does not');
});

test('1f. Saved replies is a pipeline, and it is Divine\'s Lead Answers', () => {
  const replies = PIPELINES.find(p => p.id === 'replies');
  ok(!!replies, 'Saved replies is one of the pipelines');
  eq(replies?.switchId, 'creation.funnel_replies',
    'governed by the switch its own spec registered, not a new one');
});

test('1g. every tab carries a footnote saying what lives there', () => {
  for (const id of LOG_TAB_ORDER) {
    const line = LOG_FOOTNOTES[id];
    ok(!!line && line.length > 20, `${id} has no footnote`);
    ok(!/—/.test(line), `${id}'s footnote uses an em dash`);
  }
});

// ── 2. One thing, one home ───────────────────────────────────────────────────

suite('logs — tasks: one truth, two views');

const TASK_BASE = { profileId: 'p1', month: '2026-08', today: '2026-08-04' };

test('2. the agenda and her day meet, and nothing is drawn twice', () => {
  const rows = taskRows({
    ...TASK_BASE,
    agenda: [agendaItem({ id: 'a1', text: 'Send August invoice', dueDate: '2026-08-06' })],
    personalTasks: [clientTask({
      id: 't1', text: 'Send August invoice',
      linkedAgenda: [{ clientId: 'p1', month: '2026-08', itemId: 'a1' }],
    })],
  });
  eq(rows.length, 1, 'one task, one row');
  eq(rows[0].id, 'agenda:a1', 'and it is the agenda item, which is where it lives');
  eq(rows[0].sub, 'client task, also on your day', 'the row says her day points at it');
});

test('2b. a client task with no agenda pointer is a real extra row', () => {
  const rows = taskRows({
    ...TASK_BASE,
    agenda: [agendaItem({ id: 'a1', text: 'Book the shoot studio' })],
    personalTasks: [clientTask({ id: 't2', text: 'Chase the logo file' })],
  });
  eq(rows.map(r => r.title), ['Book the shoot studio', 'Chase the logo file'],
    'both, because they are two different things');
  eq(rows[1].sub, 'from your day', 'and the second says where it came from');
});

test('2c. a pointer at another profile, or another month, folds nothing here', () => {
  const rows = taskRows({
    ...TASK_BASE,
    agenda: [agendaItem({ id: 'a1' })],
    personalTasks: [clientTask({
      id: 't1', text: 'Elsewhere',
      linkedAgenda: [{ clientId: 'p2', month: '2026-08', itemId: 'a1' }],
    })],
  });
  eq(rows.length, 2, 'the pointer is not this profile\'s, so it folds nothing');
});

test('2d. a personal task that is not a client task never appears', () => {
  const rows = taskRows({
    ...TASK_BASE, agenda: [],
    personalTasks: [
      clientTask({ id: 't1', text: 'Gym', taskType: 'personal' }),
      clientTask({ id: 't2', text: 'A content piece', taskType: 'content' }),
    ],
  });
  eq(rows, [], 'Logs is the profile\'s memory, not her personal list');
});

test('2e. the legacy single clientId still counts as this profile', () => {
  const rows = taskRows({
    ...TASK_BASE, agenda: [],
    personalTasks: [clientTask({ id: 't1', text: 'Old shape', clientIds: [], clientId: 'p1' })],
  });
  eq(rows.map(r => r.title), ['Old shape'], 'the pre-clientIds tasks are not lost');
});

// ── 3. Missing is missing ────────────────────────────────────────────────────

suite('logs — missing data is shown as missing');

test('3. a task with no date reads "no date", never a zero or a guess', () => {
  const rows = taskRows({
    ...TASK_BASE, personalTasks: [],
    agenda: [agendaItem({ id: 'a1', text: 'Ask for the new logo file' })],
  });
  eq(rows[0].when, 'no date', 'the words say the date is missing');
  eq(rows[0].dot, DOT_QUIET, 'and it is not lit up as if it were due');
});

test('3b. overdue, today and later each say which they are', () => {
  const rows = taskRows({
    ...TASK_BASE, personalTasks: [],
    agenda: [
      agendaItem({ id: 'a1', text: 'Late', dueDate: '2026-08-01' }),
      agendaItem({ id: 'a2', text: 'Today', dueDate: '2026-08-04' }),
      agendaItem({ id: 'a3', text: 'Later', dueDate: '2026-08-06' }),
    ],
  });
  eq(rows.map(r => r.when), ['was due 1 Aug', 'due 4 Aug', 'due 6 Aug'],
    'oldest first, and the slipped one says it slipped');
});

test('3c. a done task sinks, and undated tasks sit under the dated ones', () => {
  const rows = sortRows([
    { id: 'x', dot: '', title: 'Done', sub: '', when: 'done', done: true, day: '2026-08-01' },
    { id: 'y', dot: '', title: 'Undated', sub: '', when: 'no date', done: false, day: '' },
    { id: 'z', dot: '', title: 'Dated', sub: '', when: 'due 2 Aug', done: false, day: '2026-08-02' },
  ] as LogRow[]);
  eq(rows.map(r => r.title), ['Dated', 'Undated', 'Done'], 'open work first, done last');
});

test('3d. a done task says done and wears the done colour', () => {
  const rows = taskRows({
    ...TASK_BASE, personalTasks: [],
    agenda: [agendaItem({ id: 'a1', text: 'Booked', dueDate: '2026-08-01', done: true })],
  });
  eq(rows[0].when, 'done', 'not "was due", because it is not owed any more');
  eq(rows[0].dot, DOT_DONE, 'green');
});

test('3e. a dated open task is lit, an undated one is not', () => {
  const rows = taskRows({
    ...TASK_BASE, personalTasks: [],
    agenda: [agendaItem({ id: 'a1', dueDate: '2026-08-06' })],
  });
  eq(rows[0].dot, DOT_DUE, 'a date means it is owed');
});

test('3f. the date words are the design\'s, and rubbish in gives nothing out', () => {
  eq(shortDay('2026-08-06'), '6 Aug', 'day then short month');
  eq(shortDay('2026-08-06T11:00:00.000Z'), '6 Aug', 'a timestamp is a date too');
  eq(shortDay(''), '', 'nothing in, nothing invented');
  eq(shortDay('not a date'), '', 'and nothing guessed either');
});

// ── 4. Append-only, and "done" as an amendment ───────────────────────────────

suite('logs — decisions and requests are append-only');

test('4. a decision is written, and it is listed', () => {
  const body = addLogEntry(emptyBody('2026-07-28T09:00:00.000Z'), 'decisions', {
    id: 'd1', title: 'Reels drop to one a week', note: 'agreed on the call',
    now: '2026-07-28T09:00:00.000Z',
  });
  const rows = decisionRows(body);
  eq(rows.length, 1, 'one decision, counted from the array it draws');
  eq(rows[0].title, 'Reels drop to one a week', 'her words');
  eq(rows[0].sub, 'agreed on the call', 'and the reason under them');
  eq(rows[0].when, '28 Jul', 'dated the day it was recorded');
  eq(rows[0].dot, DOT_RECORDED, 'ink: a decision is a record, not an alarm');
});

test('4b. marking it done AMENDS it — the birth record is untouched', () => {
  let body = addLogEntry(emptyBody('2026-07-28T09:00:00.000Z'), 'decisions', {
    id: 'd1', title: 'Reels drop to one a week', now: '2026-07-28T09:00:00.000Z',
  });
  body = markLogEntryDone(body, 'decisions', 'd1', { now: '2026-08-04T10:00:00.000Z' });

  const stored = body.paths['work-log/logs/decisions'][0];
  eq((stored.data as { title: string; done: boolean }).title, 'Reels drop to one a week',
    'the words it was born with');
  eq((stored.data as { done: boolean }).done, false,
    'the birth record still says what it said on the day');
  eq(stored.amendments?.length, 1, 'the change lives on top of it');
  eq(foldEntry(stored).done, true, 'and folding the amendments is what reading means');
  eq(foldEntry(stored).doneAt, '2026-08-04T10:00:00.000Z', 'with its own date');
});

test('4c. marking it done twice writes nothing the second time', () => {
  let body = addLogEntry(emptyBody(), 'decisions', { id: 'd1', title: 'One a week' });
  body = markLogEntryDone(body, 'decisions', 'd1', { now: '2026-08-04T10:00:00.000Z' });
  const after = markLogEntryDone(body, 'decisions', 'd1', { now: '2026-08-05T10:00:00.000Z' });
  eq(after.paths['work-log/logs/decisions'][0].amendments?.length, 1,
    'doing something twice is not two events');
  ok(after === body, 'and nothing was rewritten at all');
});

test('4d. the tree refuses a second write at the same id (append-only)', () => {
  const body = addLogEntry(emptyBody(), 'decisions', { id: 'd1', title: 'One a week' });
  throws(() => addLogEntry(body, 'decisions', { id: 'd1', title: 'Two a week' }),
    'append-only', 'a decision cannot quietly change its own wording');
});

test('4e. an empty decision is refused before it reaches the tree', () => {
  throws(() => addLogEntry(emptyBody(), 'decisions', { id: 'd1', title: '   ' }),
    'needs something written in it', 'a blank record is worse than none');
});

test('4f. a request ages, in whole days, counted from its own date', () => {
  const body = addLogEntry(emptyBody(), 'requests', {
    id: 'r1', title: 'Three testimonial screenshots',
    now: '2026-07-24T09:00:00.000Z',
  });
  const rows = requestRows(body, '2026-08-04');
  eq(rows[0].when, 'open 11 days', 'eleven days, counted, not typed');
  eq(rows[0].dot, DOT_WAITING, 'the overdue colour, because it is owed');
  eq(rows[0].sub, 'waiting', 'and it says so');
});

test('4g. one day is one day, and today is today', () => {
  eq(openFor('2026-08-03T00:00:00.000Z', '2026-08-04'), 'open 1 day', 'singular');
  eq(openFor('2026-08-04T00:00:00.000Z', '2026-08-04'), 'asked today', 'not "open 0 days"');
  eq(openFor('', '2026-08-04'), 'no date', 'a missing date is missing, not zero');
  eq(daysBetween('2026-08-01', '2026-08-04'), 3, 'plain arithmetic');
  eq(daysBetween('nonsense', '2026-08-04'), null, 'and it refuses to guess');
});

test('4h. a received request says when it came in, from the amendment', () => {
  let body = addLogEntry(emptyBody(), 'requests', {
    id: 'r1', title: 'Founder photo', now: '2026-07-24T09:00:00.000Z',
  });
  body = markLogEntryDone(body, 'requests', 'r1', { now: '2026-07-30T12:00:00.000Z' });
  const rows = requestRows(body, '2026-08-04');
  eq(rows[0].when, 'received 30 Jul', 'the day it arrived, not today');
  eq(rows[0].dot, DOT_DONE, 'and it stops being owed');
});

test('4i. newest first, because a log is read from the top', () => {
  let body = addLogEntry(emptyBody(), 'decisions', {
    id: 'd1', title: 'Older', now: '2026-07-19T09:00:00.000Z',
  });
  body = addLogEntry(body, 'decisions', {
    id: 'd2', title: 'Newer', now: '2026-07-28T09:00:00.000Z',
  });
  eq(decisionRows(body).map(r => r.title), ['Newer', 'Older'], 'newest at the top');
});

test('4j. marking something that is not there is an error, not a silent no-op', () => {
  throws(() => markLogEntryDone(emptyBody(), 'requests', 'ghost'),
    'no entry ghost', 'it says which id it could not find');
});

test('4k. an empty log is empty, not a zero dressed up as work', () => {
  eq(decisionRows(undefined), [], 'no body at all');
  eq(requestRows(emptyBody(), '2026-08-04'), [], 'a body with nothing in it');
});

// ── 5. Notes: this profile\'s, and only this profile\'s ───────────────────────

suite('logs — notes are per profile and private');

test('5. only notes carrying this profile\'s tag are read', () => {
  const rows = noteRows({
    profileId: 'p1',
    observations: [
      note({ id: 'o1', text: 'About this one', clientId: 'p1' }),
      note({ id: 'o2', text: 'About another', clientId: 'p2' }),
      note({ id: 'o3', text: 'Untagged, the frozen inbox', clientId: undefined }),
    ],
  });
  eq(rows.map(r => r.title), ['About this one'],
    'not another profile\'s, and not the untagged inbox');
});

test('5b. a migrated note and its legacy twin are ONE row', () => {
  // Migration copies the notebook into the body under the SAME ids and leaves
  // the notebook standing. Reading both without merging would show every note
  // on a migrated profile twice.
  let body = emptyBody();
  body = {
    ...body,
    paths: {
      'work-log/logs/observations': [{
        id: 'o1', path: 'work-log/logs/observations', type: 'observation',
        state: 'active', data: { topic: 'Reels', text: 'From the body' },
        created_at: '2026-08-02T00:00:00.000Z', updated_at: '2026-08-02T00:00:00.000Z',
      }],
    },
  };
  const rows = noteRows({
    profileId: 'p1', body,
    observations: [note({ id: 'o1', text: 'From the notebook' })],
  });
  eq(rows.length, 1, 'one note, one home');
  eq(rows[0].title, 'From the body', 'and the migrated copy is the one that wins');
});

test('5c. an unmigrated profile still reads its notes', () => {
  const rows = noteRows({
    profileId: 'p1',
    observations: [note({ id: 'o1', text: 'Says yes to a real photograph', topic: 'Taste' })],
  });
  eq(rows[0].title, 'Says yes to a real photograph', 'the note');
  eq(rows[0].sub, 'Taste', 'and its topic under it');
  eq(rows[0].when, '2 Aug', 'dated');
  eq(rows[0].dot, DOT_QUIET, 'quiet: a note is not a task');
});

test('5d. newest first', () => {
  const rows = noteRows({
    profileId: 'p1',
    observations: [
      note({ id: 'o1', text: 'Older', createdAt: '2026-07-21T00:00:00.000Z' }),
      note({ id: 'o2', text: 'Newer', createdAt: '2026-08-02T00:00:00.000Z' }),
    ],
  });
  eq(rows.map(r => r.title), ['Newer', 'Older'], 'the top of the list is the latest');
});

test('5e. a note written into a migrated body reads back from it', () => {
  const body = addNote(emptyBody(), {
    id: 'n1', text: 'Answers fastest on Tuesday evenings', topic: 'Client calls',
    now: '2026-08-04T09:00:00.000Z',
  });
  const rows = noteRows({ profileId: 'p1', body, observations: [] });
  eq(rows.map(r => `${r.title} / ${r.sub} / ${r.when}`),
    ['Answers fastest on Tuesday evenings / Client calls / 4 Aug'],
    'the note, its topic and its day');
});

test('5f. a blank note is refused', () => {
  throws(() => addNote(emptyBody(), { id: 'n1', text: '  ' }),
    'needs something written in it', 'nothing is not an observation');
});

// ── 6. Counted, never stated ─────────────────────────────────────────────────

suite('logs — counted, never stated');

test('6. singular and plural, both', () => {
  eq(counted(1, 'task'), '1 task', 'one');
  eq(counted(0, 'decision'), '0 decisions', 'none');
  eq(counted(4, 'request'), '4 requests', 'many');
});

test('6b. the count of a tab is the length of the array it draws', () => {
  const rows = taskRows({
    ...TASK_BASE,
    agenda: [agendaItem({ id: 'a1' }), agendaItem({ id: 'a2' })],
    personalTasks: [clientTask({ id: 't1' })],
  });
  eq(counted(rows.length, 'task'), '3 tasks', 'three rows means three, never a stored number');
});
