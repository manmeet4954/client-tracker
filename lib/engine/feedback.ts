// Feedback — spec 23 §9.2 and spec 25 §8 (S13).
//
// Classified by scope, then ROUTED, never piled. Durable changes land as
// proposed diffs requiring HER acceptance; the original feedback and the
// decision are both preserved.
//
// Spec 25 completes it: three capture moments and no fourth, five classes, and
// the law that nothing routes on a class the engine proposed. PLAN §5.2:
// "The engine proposes; SHE decides; nothing updates strategy behind her back."

import type { ProfileBody } from '../tree/body.ts';
import { amendEntry, putEntry, readPath } from '../tree/body.ts';
import type {
  Amendment, BodyEntry, FeedbackClass, FeedbackItem, FeedbackScope,
} from '../tree/objects.ts';
import {
  nextStrategyVersionFor, readStrategy, writeStrategyVersion,
} from '../strategy/derivation.ts';
import { SEED_PATH } from './seeds.ts';
import { formatKey } from './formats.ts';

export const FEEDBACK_PATH = 'work-log/logs/feedback';

export class FeedbackRefused extends Error {}

export interface FeedbackInput {
  id: string;
  scope: FeedbackScope;
  /** Her words, preserved whatever happens next. */
  original: string;
  target_id?: string;
  /** Where it goes. `seed` stays on the record; `profile-rule` becomes a
   *  proposed diff against voice or boundaries, requiring her acceptance. */
  routed_to?: string;
  proposed_diff?: FeedbackItem['proposed_diff'];
  moment?: FeedbackItem['moment'];
  proposed_class?: FeedbackClass;
  confirmed_class?: FeedbackClass;
}

export function writeFeedback(body: ProfileBody, input: FeedbackInput, now: string): ProfileBody {
  const item: FeedbackItem = {
    id: input.id,
    scope: input.scope,
    original: input.original,
    target_id: input.target_id,
    routed_to: input.routed_to,
    proposed_diff: input.proposed_diff,
    moment: input.moment,
    proposed_class: input.proposed_class,
    confirmed_class: input.confirmed_class,
  };
  return putEntry(body, FEEDBACK_PATH, {
    id: input.id, type: 'feedback_item', data: item as unknown as Record<string, unknown>,
  }, { writer: 'owner', now });
}

export function readFeedback(body: ProfileBody): FeedbackItem[] {
  let entries: BodyEntry[];
  try {
    entries = readPath(body, FEEDBACK_PATH);
  } catch {
    return [];
  }
  return entries.map(e => {
    const item = { ...(e.data as unknown as FeedbackItem), id: e.id };
    // The path is append-only, so a decision and a confirmed class arrive as
    // amendments. The birth record stays byte-identical, forever (S13).
    for (const a of e.amendments ?? []) {
      Object.assign(item as unknown as Record<string, unknown>, a.changed);
    }
    return item;
  });
}

export function findFeedback(body: ProfileBody, id: string): FeedbackItem | null {
  return readFeedback(body).find(f => f.id === id) ?? null;
}

// ── §8.1 The three moments, and no fourth ────────────────────────────────────

export interface CaptureInput {
  id: string;
  moment: NonNullable<FeedbackItem['moment']>;
  /** The words as they were written, hers or the client's. */
  original: string;
  target_id?: string;
  /** What the engine THINKS this is. She confirms it; nothing routes on this. */
  proposed_class?: FeedbackClass;
  now: string;
}

/**
 * §8.3: the engine proposes a class, with its reason, on every captured item.
 * SHE confirms it. Nothing routes on a proposed class alone — this is refinement
 * item 4's autonomy law generalized: she triggers, the engine proposes, she
 * picks. Acceptance test 11.
 *
 * A captured item is `piece`-scoped and routed nowhere until she has confirmed.
 */
export function captureFeedback(body: ProfileBody, input: CaptureInput): ProfileBody {
  return writeFeedback(body, {
    id: input.id,
    scope: 'piece',
    original: input.original,
    target_id: input.target_id,
    moment: input.moment,
    proposed_class: input.proposed_class,
  }, input.now);
}

// ── §8.2 The five classes, and where each one goes ───────────────────────────

export const CLASS_SCOPE: Record<FeedbackClass, FeedbackScope> = {
  'piece-only': 'piece',
  voice: 'profile-rule',
  seed: 'seed',
  format: 'profile-rule',
  performance: 'candidate-strategy-change',
};

export function routeForClass(cls: FeedbackClass, opts: { platform?: string } = {}): string | null {
  switch (cls) {
    case 'piece-only':
      // Recorded on the piece, used by the revise call, never a diff.
      return null;
    case 'voice':
      return 'context/content-strategy/voice';
    case 'seed':
      return SEED_PATH;
    case 'format':
      return `context/content-strategy/platforms/${formatKey(opts.platform ?? '')}/rules`;
    case 'performance':
      return 'work-log/creation/costume-recommendations';
  }
}

export interface ConfirmInput {
  id: string;
  confirmed_class: FeedbackClass;
  /** Required for the format class: rules live inside a platform. */
  platform?: string;
  /** The durable change she is proposing, where the class is durable. */
  diff?: { before: unknown; after: unknown };
  by: string;
  now: string;
}

/**
 * Her confirmation. Only now does the item take its real scope and its route,
 * and only now can a proposed diff exist. Every durable route produces a diff
 * with `decision: undefined` — a PROPOSAL, and only that (§8.4).
 */
export function confirmFeedbackClass(body: ProfileBody, input: ConfirmInput): ProfileBody {
  const item = findFeedback(body, input.id);
  if (!item) throw new FeedbackRefused(`No feedback item ${input.id}.`);
  const path = routeForClass(input.confirmed_class, { platform: input.platform });
  if (input.confirmed_class === 'format' && !input.platform) {
    throw new FeedbackRefused('Format feedback lands in a platform\'s rules, so it needs the platform.');
  }

  const changed: Record<string, unknown> = {
    confirmed_class: input.confirmed_class,
    scope: CLASS_SCOPE[input.confirmed_class],
    routed_to: path ?? 'the piece',
  };
  if (path && input.diff) {
    changed.proposed_diff = { path, before: input.diff.before, after: input.diff.after };
  }

  const amendment: Amendment = {
    at: input.now, by: input.by,
    note: `Classified as ${input.confirmed_class}.`,
    changed,
  };
  return amendEntry(body, FEEDBACK_PATH, input.id, amendment);
}

/**
 * The guard §8.3 exists for: every routing path asserts a CONFIRMED class and
 * refuses without one. A `proposed_class` on its own routes nowhere.
 */
export function assertRoutable(item: FeedbackItem): FeedbackClass {
  if (!item.confirmed_class) {
    throw new FeedbackRefused(
      'This one is only a proposed class. Nothing routes until you confirm what it is.',
    );
  }
  return item.confirmed_class;
}

export function waitingDiffs(body: ProfileBody): FeedbackItem[] {
  return readFeedback(body).filter(f => f.proposed_diff && !f.decision);
}

/** Her acceptance surface, in plain words (§8.4). */
export function diffInWords(item: FeedbackItem, at?: string): string {
  const diff = item.proposed_diff;
  if (!diff) return item.original;
  const where = diff.path.split('/').slice(-1)[0];
  const dated = at ? `, ${at.slice(0, 10)}` : '';
  return `Change ${where}: ${describeValue(diff.after)}. From your note "${item.original}"${dated}.`;
}

function describeValue(v: unknown): string {
  if (Array.isArray(v)) return v.map(String).join(', ');
  if (v && typeof v === 'object') return JSON.stringify(v);
  return String(v ?? '');
}

// ── §8.4 Accept, reject, edit and accept ─────────────────────────────────────

export interface DecisionInput {
  id: string;
  by: string;
  now: string;
  note?: string;
  /** "Edit and accept": her version is applied, the original stays the proposal. */
  edited_after?: unknown;
  /** Required for the seed class: the field the amendment touches. */
  seed_field?: string;
}

export interface AcceptResult {
  body: ProfileBody;
  /** The strategy parameter version her acceptance created, when it created one. */
  strategy_version: number | null;
}

/**
 * Accept applies the diff and, for a strategy-owned path, creates strategy
 * parameter version N+1, dated, with the feedback as its reason line (spec 22
 * §8.8). The strategy changelog gets an entry for free.
 *
 * Nothing applies automatically. Ever.
 */
export function acceptDiff(body: ProfileBody, input: DecisionInput): AcceptResult {
  const item = findFeedback(body, input.id);
  if (!item) throw new FeedbackRefused(`No feedback item ${input.id}.`);
  assertRoutable(item);
  const diff = item.proposed_diff;
  if (!diff) throw new FeedbackRefused('There is nothing proposed on this one to accept.');
  if (item.decision) throw new FeedbackRefused('This one was already decided, and a decision is kept (S13).');

  const after = input.edited_after === undefined ? diff.after : input.edited_after;
  let next = body;
  let version: number | null = null;

  if (diff.path.startsWith('context/content-strategy')) {
    version = nextStrategyVersionFor(body, diff.path);
    const current = readStrategy(body, diff.path);
    next = writeStrategyVersion(next, diff.path, {
      key: current?.key ?? diff.path.split('/').slice(-1)[0],
      value: after,
      reason: item.original,
      sources: current?.sources ?? [`feedback:${item.id}`],
      owner_declared: true,
    }, version, input.now, input.by);
  } else if (diff.path === SEED_PATH && item.target_id) {
    next = amendEntry(next, SEED_PATH, item.target_id, {
      at: input.now, by: input.by,
      note: `Amended from her feedback: ${item.original}`,
      changed: { [input.seed_field ?? 'nuance']: after },
    });
  }

  next = amendEntry(next, FEEDBACK_PATH, input.id, {
    at: input.now, by: input.by,
    note: input.edited_after === undefined ? 'Accepted.' : 'Edited and accepted.',
    changed: {
      decision: { by: input.by, at: input.now, verdict: 'accepted', note: input.note },
      // Both survive: her edited version as the applied diff, the original as
      // the proposal (§8.4).
      applied_diff: { path: diff.path, before: diff.before, after },
    },
  });

  return { body: next, strategy_version: version };
}

/**
 * Reject preserves the item, the diff and the rejection with her reason. The
 * rejections matter as much as the acceptances — they are half the taste
 * layer's evidence (§8.4).
 */
export function rejectDiff(body: ProfileBody, input: DecisionInput): ProfileBody {
  const item = findFeedback(body, input.id);
  if (!item) throw new FeedbackRefused(`No feedback item ${input.id}.`);
  if (item.decision) throw new FeedbackRefused('This one was already decided, and a decision is kept (S13).');
  return amendEntry(body, FEEDBACK_PATH, input.id, {
    at: input.now, by: input.by,
    note: 'Rejected.',
    changed: { decision: { by: input.by, at: input.now, verdict: 'rejected', note: input.note } },
  });
}

// ── §8.2 The candidate gate refinement ───────────────────────────────────────

/**
 * PLAN §5.1 item 3: "some gates only emerge after working with a client for a
 * while." This is how that actually happens, without a gate questionnaire ever
 * existing: a repeated voice class on the same theme proposes a diff against
 * `content-strategy/gates` which, if she accepts it, creates gate set version 2
 * (spec 22 §8.8).
 */
export const GATE_REFINEMENT_THRESHOLD = 3;

export function candidateGateRefinements(body: ProfileBody): { theme: string; items: FeedbackItem[] }[] {
  const voice = readFeedback(body).filter(f => f.confirmed_class === 'voice');
  const byTheme = new Map<string, FeedbackItem[]>();
  for (const item of voice) {
    for (const theme of themeTokens(item.original)) {
      byTheme.set(theme, [...(byTheme.get(theme) ?? []), item]);
    }
  }
  return [...byTheme.entries()]
    .filter(([, items]) => items.length >= GATE_REFINEMENT_THRESHOLD)
    .map(([theme, items]) => ({ theme, items }));
}

const STOP_WORDS = new Set([
  'this', 'that', 'does', 'not', 'sound', 'like', 'her', 'the', 'and', 'for', 'with',
  'never', 'always', 'feels', 'too', 'very', 'been', 'have', 'from', 'they', 'them',
]);

function themeTokens(text: string): string[] {
  return [...new Set(
    text.toLowerCase().split(/[^a-z]+/).filter(w => w.length >= 4 && !STOP_WORDS.has(w)),
  )];
}

// ── §8.1 moment 2: the client's words, and S20's out-of-scope lane ───────────

/**
 * The client's verdict arrives through give-point 3 into the existing review
 * record. The client never classifies and never routes anything: their words
 * are data, and SHE classifies them. An out-of-scope ask auto-routes to
 * `work-log/logs/changes` per S20, which spec 21 already declared. No fifth door
 * is created (S19).
 */
export function routeOutOfScopeAsk(
  body: ProfileBody,
  input: { id: string; piece_id: string; words: string; now: string },
): ProfileBody {
  return putEntry(body, 'work-log/logs/changes', {
    id: input.id, type: 'change_record',
    data: {
      source: 'work-log/creation/review',
      piece_id: input.piece_id,
      words: input.words,
      state: 'waiting-on-her',
    },
  }, { writer: 'path:work-log/creation/review', now: input.now });
}

/**
 * §5.6, "Then the real bar." Below-the-bar carries the run id, the packet
 * version and her one-line reason, so the run is traceable to what it was given.
 * The count of these over time is the honest measure of whether the engine is
 * holding the bar — if it is not falling, the loop is broken and we fix the loop.
 */
export function belowTheBar(
  body: ProfileBody,
  input: {
    id: string; run_id: string; context_version: number; reason: string; target_id?: string;
    /** Spec 25 §4.9: a draft's below-the-bar also carries the standard it was
     *  written toward, so a falling count can be read against a moving gate set. */
    gate_set_version?: number;
  },
  now: string,
): ProfileBody {
  const gates = typeof input.gate_set_version === 'number' ? `@gates-v${input.gate_set_version}` : '';
  return writeFeedback(body, {
    id: input.id,
    scope: 'profile-rule',
    original: input.reason,
    target_id: input.target_id,
    moment: 'her-review',
    routed_to: `run:${input.run_id}@context-v${input.context_version}${gates}`,
  }, now);
}

/** Dismissing a proposal with a reason. Stays on the record, and is read when
 *  the same capture is re-run (§9.2). */
export function dismissalFeedback(
  body: ProfileBody, input: { id: string; proposal_id: string; reason: string }, now: string,
): ProfileBody {
  return writeFeedback(body, {
    id: input.id,
    scope: 'seed',
    original: input.reason,
    target_id: input.proposal_id,
    routed_to: 'record',
  }, now);
}

/** The below-the-bar count, per month. The number that says whether the bar is
 *  being held — plainly, with nothing derived from it automatically. */
export function belowBarCount(body: ProfileBody): number {
  return readFeedback(body).filter(f => f.scope === 'profile-rule' && f.routed_to?.startsWith('run:')).length;
}
