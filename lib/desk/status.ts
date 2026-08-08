// The arithmetic behind `profile_status` — spec 30 §3.1, her example 4.
//
// LAW TWO LIVES HERE (spec 30 §2). Every number this file returns is FINAL. The
// model is handed the answer and writes the sentence; it never counts, never
// totals, never estimates. "You have posted eight, four are left" is two numbers
// out of this file with a test beside each of them.
//
// Two rules I hold myself to, because the desk already holds them:
//
//  1. Nothing is counted twice. The board's stage counts are `stageCounts` in
//     `lib/shell/shelf.ts` and the last posted date is `pieceClock` in the same
//     file. This module CALLS them. The one thing it walks itself is the posted
//     list, because a month window and a pillar mix cannot be got out of a
//     Record<stage, number> — and `tests/desk.read.test.ts` asserts that walk
//     agrees with `stageCounts` and with `pieceClock` on every fixture.
//
//  2. Missing and zero are different answers, always. A target that was never
//     set is `null`, not `0`. A share with nothing posted to share out is
//     `null`, not `0`. A pillar with no job is `null`, not `""`.
//
// Pure: state in, values out. No fetch, no clock, no randomness. `today` is
// always injected.
//
// Relative, extensioned imports: this module runs under plain Node in the tests.

import type { AppState, Client, ClientData } from '@/types';
import type { BodyEntry } from '../tree/objects.ts';
import type { Lifecycle, PieceStage } from '../tree/objects.ts';
import type { ProfileBody } from '../tree/body.ts';
import { daysBetween, pieceClock, stageCounts } from '../shell/shelf.ts';

const PIECES = 'work-log/creation';
const PILLARS = 'context/content-strategy/pillars';
const CADENCE = 'context/content-strategy/cadence';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;

// ── Small, shared date arithmetic ────────────────────────────────────────────

/** 'YYYY-MM-DD' → 'YYYY-MM'. Empty when the day is not a day. */
export function monthOf(day: string): string {
  return DAY.test(day) ? day.slice(0, 7) : '';
}

// ── The profile, resolved once ───────────────────────────────────────────────

export interface ProfileRef {
  id: string;
  name: string;
  lifecycle: Lifecycle;
  owner_kind: 'hers' | 'client';
  /** Where a row lands when she taps it. */
  href: string;
}

export function profileRef(client: Client): ProfileRef {
  return {
    id: client.id,
    name: client.name,
    lifecycle: (client.lifecycle ?? 'active') as Lifecycle,
    owner_kind: client.ownerKind === 'hers' ? 'hers' : 'client',
    href: `/profile/${client.id}`,
  };
}

/**
 * A paused profile's counts are frozen at the pause date. This is `composeCard`'s
 * own rule, restated in one place so every count in this module uses the same
 * cut-off the shelf card uses. Nothing else may decide it.
 */
export function frozenAt(client: Client | undefined): string | null {
  return client?.lifecycle === 'paused' ? (client.lifecycleAt ?? null) : null;
}

// ── The posted list: the one walk this module does itself ────────────────────

export interface PostedPiece {
  id: string;
  title: string;
  /** '' when the piece was posted with no date on it. A date is not invented. */
  date: string;
  month: string;
  pillar_id: string | null;
  platform: string | null;
  format: string | null;
  live_link: string | null;
}

interface PieceData {
  title?: unknown;
  hook?: unknown;
  stage?: unknown;
  scheduled_date?: unknown;
  live_link?: unknown;
  costume?: { pillar_id?: unknown; platform?: unknown; format?: unknown };
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** Every piece on the board, as this module reads one. */
export function pieceEntries(data: ClientData | undefined, before: string | null): BodyEntry<PieceData>[] {
  const all = (data?.body?.paths?.[PIECES] ?? []) as BodyEntry<PieceData>[];
  return all.filter(e => (before ? e.updated_at <= before : true));
}

/**
 * The posted pieces, oldest first. `stageCounts(...).posted` is the authority on
 * HOW MANY are posted; this is the same set with its dates attached, and the
 * test file asserts the two agree.
 */
export function postedPieces(data: ClientData | undefined, before: string | null): PostedPiece[] {
  const out: PostedPiece[] = [];
  for (const e of pieceEntries(data, before)) {
    const d = e.data ?? {};
    if (str(d.stage) !== 'posted') continue;
    const day = str(d.scheduled_date).slice(0, 10);
    const dated = DAY.test(day);
    const costume = d.costume ?? {};
    out.push({
      id: e.id,
      title: str(d.title),
      date: dated ? day : '',
      month: dated ? day.slice(0, 7) : '',
      pillar_id: str(costume.pillar_id) || null,
      platform: str(costume.platform) || null,
      format: str(costume.format) || null,
      live_link: str(d.live_link) || null,
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// ── The cadence target ───────────────────────────────────────────────────────

export interface Cadence {
  /**
   * Posts per month. NULL means she has never set one, and that is a different
   * answer from a target of zero — `not_set` says which.
   */
  target: number | null;
  not_set: boolean;
  /** Where the number came from, so a stale legacy value is never silent. */
  source: 'strategy' | 'legacy' | 'none';
  posted: number;
  /** How many are still owed this month. Never negative. */
  remaining: number | null;
  /** How many past the target. Never negative. */
  over_by: number | null;
}

/**
 * The target, from the tree first and the legacy slice second.
 *
 * The migration only wrote `context/content-strategy/cadence` when the old
 * `postTarget` was above zero, so a profile with `postTarget: 0` has no cadence
 * entry AND no target — which is exactly "not set", not "a target of zero". A
 * cadence entry that really does say zero is honoured as a set zero.
 */
export function cadenceTarget(data: ClientData | undefined):
  { target: number | null; source: 'strategy' | 'legacy' | 'none' } {
  const entries = data?.body?.paths?.[CADENCE] ?? [];
  for (const e of entries) {
    if (e.state !== 'active') continue;
    const v = (e.data as { posts_per_month?: unknown })?.posts_per_month;
    if (typeof v === 'number' && Number.isFinite(v)) return { target: v, source: 'strategy' };
  }
  const legacy = data?.postTarget;
  if (typeof legacy === 'number' && legacy > 0) return { target: legacy, source: 'legacy' };
  return { target: null, source: 'none' };
}

export function cadence(data: ClientData | undefined, postedThisMonth: number): Cadence {
  const { target, source } = cadenceTarget(data);
  if (target === null) {
    return {
      target: null, not_set: true, source, posted: postedThisMonth,
      remaining: null, over_by: null,
    };
  }
  return {
    target, not_set: false, source, posted: postedThisMonth,
    remaining: Math.max(0, target - postedThisMonth),
    over_by: Math.max(0, postedThisMonth - target),
  };
}

// ── The pillars ──────────────────────────────────────────────────────────────

export interface PillarDef {
  /** The pillar entry's own id — the same id a piece's costume carries. */
  id: string;
  name: string;
  /** 'reach' | 'trust' | 'convert'. NULL when she has not given it one yet. */
  job: string | null;
  /** Its share of the mix, in percent. NULL when no target was ever set. */
  target_pct: number | null;
  color: string | null;
}

/**
 * The pillars, out of the tree. Each pillar is its own folder (law 2), with its
 * job and its mix target as parameters inside it, so this reads the folder and
 * everything under it and groups by the folder key.
 */
export function pillarDefs(body: ProfileBody | undefined): PillarDef[] {
  if (!body) return [];
  const prefix = `${PILLARS}/`;
  const roots = new Map<string, PillarDef>();
  const jobs = new Map<string, string>();
  const targets = new Map<string, number>();

  for (const path of Object.keys(body.paths)) {
    if (!path.startsWith(prefix)) continue;
    const rest = path.slice(prefix.length);
    const key = rest.split('/')[0];
    const sub = rest.slice(key.length + 1);
    for (const e of body.paths[path] ?? []) {
      if (e.state !== 'active') continue;
      const d = (e.data ?? {}) as Record<string, unknown>;
      if (sub === '') {
        roots.set(key, {
          id: e.id,
          name: str(d.name),
          job: null,
          target_pct: null,
          color: str(d.color) || null,
        });
      } else if (sub === 'job') {
        const job = str(d.job);
        if (job) jobs.set(key, job);
      } else if (sub === 'mix-target') {
        const t = d.target_pct;
        if (typeof t === 'number' && Number.isFinite(t)) targets.set(key, t);
      }
    }
  }

  return [...roots.entries()]
    .map(([key, p]) => ({
      ...p,
      job: jobs.get(key) ?? null,
      target_pct: targets.has(key) ? targets.get(key)! : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface PillarShare {
  pillar_id: string;
  name: string;
  /** Analysis judges a pillar only against its job. NULL is "she has not said". */
  job: string | null;
  target_pct: number | null;
  /** Posted inside the window, in this pillar. Always a real count. */
  posted: number;
  /** posted / counted, rounded. NULL when there is nothing to share out. */
  actual_pct: number | null;
  /** actual minus target. NULL when either side is unknown. */
  gap_pct: number | null;
}

export interface PillarMix {
  /** How many pillars exist. Zero is an honest answer and says "none declared". */
  declared: number;
  /** The denominator: posted pieces in the window that carry a pillar. */
  counted: number;
  /** Posted in the window with no pillar on them at all. */
  unassigned: number;
  shares: PillarShare[];
  /** True when the shares mean nothing yet, because nothing was posted. */
  no_basis: boolean;
}

/** The mix, over one window's posted pieces. Every percentage computed here. */
export function pillarMix(posted: PostedPiece[], pillars: PillarDef[]): PillarMix {
  const withPillar = posted.filter(p => p.pillar_id !== null);
  const counted = withPillar.length;
  const shares: PillarShare[] = pillars.map(p => {
    const n = withPillar.filter(x => x.pillar_id === p.id).length;
    const actual = counted === 0 ? null : Math.round((n / counted) * 100);
    return {
      pillar_id: p.id,
      name: p.name,
      job: p.job,
      target_pct: p.target_pct,
      posted: n,
      actual_pct: actual,
      gap_pct: actual === null || p.target_pct === null ? null : actual - p.target_pct,
    };
  });
  return {
    declared: pillars.length,
    counted,
    unassigned: posted.length - counted,
    shares,
    no_basis: counted === 0,
  };
}

// ── The whole answer ─────────────────────────────────────────────────────────

export interface StatusCounts {
  /** Posted with a date inside the window. */
  posted_this_month: number;
  /** Posted at all, ever. Its authority is `stageCounts`. */
  posted_all_time: number;
  /** Posted but carrying no date, so no month can honestly claim them. */
  posted_undated: number;
  scheduled: number;
  review: number;
  approved: number;
  build: number;
  ideas: number;
  /** Every piece on the board, whatever stage. */
  on_board: number;
}

export interface LastPosted {
  piece_id: string;
  title: string;
  date: string;
  /** Whole days from that date to `today`. Negative would mean a future date. */
  days_ago: number;
}

export interface ProfileStatusShape {
  profile: ProfileRef;
  today: string;
  /** The window every month-scoped number below is measured over. */
  month: string;
  /** False when this profile has not been migrated: nothing below is countable. */
  has_body: boolean;
  strategy_locked: boolean;
  /** Set while the profile is paused: counts stop here. */
  frozen_at: string | null;
  counts: StatusCounts;
  cadence: Cadence;
  pillars: PillarMix;
  /** NULL when nothing has ever been posted with a date. Not a zero. */
  last_posted: LastPosted | null;
}

const EMPTY_COUNTS: StatusCounts = {
  posted_this_month: 0, posted_all_time: 0, posted_undated: 0,
  scheduled: 0, review: 0, approved: 0, build: 0, ideas: 0, on_board: 0,
};

const STAGES: PieceStage[] = ['idea', 'build', 'review', 'approved', 'scheduled', 'posted'];

/**
 * Her example 4, computed. "You have posted this much, this much is left, these
 * are the pillars we are finalising for, here is where we are."
 *
 * `today` decides the month window and nothing else. The board counts are board
 * counts: what is in review is in review whatever month it is.
 */
export function computeStatus(state: AppState, profileId: string, today: string): ProfileStatusShape | null {
  const client = (state.clients ?? []).find(c => c.id === profileId);
  if (!client) return null;
  const data = state.clientData?.[profileId];
  const body = data?.body;
  const frozen = frozenAt(client);
  const month = MONTH.test(today) ? today : monthOf(today);

  const ref = profileRef(client);
  if (!body) {
    return {
      profile: ref, today, month,
      has_body: false,
      strategy_locked: false,
      frozen_at: frozen,
      counts: { ...EMPTY_COUNTS },
      cadence: cadence(data, 0),
      pillars: { declared: 0, counted: 0, unassigned: 0, shares: [], no_basis: true },
      last_posted: null,
    };
  }

  // The board, counted by the desk's own counter and nothing else.
  const byStage = stageCounts(data, frozen);
  const clock = pieceClock(data, DAY.test(today) ? today : `${month}-01`, frozen);

  const posted = postedPieces(data, frozen);
  const thisMonth = posted.filter(p => p.month === month);
  const undated = posted.filter(p => p.date === '').length;

  const counts: StatusCounts = {
    posted_this_month: thisMonth.length,
    posted_all_time: byStage.posted ?? 0,
    posted_undated: undated,
    scheduled: byStage.scheduled ?? 0,
    review: byStage.review ?? 0,
    approved: byStage.approved ?? 0,
    build: byStage.build ?? 0,
    ideas: byStage.idea ?? 0,
    on_board: STAGES.reduce((n, s) => n + (byStage[s] ?? 0), 0),
  };

  const last = posted.filter(p => p.date !== '').slice(-1)[0] ?? null;

  return {
    profile: ref,
    today,
    month,
    has_body: true,
    strategy_locked: typeof body.strategy_version === 'number',
    frozen_at: frozen,
    counts,
    cadence: cadence(data, thisMonth.length),
    pillars: pillarMix(thisMonth, pillarDefs(body)),
    last_posted: last && clock.last_posted
      ? {
        piece_id: last.id,
        title: last.title,
        date: last.date,
        days_ago: DAY.test(today) ? daysBetween(last.date, today) : 0,
      }
      : null,
  };
}
