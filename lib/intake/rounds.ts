// Intake rounds — spec 22 §5. Owner-triggered, versioned (S10).
//
// The round record lives at context/intake and declares `fed_by: ['owner']`:
// a client submitting answers writes ONLY context/intake/answers, and the
// round's status is computed from the answers (§5.2). No client action ever
// writes the round object, which is the cleanest reading of the four-doors rule.

import type { ProfileBody } from '../tree/body.ts';
import { putEntry, readPath } from '../tree/body.ts';
import type { IntakeRound } from '../tree/objects.ts';
import type { SwitchConfig } from '../tree/contract.ts';
import { blockedFromSending, generateRound, type GeneratedQuestion } from './generate.ts';
import { computeStatus, type AnswerRecord, type RoundView } from './status.ts';

export const INTAKE_PATH = 'context/intake';
export const QUESTIONS_PATH = 'context/intake/questions';
export const ANSWERS_PATH = 'context/intake/answers';

export function readRounds(body: ProfileBody): IntakeRound[] {
  return readPath(body, INTAKE_PATH)
    .map(e => e.data as unknown as IntakeRound)
    .sort((a, b) => a.version - b.version);
}

/**
 * Spec 33 §2 put DOCUMENTS at this address too, because a document handed over
 * during intake is exactly what this folder is for: raw material the client
 * gave, never altered. They are not answers, so they are filtered out here
 * rather than every caller having to know.
 *
 * `lib/intake/documents.ts` reads the same folder for the other half. One
 * address, two readers, and neither pretends to be the other.
 */
function isDocument(d: Record<string, unknown>): boolean {
  return d.record === 'document';
}

export function readAnswers(body: ProfileBody): AnswerRecord[] {
  return readPath(body, ANSWERS_PATH).filter(e => !isDocument(e.data as Record<string, unknown>)).map(e => {
    const d = e.data as Record<string, unknown>;
    return {
      id: e.id,
      parameter_id: (d.parameter_id as string) ?? '',
      round_version: typeof d.round === 'number' ? (d.round as number) : (d.round_version as number) ?? 0,
      kind: (d.kind as 'answer' | 'skipped') ?? 'answer',
      value: (d.answer as string) ?? (d.value as string) ?? '',
      by: (d.by as string) ?? 'unknown',
      at: e.created_at,
      source: (d.source as string) ?? '',
    };
  });
}

export function readQuestions(body: ProfileBody, version?: number): GeneratedQuestion[] {
  return readPath(body, QUESTIONS_PATH)
    .map(e => e.data as unknown as GeneratedQuestion)
    .filter(q => version === undefined || q.round_version === version);
}

export interface OpenRoundInput {
  parameters?: string[];
  delivery: IntakeRound['delivery'];
  config: SwitchConfig;
  platforms?: string[];
  now: string;
}

/** Open a round: pick parameters (default everything not yet curated),
 *  generate its questions, and record it at `not sent`. */
export function openRound(
  body: ProfileBody, input: OpenRoundInput & { curated?: string[] },
): { body: ProfileBody; round: IntakeRound; skipped: { parameter_id: string; why: string }[] } {
  const existing = readRounds(body);
  const version = existing.length ? Math.max(...existing.map(r => r.version)) + 1 : 1;
  const generated = generateRound({
    parameters: input.parameters, config: input.config, curated: input.curated,
    platforms: input.platforms, version,
  });

  // Everything older moves to history: readable forever, accepting no writes (S9).
  let next = archivePreviousRounds(body, input.now);

  const round: IntakeRound = {
    id: `round-${version}`,
    version,
    parameters: generated.parameters,
    delivery: input.delivery,
    status: 'not-sent',
    curation: {},
    opened_at: input.now,
  };
  next = putEntry(next, INTAKE_PATH, {
    id: round.id, type: 'intake_round', data: round as unknown as Record<string, unknown>,
  }, { writer: 'owner', now: input.now });

  for (const q of generated.questions) {
    next = putEntry(next, QUESTIONS_PATH, {
      id: q.id, type: 'question', data: q as unknown as Record<string, unknown>,
    }, { writer: 'owner', now: input.now });
  }

  return { body: next, round, skipped: generated.skipped };
}

/**
 * Close every open round, in the DATA as well as in the entry state.
 *
 * 2026-08-11, and this was a real bug found by a test on the form builder.
 * Archiving used to set the entry's state to 'history' and leave the round's
 * own `status` saying 'sent'. `readRounds` reads the data and does not look at
 * entry state, so anything asking "which round is open?" saw every round ever
 * sent, and took the FIRST. Sending a second questionnaire would have left her
 * screen showing the first one, with the client answering the second.
 *
 * One helper, used by every sender, so the two facts cannot disagree again.
 */
export function closeOpenRounds(body: ProfileBody, now: string): ProfileBody {
  let next = body;
  for (const e of readPath(next, INTAKE_PATH)) {
    if (e.state !== 'active') continue;
    const round = e.data as unknown as IntakeRound;
    if (!round || typeof round.version !== 'number') continue;   // documents live here too
    next = putEntry(next, INTAKE_PATH, {
      id: e.id,
      type: e.type,
      data: { ...round, status: 'curated' } as unknown as Record<string, unknown>,
      state: 'history',
    }, { writer: 'owner', now });
  }
  return next;
}

function archivePreviousRounds(body: ProfileBody, now: string): ProfileBody {
  let next = body;
  for (const e of readPath(next, INTAKE_PATH)) {
    if (e.state !== 'active') continue;
    next = putEntry(next, INTAKE_PATH, {
      id: e.id, type: e.type, data: e.data, state: 'history',
    }, { writer: 'owner', now });
  }
  return next;
}

/**
 * §4 rule 1: no round goes to a client while any parameter in it still carries
 * Claude's wording. Her vocabulary pass flips a parameter to `hers`; nothing
 * else waits on it.
 */
export function sendRound(
  body: ProfileBody, roundId: string, now: string,
): { body: ProfileBody } | { blocked: string[] } {
  const entry = readPath(body, INTAKE_PATH).find(e => e.id === roundId);
  if (!entry) throw new Error(`[intake] no round ${roundId}`);
  const round = entry.data as unknown as IntakeRound;
  const blocked = blockedFromSending(round.parameters);
  if (blocked.length) return { blocked };
  const sent: IntakeRound = { ...round, status: 'sent' };
  return {
    body: putEntry(body, INTAKE_PATH, {
      id: roundId, type: 'intake_round', data: sent as unknown as Record<string, unknown>,
    }, { writer: 'owner', now }),
  };
}

export interface FileAnswerInput {
  round: number;
  parameter_id: string;
  kind?: 'answer' | 'skipped';
  value: string;
  by: string;
  /** `finding-session:<asset id>` plus the transcript reference, or the round. */
  source: string;
  now: string;
  writer?: 'owner' | 'client';
}

/** Raw answers are append-only and never altered (S11). A second write on the
 *  same id throws; a correction is a NEW answer in a NEW round (§6). */
export function fileAnswer(body: ProfileBody, input: FileAnswerInput): ProfileBody {
  const id = `a${input.round}-${input.parameter_id}-${input.by}`;
  return putEntry(body, ANSWERS_PATH, {
    id, type: 'answer',
    data: {
      round: input.round, parameter_id: input.parameter_id, kind: input.kind ?? 'answer',
      answer: input.value, by: input.by, source: input.source,
    },
  }, { writer: input.writer ?? 'owner', now: input.now });
}

/** The stored status mirrors the function and is refreshed on any owner-side
 *  read or write of the round (§5.2). */
export function refreshRounds(body: ProfileBody, now: string): ProfileBody {
  const answers = readAnswers(body);
  let next = body;
  for (const e of readPath(body, INTAKE_PATH)) {
    if (e.state !== 'active') continue;
    const round = e.data as unknown as IntakeRound;
    const view: RoundView = {
      version: round.version, parameters: round.parameters,
      sent: round.status !== 'not-sent', curation: round.curation ?? {},
    };
    const status = computeStatus(view, answers);
    if (status === round.status) continue;
    next = putEntry(next, INTAKE_PATH, {
      id: e.id, type: 'intake_round',
      data: { ...round, status } as unknown as Record<string, unknown>,
    }, { writer: 'owner', now });
  }
  return next;
}

/** Record her curation decision for one parameter on the round that asked it. */
export function markCurated(
  body: ProfileBody, parameterId: string, now: string, by = 'owner',
): ProfileBody {
  let next = body;
  for (const e of readPath(body, INTAKE_PATH)) {
    if (e.state !== 'active') continue;
    const round = e.data as unknown as IntakeRound;
    if (!round.parameters.includes(parameterId)) continue;
    const curation = { ...(round.curation ?? {}), [parameterId]: { curated: true, at: now, by } };
    next = putEntry(next, INTAKE_PATH, {
      id: e.id, type: 'intake_round',
      data: { ...round, curation } as unknown as Record<string, unknown>,
    }, { writer: 'owner', now });
  }
  return refreshRounds(next, now);
}

/**
 * §5.5 — reopening. A new round is born at version = last + 1 holding only the
 * parameters she selected, with its own delivery mode and its own status. The
 * new answer never edits the old one: it supersedes at the CURATED level, and
 * both readings stay legible.
 */
export function reopenRound(
  body: ProfileBody, parameters: string[], delivery: IntakeRound['delivery'],
  config: SwitchConfig, now: string, platforms?: string[],
): { body: ProfileBody; round: IntakeRound } {
  const { body: next, round } = openRound(body, { parameters, delivery, config, platforms, now });
  return { body: next, round };
}
