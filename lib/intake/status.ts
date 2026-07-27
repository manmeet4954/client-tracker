// The intake status flow — spec 22 §5.2.
//
//   not sent → sent → answered → curated   (PLAN §3.1's four words, exactly)
//
// Status is COMPUTED, never client-written. This matters for S19: the round
// record at context/intake declares `fed_by: ['owner']`, so a client
// submitting answers writes only context/intake/answers, and the round's
// status is a function of the round, its answers and her curation. No client
// action ever writes the round object. It is the cleanest reading of the
// four-doors rule and it needs no new machinery.

import type { IntakeStatus, IntakeRound } from '../tree/objects.ts';

/** One raw answer entry at context/intake/answers. Never altered (S11). */
export interface AnswerRecord {
  id: string;
  parameter_id: string;
  round_version: number;
  /** "They refused to say" is knowledge; a blank is not (§5.2). */
  kind: 'answer' | 'skipped';
  value: string;
  /** Who answered. A profile may have several client users (PLAN §11 Q3). */
  by: string;
  at: string;
  /** finding-session:<asset id>, or the round it was typed into. */
  source: string;
}

export interface RoundView {
  version: number;
  parameters: string[];
  sent: boolean;
  curation: Record<string, { curated: boolean; at?: string; by?: string }>;
}

/**
 * status(round, answers, curation), exactly as §5.2 writes it.
 *
 *   not sent   if she has not sent it
 *   sent       if sent and any parameter has neither an answer nor a skip
 *   answered   if every parameter has an answer or a skip, and curation is incomplete
 *   curated    if every parameter in the round has a curation decision
 */
export function computeStatus(round: RoundView, answers: AnswerRecord[]): IntakeStatus {
  if (!round.sent) return 'not-sent';
  const answered = new Set(
    answers.filter(a => a.round_version === round.version).map(a => a.parameter_id),
  );
  const allAnswered = round.parameters.every(p => answered.has(p));
  if (!allAnswered) return 'sent';
  const allCurated = round.parameters.every(p => round.curation[p]?.curated === true);
  return allCurated ? 'curated' : 'answered';
}

/** The parameters still waiting on the client. Partial answers are normal. */
export function unanswered(round: RoundView, answers: AnswerRecord[]): string[] {
  const answered = new Set(
    answers.filter(a => a.round_version === round.version).map(a => a.parameter_id),
  );
  return round.parameters.filter(p => !answered.has(p));
}

/** The parameters answered but not yet curated by her. */
export function awaitingCuration(round: RoundView, answers: AnswerRecord[]): string[] {
  const answered = new Set(
    answers.filter(a => a.round_version === round.version).map(a => a.parameter_id),
  );
  return round.parameters.filter(p => answered.has(p) && round.curation[p]?.curated !== true);
}

/** The stored round object, refreshed from the function (§5.2). */
export function refreshRound(round: IntakeRound, answers: AnswerRecord[]): IntakeRound {
  const view: RoundView = {
    version: round.version,
    parameters: round.parameters,
    sent: round.status !== 'not-sent',
    curation: round.curation ?? {},
  };
  const status = computeStatus(view, answers);
  return status === round.status ? round : { ...round, status };
}

/**
 * §5.6 — retirement, and the quiet done. When EVERY round of a profile is at
 * `curated`, the Intake app stops being navigation on both sides. Reopening a
 * round returns it to active; nothing is ever deleted (S9, S10).
 */
export function intakeRetired(rounds: IntakeRound[]): boolean {
  return rounds.length > 0 && rounds.every(r => r.status === 'curated');
}
