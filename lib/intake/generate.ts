// Question generation — spec 22 §5.3.
//
// Questions are GENERATED from the detail folders' parameters, never authored
// inside intake (PLAN §3.1). Add a parameter to business-details/market
// tomorrow and it appears in the next round with no code change (law 3);
// nobody edits a questionnaire.
//
// Questions are SNAPSHOTS. A round's questions never change after it is sent,
// even if the registry changes; the next round regenerates. That is what
// `versioned` means at this path, and it is what makes an old answer readable
// years later.

import type { SwitchConfig } from '../tree/contract.ts';
import { pathState, platformSwitchId, effectiveState } from '../tree/switches.ts';
import type { ParameterRecord, ParameterShape } from './parameters.ts';
import {
  PARAMETERS, FREE_TEXT_LANE, findParameter, findVocabularyList,
} from './parameters.ts';

export interface GeneratedQuestion {
  /** Entry id at context/intake/questions. */
  id: string;
  parameter_id: string;
  /** The parameter's declared folder, carried so a question always resolves. */
  parameter_path: string;
  text: string;
  shape: ParameterShape;
  also?: ParameterShape;
  fields?: string[];
  /** The options as they stand TODAY. A snapshot, like the wording. */
  options: string[];
  /** Every list ships a free-text lane (§4.7). */
  free_text_lane: string | null;
  round_version: number;
  /** True while this parameter still carries Claude's wording (§4 rule 1). */
  vocabulary_draft: boolean;
}

export interface SkippedParameter {
  parameter_id: string;
  why: string;
}

export interface GenerateInput {
  /** Chosen parameter ids. Default: everything not yet curated. */
  parameters?: string[];
  /** Her switch positions for this profile — the cascade reaches questions. */
  config: SwitchConfig;
  /** Parameter ids that already carry a curated value. */
  curated?: string[];
  /** The platforms this profile has entries for. */
  platforms?: string[];
  version: number;
}

export interface GenerateResult {
  questions: GeneratedQuestion[];
  skipped: SkippedParameter[];
  /** The parameter ids the round asks for. Ids, never question text (§5.1). */
  parameters: string[];
}

/** The platforms that are actually live for this profile right now. */
export function activePlatforms(platforms: string[], config: SwitchConfig): string[] {
  return platforms.filter(p => effectiveState(platformSwitchId(p), config) === 'active');
}

function optionsFor(p: ParameterRecord, platforms: string[]): string[] {
  if (p.options_from === 'platforms') return platforms;
  if (!p.options) return [];
  const list = findVocabularyList(p.options);
  return list ? [...list.values] : [];
}

/**
 * Generate one round's questions.
 *
 * Per parameter, in the spec's order: read the record, refuse an
 * owner-observed parameter, refuse a parameter whose declared path is not
 * active for this profile, refuse a parameter that belongs to a platform this
 * profile switched off. Nothing dormant ever asks to be filled in (PLAN §3.4).
 *
 * A `vocabulary: draft` parameter is still generated — she may read and edit a
 * round on her own side — but it is MARKED, and §5.2's send refuses while any
 * marked parameter is in the round (§4 rule 1, §16).
 */
export function generateRound(input: GenerateInput): GenerateResult {
  const curated = new Set(input.curated ?? []);
  const platforms = activePlatforms(input.platforms ?? [], input.config);
  const chosen = input.parameters
    ? input.parameters.map(findParameter).filter((p): p is ParameterRecord => !!p)
    : PARAMETERS.filter(p => !curated.has(p.id));

  const questions: GeneratedQuestion[] = [];
  const skipped: SkippedParameter[] = [];

  for (const p of chosen) {
    if (p.asked_of === 'owner-observed') {
      skipped.push({ parameter_id: p.id, why: 'she fills this one, it is never asked' });
      continue;
    }
    if (pathState(p.path, input.config) !== 'active') {
      skipped.push({ parameter_id: p.id, why: `its folder ${p.path} is not active for this profile` });
      continue;
    }
    if (p.platform && effectiveState(platformSwitchId(p.platform), input.config) !== 'active') {
      skipped.push({ parameter_id: p.id, why: `${p.platform} is switched off for this profile` });
      continue;
    }
    questions.push({
      id: `q${input.version}-${p.id}`,
      parameter_id: p.id,
      parameter_path: p.path,
      text: p.question,
      shape: p.shape,
      also: p.also,
      fields: p.fields,
      options: optionsFor(p, platforms),
      free_text_lane: p.shape === 'single-select' || p.shape === 'multi-select' || p.also === 'multi-select'
        ? FREE_TEXT_LANE : null,
      round_version: input.version,
      vocabulary_draft: p.vocabulary === 'draft',
    });
  }

  return { questions, skipped, parameters: questions.map(q => q.parameter_id) };
}

/**
 * §4 rule 1, made mechanical: no round goes to a client while any parameter in
 * it is `vocabulary: draft`. Returns the parameters blocking the send.
 */
export function blockedFromSending(parameterIds: string[]): string[] {
  return parameterIds.filter(id => findParameter(id)?.vocabulary === 'draft');
}

export function mayBeSent(parameterIds: string[]): boolean {
  return blockedFromSending(parameterIds).length === 0;
}
