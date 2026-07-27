// The six machine checks — spec 23 §5.6.
//
// They do not judge taste. She does. They catch the specific failures that would
// make the intelligence bar unmeasurable.
//
// Check 2 REJECTS and the run retries once. Checks 3–6 badge and never hide:
// hiding a flawed proposal would teach her the engine is smarter than it is.
//
// Every function here is pure. No body, no network, no clock — which is what
// lets the whole check layer be tested without a model.

import type { SeedProposal } from './schema.ts';
import { filledFieldCount } from './schema.ts';

export type CheckId =
  | 'schema' | 'verbatim' | 'seed-vs-post' | 'boundary' | 'invention' | 'duplicate';

export interface Badge {
  check: CheckId;
  /** Plain words, shown on the card exactly as written. */
  label: string;
  detail?: string;
}

export interface CheckedProposal {
  proposal: SeedProposal;
  badges: Badge[];
}

export interface CheckResult {
  /** What she is shown. Order preserved. */
  shown: CheckedProposal[];
  /** Rejected by check 2 — never shown, with the violation named for the retry. */
  rejected: { proposal: SeedProposal; reason: string }[];
}

export interface CheckContext {
  /** The capture, exactly as she gave it. */
  capture: string;
  /** Phrases from boundaries/'s never-promise list. */
  never_promises: string[];
  /** Existing seeds, for the local exact-name duplicate match. */
  seeds: { id: string; name: string }[];
}

// ── Check 2: the verbatim guard ─────────────────────────────────────────────

/** Whitespace normalized, nothing else. Case and punctuation still matter —
 *  "kept verbatim" would mean nothing otherwise. */
export function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

export function isVerbatimSubstring(fragment: string | null, source: string): boolean {
  if (!fragment || !fragment.trim()) return true;   // nothing claimed, nothing to check
  return normalizeWhitespace(source).includes(normalizeWhitespace(fragment));
}

/**
 * `raw_thought` and `evidence_span` must EACH be an exact substring of the
 * capture. This is what makes "kept verbatim forever" mechanical rather than a
 * promise (§5.6).
 */
export function verbatimViolation(p: SeedProposal, capture: string): string | null {
  if (!isVerbatimSubstring(p.raw_thought, capture)) {
    return `"${p.name}": raw_thought is not word-for-word from the capture`;
  }
  if (!isVerbatimSubstring(p.evidence_span, capture)) {
    return `"${p.name}": evidence_span is not word-for-word from the capture`;
  }
  return null;
}

// ── Checks 3–6: badge, never hide ───────────────────────────────────────────

/** A proposal must carry a reframe AND (≥2 pillars OR ≥3 angles). */
export function passesSeedVsPost(p: SeedProposal): boolean {
  const hasReframe = !!p.reframe && p.reframe.trim().length > 0;
  const pillars = (p.possible_pillars ?? []).length;
  const angles = (p.possible_angles ?? []).length;
  return hasReframe && (pillars >= 2 || angles >= 3);
}

/** The whole text of a proposal, for the boundary scan. */
function proposalText(p: SeedProposal): string {
  return Object.values(p as unknown as Record<string, unknown>)
    .flatMap(v => (Array.isArray(v) ? v.map(String) : typeof v === 'string' ? [v] : []))
    .join('\n')
    .toLowerCase();
}

export function crossedBoundaries(p: SeedProposal, neverPromises: string[]): string[] {
  const text = proposalText(p);
  return neverPromises.filter(phrase => phrase.trim() && text.includes(phrase.toLowerCase().trim()));
}

export const THIN_CAPTURE_WORDS = 150;
export const INVENTION_FIELD_LIMIT = 8;

export function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/** A short capture that produced a very full proposal is worth a second look. */
export function looksInvented(p: SeedProposal, capture: string): boolean {
  return wordCount(capture) < THIN_CAPTURE_WORDS && filledFieldCount(p) > INVENTION_FIELD_LIMIT;
}

/** The model's own `duplicate_of`, plus a local exact-name match against the
 *  bank (case and whitespace insensitive). */
export function duplicateOf(
  p: SeedProposal, seeds: { id: string; name: string }[],
): { id: string; name: string } | null {
  if (p.duplicate_of) {
    const hit = seeds.find(s => s.id === p.duplicate_of);
    if (hit) return hit;
  }
  const name = normalizeWhitespace(p.name).toLowerCase();
  return seeds.find(s => normalizeWhitespace(s.name).toLowerCase() === name) ?? null;
}

// ── The whole pass ──────────────────────────────────────────────────────────

/**
 * Run every check over one batch of proposals. Check 2 rejects; 3–6 badge.
 * A rejected proposal is never shown, and its violation is named so the retry
 * can be told exactly what went wrong.
 */
export function runChecks(proposals: SeedProposal[], ctx: CheckContext): CheckResult {
  const shown: CheckedProposal[] = [];
  const rejected: { proposal: SeedProposal; reason: string }[] = [];

  for (const p of proposals) {
    const violation = verbatimViolation(p, ctx.capture);
    if (violation) {
      rejected.push({ proposal: p, reason: violation });
      continue;
    }

    const badges: Badge[] = [];

    if (!passesSeedVsPost(p)) {
      badges.push({
        check: 'seed-vs-post',
        label: 'post idea, not a seed',
        detail: 'It needs a reframe, and either two pillars or three angles, before it can be locked.',
      });
    }

    const crossed = crossedBoundaries(p, ctx.never_promises);
    if (crossed.length) {
      badges.push({
        check: 'boundary',
        label: 'crosses a boundary',
        detail: `This brand never promises: ${crossed.join(', ')}`,
      });
    }

    if (looksInvented(p, ctx.capture)) {
      badges.push({
        check: 'invention',
        label: 'thin capture — check for invention',
        detail: 'You said very little and this came back very full. Read it closely.',
      });
    }

    const dupe = duplicateOf(p, ctx.seeds);
    if (dupe) {
      badges.push({
        check: 'duplicate',
        label: `looks like ${dupe.name}`,
        detail: dupe.id,
      });
    }

    shown.push({ proposal: p, badges });
  }

  return { shown, rejected };
}

/** The line handed back to the model on the one retry check 2 allows. */
export function retryInstruction(reasons: string[]): string {
  return [
    'Your previous answer was rejected by the verbatim guard.',
    ...reasons.map(r => `- ${r}`),
    'raw_thought and evidence_span must each be copied EXACTLY from the capture, word for word.',
    'Copy the words. Do not rewrite them.',
  ].join('\n');
}
