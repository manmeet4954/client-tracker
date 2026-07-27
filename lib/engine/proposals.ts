// Proposals — spec 23 §8.
//
// PLAN §5.2's law, applied to every proposal whichever engine made it: "clearly
// marked engine-proposed, untouchable until she picks them up."
//
// A proposal is NOT a seed. It cannot be filtered into the bank, it cannot be
// referenced by a piece, it cannot enter a context packet, and it has no status
// ladder. It has one field with three values.

import type { ProfileBody } from '../tree/body.ts';
import { putEntry, readPath } from '../tree/body.ts';
import type { BodyEntry, SeedOrigin } from '../tree/objects.ts';
import type { Badge } from './checks.ts';
import type { ProposalKind, SeedProposal } from './schema.ts';
import { PROPOSAL_SEED_FIELDS } from './schema.ts';
import { amendSeed, appendRawMaterial, findSeed, isCaptureInputShell, writeSeed, SeedRefused } from './seeds.ts';

export const PROPOSAL_PATH = 'work-log/creation/topics/proposals';

export type ProposalState = 'waiting' | 'picked-up' | 'dismissed';

export interface StoredProposal {
  id: string;
  state: ProposalState;
  kind: ProposalKind;
  /** Which engine made it, stamped on the card (§8.2). */
  fed_by: SeedOrigin;
  model: string;
  run_id: string;
  capture_id?: string;
  at: string;
  proposal: SeedProposal;
  badges: Badge[];
  /** Set when she picks it up. */
  picked_up_seed_id?: string;
  picked_up_at?: string;
  dismissed_at?: string;
  dismissed_reason?: string;
  /**
   * §8.3: a revisit proposal carries its evidence. One with no cited verdict is
   * refused at the write door — PLAN §5.2's honesty rule, made mechanical.
   */
  cited_verdict_id?: string;
}

export class ProposalRefused extends Error {}

// ── §8.1 Writing them ───────────────────────────────────────────────────────

export interface NewProposal {
  id: string;
  kind: ProposalKind;
  fed_by: SeedOrigin;
  run_id: string;
  capture_id?: string;
  proposal: SeedProposal;
  badges: Badge[];
  cited_verdict_id?: string;
}

export function writeProposal(body: ProfileBody, input: NewProposal, now: string, model: string): ProfileBody {
  if (input.kind === 'revisit-seed' && !input.cited_verdict_id) {
    throw new ProposalRefused(
      'a revisit proposal must cite the verdict it came from (§8.3): every suggestion cites its evidence',
    );
  }
  const stored: StoredProposal = {
    id: input.id,
    state: 'waiting',
    kind: input.kind,
    fed_by: input.fed_by,
    model,
    run_id: input.run_id,
    capture_id: input.capture_id,
    at: now,
    proposal: input.proposal,
    badges: input.badges,
    cited_verdict_id: input.cited_verdict_id,
  };
  return putEntry(body, PROPOSAL_PATH, {
    id: input.id, type: 'seed_proposal', data: stored as unknown as Record<string, unknown>,
  }, { writer: input.fed_by === 'engine:analysis' ? 'engine:analysis' : 'engine:content', now });
}

export function readProposals(body: ProfileBody): StoredProposal[] {
  return readPath(body, PROPOSAL_PATH)
    .map((e: BodyEntry) => ({ ...(e.data as unknown as StoredProposal), id: e.id }))
    .sort((a, b) => (a.at < b.at ? 1 : -1));
}

/** Nothing expires. A waiting proposal from three months ago is still waiting —
 *  the engine does not tidy up after her (§8.2). */
export function waitingProposals(body: ProfileBody): StoredProposal[] {
  return readProposals(body).filter(p => p.state === 'waiting');
}

function replaceProposal(body: ProfileBody, next: StoredProposal, now: string): ProfileBody {
  const existing = readPath(body, PROPOSAL_PATH);
  return {
    ...body,
    paths: {
      ...body.paths,
      [PROPOSAL_PATH]: existing.map(e => (e.id === next.id
        ? { ...e, data: next as unknown as Record<string, unknown>, updated_at: now }
        : e)),
    },
  };
}

// ── §8.2 Picking one up ─────────────────────────────────────────────────────

/** The seed template fields the engine filled, marked per field (§6.1). */
function engineFields(p: SeedProposal): { fields: Record<string, unknown>; sources: Record<string, 'engine' | 'her'> } {
  const fields: Record<string, unknown> = {};
  const sources: Record<string, 'engine' | 'her'> = {};
  for (const key of PROPOSAL_SEED_FIELDS) {
    const value = (p as unknown as Record<string, unknown>)[key as string];
    if (value == null) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (typeof value === 'string' && !value.trim()) continue;
    fields[key as string] = value;
    sources[key as string] = 'engine';
  }
  return { fields, sources };
}

export interface PickUpResult {
  body: ProfileBody;
  seed_id: string;
  /** Fields the deepen proposal touches that she already wrote. Shown side by
   *  side; she chooses. Her wording is never overwritten by the engine (§4.2). */
  conflicts: { field: string; hers: unknown; engine: unknown }[];
}

export interface PickUpInput {
  proposal_id: string;
  /** The id the new seed is born under. Ignored on a deepen. */
  new_seed_id: string;
  now: string;
  capture?: { at: string; source: string; text: string };
  /** Fields she chose the engine's version of, on a conflict. */
  accept_fields?: string[];
}

/**
 * Picking up creates a real seed at `draft`, `origin: engine:content`, with
 * `field_sources` marking every engine-filled field and the capture attached as
 * raw material. From that moment it is a normal seed and she edits it freely.
 *
 * Three shapes, all here so no screen can invent a fourth:
 *  - `new-seed` on a fresh idea → a new seed.
 *  - `new-seed` naming a migrated capture-input shell → AMENDS the shell, so the
 *    migration produces no duplicates (§8.2, §14.2).
 *  - `deepen` → an amendment on the target seed, with conflicts surfaced.
 */
export function pickUpProposal(body: ProfileBody, input: PickUpInput): PickUpResult {
  const stored = readProposals(body).find(p => p.id === input.proposal_id);
  if (!stored) throw new ProposalRefused(`no proposal ${input.proposal_id}`);
  if (stored.state !== 'waiting') throw new ProposalRefused('that proposal has already been dealt with');

  const p = stored.proposal;
  const { fields, sources } = engineFields(p);
  const conflicts: { field: string; hers: unknown; engine: unknown }[] = [];

  // A revisit proposal never creates a seed: the seed already exists (§8.3).
  if (stored.kind === 'revisit-seed') {
    throw new ProposalRefused(
      'a revisit proposal opens the room on the seed it names — it never births one (§8.3). ' +
      'That surface is Content Engine II.',
    );
  }

  const targetId = stored.kind === 'deepen' ? p.target_seed_id : (p.duplicate_of ?? null);
  const target = targetId ? findSeed(body, targetId) : null;

  let next = body;
  let seedId: string;

  if (target) {
    seedId = target.seed.id;
    const accept = new Set(input.accept_fields ?? []);
    const changed: Record<string, unknown> = {};
    const nextSources = { ...(target.seed.field_sources ?? {}) };
    for (const [field, value] of Object.entries(fields)) {
      const hers = (target.seed as unknown as Record<string, unknown>)[field];
      const sheWroteIt = hers != null &&
        !(Array.isArray(hers) && hers.length === 0) &&
        !(typeof hers === 'string' && !hers.trim());
      if (sheWroteIt && !accept.has(field)) {
        conflicts.push({ field, hers, engine: value });
        continue;
      }
      changed[field] = value;
      nextSources[field] = 'engine';
    }
    // A capture-input shell gets its raw thought at last — that is the only way
    // its sort-queue entry ever clears (§14.2).
    if (isCaptureInputShell(target.seed) && p.raw_thought) {
      const existing = readPath(next, 'work-log/creation/topics');
      next = {
        ...next,
        paths: {
          ...next.paths,
          'work-log/creation/topics': existing.map(e => (e.id === seedId
            ? {
              ...e,
              data: { ...(e.data as Record<string, unknown>), raw_thought: p.raw_thought },
              updated_at: input.now,
            }
            : e)),
        },
      };
    }
    if (Object.keys(changed).length) {
      next = amendSeed(next, seedId, { ...changed, field_sources: nextSources }, {
        at: input.now, by: 'owner',
        note: `Picked up an engine proposal${conflicts.length ? ' (some of your own wording kept)' : ''}`,
      });
    }
    if (input.capture) next = appendRawMaterial(next, seedId, input.capture);
  } else {
    seedId = input.new_seed_id;
    next = writeSeed(next, {
      id: seedId,
      name: p.name,
      raw_thought: p.raw_thought ?? '',
      raw_material: input.capture ? [input.capture] : [],
      origin: stored.fed_by,
      field_sources: sources,
      duplicate_of: p.duplicate_of ?? undefined,
      fields: fields as Partial<Parameters<typeof writeSeed>[1]['fields']>,
    }, input.now, 'owner');
  }

  next = replaceProposal(next, {
    ...stored, state: 'picked-up', picked_up_seed_id: seedId, picked_up_at: input.now,
  }, input.now);

  return { body: next, seed_id: seedId, conflicts };
}

/**
 * Dismissing keeps the proposal in the record forever and writes a feedback item
 * carrying her reason if she gives one (S13: the original and the decision are
 * both preserved). The feedback write is the caller's, so this stays a pure
 * body transform.
 */
export function dismissProposal(
  body: ProfileBody, proposalId: string, now: string, reason?: string,
): ProfileBody {
  const stored = readProposals(body).find(p => p.id === proposalId);
  if (!stored) throw new ProposalRefused(`no proposal ${proposalId}`);
  if (stored.state === 'picked-up') throw new ProposalRefused('that one is already a seed');
  return replaceProposal(body, {
    ...stored, state: 'dismissed', dismissed_at: now, dismissed_reason: reason,
  }, now);
}

// ── §8.2 Untouchable, enforced at the write door ────────────────────────────

/** The only fields a save may change on a proposal, and only alongside the state
 *  move they belong to. Everything else on a `waiting` proposal is frozen. */
const PICKUP_FIELDS = ['state', 'picked_up_seed_id', 'picked_up_at'];
const DISMISS_FIELDS = ['state', 'dismissed_at', 'dismissed_reason'];

export interface ProposalRefusal {
  proposal_id: string;
  reason: string;
}

/**
 * Acceptance test 4: every write to a `waiting` proposal other than pick-up or
 * dismiss is refused, server side. A dismissed proposal still exists and still
 * carries its original text.
 */
export function refusedProposalWrites(
  current: ProfileBody | undefined, incoming: ProfileBody | undefined,
): ProposalRefusal[] {
  if (!incoming || !current) return [];
  const out: ProposalRefusal[] = [];
  const before = new Map(
    (current.paths?.[PROPOSAL_PATH] ?? []).map(e => [e.id, e.data as unknown as StoredProposal]),
  );

  for (const entry of incoming.paths?.[PROPOSAL_PATH] ?? []) {
    const was = before.get(entry.id);
    if (!was) continue;                                     // a brand-new proposal
    const now = entry.data as unknown as StoredProposal;
    if (JSON.stringify(was) === JSON.stringify(now)) continue;

    if (was.state !== 'waiting') {
      out.push({
        proposal_id: entry.id,
        reason: `this proposal is already ${was.state}, and the record of it never changes`,
      });
      continue;
    }

    const touched = Object.keys({ ...was, ...now })
      .filter(k => JSON.stringify((was as unknown as Record<string, unknown>)[k])
        !== JSON.stringify((now as unknown as Record<string, unknown>)[k]));

    const allowed = now.state === 'picked-up' ? PICKUP_FIELDS
      : now.state === 'dismissed' ? DISMISS_FIELDS
      : [];
    const bad = touched.filter(k => !allowed.includes(k));
    if (bad.length) {
      out.push({
        proposal_id: entry.id,
        reason: `a waiting proposal is not editable. Pick it up or dismiss it. (tried to change: ${bad.join(', ')})`,
      });
    }
  }
  return out;
}

export { SeedRefused };
