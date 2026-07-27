// The seed, as a kept object — spec 23 §6 and §9.1.
//
// `work-log/creation/topics` is declared `history: 'append_only'` in spec 21, so
// an existing id can never be overwritten. Everything a seed becomes after birth
// is an Amendment appended to `amendments[]`, and every read goes through ONE
// function — `resolveSeed` — which folds them in order.
//
// Two fields refuse amendment forever: `raw_thought` and `raw_material`. PLAN
// §5.1's reason, kept: "this is what protects the perspective from being
// polished into marketing speak."
//
// Nothing in this file calls a model. The bank works entirely by hand, which is
// the correct behaviour whenever the API key is unset or dead (§14.3 step 2).

import type { ProfileBody } from '../tree/body.ts';
import { amendEntry, putEntry, readPath, readUnder } from '../tree/body.ts';
import type { Amendment, BodyEntry, Piece, Seed, SeedOrigin, SeedStatus } from '../tree/objects.ts';

export const SEED_PATH = 'work-log/creation/topics';
export const PIECE_PATH = 'work-log/creation';

export const SEED_STATUSES: SeedStatus[] = ['draft', 'discussed', 'validated', 'locked'];

/** The fields the record refuses to amend, at any status (§6.2). */
export const IMMUTABLE_SEED_FIELDS = ['raw_thought', 'raw_material'] as const;

export class SeedRefused extends Error {}

// ── §6.3 Reading: one function, and nothing reads entry.data directly ────────

/**
 * The seed as it stands today: the birth record with every amendment folded in,
 * in order. The birth record itself is never touched, so `entry.data` remains
 * byte-identical to what was first written (acceptance test 11).
 */
export function resolveSeed(entry: BodyEntry): Seed {
  // The entry id IS the seed id. Migration wrote the id on the entry and not in
  // the data, so it is backfilled here rather than every caller remembering.
  const seed = { ...(entry.data as unknown as Seed), id: entry.id };
  for (const a of entry.amendments ?? []) {
    for (const [key, value] of Object.entries(a.changed)) {
      if ((IMMUTABLE_SEED_FIELDS as readonly string[]).includes(key)) continue; // belt and braces
      (seed as unknown as Record<string, unknown>)[key] = value;
    }
  }
  return seed;
}

export interface SeedRecord {
  entry: BodyEntry;
  seed: Seed;
}

/** Every seed in the bank, resolved. Entries at `history` are included — S9
 *  turning something off never hides it — and carry their state on the entry. */
export function readSeeds(body: ProfileBody): SeedRecord[] {
  return readPath(body, SEED_PATH).map(entry => ({ entry, seed: resolveSeed(entry) }));
}

export function findSeed(body: ProfileBody, id: string): SeedRecord | null {
  const entry = readPath(body, SEED_PATH).find(e => e.id === id);
  return entry ? { entry, seed: resolveSeed(entry) } : null;
}

// ── Writing: birth, then amendments, forever ────────────────────────────────

export interface NewSeedInput {
  id: string;
  name: string;
  raw_thought: string;
  raw_material?: Seed['raw_material'];
  origin?: SeedOrigin;
  field_sources?: Record<string, 'engine' | 'her'>;
  duplicate_of?: string;
  /** Anything else of the template she filled in at birth. */
  fields?: Partial<Seed>;
}

/** Birth a seed. Always at `draft` — nothing is ever auto-locked (§6.5). */
export function writeSeed(
  body: ProfileBody, input: NewSeedInput, now: string,
  writer: 'owner' | 'engine:content' | 'engine:analysis' = 'owner',
): ProfileBody {
  if (findSeed(body, input.id)) {
    throw new SeedRefused(`a seed already exists at ${input.id} — amend it instead (append-only)`);
  }
  const seed: Seed = {
    ...(input.fields ?? {}),
    id: input.id,
    name: input.name,
    raw_thought: input.raw_thought,
    raw_material: input.raw_material ?? [],
    status: 'draft',
    origin: input.origin ?? 'hers',
    field_sources: input.field_sources,
    duplicate_of: input.duplicate_of,
  };
  return putEntry(body, SEED_PATH, {
    id: input.id, type: 'seed', data: seed as unknown as Record<string, unknown>,
  }, { writer, now });
}

/**
 * The only way a seed ever changes. Refuses the two immutable fields, and
 * refuses a status the ladder does not have.
 *
 * The free consequence (§6.3): the status ladder gets a dated trail — who moved
 * it to validated, when, and why — with no extra machinery.
 */
export function amendSeed(
  body: ProfileBody, seedId: string, changed: Record<string, unknown>,
  opts: { at: string; by: string; note: string },
): ProfileBody {
  const record = findSeed(body, seedId);
  if (!record) throw new SeedRefused(`no seed ${seedId} in the bank`);

  for (const field of IMMUTABLE_SEED_FIELDS) {
    if (field in changed) {
      throw new SeedRefused(
        `"${field}" is write-once and refuses amendment (§6.2). ` +
        'If it was mis-captured, append a new capture — the record grows, it never rewrites.',
      );
    }
  }
  if ('status' in changed) {
    const next = changed.status as SeedStatus;
    if (!SEED_STATUSES.includes(next)) throw new SeedRefused(`"${next}" is not a status on the ladder`);
    if (next === 'locked') {
      const gaps = lockGaps(record.seed);
      if (gaps.length) {
        throw new SeedRefused(`this seed cannot be locked yet: ${gaps.map(g => g.label).join(', ')}`);
      }
    }
  }

  const amendment: Amendment = { at: opts.at, by: opts.by, note: opts.note, changed };
  return amendEntry(body, SEED_PATH, seedId, amendment);
}

/** Append one more piece of raw material. The ONLY write that reaches
 *  `raw_material`, and it is an append — nothing already there ever changes. */
export function appendRawMaterial(
  body: ProfileBody, seedId: string, item: { at: string; source: string; text: string },
): ProfileBody {
  const record = findSeed(body, seedId);
  if (!record) throw new SeedRefused(`no seed ${seedId} in the bank`);
  const existing = readPath(body, SEED_PATH);
  const target = existing.find(e => e.id === seedId)!;
  const data = target.data as unknown as Seed;
  const grown: Seed = { ...data, raw_material: [...(data.raw_material ?? []), item] };
  return {
    ...body,
    paths: {
      ...body.paths,
      [SEED_PATH]: existing.map(e => (e.id === seedId
        ? { ...e, data: grown as unknown as Record<string, unknown>, updated_at: item.at }
        : e)),
    },
  };
}

// ── §6.5 The status ladder and the six lock gates ───────────────────────────

export interface LockGate {
  field: keyof Seed;
  /** Plain words, never a red form. */
  label: string;
}

/** Six fields non-empty. Nothing else. These are the minimum for a seed to
 *  survive a costume without the engine having to invent (§6.5). */
export const LOCK_GATES: LockGate[] = [
  { field: 'raw_thought', label: 'what you actually said' },
  { field: 'core_message', label: 'the one thing this says' },
  { field: 'reframe', label: 'what you say instead' },
  { field: 'audience_value', label: 'what they get without buying' },
  { field: 'prohibited_interpretation', label: 'what this must never be read as' },
  { field: 'possible_pillars', label: 'at least one pillar this could serve' },
];

function filled(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === 'string' ? value.trim().length > 0 : value != null;
}

/** What is still missing, in her words. Empty means it can be locked. */
export function lockGaps(seed: Seed): LockGate[] {
  return LOCK_GATES.filter(g => !filled(seed[g.field]));
}

export function canLock(seed: Seed): boolean {
  return lockGaps(seed).length === 0;
}

/**
 * §9.1, and S1: only locked seeds may mother pieces. This guard ships in the
 * tree layer, not in a screen, so no later spec can route around it.
 */
export function canMotherPieces(seed: Seed | null | undefined): boolean {
  return !!seed && seed.status === 'locked';
}

/**
 * The write-door half of the same rule. Any piece carrying a `seed_id` whose
 * seed is not locked is refused, with the reason. Legacy pieces carrying
 * `seed_id: null` are untouched — they predate the seed bank and are honest
 * about it (§14.1).
 */
export interface PieceRefusal {
  piece_id: string;
  seed_id: string;
  reason: string;
}

export function refusedPieceWrites(
  current: ProfileBody | undefined, incoming: ProfileBody | undefined,
): PieceRefusal[] {
  if (!incoming) return [];
  // A profile arriving whole is the migration, and the migration is exempt:
  // its pieces already point at the subjects they came from, and no piece is
  // ever re-parented automatically (§14.1). This binds NEW writes through the
  // tree, the same way spec 22's creation wall does.
  if (!current) return [];
  const out: PieceRefusal[] = [];
  const before = new Map((current?.paths?.[PIECE_PATH] ?? []).map(e => [e.id, JSON.stringify(e)]));
  for (const entry of incoming.paths?.[PIECE_PATH] ?? []) {
    if (before.get(entry.id) === JSON.stringify(entry)) continue;   // unchanged
    const piece = entry.data as unknown as Piece;
    if (!piece?.seed_id) continue;                                  // honest legacy piece
    const seed = findSeedIn(incoming, piece.seed_id) ?? findSeedIn(current, piece.seed_id);
    if (!canMotherPieces(seed)) {
      out.push({
        piece_id: entry.id,
        seed_id: piece.seed_id,
        reason: seed
          ? `seed "${seed.name}" is at ${seed.status}, and only a locked seed can make pieces`
          : 'that seed is not in the bank',
      });
    }
  }
  return out;
}

function findSeedIn(body: ProfileBody | undefined, id: string): Seed | null {
  const entry = (body?.paths?.[SEED_PATH] ?? []).find(e => e.id === id);
  return entry ? resolveSeed(entry) : null;
}

// ── §7.3 A seed's pieces — read from where the pieces live, never copied ────

export interface SeedPiece {
  id: string;
  piece: Piece;
}

/** Every piece in `work-log/creation` whose `seed_id` is this seed (S2). */
export function seedPieces(body: ProfileBody, seedId: string): SeedPiece[] {
  return readPath(body, PIECE_PATH)
    .map(e => ({ id: e.id, piece: e.data as unknown as Piece }))
    .filter(p => p.piece?.seed_id === seedId);
}

export function pieceCounts(body: ProfileBody, seedId: string): { total: number; posted: number } {
  const pieces = seedPieces(body, seedId);
  return { total: pieces.length, posted: pieces.filter(p => p.piece.stage === 'posted').length };
}

// ── §4.3 The three subjects that came over as capture INPUT ─────────────────

/** A migrated shell: a subject, not a seed. It cannot be locked, because
 *  `raw_thought` is empty — the migration's promise made mechanical (S24). */
export function isCaptureInputShell(seed: Seed): boolean {
  return !seed.raw_thought || seed.raw_thought.trim().length === 0;
}

// ── §7.1 and §7.2 Browse and filter ─────────────────────────────────────────

const STATUS_ORDER: Record<SeedStatus, number> = { locked: 0, validated: 1, discussed: 2, draft: 3 };

/** Locked first, then validated, discussed, draft; within each, most recently
 *  touched first (§7.1). */
export function sortSeeds(records: SeedRecord[]): SeedRecord[] {
  return [...records].sort((a, b) => {
    const byStatus = STATUS_ORDER[a.seed.status] - STATUS_ORDER[b.seed.status];
    if (byStatus !== 0) return byStatus;
    return a.entry.updated_at < b.entry.updated_at ? 1 : -1;
  });
}

export interface SeedFilter {
  pillar?: string;
  status?: SeedStatus;
  /** The honest gap view: locked seeds nothing has been made from yet. */
  pieces?: 'has' | 'none';
  origin?: SeedOrigin;
  /** Over name, core message, and the full raw material (§7.2). */
  search?: string;
}

function searchable(seed: Seed): string {
  return [
    seed.name,
    seed.core_message ?? '',
    seed.raw_thought,
    ...(seed.raw_material ?? []).map(m => m.text),
  ].join('\n').toLowerCase();
}

/** Filters combine. Nothing here is persisted between visits — the room does
 *  not remember a lens she did not ask it to keep (§7.2). */
export function filterSeeds(body: ProfileBody, records: SeedRecord[], f: SeedFilter): SeedRecord[] {
  return records.filter(({ seed }) => {
    if (f.pillar && !(seed.possible_pillars ?? []).includes(f.pillar)) return false;
    if (f.status && seed.status !== f.status) return false;
    if (f.origin && (seed.origin ?? 'hers') !== f.origin) return false;
    if (f.pieces) {
      const has = seedPieces(body, seed.id).length > 0;
      if (f.pieces === 'has' && !has) return false;
      if (f.pieces === 'none' && has) return false;
    }
    if (f.search && !searchable(seed).includes(f.search.toLowerCase().trim())) return false;
    return true;
  });
}

/** The pillars this profile actually has, read from strategy — law 3: add a
 *  fourth pillar and it appears here the moment it exists, with no code change
 *  and nothing blank (acceptance test 2). */
export function pillarsForProfile(body: ProfileBody): { id: string; name: string }[] {
  return readUnder(body, 'context/content-strategy/pillars')
    .filter(e => e.state === 'active' && e.type === 'pillar')
    .map(e => {
      const d = e.data as { name?: string };
      return { id: e.id, name: d.name ?? e.id };
    });
}

// ── §7.3 History, in plain words ────────────────────────────────────────────

export function seedHistory(entry: BodyEntry): { at: string; by: string; note: string }[] {
  return (entry.amendments ?? []).map(a => ({ at: a.at, by: a.by, note: a.note }));
}
