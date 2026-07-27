// The collector's decisions — spec 26 §6.2 steps 2 to 4, §6.4, §6.6 and §6.7.
//
// Everything here is pure, so the run's behavior is testable without a database
// and without the network: whether a channel collects at all, what a refusal is
// CALLED, when a retry gives up, and what a partial run leaves behind.
//
// The rule the whole file serves: an absence must always be able to say which
// of the three it is — this happened, this did not happen, or we were not
// looking (§2).

import type { PathState, SwitchConfig } from './contract.ts';
import type { Channel, Lifecycle, SyncConnectionStatus, SyncRun } from './objects.ts';
import { effectiveState, platformSwitchId, trackingSwitchId } from './switches.ts';

/** §6.4: three attempts, then it is left for the next day. */
export const MAX_ATTEMPTS = 3;

/** §6.2 step 5: refresh the token when it is over a week old. */
export const TOKEN_REFRESH_DAYS = 7;

/** §6.2 step 8: today's batching, kept for the route's 60-second ceiling. */
export const POST_BATCH_SIZE = 5;

/** The ceiling itself, minus the room a close-out needs (§6.6). */
export const RUN_BUDGET_MS = 50_000;

export type CollectDecision =
  | { collect: true; note?: string }
  | { collect: false; status: SyncConnectionStatus; reason: string };

export interface CollectionInput {
  platform: string;
  /** Her positions for this profile. */
  config: SwitchConfig;
  /**
   * Has she actually SET any position for this profile? Spec 21 §9.6: migration
   * never sets a position, and a migrated profile keeps behaving exactly as it
   * does today until she does. Applied here, that means an unwalked switchboard
   * cannot silently stop the live pipe — which would be precisely the silence
   * this spec exists to prevent (§2, PLAN §5.2).
   */
  positionsSet?: boolean;
  lifecycle?: Lifecycle;
  metricsPermission?: Channel['metrics_permission'];
  connectionRevokedAt?: string | null;
}

/**
 * Does this channel collect right now, and if not, what is the absence CALLED?
 * §6.7's table, in order.
 */
export function decideCollection(input: CollectionInput): CollectDecision {
  const { platform } = input;

  // Lifecycle first: at `closing` and `archived` the connectors are revoked
  // (S22), and no switch position can outrank that.
  if (input.lifecycle === 'closing' || input.lifecycle === 'archived') {
    return {
      collect: false, status: 'not-connected',
      reason: `this profile is ${input.lifecycle}, so its connectors are revoked (S22)`,
    };
  }
  if (input.connectionRevokedAt) {
    return { collect: false, status: 'not-connected', reason: `the connection was revoked on ${input.connectionRevokedAt.slice(0, 10)}` };
  }

  // Permission to READ a client-owned account's numbers is distinct from
  // permission to post to it (§5.1). `unknown` collects and asks her.
  if (input.metricsPermission === 'not-granted') {
    return {
      collect: false, status: 'permission-refused',
      reason: 'this account has not granted permission to read its metrics',
    };
  }

  // A profile whose switchboard she has never walked keeps collecting exactly as
  // it does today. Recording is the first duty and does not wait for a decision.
  if (input.positionsSet === false) {
    return {
      collect: true,
      note: 'no switch positions are set for this profile yet, so collection continues ' +
        'exactly as today (spec 21 §9.6). Recording never waits for a decision.',
    };
  }

  // The cascade minimum (spec 21 §5.2): the platform AND its collector must both
  // resolve active. `analysis.tracking` and `creation.channels` are already
  // prerequisites of the collector switch, so they are inside this answer.
  const platformState = effectiveState(platformSwitchId(platform), input.config);
  const trackingState = effectiveState(trackingSwitchId(platform), input.config);
  if (platformState !== 'active' || trackingState !== 'active') {
    const which = platformState !== 'active' ? platform : `${platform} tracking`;
    const state = platformState !== 'active' ? platformState : trackingState;
    return {
      collect: false, status: 'switched-off',
      reason: `${which} is at ${state} — a decision, not a fault. Every past observation stays readable (S9)`,
    };
  }

  // Lifecycle `paused` reaches here on purpose: PLAN's paused policy revokes no
  // connectors and `analysis.tracking` is owner-audience, so her data keeps
  // accruing while the client's doors are shut (§6.7).
  return { collect: true };
}

/** How a stretch with this run status reads, in her words. Used by the report. */
export const STATUS_WORDS: Record<SyncConnectionStatus, string> = {
  ok: 'collected',
  error: 'the run failed',
  'platform-error': 'the platform refused the call',
  'not-connected': 'no connection',
  'switched-off': 'switched off — a decision, not a hole',
  'not-yet-tracked': 'before this channel started collecting — a boundary, not a hole',
  'permission-refused': 'permission to read this account was not granted',
  unknown: 'no record of why',
};

// ── §6.4 — retry and backfill ────────────────────────────────────────────────

export interface RetryDecision {
  retry: boolean;
  attempt: number;
  /** After the last attempt the connection flips to `error` and waits a day. */
  connectionStatus?: 'error';
  reason: string;
}

export function decideRetry(lastRun: Pick<SyncRun, 'completed' | 'attempt'> | null): RetryDecision {
  if (!lastRun || lastRun.completed) {
    return { retry: false, attempt: 1, reason: 'the last run finished; the next one is a fresh attempt' };
  }
  const attempt = lastRun.attempt + 1;
  if (attempt > MAX_ATTEMPTS) {
    return {
      retry: false, attempt: lastRun.attempt, connectionStatus: 'error',
      reason: `${MAX_ATTEMPTS} attempts failed; this channel is left for the next day`,
    };
  }
  return { retry: true, attempt, reason: `attempt ${attempt} of ${MAX_ATTEMPTS}` };
}

/** The retry state stamped onto every observation a run writes. */
export function retryStateFor(trigger: SyncRun['trigger']): 'none' | 'retrying' | 'backfilled' {
  if (trigger === 'retry') return 'retrying';
  if (trigger === 'backfill') return 'backfilled';
  return 'none';
}

/**
 * THE most important sentence in the spec, made mechanical (§6.4):
 *
 * "Backfill can never reconstruct the missing days, and the store must never
 *  pretend otherwise. A backfilled row closes no gap; the gap stays exactly as
 *  wide as it was."
 *
 * A backfill records CURRENT lifetime totals at TODAY's age. It writes one row,
 * dated now, and it may never write a row dated inside the gap it is closing —
 * because it is not closing it.
 */
export function backfillRowIsHonest(row: { fetched_at: string; retry_state?: string }, gapEnd: string): boolean {
  if (row.retry_state !== 'backfilled') return true;
  return row.fetched_at.slice(0, 10) > gapEnd.slice(0, 10);
}

// ── §6.6 — partial runs ──────────────────────────────────────────────────────

export interface PartialRunResult {
  completed: boolean;
  resume_cursor: string | null;
  missed_platform_post_ids: string[];
}

/**
 * A run that runs out of time writes `completed: false` and a cursor; the next
 * tick resumes from it. A truncated run reporting success would manufacture a
 * gap that looks like a stall — precisely the failure this spec exists to
 * prevent.
 */
export function closePartialRun(
  allPostIds: string[], observedPostIds: string[],
): PartialRunResult {
  const observed = new Set(observedPostIds);
  const missed = allPostIds.filter(id => !observed.has(id));
  if (!missed.length) return { completed: true, resume_cursor: null, missed_platform_post_ids: [] };
  return { completed: false, resume_cursor: missed[0], missed_platform_post_ids: missed };
}

/** Where a resumed run picks up. An unknown cursor starts from the beginning
 *  rather than skipping posts — re-observing costs one row and loses nothing. */
export function resumeFrom(allPostIds: string[], cursor: string | null | undefined): string[] {
  if (!cursor) return allPostIds;
  const i = allPostIds.indexOf(cursor);
  return i < 0 ? allPostIds : allPostIds.slice(i);
}

// ── §6.3 — the day boundary ──────────────────────────────────────────────────

/**
 * The calendar date in the CHANNEL's own timezone. A channel with no timezone
 * still collects — data now beats data never — but its rows say so: the local
 * date falls back to UTC and is labeled, and a sort-queue item goes to her.
 */
export function localDate(at: string, timezone: string | null | undefined): {
  local_date: string; account_timezone: string | null; fallback: boolean;
} {
  const d = new Date(at);
  if (!timezone) {
    return { local_date: d.toISOString().slice(0, 10), account_timezone: null, fallback: true };
  }
  const local = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(d);
  return { local_date: local, account_timezone: timezone, fallback: false };
}

/** The question that goes to her sort queue for a channel with no timezone. */
export function timezoneQuestion(handle: string): string {
  return `@${handle} — which timezone does this account live in? Until it is set, its ` +
    'days are recorded in UTC and labeled as such.';
}

/** §6.7: a post published before `track_since` is a boundary, not a hole. */
export function withinTrackWindow(publishedAt: string, trackSince: string | null | undefined): boolean {
  if (!trackSince) return true;
  return publishedAt >= trackSince;
}

/** Does the token need refreshing? (§6.2 step 5.) */
export function tokenNeedsRefresh(refreshedAt: string | null | undefined, now = Date.now()): boolean {
  if (!refreshedAt) return true;
  return (now - new Date(refreshedAt).getTime()) / 86400000 > TOKEN_REFRESH_DAYS;
}

/** The state a path is in, for the gap detector's `trackingState` (§5.6). */
export function trackingStateFor(platform: string, config: SwitchConfig): PathState {
  return effectiveState(trackingSwitchId(platform), config);
}
