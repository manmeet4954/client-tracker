// Topic suggestions from the client — 2026-08-11.
//
// HER LIST for what a client may do: "they can upload references or add topics
// for me." Uploads existed; topics did not.
//
// NO NEW DOOR WAS OPENED FOR THIS, and that is the point of the file. Spec 22
// §7.5 declared the client-ideas lane years of decisions ago: a client who
// brings ideas gives them as intake ANSWERS under the `client-ideas` parameter,
// through the same give:intake door every questionnaire answer uses. A
// suggestion is an answer whose question was standing. This file only gives
// that lane a pair of hands.
//
// Pure: `now` is injected. No clock, no React.

import type { ProfileBody } from '../tree/body.ts';
import { putEntry } from '../tree/body.ts';
import { ANSWERS_PATH, readAnswers, readRounds } from './rounds.ts';

/** §7.5's parameter id, exactly as the inventory declares it. */
export const IDEAS_PARAMETER = 'client-ideas';

export interface TopicSuggestion {
  id: string;
  text: string;
  by: string;
  at: string;
}

/**
 * File one suggestion, as the client (or she, relaying one from a call).
 *
 * It rides the newest round's number so it reads back beside that round's
 * answers, and round 0 when no round has ever been sent: a client may suggest
 * before they were ever asked anything.
 */
export function fileSuggestion(body: ProfileBody, input: {
  text: string;
  by: string;
  now: string;
  writer?: 'owner' | 'client';
}): ProfileBody {
  const text = input.text.trim();
  if (!text) throw new Error('[intake] a suggestion needs words');

  const round = Math.max(0, ...readRounds(body).map(r => r.version));
  const id = `idea-${input.now}-${Math.abs(hash(text)) % 100000}`;
  return putEntry(body, ANSWERS_PATH, {
    id,
    type: 'answer',
    data: {
      id,
      round_version: round,
      parameter_id: IDEAS_PARAMETER,
      kind: 'answer',
      value: text,
      by: input.by,
      at: input.now,
      source: 'topic-suggestion',
    } as unknown as Record<string, unknown>,
  }, { writer: input.writer ?? 'client', now: input.now });
}

/** Every suggestion on the profile, newest first. */
export function readSuggestions(body: ProfileBody): TopicSuggestion[] {
  return readAnswers(body)
    .filter(a => a.parameter_id === IDEAS_PARAMETER && a.kind === 'answer' && a.value.trim())
    .map(a => ({ id: a.id, text: a.value, by: a.by, at: a.at }))
    .sort((x, y) => (x.at < y.at ? 1 : -1));
}

/**
 * Is this suggestion already a card? One rule, used by her intake front
 * ("On the board") and the client's Idea column (a taken suggestion stops
 * rendering separately) — 2026-08-16. Title equality, case-insensitive,
 * exactly as "Topics they suggested" has matched since 08-11.
 */
export function suggestionTaken(text: string, cardTitles: string[]): boolean {
  const t = text.trim().toLowerCase();
  return cardTitles.some(title => title.trim().toLowerCase() === t);
}

/** The suggestions she has not yet taken, newest first. */
export function pendingSuggestions(body: ProfileBody, cardTitles: string[]): TopicSuggestion[] {
  return readSuggestions(body).filter(s => !suggestionTaken(s.text, cardTitles));
}

/** Deterministic, tiny, and only for id uniqueness within one instant. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
