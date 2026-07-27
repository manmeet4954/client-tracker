// The costume — spec 24 §3 and §4.
//
// PLAN §5.1: "finite lists, stored in the universal engine." Following spec 22
// §3.3's precedent exactly: the registries are code beside the tree registries;
// what lives at the paths is data. That is what lets a client's costume
// vocabulary be identical to every other client's while their pillars, CTAs,
// voices, proof, platforms and formats differ completely. Customization is fuel,
// not machinery.
//
// PLAN §3.10, binding: "the engine is not a form that pushes you to the next
// step… you SELECT; only then does the entry go into build state." So nothing in
// this file writes. It reads, it enumerates, and it reports what is missing.
// The write lives in resolve.ts, behind her confirmation.

import type { SwitchConfig } from '../tree/contract.ts';
import type { ProfileBody } from '../tree/body.ts';
import { readPath, readUnder } from '../tree/body.ts';
import type { ResolvedCostume, Seed } from '../tree/objects.ts';
import { pathIsActive } from './packet.ts';
import {
  forbiddenBy, formatKey, resolveFormatRule, ruleHeadline,
  type ForbiddenClause, type ResolvedFormatRule,
} from './formats.ts';

// ── §3.3 The twelve dimensions ───────────────────────────────────────────────

export type CostumeDimension =
  | 'pillar_id' | 'objective' | 'audience_stage' | 'angle' | 'hook_type'
  | 'platform' | 'format' | 'length' | 'product_intensity' | 'cta' | 'voice' | 'proof';

/** S4's seven, plus the four this spec adds. Proof is the one that stays a set. */
export const SINGLE_VALUE_DIMENSIONS: CostumeDimension[] = [
  'pillar_id', 'objective', 'audience_stage', 'angle', 'hook_type',
  'platform', 'format', 'length', 'product_intensity', 'cta', 'voice',
];

export interface DimensionSpec {
  id: CostumeDimension;
  label: string;
  /** Where the list comes from: the universal engine, or a profile folder. */
  source: 'universal' | 'folder' | 'format-rule';
  /** The folder, for the four that read one. */
  path?: string;
  resolves: 'one' | 'set';
  /** One plain line for the surface. */
  hint?: string;
}

export const DIMENSIONS: DimensionSpec[] = [
  { id: 'pillar_id', label: 'Pillar', source: 'folder', path: 'context/content-strategy/pillars', resolves: 'one' },
  { id: 'objective', label: 'Objective', source: 'universal', resolves: 'one' },
  { id: 'audience_stage', label: 'Audience stage', source: 'universal', resolves: 'one' },
  { id: 'angle', label: 'Angle', source: 'universal', resolves: 'one' },
  { id: 'hook_type', label: 'Hook type', source: 'universal', resolves: 'one' },
  { id: 'platform', label: 'Platform', source: 'folder', path: 'context/content-strategy/platforms', resolves: 'one' },
  {
    id: 'format', label: 'Format', source: 'folder', resolves: 'one',
    hint: 'Pick a platform first. Formats live inside platforms.',
  },
  {
    id: 'length', label: 'Length', source: 'format-rule', resolves: 'one',
    hint: 'Length comes from the format rule. A reel counts seconds and a carousel counts slides.',
  },
  { id: 'product_intensity', label: 'Product intensity', source: 'universal', resolves: 'one' },
  { id: 'cta', label: 'CTA', source: 'folder', path: 'context/content-strategy/ctas', resolves: 'one' },
  { id: 'voice', label: 'Voice', source: 'folder', path: 'context/content-strategy/voice', resolves: 'one' },
  {
    id: 'proof', label: 'Proof', source: 'folder', path: 'context/content-strategy/proof-library',
    resolves: 'set',
    hint: 'Proof stays a set. Two proof items are one piece, not two pieces.',
  },
];

// ── §4.1 The lists, shipped FULL ─────────────────────────────────────────────
//
// The vocabulary rule, from PLAN §5.1 item 1 and binding: "No shortlisting now…
// Sol's lists stand as shipped options; Claude may add; only she removes, and
// removal happens through use, not upfront." So no list is trimmed here, no list
// ships with a "recommended" subset, and nothing prunes itself. A value she
// stops using is hidden PER PROFILE through a feedback item she accepts
// (§7.4) — never by an edit to these lists.

export const OBJECTIVES = [
  'reach', 'engagement', 'trust', 'education', 'lead generation', 'conversion', 'retention',
];

export const AUDIENCE_STAGES = [
  'unaware', 'problem-aware', 'solution-aware', 'product-aware', 'existing customer',
];

export const ANGLES = [
  'question', 'contrarian', 'mistake', 'founder observation', 'framework', 'case study',
  'personal story', 'before-and-after', 'tutorial', 'product demo', 'myth', 'warning', 'prediction',
];

export const HOOK_TYPES = [
  'direct claim', 'question', 'pain recognition', 'curiosity', 'specific result',
  'disagreement', 'confession', 'story opening',
];

export const PRODUCT_INTENSITIES = [
  'none', 'light mention', 'natural connection', 'product-led', 'direct promotion',
];

export const UNIVERSAL_LISTS: Partial<Record<CostumeDimension, string[]>> = {
  objective: OBJECTIVES,
  audience_stage: AUDIENCE_STAGES,
  angle: ANGLES,
  hook_type: HOOK_TYPES,
  product_intensity: PRODUCT_INTENSITIES,
};

/**
 * Every list ships with a free-text lane. A finite list that cannot be escaped
 * produces false answers (spec 22 §4.7's rule, and it holds here for the same
 * reason). A free-text value resolves like any other and is snapshotted
 * verbatim; it never silently joins the universal list.
 */
export function isFreeText(dimension: CostumeDimension, value: string): boolean {
  const list = UNIVERSAL_LISTS[dimension];
  if (!list) return false;
  return !!value && !list.includes(value);
}

// ── §4.2 The four dimensions that read profile folders ───────────────────────
//
// Pillar, CTA, voice and proof are NOT universal lists — they are folders, and
// law 3 does the rest. Add a fourth pillar, a new CTA, a second voice register
// or a new proof item today and it appears in these pickers the moment it
// exists, with no code change and nothing blank (§15 test 5).

export interface Option {
  id: string;
  label: string;
  /** Extra line the picker shows under the label, when the folder carries one. */
  detail?: string;
}

function optionsFrom(body: ProfileBody, path: string, config?: SwitchConfig): Option[] {
  if (config && !pathIsActive(path, config)) return [];
  let entries;
  try {
    entries = readPath(body, path);
  } catch {
    return [];
  }
  return entries
    .filter(e => e.state === 'active')
    .map(e => {
      const d = e.data as Record<string, unknown>;
      const label = String(d.label ?? d.name ?? d.title ?? d.value ?? e.id);
      const detail = typeof d.text === 'string' ? d.text
        : typeof d.value === 'string' && d.value !== label ? d.value
          : undefined;
      return { id: e.id, label, detail };
    });
}

/** Active pillars, read from strategy. Law 3, not a registration step. */
export function pillarOptions(body: ProfileBody, config?: SwitchConfig): Option[] {
  return readUnder(body, 'context/content-strategy/pillars')
    .filter(e => e.state === 'active' && e.type === 'pillar')
    .filter(e => !config || pathIsActive(e.path, config))
    .map(e => {
      const d = e.data as Record<string, unknown>;
      return { id: e.id, label: String(d.name ?? e.id), detail: pillarJob(body, e.id) ?? undefined };
    });
}

/** The pillar entry itself, and the folder its parameters live in (law 2). */
function pillarEntry(body: ProfileBody, pillarId: string) {
  return readUnder(body, 'context/content-strategy/pillars')
    .find(e => e.type === 'pillar' && e.id === pillarId) ?? null;
}

/**
 * A pillar's job, read NOW rather than looked up later (§5.4). Found through the
 * pillar's own folder rather than by id prefix, because the folder key is the
 * pillar's NAME and the entry id is the pillar's id — matching on either alone
 * would be a coincidence rather than a lookup.
 */
export function pillarJob(body: ProfileBody, pillarId: string): string | null {
  const pillar = pillarEntry(body, pillarId);
  if (!pillar) return null;
  const job = readUnder(body, 'context/content-strategy/pillars')
    .find(e => e.path === `${pillar.path}/job`);
  if (job) {
    const d = job.data as Record<string, unknown>;
    const value = d.job ?? d.value ?? d.text;
    if (value) return String(value);
  }
  const d = pillar.data as Record<string, unknown>;
  return d.job ? String(d.job) : null;
}

/**
 * §3.5 item 2: a platform at `history` or `hidden` does not appear at all —
 * PLAN §2, whatever the switches turn off is NOT rendered. Existing pieces on it
 * stay readable, which is the body's business, not this picker's.
 */
export function platformOptions(body: ProfileBody, config: SwitchConfig): Option[] {
  return readUnder(body, 'context/content-strategy/platforms')
    .filter(e => e.state === 'active' && e.type === 'platform')
    .filter(e => pathIsActive(e.path, config))
    .map(e => {
      const d = e.data as Record<string, unknown>;
      return { id: String(d.name ?? e.id), label: String(d.name ?? e.id) };
    });
}

/**
 * Format lives inside its platform, and this makes it STRUCTURAL rather than a
 * convention: the only formats returned are the ones in THAT platform's folder.
 */
export function formatOptions(body: ProfileBody, config: SwitchConfig, platform: string): Option[] {
  const path = `context/content-strategy/platforms/${formatKey(platform)}/formats`;
  if (!pathIsActive(path, config)) return [];
  let entries;
  try {
    entries = readPath(body, path);
  } catch {
    return [];
  }
  return entries
    .filter(e => e.state === 'active' && e.type === 'format')
    .map(e => {
      const d = e.data as Record<string, unknown>;
      return { id: String(d.name ?? d.format ?? e.id), label: String(d.name ?? d.format ?? e.id) };
    });
}

export function ctaOptions(body: ProfileBody, config?: SwitchConfig): Option[] {
  return optionsFrom(body, 'context/content-strategy/ctas', config);
}

/**
 * Most profiles declare one decided voice. The picker then shows one option and
 * the surface resolves it automatically. It is still a dimension, it is still
 * snapshotted, and the day she declares a second register it appears here with
 * no code change (law 3).
 */
export function voiceOptions(body: ProfileBody, config?: SwitchConfig): Option[] {
  return optionsFrom(body, 'context/content-strategy/voice', config);
}

export function proofOptions(body: ProfileBody, config?: SwitchConfig): Option[] {
  return optionsFrom(body, 'context/content-strategy/proof-library', config);
}

/** §3.3: length is NOT a universal list. Its options come from the resolved
 *  FORMAT RULE, which is universal and per-profile overridable. */
export function lengthOptions(resolved: ResolvedFormatRule): string[] {
  return resolved.rule?.length_bands ?? [];
}

// ── §3.4 What the surface shows without being asked ──────────────────────────
//
// Hints, never rails. Each is a line she can ignore, and each cites where it
// came from.

/** The seed's own suggestions, from the seed's own fields — no second document. */
export function seedSuggestions(seed: Seed): { pillars: string[]; angles: string[] } {
  return { pillars: seed.possible_pillars ?? [], angles: seed.possible_angles ?? [] };
}

/** This month's actual share against a pillar's `mix-target`. The taxonomy's
 *  40 / 25 / 20 / 15 guardrail is a value in the tree, not a rule in code. */
export function mixLine(body: ProfileBody, pillarId: string, month: string): string | null {
  const pillar = pillarEntry(body, pillarId);
  const target = pillar
    ? readUnder(body, 'context/content-strategy/pillars')
      .find(e => e.path === `${pillar.path}/mix-target`)
    : undefined;
  const targetPct = target ? Number((target.data as Record<string, unknown>).target_pct ?? NaN) : NaN;

  let pieces;
  try {
    pieces = readPath(body, 'work-log/creation');
  } catch {
    return null;
  }
  const thisMonth = pieces.filter(e => {
    const d = e.data as Record<string, unknown>;
    return String(d.created_month ?? '') === month;
  });
  if (!thisMonth.length && !Number.isFinite(targetPct)) return null;
  const mine = thisMonth.filter(e => {
    const c = (e.data as { costume?: Record<string, unknown> }).costume ?? {};
    return String(c.pillar_id ?? '') === pillarId;
  }).length;
  const share = thisMonth.length ? Math.round((mine / thisMonth.length) * 100) : 0;
  return Number.isFinite(targetPct)
    ? `${share}% this month, against a target of ${targetPct}%`
    : `${share}% this month, no target set`;
}

/** Proof this seed says it needs, and whether the library actually holds it. */
export function proofGaps(body: ProfileBody, seed: Seed): { required: string; found: Option | null }[] {
  const library = proofOptions(body);
  return (seed.proof_required ?? []).map(required => {
    const want = String(required).trim().toLowerCase();
    const found = library.find(o =>
      o.id.toLowerCase() === want || o.label.toLowerCase().includes(want) || want.includes(o.label.toLowerCase()),
    ) ?? null;
    return { required: String(required), found };
  });
}

// ── §5.1 The variant grid ────────────────────────────────────────────────────

/**
 * What she has selected. Every dimension is a LIST, because multi-select is the
 * point (PLAN §5.1 item 1). Formats are keyed `platform::format` so a format can
 * never be selected under the wrong platform — §3.4's law, rendered structurally
 * rather than remembered.
 */
export type Selection = Partial<Record<CostumeDimension, string[]>>;

export const FORMAT_SEP = '::';

export function formatSelectionKey(platform: string, format: string): string {
  return `${platform}${FORMAT_SEP}${format}`;
}

export function parseFormatSelection(key: string): { platform: string; format: string } {
  const i = key.indexOf(FORMAT_SEP);
  return i < 0
    ? { platform: '', format: key }
    : { platform: key.slice(0, i), format: key.slice(i + FORMAT_SEP.length) };
}

export interface VariantRow {
  /** Stable across re-enumeration, so her unchecks survive a picker move. */
  key: string;
  costume: Partial<ResolvedCostume>;
  rule: ResolvedFormatRule;
  /** "Carousel, 8 to 10 slides, cover is one hook" (§5.1). */
  headline: string;
  /** The full costume in plain words. */
  words: string;
  /** Dimensions with nothing chosen yet. A row with any of these cannot resolve. */
  missing: CostumeDimension[];
  /** Rule-forbidden, shown WITH the rule quoted — never hidden (§3.5 item 4). */
  forbidden: ForbiddenClause[];
}

function labelOf(options: Option[], id: string): string {
  return options.find(o => o.id === id)?.label ?? id;
}

/**
 * Every combination, enumerated, one row each (§5.1).
 *
 * Three things make the grid the safety mechanism rather than a display:
 * nothing is written until she confirms; every row can be unchecked; and a
 * runaway product is visible before it exists. No cap is invented here — the
 * enumeration IS the guard, and twenty-four pieces is her call to make with her
 * eyes open.
 *
 * Proof does not multiply the grid: it stays a set and travels on every row
 * (§5.3).
 */
export function enumerateVariants(
  body: ProfileBody, config: SwitchConfig, selection: Selection,
): VariantRow[] {
  const pillars = pillarOptions(body, config);
  const ctas = ctaOptions(body, config);
  const voices = voiceOptions(body, config);

  const proof = selection.proof ?? [];
  const slot = (d: CostumeDimension): (string | undefined)[] => {
    const picked = (selection[d] ?? []).filter(Boolean);
    return picked.length ? picked : [undefined];
  };

  const rows: VariantRow[] = [];
  const formatKeys = (selection.format ?? []).filter(Boolean);

  // The cascade reaches the GRID, not only the pickers. A platform she selected
  // before turning it off produces no row at all: PLAN §2, whatever the switches
  // turn off is NOT rendered. Her past pieces on it stay readable, which is the
  // body's business and not this function's.
  const livePlatforms = new Set(platformOptions(body, config).map(p => p.id));
  const pickedPlatforms = (selection.platform ?? []).filter(Boolean);
  const platforms: (string | undefined)[] = pickedPlatforms.length
    ? pickedPlatforms.filter(p => livePlatforms.has(p))
    : [undefined];

  for (const platform of platforms) {
    // Only formats that belong to THIS platform, and only formats that still
    // exist in its folder. A format can never appear under the wrong platform,
    // at the picker or here.
    const liveFormats = platform ? new Set(formatOptions(body, config, platform).map(f => f.id)) : new Set<string>();
    const pickedForPlatform = platform
      ? formatKeys.map(parseFormatSelection).filter(f => f.platform === platform).map(f => f.format)
      : [];
    const formats: (string | undefined)[] = pickedForPlatform.filter(f => liveFormats.has(f));
    // Nothing picked for this platform yet is a row that says what it is
    // missing. Everything picked for it being gone is no row at all.
    const formatSlots: (string | undefined)[] = pickedForPlatform.length
      ? formats
      : [undefined];
    if (!formatSlots.length) continue;

    for (const format of formatSlots) {
      const rule = platform && format
        ? resolveFormatRule(body, platform, format)
        : { rule: null, overridden_fields: [], source: 'none' as const, universal_id: null, override_id: null };
      const bands = lengthOptions(rule);
      const pickedLengths = (selection.length ?? []).filter(Boolean);
      // A selected length belongs to this row when the rule offers it, or when
      // it is free text no rule offers (§4.1's free-text lane).
      const lengths: (string | undefined)[] = pickedLengths.length
        ? pickedLengths.filter(l => (bands.length ? bands.includes(l) : true))
        : [undefined];
      const lengthSlots = lengths.length ? lengths : [undefined];

      for (const objective of slot('objective')) {
        for (const audience_stage of slot('audience_stage')) {
          for (const angle of slot('angle')) {
            for (const hook_type of slot('hook_type')) {
              for (const product_intensity of slot('product_intensity')) {
                for (const pillar_id of slot('pillar_id')) {
                  for (const cta of slot('cta')) {
                    for (const voice of slot('voice')) {
                      for (const length of lengthSlots) {
                        const costume: Partial<ResolvedCostume> = {
                          pillar_id, platform, format, objective, audience_stage, angle,
                          hook_type, length, product_intensity, cta, voice,
                          proof: [...proof],
                        };
                        const missing = SINGLE_VALUE_DIMENSIONS.filter(
                          d => !(costume as Record<string, unknown>)[d],
                        );
                        rows.push({
                          key: SINGLE_VALUE_DIMENSIONS.map(
                            d => String((costume as Record<string, unknown>)[d] ?? ''),
                          ).join('|'),
                          costume,
                          rule,
                          headline: ruleHeadline(rule, length),
                          words: [
                            pillar_id && `${labelOf(pillars, pillar_id)}`,
                            platform, format, length, objective, audience_stage, angle,
                            hook_type, product_intensity,
                            cta && labelOf(ctas, cta),
                            voice && labelOf(voices, voice),
                          ].filter(Boolean).join(' · '),
                          missing,
                          forbidden: forbiddenBy(rule, costume as Record<string, unknown>),
                        });
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  return rows;
}

/** The count above the grid: "12 pieces." */
export function variantCount(rows: VariantRow[]): number {
  return rows.length;
}

// ── §5.6 The one changed dimension ───────────────────────────────────────────

/**
 * Which dimensions a set of rows HOLDS and which it CHANGES, read off the
 * costumes rather than inferred. Spec 21's migration refused to infer these for
 * the legacy experiment flag, and it was right to.
 *
 * Proof is excluded on purpose: it is evidence rather than an expressive choice,
 * so varying it does not produce a different post the way a different hook does.
 * A batch that differs only in proof is not a controlled comparison (§5.3).
 */
export function dimensionSpread(costumes: Partial<ResolvedCostume>[]): {
  held: CostumeDimension[]; changed: CostumeDimension[];
} {
  const held: CostumeDimension[] = [];
  const changed: CostumeDimension[] = [];
  for (const d of SINGLE_VALUE_DIMENSIONS) {
    const values = new Set(costumes.map(c => String((c as Record<string, unknown>)[d] ?? '')));
    (values.size > 1 ? changed : held).push(d);
  }
  return { held, changed };
}

// ── §10 Picking up a revisit proposal ────────────────────────────────────────

/**
 * Spec 23 reserved `kind: 'revisit-seed'` proposals, whose pick-up "opens the
 * engine room on that seed with the winning costume pre-filled — which is
 * Content Engine II's surface." This is that pre-fill.
 *
 * Pre-selected, and still nothing is written until she confirms the grid. A
 * recommendation is a hint on a picker, never a pre-selection of the WRITE.
 */
export function prefillFromRecommendation(costume: Partial<ResolvedCostume> | undefined): Selection {
  if (!costume) return {};
  const out: Selection = {};
  for (const d of SINGLE_VALUE_DIMENSIONS) {
    const v = (costume as Record<string, unknown>)[d];
    if (typeof v === 'string' && v) {
      out[d] = d === 'format' && costume.platform
        ? [formatSelectionKey(costume.platform, v)]
        : [v];
    }
  }
  if (costume.proof?.length) out.proof = [...costume.proof];
  return out;
}
