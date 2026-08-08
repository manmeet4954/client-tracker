// The two Intake screens, as data — restructure handoff, "Level 3 → INTAKE".
//
// Everything the Rounds card and the Curation card SAY is computed here, so it
// can be read without a browser. The rule that made this a separate file is the
// README's recurring bug turned into a law: every count shown in copy is
// derived at render time from the array it describes. No component in
// components/intake/ writes a number of its own.
//
// Two things this file is careful about, because they are guarantees and not
// preferences:
//
//   1. A raw answer is permanent. Nothing here returns an editing affordance
//      for one, and `RawAnswerLine.editable` is the literal `false` so a
//      component cannot accidentally offer one.
//   2. No curated value without its provenance (spec 21 §7.4, S11). A curated
//      reading carries which answers produced it, who curated it, when, its
//      confidence, and what it superseded.

import type { ProfileBody } from '../tree/body.ts';
import type { Confidence, CuratedParameter, IntakeRound, IntakeStatus } from '../tree/objects.ts';
import { PARAMETERS, findParameter, type ParameterRecord } from './parameters.ts';
import { readAnswers, readQuestions, readRounds } from './rounds.ts';
import { answersFor, curationHistory, readCurated } from './curate.ts';
import type { AnswerRecord } from './status.ts';
import { blockedFromSending } from './generate.ts';
import { derivationRow, readersOfParameter } from '../strategy/derivation.ts';

// ── Small shared words ───────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "4 Jun". UTC, so a test says the same thing on any machine. */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/** "a, b and c" — the list as she would say it out loud. */
export function listWords(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

// ── ROUNDS ───────────────────────────────────────────────────────────────────

export type QuestionState = 'answered' | 'not-said' | 'waiting';

export interface AnswerLine {
  id: string;
  /** The words exactly as they arrived. Never rewritten, never editable (S11). */
  value: string;
  kind: 'answer' | 'skipped';
  by: string;
  at: string;
  round: number;
  /** Always false. It is here so a component cannot forget. */
  readonly editable: false;
}

export interface QuestionLine {
  id: string;
  parameterId: string;
  text: string;
  state: QuestionState;
  /** The words on the right of the row. */
  label: string;
  answers: AnswerLine[];
  /** True while this question still carries the draft wording (spec 22 §4). */
  draftWording: boolean;
}

export interface RoundCard {
  id: string;
  version: number;
  name: string;
  delivery: IntakeRound['delivery'];
  status: IntakeStatus;
  /** The 9px dot: true is #1a7f4b, false is #ea4711. */
  done: boolean;
  /** The state pill's copy. */
  pill: string;
  questions: QuestionLine[];
  /** Counted from `questions`, never stored. */
  openCount: number;
  /** Parameter ids still in the draft wording. A round with any cannot be sent. */
  draftWording: string[];
  sendable: boolean;
}

function answerLine(a: AnswerRecord): AnswerLine {
  return {
    id: a.id, value: a.value, kind: a.kind, by: a.by, at: a.at,
    round: a.round_version, editable: false,
  };
}

function questionState(answers: AnswerLine[]): QuestionState {
  if (answers.length === 0) return 'waiting';
  return answers.some(a => a.kind === 'answer') ? 'answered' : 'not-said';
}

const STATE_WORDS: Record<QuestionState, string> = {
  answered: 'answered',
  'not-said': 'they would not say',
  waiting: 'waiting',
};

const DELIVERY_WORDS: Record<IntakeRound['delivery'], string> = {
  'dashboard-questionnaire': 'they fill it in',
  'finding-session': 'a recorded meeting',
  documents: 'they hand things over',
};

/**
 * One card per round, newest first.
 *
 * `openCount` counts only a round that has actually gone out. A round she has
 * written but not sent has nothing open with anyone, and saying "12 still open"
 * about it would be a number that means nothing.
 */
export function composeRounds(body: ProfileBody): RoundCard[] {
  const answers = readAnswers(body);
  const rounds = readRounds(body);

  return rounds
    .map(round => {
      const generated = readQuestions(body, round.version);
      const byParameter = new Map(generated.map(q => [q.parameter_id, q]));

      const questions: QuestionLine[] = round.parameters.map(pid => {
        const q = byParameter.get(pid);
        const p = findParameter(pid);
        const mine = answers
          .filter(a => a.round_version === round.version && a.parameter_id === pid)
          .map(answerLine);
        const state = questionState(mine);
        return {
          id: q?.id ?? `${round.id}-${pid}`,
          parameterId: pid,
          text: q?.text ?? p?.question ?? pid,
          state,
          label: STATE_WORDS[state],
          answers: mine,
          draftWording: q ? q.vocabulary_draft : p?.vocabulary === 'draft',
        };
      });

      const sent = round.status !== 'not-sent';
      const openCount = sent ? questions.filter(q => q.state === 'waiting').length : 0;
      const draftWording = blockedFromSending(round.parameters);
      const curatedAt = Object.values(round.curation ?? {})
        .map(c => c.at ?? '')
        .filter(Boolean)
        .sort()
        .pop();

      return {
        id: round.id,
        version: round.version,
        name: `Round ${round.version}, ${DELIVERY_WORDS[round.delivery]}`,
        delivery: round.delivery,
        status: round.status,
        done: round.status === 'answered' || round.status === 'curated',
        pill: roundPill(round.status, openCount, curatedAt),
        questions,
        openCount,
        draftWording,
        sendable: !sent && draftWording.length === 0 && questions.length > 0,
      };
    })
    .sort((a, b) => b.version - a.version);
}

function roundPill(status: IntakeStatus, openCount: number, curatedAt?: string): string {
  if (status === 'not-sent') return 'not sent yet';
  if (status === 'sent') return `${openCount} still open`;
  if (status === 'answered') return 'all back, waiting on you';
  return curatedAt ? `curated ${shortDate(curatedAt)}` : 'curated';
}

/**
 * The line under the title. It says the one true thing about intake right now,
 * and every number in it is counted from `cards`.
 */
export function intakeHeadline(cards: RoundCard[]): string {
  if (cards.length === 0) {
    return 'No rounds yet. Open one to see the questions it would ask.';
  }

  const notSent = cards.filter(c => c.status === 'not-sent');
  if (notSent.length > 0) {
    const c = notSent[0];
    const n = c.questions.length;
    return `Round ${c.version} is written and not sent yet. ${n} ${plural(n, 'question', 'questions')} in it.`;
  }

  const open = cards.filter(c => c.openCount > 0);
  const openTotal = open.reduce((sum, c) => sum + c.openCount, 0);
  if (openTotal > 0) {
    const where = open.length === 1
      ? `from round ${open[0].version}`
      : `across ${open.length} rounds`;
    return `${openTotal} ${plural(openTotal, 'question', 'questions')} still open ${where}.`;
  }

  const waiting = cards.filter(c => c.status === 'answered');
  if (waiting.length > 0) {
    const n = waiting.reduce((sum, c) => sum + c.questions.filter(q => q.state !== 'waiting').length, 0);
    return `${n} ${plural(n, 'answer is', 'answers are')} back and waiting on your reading.`;
  }

  return 'All rounds answered and curated.';
}

/** Why a round cannot go out yet, in her words. Empty string when it can. */
export function sendBlockedLine(card: RoundCard): string {
  if (card.status !== 'not-sent') return '';
  if (card.questions.length === 0) {
    return 'This round asks nothing. Everything in it is either curated already or switched off here.';
  }
  const n = card.draftWording.length;
  if (n === 0) return '';
  return `This round cannot go out yet. ${n} ${plural(n, 'question is', 'questions are')} still in the draft wording, ` +
    'so read them and make them yours first.';
}

// ── CURATION ─────────────────────────────────────────────────────────────────

export const CONFIDENCE_CHOICES: { id: Confidence; label: string }[] = [
  { id: 'confirmed', label: 'they said it plainly' },
  { id: 'inferred', label: 'I read it out of what they said' },
  { id: 'unknown', label: 'still a gap' },
];

const CONFIDENCE_WORDS: Record<Confidence, string> = {
  confirmed: 'They said it plainly.',
  inferred: 'Read out of what they said.',
  'legacy-unverified': 'Carried over from the old system and never checked.',
  unknown: 'Still a gap.',
};

export function confidenceWords(c: Confidence): string {
  return CONFIDENCE_WORDS[c] ?? '';
}

export interface SourceLine {
  kind: 'answer' | 'owner' | 'missing';
  ref: string;
  /** The answer's own words, or her note, or the ref we could not resolve. */
  text: string;
  by?: string;
  round?: number;
}

/** One curated reading with everything S11 requires it to carry. */
export interface CuratedReading {
  value: string;
  curator: string;
  at: string;
  confidence: Confidence;
  sources: SourceLine[];
  /** §7.4: assembled entirely from her own notes, with no answer behind it. */
  ownerDirectOnly: boolean;
}

export interface CurationPanel {
  parameter: ParameterRecord;
  /** Left column. Permanent, and never carries an edit control. */
  raw: AnswerLine[];
  /** Right column, when she has written one. */
  current: CuratedReading | null;
  /** Older readings, newest first. Nothing is overwritten. */
  superseded: CuratedReading[];
  feeds: { path: string; label: string }[];
  /** The footer line naming the Strategy parameter it feeds. */
  feedsLine: string;
  /** Who curated it, when, from what, how sure, and what it replaced. */
  provenanceLine: string;
  /** What the left column says when it is empty, counted from `raw`. */
  rawLine: string;
}

function readingFrom(value: CuratedParameter, answers: AnswerRecord[]): CuratedReading {
  const byId = new Map(answers.map(a => [a.id, a]));
  const sources: SourceLine[] = value.provenance.source_refs.map(ref => {
    if (ref.startsWith('owner-direct:')) {
      return { kind: 'owner', ref, text: ref.slice('owner-direct:'.length) };
    }
    const a = byId.get(ref);
    if (!a) return { kind: 'missing', ref, text: ref };
    return { kind: 'answer', ref, text: a.value, by: a.by, round: a.round_version };
  });
  return {
    value: value.value === null || value.value === undefined ? '' : String(value.value),
    curator: value.provenance.curator,
    at: value.provenance.at,
    confidence: value.provenance.confidence,
    sources,
    ownerDirectOnly: sources.length > 0 && sources.every(s => s.kind === 'owner'),
  };
}

function provenanceLine(current: CuratedReading | null, superseded: CuratedReading[]): string {
  if (!current) return 'Nothing written yet.';
  const parts: string[] = [`Curated by ${current.curator} on ${shortDate(current.at)}.`];

  const fromAnswers = current.sources.filter(s => s.kind === 'answer').length;
  if (fromAnswers > 0) {
    parts.push(`From ${fromAnswers} ${plural(fromAnswers, 'answer', 'answers')}.`);
  } else if (current.ownerDirectOnly) {
    parts.push('From your own note, not from an answer.');
  }

  const words = confidenceWords(current.confidence);
  if (words) parts.push(words);

  if (superseded.length > 0) {
    parts.push(
      `It replaced ${superseded.length} earlier ${plural(superseded.length, 'reading', 'readings')}, kept below.`,
    );
  }
  return parts.join(' ');
}

function feedsLineFor(feeds: { label: string }[]): string {
  if (feeds.length === 0) return 'No strategy decision reads this one.';
  return `Feeds Strategy, ${listWords(feeds.map(f => f.label))}.`;
}

function rawLineFor(raw: AnswerLine[]): string {
  if (raw.length === 0) return 'Nothing has come back for this one yet.';
  const said = raw.filter(a => a.kind === 'answer').length;
  if (said === 0) {
    return `${raw.length} ${plural(raw.length, 'time', 'times')} asked, and they chose not to answer.`;
  }
  return `${said} ${plural(said, 'answer', 'answers')}, kept exactly as ${plural(said, 'it', 'they')} arrived.`;
}

/** Everything one parameter's card shows. Null when the id is not a parameter. */
export function composeCuration(body: ProfileBody, parameterId: string): CurationPanel | null {
  const p = findParameter(parameterId);
  if (!p) return null;

  const all = readAnswers(body);
  const raw = answersFor(body, parameterId).map(answerLine);
  const history = curationHistory(body, parameterId).map(v => readingFrom(v, all));
  const active = readCurated(body, parameterId);
  const current = active ? readingFrom(active, all) : null;

  // Everything except the reading that is live now, newest first.
  const superseded = current
    ? history.filter(h => !(h.at === current.at && h.value === current.value)).reverse()
    : [];

  const feeds = readersOfParameter(parameterId).map(path => ({
    path, label: derivationRow(path)?.label ?? (path.split('/').pop() ?? path),
  }));

  return {
    parameter: p,
    raw,
    current,
    superseded,
    feeds,
    feedsLine: feedsLineFor(feeds),
    provenanceLine: provenanceLine(current, superseded),
    rawLine: rawLineFor(raw),
  };
}

// ── The queue: one parameter at a time, and which one ────────────────────────

export interface QueueItem {
  id: string;
  label: string;
  curated: boolean;
  /** Counted from the answers this parameter actually has. */
  answers: number;
  /** Answered and not yet curated: the work. */
  waiting: boolean;
}

export interface QueueOptions {
  /**
   * On one of HER profiles there is no client to answer, so a parameter with
   * nothing behind it is still hers to write from her own note (§7.4). On a
   * client profile a parameter nobody has spoken to is not curatable, and an
   * empty row for it would be a thing rendered that is not there.
   */
  includeUnanswered?: boolean;
}

/**
 * What she can curate, work first. `curates_to` parameters are excluded: a
 * client's idea is not a fact about them, it becomes a seed in the Engine
 * (spec 22 §7.5), and that is its one home.
 */
export function curationQueue(body: ProfileBody, options: QueueOptions = {}): QueueItem[] {
  const items = PARAMETERS.filter(p => !p.curates_to).map(p => {
    const answers = answersFor(body, p.id).length;
    const curated = !!readCurated(body, p.id);
    return { id: p.id, label: p.label, curated, answers, waiting: !curated && answers > 0 };
  });

  const keep = items.filter(i =>
    i.waiting || i.curated || i.answers > 0 || options.includeUnanswered === true);

  const rank = (i: QueueItem) => (i.waiting ? 0 : i.curated ? 2 : 1);
  return keep
    .map((item, index) => ({ item, index }))
    .sort((a, b) => rank(a.item) - rank(b.item) || a.index - b.index)
    .map(x => x.item);
}

export function curationProgress(queue: QueueItem[]): { done: number; total: number; line: string } {
  const done = queue.filter(i => i.curated).length;
  const total = queue.length;
  if (total === 0) return { done, total, line: 'Nothing has come back to curate yet.' };
  return { done, total, line: `${done} of ${total} written.` };
}

/** The parameter the screen opens on: what she asked for, else the next job. */
export function selectParameter(queue: QueueItem[], requested?: string | null): string | null {
  if (requested && queue.some(i => i.id === requested)) return requested;
  return queue.find(i => i.waiting)?.id ?? queue[0]?.id ?? null;
}

/** The next one still waiting on her, after the one she is on. Null when done. */
export function nextParameter(queue: QueueItem[], currentId: string | null): string | null {
  const waiting = queue.filter(i => i.waiting && i.id !== currentId);
  if (waiting.length === 0) return null;
  const at = queue.findIndex(i => i.id === currentId);
  const after = queue.slice(at + 1).find(i => i.waiting && i.id !== currentId);
  return (after ?? waiting[0]).id;
}

/**
 * §7.5's one lane that is not curated here. Rendered only when there are any,
 * because an empty box explaining an empty box is the thing the structure is
 * meant to have removed.
 */
export function clientIdeas(body: ProfileBody): AnswerLine[] {
  return answersFor(body, 'client-ideas').map(answerLine);
}

/** Whether the Curation screen exists at all for this profile. */
export function hasCuration(body: ProfileBody, options: QueueOptions = {}): boolean {
  return curationQueue(body, options).length > 0;
}
