// Bifurcation — spec 27 §6. Slice by anything a piece was born with.
//
// PLAN §5.2 point 2: "Every parameter a piece was born with is a filter… the
// birth-links make every slice possible without anyone tagging anything."
//
// Two rules run through the whole file:
//   1. Nothing here is a new field, and NOTHING asks her to tag. Every dimension
//      reads the birth snapshot or the piece's own identity.
//   2. Dimensions are GENERATED from the profile's own declarations, so a fourth
//      pillar, a new hook type or a new platform carries the moment it exists,
//      with nothing blank (law 3, acceptance test 5).

import type { ResolvedCostume } from '../tree/objects.ts';
import {
  ANGLES, AUDIENCE_STAGES, HOOK_TYPES, OBJECTIVES, PRODUCT_INTENSITIES,
} from '../engine/costume.ts';
import type { AnalysisContext, JoinedPiece } from './read.ts';
import { piecesInPeriod, sliceRowsFor } from './read.ts';
import type { Band, Measured, MetricSpec, SliceRow, Sufficiency } from './compute.ts';
import {
  bandOf, baselineOf, coverageFor, liftOf, monthOf, sufficiencyOf, typicalOf,
} from './compute.ts';

// ── §6.1 The dimensions ──────────────────────────────────────────────────────

export type DimensionSource = 'birth' | 'piece' | 'reading';

export interface Dimension {
  id: string;
  label: string;
  source: DimensionSource;
  /** The values the picker offers, from THIS profile's declarations. */
  values: { id: string; label: string; detail?: string }[];
  /** Reading-layer dimensions are a FALLBACK and always labelled as read. */
  fallback?: boolean;
  note?: string;
}

const COSTUME_DIMENSIONS: { id: keyof ResolvedCostume; label: string }[] = [
  { id: 'hook_type', label: 'Hook type' },
  { id: 'angle', label: 'Angle' },
  { id: 'objective', label: 'Objective' },
  { id: 'audience_stage', label: 'Audience stage' },
  { id: 'cta', label: 'CTA' },
  { id: 'product_intensity', label: 'Product intensity' },
  { id: 'length', label: 'Length' },
  { id: 'voice', label: 'Voice' },
];

const UNIVERSAL: Record<string, string[]> = {
  objective: OBJECTIVES,
  audience_stage: AUDIENCE_STAGES,
  angle: ANGLES,
  hook_type: HOOK_TYPES,
  product_intensity: PRODUCT_INTENSITIES,
};

function observedValues(pieces: JoinedPiece[], read: (p: JoinedPiece) => string | undefined): string[] {
  return [...new Set(pieces.map(read).filter((v): v is string => !!v))].sort();
}

/**
 * Every dimension this profile can slice by, with its values. Nothing is
 * hard-coded per profile: pillars, platforms, formats, CTAs and voices come from
 * the profile's own folders, the costume vocabulary from the universal engine,
 * and anything she has actually used is added from the birth snapshots — a free
 * text hook type she typed once is a real slice, not a blank.
 */
export function dimensionsFor(ctx: AnalysisContext): Dimension[] {
  const pieces = ctx.joined;
  const out: Dimension[] = [];

  out.push({
    id: 'pillar', label: 'Pillar', source: 'birth',
    values: ctx.facts.pillars.map(p => ({
      id: p.id, label: p.name, detail: p.job ? `job: ${p.job}` : 'no job set',
    })),
  });
  out.push({
    id: 'pillar_job', label: 'Pillar job', source: 'birth',
    values: [...new Set(ctx.facts.pillars.map(p => p.job).filter((j): j is string => !!j))]
      .map(j => ({ id: j, label: j })),
    note: 'Lets you ask how trust is doing across pillars whose names differ.',
  });
  out.push({
    id: 'platform', label: 'Platform', source: 'birth',
    values: ctx.facts.platforms.map(p => ({ id: p, label: p })),
  });
  out.push({
    id: 'format', label: 'Format', source: 'birth',
    values: Object.entries(ctx.facts.formats).flatMap(([platform, formats]) =>
      formats.map(f => ({ id: f, label: f, detail: platform }))),
    note: 'Formats come from inside their platform, always.',
  });

  for (const d of COSTUME_DIMENSIONS) {
    const declared = d.id === 'cta' ? ctx.facts.ctas
      : d.id === 'voice' ? ctx.facts.voice
        : UNIVERSAL[d.id as string] ?? [];
    const used = observedValues(pieces, p => {
      const v = p.piece.birth?.costume?.[d.id];
      return typeof v === 'string' ? v : undefined;
    });
    const values = [...new Set([...declared, ...used])].map(v => ({ id: v, label: v }));
    out.push({ id: d.id as string, label: d.label, source: 'birth', values });
  }

  out.push({
    id: 'seed', label: 'Seed', source: 'piece',
    values: ctx.facts.seeds.map(s => ({ id: s.id, label: s.name })),
    note: 'One seed’s expressions. Also the entry point to Compare.',
  });
  out.push({
    id: 'month', label: 'Month posted', source: 'piece',
    values: observedValues(pieces, p => monthOf(p.published_day)).map(m => ({ id: m, label: m })),
    note: 'The month it POSTED is the one performance is read against.',
  });
  out.push({
    id: 'channel', label: 'Channel', source: 'piece',
    values: ctx.facts.channels.map(c => ({ id: c.id, label: c.account_handle || c.id, detail: c.platform })),
  });

  // The reading layer, last and labelled. Primary tagging is the piece's own
  // costume; this is only for what no birth snapshot carries (§6.1, §22.1).
  const readings = ctx.snapshot.readings;
  for (const [id, label, pick] of [
    ['reading_topic_type', 'Topic type (read)', (r: typeof readings[number]) => r.topic_type],
    ['reading_close_type', 'Close type (read)', (r: typeof readings[number]) => r.close_type],
    ['reading_trending_audio', 'Trending audio (read)', (r: typeof readings[number]) => boolWord(r.trending_audio)],
    ['reading_has_face', 'Face on camera (read)', (r: typeof readings[number]) => boolWord(r.has_face)],
  ] as const) {
    out.push({
      id, label, source: 'reading', fallback: true,
      values: [...new Set(readings.map(pick).filter((v): v is string => !!v))].sort()
        .map(v => ({ id: v, label: v })),
      note: 'Read by the tagging layer, not planned by you. Always shown as read.',
    });
  }

  return out;
}

function boolWord(v: boolean | null | undefined): string | undefined {
  return v === true ? 'yes' : v === false ? 'no' : undefined;
}

/** Which value of a dimension this piece carries, from its BIRTH record (§4.3). */
export function valueOf(
  ctx: AnalysisContext, dimension: string, piece: JoinedPiece,
): string | null {
  const birth = piece.piece.birth;
  switch (dimension) {
    case 'pillar': return birth?.costume?.pillar_id ?? null;
    case 'pillar_job': return birth?.pillar_job ?? null;
    case 'platform': return birth?.costume?.platform ?? null;
    case 'format': return birth?.costume?.format ?? null;
    case 'seed': return piece.piece.seed_id;
    case 'month': return monthOf(piece.published_day);
    case 'channel': return piece.channel_id ?? piece.piece.channel_id ?? null;
    default: break;
  }
  if (dimension.startsWith('reading_')) {
    const reading = ctx.snapshot.readings.find(r => r.platform_post_id === piece.platform_post_id);
    if (!reading) return null;
    const key = dimension.slice('reading_'.length);
    const raw = (reading as unknown as Record<string, unknown>)[key];
    return typeof raw === 'boolean' ? boolWord(raw) ?? null : raw == null ? null : String(raw);
  }
  const v = birth?.costume?.[dimension as keyof ResolvedCostume];
  return typeof v === 'string' ? v : null;
}

// ── §6.2 What a slice shows ──────────────────────────────────────────────────

export interface SliceCell {
  value: string;
  label: string;
  n: number;
  typical: Measured;
  baseline: Measured;
  lift: Measured;
  band: Band;
  sufficiency: Sufficiency;
  piece_ids: string[];
}

export interface SliceResult {
  dimension: string;
  crossed_with?: string;
  metric: MetricSpec;
  /** Coverage FIRST, always. Rendered before any performance number (§4.4). */
  coverage: ReturnType<typeof coverageFor>;
  cells: SliceCell[];
  /** The three buckets that keep the arithmetic honest and visible (§6.2). */
  born_before_the_engine: { count: number; piece_ids: string[]; words: string };
  unplanned: { count: number; platform_post_ids: string[]; words: string };
  not_comparable: { count: number; piece_ids: string[]; words: string };
}

export interface SliceOptions {
  dimension: string;
  metric: MetricSpec;
  /** Crossing does not change any rule: sufficiency is checked PER CELL (§6.2). */
  cross?: string;
}

export function slice(ctx: AnalysisContext, opts: SliceOptions): SliceResult {
  const inPeriod = piecesInPeriod(ctx);
  const rows = sliceRowsFor(ctx, opts.metric.window, inPeriod);
  const all = sliceRowsFor(ctx, opts.metric.window);
  const byPiece = new Map(rows.map(r => [r.piece_id, r]));

  const dimensioned = inPeriod.filter(p => p.piece.birth || isPieceDimension(opts.dimension));
  const groups = new Map<string, JoinedPiece[]>();
  for (const p of dimensioned) {
    const v = valueOf(ctx, opts.dimension, p);
    if (v === null) continue;
    const key = opts.cross ? `${v} × ${valueOf(ctx, opts.cross, p) ?? 'unset'}` : v;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }

  const labels = new Map(
    (dimensionsFor(ctx).find(d => d.id === opts.dimension)?.values ?? []).map(v => [v.id, v.label]));

  const cells: SliceCell[] = [];
  for (const [value, pieces] of groups) {
    const cellRows: SliceRow[] = pieces
      .map(p => byPiece.get(p.piece.id))
      .filter((r): r is SliceRow => !!r);
    const typical = typicalOf(cellRows, opts.metric);
    const baseline = baselineOf({ all, metric: opts.metric, asOf: ctx.period.to, gaps: ctx.gaps });
    const lift = liftOf(typical, baseline);
    const sufficiency = sufficiencyOf(cellRows, ctx.thresholds);
    cells.push({
      value,
      label: labels.get(value) ?? value,
      n: pieces.length,
      typical, baseline, lift,
      // Refusal 1: a cell below sufficiency says `too early`, never a smaller
      // number rendered confidently.
      band: bandOf(lift, sufficiency),
      sufficiency,
      piece_ids: pieces.map(p => p.piece.id),
    });
  }

  const notComparable = inPeriod.filter(p => {
    const row = ctx.snapshot.observations.find(
      o => o.platform_post_id === p.platform_post_id && o.window === opts.metric.window);
    return row?.window_state === 'unavailable';
  });

  const bornBefore = inPeriod.filter(p => !p.piece.birth);

  return {
    dimension: opts.dimension,
    crossed_with: opts.cross,
    metric: opts.metric,
    coverage: coverageFor(ctx.gaps, ctx.period.from, ctx.period.to),
    // Refuse to rank below sufficiency: the ORDER is by n, never by performance,
    // until every cell shown has earned a band.
    cells: cells.sort((a, b) => b.n - a.n),
    born_before_the_engine: {
      count: bornBefore.length,
      piece_ids: bornBefore.map(p => p.piece.id),
      words: bornBefore.length
        ? `${bornBefore.length} posted before the engine. They count in the account totals and sit out of the costume slices.`
        : '',
    },
    unplanned: {
      count: ctx.unplanned.length,
      platform_post_ids: ctx.unplanned.map(p => p.platform_post_id),
      words: ctx.unplanned.length
        ? `${ctx.unplanned.length} posts on the account with no piece here. They count in the totals and carry no pillar.`
        : '',
    },
    not_comparable: {
      count: notComparable.length,
      piece_ids: notComparable.map(p => p.piece.id),
      words: notComparable.length
        ? `${notComparable.length} have no reading in this window: ${notComparable.map(p => unavailableWhy(ctx, p, opts.metric.window)).filter(Boolean)[0] ?? 'the window never materialised'}`
        : '',
    },
  };
}

function unavailableWhy(ctx: AnalysisContext, p: JoinedPiece, window: string): string {
  const row = ctx.snapshot.observations.find(
    o => o.platform_post_id === p.platform_post_id && o.window === window);
  return row?.unavailable_reason ?? '';
}

function isPieceDimension(dimension: string): boolean {
  return ['seed', 'month', 'channel'].includes(dimension) || dimension.startsWith('reading_');
}
