// Format rules — spec 24 §7. Universal per format, with per-profile overrides.
//
// PLAN §5.1, exactly: "Format rules — universal per format… stored in the
// universal engine — with per-client overrides stored in that profile's platform
// `rules/`. Override beats universal, always."
//
// The override is a PATCH, not a replacement, and the merge is FIELD BY FIELD.
// The plan's own example is why: ResumeGuru's carousels differ from the
// universal rule in `length_bands` (shorter, bite-size slides) and in `never`
// (never the convert format), and in nothing else. A whole-record override would
// have thrown away the universal structure for no reason.
//
// Nothing in this file calls a model or touches the network. It is a pure
// function of the body, which is what lets §15 test 7 run with no build step.

import type { ProfileBody } from '../tree/body.ts';
import { readPath } from '../tree/body.ts';

/** The dimensions a format rule may forbid a value in. Kept as strings so the
 *  rule data stays plain JSON; the costume module owns the vocabulary. */
export type RuleDimension =
  | 'pillar_id' | 'objective' | 'audience_stage' | 'angle' | 'hook_type'
  | 'platform' | 'format' | 'length' | 'product_intensity' | 'cta' | 'voice';

/**
 * One entry in a rule's `never[]`.
 *
 * A plain string is PROSE: it is shown with the rule and forbids nothing
 * mechanically, because a sentence a machine cannot read must not silently
 * remove a square from her grid.
 *
 * The object form is a MACHINE clause: `when` names the dimension values that
 * trigger it, and `says` is the rule in the words it was written in — which is
 * what the grid quotes back when it refuses a row (§3.5 item 4).
 */
export type NeverClause = string | { when: Partial<Record<RuleDimension, string>>; says: string };

export interface FormatRule {
  /** `carousel`, or `linkedin:post` where the platform changes the rule. */
  id: string;
  label: string;
  /** The ordered shape of the piece. */
  structure: string[];
  /** The finite length options this format offers, in its own unit. */
  length_bands: string[];
  /** Where the depth lives. */
  carries_depth: 'in-the-piece' | 'in-the-caption';
  /** What this format must not be used for. */
  never: NeverClause[];
  /** What "behaves properly on its platform" means for this format. READ by
   *  spec 25's operational format gate; nothing here runs it. */
  format_gate_criteria: string[];
  version: number;
}

/** The fields an override may patch. Anything else on the override entry is
 *  ignored rather than smuggled into the rule. */
export const RULE_FIELDS = [
  'structure', 'length_bands', 'carries_depth', 'never', 'format_gate_criteria',
] as const;

export type RuleField = (typeof RULE_FIELDS)[number];

// ── §7.1 The universal library ───────────────────────────────────────────────
//
// The v1 rules are PLAN §5.1's own drafts, taken as the universal baseline and
// nothing more. A format the plan did not draft a rule for gets NO rule: the
// surface and the brief both say plainly that this format has no rule yet, and
// the brief runs without that block. Honesty over a plausible default (§7.1).

const R = (r: FormatRule): FormatRule => r;

export const UNIVERSAL_FORMAT_RULES: FormatRule[] = [
  R({
    id: 'carousel', label: 'Carousel', version: 1,
    structure: [
      'Cover: one hook, and only the hook',
      'One point per slide, in order',
      'A slide that turns the argument',
      'A close that lands on the CTA',
    ],
    length_bands: ['6 to 8 slides', '8 to 10 slides', '10 to 12 slides'],
    carries_depth: 'in-the-caption',
    never: ['Never more than one point on a slide. If it needs two, it needs two slides.'],
    format_gate_criteria: [
      'The cover reads on its own at thumbnail size',
      'Every slide holds exactly one point',
      'The caption carries the depth the slides could not',
    ],
  }),
  R({
    id: 'reel', label: 'Reel', version: 1,
    structure: [
      'Hook in the first line, spoken',
      'One argument, carried the whole way',
      'The payoff, said out loud',
      'The CTA, once',
    ],
    length_bands: ['under 15 seconds', '15 to 30 seconds', '30 to 60 seconds', '60 to 90 seconds'],
    carries_depth: 'in-the-piece',
    never: ['Never open with an introduction. The hook is the first thing said.'],
    format_gate_criteria: [
      'The first line is the hook, not a greeting',
      'It is spoken language, not written language read aloud',
      'One argument, and it pays off before the end',
    ],
  }),
  R({
    id: 'linkedin:post', label: 'LinkedIn post', version: 1,
    structure: [
      'A strong claim in the first two lines',
      'The reasoning, at length',
      'What it means for the reader',
      'The CTA, plainly',
    ],
    length_bands: ['short, under 150 words', 'medium, 150 to 400 words', 'long, 400 to 800 words'],
    carries_depth: 'in-the-piece',
    never: ['Never a hook with no reasoning behind it. This platform reads the argument.'],
    format_gate_criteria: [
      'The claim is in the part that shows before "see more"',
      'The reasoning is actually there, not promised',
    ],
  }),
  R({
    id: 'newsletter', label: 'Newsletter', version: 1,
    structure: [
      'A scene, something that actually happened',
      'The full argument',
      'A framework they can use',
      'The CTA at the end, once',
    ],
    length_bands: ['400 to 800 words', '800 to 1500 words', '1500 words and up'],
    carries_depth: 'in-the-piece',
    never: ['Never a summary of a post. If it exists elsewhere in full, this is a repost.'],
    format_gate_criteria: [
      'It opens on a scene, not on a thesis',
      'The framework is usable without buying anything',
    ],
  }),
];

const UNIVERSAL_BY_ID = new Map(UNIVERSAL_FORMAT_RULES.map(r => [r.id, r]));

/**
 * Spec 25 §4.5: the universal library lives in CODE, versioned, belonging to no
 * profile — the tree is per-profile data, so giving it a tree address would be a
 * category error. This version is written on every run and every gate run, so a
 * draft is always traceable to the method that made it.
 */
export const FORMAT_RULES_VERSION = 1;

/** Format and platform names arrive as she wrote them. This is the one place
 *  they are normalized, so `Carousel`, `carousel` and `Carousel ` are one key. */
export function formatKey(name: string): string {
  return String(name ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export const RULES_PATH_FOR = (platform: string) =>
  `context/content-strategy/platforms/${formatKey(platform)}/rules`;

// ── §7.2 Resolution ──────────────────────────────────────────────────────────

export interface ResolvedFormatRule {
  /** The merged rule, or null when no rule exists at any level. */
  rule: FormatRule | null;
  /** Exactly the fields the profile's override supplied. */
  overridden_fields: RuleField[];
  source: 'override-on-universal' | 'override-only' | 'universal' | 'none';
  universal_id: string | null;
  override_id: string | null;
}

export const NO_RULE: ResolvedFormatRule = {
  rule: null, overridden_fields: [], source: 'none', universal_id: null, override_id: null,
};

/** The universal half of the lookup, in the spec's deterministic order:
 *  `<platform>:<format>` first, then `<format>`. */
export function universalRule(platform: string, format: string): FormatRule | null {
  const p = formatKey(platform);
  const f = formatKey(format);
  if (!f) return null;
  return UNIVERSAL_BY_ID.get(`${p}:${f}`) ?? UNIVERSAL_BY_ID.get(f) ?? null;
}

/** The profile's override entry for this platform and format, if it has one. */
export function overrideEntry(body: ProfileBody, platform: string, format: string) {
  const path = RULES_PATH_FOR(platform);
  const f = formatKey(format);
  try {
    return readPath(body, path).find(e => {
      if (e.state !== 'active') return false;
      const d = e.data as Record<string, unknown>;
      return formatKey(String(d.format ?? d.format_id ?? d.name ?? '')) === f;
    }) ?? null;
  } catch {
    // An undeclared path throws (law 4). A profile with no platform folder yet
    // simply has no override, which is not an error.
    return null;
  }
}

/**
 * `resolveFormatRule` — the whole of §7.2.
 *
 * Lookup order, deterministic: the profile's override → the universal rule for
 * `<platform>:<format>` → the universal rule for `<format>` → none.
 *
 * The merge is field by field, override winning, and the result always reports
 * which fields came from where — which is what lets the brief cite its source.
 */
export function resolveFormatRule(
  body: ProfileBody | undefined, platform: string, format: string,
): ResolvedFormatRule {
  const universal = universalRule(platform, format);
  const entry = body ? overrideEntry(body, platform, format) : null;

  if (!entry) {
    return universal
      ? { rule: universal, overridden_fields: [], source: 'universal', universal_id: universal.id, override_id: null }
      : { ...NO_RULE };
  }

  const data = entry.data as Record<string, unknown>;
  const overridden: RuleField[] = [];
  const base: FormatRule = universal ?? {
    id: `${formatKey(platform)}:${formatKey(format)}`,
    label: String(data.label ?? format),
    structure: [], length_bands: [], carries_depth: 'in-the-piece',
    never: [], format_gate_criteria: [], version: 1,
  };

  const merged: FormatRule = { ...base, never: [...base.never] };
  for (const field of RULE_FIELDS) {
    if (!(field in data)) continue;
    const value = data[field];
    if (value === undefined) continue;
    overridden.push(field);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (merged as any)[field] = value;
  }
  if (typeof data.label === 'string' && data.label.trim()) merged.label = data.label.trim();
  merged.version = typeof data.version === 'number' ? data.version : base.version;

  return {
    rule: merged,
    overridden_fields: overridden,
    source: universal ? 'override-on-universal' : 'override-only',
    universal_id: universal?.id ?? null,
    override_id: entry.id,
  };
}

// ── The headline, and the merged rule in words ───────────────────────────────

/** One line for the grid: "Carousel, 8 to 10 slides, cover is one hook" (§5.1). */
export function ruleHeadline(resolved: ResolvedFormatRule, length?: string): string {
  if (!resolved.rule) return 'No rule for this format yet';
  const r = resolved.rule;
  const band = length || r.length_bands[0] || '';
  const first = r.structure[0] ? r.structure[0].replace(/^[A-Za-z ]+:\s*/, '') : '';
  return [r.label, band, first].filter(Boolean).join(', ');
}

/**
 * The merged rule as the brief's packet carries it: every field marked universal
 * or override (§6.4). This is what spec 23 deliberately withheld from
 * extraction, because format RULES belong to drafting, not to understanding an
 * idea.
 */
export function describeMergedRule(resolved: ResolvedFormatRule): string[] {
  if (!resolved.rule) {
    return ['This format has no rule yet, universal or per-profile. Write to the format honestly and do not invent one.'];
  }
  const r = resolved.rule;
  const mark = (f: RuleField) => (resolved.overridden_fields.includes(f) ? 'this profile' : 'universal');
  const out: string[] = [`Format rule: ${r.label} (${resolved.source})`];
  out.push(`Structure (${mark('structure')}): ${r.structure.join(' | ') || 'not stated'}`);
  out.push(`Length options (${mark('length_bands')}): ${r.length_bands.join(' | ') || 'not stated'}`);
  out.push(`Depth lives (${mark('carries_depth')}): ${r.carries_depth}`);
  out.push(`Never (${mark('never')}): ${r.never.map(neverText).join(' | ') || 'nothing stated'}`);
  out.push(`Behaves properly when (${mark('format_gate_criteria')}): ${r.format_gate_criteria.join(' | ') || 'not stated'}`);
  return out;
}

export function neverText(clause: NeverClause): string {
  return typeof clause === 'string' ? clause : clause.says;
}

/**
 * Spec 25 §4.5: the merged rule set, NAMED AND HASHED, so a verdict written a
 * year from now can still say which rules judged the piece. Two resolutions that
 * differ in one overridden field produce two different strings — which is what
 * acceptance test 4 asserts.
 */
export function formatRulesResolution(resolved: ResolvedFormatRule): string {
  if (!resolved.rule) return `none@v${FORMAT_RULES_VERSION}`;
  const body = JSON.stringify({
    id: resolved.rule.id,
    structure: resolved.rule.structure,
    length_bands: resolved.rule.length_bands,
    carries_depth: resolved.rule.carries_depth,
    never: resolved.rule.never,
    format_gate_criteria: resolved.rule.format_gate_criteria,
    overridden: resolved.overridden_fields,
    source: resolved.source,
  });
  // A small, stable, dependency-free hash. It names a rule set; it guards
  // nothing, so a cryptographic one would be theatre.
  let h = 5381;
  for (let i = 0; i < body.length; i++) h = ((h * 33) ^ body.charCodeAt(i)) >>> 0;
  const marks = resolved.overridden_fields.length
    ? `+${[...resolved.overridden_fields].sort().join(',')}`
    : '';
  return `${resolved.rule.id}@v${resolved.rule.version}${marks}#${h.toString(16)}`;
}

// ── §3.5 item 4 — a combination a format rule forbids ────────────────────────

export interface ForbiddenClause {
  rule_id: string;
  /** The rule in the words it was written in. The grid quotes this. */
  says: string;
  /** Which dimension values triggered it. */
  when: Partial<Record<RuleDimension, string>>;
}

/**
 * Which of this rule's machine clauses this costume trips.
 *
 * A prose `never` entry forbids nothing here: a sentence the machine cannot read
 * must not silently remove a square from her grid. It travels with the rule and
 * she reads it herself.
 */
export function forbiddenBy(
  resolved: ResolvedFormatRule, costume: Record<string, unknown>,
): ForbiddenClause[] {
  const rule = resolved.rule;
  if (!rule) return [];
  const out: ForbiddenClause[] = [];
  for (const clause of rule.never) {
    if (typeof clause === 'string') continue;
    const when = clause.when ?? {};
    const keys = Object.keys(when) as RuleDimension[];
    if (!keys.length) continue;
    const trips = keys.every(k => {
      const want = formatKey(String(when[k] ?? ''));
      const have = formatKey(String((costume as Record<string, unknown>)[k] ?? ''));
      return !!want && want === have;
    });
    if (trips) out.push({ rule_id: rule.id, says: clause.says, when });
  }
  return out;
}
