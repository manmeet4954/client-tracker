// The questionnaire builder — 2026-08-11.
//
// HER BRIEF: "it should work like a proper questionnaire works, like how we
// make it on Google Forms" — build the questions, look at it, send it, read
// what came back.
//
// WHAT WAS ALREADY THERE, and why this is smaller than it looks. The client
// form (components/intake/ClientForm) has always been able to draw short text,
// paragraphs, single choice, multiple choice, yes/no and numbers, because the
// 53-parameter bank used all of those shapes. What was missing was any way for
// HER to say which shape she wanted: `openOwnRound` hardcoded 'long-text', so
// every question she wrote arrived as a box to type in. This file is the
// missing half, not a new form engine.
//
// A form here is still an ordinary intake round. Same questions, same answers,
// same client link, same permanence. Nothing about a built form is a special
// case downstream, which is the point: a question she designed and a question
// from the bank are read by the same code.
//
// Pure: ids and `now` are injected. No clock, no React.

import type { ProfileBody } from '../tree/body.ts';
import { putEntry, readPath } from '../tree/body.ts';
import type { IntakeRound } from '../tree/objects.ts';
import type { ParameterShape } from './parameters.ts';
import type { GeneratedQuestion } from './generate.ts';
import { INTAKE_PATH, QUESTIONS_PATH, readAnswers, readRounds, closeOpenRounds } from './rounds.ts';
import { OWN_PREFIX } from './ownQuestions.ts';
import { factParameterId, type FactName } from './factsRound.ts';

/**
 * The types she can pick, in her words rather than the parameter bank's.
 *
 * Only shapes the CLIENT FORM CAN ACTUALLY DRAW are offered. Offering a type
 * the form renders as a blank space would be worse than not offering it, and
 * `entry-list` and `file-reference` are exactly that today. The test pins this
 * list against the form's own renderer.
 */
export interface QuestionType {
  id: ParameterShape;
  label: string;
  /** One line under the label when she is choosing. */
  hint: string;
  /** True where the question needs a list of options to make sense. */
  needsOptions?: boolean;
}

export const QUESTION_TYPES: QuestionType[] = [
  { id: 'long-text', label: 'Paragraph', hint: 'A long answer, in their own words.' },
  { id: 'text', label: 'Short answer', hint: 'One line.' },
  { id: 'single-select', label: 'Choose one', hint: 'They pick one option.', needsOptions: true },
  { id: 'multi-select', label: 'Choose any', hint: 'They pick as many as apply.', needsOptions: true },
  { id: 'yes-no', label: 'Yes or no', hint: 'A straight answer.' },
  { id: 'number', label: 'Number', hint: 'A figure, nothing else.' },
];

export function findType(id: string): QuestionType | undefined {
  return QUESTION_TYPES.find(t => t.id === id);
}

export function typeNeedsOptions(id: string): boolean {
  return !!findType(id)?.needsOptions;
}

/** One question while she is still building it. Not yet stored. */
export interface QuestionDraft {
  /** Local only, for React keys and reordering. Never stored. */
  key: string;
  text: string;
  shape: ParameterShape;
  options: string[];
  /**
   * Set when this question FILLS A BRAND FACT (2026-08-11). The old screen had
   * a separate "Client questionnaire" card for the eight blanks, beside the
   * form builder: two tabs that both asked questions. Her verdict was right:
   * "question is a separate thing, and build a form is a separate thing, which
   * is not needed at all." So the blanks became prefills in the ONE form, and
   * this field is what makes their answers land under the brand boxes rather
   * than only in the responses list. That landing is what lets the strategy
   * visibly fill as intake happens, which is the point of the whole feature.
   */
  factId?: FactName;
}

export function blankQuestion(key: string): QuestionDraft {
  return { key, text: '', shape: 'long-text', options: [] };
}

/** The id one draft's answers travel under: a fact's own id when it fills one. */
export function draftParameterId(d: QuestionDraft, index: number, version: number): string {
  return d.factId ? factParameterId(d.factId) : `${OWN_PREFIX}v${version}-q${index + 1}`;
}

/** Moving a question up or down. Out-of-range moves are no-ops, not errors. */
export function moveQuestion(drafts: QuestionDraft[], index: number, delta: -1 | 1): QuestionDraft[] {
  const to = index + delta;
  if (index < 0 || index >= drafts.length || to < 0 || to >= drafts.length) return drafts;
  const next = [...drafts];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

/**
 * What is wrong with the form, in sentences she can act on.
 *
 * It refuses rather than tidies: a "choose one" question with no options would
 * reach the client as an unanswerable question, and silently dropping it or
 * silently converting it to a text box would both be decisions she did not make.
 */
export function formProblems(drafts: QuestionDraft[]): string[] {
  const out: string[] = [];
  const asked = drafts.filter(d => d.text.trim());
  if (asked.length === 0) out.push('The form has no questions yet.');

  asked.forEach((d, i) => {
    if (typeNeedsOptions(d.shape) && cleanOptions(d.options).length < 2) {
      out.push(`Question ${i + 1} lets them choose, so it needs at least two options.`);
    }
  });

  const seen = new Set<string>();
  for (const d of asked) {
    const key = d.text.trim().toLowerCase();
    if (seen.has(key)) out.push('The same question is in the form twice.');
    seen.add(key);
  }
  const facts = asked.map(d => d.factId).filter(Boolean) as string[];
  if (new Set(facts).size !== facts.length) {
    out.push('Two questions fill the same brand detail. Keep one of them.');
  }
  return [...new Set(out)];
}

export function cleanOptions(options: string[]): string[] {
  return [...new Set(options.map(o => o.trim()).filter(Boolean))];
}

/** Ready to send: has questions, and nothing wrong with them. */
export function canSend(drafts: QuestionDraft[]): boolean {
  return formProblems(drafts).length === 0;
}

/**
 * Build the form into a round and send it.
 *
 * Sent in one move: the wording is hers, so the vocabulary rule (§4 rule 1, no
 * draft wording reaches a client) is satisfied by construction. Every earlier
 * round moves to history, which is the rounds screen's standing rule.
 */
export function openBuiltForm(
  body: ProfileBody, drafts: QuestionDraft[], now: string,
): { body: ProfileBody; round: IntakeRound } {
  const problems = formProblems(drafts);
  if (problems.length) throw new Error(`[form] ${problems[0]}`);

  const asked = drafts.filter(d => d.text.trim());
  const version = Math.max(0, ...readRounds(body).map(r => r.version)) + 1;

  // One open round at a time, closed in the data as well as the state.
  let next = closeOpenRounds(body, now);

  const parameters = asked.map((d, i) => draftParameterId(d, i, version));
  const round: IntakeRound = {
    id: `round-${version}`,
    version,
    parameters,
    delivery: 'dashboard-questionnaire',
    status: 'sent',
    curation: {},
    opened_at: now,
  };
  next = putEntry(next, INTAKE_PATH, {
    id: round.id, type: 'intake_round', data: round as unknown as Record<string, unknown>,
  }, { writer: 'owner', now });

  asked.forEach((d, i) => {
    const options = typeNeedsOptions(d.shape) ? cleanOptions(d.options) : [];
    const q: GeneratedQuestion = {
      id: `q${version}-${parameters[i]}`,
      parameter_id: parameters[i],
      parameter_path: 'context/business-details',
      text: d.text.trim(),
      shape: d.shape,
      options,
      // Every list ships a free-text lane (§4.7): a client whose answer is not
      // on her list must still be able to give it, or the form invents data.
      free_text_lane: options.length ? 'Something else' : null,
      round_version: version,
      vocabulary_draft: false,
    };
    next = putEntry(next, QUESTIONS_PATH, {
      id: q.id, type: 'question', data: q as unknown as Record<string, unknown>,
    }, { writer: 'owner', now });
  });

  return { body: next, round };
}

// ── Reading it back ──────────────────────────────────────────────────────────

export interface FormQuestion {
  parameterId: string;
  text: string;
  shape: ParameterShape;
  options: string[];
  order: number;
}

export interface FormResponse extends FormQuestion {
  /** Their words, exactly as they arrived. Null while it is unanswered. */
  answer: string | null;
  skipped: boolean;
  by: string;
  at: string;
}

/** The live form, in the order she built it. Empty when none is out. */
export function liveForm(body: ProfileBody): { version: number; questions: FormQuestion[] } | null {
  const open = readRounds(body).find(r => r.status === 'sent');
  if (!open) return null;
  const questions = questionsOf(body, open.version);
  return questions.length ? { version: open.version, questions } : null;
}

function questionsOf(body: ProfileBody, version: number): FormQuestion[] {
  // The round's own parameter list IS the form: membership and order both come
  // from it, because entries are not stored in sequence and a fact-filling
  // question's id carries no position of its own.
  const round = readRounds(body).find(r => r.version === version);
  if (!round) return [];
  const out: FormQuestion[] = [];
  for (const e of readPath(body, QUESTIONS_PATH)) {
    const q = e.data as unknown as GeneratedQuestion;
    if (q.round_version !== version) continue;
    const order = round.parameters.indexOf(q.parameter_id);
    if (order < 0) continue;
    out.push({
      parameterId: q.parameter_id, text: q.text, shape: q.shape,
      options: q.options ?? [], order,
    });
  }
  return out.sort((a, b) => a.order - b.order);
}

/**
 * The form with what came back against each question, answered or not.
 *
 * An unanswered question is RETURNED, with `answer: null`, rather than left
 * out. A responses screen that only listed answers would quietly hide what the
 * client declined to tell her, which is often the more useful fact.
 */
export function formResponses(body: ProfileBody, version?: number): FormResponse[] {
  const live = version ?? readRounds(body).find(r => r.status === 'sent')?.version;
  if (live === undefined) return [];

  const latest = new Map<string, { value: string; kind: string; by: string; at: string }>();
  for (const a of readAnswers(body)) {
    if (a.round_version !== live) continue;
    const seen = latest.get(a.parameter_id);
    if (seen && seen.at > a.at) continue;
    latest.set(a.parameter_id, { value: a.value, kind: a.kind, by: a.by, at: a.at });
  }

  return questionsOf(body, live).map(q => {
    const got = latest.get(q.parameterId);
    const answered = !!got && got.kind === 'answer' && !!got.value.trim();
    return {
      ...q,
      answer: answered ? got!.value : null,
      skipped: !!got && got.kind === 'skipped',
      by: got?.by ?? '',
      at: got?.at ?? '',
    };
  });
}

/** "4 of 7 answered." Counted, never guessed. */
export function responsesLine(responses: FormResponse[]): string {
  if (responses.length === 0) return 'No form has been sent yet.';
  const answered = responses.filter(r => r.answer !== null).length;
  if (answered === 0) return `Sent. No response yet to ${responses.length} questions.`;
  if (answered === responses.length) return `All ${responses.length} answered.`;
  return `${answered} of ${responses.length} answered.`;
}
