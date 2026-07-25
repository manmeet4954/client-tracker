// The canonical objects — spec 21 §7. One identity each, declared once.
// Later specs REFERENCE these; none may define a second version (PLAN §3.11:
// no feature may introduce a second copy of a content piece).

import type { PathState } from './contract.ts';

// ── Provenance and history (S11, S15) ────────────────────────────────────────

export type Confidence = 'confirmed' | 'inferred' | 'legacy-unverified' | 'unknown';

export interface Provenance {
  /** Which answer / transcript / legacy field produced this value. */
  source_refs: string[];
  curator: string;
  at: string;
  confidence: Confidence;
  /** The entry id this value supersedes, if any. Nothing is overwritten. */
  supersedes?: string;
}

export interface Amendment {
  at: string;
  by: string;
  note: string;
  /** The fields the amendment touches. The original record stays intact. */
  changed: Record<string, unknown>;
}

/** One thing inside a folder. An entry that carries its own knowledge is itself
 *  a folder — its children are entries at a deeper path (law 2's nesting). */
export interface BodyEntry<T = Record<string, unknown>> {
  id: string;
  /** The concrete declared path this entry lives at. */
  path: string;
  /** Must match the path declaration's `entry_type`. Enforced on write. */
  type: string;
  state: PathState;
  data: T;
  provenance?: Provenance;
  /** Append-only amendments. The birth record is never rewritten (S15). */
  amendments?: Amendment[];
  created_at: string;
  updated_at: string;
}

// ── 7.1 Seed (S1, S24, PLAN §5.1) ────────────────────────────────────────────

export type SeedStatus = 'draft' | 'discussed' | 'validated' | 'locked';

export interface Seed {
  id: string;
  name: string;
  /** The founder's RAW thought, kept verbatim, forever. */
  raw_thought: string;
  /** Every piece of raw material this seed was born from. Never pruned. */
  raw_material: { at: string; source: string; text: string }[];
  core_message?: string;
  visible_problem?: string;
  deeper_problem?: string;
  common_belief?: string;
  reframe?: string;
  audience_value?: string;
  product_connection?: string;
  examples?: string[];
  nuance?: string;
  prohibited_interpretation?: string;
  proof_required?: string[];
  possible_pillars?: string[];
  possible_angles?: string[];
  status: SeedStatus;
  /** Seeds NEVER have a stage (S1). Present only to make that explicit. */
  readonly stage?: never;
}

// ── 7.2 Piece (S1, S2, S15, S17) ─────────────────────────────────────────────

export type PieceStage = 'idea' | 'build' | 'review' | 'approved' | 'scheduled' | 'posted';

export const PIECE_STAGES: PieceStage[] = ['idea', 'build', 'review', 'approved', 'scheduled', 'posted'];

/** Exactly one value per dimension. Multi-select births separate pieces (S4). */
export interface ResolvedCostume {
  pillar_id: string;
  platform: string;
  format: string;
  objective?: string;
  audience_stage?: string;
  angle?: string;
  hook_type?: string;
  cta?: string;
  length?: string;
  product_intensity?: string;
  voice?: string;
  proof?: string[];
}

/** Taken at build / publication. Later corrections append; this is never
 *  overwritten, because analysis reads it as the piece's birth record (S15). */
export interface BirthSnapshot {
  at: string;
  costume: ResolvedCostume;
  pillar_job?: string;
  goal_mapping?: string[];
  gate_version?: number;
  strategy_version?: number;
}

export interface Piece {
  id: string;
  /** The seed this expresses. Empty only for pieces that predate the seed bank. */
  seed_id: string | null;
  title: string;
  hook?: string;
  stage: PieceStage;
  costume: Partial<ResolvedCostume>;
  birth?: BirthSnapshot;
  /** Distribution references a channel; it never re-states the account (S17). */
  channel_id?: string;
  scheduled_date?: string;
  live_link?: string;
  created_month?: string;
  /** Free-standing notes that belong to the piece itself. */
  notes?: string;
}

// ── 7.3 Channel (S17) ────────────────────────────────────────────────────────

export interface Channel {
  id: string;
  /** Exactly one platform entry. */
  platform: string;
  account_handle: string;
  ownership: 'client' | 'krnl' | 'unknown';
  connection: 'connected' | 'disconnected' | 'never-connected';
  /** IANA zone. Metrics are meaningless without it (S7). */
  timezone: string | null;
  posting_permission: 'we-post' | 'client-posts' | 'unknown';
  note?: string;
}

// ── 7.4 Curated parameter (S11) ──────────────────────────────────────────────

export interface CuratedParameter {
  id: string;
  /** The parameter's name inside its detail folder. */
  key: string;
  value: string | string[] | number | boolean | null;
  /** Provenance is REQUIRED here: no curated value without its source. */
  provenance: Provenance;
}

// ── 7.5 Metric observation (S3, S6, S7, S23) ─────────────────────────────────

export type ObservationWindow = 'first-24h' | '7d' | '30d' | 'lifetime';

export interface MetricObservation {
  id: string;
  piece_id: string | null;
  platform_post_id: string;
  channel_id: string;
  /** Age since publication is how comparisons stay honest (S6). */
  age_hours: number;
  window: ObservationWindow;
  metrics: Record<string, number>;
  metric_definition_version: number;
  account_timezone: string | null;
  fetched_at: string;
  connection_status: 'ok' | 'error' | 'revoked';
  retry_state?: 'none' | 'retrying' | 'backfilled';
  last_successful_sync?: string;
  deleted_on_platform?: boolean;
}

/** A stretch with no data is a COVERAGE GAP, never a slump (S7). */
export interface CoverageGap {
  channel_id: string;
  from: string;
  to: string;
  reason: 'sync-stalled' | 'not-connected' | 'platform-error' | 'unknown';
}

/** Observed platform metrics and attributed business outcomes stay separate (S23). */
export interface AttributedOutcome {
  id: string;
  outcome: string;
  count: number;
  event_source: string | null;
  attribution_method: string | null;
  /** With no declared source and method, it displays as unknown. Never inferred. */
  status: 'declared' | 'unknown';
}

// ── 7.6 Intake round (S10) ───────────────────────────────────────────────────

export type IntakeStatus = 'not-sent' | 'sent' | 'answered' | 'curated';

export interface IntakeRound {
  id: string;
  version: number;
  /** Which parameters this round asked for. Questions come FROM the folders. */
  parameters: string[];
  delivery: 'dashboard-questionnaire' | 'finding-session';
  status: IntakeStatus;
  curation: Record<string, { curated: boolean; at?: string; by?: string }>;
  opened_at: string;
  closed_at?: string;
  legacy?: boolean;
}

// ── 7.7 Review configuration (S20) ───────────────────────────────────────────

export type ReviewVerdict =
  | 'approve' | 'in-scope-revision' | 'supply-material' | 'reject' | 'scope-change';

export interface ReviewConfig {
  allowed_verdicts: ReviewVerdict[];
  revision_rounds: number;
  /** Binds the CLIENT's window only — never a timer on her (S20 as adjusted). */
  review_window_hours: number | null;
  timezone: string | null;
  reminders: boolean;
  delegated_approvers: string[];
  /** What silence means when the window closes. */
  silence_rule: 'auto-approve' | 'hold' | 'escalate-to-her';
}

// ── 7.8 Rights record (S21) ──────────────────────────────────────────────────

export interface RightsRecord {
  ownership: 'client' | 'krnl' | 'third-party' | 'unknown';
  consent: 'given' | 'not-given' | 'unknown';
  permitted_platforms: string[];
  permitted_uses: string[];
  expiry: string | null;
  attribution_required: string | null;
  subject_releases: string[];
  restriction: 'none' | 'internal-only' | 'blocked';
}

/** A gate blocks publication when a required right is absent (S21). */
export function rightsCleared(r: RightsRecord | undefined, platform: string): boolean {
  if (!r) return false;
  if (r.restriction === 'blocked') return false;
  if (r.consent !== 'given') return false;
  if (r.permitted_platforms.length && !r.permitted_platforms.includes(platform)) return false;
  if (r.expiry && new Date(r.expiry).getTime() < Date.now()) return false;
  return true;
}

// ── 7.9 Outside-tool handoff (S18) ───────────────────────────────────────────

export interface HandoffRecord {
  id: string;
  /** Immutable — the piece the brief left from. */
  piece_id: string;
  brief_version: number;
  destination_tool: string;
  exported_at: string;
  expected_deliverable: string;
  returned_asset?: { url: string; version: number; at: string };
  import_status: 'pending' | 'imported' | 'failed' | 'abandoned';
  /** The handoff this one replaces. */
  supersedes?: string;
}

// ── 7.10 Matched comparison (S5, S6) ─────────────────────────────────────────

export interface MatchedComparison {
  id: string;
  hypothesis: string;
  piece_ids: string[];
  held_variables: string[];
  changed_variable: string | 'unknown';
  posting_windows: { piece_id: string; posted_at: string }[];
  account_baseline?: Record<string, number>;
  confounders: string[];
  window: ObservationWindow;
  /** Directional evidence, never causation. */
  verdict?: { direction: 'favours' | 'against' | 'inconclusive'; piece_id?: string; words: string };
  /** Below the thresholds the answer is this, not a ranking (S6). */
  state: 'open' | 'not-enough-comparable-data' | 'concluded';
}

// ── 7.11 Context packet (S12) ────────────────────────────────────────────────

export interface ContextPacket {
  id: string;
  profile_id: string;
  context_version: number;
  /** What must hold no matter what the request asks for. */
  mandatory_constraints: string[];
  folders: string[];
  assembled_at: string;
  model: string;
  /** Logged per output, so any draft can be traced back to what it was given. */
  output_ref?: string;
}

// ── 7.12 Feedback item (S13) ─────────────────────────────────────────────────

export type FeedbackScope = 'piece' | 'seed' | 'profile-rule' | 'candidate-strategy-change';

export interface FeedbackItem {
  id: string;
  scope: FeedbackScope;
  /** The original words, preserved whatever happens next. */
  original: string;
  target_id?: string;
  /** Durable changes land as proposed diffs requiring HER acceptance. */
  proposed_diff?: { path: string; before: unknown; after: unknown };
  decision?: { by: string; at: string; verdict: 'accepted' | 'rejected'; note?: string };
  routed_to?: string;
}

// ── 7.13 Gate set (S14) ──────────────────────────────────────────────────────

export interface Gate {
  id: string;
  name: string;
  question: string;
  /** Brand gates are derived from strategy; operational gates never vary. */
  kind: 'brand' | 'operational';
}

export interface GateSet {
  version: number;
  locked_with_strategy_version: number;
  gates: Gate[];
  locked_at: string;
}

export const OPERATIONAL_GATES: Gate[] = [
  { id: 'accuracy', name: 'Accuracy', kind: 'operational', question: 'Is every claim within what the product honestly delivers?' },
  { id: 'format', name: 'Format', kind: 'operational', question: 'Does the piece behave properly on its platform?' },
];

// ── Profile lifecycle (S22, spec 21 §6) ──────────────────────────────────────

export type Lifecycle = 'setup' | 'active' | 'paused' | 'closing' | 'archived';

export interface LifecyclePolicy {
  state: Lifecycle;
  switch_behavior: string;
  client_access: boolean;
  connector_revocation: boolean;
  export_package: boolean;
  /** Her answer (PLAN §11 Q5): retention is forever by default. */
  retention: 'forever';
  /** Her answer: deletion only by her, personally, with an export first. */
  deletion_authority: 'owner-only-with-export';
}

export const LIFECYCLE_POLICY: Record<Lifecycle, LifecyclePolicy> = {
  setup: {
    state: 'setup', switch_behavior: 'positions unset; creation cannot open until strategy locks',
    client_access: false, connector_revocation: false, export_package: false,
    retention: 'forever', deletion_authority: 'owner-only-with-export',
  },
  active: {
    state: 'active', switch_behavior: 'her positions apply',
    client_access: true, connector_revocation: false, export_package: false,
    retention: 'forever', deletion_authority: 'owner-only-with-export',
  },
  paused: {
    state: 'paused', switch_behavior: 'client-audience switches drop to history; hers stay',
    client_access: false, connector_revocation: false, export_package: false,
    retention: 'forever', deletion_authority: 'owner-only-with-export',
  },
  closing: {
    state: 'closing', switch_behavior: 'everything client-facing drops to history',
    client_access: false, connector_revocation: true, export_package: true,
    retention: 'forever', deletion_authority: 'owner-only-with-export',
  },
  archived: {
    state: 'archived', switch_behavior: 'everything at history; nothing writes',
    client_access: false, connector_revocation: true, export_package: true,
    retention: 'forever', deletion_authority: 'owner-only-with-export',
  },
};
