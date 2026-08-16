// The computation layer — spec 27 §4.
//
// One computation layer, eight surfaces. No screen implements its own idea of
// what "typical" means, and no screen queries a database: everything below is a
// PURE function over rows, so every rule in §4 is unit-testable without one.
//
// Three sentences carry the whole file:
//   1. Typical is the MEDIAN. One viral piece never promotes its whole pillar.
//   2. Zero is never used for "we were not looking". A number is one of four
//      states, and three of them are not numbers (§4.4).
//   3. A gap is carried into every number computed from it (refusal 5).
//
// `resolveComparison`, `detectCoverageGaps` and the thresholds are spec 26's and
// are imported, never re-implemented.

import type {
  CoverageGap, MeasurementDeclaration, MetricObservation, ObservationWindow,
} from '../tree/objects.ts';
import type { ComparisonThresholds } from '../tree/metrics.ts';
import { DEFAULT_THRESHOLDS, gapCoversDay } from '../tree/metrics.ts';

// ── The three suggested values (§26) ─────────────────────────────────────────
//
// Recorded the way switch defaults and spec 26's thresholds are: SUGGESTED,
// hers to finalize, never silently applied as her position. Each one is a
// constant plus the sentence that says it is a suggestion, so the sort queue
// and the screen say the same thing.

export const BAND_CUTS = { earning: 0.15, dragging: -0.15 };

export const QUARTER_DAYS = 90;

export const PULSE_SCHEDULE = { day: 'Monday', time: '08:00', timezone: 'Asia/Kolkata' };

/** The trailing window the account is compared against itself over (§4.5). */
export const BASELINE_WEEKS = 12;

export interface SuggestedValue {
  id: string;
  what: string;
  suggested: string;
  question: string;
}

/** The three values that go to her sort queue with spec 26's three (§26). */
export const SUGGESTED_VALUES: SuggestedValue[] = [
  {
    id: 'analysis.band_cuts',
    what: 'When a pillar counts as earning or dragging',
    suggested: 'earning at 15% above your own normal, dragging at 15% below',
    question: 'Is 15% the right line for this account, or do you want it wider or tighter?',
  },
  {
    id: 'analysis.quarter_days',
    what: 'How long the second verdict looks back',
    suggested: '90 days',
    question: 'You said two or three months. 90 days is the clean quarter. Keep it?',
  },
  {
    id: 'analysis.pulse_schedule',
    what: 'When the weekly pulse lands',
    suggested: 'Monday 08:00 IST',
    question: 'Is Monday morning the right time for the weekly lines across all profiles?',
  },
];

// ── §4.4 The four states, everywhere ─────────────────────────────────────────

export type ValueState = 'value' | 'too-early' | 'no-coverage' | 'not-measurable';

export type Band = 'earning' | 'steady' | 'dragging' | 'too-early';

/**
 * Every number this layer returns. Zero is NEVER used for the last three
 * states — spec 26 §6.4's sentence, carried forward in behaviour: no
 * interpolation, no carry-forward, no last-known-value.
 */
export interface Measured {
  state: ValueState;
  /** Present only at `value`. */
  value?: number;
  /** How many pieces the figure stands on. */
  n?: number;
  window?: ObservationWindow;
  metric_id?: string;
  /** At `too-early`: what is still owed, in her words. */
  owed?: string;
  /** At `no-coverage`: the gaps, with their dates and reasons. */
  gaps?: CoverageGap[];
  /** At `not-measurable`: the declaration that says so. */
  because?: string;
}

export const notMeasurable = (because: string): Measured =>
  ({ state: 'not-measurable', because });

export const tooEarly = (owed: string, n = 0): Measured =>
  ({ state: 'too-early', owed, n });

export const noCoverage = (gaps: CoverageGap[]): Measured =>
  ({ state: 'no-coverage', gaps });

// ── §4.5 The computed vocabulary ─────────────────────────────────────────────

/** The median, never the mean (§4.5). Null on an empty list — not zero. */
export function median(values: number[]): number | null {
  const list = values.filter(v => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
  if (!list.length) return null;
  const mid = Math.floor(list.length / 2);
  return list.length % 2 ? list[mid] : round((list[mid - 1] + list[mid]) / 2);
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/**
 * One row's contribution to a metric, under a declaration's calculation.
 * A `rate` divides by its declared denominator and is undefined where the
 * denominator is missing or zero — never a zero, never an infinity.
 */
export function metricValueOf(
  row: MetricObservation, metricId: string, denominator?: string | null,
): number | null {
  const numerator = row.metrics[metricId];
  if (typeof numerator !== 'number') return null;
  if (!denominator) return numerator;
  const d = row.metrics[denominator];
  if (typeof d !== 'number' || d === 0) return null;
  return round(numerator / d);
}

export interface SliceRow {
  piece_id: string;
  channel_id: string;
  platform: string;
  /** The one observation this piece contributes at the chosen window. */
  row: MetricObservation;
  /** The day the piece published, for the baseline window and the gap check. */
  published_day: string;
}

export interface MetricSpec {
  metric_id: string;
  window: ObservationWindow;
  denominator?: string | null;
}

/** Typical = the median across the pieces in the slice, at one window, for one
 *  metric id (§4.5). */
export function typicalOf(rows: SliceRow[], metric: MetricSpec): Measured {
  const values = rows
    .map(r => metricValueOf(r.row, metric.metric_id, metric.denominator))
    .filter((v): v is number => v !== null);
  const m = median(values);
  if (m === null) {
    return {
      state: 'too-early', n: 0, window: metric.window, metric_id: metric.metric_id,
      owed: 'no readings in this window yet',
    };
  }
  return { state: 'value', value: m, n: values.length, window: metric.window, metric_id: metric.metric_id };
}

export interface BaselineInput {
  /** EVERY piece on this channel, not only the slice. */
  all: SliceRow[];
  metric: MetricSpec;
  /** The day the period ends. The trailing 12 weeks run back from here. */
  asOf: string;
  gaps?: CoverageGap[];
  weeks?: number;
}

/**
 * Baseline = the median of the same metric, same window, across ALL of this
 * channel's pieces in the trailing 12 weeks, EXCLUDING pieces whose window falls
 * inside a coverage gap (§4.5).
 *
 * The account is compared only against itself. Cross-account comparison does not
 * exist in this system and there is no argument that adds it here.
 */
export function baselineOf(input: BaselineInput): Measured {
  const weeks = input.weeks ?? BASELINE_WEEKS;
  const from = dayOffset(input.asOf, -weeks * 7);
  const eligible = input.all.filter(r =>
    r.published_day >= from && r.published_day <= input.asOf &&
    !(input.gaps ?? []).some(g => g.channel_id === r.channel_id && gapCoversDay([g], r.published_day)));
  const values = eligible
    .map(r => metricValueOf(r.row, input.metric.metric_id, input.metric.denominator))
    .filter((v): v is number => v !== null);
  const m = median(values);
  if (m === null) {
    return {
      state: 'too-early', n: 0, window: input.metric.window, metric_id: input.metric.metric_id,
      owed: `no readings on this account in the last ${weeks} weeks to compare against`,
    };
  }
  return { state: 'value', value: m, n: values.length, window: input.metric.window, metric_id: input.metric.metric_id };
}

/**
 * Lift = (typical − baseline) / baseline, reported with its n. Undefined where
 * the baseline is zero or `no-coverage`; reported as `too-early` rather than as
 * an infinity (§4.5).
 */
export function liftOf(typical: Measured, baseline: Measured): Measured {
  if (typical.state !== 'value') return typical;
  if (baseline.state === 'no-coverage') return baseline;
  if (baseline.state !== 'value' || !baseline.value) {
    return {
      state: 'too-early', n: typical.n,
      owed: 'no account baseline available to compare against yet',
    };
  }
  return {
    state: 'value',
    value: round((typical.value! - baseline.value) / baseline.value),
    n: typical.n, window: typical.window, metric_id: typical.metric_id,
  };
}

// ── §4.5 Sufficiency, and §4.6 refusal 1 ─────────────────────────────────────

export interface Sufficiency {
  sufficient: boolean;
  n: number;
  /** What is still owed, in her words. Present whenever `sufficient` is false. */
  owed?: string;
  reason?: 'too-few-pieces' | 'below-exposure';
}

/**
 * `n_pieces >= minPieces` AND every piece's exposure ≥ `minExposure` on the
 * platform's declared exposure metric (§4.5). Below it, the answer is
 * "not enough comparable data" — never a ranking, never "slightly ahead".
 */
export function sufficiencyOf(
  rows: SliceRow[], thresholds: ComparisonThresholds = DEFAULT_THRESHOLDS,
): Sufficiency {
  const n = rows.length;
  if (n < thresholds.minPieces) {
    const owe = thresholds.minPieces - n;
    return {
      sufficient: false, n, reason: 'too-few-pieces',
      owed: `${owe} more ${owe === 1 ? 'post' : 'posts'} needed`,
    };
  }
  const thin = rows.filter(r => (r.row.metrics[thresholds.exposureMetric] ?? 0) < thresholds.minExposure);
  if (thin.length) {
    return {
      sufficient: false, n, reason: 'below-exposure',
      owed: `${thin.length} of these ${n} are still below ${thresholds.minExposure} ${thresholds.exposureMetric}`,
    };
  }
  return { sufficient: true, n };
}

/**
 * The band a lift falls in (§4.5). `too-early` below sufficiency, always — the
 * band is never computed on a slice that has not earned one.
 */
export function bandOf(
  lift: Measured, sufficiency: Sufficiency, cuts = BAND_CUTS,
): Band {
  if (!sufficiency.sufficient) return 'too-early';
  if (lift.state !== 'value' || lift.value === undefined) return 'too-early';
  if (lift.value >= cuts.earning) return 'earning';
  if (lift.value <= cuts.dragging) return 'dragging';
  return 'steady';
}

// ── §4.6 The five refusals, as functions ─────────────────────────────────────

export type RefusalId =
  | 'not-enough-comparable-data'      // 1: refuse to rank below threshold
  | 'unequal-ages'                    // 2: refuse to compare across unequal ages
  | 'metric-redefined'                // 3: refuse to compare across definitions
  | 'attribution-wall'                // 4: refuse to cross the S23 wall
  | 'coverage-gap';                   // 5: refuse to read a gap as a result

export interface Refusal {
  refusal: RefusalId;
  words: string;
}

/** Refusal 2: only rows at the SAME window enter a comparison, and the actual
 *  ages are carried forward so the screen can say them. */
export function sameWindowOnly(
  rows: MetricObservation[], window: ObservationWindow,
): { kept: MetricObservation[]; dropped: MetricObservation[]; ages: number[] } {
  const kept = rows.filter(r => r.window === window);
  return {
    kept,
    dropped: rows.filter(r => r.window !== window),
    ages: kept.map(r => r.age_hours),
  };
}

/**
 * Refusal 3: a metric measured under two definitions is dropped from the
 * pattern rather than averaged across a redefinition. The store raises the flag
 * (spec 26 §5.4); this is what the reading layer DOES about it.
 */
export function dropRedefined(
  rows: MetricObservation[], metricId: string,
): { kept: MetricObservation[]; refusal?: Refusal } {
  const versions = [...new Set(
    rows.filter(r => typeof r.metrics[metricId] === 'number').map(r => r.metric_definition_version),
  )];
  if (versions.length <= 1) return { kept: rows };
  return {
    kept: [],
    refusal: {
      refusal: 'metric-redefined',
      words: `"${metricId}" was measured under two different definitions in this period, so these readings are not comparable. Nothing is averaged across the change.`,
    },
  };
}

/**
 * Refusal 5, as one function every surface calls before it renders a number:
 * a period whose coverage is incomplete carries its gap into everything
 * computed from it, and the surface renders the gap FIRST.
 */
export function coverageFor(
  gaps: CoverageGap[], from: string, to: string,
): { complete: boolean; gaps: CoverageGap[]; days_expected: number; days_covered: number; words: string } {
  const overlapping = gaps.filter(g => g.to >= from && g.from <= to);
  const expected = daysBetween(from, to);
  const missing = overlapping.reduce(
    (n, g) => n + daysBetween(g.from < from ? from : g.from, g.to > to ? to : g.to), 0);
  const covered = Math.max(0, expected - missing);
  return {
    complete: overlapping.length === 0,
    gaps: overlapping,
    days_expected: expected,
    days_covered: covered,
    words: overlapping.length ? gapWords(overlapping) : 'complete for this period',
  };
}

/** The gap, stated plainly (§5, §16). A stall and a decision never read alike. */
export function gapWords(gaps: CoverageGap[]): string {
  return gaps.map(g => {
    const days = daysBetween(g.from, g.to);
    const why = gapReasonWords(g.reason);
    return `${why}: ${g.from} to ${g.to}. ${days} ${days === 1 ? 'day' : 'days'} missing from these figures.`;
  }).join(' ');
}

export function gapReasonWords(reason: CoverageGap['reason']): string {
  switch (reason) {
    case 'sync-stalled': return 'Sync stalled';
    case 'switched-off': return 'Collection paused';
    case 'not-yet-tracked': return 'Before tracking began';
    case 'platform-error': return 'Platform error';
    case 'not-connected': return 'Account not connected';
    default: return 'Not collected for an unknown reason';
  }
}

// ── §4.3 Regimes — a pillar whose job changed splits in two ──────────────────

export interface Regime {
  /** The job that existed over this stretch. */
  job: string;
  from: string;
  to: string;
  piece_ids: string[];
}

export interface JobChange { at: string; job: string }

/**
 * Regimes never mix (§4.3). A pillar whose job changed on a date splits into two
 * regimes at that date, and a piece is judged under the job that existed AT ITS
 * BIRTH. Spec 04's change-dating rule, kept and made structural.
 */
export function regimesOf(
  changes: JobChange[], pieces: { piece_id: string; born_at: string }[], to: string,
): Regime[] {
  const sorted = [...changes].sort((a, b) => (a.at < b.at ? -1 : 1));
  if (!sorted.length) return [];
  const out: Regime[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const from = sorted[i].at;
    const until = i + 1 < sorted.length ? sorted[i + 1].at : to;
    out.push({
      job: sorted[i].job,
      from, to: until,
      piece_ids: pieces
        .filter(p => p.born_at >= from && (i + 1 === sorted.length ? true : p.born_at < until))
        .map(p => p.piece_id),
    });
  }
  return out;
}

/** Which job judged this piece: the one that existed at its birth. */
export function jobAtBirth(changes: JobChange[], bornAt: string): string | null {
  const sorted = [...changes].sort((a, b) => (a.at < b.at ? -1 : 1));
  let job: string | null = null;
  for (const c of sorted) {
    if (c.at <= bornAt) job = c.job;
  }
  return job;
}

// ── §11.2 Patterns — cross-cuts, computed exhaustively then filtered ─────────

export interface PatternInput {
  dimension: string;
  value: string;
  rows: SliceRow[];
}

export interface Pattern {
  id: string;
  dimension: string;
  value: string;
  window: ObservationWindow;
  metric_id: string;
  n: number;
  typical: Measured;
  baseline: Measured;
  lift: Measured;
  band: Band;
  sufficient: boolean;
  insufficient_reason?: string;
}

export interface PatternOptions {
  metric: MetricSpec;
  all: SliceRow[];
  asOf: string;
  gaps?: CoverageGap[];
  thresholds?: ComparisonThresholds;
  cuts?: typeof BAND_CUTS;
}

/**
 * One pattern, computed. A pattern needs `n >= minPieces` on each side and every
 * piece above `minExposure` or it lands in `cannot_say`, never in `patterns`
 * (§11.2). The filtering is the caller's; this function only ever tells the
 * truth about sufficiency.
 */
export function patternOf(input: PatternInput, opts: PatternOptions): Pattern {
  const typical = typicalOf(input.rows, opts.metric);
  const baseline = baselineOf({
    all: opts.all, metric: opts.metric, asOf: opts.asOf, gaps: opts.gaps,
  });
  const lift = liftOf(typical, baseline);
  const sufficiency = sufficiencyOf(input.rows, opts.thresholds);
  return {
    id: patternId(input.dimension, input.value, opts.metric),
    dimension: input.dimension,
    value: input.value,
    window: opts.metric.window,
    metric_id: opts.metric.metric_id,
    n: input.rows.length,
    typical, baseline, lift,
    band: bandOf(lift, sufficiency, opts.cuts),
    sufficient: sufficiency.sufficient,
    insufficient_reason: sufficiency.owed,
  };
}

export function patternId(dimension: string, value: string, metric: MetricSpec): string {
  return `p:${dimension}=${value}@${metric.window}:${metric.metric_id}`;
}

/** The pairs (format × hook type) §11.2 asks for, one id each. */
export function crossPatternId(
  a: { dimension: string; value: string }, b: { dimension: string; value: string }, metric: MetricSpec,
): string {
  return `p:${a.dimension}=${a.value}+${b.dimension}=${b.value}@${metric.window}:${metric.metric_id}`;
}

// ── The measuring stick, read off the declaration and nowhere else (§7.1) ────

export interface StickReading {
  metric: MetricSpec | null;
  /** Why there is no metric, when there is none. Always in her words. */
  blocked?: string;
  /** A proxy is labelled a proxy every single time it appears (§10.3). */
  proxy?: boolean;
  manual?: boolean;
}

/**
 * Which metric judges a subject. From that subject's S16 declaration and from
 * NOWHERE else — not from a table in this file, not from a hard-coded job →
 * metric map (§7.1, the named supersession of spec 04).
 */
export function stickFor(
  declaration: MeasurementDeclaration | undefined | null,
  platforms: string[],
): StickReading {
  if (!declaration) {
    return { metric: null, blocked: 'Not measured yet. This one has no measurement declared.' };
  }
  const available = platforms.some(
    p => declaration.platform_availability?.[p.toLowerCase()] === 'available');
  if (available) {
    return {
      metric: {
        metric_id: declaration.metric_ids[0],
        window: declaration.window,
        denominator: declaration.calculation === 'rate' ? declaration.denominator ?? null : null,
      },
    };
  }
  const fallback = declaration.not_measurable_fallback;
  if (typeof fallback === 'string' && fallback.startsWith('proxy:')) {
    return {
      metric: { metric_id: fallback.slice('proxy:'.length), window: declaration.window, denominator: null },
      proxy: true,
    };
  }
  if (fallback === 'manual-checkin') {
    return { metric: null, manual: true, blocked: 'Entered by hand at the check-in, never mixed into a computed rate.' };
  }
  if (fallback === 'none') {
    return { metric: null, blocked: 'Decided as not measurable here.' };
  }
  return { metric: null, blocked: 'This platform does not report it.' };
}

// ── Dates ────────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

export function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

export function dayOffset(day: string, days: number): string {
  return new Date(new Date(day.slice(0, 10)).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** Inclusive day count, the way a coverage window is spoken about. */
export function daysBetween(from: string, to: string): number {
  const a = new Date(from.slice(0, 10)).getTime();
  const b = new Date(to.slice(0, 10)).getTime();
  return Math.max(0, Math.round((b - a) / DAY_MS) + 1);
}

export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

/** The first and last day of a month, in the profile's own month boundary. */
export function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const from = `${month}-01`;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from, to: `${month}-${String(last).padStart(2, '0')}` };
}

export function percent(v: number): string {
  const pct = Math.round(v * 1000) / 10;
  return `${pct > 0 ? '+' : ''}${pct}%`;
}
