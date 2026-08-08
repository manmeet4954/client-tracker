// The canonical objects — spec 21 §7. One identity each, declared once.
// Later specs REFERENCE these; none may define a second version (PLAN §3.11:
// no feature may introduce a second copy of a content piece).

import type { ClientDoor, PathState } from './contract.ts';
import { CLIENT_GIVE_DOORS, CLIENT_SEE_DOORS } from './contract.ts';

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
  // ── Spec 23 §6.4: the only three additions, each with its reason. No later
  // spec may add a fourth without the same justification.
  /** The "clearly marked" law, and the bank's origin filter. */
  origin?: SeedOrigin;
  /** Per-field marking of what the engine wrote vs what she wrote (§6.1). */
  field_sources?: Record<string, 'engine' | 'her'>;
  /** Check 6's dedupe result, kept so the same idea does not fork silently. */
  duplicate_of?: string;
  /** Seeds NEVER have a stage (S1). Present only to make that explicit. */
  readonly stage?: never;
}

export type SeedOrigin = 'hers' | 'engine:content' | 'engine:analysis';

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
  gate_version?: number | null;
  strategy_version?: number | null;
  // ── Spec 24 §5.5: two of the four additions, each with its reason. No later
  // spec may add a fifth without the same justification.
  /**
   * §3.5 item 4. A piece that deliberately broke its own format rule must say so
   * in the record analysis reads, or the rule looks like it was never there.
   */
  rule_overrides?: { rule_id: string; field: string; reason: string; by: string; at: string }[];
  /**
   * §14.3. A migrated piece already sitting at `build` with no birth gets its
   * snapshot when she completes its costume, which is NOT its birth. Analysis
   * must be able to tell the difference, or the honesty rule breaks at the source.
   */
  taken_late?: { reason: string };
}

/**
 * Spec 24 §5.5. Materials belong to the piece, because the piece is the one
 * identity (S2) — anywhere else would be a second copy of the association.
 * A REFERENCE, never a copy of the file (PLAN §3.11).
 */
export interface MaterialRef {
  kind: 'asset' | 'reference' | 'proof';
  id: string;
  path: string;
  attached_at: string;
  by: string;
  /** What `rightsCleared` said against this piece's RESOLVED platform, then. */
  rights_state: 'cleared' | 'blocked';
  /** The specific missing right, in words, when it did not clear (§9.1). */
  rights_note?: string;
}

export interface Piece {
  id: string;
  /** The seed this expresses. Empty only for pieces that predate the seed bank. */
  seed_id: string | null;
  title: string;
  hook?: string;
  stage: PieceStage;
  costume: Partial<ResolvedCostume>;
  birth?: BirthSnapshot | null;
  /** Distribution references a channel; it never re-states the account (S17). */
  channel_id?: string;
  scheduled_date?: string;
  live_link?: string;
  created_month?: string;
  /** Free-standing notes that belong to the piece itself. */
  notes?: string;
  // ── Spec 24 §5.5, the other two additions.
  /** Attached by reference. Detaching touches nothing at the source (§8.2). */
  materials?: MaterialRef[];
  /**
   * S4 births separate pieces from one exploration. Without a batch id, "these
   * three came from one selection" is unrecoverable, and S5's held and changed
   * variables could then only be inferred — which the migration already refused
   * to do, correctly.
   */
  batch_id?: string;
  /**
   * Spec 25 §3.4. The ONE pointer everything else reads: review, the client
   * preview projection, scheduling and the birth snapshot all follow it, so no
   * copy of a draft is made anywhere (PLAN §3.11, the one-truth rule).
   */
  current_draft_version_id?: string;
}

// ── 7.2b The internal brief (spec 24 §6.5) ───────────────────────────────────
//
// Declared HERE, once, for the whole engine family, so no later spec invents a
// second one. Spec 25 reads these eight fields through its `resolveBrief`.

export interface InternalBrief {
  id: string;
  piece_id: string;
  brief_version: number;
  /** The single thing this piece says. */
  one_point: string;
  /** What makes it worth watching — the friction the audience feels. */
  tension: string;
  /** The turn: what they see differently by the end. */
  realization: string;
  /** What they leave with even if they never buy. */
  takeaway: string;
  /** Where the product honestly fits, or null at product intensity `none`. */
  product_role: string | null;
  tone: string;
  /** How it lands, ending on the resolved CTA. */
  ending: string;
  /** What must not be in this piece. */
  leave_out: string[];
  /** Must equal the resolved CTA (check 2). */
  cta_id: string;
  /** proof-library ids; each must resolve (check 3). */
  proof_used: string[];
  /** Seed field names this brief drew on (check 5). */
  derived_from: string[];
  format_rule: { rule_id: string | null; version: number; overridden_fields: string[] };
  origin: 'engine' | 'hers';
  /** Per-field marking, spec 23 §6.4's pattern: her edit clears the marker. */
  field_sources?: Record<string, 'engine' | 'her'>;
  /** HERS, verbatim, when she wrote one (the seam spec 25 §2.3 names). */
  hook?: string;
  run_id?: string;
  packet_id?: string;
  context_version?: number;
  written_at: string;
  by: string;
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
  // ── Spec 26 §5.1: the only two additions, each with its reason.
  /**
   * The earliest publication date this channel collects from. It was a
   * hard-coded `TRACK_SINCE` in ig-sync; per channel it is what makes an honest
   * "collecting since" line possible instead of a fake zero. Defaults to the
   * connection date; hers to finalize.
   */
  track_since?: string | null;
  /**
   * Reading a client-owned account's numbers is a permission distinct from
   * posting to it (S17 lists posting only). Collection refuses on `not-granted`;
   * `unknown` collects and raises a sort-queue item for her.
   */
  metrics_permission?: 'granted' | 'not-granted' | 'unknown';
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
  // ── Spec 26 §5.3: four additions and one rule. The rule is that the store is
  // append-only for real — a correction is a new row and the old row stays.
  /** `lifetime` is what the pipe actually fetched; `window` is materialized (§7). */
  kind_of_row?: 'lifetime' | 'window';
  /** The calendar date in the CHANNEL's timezone. `fetched_at` is UTC. */
  local_date?: string;
  /** Migrated history has only a snapshot date, so it may never claim hourly age. */
  fetch_time_precision?: 'exact' | 'day';
  /** The sync run that produced it. This is what turns "no data" into a reason. */
  source_run_id?: string | null;
  /** Set on `window` rows only (§5.7). */
  window_state?: WindowState;
  /** The coverage gap that made a window unavailable. Never a zero. */
  unavailable_reason?: string;
  /** The platform this row came from. Present once the store went platform-neutral. */
  platform?: string;
}

/** §5.7. A window is a fact about a moment; it materializes once. */
export type WindowState = 'materialized' | 'too-early' | 'unavailable';

/** A stretch with no data is a COVERAGE GAP, never a slump (S7). */
export interface CoverageGap {
  channel_id: string;
  from: string;
  to: string;
  /**
   * Spec 26 §5.6 adds the last two. A stall and a deliberate stop must never
   * render the same: one is a hole, the other is a boundary.
   */
  reason:
    | 'sync-stalled' | 'not-connected' | 'platform-error' | 'unknown'
    | 'switched-off' | 'not-yet-tracked';
  /**
   * A run with `completed: false` covers only the posts it observed. Naming them
   * is what stops a partial run being reported as a whole day (§5.6).
   */
  missed_platform_post_ids?: string[];
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
  // ── Spec 26 §5.10: the address, the period and the optional channel.
  period_start?: string;
  period_end?: string;
  channel_id?: string | null;
}

// ── 7.6 Intake round (S10) ───────────────────────────────────────────────────

export type IntakeStatus = 'not-sent' | 'sent' | 'answered' | 'curated';

/**
 * Spec 33 §2: a third way the same answers travel. Plan §3.1's law is unbent —
 * intake is HOW, never WHAT — so a document is a ROUTE, not a new kind of
 * knowledge. It never invents a parameter and never answers one by itself.
 */
export type IntakeDelivery = 'dashboard-questionnaire' | 'finding-session' | 'documents';

export interface IntakeRound {
  id: string;
  version: number;
  /** Which parameters this round asked for. Questions come FROM the folders. */
  parameters: string[];
  /**
   * The route the round was OPENED as. The three mix freely inside one round:
   * a client can answer six questions, skip four, and hand over a deck that
   * covers the rest, and this field only says how it started.
   */
  delivery: IntakeDelivery;
  status: IntakeStatus;
  curation: Record<string, { curated: boolean; at?: string; by?: string }>;
  /**
   * Spec 33 §4. Parameter ids the answerer chose to come back to.
   *
   * A skip is a THIRD STATE, not a soft no: not answered, and not abandoned.
   * It lives on the round rather than in `answers/` because answers are raw
   * material the client gave and are never altered (S11) — a skip is not
   * something they said. A round cannot reach `answered` while anything here
   * is still only skipped, which is what stops a question falling silently
   * through a long form.
   */
  skipped?: string[];
  opened_at: string;
  closed_at?: string;
  legacy?: boolean;
}

/**
 * Spec 33 §2. Material handed over during intake: a file, a link, or pasted
 * text. Stored with the ANSWERS, because that is what it is — raw material the
 * client gave, kept exactly as it arrived and never altered (S11).
 *
 * Whether its text can actually be read is spec 32 §4's question, and the two
 * fields below are the honest answer rather than a silent assumption.
 */
export interface IntakeDocument {
  id: string;
  round: number;
  title: string;
  kind: 'file' | 'link' | 'text';
  /** For a file, the stored URL. For a link, the link. */
  url?: string;
  /** For pasted text, her paste, verbatim. */
  text?: string;
  given_by: string;
  received_at: string;
  /** The readable text, when there was any to read. Null when there was not. */
  extracted?: string | null;
  extraction_state: 'none' | 'ok' | 'unreadable' | 'not-attempted';
  /**
   * The parameters SHE decided this speaks to, during curation. Never guessed
   * on upload: a document proposes, she decides (PLAN §5.1 item 4).
   */
  covers?: string[];
  /** Set when it was given in answer to one question rather than the round. */
  answers_parameter?: string;
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

/**
 * A gate blocks publication when a required right is absent (S21).
 *
 * Spec 25 §7.2, the one correction to the shipped helper, made IN PLACE rather
 * than as a parallel object (spec 22 §11's pattern): the undated form checked
 * expiry against *now*, so a piece scheduled for three weeks out, using a photo
 * whose consent expires in two, passed today and was wrong on the day it posted.
 * `rightsCleared` now delegates to the dated form with now, so every existing
 * caller keeps working unchanged, and the gate calls the dated form with the
 * piece's scheduled date.
 */
export function rightsClearedAt(
  r: RightsRecord | undefined, platform: string, at: string,
): boolean {
  if (!r) return false;
  if (r.restriction === 'blocked') return false;
  if (r.consent !== 'given') return false;
  if (r.permitted_platforms.length && !r.permitted_platforms.includes(platform)) return false;
  if (r.expiry && new Date(r.expiry).getTime() < new Date(at).getTime()) return false;
  return true;
}

export function rightsCleared(r: RightsRecord | undefined, platform: string): boolean {
  return rightsClearedAt(r, platform, new Date().toISOString());
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

/**
 * Spec 25 §8.2. PLAN §5.1 names four routes; a fifth class exists because most
 * feedback is not durable at all, and pretending otherwise is how a system fills
 * up with noise.
 */
export type FeedbackClass = 'piece-only' | 'voice' | 'seed' | 'format' | 'performance';

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
  // ── Spec 25 §8, the three additions, each with its reason.
  /** §8.1: which of the three capture moments this came from. There is no fourth. */
  moment?: 'her-review' | 'client-review' | 'after-posting';
  /** §8.3: the engine PROPOSES a class. Nothing routes on a proposed class alone. */
  proposed_class?: FeedbackClass;
  /** Set only by her confirmation. Every routing path asserts this. */
  confirmed_class?: FeedbackClass;
  /** §8.4 "edit and accept": her edited version, with the original proposal kept. */
  applied_diff?: { path: string; before: unknown; after: unknown };
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

// ── 7.14 Taste rule (spec 25 §9.2, spec 10 re-cut) ───────────────────────────
//
// Declared HERE, once, because the owner zone has no profile body to hold it and
// no later spec may define a second one. A rule is TEXT the engine reads openly,
// never a weight: it is visible, hers, editable and deletable, and nothing about
// it trains.

export interface TasteRule {
  id: string;
  /** One plain line, in her language. */
  rule: string;
  strength: 'law' | 'lean';
  state: 'proposed' | 'active' | 'retired';
  /** The deltas and decisions that made it. NEVER leaves the owner surface. */
  evidence_refs: string[];
  /** Set only by the de-identification guard in §9.3. No guard, no crossing. */
  de_identified: boolean;
  proposed_at: string;
  accepted_at?: string;
  last_confirmed?: string;
  retired_at?: string;
}

// ── Profile lifecycle (S22, spec 21 §6) ──────────────────────────────────────

export type Lifecycle = 'setup' | 'active' | 'paused' | 'closing' | 'archived';

export interface LifecyclePolicy {
  state: Lifecycle;
  switch_behavior: string;
  /**
   * Spec 22 §11.1: client access is SCOPED, not boolean. `setup` is exactly the
   * phase intake exists for, and the dashboard questionnaire is give-point 1 —
   * as spec 21 shipped it, the only phase where intake happens was the phase
   * where the client could not reach it.
   */
  client_doors: ClientDoor[];
  /** Derived from `client_doors`, so nothing that read the old field breaks. */
  client_access: boolean;
  connector_revocation: boolean;
  export_package: boolean;
  /** Her answer (PLAN §11 Q5): retention is forever by default. */
  retention: 'forever';
  /** Her answer: deletion only by her, personally, with an export first. */
  deletion_authority: 'owner-only-with-export';
}

const policy = (p: Omit<LifecyclePolicy, 'client_access'>): LifecyclePolicy =>
  ({ ...p, client_access: p.client_doors.length > 0 });

export const LIFECYCLE_POLICY: Record<Lifecycle, LifecyclePolicy> = {
  setup: policy({
    state: 'setup', switch_behavior: 'positions unset; creation cannot open until strategy locks',
    // Intake, and nothing else. Not assets, not review, not perception, not a
    // single see-point (spec 22 §11.1, acceptance test 12).
    client_doors: ['give:intake'],
    connector_revocation: false, export_package: false,
    retention: 'forever', deletion_authority: 'owner-only-with-export',
  }),
  active: policy({
    state: 'active', switch_behavior: 'her positions apply',
    client_doors: [...CLIENT_GIVE_DOORS, ...CLIENT_SEE_DOORS],
    connector_revocation: false, export_package: false,
    retention: 'forever', deletion_authority: 'owner-only-with-export',
  }),
  paused: policy({
    state: 'paused', switch_behavior: 'client-audience switches drop to history; hers stay',
    client_doors: [], connector_revocation: false, export_package: false,
    retention: 'forever', deletion_authority: 'owner-only-with-export',
  }),
  closing: policy({
    state: 'closing', switch_behavior: 'everything client-facing drops to history',
    client_doors: [], connector_revocation: true, export_package: true,
    retention: 'forever', deletion_authority: 'owner-only-with-export',
  }),
  archived: policy({
    state: 'archived', switch_behavior: 'everything at history; nothing writes',
    client_doors: [], connector_revocation: true, export_package: true,
    retention: 'forever', deletion_authority: 'owner-only-with-export',
  }),
};

/** The doors a client login may use on a profile in this lifecycle state. */
export function doorsOpenAt(lifecycle: Lifecycle | undefined): ClientDoor[] {
  return LIFECYCLE_POLICY[lifecycle ?? 'active'].client_doors;
}

// ── spec 26 — the tracking store's objects (§5.2, §5.4, §5.5, §5.8, §5.9) ─────
//
// Declared here, once, for the whole Analysis Engine family, so no later spec
// invents a second version (the rule this file opens with).

/**
 * §5.4. `kind` is the field that prevents the most common silent lie: what may
 * legally be summed, differenced, or neither.
 */
export type MetricKind =
  /** A lifetime running total. Never sum across days; a per-day figure is a DIFFERENCE. */
  | 'cumulative'
  /** A count for one day. Summing is correct; differencing is not. */
  | 'interval'
  /** A stock as of that moment. Never sum; growth is a difference. */
  | 'level';

/** One row of a platform's metric catalogue. Lives in CODE, not in a profile. */
export interface MetricDefinition {
  metric_id: string;
  platform: string;
  /** The field the platform's own API calls it. */
  api_field: string;
  kind: MetricKind;
  unit: 'count' | 'people' | 'ratio';
  /** Formats this metric exists for. Empty means every format on the platform. */
  available_for: string[];
  introduced_at: string | null;
  superseded_by: string | null;
  /**
   * A metric is not its name. Two observations of the same id with different
   * versions are NOT comparable, and the store marks them so (§5.4).
   */
  definition_version: number;
  note?: string;
}

/** §5.5. Without this, a missing day and a failed day look identical. */
export interface SyncRun {
  run_id: string;
  channel_id: string;
  platform: string;
  started_at: string;
  ended_at?: string | null;
  trigger: 'cron' | 'owner' | 'retry' | 'backfill';
  connection_status: SyncConnectionStatus;
  posts_seen: number;
  posts_observed: number;
  completed: boolean;
  attempt: number;
  error_summary?: string[];
  /** Set when a run ran out of time; the next tick resumes from it (§6.6). */
  resume_cursor?: string | null;
  /** Which posts a partial run never reached. Named, never implied. */
  missed_platform_post_ids?: string[];
}

/**
 * Every way a run can end. `switched-off` and `not-yet-tracked` are decisions,
 * not faults, and §6.7 requires them to read differently from a stall.
 */
export type SyncConnectionStatus =
  | 'ok' | 'error' | 'platform-error' | 'not-connected'
  | 'switched-off' | 'not-yet-tracked' | 'permission-refused' | 'unknown';

/** §5.8. The piece ↔ platform-post join, spec 03's mechanism generalized. */
export interface PostLink {
  piece_id: string;
  /** A profile not yet migrated keeps `legacy-card` against the old card id. */
  id_kind: 'piece' | 'legacy-card';
  profile_id: string;
  channel_id: string;
  platform_post_id: string;
  post_ref: string;
  matched_at: string;
  /**
   * `time-window-suggested` NEVER attaches on its own: guessing which post a
   * piece is would poison every downstream number with no visible trace (§8).
   */
  match_method: 'url-ref' | 'owner-confirmed' | 'time-window-suggested';
  confirmed_by?: string | null;
}

/** §5.2. One row per post the pipe has ever seen, on any platform. */
export interface PlatformPost {
  platform_post_id: string;
  channel_id: string;
  platform: string;
  published_at: string;
  permalink: string | null;
  /** The join key (§8), produced by the connector's `extractPostRef`. */
  post_ref: string | null;
  media_kind: string | null;
  /** The platform's own word for the container. A HINT, never the truth (S15). */
  format_hint: string | null;
  caption: string | null;
  first_seen_at: string;
  last_seen_at: string;
  deleted_on_platform: boolean;
}

// ── spec 27 — the reading layer's two objects (§20.1, §20.2) ─────────────────
//
// Declared here, once, for the same reason spec 26's are: no later spec may
// invent a second version. Everything else spec 27 touches — `MatchedComparison`,
// `MetricObservation`, `CoverageGap`, `AttributedOutcome`, `Piece`,
// `BirthSnapshot`, `FeedbackItem`, `ContextPacket` — is used exactly as its
// owning spec defines it, with no field added.

export type VerdictCycle = '30-day' | 'quarter';

/**
 * §20.1. Append-only, never edited: a re-run appends a new one and the old one
 * stays, because a verdict is a fact about what we believed on a date.
 *
 * `input` is stored WHOLE. The model never sees a database — it sees this
 * object and nothing else (§12.2).
 */
export interface Verdict {
  id: string;
  profile_id: string;
  cycle: VerdictCycle;
  period_start: string;
  period_end: string;
  /** The computed input (§11.2), stored whole. Typed by lib/analysis/verdict.ts. */
  input: Record<string, unknown>;
  /** Absent when `analysis.verdict_words` is off, or when the guards rejected twice. */
  words?: {
    headline: string;
    coverage_note: string;
    patterns: { pattern_ref: string; words: string }[];
    call: { pattern_ref: string; right_call: 'yes' | 'no' | 'cannot say yet'; words: string };
    cannot_say_note: string;
    one_suggestion: string;
  };
  guards: { rejected: number; reasons: string[] };
  run_id: string;
  model: string | null;
  effort: string;
  packet_version: number;
  context_version: number;
  state: 'computed' | 'worded' | 'words-withheld';
  created_at: string;
}

export type DigestKind = 'monthly' | 'weekly-pulse' | 'client-publication';

/**
 * §20.2. `published` is false until she approves, and only `client-publication`
 * entries are ever served to a client (§14). The resolver enforces it server
 * side, not the UI.
 */
export interface Digest {
  id: string;
  profile_id: string;
  kind: DigestKind;
  period_start: string;
  period_end: string;
  /** Each section carries its own computed values. */
  sections: { id: string; heading: string; lines: string[] }[];
  coverage: { days_expected: number; days_covered: number; gaps: CoverageGap[] };
  verdict_ref?: string;
  published: boolean;
  approved_by?: string;
  approved_at?: string;
  supersedes?: string;
  run_id: string;
  created_at: string;
}

/** §9 (S16). The measuring stick, declared with its subject. */
export interface MeasurementDeclaration {
  /** `goal:<id>` or `pillar-job:<pillar id>`. */
  subject: string;
  metric_ids: string[];
  direction: 'up-is-better' | 'down-is-better';
  calculation: 'count' | 'rate' | 'difference';
  /** Required when `calculation: rate`; must itself be a catalogue metric. */
  denominator?: string | null;
  window: ObservationWindow;
  /** A value with a period, or the explicit token. Blank is never allowed. */
  target: { value: number; period: string } | 'direction-only';
  /** Computed from the catalogue, STORED, so a later platform change is visibly a change. */
  platform_availability: Record<string, 'available' | 'unavailable'>;
  /** `none` means analysis stays OFF for that subject. It is a decision, not a blank. */
  not_measurable_fallback:
    | 'not-measurable-on-this-platform'
    | `proxy:${string}`
    | 'manual-checkin'
    | 'none';
  declared_at?: string;
  declared_by?: string;
}
