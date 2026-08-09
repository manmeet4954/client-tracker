// The desk's routing and its view model — the restructure handoff, phase 6.
//
// `desk.ts` holds the QUERIES: five functions that read her state and return an
// answer. This file holds everything around them that is still pure, and that
// the screen would otherwise do inline where nothing can test it:
//
//   · which question is being asked, from the handoff's own trigger table
//   · the thread, including the opening answer the desk loads already holding
//   · the phone fold — the persistent summary control and its label
//
// THE COUNT RULE. Every number that reaches copy is counted here, at compose
// time, from the very array it describes. Nothing states a count it was handed.
// The handoff calls this a recurring bug and asks for it to be treated as a
// rule, so the fold's label is built from `rows` and from nothing else.
//
// THE SEAM. Everything in this file FINDS, and it is now reached ONLY by a
// tapped chip. The desk acts as well as finds: anything she types goes to spec
// 30's tool loop through `runDesk` in `desk.ts`, the same harness the floating
// chat calls. Routing typed text through the trigger table below is what made
// the desk impossible to talk to — "I posted it today" matched `today`.
//
// Relative, extensioned imports: this module runs under plain Node in the tests,
// where the `@/` alias does not exist.

import type { AppState } from '@/types';
import type { DeskAnswer, DeskPrompt, DeskRow } from './desk.ts';
import {
  DESK_PROMPTS, answerLocks, answerQuiet, answerReview, answerToday, answerWeek,
} from './desk.ts';

// ── Which question is she asking ─────────────────────────────────────────────

export type DeskIntentId = 'review' | 'locks' | 'quiet' | 'week' | 'today';

export interface DeskIntent {
  id: DeskIntentId;
  /**
   * The handoff's answer table, written out. These are the words that pick the
   * QUERY; the query itself then reads her real state. Nothing about an answer
   * is string-matched — only which of the five is asked for.
   */
  triggers: string[];
  answer: (state: AppState, today: string) => DeskAnswer;
}

/**
 * Order is the prototype's, and it matters. "What is stuck today?" is a review
 * question, not a today question, so the narrower intents are tried first and
 * today is last — it is also the default, which is the same thing said twice.
 */
export const DESK_INTENTS: DeskIntent[] = [
  {
    id: 'review',
    triggers: ['stuck', 'waiting', 'wait', 'yes', 'review', 'in review', 'approval', 'approve'],
    answer: state => answerReview(state),
  },
  {
    id: 'locks',
    triggers: ['lock', 'locked', 'unlocked', 'locking', 'strategy'],
    answer: state => answerLocks(state),
  },
  {
    id: 'quiet',
    triggers: ['quiet', 'silent', 'not posted', 'nothing posted', 'behind', 'empty board'],
    answer: state => answerQuiet(state),
  },
  {
    id: 'week',
    triggers: ['week', 'weekly', 'month', 'monthly', 'go', 'went', 'read'],
    answer: state => answerWeek(state),
  },
  {
    id: 'today',
    triggers: ['today', 'needs me', 'need me', 'due', 'on my plate', 'my day', 'overdue', 'slipped'],
    answer: (state, today) => answerToday(state, today),
  },
];

/** Whole words only, so "gone" is not "go" and "unlocking" is not "lock". */
function mentions(text: string, trigger: string): boolean {
  const escaped = trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(text);
}

/** Which of the five standing questions this is, or null for anything else. */
export function classifyQuestion(question: string): DeskIntentId | null {
  const t = (question ?? '').toLowerCase();
  if (!t.trim()) return null;
  for (const intent of DESK_INTENTS) {
    if (intent.triggers.some(w => mentions(t, w))) return intent.id;
  }
  return null;
}

/**
 * The answer to one of the five, composed from her real state. Null for
 * anything else, which is the signal to go to the brain the app already has —
 * and that path is unchanged, because the desk finds and does not act.
 */
export function answerQuestion(question: string, state: AppState, today: string): DeskAnswer | null {
  const id = classifyQuestion(question);
  if (!id) return null;
  const intent = DESK_INTENTS.find(i => i.id === id)!;
  return intent.answer(state, today);
}

/** A bot line with nothing to walk into: a brain reply, or a failure said plainly. */
export function plainAnswer(text: string): DeskAnswer {
  return { text, rows: [], note: '', flag: '' };
}

// ── The thread ───────────────────────────────────────────────────────────────

export type DeskMessage =
  | { who: 'me'; text: string }
  | ({ who: 'bot' } & DeskAnswer);

/**
 * The desk loads ALREADY ANSWERING "what needs me today". She gets the standing
 * answer without asking, and it is a normal message that scrolls away like any
 * other — there is no separate Today block on this screen.
 *
 * It is recomposed from state rather than frozen at mount, so the desk is right
 * when the data lands, not when the component did.
 */
export function openingAnswer(state: AppState, today: string): DeskAnswer {
  return answerToday(state, today);
}

export function deskThread(state: AppState, today: string, sent: DeskMessage[]): DeskMessage[] {
  return [{ who: 'bot', ...openingAnswer(state, today) }, ...sent];
}

/** What the brain is handed as context. The last few turns, and nothing else. */
export function recentTurns(thread: DeskMessage[], howMany = 8): { who: string; text: string }[] {
  return thread.slice(-howMany).map(m => ({ who: m.who, text: m.text }));
}

// ── The phone fold ───────────────────────────────────────────────────────────

/** More than two rows folds. Two or fewer are simply drawn. */
export const FOLD_ABOVE = 2;

const SLIPPED_DOT = '#ea4711';
const CALM_DOT = '#9b95a1';

export interface DeskFold {
  /** True when the phone draws the summary control instead of the rows. */
  foldable: boolean;
  /** Counted from the rows themselves, at compose time. */
  count: number;
  /** Counted from the rows themselves, at compose time. */
  flagged: number;
  /** "7 items, 4 slipped". The words after the count come from the answer. */
  label: string;
  /** It toggles BOTH ways and never disappears. */
  action: 'Open' | 'Hide';
  /** Accent when something has slipped, faint when nothing has. */
  dot: string;
  /** True while the rows are hidden on the phone. Desktop always shows them. */
  hidesRows: boolean;
}

/**
 * The persistent summary control. It exists for the whole life of the message —
 * open or shut — because a control that vanishes once you use it cannot be used
 * to put things back.
 */
export function foldModel(rows: DeskRow[], flag: string, collapsed: boolean): DeskFold {
  const count = rows.length;
  const flagged = rows.filter(r => r.late).length;
  const foldable = count > FOLD_ABOVE;
  const noun = count === 1 ? 'item' : 'items';
  return {
    foldable,
    count,
    flagged,
    label: flagged > 0 && flag
      ? `${count} ${noun}, ${flagged} ${flag}`
      : `${count} ${noun}`,
    action: collapsed ? 'Open' : 'Hide',
    dot: flagged > 0 ? SLIPPED_DOT : CALM_DOT,
    hidesRows: foldable && collapsed,
  };
}

// ── The chips under the thread ───────────────────────────────────────────────

/**
 * The weekly read is a chip, not a block. Whether the chip exists at all is a
 * visibility question: off means absent, chips included. The caller resolves
 * the switch — this only applies the answer.
 */
export function visiblePrompts(pulseOn: boolean, prompts: DeskPrompt[] = DESK_PROMPTS): DeskPrompt[] {
  return prompts.filter(p => p.needs !== 'shelf.weekly_pulse' || pulseOn);
}
