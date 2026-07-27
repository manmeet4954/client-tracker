// Goal tracking — spec 27 §10. Targets vs actual, and blocked goals say why.
//
// The target comes from the goal's own S16 declaration and nowhere else, so a
// goal card never has to invent one: spec 26 §9 refuses a blank target at
// strategy lock, and `direction-only` is the explicit way to say there is none.
//
// Nobody is ever asked to re-state a goal (PLAN §3.8).

import type { MeasurementDeclaration } from '../tree/objects.ts';
import type { AnalysisContext, GoalFacts } from './read.ts';
import { piecesInPeriod, sliceRowsFor } from './read.ts';
import type { Measured, MetricSpec } from './compute.ts';
import {
  baselineOf, coverageFor, daysBetween, liftOf, metricValueOf, stickFor, typicalOf,
} from './compute.ts';

export type GoalState =
  | 'on-pace' | 'behind' | 'ahead' | 'direction-only'
  | 'too-early' | 'blocked' | 'not-measurable' | 'manual' | 'proxy' | 'coverage-gap';

export interface GoalCard {
  goal_id: string;
  name: string;
  state: GoalState;
  target: { value: number; period: string } | 'direction-only' | null;
  actual: Measured;
  /** Computed ONLY where the target carries a period. Absent otherwise (§10.2). */
  pace?: { behind_by: number; words: string };
  /** For direction-only goals: the trend against the account's own baseline. */
  trend?: Measured;
  window: string;
  coverage: ReturnType<typeof coverageFor>;
  metric: MetricSpec | null;
  proxy: boolean;
  manual: boolean;
  blocked_reason?: string;
  words: string;
}

export function goals(ctx: AnalysisContext): GoalCard[] {
  return ctx.facts.goals.map(g => goalCard(ctx, g));
}

function goalCard(ctx: AnalysisContext, goal: GoalFacts): GoalCard {
  const coverage = coverageFor(ctx.gaps, ctx.period.from, ctx.period.to);
  const stick = stickFor(goal.declaration, ctx.facts.platforms);
  const declaration = goal.declaration;

  // §10.3, the blocked table. Each reason reads like what it is: a decision, a
  // platform fact, or a hole — never a fault and never a guess.
  if (!stick.metric) {
    const state: GoalState = !declaration ? 'blocked'
      : stick.manual ? 'manual'
        : declaration.not_measurable_fallback === 'none' ? 'not-measurable'
          : 'not-measurable';
    return {
      goal_id: goal.id,
      name: goal.name,
      state,
      target: declaration?.target ?? null,
      actual: { state: 'not-measurable', because: stick.blocked },
      window: declaration?.window ?? 'no window declared',
      coverage,
      metric: null,
      proxy: false,
      manual: !!stick.manual,
      blocked_reason: blockedWords(declaration, stick.blocked, ctx.facts.platforms),
      words: blockedWords(declaration, stick.blocked, ctx.facts.platforms),
    };
  }

  const rows = sliceRowsFor(ctx, stick.metric.window, piecesInPeriod(ctx));
  const all = sliceRowsFor(ctx, stick.metric.window);
  const actual = actualFor(ctx, stick.metric, declaration!);
  const target = declaration!.target;

  if (!coverage.complete) {
    // The gap first, the number second, marked partial (§10.3).
    return {
      goal_id: goal.id, name: goal.name, state: 'coverage-gap',
      target, actual, window: stick.metric.window, coverage,
      metric: stick.metric, proxy: !!stick.proxy, manual: false,
      words: `${coverage.words} The figure below is partial.`,
    };
  }

  if (target === 'direction-only') {
    const typical = typicalOf(rows, stick.metric);
    const baseline = baselineOf({ all, metric: stick.metric, asOf: ctx.period.to, gaps: ctx.gaps });
    return {
      goal_id: goal.id, name: goal.name, state: 'direction-only',
      target, actual,
      trend: liftOf(typical, baseline),
      window: stick.metric.window, coverage,
      metric: stick.metric, proxy: !!stick.proxy, manual: false,
      // There is no pace line, because there is nothing to be behind (§10.2).
      words: `Direction only: ${declaration!.direction === 'up-is-better' ? 'up is better' : 'down is better'}. Measured against this account’s own trailing normal.`,
    };
  }

  if (actual.state !== 'value' || actual.value === undefined) {
    return {
      goal_id: goal.id, name: goal.name, state: 'too-early',
      target, actual, window: stick.metric.window, coverage,
      metric: stick.metric, proxy: !!stick.proxy, manual: false,
      words: actual.owed ?? 'Nothing measured for this goal yet.',
    };
  }

  const pace = paceFor(actual.value, target, ctx.period, ctx.now);
  return {
    goal_id: goal.id, name: goal.name,
    state: pace.behind_by > 0 ? 'behind' : pace.behind_by < 0 ? 'ahead' : 'on-pace',
    target, actual, pace,
    window: stick.metric.window, coverage,
    metric: stick.metric, proxy: !!stick.proxy, manual: false,
    words: `${actual.value} against a target of ${target.value} this ${target.period}. ${pace.words}${stick.proxy ? ' This is a proxy.' : ''}`,
  };
}

function blockedWords(
  declaration: MeasurementDeclaration | null, blocked: string | undefined, platforms: string[],
): string {
  if (!declaration) {
    return 'Not measured yet. This goal has no measurement declared.';
  }
  const fallback = declaration.not_measurable_fallback;
  if (fallback === 'none') return 'Decided as not measurable here.';
  if (fallback === 'manual-checkin') {
    return 'The check-in number you already log, entered by hand. It is never mixed into a computed rate.';
  }
  if (fallback === 'not-measurable-on-this-platform') {
    const names = platforms.join(', ') || 'this platform';
    return `${names} does not report this.`;
  }
  return blocked ?? 'Not measured on the platforms you have switched on.';
}

/** The actual: a count sums the pieces' values, a rate is computed per piece and
 *  then taken as the median, exactly as `typical` is (§4.5). */
function actualFor(
  ctx: AnalysisContext, metric: MetricSpec, declaration: MeasurementDeclaration,
): Measured {
  const rows = sliceRowsFor(ctx, metric.window, piecesInPeriod(ctx));
  if (!rows.length) {
    return { state: 'too-early', n: 0, owed: 'nothing posted in this period carries a reading yet' };
  }
  if (declaration.calculation === 'count') {
    const values = rows
      .map(r => metricValueOf(r.row, metric.metric_id, null))
      .filter((v): v is number => v !== null);
    if (!values.length) {
      return { state: 'too-early', n: 0, owed: 'no reading carries this metric yet' };
    }
    return {
      state: 'value', value: values.reduce((a, b) => a + b, 0), n: values.length,
      window: metric.window, metric_id: metric.metric_id,
    };
  }
  return typicalOf(rows, metric);
}

/**
 * §10.2's pace line, computed ONLY where the target carries a period. "Behind by
 * 22 at this point of the month" is a statement about elapsed time, so it says
 * how much of the period has gone rather than assuming the month is over.
 */
function paceFor(
  actual: number, target: { value: number; period: string },
  period: { from: string; to: string }, now: string,
): { behind_by: number; words: string } {
  const total = daysBetween(period.from, period.to);
  const elapsed = Math.min(total, daysBetween(period.from, now.slice(0, 10)));
  const expected = Math.round((target.value * elapsed) / Math.max(1, total));
  const behind = expected - actual;
  if (behind > 0) return { behind_by: behind, words: `Behind by ${behind} at this point of the ${target.period}.` };
  if (behind < 0) return { behind_by: behind, words: `Ahead by ${Math.abs(behind)} at this point of the ${target.period}.` };
  return { behind_by: 0, words: `On pace for the ${target.period}.` };
}

/** §7.5 / §14: the client's goal line. The name, the target, the actual, and
 *  nothing about baselines or arithmetic. */
export interface ClientGoalLine {
  name: string;
  target: string;
  actual: string;
}

export function forClient(cards: GoalCard[]): ClientGoalLine[] {
  return cards.map(c => ({
    name: c.name,
    target: c.target === 'direction-only' ? 'Direction only, up is better'
      : c.target ? `${c.target.value} this ${c.target.period}`
        : 'Not set',
    actual: c.actual.state === 'value' ? String(c.actual.value)
      : c.actual.state === 'no-coverage' ? 'Not collected for part of this period'
        : c.actual.state === 'not-measurable' ? 'Not measured this period'
          : 'Too early to say',
  }));
}
