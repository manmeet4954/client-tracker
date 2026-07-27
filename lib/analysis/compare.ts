// Compare — spec 27 §9. The thing the engine is actually built for.
//
// The screen says Compare. The machinery builds a MATCHED COMPARISON (S5) and
// resolves it at equivalent ages (S6) through `resolveComparison`, which spec 21
// already shipped. That function is called AS IT STANDS: not modified, not
// wrapped in something cleverer, and not second-guessed.
//
// Only `hypothesis` is ever typed, and only sometimes. Everything else here is a
// byproduct of work she already did — the 2026-07-10 design law, kept.

import type { ProfileBody } from '../tree/body.ts';
import { putEntry, readPath } from '../tree/body.ts';
import type {
  BodyEntry, MatchedComparison, ObservationWindow, ResolvedCostume,
} from '../tree/objects.ts';
import { WINDOW_AGE_HOURS, resolveComparison } from '../tree/metrics.ts';
import { dimensionSpread } from '../engine/costume.ts';
import type { AnalysisContext, JoinedPiece } from './read.ts';
import { daysBetween } from './compute.ts';

export const COMPARISON_PATH = 'work-log/analysis/comparisons';

export class ComparisonRefused extends Error {}

/**
 * §20.3: `MatchedComparison` is used exactly as spec 21 shipped it, with no
 * field added and no second version. `planned`, the declared changed variable
 * and a resolution's parentage are ENTRY metadata around the canonical object —
 * they travel with the entry, never inside the object.
 */
export interface ComparisonEntry extends MatchedComparison {
  planned?: boolean;
  /** What she said she was changing, on a planned one. Compared to what actually did. */
  declared_changed_variable?: string;
  /** Set on a resolution row: the comparison it resolves. */
  resolves?: string;
  resolved_at?: string;
  metric_id?: string;
  /** The ACTUAL ages of the readings on each side (§9.3). 19h and 31h are both
   *  "first-24h", and the screen says so. */
  ages?: { piece_id: string; age_hours: number }[];
  /** True when two or more dimensions differ (§9.2). */
  confounded?: boolean;
}

const WINDOWS: ObservationWindow[] = ['first-24h', '7d', '30d', 'lifetime'];

// ── §9.2 What the machinery records without asking her for it ────────────────

export interface BuildInput {
  id: string;
  piece_ids: string[];
  metric_id: string;
  /** Optional on an ad-hoc comparison, REQUIRED on a planned one (§9.4). */
  hypothesis?: string;
  window?: ObservationWindow;
  planned?: boolean;
  declared_changed_variable?: string;
  now: string;
}

export function buildComparison(ctx: AnalysisContext, input: BuildInput): ComparisonEntry {
  if (input.piece_ids.length < 2) {
    throw new ComparisonRefused('A comparison needs at least two pieces.');
  }
  if (input.planned && !input.hypothesis?.trim()) {
    throw new ComparisonRefused(
      'A planned comparison needs a hypothesis before the pieces post. That is the only thing that ever made an experiment worth the name.',
    );
  }

  const sides = input.piece_ids
    .map(id => ctx.joined.find(j => j.piece.id === id))
    .filter((j): j is JoinedPiece => !!j);

  const costumes = sides.map(s => (s.piece.birth?.costume ?? {}) as Partial<ResolvedCostume>);
  const { held, changed } = dimensionSpread(costumes);
  const window = input.window ?? widestMaterialized(ctx, sides);
  const rows = sides.flatMap(s => ctx.snapshot.observations.filter(
    o => o.platform_post_id === s.platform_post_id && o.window === window));

  const confounders = confoundersFor(ctx, sides, window, input.metric_id);
  // §9.2: two or more differing dimensions → the comparison is created but
  // marked confounded, and its verdict words say which dimensions moved together.
  const confounded = changed.length > 1;
  if (confounded) {
    confounders.push(`two things changed at once: ${changed.join(' and ')}`);
  }

  return {
    id: input.id,
    hypothesis: input.hypothesis?.trim() ?? '',
    piece_ids: sides.map(s => s.piece.id),
    held_variables: held,
    changed_variable: changed.length === 1 ? changed[0] : 'unknown',
    posting_windows: sides.map(s => ({ piece_id: s.piece.id, posted_at: s.published_at })),
    account_baseline: baselineMap(ctx, input.metric_id, window),
    confounders,
    window,
    state: 'open',
    planned: input.planned,
    declared_changed_variable: input.declared_changed_variable,
    metric_id: input.metric_id,
    ages: rows.map(r => ({ piece_id: r.piece_id ?? '', age_hours: r.age_hours })),
    confounded,
  };
}

/** The default window: the widest one MATERIALIZED for every side (§9.2). */
export function widestMaterialized(ctx: AnalysisContext, sides: JoinedPiece[]): ObservationWindow {
  for (const w of ['30d', '7d', 'first-24h'] as ObservationWindow[]) {
    const everySide = sides.every(s => ctx.snapshot.observations.some(
      o => o.platform_post_id === s.platform_post_id && o.window === w
        && (o.window_state ?? 'materialized') === 'materialized'));
    if (everySide) return w;
  }
  return 'lifetime';
}

function baselineMap(
  ctx: AnalysisContext, metricId: string, window: ObservationWindow,
): Record<string, number> {
  const values = ctx.snapshot.observations
    .filter(o => o.window === window && typeof o.metrics[metricId] === 'number')
    .map(o => o.metrics[metricId] as number)
    .sort((a, b) => a - b);
  if (!values.length) return {};
  const mid = Math.floor(values.length / 2);
  const median = values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
  return { [metricId]: median };
}

/** §9.2's confounders list, every entry computed and none of them guessed. */
function confoundersFor(
  ctx: AnalysisContext, sides: JoinedPiece[], window: ObservationWindow, metricId: string,
): string[] {
  const out: string[] = [];
  for (const s of sides) {
    const overlapping = ctx.gaps.filter(g => g.from <= s.published_day && s.published_day <= g.to);
    for (const g of overlapping) {
      out.push(`a coverage gap covers ${s.piece.title || s.piece.id}: ${g.from} to ${g.to} (${g.reason})`);
    }
    if (s.deleted_on_platform) out.push(`${s.piece.title || s.piece.id} was deleted on the platform`);
  }
  const versions = [...new Set(
    sides.flatMap(s => ctx.snapshot.observations
      .filter(o => o.platform_post_id === s.platform_post_id && o.window === window
        && typeof o.metrics[metricId] === 'number')
      .map(o => o.metric_definition_version)),
  )];
  if (versions.length > 1) {
    // Refusal 3: the platform redefined the metric inside the span, so a figure
    // spanning the boundary would be a fiction.
    out.push(`"${metricId}" was measured under definition versions ${versions.join(' and ')} inside this span`);
  }
  const days = sides.map(s => s.published_day).sort();
  if (days.length > 1 && daysBetween(days[0], days[days.length - 1]) > 30) {
    out.push('these posted more than 30 days apart');
  }
  return out;
}

// ── §9.3 The verdict ─────────────────────────────────────────────────────────

export interface ResolvedComparison {
  entry: ComparisonEntry;
  /** The two honest lines the screen adds (§9.3). */
  age_line: string;
  confounder_line: string;
  /** Present when a planned comparison changed something it did not plan to. */
  plan_mismatch?: string;
  /** What is still missing, when the state is not-enough-comparable-data. */
  missing?: string;
}

export function resolve(
  ctx: AnalysisContext, entry: ComparisonEntry, metricId = entry.metric_id ?? 'views',
): ResolvedComparison {
  const observations = ctx.snapshot.observations.map(o => ({
    ...o,
    piece_id: o.piece_id ?? pieceIdFor(ctx, o.platform_post_id),
  }));

  // Called AS IT STANDS. Nothing here pre-filters the sufficiency question, and
  // nothing re-phrases the answer: below the thresholds the answer is
  // "not enough comparable data", never a ranking (refusal 1).
  const resolved = resolveComparison(entry, observations, metricId, ctx.thresholds);

  const ages = entry.piece_ids.map(id => {
    const row = observations.find(o => o.piece_id === id && o.window === entry.window);
    return { piece_id: id, age_hours: row?.age_hours ?? 0 };
  });

  return {
    entry: {
      ...entry, ...resolved,
      ages,
      resolved_at: ctx.now,
      metric_id: metricId,
    },
    age_line: ageLine(ages, entry.window),
    confounder_line: confounderLine(entry),
    plan_mismatch: planMismatch(entry),
    missing: resolved.state === 'not-enough-comparable-data'
      ? missingWords(ctx, entry, metricId)
      : undefined,
  };
}

function pieceIdFor(ctx: AnalysisContext, platformPostId: string): string | null {
  return ctx.joined.find(j => j.platform_post_id === platformPostId)?.piece.id ?? null;
}

/** Refusal 2 made visible: a 19h reading and a 31h reading are both "first-24h",
 *  and the screen says so. */
function ageLine(ages: { piece_id: string; age_hours: number }[], window: ObservationWindow): string {
  if (!ages.length) return 'No readings on either side yet.';
  const nominal = window === 'lifetime' ? null : WINDOW_AGE_HOURS[window];
  const list = ages.map(a => `${a.piece_id} at ${a.age_hours}h`).join(', ');
  return nominal
    ? `Read at ${list}. Both count as ${window} (nominal ${nominal}h).`
    : `Read at ${list}.`;
}

function confounderLine(entry: ComparisonEntry): string {
  if (!entry.confounders.length) return 'Nothing else moved that we can see.';
  return `Watch out: ${entry.confounders.join('; ')}.`;
}

/** §9.4: no silent rescue. A planned comparison whose declared changed variable
 *  is not the one the machinery computes is flagged. */
function planMismatch(entry: ComparisonEntry): string | undefined {
  if (!entry.planned || !entry.declared_changed_variable) return undefined;
  if (entry.changed_variable === entry.declared_changed_variable) return undefined;
  return entry.changed_variable === 'unknown'
    ? `You planned to change the ${entry.declared_changed_variable}, but more than one thing changed.`
    : `You planned to change the ${entry.declared_changed_variable}, but the ${entry.changed_variable} changed instead.`;
}

function missingWords(ctx: AnalysisContext, entry: ComparisonEntry, metricId: string): string {
  const bits: string[] = [];
  for (const id of entry.piece_ids) {
    const j = ctx.joined.find(x => x.piece.id === id);
    const row = j && ctx.snapshot.observations.find(
      o => o.platform_post_id === j.platform_post_id && o.window === entry.window);
    if (!row) { bits.push(`${id} has no reading at ${entry.window} yet`); continue; }
    const exposure = row.metrics[ctx.thresholds.exposureMetric] ?? 0;
    if (exposure < ctx.thresholds.minExposure) {
      bits.push(`${id} is at ${exposure} ${ctx.thresholds.exposureMetric}, under the ${ctx.thresholds.minExposure} needed`);
    }
    if (typeof row.metrics[metricId] !== 'number') {
      bits.push(`${id} carries no ${metricId} reading`);
    }
  }
  return bits.length ? bits.join('; ') : 'not enough comparable data yet';
}

// ── §9.4 Planned comparisons ─────────────────────────────────────────────────

export interface PlannedStatus {
  state: 'open' | 'ready';
  /** What is still owed before the window decides it. */
  owed: string;
  /** Days until the window materializes on the last side. */
  days_left: number;
}

/**
 * A planned comparison sits `open` and shows a live countdown to the window that
 * will decide it. Nothing about "planned" makes a verdict stronger — it makes
 * the hypothesis older than the result.
 */
export function plannedStatus(
  ctx: AnalysisContext, entry: ComparisonEntry,
): PlannedStatus {
  const nominal = entry.window === 'lifetime' ? 0 : WINDOW_AGE_HOURS[entry.window];
  let worstHoursLeft = 0;
  const waiting: string[] = [];
  for (const id of entry.piece_ids) {
    const j = ctx.joined.find(x => x.piece.id === id);
    if (!j) { waiting.push(`${id} has not posted yet`); worstHoursLeft = Math.max(worstHoursLeft, nominal); continue; }
    const age = (new Date(ctx.now).getTime() - new Date(j.published_at).getTime()) / 3600000;
    const left = Math.max(0, nominal - age);
    if (left > 0) waiting.push(`${id} is ${Math.round(age)}h old and needs ${Math.round(left)}h more`);
    worstHoursLeft = Math.max(worstHoursLeft, left);
  }
  return {
    state: waiting.length ? 'open' : 'ready',
    owed: waiting.length ? waiting.join('; ') : 'both sides have materialised the window',
    days_left: Math.ceil(worstHoursLeft / 24),
  };
}

// ── §9.5 Storage ─────────────────────────────────────────────────────────────

export function readComparisons(body: ProfileBody): ComparisonEntry[] {
  let entries: BodyEntry[];
  try {
    entries = readPath(body, COMPARISON_PATH);
  } catch {
    return [];
  }
  return entries.map(e => ({ ...(e.data as unknown as ComparisonEntry), id: e.id }));
}

export function writeComparison(
  body: ProfileBody, entry: ComparisonEntry, now: string, writer: 'owner' | 'engine:analysis' = 'owner',
): ProfileBody {
  return putEntry(body, COMPARISON_PATH, {
    id: entry.id, type: 'matched_comparison',
    data: entry as unknown as Record<string, unknown>,
  }, { writer, now });
}

/**
 * §9.5: resolving a comparison APPENDS; it never overwrites an earlier
 * resolution, so a comparison resolved at 7d and again at 30d keeps both. The
 * resolution is its own entry naming what it resolves — the path is append-only
 * for real, and this is what honouring that looks like.
 */
export function appendResolution(
  body: ProfileBody, resolved: ComparisonEntry, now: string,
): ProfileBody {
  const id = `${resolved.resolves ?? resolved.id}@${resolved.window}:${now.slice(0, 10)}`;
  return putEntry(body, COMPARISON_PATH, {
    id, type: 'matched_comparison',
    data: { ...resolved, id, resolves: resolved.resolves ?? resolved.id, resolved_at: now } as unknown as Record<string, unknown>,
  }, { writer: 'owner', now });
}

/** Every resolution of one comparison, oldest first. Both survive, always. */
export function resolutionsOf(body: ProfileBody, comparisonId: string): ComparisonEntry[] {
  return readComparisons(body)
    .filter(c => c.resolves === comparisonId)
    .sort((a, b) => ((a.resolved_at ?? '') < (b.resolved_at ?? '') ? -1 : 1));
}

/**
 * §9.1: which pieces she can pick from. The cascade reaches the SELECTOR, not
 * only the pickers: a piece born on a platform she has since switched off is not
 * selectable, and its past numbers stay readable everywhere else (S9, test 6).
 */
export function selectablePieces(ctx: AnalysisContext): JoinedPiece[] {
  const live = new Set(ctx.facts.platforms);
  return ctx.joined.filter(j => {
    const platform = j.piece.birth?.costume?.platform;
    return !platform || live.has(platform);
  });
}

/** The piece ids sitting in a planned comparison — what the scorecard's
 *  show-my-working line names (§7.4). */
export function plannedPieceIds(body: ProfileBody): string[] {
  return [...new Set(readComparisons(body).filter(c => c.planned).flatMap(c => c.piece_ids))];
}

export { WINDOWS };
