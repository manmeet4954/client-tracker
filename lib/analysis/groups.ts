// The Analysis app's three groups — the restructure handoff, "ANALYSIS".
//
// Eight screens became three groups. Everything on this page that is a number, a
// bar width, or a sentence with a count in it is computed HERE, in plain
// TypeScript, so it can be tested without a browser. The components in
// `components/analysis/` are windows onto this file and onto `/api/analysis`;
// they do no arithmetic of their own.
//
// The honesty rules this file exists to enforce:
//
//   1. Off means absent. A screen that does not render is dropped, and a group
//      left with no screens is dropped with it — never an empty group, never a
//      greyed tab.
//   2. Missing data renders as missing. An unread metric is an em dash, never a
//      zero; an unread row draws the hatch across the whole track, never a
//      zero-length bar that reads as a slump.
//   3. Every count in copy is counted from the array it describes, at the moment
//      it is rendered. No headline states a number this file did not count.
//
// Pure: no React, no fetch, no `new Date()`.

// ── The shapes the API answers with ──────────────────────────────────────────
// Declared here rather than imported from the components, so the tests can run
// this file on plain Node. `components/analysis/Shared.tsx` re-exports them.

export type MeasuredState = 'value' | 'too-early' | 'no-coverage' | 'not-measurable';

export interface Measured {
  state: MeasuredState;
  value?: number;
  n?: number;
  owed?: string;
  because?: string;
}

export interface CoverageGap {
  from: string;
  to: string;
  reason: string;
}

export interface Coverage {
  complete: boolean;
  days_expected: number;
  days_covered: number;
  words: string;
  gaps: CoverageGap[];
}

// ── The three groups ─────────────────────────────────────────────────────────

export type GroupId = 'where' | 'what' | 'means';

export interface GroupDef {
  id: GroupId;
  label: string;
  /** The screens it holds, in the order the handoff lists them. */
  screens: string[];
}

/** The handoff's grouping, unchanged: three groups, eight screens, one order. */
export const ANALYSIS_GROUPS: GroupDef[] = [
  { id: 'where', label: 'Where we are', screens: ['now', 'goals', 'health'] },
  { id: 'what', label: 'What happened', screens: ['slices', 'scorecard', 'funnel'] },
  { id: 'means', label: 'What it means', screens: ['compare', 'verdicts'] },
];

/** Which group a screen lives in. Used to send an old tab address to its group. */
export function groupOf(screenId: string): GroupId | undefined {
  return ANALYSIS_GROUPS.find(g => g.screens.includes(screenId))?.id;
}

export interface TabNode {
  id: string;
  label: string;
  /** `active`, `history`, or `hidden`. Hidden never reaches a screen. */
  state: string;
}

export interface RenderedGroup {
  id: GroupId;
  label: string;
  screens: TabNode[];
}

/**
 * The groups that render, each carrying the screens that render inside it.
 *
 * A hidden screen is dropped. A group whose screens all dropped is dropped
 * whole — that is rule 3 of the operating guarantees, and it is why this returns
 * an array rather than a fixed three.
 */
export function groupsFor(tabs: TabNode[]): RenderedGroup[] {
  const live = new Map(tabs.filter(t => t.state !== 'hidden').map(t => [t.id, t]));
  const out: RenderedGroup[] = [];
  for (const def of ANALYSIS_GROUPS) {
    const screens = def.screens
      .map(id => live.get(id))
      .filter((t): t is TabNode => !!t);
    if (screens.length === 0) continue;
    out.push({ id: def.id, label: def.label, screens });
  }
  return out;
}

/** Where `/profile/<id>/analysis` lands: the first group that renders. */
export function defaultGroupId(tabs: TabNode[]): GroupId | undefined {
  return groupsFor(tabs)[0]?.id;
}

/** The group a route asked for, or the first one that renders instead of a 404. */
export function resolveGroup(tabs: TabNode[], asked: string): RenderedGroup | undefined {
  const groups = groupsFor(tabs);
  return groups.find(g => g.id === asked) ?? groups[0];
}

// ── Coverage, which is always the first thing on screen ──────────────────────

/** The uncollected half of every bar in this app. One value, one place. */
export const HATCH = 'repeating-linear-gradient(135deg,#e0dbd6 0 6px,#f4f1ee 6px 12px)';

/** What a metric shows when there is no reading. Never a zero. */
export const NO_READING = '—';

export interface CoverageBar {
  complete: boolean;
  /** Widths in percent, summing to 100 where any days are expected at all. */
  collectedPct: number;
  uncollectedPct: number;
  /** "23 of 31 days collected" — both numbers from the coverage itself. */
  daysLine: string;
  /** "not collecting since 12 July". Absent when collection is complete. */
  sinceLine?: string;
  /** "Everything below is read against 23 days, not 31." Absent when complete. */
  readAgainstLine?: string;
}

export function coverageBar(coverage: Coverage | undefined): CoverageBar | undefined {
  if (!coverage) return undefined;
  const expected = Math.max(0, coverage.days_expected);
  const covered = Math.min(Math.max(0, coverage.days_covered), expected);
  const collectedPct = expected > 0 ? round1((covered / expected) * 100) : 0;
  const uncollectedPct = expected > 0 ? round1(100 - collectedPct) : 100;
  const complete = coverage.complete && covered === expected;

  const bar: CoverageBar = {
    complete,
    collectedPct,
    uncollectedPct,
    daysLine: `${covered} of ${expected} ${expected === 1 ? 'day' : 'days'} collected`,
  };
  if (complete) return bar;

  const gap = openGap(coverage);
  if (gap) bar.sinceLine = sinceWords(gap);
  bar.readAgainstLine = `Everything below is read against ${covered} ${covered === 1 ? 'day' : 'days'}, not ${expected}.`;
  return bar;
}

/** The gap that is still running: the one that starts last. */
export function openGap(coverage: Coverage | undefined): CoverageGap | undefined {
  if (!coverage?.gaps?.length) return undefined;
  return [...coverage.gaps].sort((a, b) => (a.from < b.from ? 1 : a.from > b.from ? -1 : 0))[0];
}

/** Since when, and why, in her words. A stall and a decision never read alike. */
export function sinceWords(gap: CoverageGap): string {
  const day = formatDay(gap.from);
  switch (gap.reason) {
    case 'switched-off': return `switched off since ${day}`;
    case 'not-yet-tracked': return `nothing collected before ${formatDay(gap.to)}`;
    case 'platform-error': return `the platform refused us since ${day}`;
    case 'not-connected': return `not connected since ${day}`;
    default: return `not collecting since ${day}`;
  }
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** `2026-07-12` → `12 July`. Deterministic, no locale, no clock. */
export function formatDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m) return iso ?? '';
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return iso;
  return `${Number(m[3])} ${month}`;
}

/**
 * One screen inside a group reading a different stretch of days from the block
 * above it says so, rather than borrowing the headline number.
 */
export function coverageDiffersLine(
  screen: Coverage | undefined, group: Coverage | undefined,
): string | undefined {
  if (!screen || !group) return undefined;
  if (screen.days_covered === group.days_covered && screen.days_expected === group.days_expected) {
    return undefined;
  }
  return `This one reads ${screen.days_covered} of ${screen.days_expected} days, not ${group.days_covered}.`;
}

// ── Metric cards ─────────────────────────────────────────────────────────────

export type Tone = 'muted' | 'faint' | 'positive' | 'overdue';

export interface MetricCardModel {
  label: string;
  /** The figure, or an em dash. Never `0` standing in for "we were not looking". */
  value: string;
  note: string;
  tone: Tone;
}

export function metricCard(
  label: string, m: Measured | undefined, coverage?: Coverage,
): MetricCardModel {
  if (!m) {
    return { label, value: NO_READING, note: 'no reading on this profile', tone: 'faint' };
  }
  switch (m.state) {
    case 'value':
      return {
        label,
        value: formatNumber(m.value),
        note: m.n !== undefined
          ? `from ${m.n} ${m.n === 1 ? 'piece' : 'pieces'}`
          : coverage
            ? `over ${coverage.days_covered} collected ${coverage.days_covered === 1 ? 'day' : 'days'}`
            : '',
        tone: 'muted',
      };
    case 'no-coverage': {
      const gap = openGap(coverage);
      return { label, value: NO_READING, note: gap ? sinceWords(gap) : 'not collected in this period', tone: 'overdue' };
    }
    case 'not-measurable':
      return { label, value: NO_READING, note: m.because ?? 'not measured on this profile', tone: 'muted' };
    default:
      return { label, value: NO_READING, note: m.owed ? `too early. ${m.owed}` : 'too early to judge', tone: 'muted' };
  }
}

export function formatNumber(v: number | undefined): string {
  if (v === undefined || Number.isNaN(v)) return NO_READING;
  if (Math.abs(v) < 1 && v !== 0) return v.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  return v.toLocaleString('en-US');
}

export function percentWords(v: number | undefined): string {
  if (v === undefined) return 'no lift yet';
  const pct = Math.round(v * 1000) / 10;
  return `${pct > 0 ? '+' : ''}${pct}%`;
}

// ── Bars ─────────────────────────────────────────────────────────────────────

export interface BarModel {
  /** Track fill, 0 to 100. */
  pct: number;
  /** True: draw the diagonal hatch. An unread row is a gap, not a low score. */
  hatched: boolean;
}

/**
 * One row's bar against the biggest reading in the same set.
 *
 * A row with no reading fills the whole track with the hatch. It must not draw
 * a zero-length bar: a zero-length bar is the picture of a slump, and this is a
 * gap in collection.
 */
export function meterBar(m: Measured | undefined, max: number): BarModel {
  if (!m || m.state !== 'value' || m.value === undefined) return { pct: 100, hatched: true };
  if (!(max > 0)) return { pct: 0, hatched: false };
  return { pct: round1(Math.min(100, Math.max(0, (m.value / max) * 100))), hatched: false };
}

/** The biggest reading in a set, for scaling every bar in it. */
export function maxReading(rows: { value?: Measured }[]): number {
  let max = 0;
  for (const r of rows) {
    if (r.value?.state === 'value' && typeof r.value.value === 'number') {
      max = Math.max(max, r.value.value);
    }
  }
  return max;
}

export interface SliceRowModel {
  key: string;
  label: string;
  /** "6.2k" style figure, or an em dash. */
  figure: string;
  /** "12 pieces", counted from the cell's own pieces. */
  count: string;
  bar: BarModel;
  band: string;
}

export interface SliceCellLike {
  value: string;
  label?: string;
  n?: number;
  typical?: Measured;
  band?: string;
  piece_ids?: string[];
}

/** Every slice row, scaled against the best reading in the same slice. */
export function sliceRows(cells: SliceCellLike[] | undefined): SliceRowModel[] {
  const list = cells ?? [];
  const max = maxReading(list.map(c => ({ value: c.typical })));
  return list.map(c => {
    const n = c.piece_ids?.length ?? c.n ?? 0;
    return {
      key: c.value,
      label: c.label ?? c.value,
      figure: c.typical?.state === 'value' ? formatNumber(c.typical.value) : NO_READING,
      count: `${n} ${n === 1 ? 'piece' : 'pieces'}`,
      bar: meterBar(c.typical, max),
      band: c.band ?? 'too-early',
    };
  });
}

// ── Goals ────────────────────────────────────────────────────────────────────

export interface GoalLike {
  goal_id?: string;
  name?: string;
  target?: { value: number; period: string } | 'direction-only' | null;
  actual?: Measured;
}

/**
 * The 7px progress bar. Absent where there is no target to progress against —
 * a direction-only goal gets words, not a bar, because a bar with no end is a
 * decoration pretending to be a measurement.
 */
export function goalBar(goal: GoalLike | undefined): BarModel | undefined {
  const target = goal?.target;
  if (!target || target === 'direction-only') return undefined;
  if (!(target.value > 0)) return undefined;
  const actual = goal?.actual;
  if (!actual || actual.state !== 'value' || actual.value === undefined) {
    return { pct: 100, hatched: true };
  }
  return { pct: round1(Math.min(100, Math.max(0, (actual.value / target.value) * 100))), hatched: false };
}

/** "7 of 16", or the em dash. Both halves come from the goal itself. */
export function goalValue(goal: GoalLike | undefined): string {
  const actual = goal?.actual;
  const read = actual?.state === 'value' ? formatNumber(actual.value) : NO_READING;
  const target = goal?.target;
  if (target && target !== 'direction-only') return `${read} of ${formatNumber(target.value)}`;
  return read;
}

// ── The scorecard, where each pillar is judged against its own job ───────────

export type PillTone = 'positive' | 'attention' | 'neutral';

export interface ReadPill {
  words: string;
  tone: PillTone;
}

export interface PillarLike {
  state?: string;
  piece_ids?: string[];
}

/**
 * The pass / thin pill. "Thin" names how many pieces it is thin ON, counted
 * from the pillar's own pieces, because "thin" without a number is an opinion.
 */
export function pillarRead(card: PillarLike | undefined): ReadPill {
  const n = card?.piece_ids?.length ?? 0;
  switch (card?.state) {
    case 'earning': return { words: 'doing its job', tone: 'positive' };
    case 'steady': return { words: 'holding', tone: 'positive' };
    case 'dragging': return { words: 'not doing its job', tone: 'attention' };
    case 'coverage-gap': return { words: 'not collecting', tone: 'attention' };
    case 'not-measurable': return { words: 'not measurable here', tone: 'neutral' };
    case 'blocked': return { words: 'no job set', tone: 'neutral' };
    default: return { words: `thin, ${n} ${n === 1 ? 'piece' : 'pieces'}`, tone: 'attention' };
  }
}

// ── Compare ──────────────────────────────────────────────────────────────────

export interface CostumeLike {
  pillar_id?: string;
  platform?: string;
  format?: string;
  angle?: string;
  hook_type?: string;
}

/**
 * How a piece was born, above its numbers. This is the point of the engine: two
 * pieces only mean something side by side if you can see what was different.
 *
 * The seed is passed in because the read endpoint does not carry it yet (see the
 * phase note). Where it is absent the line simply starts at the angle.
 */
export function bornLine(costume: CostumeLike | undefined | null, seedTitle?: string): string {
  const parts: string[] = [];
  if (seedTitle) parts.push(`seed: ${seedTitle}`);
  if (costume?.angle) parts.push(costume.angle);
  if (costume?.hook_type && costume.hook_type !== costume.angle) parts.push(costume.hook_type);
  if (costume?.format) parts.push(costume.format);
  if (costume?.platform) parts.push(costume.platform);
  return parts.length ? parts.join(' · ') : 'how this was born was not recorded';
}

export interface ComparePreviewLike {
  entry?: { state?: string; verdict?: { words?: string } };
  missing?: string;
  age_line?: string;
  confounder_line?: string;
  plan_mismatch?: string;
}

export interface CompareVerdictModel {
  /** False below the thresholds: the answer is a refusal, never a ranking. */
  enough: boolean;
  words: string;
  detail?: string;
}

export function compareVerdict(preview: ComparePreviewLike | undefined): CompareVerdictModel | undefined {
  if (!preview) return undefined;
  const state = preview.entry?.state;
  if (state === 'not-enough-comparable-data') {
    return { enough: false, words: 'Not enough comparable data', detail: preview.missing };
  }
  const words = preview.entry?.verdict?.words;
  if (!words) return { enough: false, words: 'Nothing to say about these two yet', detail: preview.missing };
  return { enough: true, words };
}

/** Two is the floor. One piece is not a comparison. */
export function canCompare(selected: string[]): boolean {
  return selected.length >= 2;
}

/** What the picker says, counted from the selection itself. */
export function selectionLine(selected: string[]): string {
  if (selected.length === 0) return 'Pick two or more pieces to compare them.';
  if (selected.length === 1) return '1 piece picked. Pick one more.';
  return `${selected.length} pieces picked.`;
}

// ── Counting ─────────────────────────────────────────────────────────────────

/**
 * The one way this app writes a count. It takes the array, not a number, so a
 * headline cannot state a figure that was not counted from what is on screen.
 */
export function countLine(items: unknown[] | undefined, singular: string, plural: string): string {
  const n = items?.length ?? 0;
  return `${n} ${n === 1 ? singular : plural}`;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
