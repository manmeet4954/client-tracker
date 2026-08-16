// The shelf's composition — spec 28 §4.
//
// Three blocks, one law between them.
//
// THE CARD LAW (§4.2): a card answers HOW MUCH and WHAT STATE, never WHAT. No
// piece title, hook, caption, seed name, topic, client's words, draft, metric
// value, verdict sentence or note may appear on it. The line is composed per
// profile from that profile's own paths and reduced to COUNTS before it reaches
// the shelf. Nothing cross-profile is stored to make it.
//
// The today strip and the weekly pulse do carry content-shaped lines, and both
// are granted by name in the plan — the strip as her one cross-profile window
// (PLAN §2), the pulse as her private weekly read (PLAN §5.2). The card law
// binds CARDS. Both are composed the same way (spec 27 §13.2's pattern): each
// profile owns its own rows at its own address, and the shelf composes one
// screen. No cross-profile object is stored, ever.

import type { AppState, Client, ClientData } from '@/types';
import type { Lifecycle } from '../tree/objects.ts';
import type { RenderProfile } from '../tree/render.ts';
import { renderState } from '../tree/render.ts';
import { accentFor, isCutOver, renderProfile, shelfGroupOf, staysOnLegacy } from './profile.ts';
import { resolvePiece } from '../engine/resolve.ts';

const PIECES = 'work-log/creation';
const TASKS = 'work-log/logs/tasks';
const DIGESTS = 'work-log/analysis/digests';
const SYNC_HEALTH = 'work-log/analysis/study-own-data/sync-health';
const INTAKE = 'context/intake';

// ── §4.2 The card ────────────────────────────────────────────────────────────

/** The ONLY attention strings a card may carry. A fixed vocabulary, on purpose. */
export const ATTENTION_VOCABULARY = [
  'Intake not sent',
  'Waiting on answers',
  'Strategy not locked',
  'Not collecting',
  'Client access is closed',
  'Connections revoked and the export is ready',
] as const;

export type Attention = string;

/** Spec 26 §6.7: a stall is a fault; a decision is not. Only these raise a line. */
const FAULT_STATUSES = ['error', 'platform-error', 'not-connected', 'permission-refused', 'unknown'];

export interface ShelfCard {
  id: string;
  name: string;
  color: string;
  lifecycle: Lifecycle;
  group: 'hers' | 'clients' | 'archived';
  /** Shown only when the state is not `active`. */
  chip: string | null;
  /** Counts only. Empty when there is nothing to count. */
  status: string;
  /** True while the counts are frozen at the pause date. */
  frozen_at: string | null;
  attention: Attention | null;
  /** §16.3 — one shelf, two destinations, for as long as it takes. */
  href: string;
}

const STAGE_WORDS: [string, string][] = [
  ['idea', 'ideas'],
  ['build', 'in build'],
  ['review', 'in review'],
  ['approved', 'approved'],
  ['scheduled', 'scheduled'],
  ['posted', 'posted'],
];

/**
 * Counts by stage, over this profile's own pieces, reduced before they travel.
 *
 * It reads each stage through `resolvePiece`, NOT off `entry.data.stage`, and
 * that distinction is the whole correctness of this function. `work-log/creation`
 * is append-only: a piece's birth record is never rewritten, so moving a piece
 * writes a dated AMENDMENT beside it. Reading `data.stage` therefore answers
 * where the piece was BORN, not where it is now.
 *
 * While the only thing that moved a piece was a drag on the board, which rewrote
 * the legacy card, nobody could see the difference. The desk chat moves pieces
 * through the tree, so from the day it ships "8 posted, 4 left" would have been
 * answering from birth records and quietly going stale. Her standing rule is
 * that a number she is shown is one she does not have to check.
 */
export function stageCounts(data: ClientData | undefined, before?: string | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of data?.body?.paths?.[PIECES] ?? []) {
    if (before && e.updated_at > before) continue;
    const stage = String(resolvePiece(e).stage ?? '');
    if (!stage) continue;
    out[stage] = (out[stage] ?? 0) + 1;
  }
  return out;
}

/**
 * The same array `stageCounts` walks, read for its DATES instead of its stages —
 * the restructure, phase 6. The desk asks three date questions ("what goes live
 * this week", "what has no date", "who has not posted for the longest") and this
 * is the one place any of them is counted. Nothing recounts a stage here, and no
 * second reduction of the pieces exists anywhere else.
 *
 * Counts and dates only. A piece's own words never leave this function.
 */
export interface PieceClock {
  /** Not posted, dated, and that date falls inside the next seven days. */
  soon: number;
  /** The first of those dates, so a row can say when it starts. */
  next: string | null;
  /** Not posted and carrying no date at all. */
  undated: number;
  /** The latest date on a posted piece. Null is MISSING, never a zero. */
  last_posted: string | null;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** yyyy-mm-dd plus n days, in UTC, so no timezone ever moves a date. */
export function addDays(day: string, n: number): string {
  const t = Date.parse(`${day}T00:00:00.000Z`);
  if (Number.isNaN(t)) return day;
  return new Date(t + n * 86400000).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`. Negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00.000Z`);
  const b = Date.parse(`${to}T00:00:00.000Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86400000);
}

export function pieceClock(
  data: ClientData | undefined, today: string, before?: string | null,
): PieceClock {
  const horizon = addDays(today, 7);
  let soon = 0;
  let next: string | null = null;
  let undated = 0;
  let last: string | null = null;

  for (const e of data?.body?.paths?.[PIECES] ?? []) {
    if (before && e.updated_at > before) continue;
    const d = (e.data ?? {}) as { stage?: unknown; scheduled_date?: unknown };
    const stage = String(d.stage ?? '');
    if (!stage) continue;
    const day = String(d.scheduled_date ?? '').slice(0, 10);
    const dated = DAY.test(day);
    if (stage === 'posted') {
      if (dated && (!last || day > last)) last = day;
      continue;
    }
    if (!dated) { undated++; continue; }
    if (day >= today && day < horizon) {
      soon++;
      if (!next || day < next) next = day;
    }
  }
  return { soon, next, undated, last_posted: last };
}

function statusLine(counts: Record<string, number>): string {
  const parts: string[] = [];
  for (const [stage, word] of STAGE_WORDS) {
    const n = counts[stage] ?? 0;
    if (n > 0) parts.push(`${n} ${word}`);
  }
  // Two or three counts is a pulse; six is a spreadsheet.
  return parts.slice(0, 3).join(' · ');
}

function dayWords(iso: string | undefined | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }).format(d);
}

/** §4.6's chip, per lifecycle state. */
function chipFor(client: Client): string | null {
  const since = dayWords(client.lifecycleAt);
  switch (client.lifecycle) {
    case 'setup': return 'Setting up';
    case 'paused': return since ? `Paused since ${since}` : 'Paused';
    case 'closing': return 'Closing';
    case 'archived': return since ? `Archived ${since}` : 'Archived';
    default: return null;
  }
}

/**
 * The attention line, when there is one. Drawn from the fixed vocabulary above
 * and from this profile's own paths — never from anything inside a piece.
 */
function attentionFor(client: Client, data: ClientData | undefined): Attention | null {
  const body = data?.body;
  if (client.lifecycle === 'archived') return null;
  if (client.lifecycle === 'paused') return 'Client access is closed';
  if (client.lifecycle === 'closing') return 'Connections revoked and the export is ready';

  const rounds = body?.paths?.[INTAKE] ?? [];
  if (client.lifecycle === 'setup') {
    if (rounds.length === 0) return 'Intake not sent';
    const anyOpen = rounds.some(r => String((r.data as { status?: unknown })?.status ?? '') !== 'curated');
    if (anyOpen) return 'Waiting on answers';
    return null;
  }

  // Not collecting since <date> — from sync health, which is where the truth is.
  // `switched-off` and `not-yet-tracked` are DECISIONS, not faults (spec 26 §6.7),
  // so they never raise this line.
  const runs = (body?.paths?.[SYNC_HEALTH] ?? [])
    .map(e => e.data as { connection_status?: string; started_at?: string })
    .filter(d => !!d?.started_at)
    .sort((a, b) => String(a.started_at).localeCompare(String(b.started_at)));
  const latest = runs[runs.length - 1];
  if (latest && FAULT_STATUSES.includes(latest.connection_status ?? '')) {
    const lastOk = [...runs].reverse().find(r => r.connection_status === 'ok');
    const since = dayWords(lastOk?.started_at);
    return since ? `Not collecting since ${since}` : 'Not collecting';
  }

  // "Strategy not locked" USED TO BE RAISED HERE, and it is gone (2026-08-11).
  //
  // Its whole justification was the sentence above it: an unlocked profile had
  // a read-only Creation, so silence would have been a lie. That stopped being
  // true on 2026-08-09, when her ruling made the lock refuse nothing and
  // recording work everywhere. From then it was a warning about a condition
  // that blocks no work, printed in orange, on six of her eight profiles at
  // once. Her words: "it's irritating to see that strategy is not locked. Get
  // rid of it."
  //
  // An attention line has to earn its place by naming something that needs
  // her. This named a preference of the system about itself.
  return null;
}

/**
 * One card. It carries name, colour, lifecycle, counts, and at most one
 * attention string. That is the whole payload, and test §17.7 says so.
 */
export function composeCard(state: AppState, client: Client, role = 'owner'): ShelfCard {
  const data = state.clientData?.[client.id];
  const lifecycle = (client.lifecycle ?? 'active') as Lifecycle;
  const frozen = lifecycle === 'paused' ? (client.lifecycleAt ?? null) : null;
  const showCounts = lifecycle !== 'setup' && lifecycle !== 'archived';
  const kind = (state.bindings ?? []).find(b => b.role === role && b.profileId === client.id)?.kind;
  const newShell = isCutOver(data) && !staysOnLegacy(role, kind);
  return {
    id: client.id,
    name: client.name,
    color: accentFor(client, data),
    lifecycle,
    group: shelfGroupOf(client),
    chip: chipFor(client),
    status: showCounts ? statusLine(stageCounts(data, frozen)) : '',
    frozen_at: frozen,
    attention: attentionFor(client, data),
    href: newShell ? `/profile/${client.id}` : `/client/${client.id}`,
  };
}

/** Her own profiles first, then clients, then a collapsed Archived section. */
export function composeShelf(state: AppState, role = 'owner'): ShelfCard[] {
  const order = { hers: 0, clients: 1, archived: 2 };
  return (state.clients ?? [])
    .map(c => composeCard(state, c, role))
    .sort((a, b) => order[a.group] - order[b.group] || a.name.localeCompare(b.name));
}

// ── §4.3 The today strip ─────────────────────────────────────────────────────

export interface StripRow {
  profile_id: string;
  profile_name: string;
  color: string;
  task_id: string;
  text: string;
  due_date: string;
  overdue: boolean;
  /** A content task points at a piece; it READS the piece and never copies it (S2). */
  kind: 'client-task' | 'content-task';
}

/**
 * The surviving half of My Day. Client tasks and content tasks, from every
 * profile, due today or overdue. PERSONAL TASKS ARE GONE — they left with the
 * personal half (PLAN §7), and the structural reason they cannot come back is
 * that this reads each profile's own `logs/tasks` and nothing else.
 *
 * Overdue on top, then today. That ordering is hers, from the 2026-07-14 polish.
 */
export function composeTodayStrip(state: AppState, today: string): StripRow[] {
  const rows: StripRow[] = [];
  for (const client of state.clients ?? []) {
    const data = state.clientData?.[client.id];
    if (!data?.body) continue;
    const profile = renderProfile(state, client.id, 'owner');
    // A profile with the strip switched off contributes exactly its own rows,
    // and no other profile's rows change.
    if (renderState(profile, 'shelf.today_strip', 'owner') !== 'active') continue;
    for (const e of data.body.paths?.[TASKS] ?? []) {
      if (e.state !== 'active') continue;
      const d = (e.data ?? {}) as { text?: string; due_date?: string; done?: boolean; piece_id?: string };
      // Tasks are append-only, so a tick is an amendment. The original record
      // stays intact and the latest amendment is what the row reads (S11).
      const done = (e.amendments ?? []).reduce(
        (v, a) => ('done' in a.changed ? a.changed.done === true : v), !!d.done);
      if (done) continue;
      const due = d.due_date ?? '';
      if (!due || due > today) continue;
      rows.push({
        profile_id: client.id,
        profile_name: client.name,
        color: accentFor(client, data),
        task_id: e.id,
        text: d.text ?? '',
        due_date: due,
        overdue: due < today,
        kind: d.piece_id ? 'content-task' : 'client-task',
      });
    }
  }
  return rows.sort((a, b) =>
    Number(b.overdue) - Number(a.overdue) || a.due_date.localeCompare(b.due_date));
}

// ── §4.4 The weekly pulse ────────────────────────────────────────────────────

export interface PulseGroup {
  profile_id: string;
  profile_name: string;
  color: string;
  period_end: string;
  lines: string[];
  /** Broken collection sorts to the top, ahead of everything moving. */
  broken: boolean;
}

export const PULSE_EMPTY_LINE =
  'Your weekly read will appear here once there is enough collected.';

/**
 * Spec 27 §13.2 writes one entry per profile into that profile's OWN digests.
 * This composes her one screen from them and builds nothing else. A profile with
 * `analysis.pulse_owner` at hidden contributes nothing and is not listed.
 */
export function composeWeeklyPulse(state: AppState): PulseGroup[] {
  const groups: PulseGroup[] = [];
  for (const client of state.clients ?? []) {
    const data = state.clientData?.[client.id];
    if (!data?.body) continue;
    const profile: RenderProfile = renderProfile(state, client.id, 'owner');
    if (renderState(profile, 'analysis.pulse_owner', 'owner') !== 'active') continue;
    const entries = (data.body.paths?.[DIGESTS] ?? [])
      .filter(e => String((e.data as { kind?: unknown })?.kind ?? '') === 'weekly-pulse')
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const latest = entries[0];
    if (!latest) continue;
    const d = latest.data as {
      period_end?: string;
      sections?: { lines?: string[] }[];
      coverage?: { days_expected?: number; days_covered?: number };
    };
    const lines = (d.sections ?? []).flatMap(s => s.lines ?? []).slice(0, 4);
    const cov = d.coverage;
    const broken = !!cov && (cov.days_covered ?? 0) < (cov.days_expected ?? 0);
    groups.push({
      profile_id: client.id,
      profile_name: client.name,
      color: accentFor(client, data),
      period_end: d.period_end ?? '',
      lines,
      broken,
    });
  }
  return groups.sort((a, b) =>
    Number(b.broken) - Number(a.broken) || b.period_end.localeCompare(a.period_end));
}
