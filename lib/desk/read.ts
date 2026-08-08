// The desk chat's READ tools — spec 30 §3.1. What the chat can FIND.
//
// THE TWO LAWS (spec 30 §2), and every function here obeys both.
//
//  1. Nothing is reached without an address. Every read resolves to a declared
//     path in `lib/tree/`, and a folder this profile has switched OFF is not
//     read around. It is refused, by name, with the switch named.
//
//  2. Every number is computed here; the model only words it. These functions
//     return FINAL numbers and typed shapes. There is no English in a return
//     value — no headline, no sentence, no "you have posted eight". A refusal is
//     a REASON CODE, not an apology. Wording is the model's job. Counting is not.
//
// One more rule, from the desk: nothing is counted twice. The five standing
// questions are `lib/shell/desk.ts` and `acrossProfiles` calls them. The board
// counts are `stageCounts` in `lib/shell/shelf.ts` and `lib/desk/status.ts`
// calls that. This file adds exactly one walk of its own — the task walk — and
// `tests/desk.read.test.ts` pins it to `composeTodayStrip` so the two can never
// disagree about what is overdue.
//
// Pure: state in, values out. No fetch, no clock, no randomness. Every function
// that needs a date takes `today`.
//
// Relative, extensioned imports: this module runs under plain Node in the tests.

import type { AppState, ClientData } from '@/types';
import type { BodyEntry, PieceStage, SeedStatus } from '../tree/objects.ts';
import { renderState } from '../tree/render.ts';
import { renderProfile } from '../shell/profile.ts';
import {
  answerLocks, answerQuiet, answerReview, answerToday, answerWeek,
} from '../shell/desk.ts';
import type { DeskAnswer, DeskRow } from '../shell/desk.ts';
import { composeTodayStrip, daysBetween } from '../shell/shelf.ts';
import type { ProfileRef, ProfileStatusShape } from './status.ts';
import { computeStatus, frozenAt, monthOf, pieceEntries, profileRef } from './status.ts';

export type { ProfileRef, ProfileStatusShape } from './status.ts';

const PIECES = 'work-log/creation';
const TASKS = 'work-log/logs/tasks';
const SEEDS = 'work-log/creation/topics';

/** The switch that governs each folder this file reads. Law one, in a table. */
const SWITCH = {
  pieces: 'creation.board',
  tasks: 'logs.tasks',
  seeds: 'creation.engine',
} as const;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;

// ── Refusals ─────────────────────────────────────────────────────────────────
//
// Spec 30 §3.2's refusal rule, applied to the read half: when a tool cannot do
// the thing, it says WHICH, in a code, and stops. It never returns a half answer
// and never quietly returns zero for something it could not see — a zero and a
// closed door are different facts and the model must be able to tell them apart.

export type RefusalReason =
  /** No profile with that id exists in the state this login was given. */
  | 'no-such-profile'
  /** The profile exists but has never been migrated, so it has no addresses. */
  | 'no-body'
  /** The folder is switched off (or dropped to hidden by the cascade). */
  | 'switched-off'
  /** The filter itself was not usable — a month that is not a month, and so on. */
  | 'bad-filter';

export interface Refusal {
  ok: false;
  reason: RefusalReason;
  profile_id: string | null;
  /** The switch that closed the door, when that is the reason. */
  switch_id?: string;
  /** The declared path that was asked for. */
  path?: string;
  /** The filter field that was not usable, when that is the reason. */
  field?: string;
}

function refuse(reason: RefusalReason, profileId: string | null, extra: Partial<Refusal> = {}): Refusal {
  return { ok: false, reason, profile_id: profileId, ...extra };
}

/**
 * Law one at the door: the profile exists, it has a body, and the folder is not
 * switched off. Returns the profile's data, or the refusal that stops the read.
 */
function open(
  state: AppState, profileId: string, folder: keyof typeof SWITCH, path: string,
): { data: ClientData; ref: ProfileRef } | Refusal {
  const client = (state.clients ?? []).find(c => c.id === profileId);
  if (!client) return refuse('no-such-profile', profileId);
  const data = state.clientData?.[profileId];
  if (!data?.body) return refuse('no-body', profileId, { path });
  const switchId = SWITCH[folder];
  if (renderState(renderProfile(state, profileId, 'owner'), switchId, 'owner') === 'hidden') {
    return refuse('switched-off', profileId, { switch_id: switchId, path });
  }
  return { data, ref: profileRef(client) };
}

function isRefusal(v: unknown): v is Refusal {
  return !!v && typeof v === 'object' && (v as { ok?: unknown }).ok === false;
}

// ── find_profile ─────────────────────────────────────────────────────────────

/** How the name she typed was matched. The model may say so when it helps. */
export type MatchKind = 'exact' | 'prefix' | 'contains' | 'only-one';

export type FindProfileResult =
  | { ok: true; match: MatchKind; profile: ProfileRef }
  /** Two or more matched equally well. This is an ANSWER, not a failure. */
  | { ok: false; reason: 'ambiguous'; typed: string; candidates: ProfileRef[] }
  | { ok: false; reason: 'no-match'; typed: string; known: ProfileRef[] };

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * What she typed → ONE profile id.
 *
 * It never picks when two match. Four tiers are tried in order — the profile
 * id, an exact name, a name that starts with what she typed, a name that
 * contains it — and the FIRST tier with any hits decides. One hit is the answer;
 * two or more is `ambiguous`, and the caller asks her which. A coin flip here
 * would put a piece on the wrong client's board, which is the one failure this
 * whole spec exists to prevent.
 */
export function findProfile(state: AppState, name: string): FindProfileResult {
  const all = (state.clients ?? []).map(profileRef);
  const typed = norm(name ?? '');

  if (!typed) {
    return all.length === 1
      ? { ok: true, match: 'only-one', profile: all[0] }
      : { ok: false, reason: 'no-match', typed: name ?? '', known: all };
  }

  const byId = all.filter(p => norm(p.id) === typed);
  const exact = all.filter(p => norm(p.name) === typed);
  const prefix = all.filter(p => norm(p.name).startsWith(typed) || norm(p.id).startsWith(typed));
  const contains = all.filter(p => norm(p.name).includes(typed) || norm(p.id).includes(typed));

  const tiers: [MatchKind, ProfileRef[]][] = [
    ['exact', byId],
    ['exact', exact],
    ['prefix', prefix],
    ['contains', contains],
  ];

  for (const [kind, hits] of tiers) {
    if (hits.length === 1) return { ok: true, match: kind, profile: hits[0] };
    if (hits.length > 1) return { ok: false, reason: 'ambiguous', typed: name, candidates: hits };
  }
  return { ok: false, reason: 'no-match', typed: name, known: all };
}

// ── profile_status ───────────────────────────────────────────────────────────

export type ProfileStatusResult = ({ ok: true } & ProfileStatusShape) | Refusal;

/**
 * Her example 4, whole. Every number in it is computed in `lib/desk/status.ts`
 * and every one of them has a test beside it.
 *
 * `today` is injected. 'YYYY-MM-DD' gives a day and a month; 'YYYY-MM' gives a
 * month with no day arithmetic, which is what a "how did July go" question is.
 *
 * The board switch gates it: with `creation.board` hidden this refuses rather
 * than reporting a board of zeros that only looks empty because it is shut.
 */
export function profileStatus(state: AppState, profileId: string, today: string): ProfileStatusResult {
  if (!DAY.test(today) && !MONTH.test(today)) {
    return refuse('bad-filter', profileId, { field: 'today' });
  }
  const door = open(state, profileId, 'pieces', PIECES);
  if (isRefusal(door)) {
    // A profile with no body still has a name and a lifecycle, and saying "she
    // has not set this one up yet" is a better answer than saying nothing. The
    // switched-off refusal stands: that door is shut on purpose.
    if (door.reason === 'no-body') {
      const shape = computeStatus(state, profileId, today);
      if (shape) return { ok: true, ...shape };
    }
    return door;
  }
  const shape = computeStatus(state, profileId, today);
  if (!shape) return refuse('no-such-profile', profileId);
  return { ok: true, ...shape };
}

// ── find_pieces ──────────────────────────────────────────────────────────────

export interface PieceFilter {
  /** One stage or several. Absent means every stage. */
  stage?: PieceStage | PieceStage[];
  pillar_id?: string;
  platform?: string;
  format?: string;
  /** 'YYYY-MM', against the piece's own date. */
  month?: string;
  /** 'YYYY-MM-DD', inclusive, against the piece's own date. */
  from?: string;
  to?: string;
  /** Pieces with no date at all. */
  undated?: boolean;
  /** Rows returned. The COUNT is always the true count, dropped rows included. */
  limit?: number;
}

export interface PieceRow {
  id: string;
  title: string;
  hook: string;
  stage: string;
  pillar_id: string | null;
  /** Resolved from the pillar folder. NULL when the pillar no longer exists. */
  pillar_name: string | null;
  platform: string | null;
  format: string | null;
  /** '' when the piece carries no date. Never today's date as a stand-in. */
  date: string;
  live_link: string | null;
  updated_at: string;
}

export interface FindPiecesResult {
  ok: true;
  profile_id: string;
  filter: PieceFilter;
  /** How many matched. Computed here, always, whatever `limit` did to the rows. */
  count: number;
  /** How many are on the board altogether, so a share can be worded honestly. */
  total_on_board: number;
  /** Matching rows, oldest date first, undated last. */
  pieces: PieceRow[];
  /** True when `limit` cut rows off. `count` is still the whole count. */
  truncated: boolean;
}

const DEFAULT_LIMIT = 50;

function stageList(f: PieceFilter): PieceStage[] | null {
  if (!f.stage) return null;
  return Array.isArray(f.stage) ? f.stage : [f.stage];
}

function looseEq(a: string | null, b: string | undefined): boolean {
  if (b === undefined) return true;
  return norm(a ?? '') === norm(b);
}

/**
 * Pieces on ONE profile, filtered. The count is computed over every match, so a
 * capped list never turns into an undercount in the reply.
 */
export function findPieces(
  state: AppState, profileId: string, filter: PieceFilter = {},
): FindPiecesResult | Refusal {
  if (filter.month !== undefined && !MONTH.test(filter.month)) {
    return refuse('bad-filter', profileId, { field: 'month' });
  }
  for (const field of ['from', 'to'] as const) {
    const v = filter[field];
    if (v !== undefined && !DAY.test(v)) return refuse('bad-filter', profileId, { field });
  }
  const door = open(state, profileId, 'pieces', PIECES);
  if (isRefusal(door)) return door;

  const client = (state.clients ?? []).find(c => c.id === profileId);
  const frozen = frozenAt(client);
  const stages = stageList(filter);
  const pillars = new Map(
    pillarNames(door.data).map(p => [p.id, p.name]),
  );

  const rows: PieceRow[] = [];
  let total = 0;
  for (const e of pieceEntries(door.data, frozen)) {
    const d = (e.data ?? {}) as {
      title?: unknown; hook?: unknown; stage?: unknown; scheduled_date?: unknown;
      live_link?: unknown; costume?: { pillar_id?: unknown; platform?: unknown; format?: unknown };
    };
    const stage = typeof d.stage === 'string' ? d.stage : '';
    if (!stage) continue;
    total++;

    const costume = d.costume ?? {};
    const pillarId = typeof costume.pillar_id === 'string' && costume.pillar_id ? costume.pillar_id : null;
    const platform = typeof costume.platform === 'string' && costume.platform ? costume.platform : null;
    const format = typeof costume.format === 'string' && costume.format ? costume.format : null;
    const raw = typeof d.scheduled_date === 'string' ? d.scheduled_date.slice(0, 10) : '';
    const date = DAY.test(raw) ? raw : '';

    if (stages && !stages.includes(stage as PieceStage)) continue;
    if (filter.pillar_id !== undefined && pillarId !== filter.pillar_id) continue;
    if (!looseEq(platform, filter.platform)) continue;
    if (!looseEq(format, filter.format)) continue;
    if (filter.undated === true && date !== '') continue;
    if (filter.undated === false && date === '') continue;
    if (filter.month !== undefined && monthOf(date) !== filter.month) continue;
    if (filter.from !== undefined && (date === '' || date < filter.from)) continue;
    if (filter.to !== undefined && (date === '' || date > filter.to)) continue;

    rows.push({
      id: e.id,
      title: typeof d.title === 'string' ? d.title : '',
      hook: typeof d.hook === 'string' ? d.hook : '',
      stage,
      pillar_id: pillarId,
      pillar_name: pillarId ? (pillars.get(pillarId) ?? null) : null,
      platform,
      format,
      date,
      live_link: typeof d.live_link === 'string' && d.live_link ? d.live_link : null,
      updated_at: e.updated_at,
    });
  }

  rows.sort((a, b) => {
    if (a.date === '' && b.date !== '') return 1;
    if (b.date === '' && a.date !== '') return -1;
    return a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
  });

  const limit = filter.limit ?? DEFAULT_LIMIT;
  const count = rows.length;
  return {
    ok: true,
    profile_id: profileId,
    filter,
    count,
    total_on_board: total,
    pieces: rows.slice(0, limit),
    truncated: count > limit,
  };
}

/** Pillar id → name, for the row label. The definitions live in `status.ts`. */
function pillarNames(data: ClientData): { id: string; name: string }[] {
  const body = data.body;
  if (!body) return [];
  const prefix = 'context/content-strategy/pillars/';
  const out: { id: string; name: string }[] = [];
  for (const path of Object.keys(body.paths)) {
    if (!path.startsWith(prefix) || path.slice(prefix.length).includes('/')) continue;
    for (const e of body.paths[path] ?? []) {
      if (e.state !== 'active') continue;
      const name = (e.data as { name?: unknown })?.name;
      out.push({ id: e.id, name: typeof name === 'string' ? name : '' });
    }
  }
  return out;
}

// ── find_tasks ───────────────────────────────────────────────────────────────

export interface TaskWhen {
  /** Injected. Nothing here reads a clock. */
  today: string;
  /**
   * 'due'  — overdue and due today, which is what "what needs me" means
   * 'week' — those, plus the next seven days
   * 'open' — every task not ticked off, dated or not
   * 'all'  — the ticked ones as well
   */
  scope?: 'due' | 'week' | 'open' | 'all';
}

export interface TaskRow {
  id: string;
  profile_id: string;
  profile_name: string;
  text: string;
  /** '' when the task has no date. Undated is not overdue. */
  due_date: string;
  done: boolean;
  kind: 'client-task' | 'content-task';
  piece_id: string | null;
  /** Whole days past its date. NULL when it is not late or has no date. */
  days_late: number | null;
}

export interface FindTasksResult {
  ok: true;
  /** The profile asked for, or null when the question was across all of them. */
  profile_id: string | null;
  today: string;
  scope: 'due' | 'week' | 'open' | 'all';
  /** Past its date, still open. The separation her example asks for. */
  overdue: TaskRow[];
  due_today: TaskRow[];
  /** Dated, still ahead. Empty unless the scope reaches that far. */
  later: TaskRow[];
  /** Open with no date at all. Not late, not today, not nothing. */
  undated: TaskRow[];
  done: TaskRow[];
  counts: {
    overdue: number; due_today: number; later: number;
    undated: number; done: number; total: number;
  };
  /** How many profiles contributed a row. */
  profiles: number;
  /** Named, never silent: a profile this read could not see, and why. */
  skipped: { profile_id: string; reason: 'no-body' | 'switched-off' }[];
}

/**
 * A tick is an amendment, not an edit (S11): the birth record stays and the
 * latest amendment carrying `done` is what counts. This is `composeTodayStrip`'s
 * own rule, and the test file asserts the two agree on every fixture.
 */
function isDone(e: BodyEntry): boolean {
  const d = (e.data ?? {}) as { done?: unknown };
  return (e.amendments ?? []).reduce(
    (v, a) => ('done' in a.changed ? a.changed.done === true : v), d.done === true);
}

function taskRows(state: AppState, profileId: string): TaskRow[] {
  const client = (state.clients ?? []).find(c => c.id === profileId);
  const data = state.clientData?.[profileId];
  const rows: TaskRow[] = [];
  for (const e of (data?.body?.paths?.[TASKS] ?? [])) {
    if (e.state !== 'active') continue;
    const d = (e.data ?? {}) as { text?: unknown; due_date?: unknown; piece_id?: unknown };
    const raw = typeof d.due_date === 'string' ? d.due_date.slice(0, 10) : '';
    const pieceId = typeof d.piece_id === 'string' && d.piece_id ? d.piece_id : null;
    rows.push({
      id: e.id,
      profile_id: profileId,
      profile_name: client?.name ?? '',
      text: typeof d.text === 'string' ? d.text : '',
      due_date: DAY.test(raw) ? raw : '',
      done: isDone(e),
      kind: pieceId ? 'content-task' : 'client-task',
      piece_id: pieceId,
      days_late: null,
    });
  }
  return rows;
}

/**
 * Tasks and agenda items, on one profile or across every profile. Overdue is
 * kept separate from due today, because "four are late" and "four are today" are
 * different sentences and only the code knows which is which.
 *
 * Across all profiles it never refuses the whole question because one profile is
 * shut: that profile is SKIPPED and named in `skipped`. Asked about ONE profile
 * that is shut, it refuses, because there is nothing honest left to answer.
 */
export function findTasks(
  state: AppState, profileId: string | null, when: TaskWhen,
): FindTasksResult | Refusal {
  const today = when.today;
  if (!DAY.test(today)) return refuse('bad-filter', profileId, { field: 'today' });
  const scope = when.scope ?? 'due';

  const ids = profileId ? [profileId] : (state.clients ?? []).map(c => c.id);
  const skipped: { profile_id: string; reason: 'no-body' | 'switched-off' }[] = [];
  let rows: TaskRow[] = [];

  for (const id of ids) {
    const door = open(state, id, 'tasks', TASKS);
    if (isRefusal(door)) {
      if (profileId) return door;
      if (door.reason === 'no-body' || door.reason === 'switched-off') {
        skipped.push({ profile_id: id, reason: door.reason });
      }
      continue;
    }
    rows = rows.concat(taskRows(state, id));
  }

  const horizon = scope === 'week' ? addDaysLocal(today, 7) : today;

  const overdue: TaskRow[] = [];
  const dueToday: TaskRow[] = [];
  const later: TaskRow[] = [];
  const undated: TaskRow[] = [];
  const done: TaskRow[] = [];

  for (const r of rows) {
    if (r.done) { if (scope === 'all') done.push(r); continue; }
    if (r.due_date === '') {
      if (scope === 'open' || scope === 'all') undated.push(r);
      continue;
    }
    if (r.due_date < today) { overdue.push({ ...r, days_late: daysBetween(r.due_date, today) }); continue; }
    if (r.due_date === today) { dueToday.push(r); continue; }
    if (scope === 'week' && r.due_date <= horizon) { later.push(r); continue; }
    if (scope === 'open' || scope === 'all') later.push(r);
  }

  const byDate = (a: TaskRow, b: TaskRow) => a.due_date.localeCompare(b.due_date) || a.id.localeCompare(b.id);
  overdue.sort(byDate);
  dueToday.sort(byDate);
  later.sort(byDate);
  undated.sort((a, b) => a.id.localeCompare(b.id));

  const total = overdue.length + dueToday.length + later.length + undated.length + done.length;
  const profiles = new Set(
    [...overdue, ...dueToday, ...later, ...undated, ...done].map(r => r.profile_id),
  ).size;

  return {
    ok: true,
    profile_id: profileId,
    today,
    scope,
    overdue, due_today: dueToday, later, undated, done,
    counts: {
      overdue: overdue.length,
      due_today: dueToday.length,
      later: later.length,
      undated: undated.length,
      done: done.length,
      total,
    },
    profiles,
    skipped,
  };
}

/** yyyy-mm-dd plus n days, in UTC. `shelf.ts` owns the same helper for its own use. */
function addDaysLocal(day: string, n: number): string {
  const t = Date.parse(`${day}T00:00:00.000Z`);
  if (Number.isNaN(t)) return day;
  return new Date(t + n * 86400000).toISOString().slice(0, 10);
}

// ── find_seeds ───────────────────────────────────────────────────────────────

export interface SeedRow {
  id: string;
  name: string;
  status: SeedStatus;
  /** 'hers' | 'engine:content' | 'engine:analysis'. NULL on migrated shells. */
  origin: string | null;
  /**
   * A seed with no raw thought is a SUBJECT, not a seed (S24). The bank is full
   * of these after the migration and the difference matters, so it is a field.
   */
  has_raw_thought: boolean;
  possible_pillars: string[];
  updated_at: string;
}

export interface FindSeedsResult {
  ok: true;
  profile_id: string;
  /** The filter that was applied, or null when every status was asked for. */
  status: SeedStatus | null;
  count: number;
  /** The whole bank, by status. Computed over every seed, filter or no filter. */
  by_status: Record<SeedStatus, number>;
  total: number;
  /** How many are subjects rather than seeds — no raw thought yet. */
  without_raw_thought: number;
  seeds: SeedRow[];
}

const SEED_STATUSES: SeedStatus[] = ['draft', 'discussed', 'validated', 'locked'];

/** Seeds in the bank, with their status. Governed by `creation.engine`. */
export function findSeeds(
  state: AppState, profileId: string, status?: SeedStatus,
): FindSeedsResult | Refusal {
  if (status !== undefined && !SEED_STATUSES.includes(status)) {
    return refuse('bad-filter', profileId, { field: 'status' });
  }
  const door = open(state, profileId, 'seeds', SEEDS);
  if (isRefusal(door)) return door;

  const by: Record<SeedStatus, number> = { draft: 0, discussed: 0, validated: 0, locked: 0 };
  const all: SeedRow[] = [];
  for (const e of (door.data.body?.paths?.[SEEDS] ?? [])) {
    if (e.state !== 'active') continue;
    const d = (e.data ?? {}) as {
      name?: unknown; status?: unknown; origin?: unknown;
      raw_thought?: unknown; possible_pillars?: unknown;
    };
    const s = SEED_STATUSES.includes(d.status as SeedStatus) ? (d.status as SeedStatus) : 'draft';
    by[s]++;
    all.push({
      id: e.id,
      name: typeof d.name === 'string' ? d.name : '',
      status: s,
      origin: typeof d.origin === 'string' && d.origin ? d.origin : null,
      has_raw_thought: typeof d.raw_thought === 'string' && d.raw_thought.trim() !== '',
      possible_pillars: Array.isArray(d.possible_pillars)
        ? d.possible_pillars.filter((p): p is string => typeof p === 'string')
        : [],
      updated_at: e.updated_at,
    });
  }

  const seeds = status ? all.filter(s => s.status === status) : all;
  seeds.sort((a, b) => b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id));

  return {
    ok: true,
    profile_id: profileId,
    status: status ?? null,
    count: seeds.length,
    by_status: by,
    total: all.length,
    without_raw_thought: all.filter(s => !s.has_raw_thought).length,
    seeds,
  };
}

// ── across_profiles ──────────────────────────────────────────────────────────

export type StandingKey = 'today' | 'review' | 'locks' | 'quiet' | 'week';

export interface StandingAnswer {
  key: StandingKey;
  /** rows.length. The desk's own rows, counted once. */
  count: number;
  /** How many of them are flagged — late, unlocked, not collecting. */
  flagged: number;
  /** What a flagged row IS, one or two words, straight from `desk.ts`. */
  flag: string;
  /** Distinct profiles the rows come from. */
  profiles: number;
  rows: DeskRow[];
}

export interface AcrossProfilesResult {
  ok: true;
  today: string;
  answers: Record<StandingKey, StandingAnswer>;
}

function standing(key: StandingKey, a: DeskAnswer): StandingAnswer {
  return {
    key,
    count: a.rows.length,
    flagged: a.rows.filter(r => r.late).length,
    flag: a.flag,
    profiles: new Set(a.rows.map(r => r.profile_id)).size,
    rows: a.rows,
  };
}

/**
 * The desk's five standing questions. These are NOT reimplemented here: this
 * calls `answerToday`, `answerReview`, `answerLocks`, `answerQuiet` and
 * `answerWeek` in `lib/shell/desk.ts`, which are the same functions the desk
 * screen draws from. One counter, two mouths.
 *
 * The desk's own composed sentence is deliberately dropped. It exists for the
 * screen; the chat gets the rows and the counts and writes its own line, which
 * is the whole point of law two.
 */
export function acrossProfiles(state: AppState, today: string): AcrossProfilesResult | Refusal {
  if (!DAY.test(today)) return refuse('bad-filter', null, { field: 'today' });
  return {
    ok: true,
    today,
    answers: {
      today: standing('today', answerToday(state, today)),
      review: standing('review', answerReview(state)),
      locks: standing('locks', answerLocks(state)),
      quiet: standing('quiet', answerQuiet(state)),
      week: standing('week', answerWeek(state)),
    },
  };
}

/** Exported for the test that pins the task walk to the desk's own strip. */
export const _internals = { taskRows, isDone, composeTodayStrip };
