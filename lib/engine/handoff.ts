// The outside-tool handoff contract (S18) — spec 24 §8.3 and §8.4.
//
// PLAN §3.10, her working reality on record: "the creative work often happens
// OUTSIDE the dashboard — design software, video editors, Canva… The making step
// must expect the round-trip: the entry leaves as a brief, the piece comes back
// and attaches to the same entry."
//
// The MANUAL route ships first, and it is not a lesser route. Export produces
// the brief plus the materials list in a form she can paste into any tool, and
// import is a file drop that lands the asset in `assets/sets` and attaches it to
// the piece. That works for Figma, for a video editor, and for a designer on
// WhatsApp — every tool that does not have an API.
//
// Canva is the named precedent and stays PARKED: `lib/canva.ts` and
// `app/api/canva/*` exist, the OAuth app does not. So Canva becomes the first
// API implementation of this contract rather than a special case, and nothing
// about the contract changes when it arrives. That is the whole point of writing
// the contract first.

import type { ProfileBody } from '../tree/body.ts';
import { amendEntry, putEntry, readPath } from '../tree/body.ts';
import type { Amendment, BodyEntry, HandoffRecord, RightsRecord } from '../tree/objects.ts';
import { findPiece } from './resolve.ts';
import { attachMaterial } from './materials.ts';
import { resolveBrief, type StoredBrief } from './brief.ts';

export const HANDOFF_PATH = 'work-log/creation/making/handoffs';
export const ASSET_PATH = 'work-log/assets/sets';

export class HandoffRefused extends Error {}

/** The path is append-only, so a handoff's status moves by amendment and the
 *  original export record stays exactly as it left. */
export function resolveHandoff(entry: BodyEntry): HandoffRecord {
  const record = { ...(entry.data as unknown as HandoffRecord), id: entry.id };
  for (const a of entry.amendments ?? []) {
    for (const [key, value] of Object.entries(a.changed)) {
      // The two fields that make the round trip land on the same identity never
      // move, whatever an amendment says.
      if (key === 'piece_id' || key === 'brief_version') continue;
      (record as unknown as Record<string, unknown>)[key] = value;
    }
  }
  return record;
}

export function readHandoffs(body: ProfileBody, piece_id?: string): HandoffRecord[] {
  let entries: BodyEntry[];
  try {
    entries = readPath(body, HANDOFF_PATH);
  } catch {
    return [];
  }
  return entries.map(resolveHandoff).filter(h => !piece_id || h.piece_id === piece_id);
}

export interface ExportInput {
  id: string;
  piece_id: string;
  destination_tool: string;
  /** What should come back, in her words: "one 8-slide carousel, 1080x1350". */
  expected_deliverable: string;
  now: string;
  /** Set when a re-export replaces an earlier handoff. */
  supersedes?: string;
}

export interface ExportResult {
  body: ProfileBody;
  handoff: HandoffRecord;
  /** The brief plus the materials list, in a form she can paste anywhere. */
  payload: string;
}

/**
 * §6.9's last line, and it is the reason the brief matters here: S18 makes the
 * BRIEF the thing that leaves. `HandoffRecord.brief_version` is required, so a
 * piece cannot be handed to an outside tool without one. She can write a brief
 * by hand in thirty seconds, but she cannot skip it, and that is correct: a
 * design tool cannot be handed a piece with no point.
 */
export function exportHandoff(body: ProfileBody, input: ExportInput): ExportResult {
  const record = findPiece(body, input.piece_id);
  if (!record) throw new HandoffRefused(`No piece ${input.piece_id} on this profile.`);

  const brief = resolveBrief(body, input.piece_id);
  if (!brief) {
    throw new HandoffRefused(
      'This piece has no brief yet, and a design tool cannot be handed a piece with no point. ' +
      'Write one, or press "Write it myself" and do it in thirty seconds.',
    );
  }
  if (!input.destination_tool.trim()) throw new HandoffRefused('Name the tool it is going to.');
  if (!input.expected_deliverable.trim()) {
    throw new HandoffRefused('Say what should come back, in your words. "One 8-slide carousel, 1080x1350" is enough.');
  }
  if (input.supersedes && !readHandoffs(body).some(h => h.id === input.supersedes)) {
    throw new HandoffRefused('That earlier handoff is not on this profile, so the chain would be broken.');
  }

  const handoff: HandoffRecord = {
    id: input.id,
    piece_id: input.piece_id,                  // immutable, and this is what makes it land back here
    brief_version: brief.brief_version,        // the version that LEFT
    destination_tool: input.destination_tool.trim(),
    exported_at: input.now,
    expected_deliverable: input.expected_deliverable.trim(),
    import_status: 'pending',
    ...(input.supersedes ? { supersedes: input.supersedes } : {}),
  };

  const next = putEntry(body, HANDOFF_PATH, {
    id: input.id, type: 'handoff_record',
    data: handoff as unknown as Record<string, unknown>,
  }, { writer: 'owner', now: input.now });

  return { body: next, handoff, payload: exportPayload(record.piece.title, brief, record.piece.materials ?? [], handoff) };
}

/** The manual route's whole deliverable: something she can paste into any tool. */
export function exportPayload(
  title: string,
  brief: StoredBrief,
  materials: { kind: string; id: string; rights_state: string }[],
  handoff: HandoffRecord,
): string {
  const lines = [
    `${title}`,
    `For: ${handoff.destination_tool}`,
    `Expected back: ${handoff.expected_deliverable}`,
    '',
    `THE BRIEF (version ${brief.brief_version})`,
    `The one point: ${brief.one_point}`,
    `The tension: ${brief.tension}`,
    `The realization: ${brief.realization}`,
    `The takeaway: ${brief.takeaway}`,
    `The product's role: ${brief.product_role ?? 'none in this one'}`,
    `Tone: ${brief.tone}`,
    `How it ends: ${brief.ending}`,
    `Leave out: ${brief.leave_out.join('; ') || 'nothing noted'}`,
    '',
    'MATERIALS',
    ...(materials.length
      ? materials.map(m => `- ${m.kind} ${m.id}${m.rights_state === 'blocked' ? ' (rights not cleared yet)' : ''}`)
      : ['- nothing attached yet']),
    '',
    `Handoff ${handoff.id}. Send the finished file back and it lands on this same piece.`,
  ];
  return lines.join('\n');
}

export interface ImportInput {
  handoff_id: string;
  /** The finished file, as it lands in assets/sets. */
  asset: { id: string; url: string; version: number; name?: string };
  rights?: Partial<RightsRecord>;
  now: string;
  by: string;
}

export interface ImportResult {
  body: ProfileBody;
  handoff: HandoffRecord;
  /** Plain words when the returned asset does not clear its platform yet. */
  message: string;
}

/**
 * §8.4. What returning does, and does not do:
 *
 *  - the returned asset is written to `work-log/assets/sets` with its rights
 *    record (S21), like every other asset;
 *  - it is attached to the piece as a `MaterialRef` of kind `asset`;
 *  - the handoff moves to `import_status: 'imported'`;
 *  - NO SECOND PIECE IS CREATED. Ever. The piece that left is the piece that
 *    came back, and its id, its seed, its costume and its birth snapshot are
 *    untouched by the round trip;
 *  - the piece stays at `build`. Moving it to `review` is spec 25's, after the
 *    gates.
 */
export function importReturn(body: ProfileBody, input: ImportInput): ImportResult {
  const entry = readPath(body, HANDOFF_PATH).find(e => e.id === input.handoff_id);
  if (!entry) throw new HandoffRefused(`No handoff ${input.handoff_id} on this profile.`);
  const handoff = resolveHandoff(entry);
  if (handoff.import_status === 'imported') {
    throw new HandoffRefused('That handoff already came back. A new round trip is a new export.');
  }

  let next = putEntry(body, ASSET_PATH, {
    id: input.asset.id, type: 'asset_set',
    data: {
      name: input.asset.name ?? input.asset.id,
      url: input.asset.url,
      version: input.asset.version,
      came_back_from: handoff.destination_tool,
      handoff_id: handoff.id,
      rights: {
        ownership: 'krnl', consent: 'unknown', permitted_platforms: [], permitted_uses: [],
        expiry: null, attribution_required: null, subject_releases: [], restriction: 'none',
        ...(input.rights ?? {}),
      },
    },
  }, { writer: 'owner', now: input.now });

  const attached = attachMaterial(next, {
    piece_id: handoff.piece_id, kind: 'asset', id: input.asset.id,
    path: ASSET_PATH, now: input.now, by: input.by,
  });
  next = attached.body;

  const amendment: Amendment = {
    at: input.now, by: input.by,
    note: `Came back from ${handoff.destination_tool}.`,
    changed: {
      import_status: 'imported',
      returned_asset: { url: input.asset.url, version: input.asset.version, at: input.now },
    },
  };
  next = amendEntry(next, HANDOFF_PATH, handoff.id, amendment);

  return {
    body: next,
    handoff: resolveHandoff(readPath(next, HANDOFF_PATH).find(e => e.id === handoff.id)!),
    message: attached.message,
  };
}

/** `failed` and `abandoned` are real endings, and they stay on the record. */
export function markHandoff(
  body: ProfileBody,
  opts: { handoff_id: string; status: 'failed' | 'abandoned'; now: string; by: string; note?: string },
): ProfileBody {
  const entry = readPath(body, HANDOFF_PATH).find(e => e.id === opts.handoff_id);
  if (!entry) throw new HandoffRefused(`No handoff ${opts.handoff_id} on this profile.`);
  return amendEntry(body, HANDOFF_PATH, opts.handoff_id, {
    at: opts.now, by: opts.by,
    note: opts.note ?? `Marked ${opts.status}.`,
    changed: { import_status: opts.status },
  });
}

/** The chain, oldest first. It is never broken and never rewritten (§8.3). */
export function handoffChain(body: ProfileBody, piece_id: string): HandoffRecord[] {
  return readHandoffs(body, piece_id)
    .slice()
    .sort((a, b) => (a.exported_at < b.exported_at ? -1 : 1));
}
