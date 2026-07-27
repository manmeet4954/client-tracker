// The verdict cycle — spec 27 §11. The call, not a dashboard.
//
// PLAN §5.2 point 4: "After 30 days, and again at two or three months: one
// verdict — which patterns and topics outperform the others, and whether working
// on them more is the right call. Not a dashboard of numbers; a call."
//
// The whole input is COMPUTED AND STORED FIRST. The model never sees a database;
// it sees the object below and nothing else (§12.2). That ordering is the trust
// rule made structural rather than promised.

import type { ProfileBody } from '../tree/body.ts';
import { putEntry, readPath } from '../tree/body.ts';
import type {
  BodyEntry, CoverageGap, ObservationWindow, ResolvedCostume, Verdict, VerdictCycle,
} from '../tree/objects.ts';
import type { ComparisonThresholds } from '../tree/metrics.ts';
import { writeProposal, type StoredProposal } from '../engine/proposals.ts';
import { writeFeedback } from '../engine/feedback.ts';
import { writeRecommendation, type CostumeRecommendation } from '../engine/recommendations.ts';
import type { SeedProposal } from '../engine/schema.ts';
import type { AnalysisContext, JoinedPiece } from './read.ts';
import { piecesInPeriod, sliceRowsFor } from './read.ts';
import type { Band, Measured, MetricSpec, Pattern, SliceRow } from './compute.ts';
import {
  QUARTER_DAYS, baselineOf, coverageFor, crossPatternId, dayOffset, patternOf,
} from './compute.ts';
import { dimensionsFor, valueOf } from './bifurcate.ts';
import { scorecard, type PillarCard } from './scorecard.ts';
import { goals as goalCards, type GoalCard } from './goals.ts';
import { funnel, type FunnelResult } from './funnel.ts';
import { plannedPieceIds, readComparisons, type ComparisonEntry } from './compare.ts';

export const VERDICT_PATH = 'work-log/analysis/verdicts';

export class VerdictRefused extends Error {}

// ── §11.2 What code computes, before any model is called ─────────────────────

export interface CannotSay {
  pattern_id: string;
  dimension: string;
  value: string;
  n: number;
  /** What is owed before it can be said. Never "no data" with no number. */
  owed: string;
}

export interface VerdictInput {
  profile_id: string;
  cycle: VerdictCycle;
  period_start: string;
  period_end: string;
  /** FIRST, always. Coverage before performance, on every surface (§4.4). */
  coverage: { days_expected: number; days_covered: number; gaps: CoverageGap[] };
  thresholds: ComparisonThresholds;
  baseline_by_metric_window: Record<string, number>;
  pillars: {
    pillar_id: string; name: string; job: string | null; declaration: string;
    n: number; quantity_vs_mix: string;
    typical: Measured; baseline: Measured; lift: Measured; band: Band; state: string;
  }[];
  patterns: Pattern[];
  seeds: { seed_id: string; name: string; n_pieces: number; typical: Measured; baseline: Measured; lift: Measured; sufficient: boolean }[];
  comparisons: ComparisonEntry[];
  goals: { goal_id: string; name: string; target: string; actual: string; pace: string; state: string }[];
  funnel: FunnelResult;
  cannot_say: CannotSay[];
}

/** The dimensions patterns are cut across. Single, then pairs, then seed-level. */
const PATTERN_DIMENSIONS = [
  'hook_type', 'angle', 'format', 'objective', 'audience_stage', 'cta',
  'product_intensity', 'platform', 'pillar',
];

export interface VerdictComputeInput {
  ctx: AnalysisContext;
  cycle: VerdictCycle;
  metric: MetricSpec;
  body?: ProfileBody;
}

/**
 * Every pattern, computed exhaustively and THEN filtered by sufficiency. A
 * pattern needs `n >= minPieces` on each side and every piece above
 * `minExposure`, or it lands in `cannot_say` — never in `patterns` (§11.2).
 */
export function computePatterns(
  ctx: AnalysisContext, metric: MetricSpec,
): { patterns: Pattern[]; cannot_say: CannotSay[] } {
  const inPeriod = piecesInPeriod(ctx);
  const all = sliceRowsFor(ctx, metric.window);
  const byPiece = new Map(sliceRowsFor(ctx, metric.window, inPeriod).map(r => [r.piece_id, r]));
  const available = new Set(dimensionsFor(ctx).map(d => d.id));
  const dimensions = PATTERN_DIMENSIONS.filter(d => available.has(d));

  const patterns: Pattern[] = [];
  const cannot: CannotSay[] = [];
  const opts = { metric, all, asOf: ctx.period.to, gaps: ctx.gaps, thresholds: ctx.thresholds };

  const group = (pieces: JoinedPiece[], read: (p: JoinedPiece) => string | null) => {
    const map = new Map<string, SliceRow[]>();
    for (const p of pieces) {
      const v = read(p);
      const row = byPiece.get(p.piece.id);
      if (!v || !row) continue;
      map.set(v, [...(map.get(v) ?? []), row]);
    }
    return map;
  };

  const record = (dimension: string, value: string, rows: SliceRow[], id?: string) => {
    const p = patternOf({ dimension, value, rows }, opts);
    const withId = id ? { ...p, id } : p;
    if (withId.sufficient) patterns.push(withId);
    else {
      cannot.push({
        pattern_id: withId.id, dimension, value, n: rows.length,
        owed: withId.insufficient_reason ?? 'not enough comparable data yet',
      });
    }
  };

  for (const d of dimensions) {
    for (const [value, rows] of group(inPeriod, p => valueOf(ctx, d, p))) {
      record(d, value, rows);
    }
  }

  // Pairs — "format × hook type", the combinations PLAN §5.2 asks about.
  for (let i = 0; i < dimensions.length; i++) {
    for (let j = i + 1; j < dimensions.length; j++) {
      const a = dimensions[i];
      const b = dimensions[j];
      for (const [value, rows] of group(inPeriod, p => {
        const va = valueOf(ctx, a, p);
        const vb = valueOf(ctx, b, p);
        return va && vb ? `${va} × ${vb}` : null;
      })) {
        const [va, vb] = value.split(' × ');
        record(`${a} × ${b}`, value, rows,
          crossPatternId({ dimension: a, value: va }, { dimension: b, value: vb }, metric));
      }
    }
  }

  return { patterns, cannot_say: cannot };
}

export function buildVerdictInput(input: VerdictComputeInput): VerdictInput {
  const { ctx, cycle, metric } = input;
  const coverage = coverageFor(ctx.gaps, ctx.period.from, ctx.period.to);
  const planned = input.body ? plannedPieceIds(input.body) : [];
  const cards = scorecard(ctx, { planned_comparison_piece_ids: planned });
  const { patterns, cannot_say } = computePatterns(ctx, metric);
  const all = sliceRowsFor(ctx, metric.window);
  const baseline = baselineOf({ all, metric, asOf: ctx.period.to, gaps: ctx.gaps });

  return {
    profile_id: ctx.facts.profile_id,
    cycle,
    period_start: ctx.period.from,
    period_end: ctx.period.to,
    coverage: {
      days_expected: coverage.days_expected,
      days_covered: coverage.days_covered,
      gaps: coverage.gaps,
    },
    thresholds: ctx.thresholds,
    baseline_by_metric_window: baseline.state === 'value' && baseline.value !== undefined
      ? { [`${metric.metric_id}@${metric.window}`]: baseline.value }
      : {},
    pillars: cards.map(c => pillarRow(c)),
    patterns,
    seeds: seedRows(ctx, metric),
    comparisons: input.body
      ? readComparisons(input.body).filter(
        c => c.state === 'concluded'
          && (c.resolved_at ?? '') >= ctx.period.from && (c.resolved_at ?? '') <= `${ctx.period.to}T23:59:59Z`)
      : [],
    goals: goalCards(ctx).map(g => goalRow(g)),
    funnel: funnel(ctx),
    cannot_say,
  };
}

function pillarRow(c: PillarCard): VerdictInput['pillars'][number] {
  return {
    pillar_id: c.pillar_id,
    name: c.name,
    job: c.job,
    declaration: c.judged_on,
    n: c.piece_ids.length,
    quantity_vs_mix: c.quantity.words,
    typical: c.typical, baseline: c.baseline, lift: c.lift,
    band: c.band, state: c.state,
  };
}

function goalRow(g: GoalCard): VerdictInput['goals'][number] {
  return {
    goal_id: g.goal_id,
    name: g.name,
    target: g.target === 'direction-only' ? 'direction only'
      : g.target ? `${g.target.value} per ${g.target.period}` : 'none declared',
    actual: g.actual.state === 'value' ? String(g.actual.value) : g.actual.state,
    pace: g.pace?.words ?? 'no pace line (no period on the target)',
    state: g.state,
  };
}

function seedRows(ctx: AnalysisContext, metric: MetricSpec): VerdictInput['seeds'] {
  const inPeriod = piecesInPeriod(ctx);
  const rows = new Map(sliceRowsFor(ctx, metric.window, inPeriod).map(r => [r.piece_id, r]));
  const all = sliceRowsFor(ctx, metric.window);
  const out: VerdictInput['seeds'] = [];
  for (const seed of ctx.facts.seeds) {
    const mine = inPeriod
      .filter(p => p.piece.seed_id === seed.id)
      .map(p => rows.get(p.piece.id))
      .filter((r): r is SliceRow => !!r);
    if (!mine.length) continue;
    const p = patternOf({ dimension: 'seed', value: seed.id, rows: mine },
      { metric, all, asOf: ctx.period.to, gaps: ctx.gaps, thresholds: ctx.thresholds });
    out.push({
      seed_id: seed.id, name: seed.name, n_pieces: mine.length,
      typical: p.typical, baseline: p.baseline, lift: p.lift, sufficient: p.sufficient,
    });
  }
  return out;
}

// ── §11.1 The two cycles ─────────────────────────────────────────────────────

export interface CycleDue {
  cycle: VerdictCycle;
  period_start: string;
  period_end: string;
}

/**
 * `30-day` runs on the 1st of each month over the trailing 30 days; `quarter`
 * runs every 90 days from the profile's first verdict.
 *
 * 90 days is the committed pick for "two or three months" and is recorded as a
 * SUGGESTION she finalizes (§11.1, §26) — never silently applied as her position.
 */
export function cyclesDue(
  now: string, lastVerdicts: { cycle: VerdictCycle; created_at: string }[], firstVerdictAt?: string,
): CycleDue[] {
  const day = now.slice(0, 10);
  const out: CycleDue[] = [];
  const lastOf = (cycle: VerdictCycle) => lastVerdicts
    .filter(v => v.cycle === cycle)
    .map(v => v.created_at)
    .sort()
    .pop();

  if (day.endsWith('-01')) {
    const last = lastOf('30-day');
    if (!last || last.slice(0, 7) !== day.slice(0, 7)) {
      out.push({ cycle: '30-day', period_start: dayOffset(day, -30), period_end: dayOffset(day, -1) });
    }
  }

  const anchor = firstVerdictAt ?? lastOf('quarter');
  const lastQuarter = lastOf('quarter');
  const since = lastQuarter ?? anchor;
  if (since) {
    const nextDue = dayOffset(since.slice(0, 10), QUARTER_DAYS);
    if (day >= nextDue) {
      out.push({ cycle: 'quarter', period_start: dayOffset(day, -QUARTER_DAYS), period_end: day });
    }
  }
  return out;
}

// ── §11.3 What the verdict says, before any words exist ──────────────────────

export type RightCall = 'yes' | 'no' | 'cannot say yet';

export interface ComputedCall {
  pattern_ref: string | null;
  right_call: RightCall;
  /** Code's own reason. The model may re-word it; it may never contradict it. */
  reason: string;
}

/**
 * The call, computed. It may be `no`: a pattern that outperforms on reach while
 * the convert lane is starving is not a reason to make more of it, and a sharp
 * strategist would say so (PLAN §5.2's own example).
 *
 * "Cannot say yet" is a real answer and is the honest one for the first cycles.
 */
export function computeCall(input: VerdictInput): ComputedCall {
  const leading = [...input.patterns]
    .filter(p => p.sufficient && p.band === 'earning' && p.lift.state === 'value')
    .sort((a, b) => (b.lift.value ?? 0) - (a.lift.value ?? 0))[0];

  // Coverage first, before anything else (§11.3). A leading pattern standing on
  // a partial record is not a call, whatever it looks like — refusal 5.
  if (input.coverage.gaps.length) {
    return {
      pattern_ref: leading?.id ?? null,
      right_call: 'cannot say yet',
      reason: 'Collection was incomplete for part of this period, so anything below stands on a partial record.',
    };
  }

  if (!leading) {
    return {
      pattern_ref: null,
      right_call: 'cannot say yet',
      reason: input.patterns.length
        ? 'Nothing is far enough above your own normal to call a pattern yet.'
        : `Nothing has passed the threshold this period. ${input.cannot_say.length} things are close and named below.`,
    };
  }

  const starving = input.pillars.filter(
    p => p.job && /convert|sell|lead/i.test(p.job) && p.n === 0);
  if (starving.length) {
    return {
      pattern_ref: leading.id,
      right_call: 'no',
      reason: `${leading.dimension} "${leading.value}" is ahead of your own normal, but your ${starving.map(s => s.name).join(' and ')} lane had nothing in it this period. More of what is already winning does not fix an empty lane.`,
    };
  }

  return {
    pattern_ref: leading.id,
    right_call: 'yes',
    reason: `${leading.dimension} "${leading.value}" sits above your own trailing normal on ${leading.n} pieces, with complete collection for the period.`,
  };
}

// ── §11.4 Where it lands ─────────────────────────────────────────────────────

export interface ComputeVerdictInput extends VerdictComputeInput {
  id: string;
  run_id: string;
  now: string;
  context_version?: number;
  packet_version?: number;
}

/** The verdict in its code-computed form. Words are added later, or never. */
export function computeVerdict(input: ComputeVerdictInput): Verdict {
  return {
    id: input.id,
    profile_id: input.ctx.facts.profile_id,
    cycle: input.cycle,
    period_start: input.ctx.period.from,
    period_end: input.ctx.period.to,
    input: buildVerdictInput(input) as unknown as Record<string, unknown>,
    guards: { rejected: 0, reasons: [] },
    run_id: input.run_id,
    model: null,
    effort: 'none',
    packet_version: input.packet_version ?? 1,
    context_version: input.context_version ?? 0,
    state: 'computed',
    created_at: input.now,
  };
}

export function writeVerdict(body: ProfileBody, verdict: Verdict): ProfileBody {
  return putEntry(body, VERDICT_PATH, {
    id: verdict.id, type: 'verdict',
    data: verdict as unknown as Record<string, unknown>,
  }, { writer: 'engine:analysis', now: verdict.created_at });
}

export function readVerdicts(body: ProfileBody): Verdict[] {
  let entries: BodyEntry[];
  try {
    entries = readPath(body, VERDICT_PATH);
  } catch {
    return [];
  }
  return entries
    .map(e => ({ ...(e.data as unknown as Verdict), id: e.id }))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export function latestVerdict(body: ProfileBody, cycle?: VerdictCycle): Verdict | null {
  return readVerdicts(body).find(v => !cycle || v.cycle === cycle) ?? null;
}

// ── §15 The loop back — conclusions routed, never piled ──────────────────────

export interface RevisitInput {
  proposal_id: string;
  verdict_id: string;
  seed_id: string;
  seed_name: string;
  pattern: Pattern;
  /** The winning costume the proposal references. It never pre-selects anything. */
  costume: Partial<ResolvedCostume>;
  run_id: string;
  now: string;
}

/**
 * §15.1 "Make more of this" → a revisit proposal in the seed bank.
 *
 * It NEVER creates a seed: the seed already exists. Evidence is required at the
 * write door — `writeProposal` refuses a `revisit-seed` with no cited verdict,
 * and that refusal is spec 23's, honoured rather than re-implemented.
 */
export function writeRevisitProposal(body: ProfileBody, input: RevisitInput): ProfileBody {
  const proposal: SeedProposal = {
    kind: 'revisit-seed',
    name: input.seed_name,
    raw_thought: null,
    core_message: null, visible_problem: null, deeper_problem: null, common_belief: null,
    reframe: null, audience_value: null, product_connection: null, examples: null,
    nuance: null, prohibited_interpretation: null, proof_required: null,
    possible_pillars: input.costume.pillar_id ? [input.costume.pillar_id] : null,
    possible_angles: input.costume.angle ? [input.costume.angle] : null,
    evidence_span: null,
    why: revisitWords(input.pattern),
    duplicate_of: null,
    target_seed_id: input.seed_id,
    confidence: 'clear',
  };
  return writeProposal(body, {
    id: input.proposal_id,
    kind: 'revisit-seed',
    fed_by: 'engine:analysis',
    run_id: input.run_id,
    proposal,
    badges: [],
    cited_verdict_id: input.verdict_id,
  }, input.now, 'code-computed');
}

function revisitWords(p: Pattern): string {
  const lift = p.lift.state === 'value' && p.lift.value !== undefined
    ? `${Math.round(p.lift.value * 1000) / 10}% above your own normal`
    : 'above your own normal';
  return `${p.dimension} "${p.value}" is ${lift} on ${p.n} pieces at the ${p.window} window.`;
}

export interface StrategyDiffInput {
  feedback_id: string;
  verdict_id: string;
  /** The strategy path the diff proposes to change. Her acceptance writes it. */
  path: string;
  before: unknown;
  after: unknown;
  words: string;
  now: string;
}

/**
 * §15.3 Structural findings → a proposed strategy diff she accepts or rejects.
 *
 * The engine NEVER writes strategy. A diff with no cited verdict is refused at
 * the write door, the same rule as §15.1.
 */
export function writeStrategyDiff(body: ProfileBody, input: StrategyDiffInput): ProfileBody {
  if (!input.verdict_id?.trim()) {
    throw new VerdictRefused(
      'a proposed strategy change must cite the verdict it came from (§15.3): every suggestion cites its evidence',
    );
  }
  return writeFeedback(body, {
    id: input.feedback_id,
    scope: 'candidate-strategy-change',
    original: input.words,
    target_id: input.verdict_id,
    routed_to: input.path,
    proposed_diff: { path: input.path, before: input.before, after: input.after },
    proposed_class: 'performance',
  }, input.now);
}

/**
 * §15.2 Winning combinations → costume recommendations in the engine room.
 *
 * A projection of sufficient patterns. It carries its evidence — the pattern,
 * its n, its window, its verdict date — and it never pre-selects anything.
 * Content Engine II renders it; nothing here draws a thing.
 */
export function recommendationsFrom(
  verdict: Verdict, opts: { limit?: number; now: string },
): CostumeRecommendation[] {
  const input = verdict.input as unknown as VerdictInput;
  const dimensionToCostume: Record<string, keyof ResolvedCostume> = {
    hook_type: 'hook_type', angle: 'angle', format: 'format', objective: 'objective',
    audience_stage: 'audience_stage', cta: 'cta', product_intensity: 'product_intensity',
    platform: 'platform', pillar: 'pillar_id',
  };
  return (input.patterns ?? [])
    .filter(p => p.sufficient && p.band === 'earning' && !!dimensionToCostume[p.dimension])
    .sort((a, b) => (b.lift.value ?? 0) - (a.lift.value ?? 0))
    .slice(0, opts.limit ?? 5)
    .map(p => ({
      id: `rec-${verdict.id}-${p.id}`,
      source: 'verdict' as const,
      suggests: { [dimensionToCostume[p.dimension]]: p.value } as Partial<ResolvedCostume>,
      words: `${revisitWords(p)} From the ${verdict.cycle} verdict of ${verdict.created_at.slice(0, 10)}.`,
      verdict_ref: verdict.id,
      created_at: opts.now,
      created_by: 'engine:analysis',
    }));
}

/** Writing them, through spec 25's own door and its own rules. */
export function writeRecommendations(
  body: ProfileBody, recommendations: CostumeRecommendation[],
): ProfileBody {
  let next = body;
  for (const rec of recommendations) next = writeRecommendation(next, rec);
  return next;
}

/**
 * §15.1's write-door half, for a whole-body save that never went through
 * `writeRevisitProposal`: a revisit proposal arriving with no cited verdict is
 * refused, not warned (acceptance test 11).
 */
export function refusedEvidenceWrites(
  current: ProfileBody | undefined, incoming: ProfileBody | undefined,
): { id: string; reason: string }[] {
  if (!incoming) return [];
  const out: { id: string; reason: string }[] = [];
  const seen = new Set(
    (current?.paths?.['work-log/creation/topics/proposals'] ?? []).map(e => e.id));
  for (const entry of incoming.paths?.['work-log/creation/topics/proposals'] ?? []) {
    if (seen.has(entry.id)) continue;
    const p = entry.data as unknown as StoredProposal;
    if (p.kind === 'revisit-seed' && !p.cited_verdict_id?.trim()) {
      out.push({
        id: entry.id,
        reason: 'a revisit proposal must cite the verdict it came from — every suggestion cites its evidence (§15.1)',
      });
    }
  }
  const feedbackSeen = new Set((current?.paths?.['work-log/logs/feedback'] ?? []).map(e => e.id));
  for (const entry of incoming.paths?.['work-log/logs/feedback'] ?? []) {
    if (feedbackSeen.has(entry.id)) continue;
    const f = entry.data as { scope?: string; target_id?: string };
    if (f.scope === 'candidate-strategy-change' && !f.target_id?.trim()) {
      out.push({
        id: entry.id,
        reason: 'a proposed strategy change must cite the verdict it came from (§15.3)',
      });
    }
  }
  return out;
}

export type { ObservationWindow };
