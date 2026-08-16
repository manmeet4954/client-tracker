// The client's questionnaire, as a state machine — spec 33 §4.
//
// The form is one question at a time, and the component that draws it owns no
// arithmetic. Everything the screen says about where you are, what is behind
// you, what is ahead, and whether the thing can be sent is decided here, so it
// can be read without a browser.
//
// Three rules this file exists to keep:
//
//   1. Spec 33 §5, the standing rule. A screen that walks a person through more
//      than three of something must answer four questions: where am I, how do I
//      go on, how do I go back, and how do I leave without losing anything.
//      `positionLine`, `nextIndex`, `backIndex` and `resumeLine` are those four
//      answers, and they are computed, never drawn from memory.
//   2. Every count is counted from the array it describes. "4 of 18" is
//      `steps.length`, at render time. There is no stored total anywhere.
//   3. A skip is a THIRD STATE (spec 33 §4): not answered, not abandoned. It
//      never writes an answer record, because a skip is not something they
//      said and raw answers are never altered (S11). It lives on the round.

import type { ProfileBody } from '../tree/body.ts';
import { putEntry, readPath } from '../tree/body.ts';
import type { IntakeDocument, IntakeRound } from '../tree/objects.ts';
import type { ParameterShape } from './parameters.ts';
import { findParameter } from './parameters.ts';
import type { GeneratedQuestion } from './generate.ts';
import type { AnswerRecord } from './status.ts';
import { INTAKE_PATH, readAnswers, readQuestions, readRounds } from './rounds.ts';
import { listWords, plural } from './screens.ts';

// ── The three states, and the words for them ─────────────────────────────────

/** Spec 33 §4. Blank is not skipped, and skipped is not answered. */
export type StepState = 'answered' | 'skipped' | 'blank';

const STATE_LINES: Record<StepState, string> = {
  answered: 'Answered',
  skipped: 'Marked for later',
  blank: 'Not answered yet',
};

export function stateLine(state: StepState): string {
  return STATE_LINES[state];
}

// ── One question, as the screen needs it ─────────────────────────────────────

export interface FormStep {
  /** 0-based position in the walk. */
  index: number;
  /** What a person counts from. `index + 1`, so "4 of 18" needs no maths. */
  number: number;
  id: string;
  parameterId: string;
  text: string;
  shape: ParameterShape;
  also?: ParameterShape;
  options: string[];
  freeTextLane: string | null;
  state: StepState;
  /** The words as they arrived. Never editable, ever (S11). */
  answer: string;
  /** Filed as "they would not say" — an answer, and a different thing from a skip. */
  notSaid: boolean;
  /** Counted from the documents given against this one question. */
  attachments: number;
  stateLine: string;
}

export interface FormProgress {
  answered: number;
  skipped: number;
  blank: number;
  total: number;
}

export interface FormInput {
  /** The round's parameter ids, in the order it asks them. */
  parameters: string[];
  questions: GeneratedQuestion[];
  answers: AnswerRecord[];
  /** `round.skipped` — the ids they chose to come back to. */
  skipped?: string[];
  /** Only the ones given in answer to one question (`answers_parameter`). */
  documents?: Pick<IntakeDocument, 'answers_parameter'>[];
  /** When set, only answers filed against this round count. */
  roundVersion?: number;
}

/** The walk, in the round's own order. One step per parameter, nothing else. */
export function buildSteps(input: FormInput): FormStep[] {
  const byParameter = new Map(input.questions.map(q => [q.parameter_id, q]));
  const skipped = new Set(input.skipped ?? []);
  const mine = input.answers.filter(
    a => input.roundVersion === undefined || a.round_version === input.roundVersion,
  );

  return input.parameters.map((pid, index) => {
    const q = byParameter.get(pid);
    const p = findParameter(pid);
    const given = mine.filter(a => a.parameter_id === pid);
    const said = given.find(a => a.kind === 'answer' && a.value.trim() !== '');
    const refused = given.find(a => a.kind === 'skipped');

    const state: StepState = said || refused ? 'answered' : skipped.has(pid) ? 'skipped' : 'blank';

    return {
      index,
      number: index + 1,
      id: q?.id ?? `step-${pid}`,
      parameterId: pid,
      text: q?.text ?? p?.question ?? pid,
      shape: q?.shape ?? p?.shape ?? 'long-text',
      also: q?.also ?? p?.also,
      options: q?.options ?? [],
      freeTextLane: q?.free_text_lane ?? null,
      state,
      answer: said?.value ?? '',
      notSaid: !said && !!refused,
      attachments: (input.documents ?? []).filter(d => d.answers_parameter === pid).length,
      stateLine: STATE_LINES[state],
    };
  });
}

/** Counted from the array, every time. Nothing here is ever stored. */
export function progressOf(steps: FormStep[]): FormProgress {
  return {
    answered: steps.filter(s => s.state === 'answered').length,
    skipped: steps.filter(s => s.state === 'skipped').length,
    blank: steps.filter(s => s.state === 'blank').length,
    total: steps.length,
  };
}

/** "3 answered, 1 marked for later and 14 remaining." */
export function progressLine(steps: FormStep[]): string {
  const p = progressOf(steps);
  if (p.total === 0) return 'No questions to answer right now.';
  const parts = [`${p.answered} answered`];
  if (p.skipped > 0) parts.push(`${p.skipped} marked for later`);
  if (p.blank > 0) parts.push(`${p.blank} remaining`);
  return `${listWords(parts)}.`;
}

// ── Where to land, and what to say about it ──────────────────────────────────

/**
 * The first thing not yet done. A skip counts as not done, which is the whole
 * point of it being a third state. When everything is done this is
 * `steps.length` — the review screen, which sits one past the last question.
 */
export function resumeIndex(steps: FormStep[]): number {
  const at = steps.findIndex(s => s.state !== 'answered');
  return at === -1 ? steps.length : at;
}

/**
 * The next unfinished question after `from`, wrapping to the start. Null when
 * there is no OTHER one — the question you are standing on is never the answer
 * to "where next".
 */
export function nextUnfinished(steps: FormStep[], from: number): number | null {
  const after = steps.findIndex((s, i) => i > from && s.state !== 'answered');
  if (after !== -1) return after;
  const before = steps.findIndex((s, i) => i < from && s.state !== 'answered');
  return before === -1 ? null : before;
}

/**
 * The one plain line that says you did not lose anything. Spec 33 §4: reopening
 * returns to the first thing not yet done, AND says so.
 */
export function resumeLine(steps: FormStep[], at: number): string {
  const p = progressOf(steps);
  if (p.total === 0) return 'No questions to answer right now.';
  if (at >= p.total) return `All ${p.total} questions answered. Review and submit when ready.`;
  const touched = p.answered + p.skipped;
  if (touched === 0) {
    return `${p.total} questions. Your answers are saved automatically, so you can return at any time.`;
  }
  return `Resuming at question ${at + 1} of ${p.total}. Your previous answers are saved.`;
}

// ── The machine ──────────────────────────────────────────────────────────────

export interface FormModel {
  steps: FormStep[];
  /** Counted, never stored. */
  total: number;
  /** 0 to `total`. `total` is the review screen. */
  cursor: number;
  onReview: boolean;
  current: FormStep | null;
  /** How to go back. Null only at the very first question. */
  backIndex: number | null;
  /** How to go on. Null only on the review screen. */
  nextIndex: number | null;
  /** Where am I: "4 of 18". Never a percentage. */
  positionLine: string;
  progress: FormProgress;
  progressLine: string;
  resumeIndex: number;
  resumeLine: string;
  /** How do I leave: nothing to press, and this is the line that says so. */
  leaveLine: string;
  canSend: boolean;
  sendLine: string;
  review: { answered: FormStep[]; skipped: FormStep[]; blank: FormStep[] };
}

export function clampCursor(cursor: number, total: number): number {
  if (!Number.isFinite(cursor)) return 0;
  return Math.max(0, Math.min(Math.trunc(cursor), total));
}

export function formModel(input: FormInput, cursor: number): FormModel {
  const steps = buildSteps(input);
  return modelFromSteps(steps, cursor);
}

export function modelFromSteps(steps: FormStep[], cursor: number): FormModel {
  const total = steps.length;
  const at = clampCursor(cursor, total);
  const onReview = at >= total;
  const p = progressOf(steps);
  const resume = resumeIndex(steps);

  return {
    steps,
    total,
    cursor: at,
    onReview,
    current: onReview ? null : steps[at] ?? null,
    backIndex: at <= 0 ? null : at - 1,
    nextIndex: onReview ? null : at + 1,
    positionLine: onReview ? 'Review' : `${at + 1} of ${total}`,
    progress: p,
    progressLine: progressLine(steps),
    resumeIndex: resume,
    resumeLine: resumeLine(steps, resume),
    leaveLine: 'Your answers are saved automatically. You can close this page at any time.',
    canSend: total > 0 && p.blank === 0 && p.skipped === 0,
    sendLine: sendLine(steps),
    review: {
      answered: steps.filter(s => s.state === 'answered'),
      skipped: steps.filter(s => s.state === 'skipped'),
      blank: steps.filter(s => s.state === 'blank'),
    },
  };
}

/** What the review screen says above the button, counted from the steps. */
export function sendLine(steps: FormStep[]): string {
  const p = progressOf(steps);
  if (p.total === 0) return 'No questions to answer right now.';
  if (p.blank === 0 && p.skipped === 0) {
    return `All ${p.total} questions answered. Submit when you are ready.`;
  }
  const parts: string[] = [];
  if (p.blank > 0) parts.push(`${p.blank} not answered`);
  if (p.skipped > 0) {
    parts.push(`${p.skipped} marked for later`);
  }
  return `${listWords(parts)}. Complete ${plural(p.blank + p.skipped, 'it', 'them')} to submit.`;
}

// ── Moving ───────────────────────────────────────────────────────────────────

export function goNext(model: FormModel): number {
  return clampCursor(model.cursor + 1, model.total);
}

export function goBack(model: FormModel): number {
  return clampCursor(model.cursor - 1, model.total);
}

/** The list view's one job: jump to any question by its position. */
export function jumpTo(model: FormModel, index: number): number {
  return clampCursor(index, model.total);
}

// ── The skip, and where it is kept ───────────────────────────────────────────

/** Idempotent both ways: skipping twice is one skip, answering clears it. */
export function applySkip(skipped: string[], parameterId: string, on: boolean): string[] {
  const set = skipped.filter(id => id !== parameterId);
  return on ? [...set, parameterId] : set;
}

export function readSkipped(body: ProfileBody, roundId: string): string[] {
  const entry = readPath(body, INTAKE_PATH).find(e => e.id === roundId);
  if (!entry) return [];
  return (entry.data as unknown as IntakeRound).skipped ?? [];
}

/**
 * Write the round's skip list.
 *
 * `context/intake` is fed by the owner alone, and that is deliberate: no client
 * action writes the round object (spec 22 §5.2, and the acceptance test that
 * pins it). So a CLIENT's skip cannot travel this way from the browser. It has
 * to be asked for, and applied server side by the owner authority. The handoff
 * note names the route that has to exist; this function is what that route
 * calls, and it is what her own side already uses today.
 */
export function writeSkipped(
  body: ProfileBody, roundId: string, skipped: string[], now: string, writer = 'owner',
): ProfileBody {
  const entry = readPath(body, INTAKE_PATH).find(e => e.id === roundId);
  if (!entry) throw new Error(`[intake] no round ${roundId}`);
  const round = entry.data as unknown as IntakeRound;
  const next: IntakeRound = { ...round, skipped };
  return putEntry(body, INTAKE_PATH, {
    id: roundId, type: 'intake_round', data: next as unknown as Record<string, unknown>,
  }, { writer, now });
}

/**
 * The parameters that are ONLY skipped: come back to, and never come back to.
 *
 * Spec 33 §4 says a round cannot be marked answered while any of these stands.
 * It already cannot: `computeStatus` reaches `answered` only when every
 * parameter has an answer record, and a skip deliberately writes none. This
 * function is what both sides SHOW, so the rule is visible rather than merely
 * true.
 */
export function onlySkipped(round: IntakeRound, answers: AnswerRecord[]): string[] {
  const answered = new Set(
    answers.filter(a => a.round_version === round.version).map(a => a.parameter_id),
  );
  return (round.skipped ?? []).filter(p => round.parameters.includes(p) && !answered.has(p));
}

export function roundCanBeAnswered(round: IntakeRound, answers: AnswerRecord[]): boolean {
  return onlySkipped(round, answers).length === 0;
}

// ── Reading the open round out of a body ─────────────────────────────────────

export interface OpenForm {
  round: IntakeRound;
  questions: GeneratedQuestion[];
  answers: AnswerRecord[];
  skipped: string[];
}

/**
 * The round the client is being asked to fill in, or null.
 *
 * Deliberately the same choice the screen made before this spec — the latest
 * round that is not curated — so nothing that is open today closes because the
 * form got a navigation bar.
 */
export function openFormFor(body: ProfileBody): OpenForm | null {
  const round = readRounds(body).filter(r => r.status !== 'curated').pop();
  if (!round) return null;
  return {
    round,
    questions: readQuestions(body, round.version),
    answers: readAnswers(body).filter(a => a.round_version === round.version),
    skipped: round.skipped ?? [],
  };
}
