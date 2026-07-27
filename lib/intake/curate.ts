// The curation pass — spec 22 §7.
//
// PLAN §3.1: "her curation pass, which writes personal-details and
// business-details. The client never writes those folders directly."
//
// She works PARAMETER by parameter, not answer by answer. That is the direction
// that matters: the folders are the truth, and answers are evidence for them.
//
// The rule this file enforces: NO CURATED VALUE WITHOUT ITS SOURCE. That is
// what makes it possible, two years later, to ask "why does this brand never
// say hustle?" and get an actual sentence from an actual call as the answer.

import type { ProfileBody } from '../tree/body.ts';
import { putEntry, readPath, supersedeEntry } from '../tree/body.ts';
import type { Confidence, CuratedParameter, Provenance } from '../tree/objects.ts';
import { findDeclaration } from '../tree/declarations.ts';
import { PARAMETERS, findParameter } from './parameters.ts';
import { readAnswers } from './rounds.ts';
import type { AnswerRecord } from './status.ts';

export interface CurateInput {
  parameter_id: string;
  value: CuratedParameter['value'];
  /** Answer entry ids, or `owner-direct:<note>` on one of HER profiles (§7.4). */
  source_refs: string[];
  curator: string;
  confidence: Confidence;
  now: string;
}

export class CurationRefused extends Error {}

/**
 * Write one curated value. Refuses without provenance; supersedes rather than
 * edits, so the old reading stays legible (§7.2, §7.3).
 */
export function curateParameter(body: ProfileBody, input: CurateInput): ProfileBody {
  const p = findParameter(input.parameter_id);
  if (!p) throw new CurationRefused(`no parameter "${input.parameter_id}" in the inventory`);
  if (p.curates_to) {
    throw new CurationRefused(
      `"${p.id}" is not a context parameter: she reads the idea and births a seed from it (§7.5)`,
    );
  }
  if (!input.source_refs.length) {
    throw new CurationRefused('no curated value without its source (S11): source_refs is empty');
  }
  if (!input.curator) throw new CurationRefused('no curated value without a curator (S11)');
  if (!input.confidence) throw new CurationRefused('no curated value without a confidence state (S11)');

  const dec = findDeclaration(p.path);
  if (!dec) throw new CurationRefused(`no address, no write: "${p.path}"`);

  const provenance: Provenance = {
    source_refs: input.source_refs, curator: input.curator, at: input.now, confidence: input.confidence,
  };
  const value: CuratedParameter = { id: p.id, key: p.id, value: input.value, provenance };
  const previous = readPath(body, p.path).find(e => e.id === p.id && e.state === 'active');

  if (previous) {
    return supersedeEntry(body, p.path, p.id, {
      id: `${p.id}@${input.now}`, type: dec.entry_type,
      data: value as unknown as Record<string, unknown>, provenance,
    }, { writer: 'owner', now: input.now, provenance });
  }
  return putEntry(body, p.path, {
    id: p.id, type: dec.entry_type, data: value as unknown as Record<string, unknown>, provenance,
  }, { writer: 'owner', now: input.now, provenance });
}

/** The active curated value for one parameter, if she has curated it. */
export function readCurated(body: ProfileBody, parameterId: string): CuratedParameter | null {
  const p = findParameter(parameterId);
  if (!p) return null;
  const entries = readPath(body, p.path).filter(e => e.state === 'active');
  const hit = entries.find(e => e.id === parameterId)
    ?? entries.filter(e => e.id.startsWith(`${parameterId}@`)).pop();
  return hit ? (hit.data as unknown as CuratedParameter) : null;
}

/** Every version of one curated value, oldest first. Nothing is overwritten. */
export function curationHistory(body: ProfileBody, parameterId: string): CuratedParameter[] {
  const p = findParameter(parameterId);
  if (!p) return [];
  return readPath(body, p.path)
    .filter(e => e.id === parameterId || e.id.startsWith(`${parameterId}@`))
    .map(e => e.data as unknown as CuratedParameter);
}

export function curatedIds(body: ProfileBody): string[] {
  return PARAMETERS.filter(p => !!readCurated(body, p.id)).map(p => p.id);
}

/** The left-hand side of the surface: every answer that touches this
 *  parameter, across every round, in date order, verbatim. Read-only, forever. */
export function answersFor(body: ProfileBody, parameterId: string): AnswerRecord[] {
  return readAnswers(body)
    .filter(a => a.parameter_id === parameterId)
    .sort((a, b) => (a.at < b.at ? -1 : 1));
}

/** §7.4: on a CLIENT profile, a value assembled entirely from her assumptions
 *  is allowed and flagged, because it is a thing she should see at a glance. */
export function ownerDirectOnly(body: ProfileBody, parameterId: string): boolean {
  const c = readCurated(body, parameterId);
  if (!c) return false;
  return c.provenance.source_refs.every(r => r.startsWith('owner-direct:'));
}

export function ownerDirectReport(body: ProfileBody): string[] {
  return PARAMETERS.filter(p => ownerDirectOnly(body, p.id)).map(p => p.id);
}
