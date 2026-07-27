// Captures — spec 23 §4.
//
// PLAN §5.1, adopted as law: "Every seed stores ALL the raw information it was
// born from, forever."
//
// The capture is written BEFORE the model is called (§4.1 step 3). If the call
// fails, refuses, or the browser dies, what she said is still here and she can
// retry against it. Append-only: never edited, never trimmed, never summarized
// in place.

import type { ProfileBody } from '../tree/body.ts';
import { putEntry, readPath } from '../tree/body.ts';
import type { BodyEntry } from '../tree/objects.ts';

export const CAPTURE_PATH = 'work-log/creation/topics/captures';

/** How it arrived. Recorded because a pasted client message and her own
 *  rambling are different evidence, and the record should know which. */
export type CaptureArrival = 'typed' | 'pasted' | 'from-intake-answer' | 'from-transcript';

export const CAPTURE_ARRIVALS: { id: CaptureArrival; label: string }[] = [
  { id: 'typed', label: 'I typed it' },
  { id: 'pasted', label: 'I pasted it in' },
  { id: 'from-intake-answer', label: 'From something they answered' },
  { id: 'from-transcript', label: 'From a recording' },
];

export interface SeedCapture {
  id: string;
  /** Exactly as she gave it. Byte for byte, forever. */
  text: string;
  at: string;
  arrival: CaptureArrival;
  /** The intake answer id, transcript reference, or whatever it came from. */
  source_ref?: string;
  /** Set when this capture is about an existing seed ("talk more about this one"). */
  seed_id?: string;
}

export class CaptureRefused extends Error {}

export interface CaptureInput {
  id: string;
  text: string;
  arrival: CaptureArrival;
  source_ref?: string;
  seed_id?: string;
}

/**
 * Write one capture. The text is stored exactly as given — no trim, no
 * normalization, no collapse of whitespace. Acceptance test 1 round-trips
 * odd whitespace, emoji and 4,000 words and compares byte for byte.
 */
export function writeCapture(body: ProfileBody, input: CaptureInput, now: string): ProfileBody {
  if (!input.text) throw new CaptureRefused('there is nothing to capture');
  if (readCaptures(body).some(c => c.capture.id === input.id)) {
    throw new CaptureRefused(`capture ${input.id} already exists — a capture is never rewritten`);
  }
  const capture: SeedCapture = {
    id: input.id,
    text: input.text,
    at: now,
    arrival: input.arrival,
    source_ref: input.source_ref,
    seed_id: input.seed_id,
  };
  return putEntry(body, CAPTURE_PATH, {
    id: input.id, type: 'seed_capture', data: capture as unknown as Record<string, unknown>,
  }, { writer: 'owner', now });
}

export interface CaptureRecord {
  entry: BodyEntry;
  capture: SeedCapture;
}

export function readCaptures(body: ProfileBody): CaptureRecord[] {
  return readPath(body, CAPTURE_PATH)
    .map(entry => ({ entry, capture: { ...(entry.data as unknown as SeedCapture), id: entry.id } }))
    .sort((a, b) => (a.capture.at < b.capture.at ? -1 : 1));
}

export function findCapture(body: ProfileBody, id: string): SeedCapture | null {
  return readCaptures(body).find(c => c.capture.id === id)?.capture ?? null;
}

/** Everything talked out about one seed, oldest first (§4.2). */
export function capturesForSeed(body: ProfileBody, seedId: string): SeedCapture[] {
  return readCaptures(body).filter(c => c.capture.seed_id === seedId).map(c => c.capture);
}

/**
 * The write-door guard: a capture that already exists may never be edited.
 * `putEntry` already refuses an overwrite on an append-only path; this catches
 * an edit smuggled in through a whole-body save (acceptance test 1).
 */
export interface CaptureRefusal {
  capture_id: string;
  reason: string;
}

export function refusedCaptureWrites(
  current: ProfileBody | undefined, incoming: ProfileBody | undefined,
): CaptureRefusal[] {
  if (!incoming || !current) return [];
  const out: CaptureRefusal[] = [];
  const before = new Map((current.paths?.[CAPTURE_PATH] ?? []).map(e => [e.id, e]));
  for (const entry of incoming.paths?.[CAPTURE_PATH] ?? []) {
    const was = before.get(entry.id);
    if (!was) continue;                                   // a new capture, fine
    const wasText = (was.data as unknown as SeedCapture).text;
    const nowText = (entry.data as unknown as SeedCapture).text;
    if (wasText !== nowText) {
      out.push({
        capture_id: entry.id,
        reason: 'a capture is kept exactly as it was given, forever. Add a new one instead.',
      });
    }
  }
  return out;
}
