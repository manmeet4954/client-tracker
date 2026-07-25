// The declaration contract — spec 21 §4, PLAN laws 3 and 4.
//
// A "folder" here is an OWNERSHIP CONTRACT, not a filesystem (amendment S25).
// The tree is a path namespace over typed data: code addresses data by path,
// and a path with no declaration does not exist as far as the app is concerned.
//
// This file holds only the shapes and the vocabularies. The registries
// themselves are declarations.ts (paths), switches.ts (switches) and
// features.ts (the address map of everything alive in the dashboard today).

/** Law 2's three levels: the shelf, the box, the compartment. */
export type PathKind = 'variable' | 'entry' | 'parameter';

/** Where a declared path sits relative to the frozen spine. */
export type Zone =
  | 'tree'    // inside a profile's context/ or work-log/ spine
  | 'owner'   // her shelf and the one cross-profile window
  | 'frozen'  // retained, read-only, not rendered, not migrated
  | 'leaves'; // PLAN §7 — exits the dashboard, exported to the vault first

/** S9: "off" is three states, and none of them delete anything. */
export type PathState = 'active' | 'history' | 'hidden';

/** Which amendment governs how this path remembers. */
export type HistoryMode =
  | 'append_only'               // S7, S11 raw answers, S15 birth snapshots
  | 'versioned'                 // S10 intake rounds, S14 gate sets
  | 'mutable_with_supersession' // S11 curated parameters
  | 'none';

/**
 * Declared writers. Nothing else may write.
 *
 * `collaborator` is deliberately NOT `client`: it is a login she has explicitly
 * shared ONE object with (spec 12's shared lists), verified server-side against
 * the authoritative state. It opens no door into a profile's tree, so S19's
 * four-doors rule is untouched by it.
 */
export type Writer =
  | 'owner'
  | 'client'
  | 'collaborator'
  | 'engine:content'
  | 'engine:analysis'
  | `pipe:${string}`
  | `path:${string}`;

/** Who may ever SEE it. The client-facing guarantee lives here, not in the UI. */
export type Audience = 'owner' | 'client' | 'both';

/** S19 — the only doors a client may write or read through. */
export type ClientDoor =
  | 'give:intake'
  | 'give:assets'
  | 'give:review'
  | 'give:perception'
  | 'see:strategy'
  | 'see:upcoming'
  | 'see:analysis'
  | 'see:obligations';

export const CLIENT_GIVE_DOORS: ClientDoor[] = [
  'give:intake', 'give:assets', 'give:review', 'give:perception',
];

export const CLIENT_SEE_DOORS: ClientDoor[] = [
  'see:strategy', 'see:upcoming', 'see:analysis', 'see:obligations',
];

/** One declaration. Every path in the namespace carries exactly one. */
export interface PathDeclaration {
  /** The address, e.g. `work-log/creation/review`. Unique. */
  path: string;
  zone: Zone;
  kind: PathKind;
  /** What may live inside. Enforced. `creation/topics` → `seed` only (S24). */
  entry_type: string;
  /** The declared writers (law 3: declared once, inherited by everything inside). */
  fed_by: Writer[];
  /** The declared readers. Paths, feature ids, or `client`. */
  read_by: string[];
  /** The switch id that governs this path. Required — law: no switch, no feature. */
  switch: string;
  states: PathState[];
  history: HistoryMode;
  audience: Audience;
  /** Required whenever `audience` includes the client. */
  client_door?: ClientDoor;
  /** One plain line, for the person reading this file cold. */
  note?: string;
}

// ── Switches (spec 21 §5, S8/S9 and the cascade) ─────────────────────────────

export interface SwitchDeclaration {
  /** e.g. `creation.scheduling`. Namespaced by app. */
  id: string;
  /** The paths and features this switch governs. */
  owns: string[];
  /** Prerequisites. A switch is never more active than what it requires (S8). */
  requires: string[];
  /** Switches that turn off with it — the cascade set. */
  dependents: string[];
  audience: Audience;
  allowed_states: PathState[];
  /**
   * Claude's proposal only. SHE finalizes every position (PLAN §3.4).
   * `null` means deliberately blank — no suggestion is being made.
   */
  suggested_default: PathState | null;
  /** Structural switches (strategy, the four give-points) that cannot be moved. */
  fixed?: boolean;
  /** The strategy decision the position comes out of. */
  derived_from?: string;
  note?: string;
}

/** Her position, per profile. Never set by migration (spec 21 §9.6). */
export interface SwitchSetting {
  state: PathState;
  set_at: string;
  /** Which strategy version she set it from. */
  strategy_version?: number;
  /** True while this is still only a suggestion nobody confirmed. */
  suggested?: boolean;
}

export type SwitchConfig = Record<string, SwitchSetting>;

// ── The feature registry (spec 21 §8 — the address map) ──────────────────────

/**
 * `frozen` = retained, read-only, not rendered, not migrated.
 * `leaves` = exits the dashboard (PLAN §7).
 * `unresolved` = deliberately unaddressed, with the ruling that froze it.
 */
export type FeatureState =
  | 'active' | 'history' | 'hidden'
  | 'declared'    // has an address, no code yet
  | 'migrated'    // moves into the tree at migration
  | 'frozen'
  | 'leaves'
  | 'deleted';

export interface FeatureDeclaration {
  /** Stable id used by the validator and the migration report. */
  id: string;
  /** Where it lives today: state slice, component, route, table. */
  today: string;
  /** The path it owns or feeds. `null` only for `leaves` / `frozen` / `deleted`. */
  writes: string | null;
  /** Paths it consumes. */
  reads: string[];
  /** The switch it registers. Required — PLAN §6 rule 3. */
  switch: string;
  state: FeatureState;
  /** The AppState / ClientData keys this feature is the address for. */
  slices?: string[];
  note?: string;
}

/** Most-restrictive-wins ordering for cascade resolution (spec 21 §5.2). */
const STATE_RANK: Record<PathState, number> = { hidden: 0, history: 1, active: 2 };

export function minState(a: PathState, b: PathState): PathState {
  return STATE_RANK[a] <= STATE_RANK[b] ? a : b;
}

export function stateRank(s: PathState): number {
  return STATE_RANK[s];
}
