// Materials, and the rights check at attachment — spec 24 §8.2 and §9.
//
// PLAN §3.11: no feature may introduce a second copy of a content piece, and the
// same discipline applies to what a piece POINTS AT. `Piece.materials[]` holds
// references into `work-log/assets/sets`, `work-log/references/` and
// `context/content-strategy/proof-library/`. Detaching removes the reference and
// touches nothing at the source.
//
// The S21 split, stated once so it is not blurred: the publication block lives
// with the gates, in spec 25. The ATTACHMENT of rights-carrying material is
// here, because attachment is where a specific asset first meets a specific
// platform, and that is the first moment the question can even be asked.

import type { ProfileBody } from '../tree/body.ts';
import { amendEntry, readPath } from '../tree/body.ts';
import type { Amendment, MaterialRef, Piece, RightsRecord } from '../tree/objects.ts';
import { rightsCleared } from '../tree/objects.ts';
import { PIECE_PATH } from './seeds.ts';
import { findPiece, resolvePiece, CostumeRefused } from './resolve.ts';

export class MaterialRefused extends Error {}

export const MATERIAL_PATHS: Record<MaterialRef['kind'], string[]> = {
  asset: ['work-log/assets/sets'],
  reference: ['work-log/references', 'work-log/references/our-vision', 'work-log/references/from-client'],
  proof: ['context/content-strategy/proof-library'],
};

/** The rights record on the thing being attached, wherever it lives. */
export function rightsFor(
  body: ProfileBody, kind: MaterialRef['kind'], id: string, path?: string,
): { rights: RightsRecord | undefined; path: string } | null {
  const candidates = path ? [path, ...MATERIAL_PATHS[kind]] : MATERIAL_PATHS[kind];
  for (const p of candidates) {
    let entries;
    try {
      entries = readPath(body, p);
    } catch {
      continue;
    }
    const hit = entries.find(e => e.id === id);
    if (hit) {
      const d = hit.data as Record<string, unknown>;
      return { rights: (d.rights ?? d.rights_record) as RightsRecord | undefined, path: p };
    }
  }
  return null;
}

/**
 * The specific missing right, in words. "No consent recorded for this photo" is
 * a sentence she can act on; "rights check failed" is not.
 */
export function missingRight(rights: RightsRecord | undefined, platform: string): string {
  if (!rights) return 'There is no rights record on this one at all.';
  if (rights.restriction === 'blocked') return 'This one is marked blocked. Someone already said no.';
  if (rights.consent !== 'given') return 'No consent is recorded for this one.';
  if (rights.permitted_platforms.length && !rights.permitted_platforms.includes(platform)) {
    return `This one is permitted on ${rights.permitted_platforms.join(', ')}, and this piece is for ${platform}.`;
  }
  if (rights.expiry && new Date(rights.expiry).getTime() < Date.now()) {
    return `The permission on this one ran out on ${rights.expiry.slice(0, 10)}.`;
  }
  return 'Something in the rights record does not cover this use.';
}

export interface AttachInput {
  piece_id: string;
  kind: MaterialRef['kind'];
  id: string;
  path?: string;
  now: string;
  by: string;
}

export interface AttachResult {
  body: ProfileBody;
  ref: MaterialRef;
  /** Plain words for the screen. Empty when it simply cleared. */
  message: string;
}

/**
 * §9.1, the three outcomes:
 *
 *  1. Clears. It attaches with `rights_state: 'cleared'` and nothing else happens.
 *  2. Does not clear. It STILL ATTACHES, carrying `rights_state: 'blocked'` and
 *     the missing right in words, and the piece carries a visible rights block.
 *     She is often mid-clearance, and being unable to build until a form comes
 *     back would be the tool getting in her way. Publication is what waits, and
 *     that is spec 25's.
 *  3. `restriction: 'blocked'` — REFUSED at the write door. A restriction is not
 *     an absence of a right, it is an explicit prohibition already recorded by
 *     someone. An absent right is a gap to fill; a restriction is an instruction
 *     to obey, and quietly attaching it so a gate can catch it later is not
 *     honest.
 */
export function attachMaterial(body: ProfileBody, input: AttachInput): AttachResult {
  const record = findPiece(body, input.piece_id);
  if (!record) throw new MaterialRefused(`No piece ${input.piece_id} on this profile.`);

  const platform = record.piece.costume?.platform;
  if (!platform) {
    throw new MaterialRefused(
      'This piece has no resolved platform yet, so there is nothing to check the rights against.',
    );
  }

  const found = rightsFor(body, input.kind, input.id, input.path);
  if (!found) throw new MaterialRefused(`That ${input.kind} is not on this profile.`);

  if (found.rights?.restriction === 'blocked') {
    throw new MaterialRefused(
      'This one is marked blocked. That is not a missing right, it is someone saying no, so it does not attach.',
    );
  }

  const cleared = rightsCleared(found.rights, platform);
  const ref: MaterialRef = {
    kind: input.kind,
    id: input.id,
    path: found.path,
    attached_at: input.now,
    by: input.by,
    rights_state: cleared ? 'cleared' : 'blocked',
    ...(cleared ? {} : { rights_note: missingRight(found.rights, platform) }),
  };

  const materials = [...(record.piece.materials ?? []).filter(m => !(m.kind === ref.kind && m.id === ref.id)), ref];
  const amendment: Amendment = {
    at: input.now, by: input.by,
    note: `Attached ${input.kind} ${input.id}.`,
    changed: { materials },
  };

  return {
    body: amendEntry(body, PIECE_PATH, input.piece_id, amendment),
    ref,
    message: cleared ? '' : `${ref.rights_note} It is attached, and the piece carries the block.`,
  };
}

/** Detaching removes the reference and touches nothing at the source (§8.2). */
export function detachMaterial(
  body: ProfileBody, opts: { piece_id: string; kind: MaterialRef['kind']; id: string; now: string; by: string },
): ProfileBody {
  const record = findPiece(body, opts.piece_id);
  if (!record) throw new MaterialRefused(`No piece ${opts.piece_id} on this profile.`);
  const materials = (record.piece.materials ?? []).filter(m => !(m.kind === opts.kind && m.id === opts.id));
  return amendEntry(body, PIECE_PATH, opts.piece_id, {
    at: opts.now, by: opts.by,
    note: `Detached ${opts.kind} ${opts.id}. Nothing at the source changed.`,
    changed: { materials },
  });
}

/** Everything currently attached, and whether the piece carries a rights block. */
export function materialsOf(body: ProfileBody, piece_id: string): {
  materials: MaterialRef[]; blocked: MaterialRef[];
} {
  const record = findPiece(body, piece_id);
  const materials = record?.piece.materials ?? [];
  return { materials, blocked: materials.filter(m => m.rights_state === 'blocked') };
}

/**
 * The write-door half of §9.1 outcome 3. A restricted item cannot be attached by
 * any route, including a whole-body save that never went through
 * `attachMaterial`.
 */
export function refusedMaterialWrites(
  current: ProfileBody | undefined, incoming: ProfileBody | undefined,
): { piece_id: string; reason: string }[] {
  if (!incoming || !current) return [];
  const out: { piece_id: string; reason: string }[] = [];
  const before = new Map((current.paths?.[PIECE_PATH] ?? []).map(e => [e.id, JSON.stringify(e)]));

  for (const entry of incoming.paths?.[PIECE_PATH] ?? []) {
    if (before.get(entry.id) === JSON.stringify(entry)) continue;
    const piece: Piece = resolvePiece(entry);
    for (const m of piece.materials ?? []) {
      const found = rightsFor(incoming, m.kind, m.id, m.path) ?? rightsFor(current, m.kind, m.id, m.path);
      if (found?.rights?.restriction === 'blocked') {
        out.push({
          piece_id: entry.id,
          reason: `${m.kind} "${m.id}" is marked blocked, and a restriction is an instruction to obey, not a gap to fill (S21)`,
        });
      }
    }
  }
  return out;
}

export { CostumeRefused };
