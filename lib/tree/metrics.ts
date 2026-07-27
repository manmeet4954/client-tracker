// The honesty rules around observations — S6 and S7, owned by the BODY.
//
// The engine computes verdicts; the body decides what is comparable and what is
// simply missing. Both of these matter in practice right now: collection has
// been stalled since 2026-07-12, and that stretch must read as a GAP, never as
// a slump.

import type {
  AttributedOutcome, CoverageGap, MatchedComparison, MetricObservation, ObservationWindow,
  PlatformPost, SyncRun, WindowState,
} from './objects.ts';
import { exposureMetricFor, metricKind } from '../platforms/index.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Windows a comparison may run in, and how old a piece must be to qualify. */
export const WINDOW_AGE_HOURS: Record<Exclude<ObservationWindow, 'lifetime'>, number> = {
  'first-24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
};

export interface ComparisonThresholds {
  /** Minimum pieces on each side of the comparison. */
  minPieces: number;
  /** Minimum exposure (impressions / views) before a difference means anything. */
  minExposure: number;
  exposureMetric: string;
}

export const DEFAULT_THRESHOLDS: ComparisonThresholds = {
  minPieces: 1,
  minExposure: 300,
  exposureMetric: 'views',
};

/**
 * Spec 26 §7 adopts the v1 numbers above, makes the exposure metric come from
 * the PLATFORM'S CATALOGUE rather than the string 'views', and makes all three
 * per-profile overridable — recorded the way switch defaults are: suggested,
 * hers to finalize. Nothing here is applied silently.
 */
export function thresholdsFor(
  platform: string, overrides: Partial<ComparisonThresholds> = {},
): ComparisonThresholds {
  return {
    minPieces: overrides.minPieces ?? DEFAULT_THRESHOLDS.minPieces,
    minExposure: overrides.minExposure ?? DEFAULT_THRESHOLDS.minExposure,
    exposureMetric: overrides.exposureMetric
      ?? exposureMetricFor(platform)
      ?? DEFAULT_THRESHOLDS.exposureMetric,
  };
}

/** The three values that are SUGGESTIONS she finalizes (§18), named in one place
 *  so the migration report and her sort queue can say the same thing. */
export const SUGGESTED_THRESHOLD_NOTE =
  'Suggested v1 values: at least 1 piece a side and 300 views of exposure before a ' +
  'difference means anything. Below them the answer is "not enough comparable data", ' +
  'never a ranking.';

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Spec 26 §5.6: a gap's reason is READ OFF the runs and the channel's state, it
 * is never guessed. Pass what is known; anything absent simply does not change
 * the answer.
 */
export interface GapContext {
  /** The runs recorded for this channel. A stretch's reason comes from these. */
  runs?: SyncRun[];
  /** Nothing before this date is a hole; it is a boundary (§6.7). */
  trackSince?: string | null;
  /**
   * The effective state of this channel's collector over the stretch. At
   * `history` or `hidden` the absence is a DECISION, and must never render like
   * a stall (acceptance test 2).
   */
  trackingState?: 'active' | 'history' | 'hidden';
  /**
   * Run records only exist from this date (§14.5: `sync_runs` starts empty, and
   * manufacturing plausible run history would be the same lie as interpolating a
   * chart). A gap wholly before it reads `unknown` — the type already carries
   * that member for exactly this reason.
   */
  runsRecordedFrom?: string | null;
}

/** Which reason a stretch with no observations carries. */
function reasonFor(from: string, to: string, ctx: GapContext | undefined): CoverageGap['reason'] {
  if (!ctx) return 'sync-stalled';
  if (ctx.trackSince && to < dayKey(ctx.trackSince)) return 'not-yet-tracked';
  if (ctx.trackingState === 'history' || ctx.trackingState === 'hidden') return 'switched-off';

  const overlapping = (ctx.runs ?? []).filter(r => {
    const d = dayKey(r.started_at);
    return d >= from && d <= to;
  });
  for (const status of ['switched-off', 'not-yet-tracked', 'not-connected', 'permission-refused', 'platform-error', 'error'] as const) {
    if (overlapping.some(r => r.connection_status === status)) {
      return status === 'error' ? 'platform-error'
        : status === 'permission-refused' ? 'not-connected'
        : status;
    }
  }
  // No run at all, and no record of runs ever having existed for that stretch:
  // the honest answer is that we do not know why (§14.5).
  if (ctx.runsRecordedFrom && to < dayKey(ctx.runsRecordedFrom)) return 'unknown';
  return 'sync-stalled';
}

/**
 * Days in the window with no observation for this channel. A gap is a fact
 * about the pipe, not about the content — the UI must show it as such (S7).
 *
 * Spec 26 adds two things. The reason comes from the runs rather than a guess,
 * so a stall and a deliberate stop never render the same; and a PARTIAL run
 * (§6.6) contributes its own entry naming the posts it never reached, instead of
 * the day being declared whole.
 */
export function detectCoverageGaps(
  observations: MetricObservation[], channelId: string, from: string, to: string,
  context?: GapContext,
): CoverageGap[] {
  const seen = new Set(
    observations.filter(o => o.channel_id === channelId).map(o => dayKey(o.fetched_at)),
  );
  const start = new Date(dayKey(from)).getTime();
  const end = new Date(dayKey(to)).getTime();
  const gaps: CoverageGap[] = [];
  let open: string | null = null;

  const close = (lastDay: string) => {
    if (!open) return;
    gaps.push({ channel_id: channelId, from: open, to: lastDay, reason: reasonFor(open, lastDay, context) });
    open = null;
  };

  for (let t = start; t <= end; t += DAY_MS) {
    const key = dayKey(new Date(t).toISOString());
    if (seen.has(key)) close(dayKey(new Date(t - DAY_MS).toISOString()));
    else if (!open) open = key;
  }
  close(dayKey(new Date(end).toISOString()));

  // A run that ran out of time covers only the posts it observed. Reporting its
  // day as whole would manufacture exactly the silence this file exists to
  // prevent (§6.6).
  for (const run of context?.runs ?? []) {
    if (run.channel_id !== channelId) continue;
    if (run.completed) continue;
    const missed = run.missed_platform_post_ids ?? [];
    if (!missed.length) continue;
    const day = dayKey(run.started_at);
    if (day < dayKey(from) || day > dayKey(to)) continue;
    gaps.push({
      channel_id: channelId, from: day, to: day,
      reason: 'sync-stalled', missed_platform_post_ids: [...missed],
    });
  }

  return gaps.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
}

export function gapCoversDay(gaps: CoverageGap[], day: string): boolean {
  return gaps.some(g => g.from <= day && day <= g.to);
}

// ── spec 26 §7 — age windows, materialized once ──────────────────────────────
//
// What the pipe fetches is always a LIFETIME reading. A window is derived from
// one, materialized ONCE, and never recomputed: a window is a fact about a
// moment, and recomputing it later would silently change history.

export interface WindowTolerance { nominal: number; min: number; max: number }

/** §7's table. A reading inside the tolerance qualifies; nothing else does. */
export const WINDOW_TOLERANCE: Record<Exclude<ObservationWindow, 'lifetime'>, WindowTolerance> = {
  'first-24h': { nominal: 24, min: 12, max: 36 },
  '7d': { nominal: 24 * 7, min: 24 * 6, max: 24 * 8 },
  '30d': { nominal: 24 * 30, min: 24 * 28, max: 24 * 33 },
};

export const MATERIALIZABLE_WINDOWS: Exclude<ObservationWindow, 'lifetime'>[] =
  ['first-24h', '7d', '30d'];

export interface MaterializeOptions {
  /** The post's age right now. Below the nominal age with nothing qualifying is
   *  `too-early`; past it, `unavailable`. */
  ageNowHours: number;
  /** Rows already materialized for this post. A window is never recomputed. */
  existing?: MetricObservation[];
  /** The gap that explains an unavailable window. Named, never implied. */
  gaps?: CoverageGap[];
  now?: string;
  idFor?: (window: ObservationWindow) => string;
}

function gapNaming(gaps: CoverageGap[] | undefined): string | undefined {
  if (!gaps?.length) return undefined;
  const g = gaps[0];
  return `no reading in the window: coverage gap ${g.from} to ${g.to} (${g.reason})`;
}

/**
 * One window for one post. Returns `null` when it is already materialized —
 * that is the "materialize once" rule, and it is why this function is the only
 * writer of window rows.
 *
 * Never interpolated, never carried forward, never zero (§7).
 */
export function materializeWindow(
  lifetimeRows: MetricObservation[],
  window: Exclude<ObservationWindow, 'lifetime'>,
  opts: MaterializeOptions,
): MetricObservation | null {
  const already = (opts.existing ?? []).find(
    o => o.window === window && o.kind_of_row === 'window' && o.window_state === 'materialized',
  );
  if (already) return null;

  const rows = lifetimeRows.filter(o => (o.kind_of_row ?? 'lifetime') === 'lifetime');
  if (!rows.length && opts.ageNowHours < WINDOW_TOLERANCE[window].nominal) {
    return windowRow(window, 'too-early', null, opts);
  }

  const tol = WINDOW_TOLERANCE[window];
  const qualifying = rows
    .filter(o => o.age_hours >= tol.min && o.age_hours <= tol.max)
    // Closest to the nominal age wins; the row stores its ACTUAL age either way.
    .sort((a, b) => Math.abs(a.age_hours - tol.nominal) - Math.abs(b.age_hours - tol.nominal))[0];

  if (qualifying) return windowRow(window, 'materialized', qualifying, opts);
  if (opts.ageNowHours < tol.nominal) return windowRow(window, 'too-early', null, opts);
  return windowRow(window, 'unavailable', null, opts);
}

function windowRow(
  window: Exclude<ObservationWindow, 'lifetime'>,
  state: WindowState,
  source: MetricObservation | null,
  opts: MaterializeOptions,
): MetricObservation {
  const base = source ?? undefined;
  const now = opts.now ?? new Date().toISOString();
  return {
    id: opts.idFor?.(window) ?? `${base?.platform_post_id ?? 'post'}-${window}-${now}`,
    piece_id: base?.piece_id ?? null,
    platform_post_id: base?.platform_post_id ?? '',
    channel_id: base?.channel_id ?? '',
    platform: base?.platform,
    kind_of_row: 'window',
    window,
    window_state: state,
    // The ACTUAL age of the underlying reading, never the nominal boundary: two
    // pieces measured at 19h and 31h are both "first-24h" and a comparison
    // between them may say so (§7).
    age_hours: base?.age_hours ?? 0,
    // No reading means NO metrics. Not a zero, not the nearest value — those are
    // the two lies §7 forbids by name.
    metrics: state === 'materialized' ? { ...(base?.metrics ?? {}) } : {},
    metric_definition_version: base?.metric_definition_version ?? 0,
    account_timezone: base?.account_timezone ?? null,
    local_date: base?.local_date,
    fetched_at: base?.fetched_at ?? now,
    fetch_time_precision: base?.fetch_time_precision ?? 'day',
    connection_status: base?.connection_status ?? 'ok',
    retry_state: base?.retry_state ?? 'none',
    source_run_id: base?.source_run_id ?? null,
    deleted_on_platform: base?.deleted_on_platform ?? false,
    unavailable_reason: state === 'unavailable'
      ? gapNaming(opts.gaps) ?? 'no qualifying reading inside the window'
      : undefined,
  };
}

/** Every window that just became eligible for one post, in one call (§6.2 step 9). */
export function materializeWindows(
  lifetimeRows: MetricObservation[], opts: MaterializeOptions,
): MetricObservation[] {
  const out: MetricObservation[] = [];
  for (const w of MATERIALIZABLE_WINDOWS) {
    const row = materializeWindow(lifetimeRows, w, opts);
    if (row) out.push(row);
  }
  return out;
}

/** Age in hours between publication and a fetch. The one arithmetic both the
 *  collector and the migration use, so they can never disagree. */
export function ageHours(publishedAt: string, fetchedAt: string): number {
  const ms = new Date(fetchedAt).getTime() - new Date(publishedAt).getTime();
  return Math.max(0, Math.round((ms / 3600000) * 10) / 10);
}

// ── §5.4 — what a metric's kind allows, enforced at the store boundary ───────

export interface MetricValue {
  state: 'value' | 'unavailable' | 'refused';
  value?: number;
  reason?: string;
}

/**
 * Summing is legal for `interval` metrics and for nothing else. A cumulative
 * lifetime total summed across days is the most common silent lie in this whole
 * area, so it throws rather than returning a number nobody checks.
 */
export function sumMetric(
  platform: string, metricId: string, rows: MetricObservation[],
): MetricValue {
  const kind = metricKind(platform, metricId);
  if (kind && kind !== 'interval') {
    throw new Error(
      `[store] "${metricId}" is a ${kind} metric on ${platform} — never sum it across days. ` +
      'A per-day figure is a DIFFERENCE of two observations (spec 26 §5.4).',
    );
  }
  const values = rows.map(r => r.metrics[metricId]).filter((v): v is number => typeof v === 'number');
  if (!values.length) return { state: 'unavailable', reason: `no observation carries "${metricId}"` };
  return { state: 'value', value: values.reduce((a, b) => a + b, 0) };
}

/**
 * A per-day figure for a `cumulative` or `level` metric: the difference between
 * two EXISTING observations. Where either is missing the answer is
 * `unavailable` — never an interpolation, never a carry-forward (§6.4).
 */
export function differenceMetric(
  platform: string, metricId: string,
  earlier: MetricObservation | undefined, later: MetricObservation | undefined,
): MetricValue {
  const kind = metricKind(platform, metricId);
  if (kind === 'interval') {
    throw new Error(
      `[store] "${metricId}" is an interval metric on ${platform} — it is a count for one day, ` +
      'so differencing it is meaningless; sum it (spec 26 §5.4).',
    );
  }
  const a = earlier?.metrics[metricId];
  const b = later?.metrics[metricId];
  if (typeof a !== 'number' || typeof b !== 'number') {
    return {
      state: 'unavailable',
      reason: 'a per-day figure needs BOTH observations; one of them was never recorded',
    };
  }
  return { state: 'value', value: b - a };
}

// ── §5.4 — the definition-version flag ───────────────────────────────────────

export interface Comparability {
  comparable: boolean;
  versions: number[];
  reason?: string;
}

/**
 * Two observations of the same metric id measured under different definitions
 * are NOT comparable. What a surface does about it is spec 27's problem; raising
 * the flag is this store's duty (§5.4).
 */
export function comparabilityOf(rows: MetricObservation[], metricId: string): Comparability {
  const versions = [...new Set(
    rows.filter(r => typeof r.metrics[metricId] === 'number').map(r => r.metric_definition_version),
  )].sort((a, b) => a - b);
  if (versions.length <= 1) return { comparable: true, versions };
  return {
    comparable: false, versions,
    reason: `"${metricId}" was measured under definition versions ${versions.join(' and ')} — ` +
      'the platform redefined it in between, so a figure spanning the boundary would be a fiction',
  };
}

// ── §6.5 — deletion markers ──────────────────────────────────────────────────

/**
 * A post previously seen and absent from TWO consecutive COMPLETED runs on its
 * channel is deleted. Two, not one, so a paging hiccup never buries a live post.
 * Its observations stay forever: the history is real and was collected honestly.
 */
export function deletionsAfterRuns(
  posts: Pick<PlatformPost, 'platform_post_id' | 'channel_id' | 'deleted_on_platform'>[],
  lastTwoCompletedRuns: { run_id: string; channel_id: string; seen: string[] }[],
): string[] {
  const byChannel = new Map<string, string[][]>();
  for (const run of lastTwoCompletedRuns) {
    const list = byChannel.get(run.channel_id) ?? [];
    list.push(run.seen);
    byChannel.set(run.channel_id, list);
  }
  const out: string[] = [];
  for (const post of posts) {
    if (post.deleted_on_platform) continue;
    const runs = byChannel.get(post.channel_id) ?? [];
    if (runs.length < 2) continue;                       // one absence proves nothing
    if (runs.every(seen => !seen.includes(post.platform_post_id))) {
      out.push(post.platform_post_id);
    }
  }
  return out;
}

// ── §10 — the wall between observed funnel metrics and business outcomes (S23) ─

/** An outcome with no declared source AND method displays as unknown, always. */
export function outcomeStatus(outcome: Pick<AttributedOutcome, 'event_source' | 'attribution_method'>): 'declared' | 'unknown' {
  return outcome.event_source && outcome.attribution_method ? 'declared' : 'unknown';
}

/** The status is derived, never taken on trust from whoever wrote the row. */
export function resolveOutcome(outcome: AttributedOutcome): AttributedOutcome {
  return { ...outcome, status: outcomeStatus(outcome) };
}

/**
 * The enforceable rule, at the STORE boundary rather than in a UI convention:
 * no code path may divide an attributed outcome by an observed metric unless
 * both `event_source` and `attribution_method` are declared.
 *
 * The honest version of "8 signups from 4,000 views" is usually "8 signups
 * happened while 4,000 views happened", and only a declared attribution method
 * makes it more than that. So this returns a REFUSAL carrying no number —
 * there is nothing for a surface to accidentally render.
 */
export function attributedRate(
  outcome: AttributedOutcome, observed: { metric_id: string; value: number } | undefined,
): MetricValue {
  if (outcomeStatus(outcome) !== 'declared') {
    return {
      state: 'refused',
      reason: `"${outcome.outcome}" has no ${!outcome.event_source ? 'declared event source' : 'declared attribution method'}, ` +
        'so it is unknown — it is never called a conversion and no rate is computed from it (S23)',
    };
  }
  if (!observed || typeof observed.value !== 'number' || observed.value === 0) {
    return { state: 'unavailable', reason: 'no observed figure to compute against' };
  }
  return { state: 'value', value: outcome.count / observed.value };
}

/**
 * Resolve a matched comparison (S5, S6). Pieces compare only at equivalent
 * ages, above the thresholds; below them the answer is "not enough comparable
 * data" — never a ranking, and never a causal claim.
 */
export function resolveComparison(
  comparison: MatchedComparison,
  observations: MetricObservation[],
  metric: string,
  thresholds: ComparisonThresholds = DEFAULT_THRESHOLDS,
): MatchedComparison {
  const window = comparison.window;
  const maxAge = window === 'lifetime' ? Infinity : WINDOW_AGE_HOURS[window];

  const perPiece = comparison.piece_ids.map(pieceId => {
    const rows = observations.filter(o =>
      o.piece_id === pieceId && o.window === window && o.age_hours <= maxAge && !o.deleted_on_platform);
    const latest = rows.sort((a, b) => b.age_hours - a.age_hours)[0];
    return { pieceId, value: latest?.metrics[metric], exposure: latest?.metrics[thresholds.exposureMetric] ?? 0, has: !!latest };
  });

  const comparable = perPiece.filter(p => p.has && p.value !== undefined);
  const enough =
    comparable.length >= 2 &&
    comparable.length >= thresholds.minPieces * 2 &&
    comparable.every(p => p.exposure >= thresholds.minExposure);

  if (!enough) {
    return { ...comparison, state: 'not-enough-comparable-data', verdict: undefined };
  }

  const sorted = [...comparable].sort((a, b) => (b.value! - a.value!));
  const [best, next] = sorted;
  const margin = next.value === 0 ? Infinity : (best.value! - next.value!) / Math.max(next.value!, 1);

  return {
    ...comparison,
    state: 'concluded',
    verdict: margin < 0.1
      ? { direction: 'inconclusive', words: `Too close to call on ${metric} at ${window}.` }
      : {
          direction: 'favours',
          piece_id: best.pieceId,
          // Directional evidence, never causation (S5).
          words: `At ${window}, ${best.pieceId} leads on ${metric} (${best.value} vs ${next.value}). One comparison, one changed variable (${comparison.changed_variable}) — evidence, not proof.`,
        },
  };
}
