// The honesty rules around observations — S6 and S7, owned by the BODY.
//
// The engine computes verdicts; the body decides what is comparable and what is
// simply missing. Both of these matter in practice right now: collection has
// been stalled since 2026-07-12, and that stretch must read as a GAP, never as
// a slump.

import type { CoverageGap, MatchedComparison, MetricObservation, ObservationWindow } from './objects.ts';

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

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Days in the window with no observation for this channel. A gap is a fact
 * about the pipe, not about the content — the UI must show it as such (S7).
 */
export function detectCoverageGaps(
  observations: MetricObservation[], channelId: string, from: string, to: string,
): CoverageGap[] {
  const seen = new Set(
    observations.filter(o => o.channel_id === channelId).map(o => dayKey(o.fetched_at)),
  );
  const start = new Date(dayKey(from)).getTime();
  const end = new Date(dayKey(to)).getTime();
  const gaps: CoverageGap[] = [];
  let open: string | null = null;

  for (let t = start; t <= end; t += DAY_MS) {
    const key = dayKey(new Date(t).toISOString());
    if (seen.has(key)) {
      if (open) {
        gaps.push({ channel_id: channelId, from: open, to: dayKey(new Date(t - DAY_MS).toISOString()), reason: 'sync-stalled' });
        open = null;
      }
    } else if (!open) {
      open = key;
    }
  }
  if (open) gaps.push({ channel_id: channelId, from: open, to: dayKey(new Date(end).toISOString()), reason: 'sync-stalled' });
  return gaps;
}

export function gapCoversDay(gaps: CoverageGap[], day: string): boolean {
  return gaps.some(g => g.from <= day && day <= g.to);
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
