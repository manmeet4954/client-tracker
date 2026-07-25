// Path-scoped writes — spec 21 §3.4, the one piece of plumbing the restructure
// may not defer.
//
// Today every save POSTs the whole blob and the last write wins (CLAUDE.md
// gotcha 2). Under that, every "append-only" and "never overwritten" guarantee
// in S7, S11 and S15 is a lie. So a write now DECLARES the paths it touches and
// only those paths merge: two people (or two tabs) working on different parts of
// the system both keep their work.
//
// A scope is one declared path inside one profile — or one owner-level path.
// Undeclared scope → the write is refused (law 4).

import type { AppState, ClientData } from '../../types/index.ts';
import type { ProfileBody } from './body.ts';
import { isDeclared } from './declarations.ts';

export const OWNER_SCOPE = 'owner';
const SEP = '::';

export function scopeKey(profileId: string | null, path: string): string {
  return `${profileId ?? OWNER_SCOPE}${SEP}${path}`;
}

export function parseScope(key: string): { profileId: string | null; path: string } {
  const i = key.indexOf(SEP);
  if (i < 0) return { profileId: null, path: key };
  const owner = key.slice(0, i);
  return { profileId: owner === OWNER_SCOPE ? null : owner, path: key.slice(i + SEP.length) };
}

// ── Which legacy slice lives at which address ────────────────────────────────
// One address per slice, straight out of the address map (spec 21 §8). The
// legacy slices stay the rendering source until the GUI spec moves over; what
// changes here is that every one of them now has a path, and writes are scoped
// by that path.

export const PROFILE_SCOPES: Record<string, (keyof ClientData)[]> = {
  'context/intake/answers': ['onboarding'],
  // `brand` is one legacy object; migration splits it into offers /
  // audience-raw / positioning / goals. As a WRITE scope it stays whole.
  'context/business-details': ['brand'],
  'context/content-strategy/visual-branding': ['brandKit'],
  'context/content-strategy/pillars': ['pillars'],
  'context/content-strategy/platforms': ['platforms'],
  'context/content-strategy/cadence': ['postTarget'],
  'context/content-strategy/goals': ['goals'],
  'work-log/creation': ['contentCards'],
  'work-log/creation/topics': ['topics', 'evergreenIdeas'],
  'work-log/creation/review': ['previewPosts'],
  'work-log/creation/channels': ['instagram'],
  'work-log/creation/funnel/replies': ['leadAnswers'],
  'work-log/assets/sets': [
    'assetSets', 'assetItems', 'driveFolderUrl', 'catalogueCategories', 'catalogueItems',
  ],
  'work-log/references': ['references'],
  'work-log/logs/tasks': ['monthData'],
  'work-log/logs/pipelines/lists': ['lists', 'listRows'],
  'work-log/logs/pipelines/cold-calls': ['coldCalls'],
  'work-log/logs/pipelines/orders': ['orders'],
  'work-log/logs/effort': ['momentum'],
  'work-log/analysis/goal-tracking': ['journey'],
  'frozen/legacy-cards': ['cards', 'pillarCards'],
  'frozen/studio': ['studioCompositions'],
  'frozen/custom-fields': ['customFields'],
};

export const OWNER_SCOPES: Record<string, (keyof AppState)[]> = {
  'shelf/profiles': ['clients', 'bindings'],
  'shelf/today-strip': ['personalTasks'],
  'frozen/chat-log': ['chatLog'],
  'frozen/observations-inbox': ['observations'],
  'leaves/brain-dump': ['brainDump'],
  'leaves/container-map': ['containerMap'],
};

/** Compile-time completeness: a new slice with no scope stops the build. */
type ScopedProfileSlice = (typeof PROFILE_SCOPES)[keyof typeof PROFILE_SCOPES][number];
type UnscopedProfileSlice = Exclude<keyof ClientData, ScopedProfileSlice | 'body'>;
type ScopedOwnerSlice = (typeof OWNER_SCOPES)[keyof typeof OWNER_SCOPES][number];
type UnscopedOwnerSlice = Exclude<keyof AppState, ScopedOwnerSlice | 'clientData'>;
// Both must be `never`. If TypeScript complains here, a slice was added without
// an address — give it one in the address map and a scope here.
export const _profileSlicesAllScoped: UnscopedProfileSlice[] = [];
export const _ownerSlicesAllScoped: UnscopedOwnerSlice[] = [];

const PROFILE_SLICE_TO_PATH = new Map<string, string>();
for (const [path, slices] of Object.entries(PROFILE_SCOPES)) {
  for (const s of slices) PROFILE_SLICE_TO_PATH.set(s, path);
}

export function pathForProfileSlice(slice: keyof ClientData): string | null {
  return PROFILE_SLICE_TO_PATH.get(slice as string) ?? null;
}

// ── Diffing: what did this save actually touch? ──────────────────────────────

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * The scopes that differ between the state a client loaded and the state it is
 * saving. This is what the client declares; the server applies nothing else.
 */
export function changedScopes(base: AppState | null, next: AppState): string[] {
  const out: string[] = [];
  if (!base) {
    // No baseline (first save of a session): declare everything present, which
    // is exactly today's behavior — honest, and no worse than the old door.
    for (const path of Object.keys(OWNER_SCOPES)) out.push(scopeKey(null, path));
    for (const id of Object.keys(next.clientData ?? {})) {
      for (const path of Object.keys(PROFILE_SCOPES)) out.push(scopeKey(id, path));
      for (const p of Object.keys(next.clientData[id]?.body?.paths ?? {})) out.push(scopeKey(id, p));
    }
    return out;
  }

  for (const [path, slices] of Object.entries(OWNER_SCOPES)) {
    if (slices.some(s => !same(base[s], next[s]))) out.push(scopeKey(null, path));
  }

  const ids = new Set([...Object.keys(base.clientData ?? {}), ...Object.keys(next.clientData ?? {})]);
  for (const id of ids) {
    const b = base.clientData?.[id];
    const n = next.clientData?.[id];
    if (!n) continue;                       // deletion travels with shelf/profiles
    if (!b) {                               // a brand-new profile: all of it
      for (const path of Object.keys(PROFILE_SCOPES)) out.push(scopeKey(id, path));
      for (const p of Object.keys(n.body?.paths ?? {})) out.push(scopeKey(id, p));
      continue;
    }
    for (const [path, slices] of Object.entries(PROFILE_SCOPES)) {
      if (slices.some(s => !same(b[s], n[s]))) out.push(scopeKey(id, path));
    }
    const bodyPaths = new Set([
      ...Object.keys(b.body?.paths ?? {}), ...Object.keys(n.body?.paths ?? {}),
    ]);
    for (const p of bodyPaths) {
      if (!same(b.body?.paths?.[p], n.body?.paths?.[p])) out.push(scopeKey(id, p));
    }
    if (!same(b.body?.sort_queue, n.body?.sort_queue)) out.push(scopeKey(id, 'work-log'));
  }
  return [...new Set(out)];
}

export interface ScopeRejection {
  scope: string;
  reason: string;
}

/** Law 4 at the write door: an undeclared path is not a scope. */
export function checkScopes(scopes: string[]): ScopeRejection[] {
  const out: ScopeRejection[] = [];
  for (const key of scopes) {
    const { path } = parseScope(key);
    if (!isDeclared(path)) out.push({ scope: key, reason: `"${path}" is not a declared path (law 4)` });
  }
  return out;
}

// ── Applying: only the declared scopes merge ─────────────────────────────────

function mergeBodies(cur: ProfileBody | undefined, inc: ProfileBody | undefined, paths: string[]): ProfileBody | undefined {
  if (!inc) return cur;
  if (!cur) return inc;                       // first migration of this profile
  const next: ProfileBody = {
    ...cur,
    body_version: Math.max(cur.body_version, inc.body_version),
    paths: { ...cur.paths },
  };
  for (const p of paths) {
    if (p in inc.paths) next.paths[p] = inc.paths[p];
  }
  // The sort queue is her to-do list, not a rendered surface: union it rather
  // than let one tab's copy erase another's.
  const seen = new Set(cur.sort_queue.map(q => `${q.entry_id}|${q.question}`));
  next.sort_queue = [
    ...cur.sort_queue,
    ...inc.sort_queue.filter(q => !seen.has(`${q.entry_id}|${q.question}`)),
  ];
  return next;
}

/**
 * Apply an incoming state onto the authoritative current state, touching ONLY
 * the declared scopes. Anything not declared comes from `current` — so a save
 * that took a second can no longer erase what somebody else wrote meanwhile.
 */
export function applyScopes(current: AppState, incoming: AppState, scopes: string[]): AppState {
  const next: AppState = { ...current, clientData: { ...current.clientData } };

  const ownerPaths = new Set<string>();
  const byProfile = new Map<string, Set<string>>();
  for (const key of scopes) {
    const { profileId, path } = parseScope(key);
    if (profileId === null) ownerPaths.add(path);
    else {
      const set = byProfile.get(profileId) ?? new Set<string>();
      set.add(path);
      byProfile.set(profileId, set);
    }
  }

  for (const path of ownerPaths) {
    for (const slice of OWNER_SCOPES[path] ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (next as any)[slice] = (incoming as any)[slice] ?? (current as any)[slice];
    }
  }

  for (const [id, paths] of byProfile) {
    const inc = incoming.clientData?.[id];
    if (!inc) continue;
    const cur = next.clientData[id];
    if (!cur) { next.clientData[id] = inc; continue; }   // a profile born in this save
    const merged: ClientData = { ...cur };
    for (const path of paths) {
      for (const slice of PROFILE_SCOPES[path] ?? []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (merged as any)[slice] = (inc as any)[slice];
      }
    }
    merged.body = mergeBodies(cur.body, inc.body, [...paths]);
    next.clientData[id] = merged;
  }

  return next;
}
