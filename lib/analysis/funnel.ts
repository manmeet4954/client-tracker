// The funnel — spec 27 §8. Observed platform metrics only, with the wall beside it.
//
// Every step is an OBSERVED metric from spec 26's store, with its `kind`
// respected: `interval` metrics sum across days; `cumulative` metrics never do,
// and a per-day figure is a difference of two observations or it is unavailable.
//
// Attributed business outcomes sit BESIDE the funnel and never inside it (S23).
// The honest sentence is the screen's copy rule: "8 signups happened while 4,000
// views happened" is what the data says until a method says more.

import type { AttributedOutcome, MetricObservation } from '../tree/objects.ts';
import { attributedRate, outcomeStatus, sumMetric } from '../tree/metrics.ts';
import { metricKind } from '../platforms/index.ts';
import type { AnalysisContext } from './read.ts';
import { piecesInPeriod } from './read.ts';
import type { Measured } from './compute.ts';
import { coverageFor, daysBetween, monthOf } from './compute.ts';

// ── §8.1 The chain ───────────────────────────────────────────────────────────

/** The default shape, offered where the profile declares none. Her funnel-shape
 *  folder beats it, always — this is a fallback, not a rule. */
export const DEFAULT_CHAIN: { id: string; label: string; metric: string | null }[] = [
  { id: 'pieces', label: 'Pieces posted', metric: null },
  { id: 'views', label: 'Views', metric: 'views' },
  { id: 'reach', label: 'Reach', metric: 'reach' },
  { id: 'profile_views', label: 'Profile visits', metric: 'profile_views' },
  { id: 'website_clicks', label: 'Website taps', metric: 'website_clicks' },
];

export interface FunnelStep {
  id: string;
  label: string;
  metric_id: string | null;
  value: Measured;
  /** How the figure was reached, so nothing is summed that may not be summed. */
  how: 'count' | 'sum' | 'difference' | 'none';
}

export interface FunnelMonth {
  month: string;
  steps: FunnelStep[];
}

export interface FunnelResult {
  /** Coverage first, before any step (§4.4). */
  coverage: ReturnType<typeof coverageFor>;
  months: FunnelMonth[];
  /** §8.2's one surviving derived line, both sides of the wall unchanged. */
  brand_building: BrandBuildingLine;
  outcomes: OutcomePanel;
  /** Rows the profile has no last mile for are ABSENT, not zero (§8.1). */
  absent_steps: string[];
}

export function funnel(ctx: AnalysisContext, platform = ctx.facts.platforms[0] ?? 'instagram'): FunnelResult {
  const chain = chainFor(ctx);
  const months = [...new Set(
    ctx.snapshot.account_observations
      .map(o => monthOf(o.local_date ?? o.fetched_at))
      .filter(m => m >= monthOf(ctx.period.from) && m <= monthOf(ctx.period.to)),
  )].sort();

  const absent: string[] = [];
  if (!ctx.facts.ctas.some(c => /link|website|site|bio/i.test(c))) absent.push('website_clicks');

  const out: FunnelMonth[] = months.map(month => ({
    month,
    steps: chain
      .filter(step => !absent.includes(step.id))
      .map(step => stepFor(ctx, platform, month, step)),
  }));

  return {
    coverage: coverageFor(ctx.gaps, ctx.period.from, ctx.period.to),
    months: out,
    brand_building: brandBuilding(ctx, platform),
    outcomes: outcomePanel(ctx),
    absent_steps: absent,
  };
}

function chainFor(ctx: AnalysisContext): { id: string; label: string; metric: string | null }[] {
  if (!ctx.facts.funnel_shape.length) return DEFAULT_CHAIN;
  return ctx.facts.funnel_shape.map(label => {
    const match = DEFAULT_CHAIN.find(
      s => s.label.toLowerCase() === label.toLowerCase() || s.id === label.toLowerCase());
    return match ?? { id: label.toLowerCase().replace(/[^a-z0-9]+/g, '_'), label, metric: null };
  });
}

function stepFor(
  ctx: AnalysisContext, platform: string, month: string,
  step: { id: string; label: string; metric: string | null },
): FunnelStep {
  if (!step.metric) {
    const n = piecesInPeriod(ctx).filter(p => monthOf(p.published_day) === month).length;
    return {
      id: step.id, label: step.label, metric_id: null, how: 'count',
      value: { state: 'value', value: n, n },
    };
  }
  const rows = ctx.snapshot.account_observations.filter(
    o => monthOf(o.local_date ?? o.fetched_at) === month && typeof o.metrics[step.metric!] === 'number');
  const gapsThisMonth = ctx.gaps.filter(g => monthOf(g.from) === month || monthOf(g.to) === month);
  if (gapsThisMonth.length) {
    // Refusal 5: the gap is carried into every number computed from the period.
    return {
      id: step.id, label: step.label, metric_id: step.metric, how: 'none',
      value: { state: 'no-coverage', gaps: gapsThisMonth },
    };
  }
  if (!rows.length) {
    return {
      id: step.id, label: step.label, metric_id: step.metric, how: 'none',
      value: { state: 'too-early', owed: 'no data collected for this month yet' },
    };
  }
  const kind = metricKind(platform.toLowerCase(), step.metric);
  if (kind === 'interval') {
    const summed = sumMetric(platform.toLowerCase(), step.metric, rows);
    return {
      id: step.id, label: step.label, metric_id: step.metric, how: 'sum',
      value: summed.state === 'value'
        ? { state: 'value', value: summed.value, n: rows.length }
        : { state: 'too-early', owed: summed.reason ?? 'no reading' },
    };
  }
  // A cumulative or level metric is NEVER summed across days (spec 26 §5.4). The
  // month's figure is the difference between its first and last observation, and
  // where either is missing the answer is unavailable, not an estimate.
  const sorted = [...rows].sort((a, b) => (a.fetched_at < b.fetched_at ? -1 : 1));
  return {
    id: step.id, label: step.label, metric_id: step.metric, how: 'difference',
    value: monthDifference(sorted, step.metric),
  };
}

function monthDifference(rows: MetricObservation[], metricId: string): Measured {
  const first = rows[0]?.metrics[metricId];
  const last = rows[rows.length - 1]?.metrics[metricId];
  if (typeof first !== 'number' || typeof last !== 'number' || rows.length < 2) {
    return {
      state: 'too-early',
      owed: 'a monthly figure requires a reading at both the start and end of the month; one is missing',
    };
  }
  return { state: 'value', value: last - first, n: rows.length };
}

// ── §8.2 The brand-building signal, kept ─────────────────────────────────────

export interface BrandBuildingLine {
  state: 'value' | 'too-early' | 'no-coverage';
  words: string;
  profile_visit_growth?: number;
  reach_growth?: number;
  n?: number;
  window?: string;
}

/**
 * Profile visits growing faster than reach means content is making people
 * curious about the person. It survives spec 05 because it is a ratio of two
 * OBSERVED metrics on the same side of the wall — and it renders with its n, its
 * window and its coverage like everything else.
 */
export function brandBuilding(ctx: AnalysisContext, platform: string): BrandBuildingLine {
  if (!coverageFor(ctx.gaps, ctx.period.from, ctx.period.to).complete) {
    return { state: 'no-coverage', words: 'Not computed: data collection was incomplete for part of this period.' };
  }
  const rows = [...ctx.snapshot.account_observations]
    .sort((a, b) => (a.fetched_at < b.fetched_at ? -1 : 1));
  const visits = sumOrDiff(rows, 'profile_views', platform);
  const reach = sumOrDiff(rows, 'reach', platform);
  if (visits === null || reach === null || reach === 0) {
    return {
      state: 'too-early',
      words: 'Not enough data on profile visits and reach for this period yet.',
      window: `${ctx.period.from} to ${ctx.period.to}`,
    };
  }
  const days = daysBetween(ctx.period.from, ctx.period.to);
  return {
    state: 'value',
    profile_visit_growth: visits,
    reach_growth: reach,
    n: rows.length,
    window: `${days} days`,
    words: visits / reach > 0.02
      ? `Profile visits are outpacing reach over these ${days} days, which usually indicates content is driving interest in the profile.`
      : `Profile visits are tracking with reach over these ${days} days.`,
  };
}

function sumOrDiff(rows: MetricObservation[], metricId: string, platform: string): number | null {
  const have = rows.filter(r => typeof r.metrics[metricId] === 'number');
  if (!have.length) return null;
  const kind = metricKind(platform.toLowerCase(), metricId);
  if (kind === 'interval') {
    return have.reduce((n, r) => n + (r.metrics[metricId] as number), 0);
  }
  if (have.length < 2) return null;
  return (have[have.length - 1].metrics[metricId] as number) - (have[0].metrics[metricId] as number);
}

// ── §8.3 Attributed outcomes, beside the funnel and never inside it ──────────

export interface OutcomeRow {
  id: string;
  outcome: string;
  count: number;
  status: 'declared' | 'unknown';
  event_source: string | null;
  attribution_method: string | null;
  period: string;
  /** Present only where BOTH are declared. Absent otherwise — no button exists. */
  rate?: { value: number; against: string; method: string };
  words: string;
}

export interface OutcomePanel {
  heading: string;
  rows: OutcomeRow[];
  /** Named so no screen has to remember it (§8.3, PLAN §5.2). */
  soft_signals_note: string;
}

export function outcomePanel(ctx: AnalysisContext): OutcomePanel {
  const observed = observedTotal(ctx, 'views');
  return {
    heading: 'Business outcomes. Recorded manually, not measured by the platform.',
    rows: ctx.facts.outcomes
      .filter(o => inPeriod(o, ctx.period))
      .map(o => outcomeRow(o, observed)),
    soft_signals_note:
      'DMs, inquiries, perception answers and other qualitative signals are recorded separately and are not included in any calculation on this screen.',
  };
}

function inPeriod(o: AttributedOutcome, period: { from: string; to: string }): boolean {
  if (!o.period_start && !o.period_end) return true;
  return (o.period_end ?? o.period_start ?? '') >= period.from
    && (o.period_start ?? o.period_end ?? '') <= period.to;
}

function outcomeRow(o: AttributedOutcome, observed: number | null): OutcomeRow {
  const status = outcomeStatus(o);
  const base: OutcomeRow = {
    id: o.id,
    outcome: o.outcome,
    count: o.count,
    status,
    event_source: o.event_source,
    attribution_method: o.attribution_method,
    period: [o.period_start, o.period_end].filter(Boolean).join(' to ') || 'no period recorded',
    words: status === 'declared'
      ? `${o.count} ${o.outcome}, from ${o.event_source}, attributed by ${o.attribution_method}.`
      : `${o.count} ${o.outcome}: attribution unknown. Not counted as a conversion; no rate is calculated from it.`,
  };
  if (status !== 'declared' || observed === null) return base;
  // Refusal 4: the store refuses, not the UI. `attributedRate` carries no number
  // when it refuses, so there is nothing for a screen to render by accident.
  const rate = attributedRate(o, { metric_id: 'views', value: observed });
  if (rate.state !== 'value' || rate.value === undefined) return base;
  return {
    ...base,
    rate: { value: rate.value, against: 'views', method: o.attribution_method! },
    words: `${base.words} That is ${(rate.value * 100).toFixed(2)}% of views, by ${o.attribution_method}.`,
  };
}

function observedTotal(ctx: AnalysisContext, metricId: string): number | null {
  const rows = ctx.snapshot.account_observations.filter(o => typeof o.metrics[metricId] === 'number');
  if (rows.length < 2) return null;
  const sorted = [...rows].sort((a, b) => (a.fetched_at < b.fetched_at ? -1 : 1));
  return (sorted[sorted.length - 1].metrics[metricId] as number) - (sorted[0].metrics[metricId] as number);
}
