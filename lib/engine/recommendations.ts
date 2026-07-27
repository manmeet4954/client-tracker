// Costume recommendations — spec 25 §9.5, and spec 27 §15's two rules.
//
// The ADDRESS is reserved here, and the two rules the Analysis family must
// honour are enforced here, so spec 27 cannot invent a second home or a softer
// rule. The mechanism that computes a recommendation from verdicts is spec 27's;
// this spec builds none of it.
//
// Rule 1 — a recommendation from a verdict CARRIES ITS EVIDENCE. A
// `source: 'verdict'` entry with no cited comparison or verdict id is refused at
// the write door, not warned. PLAN §5.2's honesty rule made structural.
//
// Rule 2 — a recommendation NEVER SELECTS ANYTHING. It appears beside the
// costume pickers as a suggestion. It cannot pre-resolve a costume, cannot birth
// a piece, and cannot enter a drafting packet as an instruction. The engine
// serves and never rails (PLAN §3.10).

import type { ProfileBody } from '../tree/body.ts';
import { putEntry, readPath } from '../tree/body.ts';
import type { BodyEntry, ResolvedCostume } from '../tree/objects.ts';

export const RECOMMENDATION_PATH = 'work-log/creation/costume-recommendations';

export class RecommendationRefused extends Error {}

export interface CostumeRecommendation {
  id: string;
  /**
   * `verdict` — spec 27's numeric conclusions, which carry a citation.
   * `her-observation` — her performance-class feedback (§8.5): recorded, marked
   * as something she said, and never binding.
   */
  source: 'verdict' | 'her-observation';
  /** The dimensions this suggests. A SUGGESTION, never a selection. */
  suggests: Partial<ResolvedCostume>;
  /** One plain line, in her language or the verdict's. */
  words: string;
  /** Required when `source` is `verdict`. Refused without it. */
  verdict_ref?: string;
  comparison_ref?: string;
  seed_id?: string;
  created_at: string;
  created_by: string;
}

/** §8.5 and §9.5 rule 1, at the door rather than in a screen. */
export function recommendationViolations(rec: CostumeRecommendation): string[] {
  const out: string[] = [];
  if (rec.source === 'verdict' && !rec.verdict_ref?.trim() && !rec.comparison_ref?.trim()) {
    out.push(
      'a recommendation drawn from the numbers has to cite the verdict or the comparison it came from (PLAN §5.2)',
    );
  }
  if (!rec.words.trim()) {
    out.push('a recommendation with no words is a selection wearing a suggestion\'s clothes');
  }
  return out;
}

export function writeRecommendation(
  body: ProfileBody, rec: CostumeRecommendation,
): ProfileBody {
  const violations = recommendationViolations(rec);
  if (violations.length) throw new RecommendationRefused(violations.join('; '));
  return putEntry(body, RECOMMENDATION_PATH, {
    id: rec.id, type: 'costume_recommendation',
    data: rec as unknown as Record<string, unknown>,
  }, {
    writer: rec.source === 'verdict' ? 'engine:analysis' : 'owner',
    now: rec.created_at,
  });
}

export function readRecommendations(body: ProfileBody, seed_id?: string): CostumeRecommendation[] {
  let entries: BodyEntry[];
  try {
    entries = readPath(body, RECOMMENDATION_PATH);
  } catch {
    return [];
  }
  return entries
    .filter(e => e.state === 'active')
    .map(e => ({ ...(e.data as unknown as CostumeRecommendation), id: e.id }))
    .filter(r => !seed_id || !r.seed_id || r.seed_id === seed_id);
}

/**
 * §9.5 rule 2, made explicit so nobody has to infer it from an absence: what a
 * recommendation renders as beside the pickers. It never returns a Selection,
 * because returning one is exactly how "suggestion" quietly becomes "default".
 */
export interface RecommendationHint {
  id: string;
  dimension: keyof ResolvedCostume;
  value: string;
  words: string;
  /** Present only on `verdict`-sourced hints, and always present on those. */
  evidence?: string;
  marked: 'from the numbers' | 'something you said';
}

export function recommendationHints(
  body: ProfileBody, seed_id?: string,
): RecommendationHint[] {
  const out: RecommendationHint[] = [];
  for (const rec of readRecommendations(body, seed_id)) {
    for (const [dimension, value] of Object.entries(rec.suggests)) {
      if (value === undefined || value === null || Array.isArray(value)) continue;
      out.push({
        id: rec.id,
        dimension: dimension as keyof ResolvedCostume,
        value: String(value),
        words: rec.words,
        ...(rec.source === 'verdict'
          ? { evidence: rec.verdict_ref ?? rec.comparison_ref }
          : {}),
        marked: rec.source === 'verdict' ? 'from the numbers' : 'something you said',
      });
    }
  }
  return out;
}

/**
 * The write-door half of rule 1. A whole-body save that never went through
 * `writeRecommendation` is refused for the same reason, from either engine.
 */
export function refusedRecommendationWrites(
  current: ProfileBody | undefined, incoming: ProfileBody | undefined,
): { recommendation_id: string; reason: string }[] {
  if (!incoming) return [];
  const before = new Map(
    (current?.paths?.[RECOMMENDATION_PATH] ?? []).map(e => [e.id, JSON.stringify(e)]),
  );
  const out: { recommendation_id: string; reason: string }[] = [];
  for (const entry of incoming.paths?.[RECOMMENDATION_PATH] ?? []) {
    if (before.get(entry.id) === JSON.stringify(entry)) continue;
    const rec = entry.data as unknown as CostumeRecommendation;
    for (const reason of recommendationViolations({ ...rec, id: entry.id })) {
      out.push({ recommendation_id: entry.id, reason });
    }
  }
  return out;
}

/**
 * §8.5: her performance feedback lands here, marked as her observation. It never
 * becomes a strategy diff and never enters a drafting packet as evidence — only
 * spec 27's numeric verdicts carry evidence, and only those may be marked
 * `verdict`.
 */
export function fromHerObservation(input: {
  id: string; words: string; suggests: Partial<ResolvedCostume>; seed_id?: string; now: string;
}): CostumeRecommendation {
  return {
    id: input.id,
    source: 'her-observation',
    suggests: input.suggests,
    words: input.words,
    seed_id: input.seed_id,
    created_at: input.now,
    created_by: 'owner',
  };
}
