// A round made from the blank Facts boxes — intake the way she asked for it on
// 2026-08-09: "maybe you can keep an option of having a questionnaire that I
// can fill in, and then this information can be saved."
//
// The questionnaire is built FROM THE GAPS. One question per blank fact, in the
// exact wording the Facts page shows her, never the parameter bank's. A fact
// she has already filled is never asked. The round then travels the ordinary
// intake road: same client link, same answer records, same permanence.
//
// Pure, relative extensioned imports, no clock: `now` is injected.

import type { ProfileBody } from '../tree/body.ts';
import { putEntry, readPath } from '../tree/body.ts';
import type { IntakeRound } from '../tree/objects.ts';
import type { GeneratedQuestion } from './generate.ts';
import {
  ANSWERS_PATH, INTAKE_PATH, QUESTIONS_PATH, readAnswers, readRounds,
} from './rounds.ts';
import type { FactsCount } from '../strategy/facts.ts';
import { FACT_NAMES } from '../strategy/facts.ts';

export type FactName = (typeof FACT_NAMES)[number];

/**
 * How each fact is asked, in words a client reads. `lands` says whether an
 * answer can go straight into the box with one tap (free text) or arrives as
 * their words for her to apply by hand (a list, a number, a kit).
 */
export const FACT_ASKS: Record<FactName, { question: string; lands: 'box' | 'her-hands' }> = {
  Positioning: { question: 'What do you do, and for whom?', lands: 'box' },
  Audience: { question: 'Who are you talking to? Describe the people you want to reach.', lands: 'box' },
  Voice: { question: 'How do you talk to your customers? Formal, playful, direct? Say it how you would say it.', lands: 'box' },
  Pillars: { question: 'What topics should your page keep coming back to?', lands: 'her-hands' },
  Platforms: { question: 'Where do you post today, and where do you want to be?', lands: 'her-hands' },
  Cadence: { question: 'How many posts a month feels right to you?', lands: 'her-hands' },
  Goals: { question: 'What would make this work feel successful to you?', lands: 'her-hands' },
  Look: { question: 'Describe your colours, fonts, and the look you want. Links help.', lands: 'her-hands' },
};

/** The stable id an asked fact travels under. Never a bank parameter id. */
export function factParameterId(fact: FactName): string {
  return `fact.${fact.toLowerCase()}`;
}

function factOf(parameterId: string): FactName | null {
  if (!parameterId.startsWith('fact.')) return null;
  const name = parameterId.slice('fact.'.length);
  return FACT_NAMES.find(f => f.toLowerCase() === name) ?? null;
}

/**
 * Open AND send a round asking exactly the given blank facts. The two are one
 * move here because a facts round carries her own wording from the page, so
 * §4 rule 1 (no draft wording goes out) is satisfied by construction.
 *
 * Every active round before it moves to history, exactly as `openRound` does:
 * one live round at a time is the rounds screen's standing rule.
 */
export function openFactsRound(
  body: ProfileBody, facts: FactName[], now: string,
): { body: ProfileBody; round: IntakeRound } {
  if (facts.length === 0) throw new Error('[intake] a facts round needs at least one blank fact');

  const version = Math.max(0, ...readRounds(body).map(r => r.version)) + 1;

  let next = body;
  for (const e of readPath(next, INTAKE_PATH)) {
    if (e.state !== 'active') continue;
    next = putEntry(next, INTAKE_PATH, {
      id: e.id, type: e.type, data: e.data, state: 'history',
    }, { writer: 'owner', now });
  }

  const round: IntakeRound = {
    id: `round-${version}`,
    version,
    parameters: facts.map(factParameterId),
    delivery: 'dashboard-questionnaire',
    status: 'sent',
    curation: {},
    opened_at: now,
  };

  next = putEntry(next, INTAKE_PATH, {
    id: round.id, type: 'intake_round', data: round as unknown as Record<string, unknown>,
  }, { writer: 'owner', now });

  for (const fact of facts) {
    const q: GeneratedQuestion = {
      id: `q${version}-${factParameterId(fact)}`,
      parameter_id: factParameterId(fact),
      parameter_path: 'context/business-details',
      text: FACT_ASKS[fact].question,
      shape: 'long-text',
      options: [],
      free_text_lane: null,
      round_version: version,
      vocabulary_draft: false,
    };
    next = putEntry(next, QUESTIONS_PATH, {
      id: q.id, type: 'question', data: q as unknown as Record<string, unknown>,
    }, { writer: 'owner', now });
  }

  return { body: next, round };
}

export interface FactAnswer {
  fact: FactName;
  /** Their words, exactly as they arrived. */
  value: string;
  by: string;
  at: string;
  /** True when the box can take it with one tap. */
  landsInBox: boolean;
}

/**
 * The latest raw answer per fact, for the Facts page to show under the blank
 * box it was asked for. Reading only: accepting one is her tap, and the tap
 * writes through the box's own save, never here.
 */
export function factAnswers(body: ProfileBody | undefined): Partial<Record<FactName, FactAnswer>> {
  const out: Partial<Record<FactName, FactAnswer>> = {};
  if (!body) return out;
  for (const a of readAnswers(body)) {
    if (a.kind !== 'answer' || !a.value.trim()) continue;
    const fact = factOf(a.parameter_id);
    if (!fact) continue;
    const seen = out[fact];
    if (seen && seen.at > a.at) continue;
    out[fact] = { fact, value: a.value, by: a.by, at: a.at, landsInBox: FACT_ASKS[fact].lands === 'box' };
  }
  return out;
}

/** Which blanks are worth asking: every missing fact, in the page's order. */
export function askableBlanks(count: FactsCount): FactName[] {
  return count.missing.filter((m): m is FactName => (FACT_NAMES as readonly string[]).includes(m));
}
