// S4 resolution — spec 24 §5. From exploring to candidate pieces.
//
// S4, verbatim and binding: "Multi-select explores and requests variants; every
// built piece resolves to exactly one platform, format, objective, primary
// audience stage, angle, hook type, and CTA. Multiple selections create separate
// candidate pieces."
//
// And S15: "At build/publication the piece snapshots its resolved costume,
// pillar job, goal mapping, gate version, and strategy version. Later
// corrections append dated amendments; the analytical birth record is never
// overwritten."
//
// `work-log/creation` is declared `append_only`, so a piece's record grows by
// amendment and never by overwrite. Every read goes through ONE function —
// `resolvePiece` — which folds them in order, exactly the way spec 23 §6.3
// handles seeds. The birth snapshot is the one thing folding can never move.

import type { ProfileBody } from '../tree/body.ts';
import { amendEntry, putEntry, readPath } from '../tree/body.ts';
import type {
  Amendment, BirthSnapshot, BodyEntry, MatchedComparison, Piece, ResolvedCostume, Seed,
} from '../tree/objects.ts';
import { canMotherPieces, resolveSeed, PIECE_PATH, SEED_PATH } from './seeds.ts';
import {
  SINGLE_VALUE_DIMENSIONS, dimensionSpread, pillarJob, type CostumeDimension, type VariantRow,
} from './costume.ts';
import { formatKey } from './formats.ts';
import { readGateSet } from '../strategy/derivation.ts';

export const COMPARISON_PATH = 'work-log/analysis/comparisons';

export class CostumeRefused extends Error {}

// ── Reading a piece: one function, amendments folded in order ────────────────

/**
 * The piece as it stands today. `entry.data` stays byte-identical to what was
 * first written, forever — which is what makes §15 test 17 answerable.
 *
 * `birth` is deliberately foldable ONCE and only from absent to present: a
 * migrated piece at `build` with no birth gets its snapshot when she completes
 * its costume (§14.3). A birth that already exists is never moved by anything,
 * and `refusedBirthRewrites` is what refuses the attempt at the door.
 */
export function resolvePiece(entry: BodyEntry): Piece {
  const piece = { ...(entry.data as unknown as Piece), id: entry.id };
  for (const a of entry.amendments ?? []) {
    for (const [key, value] of Object.entries(a.changed)) {
      if (key === 'birth' && piece.birth) continue;              // belt and braces
      (piece as unknown as Record<string, unknown>)[key] = value;
    }
  }
  return piece;
}

export interface PieceRecord {
  entry: BodyEntry;
  piece: Piece;
}

export function readPieces(body: ProfileBody): PieceRecord[] {
  return readPath(body, PIECE_PATH).map(entry => ({ entry, piece: resolvePiece(entry) }));
}

export function findPiece(body: ProfileBody, id: string): PieceRecord | null {
  const entry = readPath(body, PIECE_PATH).find(e => e.id === id);
  return entry ? { entry, piece: resolvePiece(entry) } : null;
}

/** The birth record as it was FIRST written, whatever came after it. */
export function birthOf(entry: BodyEntry): BirthSnapshot | null {
  const born = (entry.data as unknown as Piece).birth;
  if (born) return born;
  for (const a of entry.amendments ?? []) {
    if (a.changed.birth) return a.changed.birth as BirthSnapshot;
  }
  return null;
}

// ── §5.2 assertResolved — the write door's completeness check ────────────────

export interface ResolveContext {
  /** The formats this platform's folder actually holds (§3.5 item 3). */
  formatsForPlatform?: (platform: string) => string[];
}

/**
 * Exactly one value in each of the eleven single-value dimensions, and the
 * format present in that platform's `formats/` folder.
 *
 * Proof as a SET is accepted, and is the only such case (§5.3): a single piece
 * may honestly need two proof items, and proof is evidence rather than an
 * expressive choice.
 */
export function assertResolved(
  costume: Record<string, unknown> | Partial<ResolvedCostume>, ctx: ResolveContext = {},
): ResolvedCostume {
  const c = (costume ?? {}) as Record<string, unknown>;

  for (const d of SINGLE_VALUE_DIMENSIONS) {
    const value = c[d];
    if (Array.isArray(value)) {
      throw new CostumeRefused(
        `"${d}" carries ${value.length} values and a built piece resolves to exactly one (S4). ` +
        'Multiple selections birth separate pieces; they never ride on one.',
      );
    }
    if (value === undefined || value === null || String(value).trim() === '') {
      throw new CostumeRefused(`"${d}" has no value, and a built piece resolves to exactly one (S4).`);
    }
  }

  if (c.proof !== undefined && !Array.isArray(c.proof)) {
    throw new CostumeRefused('"proof" is a set, and it arrived as a single value.');
  }

  const platform = String(c.platform);
  const format = String(c.format);
  if (ctx.formatsForPlatform) {
    const allowed = ctx.formatsForPlatform(platform).map(formatKey);
    if (!allowed.includes(formatKey(format))) {
      throw new CostumeRefused(
        `"${format}" is not a format ${platform} offers on this profile. ` +
        'Formats live inside platforms, and a format has no existence outside its own.',
      );
    }
  }

  return {
    pillar_id: String(c.pillar_id), platform, format,
    objective: String(c.objective), audience_stage: String(c.audience_stage),
    angle: String(c.angle), hook_type: String(c.hook_type), cta: String(c.cta),
    length: String(c.length), product_intensity: String(c.product_intensity),
    voice: String(c.voice),
    proof: Array.isArray(c.proof) ? (c.proof as string[]).map(String) : [],
  };
}

/** The formats a platform's folder holds, for `assertResolved`'s check. */
export function formatsForPlatform(body: ProfileBody, platform: string): string[] {
  const path = `context/content-strategy/platforms/${formatKey(platform)}/formats`;
  try {
    return readPath(body, path)
      .filter(e => e.state === 'active' && e.type === 'format')
      .map(e => {
        const d = e.data as Record<string, unknown>;
        return String(d.name ?? d.format ?? e.id);
      });
  } catch {
    return [];
  }
}

// ── §5.4 The birth snapshot (S15) ────────────────────────────────────────────

/**
 * The goals this piece is meant to move, suggested from the goals whose S16
 * measurement declaration names this pillar job or this objective.
 *
 * An empty mapping is allowed and is NEVER invented. A goal with no declaration
 * cannot be matched on anything, and guessing would be exactly the fabrication
 * S16 exists to prevent.
 */
export function suggestGoalMapping(
  body: ProfileBody, opts: { pillar_job?: string | null; objective?: string },
): string[] {
  let goals;
  try {
    goals = readPath(body, 'context/content-strategy/goals');
  } catch {
    return [];
  }
  const wanted = [opts.pillar_job, opts.objective]
    .filter(Boolean).map(v => String(v).toLowerCase());
  if (!wanted.length) return [];

  return goals
    .filter(e => e.state === 'active')
    .filter(e => {
      const d = e.data as Record<string, unknown>;
      const declaration = d.measurement ?? d.declaration ?? d.metric_declaration;
      if (!declaration) return false;                  // no S16 declaration, no match
      const text = JSON.stringify(declaration).toLowerCase();
      return wanted.some(w => text.includes(w));
    })
    .map(e => e.id);
}

export interface BirthInput {
  costume: ResolvedCostume;
  now: string;
  /** §3.5 item 4: a piece that broke its own rule on purpose says so, here. */
  rule_overrides?: BirthSnapshot['rule_overrides'];
  /** §14.3: only ever set on a snapshot taken when the costume was completed. */
  taken_late?: { reason: string };
}

/** Every field read NOW, not looked up later. That is the whole point of S15. */
export function buildBirthSnapshot(body: ProfileBody, input: BirthInput): BirthSnapshot {
  const job = pillarJob(body, input.costume.pillar_id);
  const gates = readGateSet(body);
  return {
    at: input.now,
    costume: input.costume,
    pillar_job: job ?? undefined,
    goal_mapping: suggestGoalMapping(body, { pillar_job: job, objective: input.costume.objective }),
    gate_version: gates?.version ?? null,
    strategy_version: body.strategy_version ?? null,
    ...(input.rule_overrides?.length ? { rule_overrides: input.rule_overrides } : {}),
    ...(input.taken_late ? { taken_late: input.taken_late } : {}),
  };
}

// ── §5.2 Send to build ───────────────────────────────────────────────────────

export interface ConfirmedRow {
  row: VariantRow;
  /** A stable id for the piece this row becomes. */
  piece_id: string;
  title: string;
  hook?: string;
  /** Present only where she passed a rule-forbidden row with a reason (§3.5). */
  override_reason?: string;
}

export interface ResolveInput {
  body: ProfileBody;
  seed_id: string;
  batch_id: string;
  rows: ConfirmedRow[];
  now: string;
  by: string;
  created_month?: string;
}

export interface ResolveResult {
  body: ProfileBody;
  piece_ids: string[];
  /** What a comparison COULD be offered on, if she wants one (§5.6). */
  spread: { held: CostumeDimension[]; changed: CostumeDimension[] };
}

/**
 * For each checked row, in one pass:
 *
 *  1. `canMotherPieces(seed)` is re-checked. A seed unlocked between opening the
 *     surface and confirming refuses the WHOLE batch, not the row.
 *  2. `assertResolved(costume)` runs.
 *  3. One `piece` entry is written to `work-log/creation` — the one canonical
 *     identity, owned by creation/ (S2). Not to making/, not to a queue.
 *  4. Stage `build`. No new stage is invented.
 *  5. The birth snapshot is taken.
 *  6. `seed_id` and one shared `batch_id` are set.
 *
 * Nothing else happens. No brief runs, no model is called, no money is spent
 * (§15 test 12). The brief is a separate press because refinement item 4 is law:
 * "she triggers, the engine proposes, she picks."
 */
export function resolveVariants(input: ResolveInput): ResolveResult {
  const { body, seed_id, batch_id, rows, now, by } = input;

  const seedEntry = readPath(body, SEED_PATH).find(e => e.id === seed_id);
  const seed: Seed | null = seedEntry ? resolveSeed(seedEntry) : null;
  if (!canMotherPieces(seed)) {
    throw new CostumeRefused(
      seed
        ? `"${seed.name}" is at ${seed.status}, and only a locked seed can make pieces.`
        : 'That seed is not in the bank.',
    );
  }
  if (!rows.length) throw new CostumeRefused('Nothing is checked, so nothing was written.');

  let next = body;
  const piece_ids: string[] = [];
  const costumes: Partial<ResolvedCostume>[] = [];

  for (const confirmed of rows) {
    const forbidden = confirmed.row.forbidden;
    if (forbidden.length && !confirmed.override_reason?.trim()) {
      throw new CostumeRefused(
        `${forbidden.map(f => `"${f.says}"`).join(' ')} You can pass it anyway, with a reason on the record.`,
      );
    }

    const costume = assertResolved(confirmed.row.costume, {
      formatsForPlatform: p => formatsForPlatform(body, p),
    });

    const rule_overrides = forbidden.map(f => ({
      rule_id: f.rule_id,
      field: 'never',
      reason: confirmed.override_reason!.trim(),
      by,
      at: now,
    }));

    const piece: Piece = {
      id: confirmed.piece_id,
      seed_id,
      title: confirmed.title,
      hook: confirmed.hook,
      stage: 'build',
      costume,
      birth: buildBirthSnapshot(body, { costume, now, rule_overrides }),
      batch_id,
      created_month: input.created_month ?? now.slice(0, 7),
    };

    next = putEntry(next, PIECE_PATH, {
      id: confirmed.piece_id, type: 'piece',
      data: piece as unknown as Record<string, unknown>,
    }, { writer: 'owner', now });

    piece_ids.push(confirmed.piece_id);
    costumes.push(costume);
  }

  return { body: next, piece_ids, spread: dimensionSpread(costumes) };
}

// ── §14.2 and §14.3 Completing a legacy costume ──────────────────────────────

/**
 * A legacy piece opened in the costume surface to fill in the missing
 * dimensions. Doing so:
 *
 *  - writes an Amendment carrying the completed costume and a marker;
 *  - does NOT touch `birth` where a reconstructed snapshot exists. That
 *    difference is the truth: this is what the piece was born as, and this is
 *    what we later understood it to be;
 *  - does NOT invent a `seed_id`. The engine never guesses which seed an old
 *    post belonged to (spec 23 §14.1).
 *
 * A piece migrated at `build` with no birth DOES get one, carrying `taken_late`
 * and saying so in words, because it is entering the engine's build state now.
 */
export function completeLegacyCostume(
  body: ProfileBody,
  opts: { piece_id: string; costume: Partial<ResolvedCostume>; now: string; by: string },
): ProfileBody {
  const record = findPiece(body, opts.piece_id);
  if (!record) throw new CostumeRefused(`No piece ${opts.piece_id} on this profile.`);

  const merged = { ...record.piece.costume, ...opts.costume };
  const changed: Record<string, unknown> = {
    costume: merged,
    costume_completed_at: opts.now,
  };

  const alreadyBorn = !!birthOf(record.entry);
  if (!alreadyBorn && record.piece.stage === 'build') {
    const costume = assertResolved(merged, {
      formatsForPlatform: p => formatsForPlatform(body, p),
    });
    changed.birth = buildBirthSnapshot(body, {
      costume, now: opts.now,
      taken_late: {
        reason: 'this record was made when the costume was completed, not when the piece was made',
      },
    });
  }

  const amendment: Amendment = {
    at: opts.now, by: opts.by,
    note: alreadyBorn
      ? 'Completed the costume. The birth record is untouched.'
      : 'Completed the costume, and took a late birth record.',
    changed,
  };
  return amendEntry(body, PIECE_PATH, opts.piece_id, amendment);
}

// ── The write door (§5.4, §15 tests 1, 4 and 6) ──────────────────────────────

export interface CostumeRefusal {
  piece_id: string;
  reason: string;
}

/**
 * The guards that cannot live in a screen, at the same door spec 23's three sit:
 *
 *  1. A multi-valued single dimension is refused, with the dimension named (S4).
 *  2. A second write to `birth` on an existing entry is refused, from anyone,
 *     including both engines (S15).
 *  3. An engine-born piece (one carrying a `batch_id`) that is not fully
 *     resolved is refused.
 *
 * Legacy pieces carrying a partial costume are untouched: they genuinely carry
 * one and pretending otherwise would be a lie in the type system (§5.5).
 */
export function refusedCostumeWrites(
  current: ProfileBody | undefined, incoming: ProfileBody | undefined,
): CostumeRefusal[] {
  if (!incoming) return [];
  if (!current) return [];                       // a profile arriving whole is the migration
  const out: CostumeRefusal[] = [];
  const before = new Map((current.paths?.[PIECE_PATH] ?? []).map(e => [e.id, e]));

  for (const entry of incoming.paths?.[PIECE_PATH] ?? []) {
    const prev = before.get(entry.id);
    if (prev && JSON.stringify(prev) === JSON.stringify(entry)) continue;    // unchanged

    const piece = entry.data as unknown as Piece;
    const costume = (piece?.costume ?? {}) as Record<string, unknown>;

    for (const d of SINGLE_VALUE_DIMENSIONS) {
      if (Array.isArray(costume[d])) {
        out.push({
          piece_id: entry.id,
          reason: `"${d}" carries more than one value, and a built piece resolves to exactly one (S4)`,
        });
      }
    }

    // The birth record is never overwritten. Not by her, not by either engine.
    if (prev) {
      const wasBorn = (prev.data as unknown as Piece).birth;
      const isBorn = piece?.birth;
      if (wasBorn && JSON.stringify(wasBorn) !== JSON.stringify(isBorn)) {
        out.push({
          piece_id: entry.id,
          reason: 'the birth record is never rewritten (S15) — a correction is a dated amendment',
        });
      }
      const bornInAmendment = (prev.amendments ?? []).some(a => a.changed.birth);
      const amendmentsNow = entry.amendments ?? [];
      const birthAmendments = amendmentsNow.filter(a => a.changed.birth);
      if ((wasBorn && birthAmendments.length) || (bornInAmendment && birthAmendments.length > 1)) {
        out.push({
          piece_id: entry.id,
          reason: 'this piece already has a birth record, and a second one is refused (S15)',
        });
      }
    }

    // Engine-born pieces are complete or they are not written.
    if (piece?.batch_id) {
      try {
        assertResolved(costume);
      } catch (e) {
        out.push({ piece_id: entry.id, reason: e instanceof Error ? e.message : 'costume is not resolved' });
      }
    }
  }
  return out;
}

// ── §5.6 Where a matched comparison is born (S5) ─────────────────────────────

export interface ComparisonOffer {
  offered: boolean;
  /** Plain words for the screen when it is not offered. Never a silent absence. */
  reason?: string;
  changed_variable?: CostumeDimension;
  held_variables?: CostumeDimension[];
  piece_ids: string[];
}

/**
 * The offer, and its limits.
 *
 * It appears only when the batch changes EXACTLY ONE dimension and holds every
 * other. Two changed dimensions, no offer — that is not a controlled test and
 * calling it one would be the causation claim S5 forbids.
 *
 * It appears only when comparison is live, which requires tracking. You cannot
 * run a controlled test on an account nobody is collecting from, and the honest
 * thing is not to offer one.
 *
 * A batch that differs only in proof is not offered either: proof does not vary
 * the expression (§5.3).
 */
export function offerComparison(opts: {
  piece_ids: string[];
  costumes: Partial<ResolvedCostume>[];
  compareActive: boolean;
}): ComparisonOffer {
  const { piece_ids, costumes, compareActive } = opts;
  if (!compareActive) {
    return {
      offered: false, piece_ids,
      reason: 'Comparison needs tracking switched on. You cannot run a controlled test on an account nobody is collecting from.',
    };
  }
  if (piece_ids.length < 2) {
    return { offered: false, piece_ids, reason: 'One piece is not a comparison.' };
  }
  const { held, changed } = dimensionSpread(costumes);
  if (changed.length !== 1) {
    return {
      offered: false, piece_ids, held_variables: held,
      reason: changed.length === 0
        ? 'Nothing changes between these, so there is nothing to compare.'
        : `${changed.length} dimensions change between these, so this is not a controlled test.`,
    };
  }
  return { offered: true, piece_ids, changed_variable: changed[0], held_variables: held };
}

/**
 * On accept, one `matched_comparison` at `work-log/analysis/comparisons` with
 * `held_variables` and `changed_variable` taken FROM THE COSTUMES, never
 * inferred, and `state: 'open'`.
 *
 * Everything after birth is the Analysis family's: windows, thresholds,
 * baselines, confounders and the verdict are spec 26's store and spec 27's
 * reading. This writes the four fields only it can know, and stops.
 */
export function writeComparison(
  body: ProfileBody,
  input: { id: string; hypothesis: string; offer: ComparisonOffer; now: string },
): ProfileBody {
  if (!input.offer.offered) {
    throw new CostumeRefused(
      `This batch is not a controlled comparison. ${input.offer.reason ?? ''}`.trim(),
    );
  }
  if (!input.hypothesis.trim()) {
    throw new CostumeRefused('A comparison needs a one-line hypothesis. Without one the batch is just a batch, which is fine.');
  }
  const comparison: MatchedComparison = {
    id: input.id,
    hypothesis: input.hypothesis.trim(),
    piece_ids: input.offer.piece_ids,
    held_variables: input.offer.held_variables ?? [],
    changed_variable: input.offer.changed_variable ?? 'unknown',
    posting_windows: [],          // the Analysis family's, once they post
    confounders: [],
    window: 'first-24h',
    state: 'open',
  };
  return putEntry(body, COMPARISON_PATH, {
    id: input.id, type: 'matched_comparison',
    data: comparison as unknown as Record<string, unknown>,
  }, { writer: 'owner', now: input.now });
}
