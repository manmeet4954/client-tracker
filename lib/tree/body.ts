// The per-profile BODY — the path-addressed store spec 21 §3 decided on.
//
// No new storage pattern (CLAUDE.md rule 5): this object lives inside the one
// AppState blob, at clientData[profileId].body. What changes is the SHAPE —
// data is addressed by path, and a path with no declaration is refused.

import type { PathState } from './contract.ts';
import type { Amendment, BodyEntry, Provenance } from './objects.ts';
import { assertDeclared, findDeclaration } from './declarations.ts';

/** Bumped when the body's shape changes. Spec 21 ships version 21. */
export const BODY_VERSION = 21;

export interface SortQueueItem {
  /** The entry that needs her eye. */
  entry_id: string;
  path: string;
  question: string;
}

export interface ProfileBody {
  body_version: number;
  migrated_at: string;
  /** Concrete declared path → the entries living at it. */
  paths: Record<string, BodyEntry[]>;
  /** Things migration refused to guess. Her one-time sort (spec 21 §9.5). */
  sort_queue: SortQueueItem[];
}

export function emptyBody(now = new Date().toISOString()): ProfileBody {
  return { body_version: BODY_VERSION, migrated_at: now, paths: {}, sort_queue: [] };
}

// ── Reading ──────────────────────────────────────────────────────────────────

/** Law 4 at the read edge: an undeclared path throws. */
export function readPath<T = Record<string, unknown>>(body: ProfileBody, path: string): BodyEntry<T>[] {
  assertDeclared(path, 'read');
  return (body.paths[path] ?? []) as BodyEntry<T>[];
}

/** Everything at a path and below it — law 3: readers inherit what is added inside. */
export function readUnder<T = Record<string, unknown>>(body: ProfileBody, prefix: string): BodyEntry<T>[] {
  assertDeclared(prefix, 'read');
  const out: BodyEntry<T>[] = [];
  for (const p of Object.keys(body.paths)) {
    if (p === prefix || p.startsWith(prefix + '/')) out.push(...(body.paths[p] as BodyEntry<T>[]));
  }
  return out;
}

export function findEntry<T = Record<string, unknown>>(body: ProfileBody, id: string): BodyEntry<T> | null {
  for (const p of Object.keys(body.paths)) {
    const hit = body.paths[p].find(e => e.id === id);
    if (hit) return hit as BodyEntry<T>;
  }
  return null;
}

// ── Writing ──────────────────────────────────────────────────────────────────

export interface WriteOptions {
  writer: 'owner' | 'client' | 'engine:content' | 'engine:analysis' | string;
  now?: string;
  provenance?: Provenance;
  state?: PathState;
}

/**
 * Put an entry at a path. Refuses:
 *  - an undeclared path (law 4),
 *  - a writer the path never declared (law 3),
 *  - the wrong entry type (S24 and every other entry_type),
 *  - any write at all to a path sitting at `history` (S9).
 */
export function putEntry<T extends Record<string, unknown>>(
  body: ProfileBody, path: string, entry: Omit<BodyEntry<T>, 'path' | 'created_at' | 'updated_at' | 'state'> & Partial<Pick<BodyEntry<T>, 'state'>>,
  opts: WriteOptions,
): ProfileBody {
  const dec = assertDeclared(path, 'write');
  const now = opts.now ?? new Date().toISOString();

  if (!dec.fed_by.includes(opts.writer as never) &&
      !dec.fed_by.some(w => w.startsWith('path:') || w.startsWith('pipe:'))) {
    throw new Error(`[tree] "${opts.writer}" is not a declared writer of "${path}"`);
  }
  if (entry.type !== dec.entry_type) {
    throw new Error(`[tree] "${path}" holds "${dec.entry_type}" entries, not "${entry.type}"`);
  }

  const existing = body.paths[path] ?? [];
  const prev = existing.find(e => e.id === entry.id);
  if (prev && prev.state === 'history') {
    throw new Error(`[tree] "${path}" entry ${entry.id} is at history — it accepts no writes (S9)`);
  }
  if (prev && dec.history === 'append_only') {
    throw new Error(`[tree] "${path}" is append-only — amend ${entry.id} instead of overwriting it`);
  }

  const next: BodyEntry<T> = {
    ...entry,
    path,
    state: entry.state ?? opts.state ?? 'active',
    provenance: opts.provenance ?? entry.provenance,
    created_at: prev?.created_at ?? now,
    updated_at: now,
  } as BodyEntry<T>;

  return {
    ...body,
    paths: {
      ...body.paths,
      [path]: prev ? existing.map(e => (e.id === entry.id ? (next as BodyEntry) : e)) : [...existing, next as BodyEntry],
    },
  };
}

/** The only way an append-only or snapshot-bearing entry ever changes (S11, S15). */
export function amendEntry(
  body: ProfileBody, path: string, entryId: string, amendment: Amendment,
): ProfileBody {
  assertDeclared(path, 'write');
  const existing = body.paths[path] ?? [];
  const target = existing.find(e => e.id === entryId);
  if (!target) throw new Error(`[tree] no entry ${entryId} at "${path}"`);
  const amended: BodyEntry = {
    ...target,
    amendments: [...(target.amendments ?? []), amendment],
    updated_at: amendment.at,
  };
  return { ...body, paths: { ...body.paths, [path]: existing.map(e => (e.id === entryId ? amended : e)) } };
}

/**
 * How a curated value changes (S11): the old entry stays, at `history`, and the
 * new one records what it supersedes. Nothing is edited in place, so the trail
 * from a raw answer to today's wording is always readable.
 */
export function supersedeEntry<T extends Record<string, unknown>>(
  body: ProfileBody, path: string, previousId: string,
  entry: Omit<BodyEntry<T>, 'path' | 'created_at' | 'updated_at' | 'state'>,
  opts: WriteOptions,
): ProfileBody {
  const dec = assertDeclared(path, 'write');
  if (dec.history !== 'mutable_with_supersession') {
    throw new Error(`[tree] "${path}" is ${dec.history} — supersession does not apply`);
  }
  const now = opts.now ?? new Date().toISOString();
  const existing = body.paths[path] ?? [];
  const previous = existing.find(e => e.id === previousId);
  if (!previous) throw new Error(`[tree] no entry ${previousId} at "${path}" to supersede`);

  const kept: BodyEntry = { ...previous, state: 'history', updated_at: now };
  const next: BodyEntry<T> = {
    ...entry,
    path,
    state: 'active',
    provenance: opts.provenance
      ? { ...opts.provenance, supersedes: previousId }
      : entry.provenance && { ...entry.provenance, supersedes: previousId },
    created_at: now,
    updated_at: now,
  } as BodyEntry<T>;

  return {
    ...body,
    paths: {
      ...body.paths,
      [path]: [...existing.filter(e => e.id !== previousId), kept, next as BodyEntry],
    },
  };
}

/** S9: turning something off never deletes it. It moves to `history`. */
export function setPathState(body: ProfileBody, path: string, state: PathState): ProfileBody {
  const dec = assertDeclared(path, 'write');
  if (!dec.states.includes(state)) {
    throw new Error(`[tree] "${path}" does not allow state "${state}"`);
  }
  const existing = body.paths[path] ?? [];
  return { ...body, paths: { ...body.paths, [path]: existing.map(e => ({ ...e, state })) } };
}

export function queueForHerSort(body: ProfileBody, item: SortQueueItem): ProfileBody {
  return { ...body, sort_queue: [...body.sort_queue, item] };
}

/** Every concrete path this body actually holds data at. */
export function occupiedPaths(body: ProfileBody): string[] {
  return Object.keys(body.paths).filter(p => (body.paths[p] ?? []).length > 0);
}

/** Cheap integrity read used by the acceptance tests and the migration report. */
export function bodyStats(body: ProfileBody): { paths: number; entries: number; undeclared: string[] } {
  const undeclared = Object.keys(body.paths).filter(p => !findDeclaration(p));
  const entries = Object.values(body.paths).reduce((n, list) => n + list.length, 0);
  return { paths: occupiedPaths(body).length, entries, undeclared };
}
