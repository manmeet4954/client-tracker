// The board's arithmetic — the restructure handoff, "CREATION → Board".
//
// Everything countable the board says out loud is computed HERE, from the array
// it describes, and the screen only draws it. That is the handoff's standing
// rule: "Every count shown in copy is derived from the array it describes. No
// headline states a number that is not counted from the same data at render
// time — this was a recurring bug and should be treated as a rule."
//
// Pure, no React, no `@/` runtime imports: it also runs under plain Node in the
// acceptance tests, where only type imports are erased.

import type {
  AgendaItem, ContentCard, ContentPillar, ContentStage, PreviewPost,
} from '@/types';

/** One line in the "Needs you today" strip. */
export interface NeedRow {
  id: string;
  title: string;
  /** The words on the right, already written. */
  when: string;
  overdue: boolean;
  kind: 'piece' | 'task';
  /** The day it is against, yyyy-mm-dd. What the strip is ordered by. */
  day: string;
  /** Set for a piece, so the row can open the piece panel. */
  cardId?: string;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** "today" is a plain yyyy-mm-dd, so the caller decides what today means. */
export function needsToday(input: {
  cards: ContentCard[];
  agenda: AgendaItem[];
  today: string;
}): NeedRow[] {
  const { cards, agenda, today } = input;
  const rows: NeedRow[] = [];

  for (const c of cards) {
    const day = (c.scheduledDate ?? '').slice(0, 10);
    if (!DAY.test(day) || day > today) continue;
    if (c.stage === 'posted') continue;      // it is out; it needs nobody
    rows.push({
      id: `piece:${c.id}`,
      cardId: c.id,
      title: c.title || 'Untitled post',
      when: day === today ? 'goes live today' : `was due ${day}`,
      overdue: day < today,
      kind: 'piece',
      day,
    });
  }

  for (const a of agenda) {
    const day = (a.dueDate ?? '').slice(0, 10);
    if (a.done || !DAY.test(day) || day > today) continue;
    rows.push({
      id: `task:${a.id}`,
      title: a.text || 'Untitled task',
      when: day === today ? 'due today' : `was due ${day}`,
      overdue: day < today,
      kind: 'task',
      day,
    });
  }

  // Overdue first, then today, oldest first inside each group. Ordered by the
  // DAY, never by the words: "due today" and "goes live today" are the same day
  // and must not be sorted apart by their first letter.
  return rows.sort((x, y) =>
    Number(y.overdue) - Number(x.overdue) || x.day.localeCompare(y.day));
}

/** The agenda item behind a task row, so the strip can tick it off. */
export function agendaIdOf(row: NeedRow): string | null {
  return row.kind === 'task' ? row.id.slice('task:'.length) : null;
}

// ── Remembering whether the strip is open ────────────────────────────────────
// Per profile, because "needs you today" is per profile. Kept as words rather
// than a boolean so a half-written value reads as the default (open) instead of
// silently hiding her work.

export function needsOpenKey(profileId: string): string {
  return `needs_open_${profileId}`;
}

/** Anything that is not the literal word "closed" means open. */
export function readNeedsOpen(stored: string | null | undefined): boolean {
  return stored !== 'closed';
}

export function writeNeedsOpen(open: boolean): string {
  return open ? 'open' : 'closed';
}

// ── What the board is looking at ─────────────────────────────────────────────

/**
 * The pieces this month's board draws.
 *
 * A dated piece belongs to the month of its date. A piece with no date yet
 * belongs to EVERY month until it gets one, which is the rule the board has
 * always used: an idea does not disappear because the month turned over.
 */
export function boardCards(cards: ContentCard[], month: string): ContentCard[] {
  return cards.filter(c => {
    const own = c.scheduledDate?.trim() ? c.scheduledDate.slice(0, 7) : (c.createdMonth ?? '');
    return !own || own === month;
  });
}

export interface StageBucket<S extends { id: ContentStage; label: string }> {
  stage: S;
  cards: ContentCard[];
}

/** Every stage, with the pieces standing in it. Counts come from `.cards`. */
export function stageBuckets<S extends { id: ContentStage; label: string }>(
  stages: readonly S[],
  cards: ContentCard[],
): StageBucket<S>[] {
  return stages.map(stage => ({ stage, cards: cards.filter(c => c.stage === stage.id) }));
}

// ── Drag ids ─────────────────────────────────────────────────────────────────
// The board draws its six stages twice at once: as columns from md up, as
// stacked sections below it. Both are in the DOM, only one is visible, and a
// drag library keyed by id cannot have the same id registered twice. So each
// surface namespaces its ids and the drop handler strips the namespace off.

export type BoardSurface = 'col' | 'row';

export function dndId(surface: BoardSurface, id: string): string {
  return `${surface}:${id}`;
}

/** The id underneath, whether or not it carries a surface. */
export function bareId(value: string): string {
  const cut = value.indexOf(':');
  return cut === -1 ? value : value.slice(cut + 1);
}

/** The line under the four views. It is the only place the read-only state speaks twice. */
export function boardNote(readOnly: boolean): string {
  return readOnly
    ? 'Read only until Strategy is locked.'
    : 'Drag a piece to move it. Review and scheduling are states, not screens.';
}

// ── Pillars ──────────────────────────────────────────────────────────────────

export interface PillarColumn {
  /** '' is the unsorted column, which only exists when something is in it. */
  id: string;
  label: string;
  /** The mix target from Strategy, or null when this pillar has none. */
  targetPct: number | null;
  cards: ContentCard[];
  /** Counted here, at render time, from `cards` against the whole board. */
  sharePct: number;
}

export function pillarColumns(cards: ContentCard[], pillars: ContentPillar[]): PillarColumn[] {
  const known = new Set(pillars.map(p => p.id));
  const share = (n: number) => (cards.length === 0 ? 0 : Math.round((n / cards.length) * 100));

  const columns: PillarColumn[] = pillars.map(p => {
    const mine = cards.filter(c => c.pillarId === p.id);
    return {
      id: p.id,
      label: p.name,
      targetPct: typeof p.targetPct === 'number' ? p.targetPct : null,
      cards: mine,
      sharePct: share(mine.length),
    };
  });

  // Off means absent: no "unsorted" column unless something is actually in it.
  const loose = cards.filter(c => !c.pillarId || !known.has(c.pillarId));
  if (loose.length > 0) {
    columns.push({
      id: '', label: 'No pillar yet', targetPct: null, cards: loose, sharePct: share(loose.length),
    });
  }
  return columns;
}

/** The counted line under a pillar's name. Never a stated number. */
export function pillarMixLine(col: PillarColumn): string {
  if (col.cards.length === 0) return 'Nothing here this month.';
  return `${plural(col.cards.length, 'piece')}, ${col.sharePct}% of the board`;
}

/**
 * The previews nothing points at.
 *
 * A preview is the review state of a piece, and the link is `cardId`. Every
 * preview made before that field existed has none, and a preview whose card was
 * deleted has one that resolves to nothing. Neither is ever thrown away (S9):
 * they are listed on the board, with one line saying what they are, and the
 * piece panel is where one gets attached.
 */
export function unattachedPreviews(previews: PreviewPost[], cards: ContentCard[]): PreviewPost[] {
  const live = new Set(cards.map(c => c.id));
  return previews.filter(p => !p.cardId || !live.has(p.cardId));
}

/** The preview that belongs to one piece, if a preview has claimed it. */
export function previewFor(previews: PreviewPost[], cardId: string): PreviewPost | undefined {
  return previews.find(p => p.cardId === cardId);
}

/**
 * The chips on a card: pillar, format, platform, in that order.
 *
 * Only what the piece actually has. A card with none draws no chip strip at
 * all rather than an empty row of placeholders.
 */
export function cardChips(card: ContentCard, pillars: ContentPillar[]): string[] {
  return [
    pillars.find(p => p.id === card.pillarId)?.name,
    card.contentType,
    card.platform,
  ]
    .map(x => (typeof x === 'string' ? x.trim() : ''))
    .filter(x => x.length > 0);
}

/** English, counted. `plural(1, 'piece')` → "1 piece". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export interface MonthCell {
  /** The day number, or null for a padding cell outside the month. */
  day: number | null;
  /** yyyy-mm-dd, or '' for a padding cell. */
  date: string;
  cards: ContentCard[];
}

/**
 * A 7-column, 35-cell month grid for `month` (yyyy-MM), Monday first.
 *
 * 35 cells is the design's grid. A month that genuinely needs a sixth week
 * (31 days starting on a Sunday) gets 42, because dropping five real days off
 * the end to keep a number round would be lying about the month.
 */
export function monthCells(month: string, cards: ContentCard[]): MonthCell[] {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return [];
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;                 // Monday = 0
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = Math.max(35, Math.ceil((lead + days) / 7) * 7);

  const byDay = new Map<string, ContentCard[]>();
  for (const c of cards) {
    const day = (c.scheduledDate ?? '').slice(0, 10);
    if (!DAY.test(day)) continue;
    const list = byDay.get(day);
    if (list) list.push(c); else byDay.set(day, [c]);
  }

  const out: MonthCell[] = [];
  for (let i = 0; i < cells; i++) {
    const n = i - lead + 1;
    if (n < 1 || n > days) { out.push({ day: null, date: '', cards: [] }); continue; }
    const date = `${month}-${String(n).padStart(2, '0')}`;
    out.push({ day: n, date, cards: byDay.get(date) ?? [] });
  }
  return out;
}

/** Every dated piece, in date order. The month grid's phone form. */
export function agendaOf(cards: ContentCard[]): ContentCard[] {
  return cards
    .filter(c => DAY.test((c.scheduledDate ?? '').slice(0, 10)))
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
}
