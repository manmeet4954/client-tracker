// The scorecard — spec 27 §7. Each pillar judged ONLY on its job.
//
// PLAN §5.3: "Analysis judges each pillar only against its job — a promo pillar
// is never shamed for low reach."
//
// The one sentence that decides everything below: a pillar's metrics come from
// THAT pillar's S16 measurement declaration and from nowhere else. Not from a
// table in this file, not from a hard-coded job → metric map. Spec 04's map
// survives only as the suggested default the derivation surface offers.

import type { PillarFacts } from './read.ts';
import type { AnalysisContext, JoinedPiece } from './read.ts';
import { piecesInPeriod, sliceRowsFor } from './read.ts';
import type { Band, Measured, MetricSpec, SliceRow, Sufficiency } from './compute.ts';
import {
  bandOf, baselineOf, coverageFor, jobAtBirth, liftOf, percent, stickFor,
  sufficiencyOf, typicalOf,
} from './compute.ts';

export type PillarState =
  | 'earning' | 'steady' | 'dragging'
  | 'too-early' | 'not-measurable' | 'blocked' | 'coverage-gap';

export interface QuantityLine {
  posted: number;
  total_posted: number;
  actual_pct: number | null;
  target_pct: number | null;
  words: string;
}

export interface PillarCard {
  pillar_id: string;
  name: string;
  job: string | null;
  purpose: string | null;
  state: PillarState;
  band: Band;
  quantity: QuantityLine;
  /** Which metric judged it, and where that came from. */
  judged_on: string;
  metric: MetricSpec | null;
  proxy: boolean;
  typical: Measured;
  baseline: Measured;
  lift: Measured;
  sufficiency: Sufficiency;
  coverage: ReturnType<typeof coverageFor>;
  /** §7.2's one plain sentence. Never internals for a client (§7.5). */
  show_my_working: string;
  /** §7.4: planned-comparison pieces COUNT, and the line names them. */
  planned_comparison_pieces: string[];
  /** Present on `blocked` and `not-measurable`: why, in her words. */
  blocked_reason?: string;
  piece_ids: string[];
}

export interface ScorecardOptions {
  /** Piece ids that sit in a planned comparison closed or open in this period. */
  planned_comparison_piece_ids?: string[];
}

export function scorecard(ctx: AnalysisContext, opts: ScorecardOptions = {}): PillarCard[] {
  const inPeriod = piecesInPeriod(ctx);
  const planned = new Set(opts.planned_comparison_piece_ids ?? []);
  return ctx.facts.pillars.map(p => pillarCard(ctx, p, inPeriod, planned));
}

function pillarCard(
  ctx: AnalysisContext, pillar: PillarFacts, inPeriod: JoinedPiece[], planned: Set<string>,
): PillarCard {
  // §7.4, the named supersession of spec 04: planned-comparison pieces COUNT in
  // quantity and in performance. A posted piece is a posted piece, and excluding
  // it would understate the pillar against its own mix target.
  const mine = inPeriod.filter(j => j.piece.birth?.costume?.pillar_id === pillar.id);
  const coverage = coverageFor(ctx.gaps, ctx.period.from, ctx.period.to);
  const quantity = quantityLine(mine.length, inPeriod.length, pillar.mix_target_pct);
  const plannedHere = mine.filter(j => planned.has(j.piece.id)).map(j => j.piece.id);

  const base = {
    pillar_id: pillar.id,
    name: pillar.name,
    job: pillar.job,
    purpose: pillar.purpose,
    quantity,
    planned_comparison_pieces: plannedHere,
    piece_ids: mine.map(j => j.piece.id),
    coverage,
    proxy: false,
  };

  const empty: Measured = { state: 'too-early', n: mine.length, owed: 'nothing measured yet' };
  const stick = stickFor(pillar.declaration, ctx.facts.platforms);

  // `blocked` — the pillar's job has no valid S16 declaration. The card says so
  // and links to the declaration panel. COLLECTION is unaffected (spec 26 §9).
  if (!stick.metric) {
    const state: PillarState = pillar.declaration ? 'not-measurable' : 'blocked';
    return {
      ...base,
      state, band: 'too-early',
      judged_on: 'nothing yet',
      metric: null,
      typical: empty, baseline: empty, lift: empty,
      sufficiency: { sufficient: false, n: mine.length, owed: stick.blocked },
      blocked_reason: stick.blocked
        ?? 'This pillar’s job has no measurement declared, so there is nothing to judge it against.',
      show_my_working: state === 'blocked'
        ? 'No measurement is declared for this pillar’s job yet, so nothing is judged. Collection carries on underneath.'
        : `Its declaration says this is not measurable on the platforms you have switched on. ${stick.blocked ?? ''}`.trim(),
    };
  }

  const rows = sliceRowsFor(ctx, stick.metric.window, mine);
  const all = sliceRowsFor(ctx, stick.metric.window);
  const typical = typicalOf(rows, stick.metric);
  const baseline = baselineOf({ all, metric: stick.metric, asOf: ctx.period.to, gaps: ctx.gaps });
  const lift = liftOf(typical, baseline);
  const sufficiency = sufficiencyOf(rows, ctx.thresholds);
  const band = bandOf(lift, sufficiency);

  // §7.3: the gap and its reason render INSTEAD of a verdict, not beside it.
  // Refusal 5 — a gap is never read as a result.
  const state: PillarState = !coverage.complete ? 'coverage-gap'
    : band === 'too-early' ? 'too-early'
      : band;

  return {
    ...base,
    state,
    band,
    proxy: !!stick.proxy,
    judged_on: judgedOnWords(stick.metric, !!stick.proxy),
    metric: stick.metric,
    typical, baseline, lift, sufficiency,
    show_my_working: workingLine(pillar, stick.metric, rows, sufficiency, coverage, plannedHere, !!stick.proxy),
  };
}

function quantityLine(posted: number, total: number, target: number | null): QuantityLine {
  const actual = total ? Math.round((posted / total) * 100) : null;
  const words = target === null
    ? `${posted} posted this period, no mix target set`
    : `${posted} posted this period · mix target ${target}% · actual ${actual ?? 0}%`;
  return { posted, total_posted: total, actual_pct: actual, target_pct: target, words };
}

function judgedOnWords(metric: MetricSpec, proxy: boolean): string {
  const what = metric.denominator
    ? `${metric.metric_id} per ${metric.denominator}`
    : metric.metric_id;
  return `${what}, ${metric.window} window${proxy ? ' (proxy)' : ''}`;
}

/**
 * §7.2's Show my working: spec 05's rule kept and extended with coverage. One
 * plain sentence, and it names the DECLARATION — because that is the answer to
 * "why this metric" and the answer is never "because the job is called Trust".
 */
function workingLine(
  pillar: PillarFacts, metric: MetricSpec, rows: SliceRow[], sufficiency: Sufficiency,
  coverage: ReturnType<typeof coverageFor>, planned: string[], proxy: boolean,
): string {
  const parts: string[] = [];
  parts.push(
    `Judged on ${judgedOnWords(metric, proxy)} because this pillar's job is ${pillar.job ?? 'not set'} and that is what its measurement declaration names.`);
  parts.push('Compared against this account\'s own median over the last 12 weeks.');
  parts.push(`Based on ${rows.length} posted ${rows.length === 1 ? 'piece' : 'pieces'} at the ${metric.window} window.`);
  parts.push(coverage.complete
    ? `All ${rows.length} had complete collection.`
    : `Collection was incomplete: ${coverage.words}`);
  if (planned.length) {
    parts.push(`${planned.length} of these ${rows.length} were part of a planned comparison.`);
  }
  if (!sufficiency.sufficient && sufficiency.owed) {
    parts.push(`Not enough to judge yet: ${sufficiency.owed}.`);
  }
  if (proxy) parts.push('This is a proxy, not the metric itself.');
  return parts.join(' ');
}

/** §7.3: what a `too early` card still owes, said exactly. */
export function owedWords(card: PillarCard, windowDaysLeft?: number): string {
  const bits: string[] = [];
  if (card.sufficiency.owed) bits.push(card.sufficiency.owed);
  if (typeof windowDaysLeft === 'number' && windowDaysLeft > 0) {
    bits.push(`${windowDaysLeft} more ${windowDaysLeft === 1 ? 'day' : 'days'}`);
  }
  return bits.length ? bits.join(', or ') : 'a little more time';
}

/**
 * §7.5, the client's version: the purpose line and the plain verdict, and never
 * the show-my-working internals, never the baseline arithmetic, never another
 * profile. This is what a publication may carry; the resolver is what enforces
 * that only an approved publication travels (§14).
 */
export interface ClientPillarCard {
  name: string;
  purpose: string | null;
  verdict: string;
}

export function forClient(cards: PillarCard[]): ClientPillarCard[] {
  return cards.map(c => ({
    name: c.name,
    purpose: c.purpose,
    verdict: clientVerdictWords(c),
  }));
}

function clientVerdictWords(card: PillarCard): string {
  switch (card.state) {
    case 'earning': return 'Performing';
    case 'steady': return 'Holding steady';
    case 'dragging': return 'Underperforming';
    case 'coverage-gap': return 'Data collection was incomplete for this period';
    case 'blocked':
    case 'not-measurable': return 'Not measured this period';
    default: return 'Insufficient data';
  }
}

/** The line under a band, for her side only. */
export function liftWords(card: PillarCard): string {
  if (card.lift.state !== 'value' || card.lift.value === undefined) return 'no lift yet';
  return `${percent(card.lift.value)} against this account's typical, on ${card.lift.n} pieces`;
}
