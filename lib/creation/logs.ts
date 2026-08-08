// Logs — the restructure handoff, "CREATION → Logs".
//
//   "The profile's memory of everything that is not content."
//
// Five screens on one segmented control: Tasks · Decisions · Requests ·
// Pipelines · Notes. Five old tabs land in them — the Dashboard agenda, Lists,
// Cold calls, Orders, Saved replies, Observations — and nothing gets a second
// home on the way.
//
// Everything countable or orderable that the screen says out loud is computed
// HERE, from the array it describes, and the screen only draws it. That is the
// handoff's standing rule: "Every count shown in copy is derived from the array
// it describes. No headline states a number that is not counted from the same
// data at render time."
//
// Pure, no React. Relative extensioned imports for the runtime ones, so this
// module also runs under plain Node in the tests, where `@/` does not exist and
// only type imports are erased.

import type { AgendaItem, Observation, PersonalTask } from '@/types';
import type { PathState } from '../tree/contract.ts';
import type { ProfileBody } from '../tree/body.ts';
import type { BodyEntry } from '../tree/objects.ts';
import { amendEntry, putEntry } from '../tree/body.ts';
import { containerState } from '../tree/render.ts';

// ── The five, and what each one is for ───────────────────────────────────────

export type LogTabId = 'tasks' | 'decisions' | 'requests' | 'pipelines' | 'notes';

export const LOG_TAB_ORDER: LogTabId[] = ['tasks', 'decisions', 'requests', 'pipelines', 'notes'];

export const LOG_TAB_LABELS: Record<LogTabId, string> = {
  tasks: 'Tasks',
  decisions: 'Decisions',
  requests: 'Requests',
  pipelines: 'Pipelines',
  notes: 'Notes',
};

/**
 * One plain line per tab saying what lives there. Straight out of the
 * prototype, word for word: it is the difference between a log and a drawer
 * everything got dropped into.
 */
export const LOG_FOOTNOTES: Record<LogTabId, string> = {
  tasks: 'Everything that is not a post. Written as you work, never asked for twice.',
  decisions: 'What was agreed, and when. The profile remembers so you do not have to.',
  requests: 'What you are waiting on from them. Ageing is shown, chasing is not automatic.',
  pipelines: 'Any list with its own stages. Switched on only where it is used.',
  notes: 'Private to you. A client login never reaches this.',
};

/** What each tab is governed by. Nothing here invents a switch. */
export const LOG_TAB_SWITCHES: Record<LogTabId, string[]> = {
  tasks: ['logs.tasks'],
  decisions: ['logs.decisions'],
  requests: ['logs.requests'],
  pipelines: ['logs.pipelines.lists', 'logs.pipelines.cold_calls',
    'logs.pipelines.orders', 'creation.funnel_replies'],
  notes: ['logs.observations'],
};

/**
 * Pipelines: every per-client one-off list, in one place. Each is an existing
 * screen behind the switch its own spec registered, and a profile that does not
 * use one simply does not have it — off means absent (handoff rule 3).
 */
export interface PipelineDef {
  id: string;
  label: string;
  switchId: string;
}

export const PIPELINES: PipelineDef[] = [
  { id: 'lists', label: 'Lists', switchId: 'logs.pipelines.lists' },
  { id: 'cold-calls', label: 'Cold calls', switchId: 'logs.pipelines.cold_calls' },
  { id: 'orders', label: 'Orders', switchId: 'logs.pipelines.orders' },
  { id: 'replies', label: 'Saved replies', switchId: 'creation.funnel_replies' },
];

export interface LiveTab<T> {
  item: T;
  state: Exclude<PathState, 'hidden'>;
}

/**
 * The tabs that exist, in the design's order, with the state each resolves to.
 * `resolve` is `renderState(profile, switchId, role)` — this module never reads
 * a switch position itself (spec 28 §17.5).
 *
 * A tab whose switches all resolve `hidden` is NOT in the list: no disabled
 * tab, no "not available for this client". `history` stays, read-only, because
 * switching something off never throws it away (S9).
 */
export function liveLogTabs(
  resolve: (switchId: string) => PathState,
): LiveTab<{ id: LogTabId; label: string }>[] {
  const out: LiveTab<{ id: LogTabId; label: string }>[] = [];
  for (const id of LOG_TAB_ORDER) {
    const state = containerState(LOG_TAB_SWITCHES[id].map(resolve));
    if (state === 'hidden') continue;
    out.push({ item: { id, label: LOG_TAB_LABELS[id] }, state });
  }
  return out;
}

/** The pipelines this profile actually uses. Same rule, one level down. */
export function livePipelines(
  resolve: (switchId: string) => PathState,
): LiveTab<PipelineDef>[] {
  const out: LiveTab<PipelineDef>[] = [];
  for (const p of PIPELINES) {
    const state = resolve(p.switchId);
    if (state === 'hidden') continue;
    out.push({ item: p, state });
  }
  return out;
}

// ── The row the design draws ─────────────────────────────────────────────────

/** 8px status dot, title 15px/600, sub-line 12.5px, when 12px tabular. */
export interface LogRow {
  id: string;
  /** The dot's colour, already decided. */
  dot: string;
  title: string;
  sub: string;
  /** The words on the right. Never blank: a missing date says "no date". */
  when: string;
  done: boolean;
  /** yyyy-mm-dd, or '' when there is no date. What the list is ordered by. */
  day: string;
  /** A task that can be ticked where it stands. */
  agendaItemId?: string;
  /** A body entry that can be marked done. */
  entryId?: string;
}

export const DOT_DONE = '#1a7f4b';
export const DOT_DUE = '#ea4711';
export const DOT_WAITING = '#c2410c';
export const DOT_QUIET = '#9b95a1';
export const DOT_RECORDED = '#1c1a21';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-08-06" → "6 Aug". Anything that is not a date gives ''. */
export function shortDay(value: string | undefined): string {
  const day = String(value ?? '').slice(0, 10);
  if (!DAY.test(day)) return '';
  const [, m, d] = day.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
}

/** Whole days between two yyyy-mm-dd days, or null if either is missing. */
export function daysBetween(from: string | undefined, to: string | undefined): number | null {
  const a = String(from ?? '').slice(0, 10);
  const b = String(to ?? '').slice(0, 10);
  if (!DAY.test(a) || !DAY.test(b)) return null;
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * How long a request has been open, counted from its own date. A request with
 * no date reads "no date" — never "0 days", which would be a zero standing in
 * for something missing (handoff rule 7).
 */
export function openFor(since: string | undefined, today: string): string {
  const n = daysBetween(since, today);
  if (n === null) return 'no date';
  if (n <= 0) return 'asked today';
  return n === 1 ? 'open 1 day' : `open ${n} days`;
}

/** English, counted. `counted(1, 'task')` → "1 task". */
export function counted(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Not done first, dated before undated, oldest date first. Done sinks to the
 * bottom in the order it arrived. Sorted on the DAY and never on the words, so
 * "due 6 Aug" and "was due 6 Aug" cannot be pulled apart by their first letter.
 */
export function sortRows(rows: LogRow[]): LogRow[] {
  return rows
    .map((r, i) => ({ r, i }))
    .sort((x, y) => {
      if (x.r.done !== y.r.done) return Number(x.r.done) - Number(y.r.done);
      if (x.r.done) return x.i - y.i;
      const xUndated = x.r.day ? 0 : 1;
      const yUndated = y.r.day ? 0 : 1;
      if (xUndated !== yUndated) return xUndated - yUndated;
      const byDay = x.r.day.localeCompare(y.r.day);
      return byDay !== 0 ? byDay : x.i - y.i;
    })
    .map(({ r }) => r);
}

// ── Tasks ────────────────────────────────────────────────────────────────────

export interface TaskInput {
  profileId: string;
  /** yyyy-MM — the month whose agenda is on screen. */
  month: string;
  /** yyyy-mm-dd. The caller decides what today means. */
  today: string;
  agenda: AgendaItem[];
  personalTasks: PersonalTask[];
}

function tasksForProfile(tasks: PersonalTask[], profileId: string): PersonalTask[] {
  return tasks.filter(t =>
    t.taskType === 'client-task' &&
    ((t.clientIds ?? []).includes(profileId) || t.clientId === profileId));
}

/**
 * The profile's tasks: this month's agenda, plus the client-task half of her
 * day that is about this profile.
 *
 * These are ONE truth with two views (spec 01's `linkedAgenda`): a client task
 * on her day POINTS at an agenda item here. So an agenda item that a task
 * already points at is drawn ONCE — the agenda row, saying it is on her day
 * too. Drawing both would be the same task twice under two names, which is the
 * "one thing, one home" rule broken in the most confusing way available.
 */
export function taskRows(input: TaskInput): LogRow[] {
  const { profileId, month, today, agenda, personalTasks } = input;
  const rows: LogRow[] = [];

  const agendaIds = new Set(agenda.map(a => a.id));
  const mine = tasksForProfile(personalTasks, profileId);

  // Which agenda items her day is already pointing at, and which tasks those
  // pointers belong to.
  const mirrored = new Set<string>();
  const foldedTasks = new Set<string>();
  for (const t of mine) {
    for (const link of t.linkedAgenda ?? []) {
      if (link.clientId !== profileId || link.month !== month) continue;
      if (!agendaIds.has(link.itemId)) continue;
      mirrored.add(link.itemId);
      foldedTasks.add(t.id);
    }
  }

  for (const a of agenda) {
    const day = String(a.dueDate ?? '').slice(0, 10);
    const dated = DAY.test(day);
    rows.push({
      id: `agenda:${a.id}`,
      agendaItemId: a.id,
      dot: a.done ? DOT_DONE : dated ? DOT_DUE : DOT_QUIET,
      title: a.text || 'Untitled task',
      sub: mirrored.has(a.id) ? 'client task, also on your day' : 'client task',
      when: whenFor(a.done, dated ? day : '', today),
      done: a.done,
      day: dated ? day : '',
    });
  }

  for (const t of mine) {
    if (foldedTasks.has(t.id)) continue;
    const day = String(t.dueDate ?? '').slice(0, 10);
    const dated = DAY.test(day);
    rows.push({
      id: `task:${t.id}`,
      dot: t.done ? DOT_DONE : dated ? DOT_DUE : DOT_QUIET,
      title: t.text || 'Untitled task',
      sub: 'from your day',
      when: whenFor(t.done, dated ? day : '', today),
      done: t.done,
      day: dated ? day : '',
    });
  }

  return sortRows(rows);
}

function whenFor(done: boolean, day: string, today: string): string {
  if (done) return 'done';
  if (!day) return 'no date';
  return day < today ? `was due ${shortDay(day)}` : `due ${shortDay(day)}`;
}

// ── Decisions and Requests ───────────────────────────────────────────────────
//
// Spec 21 §8.8 addresses both, and both paths are already declared and
// append-only. Append-only is the point: a decision that quietly changed its
// own wording later is worthless as a record. So nothing is ever overwritten —
// "done" arrives as an AMENDMENT on top of the birth record, and reading an
// entry means folding its amendments over its data, newest last.

export const DECISIONS_PATH = 'work-log/logs/decisions';
export const REQUESTS_PATH = 'work-log/logs/requests';

export type LogEntryKind = 'decisions' | 'requests';

export const LOG_ENTRY_PATHS: Record<LogEntryKind, string> = {
  decisions: DECISIONS_PATH,
  requests: REQUESTS_PATH,
};

/** The declaration's own `entry_type`. putEntry refuses anything else. */
export const LOG_ENTRY_TYPES: Record<LogEntryKind, string> = {
  decisions: 'decision',
  requests: 'request',
};

export interface LogEntryData {
  title?: string;
  note?: string;
  done?: boolean;
  [key: string]: unknown;
}

export interface FoldedEntry {
  id: string;
  data: LogEntryData;
  created_at: string;
  done: boolean;
  /** When it was marked done, from the amendment that did it. */
  doneAt: string | null;
}

/** The birth record with every amendment folded over it, in order. */
export function foldEntry(entry: BodyEntry): FoldedEntry {
  let data: LogEntryData = { ...(entry.data as LogEntryData) };
  let doneAt: string | null = null;
  for (const a of entry.amendments ?? []) {
    data = { ...data, ...(a.changed as LogEntryData) };
    if ((a.changed as LogEntryData).done === true) doneAt = a.at;
  }
  return {
    id: entry.id,
    data,
    created_at: String(entry.created_at ?? ''),
    done: data.done === true,
    doneAt,
  };
}

function entriesAt(body: ProfileBody | undefined, path: string): FoldedEntry[] {
  return (body?.paths?.[path] ?? []).map(foldEntry);
}

function titleOf(e: FoldedEntry): string {
  const t = typeof e.data.title === 'string' ? e.data.title.trim() : '';
  return t || 'Untitled';
}

function noteOf(e: FoldedEntry): string {
  return typeof e.data.note === 'string' ? e.data.note.trim() : '';
}

/** What was agreed, and when. Newest first: a log is read from the top. */
export function decisionRows(body: ProfileBody | undefined): LogRow[] {
  return entriesAt(body, DECISIONS_PATH)
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(e => ({
      id: `decision:${e.id}`,
      entryId: e.id,
      dot: e.done ? DOT_DONE : DOT_RECORDED,
      title: titleOf(e),
      sub: noteOf(e) || 'agreed',
      when: shortDay(e.created_at) || 'no date',
      done: e.done,
      day: String(e.created_at).slice(0, 10),
    }));
}

/** What you are waiting on. The ageing is counted, never typed in. */
export function requestRows(body: ProfileBody | undefined, today: string): LogRow[] {
  return entriesAt(body, REQUESTS_PATH)
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(e => ({
      id: `request:${e.id}`,
      entryId: e.id,
      dot: e.done ? DOT_DONE : DOT_WAITING,
      title: titleOf(e),
      sub: noteOf(e) || (e.done ? 'received' : 'waiting'),
      when: e.done
        ? (shortDay(e.doneAt ?? '') ? `received ${shortDay(e.doneAt ?? '')}` : 'received')
        : openFor(e.created_at, today),
      done: e.done,
      day: String(e.created_at).slice(0, 10),
    }));
}

/**
 * Write one. `putEntry` is the door: it refuses an undeclared path, a writer
 * the path never declared, the wrong entry type, and any overwrite of an
 * append-only record. None of that is re-checked here — one door, one check.
 */
export function addLogEntry(
  body: ProfileBody,
  kind: LogEntryKind,
  input: { id: string; title: string; note?: string; now?: string },
): ProfileBody {
  const title = input.title.trim();
  if (!title) throw new Error('[logs] a log entry needs something written in it');
  const note = (input.note ?? '').trim();
  return putEntry(body, LOG_ENTRY_PATHS[kind], {
    id: input.id,
    type: LOG_ENTRY_TYPES[kind],
    data: { title, ...(note ? { note } : {}), done: false },
  }, { writer: 'owner', now: input.now });
}

/**
 * Mark one done. An amendment, because the path is append-only: the birth
 * record stays exactly as it was written and the change sits on top of it, with
 * its own date.
 *
 * Marking something done twice is not an event, so it writes nothing.
 */
export function markLogEntryDone(
  body: ProfileBody,
  kind: LogEntryKind,
  entryId: string,
  opts: { now?: string; by?: string } = {},
): ProfileBody {
  const path = LOG_ENTRY_PATHS[kind];
  const entry = (body.paths?.[path] ?? []).find(e => e.id === entryId);
  if (!entry) throw new Error(`[logs] no entry ${entryId} at "${path}"`);
  if (foldEntry(entry).done) return body;
  return amendEntry(body, path, entryId, {
    at: opts.now ?? new Date().toISOString(),
    by: opts.by ?? 'owner',
    note: kind === 'requests' ? 'Received' : 'Done',
    changed: { done: true },
  });
}

// ── Notes ────────────────────────────────────────────────────────────────────

export const OBSERVATIONS_PATH = 'work-log/logs/observations';

export interface NoteInput {
  profileId: string;
  body?: ProfileBody;
  /** The legacy owner-level notebook. Only this profile's tagged ones are read. */
  observations: Observation[];
}

/**
 * Her notes on THIS profile, and no one else's.
 *
 * Two places hold them mid-cutover: a migrated profile's body carries them at
 * `work-log/logs/observations`, and the legacy notebook still holds the same
 * rows under the same ids (migration copies, it does not delete). So they are
 * merged BY ID with the body winning — one note, one row, whichever half of the
 * cutover a profile is in.
 *
 * The untagged inbox is frozen and is not read here at all: a note with no tag
 * belongs to no profile, and nothing inside a profile may name another.
 */
export function noteRows(input: NoteInput): LogRow[] {
  const { profileId, body, observations } = input;
  const rows: LogRow[] = [];
  const seen = new Set<string>();

  for (const e of entriesAt(body, OBSERVATIONS_PATH)) {
    seen.add(e.id);
    const text = typeof e.data.text === 'string' ? e.data.text.trim() : '';
    const topic = typeof e.data.topic === 'string' ? e.data.topic.trim() : '';
    const at = typeof e.data.created_at === 'string' && e.data.created_at
      ? e.data.created_at
      : e.created_at;
    rows.push({
      id: `note:${e.id}`,
      entryId: e.id,
      dot: DOT_QUIET,
      title: text || 'Untitled note',
      sub: topic || 'about the client',
      when: shortDay(at) || 'no date',
      done: false,
      day: String(at).slice(0, 10),
    });
  }

  for (const o of observations) {
    if (o.clientId !== profileId || seen.has(o.id)) continue;
    rows.push({
      id: `note:${o.id}`,
      dot: DOT_QUIET,
      title: (o.text ?? '').trim() || 'Untitled note',
      sub: (o.topic ?? '').trim() || 'about the client',
      when: shortDay(o.createdAt) || 'no date',
      done: false,
      day: String(o.createdAt ?? '').slice(0, 10),
    });
  }

  // Newest first. A note has no due date; its date is when it was noticed.
  return rows.sort((a, b) => b.day.localeCompare(a.day));
}

/**
 * Write a note into a migrated profile's own body, which is where notes live
 * once a profile has moved. A profile that has not moved yet keeps writing to
 * the legacy notebook — the screen decides which, `noteRows` reads both.
 */
export function addNote(
  body: ProfileBody,
  input: { id: string; text: string; topic?: string; now?: string },
): ProfileBody {
  const text = input.text.trim();
  if (!text) throw new Error('[logs] a note needs something written in it');
  const topic = (input.topic ?? '').trim();
  const now = input.now ?? new Date().toISOString();
  return putEntry(body, OBSERVATIONS_PATH, {
    id: input.id,
    type: 'observation',
    data: { text, ...(topic ? { topic } : {}), created_at: now },
  }, { writer: 'owner', now });
}
