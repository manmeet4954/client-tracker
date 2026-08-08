// The desk's answers — the restructure handoff, "Level 1 — The desk".
//
// The desk is a CHAT. Every answer is a headline plus a list of rows she can
// walk into. This module composes those answers and nothing else; the screen
// that renders them is `components/shell/Shelf.tsx`.
//
// TWO RULES GOVERN EVERYTHING HERE.
//
// 1. Every number stated in copy is counted from the array it describes, at
//    render time. A headline never states a count that is not `rows.length` or
//    a filter over the very rows drawn beneath it. This was a recurring bug in
//    the prototype and the handoff asks for it to be treated as a rule.
//
// 2. Nothing is counted twice. The counters already exist in `shelf.ts`
//    (`composeShelf`, `composeCard`, `composeTodayStrip`, `composeWeeklyPulse`,
//    `stageCounts`) and this module only ever reads them. There is no second
//    counter anywhere in the desk.
//
// The desk is also STATUS ONLY. It is the one screen that knows about more than
// one profile, so it may never carry content across the boundary: no piece
// title, no caption, no seed. The two exceptions are granted by name in the
// plan and composed in `shelf.ts` — the today strip (her one cross-profile
// window) and the weekly pulse (her private weekly read).

import type { AppState } from '@/types';
import { PULSE_EMPTY_LINE, composeShelf, composeTodayStrip, composeWeeklyPulse, stageCounts } from './shelf.ts';
import type { ShelfCard } from './shelf.ts';
import { hueFor } from './profile.ts';

// ── Words ────────────────────────────────────────────────────────────────────

const WORDS = [
  'Nothing', 'One', 'Two', 'Three', 'Four', 'Five', 'Six',
  'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
];

/** A small number reads better as a word. Above twelve it is a figure again. */
function w(n: number): string {
  return WORDS[n] ?? String(n);
}

function lower(n: number): string {
  return w(n).toLowerCase();
}

function many(n: number, one: string, more: string): string {
  return n === 1 ? one : more;
}

/** "12 July". Empty when the date is missing, because missing is not a zero. */
export function dayWords(iso: string | undefined | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }).format(d);
}

// ── The shapes the screen draws ──────────────────────────────────────────────

/** One row of an answer. Tapping it lands inside that profile. */
export interface DeskRow {
  key: string;
  profile_id: string;
  /** What the row is. Never a piece's own words unless the plan grants it. */
  title: string;
  profile_name: string;
  /** The trailing label: a date, a state, a wait. */
  when: string;
  /** Draws the when-label in the overdue colour. */
  late: boolean;
  /** Identity only: the dot beside the row. */
  hue: string;
  href: string;
}

export interface DeskAnswer {
  text: string;
  rows: DeskRow[];
  note: string;
  /**
   * What a flagged row IS, for the phone's summary control: "7 items, 4
   * slipped". A slipped date is not the same thing as an unlocked strategy, and
   * the count is meaningless if the word beside it is wrong.
   */
  flag: string;
}

/** One profile, as the desk's sidebar draws it. */
export interface DeskProfile {
  id: string;
  name: string;
  initial: string;
  /** Identity only: the avatar square. Chrome is ink everywhere. */
  hue: string;
  href: string;
  /** Composed in `shelf.ts`. Empty when there is nothing true to say. */
  line: string;
  /** True when the line is asking for her attention. */
  alert: boolean;
}

// ── The profiles, once, for everything below ─────────────────────────────────

interface Indexed {
  card: ShelfCard;
  hue: string;
}

function indexed(state: AppState): Indexed[] {
  const byId = new Map((state.clients ?? []).map(c => [c.id, c]));
  return composeShelf(state, 'owner').map(card => ({ card, hue: hueFor(byId.get(card.id)) }));
}

/** composeCard's own rule for when counts mean anything, reused rather than restated. */
function counts(state: AppState, card: ShelfCard): Record<string, number> {
  if (card.lifecycle === 'setup' || card.lifecycle === 'archived') return {};
  return stageCounts(state.clientData?.[card.id], card.frozen_at);
}

function total(c: Record<string, number>): number {
  return Object.values(c).reduce((sum, n) => sum + n, 0);
}

/**
 * The sidebar list. The line is the profile's ALREADY COMPOSED attention line,
 * or the number of its rows that have slipped, or its already composed counts,
 * or its lifecycle chip — in that order. When none of those is true, there is
 * no line at all: a profile with nothing known shows nothing, never a zero.
 */
export function composeDeskProfiles(state: AppState, today: string): DeskProfile[] {
  const strip = composeTodayStrip(state, today);
  return indexed(state).map(({ card, hue }) => {
    const slipped = strip.filter(r => r.profile_id === card.id && r.overdue).length;
    const line = card.attention
      ?? (slipped > 0 ? `${slipped} slipped` : (card.status || card.chip || ''));
    return {
      id: card.id,
      name: card.name,
      initial: card.name.slice(0, 1).toUpperCase(),
      hue,
      href: card.href,
      line,
      alert: !!card.attention || slipped > 0,
    };
  });
}

// ── The answers ──────────────────────────────────────────────────────────────

/**
 * Default, and "what needs me today". Everything due today across every
 * profile, overdue first — `composeTodayStrip`, unchanged and uncounted twice.
 */
export function answerToday(state: AppState, today: string): DeskAnswer {
  const hues = new Map(indexed(state).map(i => [i.card.id, i]));
  const rows: DeskRow[] = composeTodayStrip(state, today).map(r => ({
    key: `${r.profile_id}-${r.task_id}`,
    profile_id: r.profile_id,
    title: r.text,
    profile_name: r.profile_name,
    when: r.overdue ? `due ${dayWords(r.due_date)}` : 'today',
    late: r.overdue,
    hue: hues.get(r.profile_id)?.hue ?? r.color,
    href: hues.get(r.profile_id)?.card.href ?? '/shelf',
  }));

  if (rows.length === 0) {
    return { text: 'Nothing needs you today. That is allowed.', rows, note: '', flag: 'slipped' };
  }

  const late = rows.filter(r => r.late).length;
  const across = new Set(rows.map(r => r.profile_id)).size;
  const head =
    `${w(rows.length)} ${many(rows.length, 'thing needs', 'things need')} you today, ` +
    `across ${lower(across)} ${many(across, 'profile', 'profiles')}.`;
  const slipped = late === 0
    ? ''
    : late === rows.length
      ? ` ${many(rows.length, 'It has', 'All of them have')} already slipped ${many(rows.length, 'its', 'their')} date.`
      : ` ${w(late)} of them ${many(late, 'has', 'have')} already slipped ${many(late, 'its', 'their')} date.`;

  return {
    text: head + slipped, rows, flag: 'slipped',
    note: 'Tap any row to land inside that profile, at that thing.',
  };
}

/**
 * "What is stuck waiting on a yes?" — every profile with something in review.
 *
 * The row is the PROFILE and its count, not the piece. A piece's title is
 * content, and content does not cross the profile boundary onto the desk.
 */
export function answerReview(state: AppState): DeskAnswer {
  const rows: DeskRow[] = [];
  for (const { card, hue } of indexed(state)) {
    const n = counts(state, card).review ?? 0;
    if (n === 0) continue;
    rows.push({
      key: `review-${card.id}`,
      profile_id: card.id,
      title: `${n} ${many(n, 'piece', 'pieces')} in review`,
      profile_name: card.name,
      when: 'waiting on a yes',
      late: false,
      hue,
      href: card.href,
    });
  }

  if (rows.length === 0) {
    return { text: 'Nothing is waiting on anyone else right now.', rows, note: '', flag: 'waiting' };
  }
  return {
    text: `${w(rows.length)} ${many(rows.length, 'profile has', 'profiles have')} something sitting in review.`,
    rows,
    flag: 'waiting',
    note: 'Open one and the piece, its preview and the link you sent are all in the same place.',
  };
}

/** "Anything not locked?" — the profiles whose Strategy has not locked yet. */
export function answerLocks(state: AppState): DeskAnswer {
  const rows: DeskRow[] = indexed(state)
    .filter(i => i.card.attention === 'Strategy not locked')
    .map(({ card, hue }) => ({
      key: `lock-${card.id}`,
      profile_id: card.id,
      title: 'Strategy is not locked',
      profile_name: card.name,
      when: 'blocks Creation',
      late: true,
      hue,
      href: card.href,
    }));

  if (rows.length === 0) {
    return { text: 'Every profile is locked. Creation is open everywhere.', rows, note: '', flag: 'not locked' };
  }
  return {
    text: `${w(rows.length)} ${many(rows.length, 'profile is', 'profiles are')} still unlocked, ` +
      `so nothing can be made for ${many(rows.length, 'it', 'them')} yet.`,
    rows,
    flag: 'not locked',
    note: 'Lock it from the Strategy corner inside that profile.',
  };
}

/** "Which profiles have gone quiet?" — nothing on the board at all. */
export function answerQuiet(state: AppState): DeskAnswer {
  const rows: DeskRow[] = indexed(state)
    .filter(i => i.card.lifecycle !== 'setup' && i.card.lifecycle !== 'archived')
    .filter(i => total(counts(state, i.card)) === 0)
    .map(({ card, hue }) => ({
      key: `quiet-${card.id}`,
      profile_id: card.id,
      title: 'Nothing on the board',
      profile_name: card.name,
      when: 'no pieces',
      late: true,
      hue,
      href: card.href,
    }));

  if (rows.length === 0) {
    return { text: 'Every profile has something on its board.', rows, note: '', flag: 'with no pieces' };
  }
  return {
    text: `${w(rows.length)} ${many(rows.length, 'profile has', 'profiles have')} nothing on ` +
      `${many(rows.length, 'its', 'their')} board at all.`,
    rows,
    flag: 'with no pieces',
    note: 'Usually a seed problem, not a making problem.',
  };
}

/** "How did last month go?" — her weekly read, one row per line it carries. */
export function answerWeek(state: AppState): DeskAnswer {
  const hues = new Map(indexed(state).map(i => [i.card.id, i]));
  const groups = composeWeeklyPulse(state);
  const rows: DeskRow[] = groups.flatMap(g => g.lines.map((line, i) => ({
    key: `pulse-${g.profile_id}-${i}`,
    profile_id: g.profile_id,
    title: line,
    profile_name: g.profile_name,
    when: g.broken ? 'not collecting' : dayWords(g.period_end),
    late: g.broken,
    hue: hues.get(g.profile_id)?.hue ?? g.color,
    href: hues.get(g.profile_id)?.card.href ?? '/shelf',
  })));

  if (rows.length === 0) return { text: PULSE_EMPTY_LINE, rows, note: '', flag: 'not collecting' };
  return {
    text: `${w(rows.length)} ${many(rows.length, 'line', 'lines')} back, from ` +
      `${lower(groups.length)} ${many(groups.length, 'profile', 'profiles')}.`,
    rows,
    flag: 'not collecting',
    note: 'Tap a row to open that profile and read the rest.',
  };
}

// Which of the five a question asks for lives in `deskAnswers.ts`, together with
// the thread and the phone fold. This file is the queries and nothing else, so
// that a query can be read and tested without the routing around it.

/**
 * The chips under the thread. Every one of them lands on a real query above.
 *
 * There is no separate weekly-read block on the desk any more: the weekly read
 * IS a chip. `needs` names the switch that has to be rendering somewhere for the
 * chip to exist at all — off means absent, chips included.
 */
export interface DeskPrompt {
  text: string;
  needs?: 'shelf.weekly_pulse';
}

export const DESK_PROMPTS: DeskPrompt[] = [
  { text: 'What needs me today?' },
  { text: 'What is stuck waiting on a yes?' },
  { text: 'Which profiles have gone quiet?' },
  { text: 'How did last month go?', needs: 'shelf.weekly_pulse' },
  { text: 'Anything not locked?' },
];

// ── Anything else: the brain the app already has ─────────────────────────────

export const DESK_UNREACHABLE =
  'I could not reach the brain just now, so I have no answer for that one. Try again in a moment.';

export const DESK_ONLY_FINDS =
  'I can only find things from here. Ask what needs you today, what is stuck, or what is not locked.';

/**
 * The same endpoint and the same request shape the floating chat uses, so there
 * is one brain and not two. The desk reads only the REPLY: the desk finds, it
 * does not act, and an action belongs inside a profile.
 *
 * Returns null when the endpoint is unavailable or answers with nothing usable,
 * so the thread can say so in one plain line rather than draw an empty bubble.
 */
export async function askDesk(
  question: string,
  state: AppState,
  recent: { who: string; text: string }[],
): Promise<string | null> {
  const topics: string[] = [];
  const seen = new Set<string>();
  for (const o of state.observations ?? []) {
    if (!seen.has(o.topic)) { seen.add(o.topic); topics.push(o.topic); }
  }

  const cards: { clientId: string; cardId: string; title: string; stage: string }[] = [];
  for (const c of state.clients ?? []) {
    for (const card of state.clientData?.[c.id]?.contentCards ?? []) {
      if (card.stage === 'posted') continue;
      cards.push({
        clientId: c.id,
        cardId: card.id,
        title: (card.title || card.hook || '').slice(0, 60),
        stage: card.stage,
      });
      if (cards.length >= 80) break;
    }
    if (cards.length >= 80) break;
  }

  const answer = await fetch('/api/chat-brain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: question,
      hasPhoto: false,
      clients: (state.clients ?? []).map(c => ({ id: c.id, name: c.name })),
      topics,
      cards,
      recent,
    }),
  })
    .then(r => (r.ok ? r.json() : null))
    .catch(() => null) as { fallback?: boolean; reply?: string } | null;

  if (!answer || answer.fallback) return null;
  const reply = (answer.reply ?? '').trim();
  return reply || DESK_ONLY_FINDS;
}
