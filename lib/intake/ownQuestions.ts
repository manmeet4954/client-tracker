// Her own questions, and what a meeting produced — 2026-08-11.
//
// TWO GAPS, ONE OF THEM MINE.
//
// She asked plainly: "if I want to build a questionnaire for a client, or if I
// want to add the meeting insights for the client, or I want to take intake in
// any sort of format, will I be able to do that in the intake tab?"
//
//   1. HER OWN QUESTIONNAIRE never existed. Intake could send the eight blank
//      facts, or a round drawn from a 53-parameter bank nobody chose. There was
//      no way for her to write a question and ask it. That is a strange hole in
//      a system whose whole job is collecting what a client knows.
//   2. MEETING INSIGHTS existed and I removed them. Filing what was said in a
//      recorded meeting lived only on the Rounds screen, and when Rounds came
//      off Intake that route went with it. A regression, named as one.
//
// Both land in the SAME records everything else does: an intake round, its
// questions, and answers against those questions. Nothing here invents storage.
// A question she wrote is a question; an answer from a meeting is an answer
// whose `by` says it came from her, in a meeting, rather than from the client
// typing it. That distinction is kept because it is real, and because a claim
// about a brand should carry where it came from.
//
// Pure: `now` and ids are injected, no clock, no React.

import type { ProfileBody } from '../tree/body.ts';
import { putEntry, readPath } from '../tree/body.ts';
import type { IntakeRound } from '../tree/objects.ts';
import type { GeneratedQuestion } from './generate.ts';
import { ANSWERS_PATH, INTAKE_PATH, QUESTIONS_PATH, readAnswers, readRounds, closeOpenRounds } from './rounds.ts';

/** The prefix a question SHE wrote travels under, so it is never confused with
 *  a bank parameter or one of the eight facts. */
export const OWN_PREFIX = 'own.';

export function ownParameterId(index: number, version: number): string {
  return `${OWN_PREFIX}v${version}-q${index + 1}`;
}

export function isOwnQuestion(parameterId: string): boolean {
  return parameterId.startsWith(OWN_PREFIX);
}

export interface OwnRoundResult {
  body: ProfileBody;
  round: IntakeRound;
}

/**
 * Open and send a round of HER questions.
 *
 * Sent in one move, like a facts round and for the same reason: the wording is
 * already hers, so §4 rule 1 (no draft wording reaches a client) is satisfied
 * by construction. There is nobody left to approve the words she wrote.
 *
 * Blank lines are dropped rather than sent as empty questions.
 */
export function openOwnRound(
  body: ProfileBody, questions: string[], now: string,
): OwnRoundResult {
  const asked = questions.map(q => q.trim()).filter(Boolean);
  if (asked.length === 0) throw new Error('[intake] a round needs at least one question');

  const version = Math.max(0, ...readRounds(body).map(r => r.version)) + 1;

  // One open round at a time, closed in the data as well as the state.
  let next = closeOpenRounds(body, now);

  const parameters = asked.map((_, i) => ownParameterId(i, version));
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

  asked.forEach((text, i) => {
    const q: GeneratedQuestion = {
      id: `q${version}-${parameters[i]}`,
      parameter_id: parameters[i],
      // Her questions are not bank parameters and curate to nothing on their
      // own. The path names where a reader would look, not a promise that
      // anything derives from it.
      parameter_path: 'context/business-details',
      text,
      shape: 'long-text',
      options: [],
      free_text_lane: null,
      round_version: version,
      vocabulary_draft: false,
    };
    next = putEntry(next, QUESTIONS_PATH, {
      id: q.id, type: 'question', data: q as unknown as Record<string, unknown>,
    }, { writer: 'owner', now });
  });

  return { body: next, round };
}

export interface OwnAnswer {
  parameterId: string;
  question: string;
  value: string;
  by: string;
  at: string;
}

/** What came back against her own questions, newest per question. */
export function readOwnAnswers(body: ProfileBody): OwnAnswer[] {
  const questions = new Map<string, string>();
  for (const e of readPath(body, QUESTIONS_PATH)) {
    const q = e.data as unknown as GeneratedQuestion;
    if (isOwnQuestion(q.parameter_id)) questions.set(q.parameter_id, q.text);
  }

  const latest = new Map<string, OwnAnswer>();
  for (const a of readAnswers(body)) {
    if (a.kind !== 'answer' || !a.value.trim()) continue;
    if (!isOwnQuestion(a.parameter_id)) continue;
    const seen = latest.get(a.parameter_id);
    if (seen && seen.at > a.at) continue;
    latest.set(a.parameter_id, {
      parameterId: a.parameter_id,
      question: questions.get(a.parameter_id) ?? 'A question you asked',
      value: a.value,
      by: a.by,
      at: a.at,
    });
  }
  return [...latest.values()];
}

/** The questions she asked in the open round, answered or not. */
export function openOwnQuestions(body: ProfileBody): { parameterId: string; text: string }[] {
  const open = readRounds(body).find(r => r.status === 'sent');
  if (!open) return [];
  const out: { parameterId: string; text: string }[] = [];
  for (const e of readPath(body, QUESTIONS_PATH)) {
    const q = e.data as unknown as GeneratedQuestion;
    if (q.round_version === open.version && isOwnQuestion(q.parameter_id)) {
      out.push({ parameterId: q.parameter_id, text: q.text });
    }
  }
  return out;
}

// ── What a meeting produced ──────────────────────────────────────────────────

export interface MeetingNoteInput {
  /** Her own heading for it, e.g. "Call with Sanat, 11 Aug". */
  title: string;
  /** What was said. Kept exactly as she wrote it. */
  text: string;
  /** Who said it, in her words. Falls back to the profile. */
  said_by?: string;
  now: string;
  /** Injected so this stays pure. */
  id: string;
}

/**
 * File what a meeting produced.
 *
 * It is stored as an ANSWER, against a question that records the meeting's own
 * title, in its own round. That sounds indirect and is the honest shape: a
 * meeting insight IS an answer about the brand which nobody typed into a form,
 * and storing it as one means it reads back beside everything else rather than
 * in a second place she has to remember to look.
 *
 * `by` carries her name and the word meeting, so a claim traced later says
 * where it came from. PLAN §5.1: a capture is kept exactly as given, forever.
 */
export function fileMeetingNote(body: ProfileBody, input: MeetingNoteInput): ProfileBody {
  const text = input.text.trim();
  if (!text) throw new Error('[intake] a meeting note needs something that was said');

  const version = Math.max(0, ...readRounds(body).map(r => r.version)) + 1;
  const parameterId = `${OWN_PREFIX}meeting-${input.id}`;
  const title = input.title.trim() || 'A meeting';

  let next = body;

  // A meeting round is opened ALREADY CURATED: nobody is being asked anything,
  // so it must not sit in the way of a real open round or look like one.
  const round: IntakeRound = {
    id: `round-${version}`,
    version,
    parameters: [parameterId],
    delivery: 'finding-session',
    status: 'curated',
    curation: {},
    opened_at: input.now,
  };
  next = putEntry(next, INTAKE_PATH, {
    id: round.id, type: 'intake_round', data: round as unknown as Record<string, unknown>,
  }, { writer: 'owner', now: input.now });

  const q: GeneratedQuestion = {
    id: `q${version}-${parameterId}`,
    parameter_id: parameterId,
    parameter_path: 'context/business-details',
    text: title,
    shape: 'long-text',
    options: [],
    free_text_lane: null,
    round_version: version,
    vocabulary_draft: false,
  };
  next = putEntry(next, QUESTIONS_PATH, {
    id: q.id, type: 'question', data: q as unknown as Record<string, unknown>,
  }, { writer: 'owner', now: input.now });

  next = putEntry(next, ANSWERS_PATH, {
    id: `a${version}-${parameterId}`,
    type: 'answer',
    data: {
      id: `a${version}-${parameterId}`,
      round_version: version,
      parameter_id: parameterId,
      kind: 'answer',
      value: text,
      by: input.said_by?.trim() ? `${input.said_by.trim()} (meeting)` : 'meeting',
      at: input.now,
      source: `finding-session:round-${version}`,
    } as unknown as Record<string, unknown>,
  }, { writer: 'owner', now: input.now });

  return next;
}

export interface MeetingNote {
  id: string;
  title: string;
  text: string;
  by: string;
  at: string;
}

/** Every meeting filed on this profile, newest first. */
export function readMeetingNotes(body: ProfileBody): MeetingNote[] {
  const titles = new Map<string, string>();
  for (const e of readPath(body, QUESTIONS_PATH)) {
    const q = e.data as unknown as GeneratedQuestion;
    if (q.parameter_id.startsWith(`${OWN_PREFIX}meeting-`)) titles.set(q.parameter_id, q.text);
  }
  const out: MeetingNote[] = [];
  for (const a of readAnswers(body)) {
    if (!a.parameter_id.startsWith(`${OWN_PREFIX}meeting-`)) continue;
    if (a.kind !== 'answer') continue;
    out.push({
      id: a.parameter_id,
      title: titles.get(a.parameter_id) ?? 'A meeting',
      text: a.value,
      by: a.by,
      at: a.at,
    });
  }
  return out.sort((x, y) => (x.at < y.at ? 1 : -1));
}
