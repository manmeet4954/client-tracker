// The switch registry — spec 21 §5, amendments S8 and S9, PLAN §3.4.
//
// Her law: EVERY feature registers its switch at birth. So this registry is
// exhaustive, including the things that can never be turned off — those carry
// `fixed: true` and `allowed_states: ['active']` rather than escaping the list.
//
// Defaults here are SUGGESTIONS. Migration never sets a position (spec 21 §9.6);
// she sets them after intake → curation → strategy, and a migrated profile keeps
// rendering exactly what it renders today until she does.

import type { PathState, SwitchConfig, SwitchDeclaration } from './contract.ts';
import { minState, stateRank } from './contract.ts';
import { DECLARATIONS, findDeclaration } from './declarations.ts';

const S = (s: SwitchDeclaration): SwitchDeclaration => s;

/** The wildcard platform switch. One real switch per platform entry. */
export const PLATFORM_SWITCH_PREFIX = 'platforms.';

export function platformSwitchId(platform: string): string {
  return PLATFORM_SWITCH_PREFIX + platform.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export const SWITCHES: SwitchDeclaration[] = [
  // ── Structural: fixed, but still on the list (spec 21 §5.4) ───────────────
  S({
    id: 'spine.fixed', owns: ['context', 'work-log', 'work-log/logs'], requires: [], dependents: [],
    audience: 'owner', allowed_states: ['active'], suggested_default: 'active', fixed: true,
    note: 'The frozen spine (law 1). Never moves.',
  }),
  S({
    id: 'strategy.fixed', owns: ['context/content-strategy'], requires: [], dependents: [],
    audience: 'both', allowed_states: ['active'], suggested_default: 'active', fixed: true,
    note: 'Strategy is not a switch — it is the always-on layer that OWNS the switchboard.',
  }),
  S({
    id: 'shelf.profiles', owns: ['shelf/profiles'], requires: [], dependents: [],
    audience: 'owner', allowed_states: ['active'], suggested_default: 'active', fixed: true,
  }),
  S({
    id: 'client_access.login', owns: [], requires: [], dependents: [
      'creation.review', 'creation.review_perception', 'assets.client_upload',
      'intake.questionnaire', 'references.from_client', 'creation.seed_input_client',
      'analysis.digest_client',
    ],
    audience: 'client', allowed_states: ['active', 'hidden'], suggested_default: 'hidden',
    derived_from: 'profile lifecycle + working-mode',
    note: 'A client login exists for this profile. Revoked at the `closing` lifecycle state (S22).',
  }),
  S({
    id: 'shelf.today_strip', owns: ['shelf/today-strip'], requires: ['logs.tasks'], dependents: [],
    audience: 'owner', allowed_states: ['active', 'hidden'], suggested_default: 'active',
    note: 'Her one cross-profile window (PLAN §2).',
  }),

  // ── Intake ────────────────────────────────────────────────────────────────
  S({
    id: 'intake.questionnaire',
    owns: ['context/intake', 'context/intake/questions', 'context/intake/answers'],
    requires: [], dependents: ['intake.rounds_reopen'],
    audience: 'both', allowed_states: ['active', 'history', 'hidden'], suggested_default: 'active',
    derived_from: 'delivery mode chosen per client',
    note: 'Retires from the client’s navigation once Context is curated; history stays (S10).',
  }),
  S({
    id: 'intake.finding_session', owns: ['context/intake/answers'], requires: ['intake.questionnaire'],
    dependents: [], audience: 'both', allowed_states: ['active', 'history', 'hidden'],
    suggested_default: 'hidden', derived_from: 'delivery mode chosen per client',
    note: 'The recorded meeting route. Same fields, different door.',
  }),
  S({
    id: 'intake.rounds_reopen', owns: ['context/intake'], requires: ['intake.questionnaire'],
    dependents: [], audience: 'owner', allowed_states: ['active', 'hidden'], suggested_default: 'active',
    note: 'Owner-triggered versioned reopen for selected parameters (S10).',
  }),

  // ── Strategy-owned parameters ─────────────────────────────────────────────
  S({
    id: 'strategy.visual_branding', owns: ['context/content-strategy/visual-branding'],
    requires: ['strategy.fixed'], dependents: [], audience: 'both',
    allowed_states: ['active'], suggested_default: 'active', fixed: true,
  }),

  // ── Platforms — the cascade parents ───────────────────────────────────────
  // One switch per platform entry; created for a profile from its platform list.
  ...['Instagram', 'LinkedIn', 'YouTube'].map(p =>
    S({
      id: platformSwitchId(p),
      owns: [`context/content-strategy/platforms/${p.toLowerCase()}`],
      requires: ['strategy.fixed'],
      dependents: ['creation.channels', 'analysis.tracking'],
      audience: 'both', allowed_states: ['active', 'history', 'hidden'],
      suggested_default: null,
      derived_from: 'the platforms this profile actually publishes on',
      note: `Turning ${p} off removes its formats, its strategy questions, its channel, and its analysis column — both sides.`,
    })),

  // ── Creation ──────────────────────────────────────────────────────────────
  S({
    id: 'creation.board', owns: ['work-log/creation'], requires: ['strategy.fixed'],
    dependents: ['creation.making', 'creation.review', 'creation.scheduling'],
    audience: 'both', allowed_states: ['active', 'history', 'hidden'], suggested_default: 'active',
  }),
  S({
    id: 'creation.engine', owns: ['work-log/creation/topics'], requires: ['creation.board'],
    dependents: [], audience: 'owner', allowed_states: ['active', 'history', 'hidden'],
    suggested_default: 'active',
  }),
  S({
    id: 'creation.seed_input_client', owns: ['work-log/creation/topics'],
    requires: ['creation.engine', 'client_access.login'], dependents: [],
    audience: 'client', allowed_states: ['active', 'hidden'], suggested_default: 'hidden',
    derived_from: 'working-mode: does this client bring ideas',
  }),
  S({
    id: 'creation.making', owns: ['work-log/creation/making'], requires: ['creation.board'],
    dependents: ['creation.making_handoff'], audience: 'owner',
    allowed_states: ['active', 'history', 'hidden'], suggested_default: 'active',
  }),
  S({
    id: 'creation.making_handoff', owns: ['work-log/creation/making'], requires: ['creation.making'],
    dependents: [], audience: 'owner', allowed_states: ['active', 'history', 'hidden'],
    suggested_default: 'hidden',
    note: 'The outside-tool round-trip contract (S18). Canva stays parked until its OAuth app exists.',
  }),
  S({
    id: 'creation.review', owns: ['work-log/creation/review'], requires: ['creation.board'],
    dependents: ['creation.review_public_link', 'creation.review_perception'],
    audience: 'both', allowed_states: ['active', 'history', 'hidden'], suggested_default: 'active',
    derived_from: 'working-mode: does the client approve, or does she have full authority',
  }),
  S({
    id: 'creation.review_public_link', owns: ['work-log/creation/review'], requires: ['creation.review'],
    dependents: [], audience: 'client', allowed_states: ['active', 'history', 'hidden'],
    suggested_default: 'active',
    derived_from: 'PLAN §11 Q2 — her answer',
    note: 'Her ruling: public preview links SURVIVE, default on for clients without logins. A client WITH a binding should land inside their review window instead (client-side regroup).',
  }),
  S({
    id: 'creation.review_perception', owns: ['work-log/analysis/client-perception'],
    requires: ['creation.review'], dependents: [], audience: 'client',
    allowed_states: ['active', 'history', 'hidden'], suggested_default: 'active',
    note: 'Give-point 4, captured at review and at the monthly call.',
  }),
  S({
    id: 'creation.scheduling', owns: ['work-log/creation/scheduling'], requires: ['creation.board'],
    dependents: ['creation.publishing'], audience: 'both',
    allowed_states: ['active', 'history', 'hidden'], suggested_default: 'active',
    derived_from: 'deliverables: do we schedule for this client',
  }),
  S({
    id: 'creation.publishing', owns: ['work-log/creation/scheduling'],
    requires: ['creation.scheduling', 'creation.channels'], dependents: [],
    audience: 'owner', allowed_states: ['active', 'hidden'], suggested_default: 'hidden',
    derived_from: 'posting ownership: we post or they post',
    note: 'Refused where the client posts, or where the channel carries no posting permission (S17).',
  }),
  S({
    id: 'creation.channels', owns: ['work-log/creation/channels'], requires: ['strategy.fixed'],
    dependents: [], audience: 'owner', allowed_states: ['active', 'history', 'hidden'],
    suggested_default: 'active',
  }),
  S({
    id: 'creation.funnel', owns: ['work-log/creation/funnel'], requires: ['creation.board'],
    dependents: ['creation.funnel_replies'], audience: 'owner',
    allowed_states: ['active', 'history', 'hidden'], suggested_default: 'hidden',
  }),
  S({
    id: 'creation.funnel_replies', owns: ['work-log/creation/funnel/replies'], requires: [],
    dependents: [], audience: 'owner', allowed_states: ['active', 'history', 'hidden'],
    suggested_default: 'hidden',
    note: 'On for Divine Studio today (Lead Answers). Off elsewhere until asked for.',
  }),

  // ── Assets and references ─────────────────────────────────────────────────
  S({
    id: 'assets.library', owns: ['work-log/assets', 'work-log/assets/sets'], requires: [],
    dependents: ['assets.client_upload', 'assets.drive_videos', 'assets.share_target',
      'assets.whatsapp_intake', 'assets.catalogue_export'],
    audience: 'both', allowed_states: ['active', 'history', 'hidden'], suggested_default: 'active',
  }),
  S({
    id: 'assets.client_upload', owns: ['work-log/assets/sets'],
    requires: ['assets.library', 'client_access.login'], dependents: [],
    audience: 'client', allowed_states: ['active', 'hidden'], suggested_default: 'active',
    note: 'Give-point 2.',
  }),
  S({
    id: 'assets.drive_videos', owns: ['work-log/assets/sets'], requires: ['assets.library'],
    dependents: [], audience: 'both', allowed_states: ['active', 'hidden'], suggested_default: 'active',
  }),
  S({
    id: 'assets.share_target', owns: ['work-log/assets/sets'], requires: ['assets.library'],
    dependents: [], audience: 'owner', allowed_states: ['active', 'hidden'], suggested_default: 'active',
    note: 'Android only (CLAUDE.md gotcha 4).',
  }),
  S({
    id: 'assets.whatsapp_intake', owns: ['work-log/assets/sets'],
    requires: ['assets.library', 'owner.whatsapp_inbox'], dependents: [],
    audience: 'owner', allowed_states: ['active', 'hidden'], suggested_default: 'hidden',
    note: 'Parked with spec 18B.',
  }),
  S({
    id: 'assets.catalogue_export', owns: ['work-log/assets/sets'], requires: ['assets.library'],
    dependents: [], audience: 'owner', allowed_states: ['active', 'hidden'], suggested_default: 'hidden',
    note: 'PLAN §7: the catalogue becomes an assets use-case behind a switch. On for Sonia.',
  }),
  S({
    id: 'references.our_vision', owns: ['work-log/references', 'work-log/references/our-vision'],
    requires: [], dependents: ['references.from_client'], audience: 'owner',
    allowed_states: ['active', 'history', 'hidden'], suggested_default: 'active',
  }),
  S({
    id: 'references.from_client', owns: ['work-log/references/from-client'],
    requires: ['references.our_vision'], dependents: [], audience: 'client',
    allowed_states: ['active', 'hidden'], suggested_default: 'active',
  }),

  // ── Logs ──────────────────────────────────────────────────────────────────
  S({
    id: 'logs.tasks', owns: ['work-log/logs/tasks'], requires: [], dependents: ['shelf.today_strip'],
    audience: 'both', allowed_states: ['active', 'history', 'hidden'], suggested_default: 'active',
  }),
  S({
    id: 'logs.decisions', owns: ['work-log/logs/decisions'], requires: [], dependents: [],
    audience: 'owner', allowed_states: ['active', 'history', 'hidden'], suggested_default: 'active',
  }),
  S({
    id: 'logs.requests', owns: ['work-log/logs/requests'], requires: [], dependents: [],
    audience: 'both', allowed_states: ['active', 'history', 'hidden'], suggested_default: 'active',
  }),
  S({
    id: 'logs.changes', owns: ['work-log/logs/changes'], requires: [], dependents: [],
    audience: 'owner', allowed_states: ['active', 'history', 'hidden'], suggested_default: 'active',
  }),
  S({
    id: 'logs.pipelines.lists', owns: ['work-log/logs/pipelines', 'work-log/logs/pipelines/lists'],
    requires: [], dependents: [], audience: 'owner',
    allowed_states: ['active', 'history', 'hidden'], suggested_default: 'active',
  }),
  S({
    id: 'logs.pipelines.cold_calls', owns: ['work-log/logs/pipelines/cold-calls'], requires: [],
    dependents: [], audience: 'owner', allowed_states: ['active', 'history', 'hidden'],
    suggested_default: 'hidden',
  }),
  S({
    id: 'logs.pipelines.orders', owns: ['work-log/logs/pipelines/orders'], requires: [],
    dependents: [], audience: 'owner', allowed_states: ['active', 'history', 'hidden'],
    suggested_default: 'hidden',
  }),
  S({
    id: 'logs.effort_meter', owns: ['work-log/logs/effort'], requires: [],
    dependents: ['logs.effort_money'], audience: 'owner',
    allowed_states: ['active', 'history', 'hidden'], suggested_default: 'hidden',
    derived_from: 'PLAN §7: her own profiles only',
    note: 'Refused on any profile whose owner_kind is `client`.',
  }),
  S({
    id: 'logs.effort_money', owns: ['work-log/logs/effort'], requires: ['logs.effort_meter'],
    dependents: [], audience: 'owner', allowed_states: ['active', 'history', 'hidden'],
    suggested_default: 'hidden', derived_from: 'PLAN §7: her own profiles only',
  }),
  S({
    id: 'logs.observations', owns: ['work-log/logs/observations'], requires: [], dependents: [],
    audience: 'owner', allowed_states: ['active', 'history', 'hidden'], suggested_default: 'active',
  }),

  // ── Analysis ──────────────────────────────────────────────────────────────
  S({
    id: 'analysis.tracking', owns: ['work-log/analysis/study-own-data'], requires: ['creation.channels'],
    dependents: ['analysis.scorecard', 'analysis.funnel', 'analysis.bifurcation',
      'analysis.compare', 'analysis.ai_tagging_fallback', 'analysis.digest_owner'],
    audience: 'owner', allowed_states: ['active', 'history'], suggested_default: 'active',
    note: 'Recording is the engine’s first duty. Every day not recorded is gone.',
  }),
  S({
    id: 'analysis.ai_tagging_fallback', owns: ['work-log/analysis/study-own-data'],
    requires: ['analysis.tracking'], dependents: [], audience: 'owner',
    allowed_states: ['active', 'hidden'], suggested_default: 'active',
    note: 'FALLBACK only — the piece’s own pillar and costume are the primary tag source.',
  }),
  S({
    id: 'analysis.scorecard', owns: ['work-log/analysis'], requires: ['analysis.tracking'],
    dependents: [], audience: 'both', allowed_states: ['active', 'history', 'hidden'],
    suggested_default: 'active',
    note: 'Each pillar judged only on its job’s metrics.',
  }),
  S({
    id: 'analysis.funnel', owns: ['work-log/analysis'], requires: ['analysis.tracking'],
    dependents: [], audience: 'owner', allowed_states: ['active', 'history', 'hidden'],
    suggested_default: 'hidden',
  }),
  S({
    id: 'analysis.bifurcation', owns: ['work-log/analysis'], requires: ['analysis.tracking'],
    dependents: [], audience: 'owner', allowed_states: ['active', 'history', 'hidden'],
    suggested_default: 'active',
    note: 'Every birth parameter is a filter — no tagging chore.',
  }),
  S({
    id: 'analysis.goal_tracking', owns: ['work-log/analysis/goal-tracking'], requires: [],
    dependents: [], audience: 'both', allowed_states: ['active', 'history', 'hidden'],
    suggested_default: 'active',
    note: 'Blocked per goal until that goal carries its S16 metric declaration.',
  }),
  S({
    id: 'analysis.compare', owns: ['work-log/analysis/comparisons'], requires: ['analysis.tracking'],
    dependents: [], audience: 'owner', allowed_states: ['active', 'history', 'hidden'],
    suggested_default: 'active',
    note: 'Matched comparisons only, at equivalent ages (S5, S6).',
  }),
  S({
    id: 'analysis.digest_owner', owns: ['work-log/analysis/digests'], requires: ['analysis.tracking'],
    dependents: ['analysis.digest_client'], audience: 'owner',
    allowed_states: ['active', 'history', 'hidden'], suggested_default: 'active',
  }),
  S({
    id: 'analysis.digest_client', owns: ['work-log/analysis/digests'],
    requires: ['analysis.digest_owner', 'client_access.login'], dependents: [],
    audience: 'client', allowed_states: ['active', 'hidden'], suggested_default: 'hidden',
    note: 'Drafted by the engine, approved or edited by her first (CLAUDE.md rule 1).',
  }),
  S({
    id: 'analysis.soft_signals', owns: ['work-log/analysis/client-perception', 'work-log/logs/observations'],
    requires: [], dependents: [], audience: 'owner',
    allowed_states: ['active', 'history', 'hidden'], suggested_default: 'active',
    note: 'Recorded lightly, outside the engine’s math.',
  }),
  S({
    id: 'analysis.market_research', owns: ['work-log/analysis/market-research'], requires: [],
    dependents: [], audience: 'owner', allowed_states: ['active', 'history', 'hidden'],
    suggested_default: 'hidden',
  }),

  // ── Owner-level capture routes ────────────────────────────────────────────
  S({
    id: 'owner.chat', owns: ['frozen/chat-log', 'frozen/observations-inbox'], requires: [],
    dependents: ['owner.whatsapp_inbox'], audience: 'owner',
    allowed_states: ['active', 'history'], suggested_default: 'active',
    note: 'HELD by her ruling (PLAN §11 Q1): the chat keeps working exactly as today, outside the tree, until its own spec.',
  }),
  S({
    id: 'owner.whatsapp_inbox', owns: [], requires: ['owner.chat'], dependents: [],
    audience: 'owner', allowed_states: ['active', 'hidden'], suggested_default: 'hidden',
    note: 'Parked: registration dead-ended at Meta’s PIN step.',
  }),

  // ── Dispositions ──────────────────────────────────────────────────────────
  S({
    id: 'frozen.legacy', owns: [], requires: [], dependents: [], audience: 'owner',
    allowed_states: ['history'], suggested_default: 'history', fixed: true,
    note: 'Retained, read-only, not rendered, not migrated. Nothing is deleted.',
  }),
  S({
    id: 'leaves.exported', owns: [], requires: [], dependents: [], audience: 'owner',
    allowed_states: ['history'], suggested_default: 'history', fixed: true,
    note: 'PLAN §7: exported to the vault, then removed only on her word.',
  }),
];

// ── Lookup and resolution ────────────────────────────────────────────────────

const BY_ID = new Map<string, SwitchDeclaration>();
for (const s of SWITCHES) {
  if (BY_ID.has(s.id)) throw new Error(`[tree] duplicate switch: ${s.id}`);
  BY_ID.set(s.id, s);
}

export function findSwitch(id: string): SwitchDeclaration | null {
  return BY_ID.get(id) ?? null;
}

export function switchExists(id: string): boolean {
  if (BY_ID.has(id)) return true;
  // Platform switches are born with their platform entry (law 3).
  return id.startsWith(PLATFORM_SWITCH_PREFIX);
}

/** The switch that governs a CONCRETE path (wildcards resolved to the entry). */
export function switchForPath(path: string): string | null {
  const dec = findDeclaration(path);
  if (!dec) return null;
  if (dec.switch !== 'platforms.*') return dec.switch;
  const parts = path.split('/');
  const i = parts.indexOf('platforms');
  const entry = i >= 0 ? parts[i + 1] : undefined;
  return entry && entry !== '*' ? platformSwitchId(entry) : 'platforms.*';
}

/** A switch declaration for a platform that exists on this profile. */
export function platformSwitch(platform: string): SwitchDeclaration {
  const id = platformSwitchId(platform);
  return findSwitch(id) ?? {
    id,
    owns: [`context/content-strategy/platforms/${platform.toLowerCase()}`],
    requires: ['strategy.fixed'],
    dependents: ['creation.channels', 'analysis.tracking'],
    audience: 'both',
    allowed_states: ['active', 'history', 'hidden'],
    suggested_default: null,
    derived_from: 'the platforms this profile actually publishes on',
  };
}

/**
 * Effective state (spec 21 §5.2): the MINIMUM of a switch's own position and
 * every prerequisite's effective state, computed transitively.
 * A switch with no position set is treated as its suggested default; a switch
 * with neither is `hidden` — nothing renders on a guess.
 */
export function effectiveState(id: string, config: SwitchConfig): PathState {
  return resolve(id, config, new Set());
}

function resolve(id: string, config: SwitchConfig, seen: Set<string>): PathState {
  if (seen.has(id)) return 'hidden'; // a cycle can never be trusted into `active`
  seen.add(id);
  const dec = findSwitch(id) ?? (id.startsWith(PLATFORM_SWITCH_PREFIX) ? platformSwitch(id.slice(PLATFORM_SWITCH_PREFIX.length)) : null);
  if (!dec) return 'hidden';
  const own = config[id]?.state ?? dec.suggested_default ?? 'hidden';
  let state: PathState = own;
  for (const req of dec.requires) {
    state = minState(state, resolve(req, config, new Set(seen)));
  }
  return state;
}

/** Is this concrete path live for this profile right now? */
export function pathState(path: string, config: SwitchConfig): PathState {
  const id = switchForPath(path);
  if (!id) throw new Error(`[tree] no address: "${path}" is not declared (PLAN law 4)`);
  const dec = findDeclaration(path)!;
  const eff = effectiveState(id, config);
  // A path can never be more active than its own declaration allows.
  return dec.states.includes(eff) ? eff : minState(eff, dec.states[dec.states.length - 1]);
}

/**
 * The cascade set: everything that goes away with this switch (PLAN §3.4).
 * Returns switch ids and the concrete paths they own — her side and the
 * client's, because connections carry activation as well as data.
 */
export function cascadeOf(id: string): { switches: string[]; paths: string[] } {
  const switches = new Set<string>();
  const walk = (sid: string) => {
    const dec = findSwitch(sid) ?? (sid.startsWith(PLATFORM_SWITCH_PREFIX) ? platformSwitch(sid.slice(PLATFORM_SWITCH_PREFIX.length)) : null);
    if (!dec) return;
    for (const d of dec.dependents) {
      if (switches.has(d)) continue;
      switches.add(d);
      walk(d);
    }
  };
  walk(id);
  // Anything that REQUIRES this switch cannot outlive it either.
  for (const s of SWITCHES) {
    if (s.requires.includes(id)) switches.add(s.id);
  }
  const paths = new Set<string>();
  const own = findSwitch(id) ?? (id.startsWith(PLATFORM_SWITCH_PREFIX) ? platformSwitch(id.slice(PLATFORM_SWITCH_PREFIX.length)) : null);
  for (const p of own?.owns ?? []) paths.add(p);
  for (const sid of switches) {
    const s = findSwitch(sid);
    for (const p of s?.owns ?? []) paths.add(p);
  }
  return { switches: [...switches], paths: [...paths] };
}

/**
 * What disappears when a PLATFORM is turned off — the plan's canonical trace,
 * kept as a function so the cascade test reads like her sentence (PLAN §3.4).
 */
export function platformCascade(platform: string): {
  switchId: string;
  formats: string;
  strategyQuestions: string[];
  channels: string;
  analysisColumn: string;
} {
  const key = platform.toLowerCase();
  return {
    switchId: platformSwitchId(platform),
    formats: `context/content-strategy/platforms/${key}/formats`,
    strategyQuestions: [
      `context/content-strategy/platforms/${key}/how-it-works`,
      `context/content-strategy/platforms/${key}/rules`,
      `context/content-strategy/platforms/${key}/connection`,
    ],
    channels: 'work-log/creation/channels',
    analysisColumn: 'work-log/analysis/study-own-data',
  };
}

// ── Validation at strategy lock (S8, spec 21 §5.3) ───────────────────────────

export interface SwitchValidationContext {
  config: SwitchConfig;
  /** `hers` unlocks the effort and money meters (PLAN §7). */
  owner_kind: 'client' | 'hers';
  /** Channels with their platform and whether we may post from them (S17). */
  channels?: { id: string; platform: string; canPost: boolean }[];
  /** Goals that carry an S16 metric declaration. */
  goalsWithMetricDeclaration?: string[];
  goals?: string[];
  /** working-mode: does the client post, or do we? */
  postingOwnership?: 'we-post' | 'client-posts';
  clientAccess?: boolean;
}

export interface SwitchViolation {
  switch: string;
  reason: string;
}

/** Contradictions refuse activation — the strategy cannot lock with them present. */
export function validateSwitchConfig(ctx: SwitchValidationContext): SwitchViolation[] {
  const out: SwitchViolation[] = [];
  const stateOf = (id: string): PathState =>
    ctx.config[id]?.state ?? findSwitch(id)?.suggested_default ?? 'hidden';

  for (const id of Object.keys(ctx.config)) {
    const dec = findSwitch(id) ?? (id.startsWith(PLATFORM_SWITCH_PREFIX) ? platformSwitch(id.slice(PLATFORM_SWITCH_PREFIX.length)) : null);
    if (!dec) { out.push({ switch: id, reason: 'not in the switch registry' }); continue; }
    const own = ctx.config[id].state;
    if (!dec.allowed_states.includes(own)) {
      out.push({ switch: id, reason: `state "${own}" is not allowed for this switch` });
    }
    if (dec.fixed && own !== (dec.suggested_default ?? 'active')) {
      out.push({ switch: id, reason: 'this switch is structural and cannot be moved' });
    }
    // No `active` switch with a non-`active` prerequisite.
    if (own === 'active') {
      for (const req of dec.requires) {
        if (stateOf(req) !== 'active') {
          out.push({ switch: id, reason: `requires "${req}", which is ${stateOf(req)}` });
        }
      }
    }
  }

  // No channel active on a hidden platform.
  if (stateOf('creation.channels') === 'active') {
    for (const ch of ctx.channels ?? []) {
      const ps = stateOf(platformSwitchId(ch.platform));
      if (ps !== 'active') {
        out.push({ switch: 'creation.channels', reason: `channel "${ch.id}" is on platform ${ch.platform}, which is ${ps}` });
      }
    }
  }

  // No client-audience switch active while client access is off (S22).
  if (ctx.clientAccess === false) {
    for (const s of SWITCHES) {
      if (s.audience === 'client' && stateOf(s.id) === 'active') {
        out.push({ switch: s.id, reason: 'client-facing switch is active while this profile has no client access' });
      }
    }
  }

  // No analysis switch active for a goal with no metric declaration (S16).
  if (stateOf('analysis.goal_tracking') === 'active') {
    const declared = new Set(ctx.goalsWithMetricDeclaration ?? []);
    for (const g of ctx.goals ?? []) {
      if (!declared.has(g)) {
        out.push({ switch: 'analysis.goal_tracking', reason: `goal "${g}" has no metric declaration (S16)` });
      }
    }
  }

  // No publishing where the client posts, or where no channel may post (S17).
  if (stateOf('creation.publishing') === 'active') {
    if (ctx.postingOwnership === 'client-posts') {
      out.push({ switch: 'creation.publishing', reason: 'working-mode says the client posts' });
    }
    if ((ctx.channels ?? []).length > 0 && !(ctx.channels ?? []).some(c => c.canPost)) {
      out.push({ switch: 'creation.publishing', reason: 'no channel carries posting permission' });
    }
  }

  // The effort and money meters live only in her own profiles (PLAN §7).
  if (ctx.owner_kind === 'client') {
    for (const id of ['logs.effort_meter', 'logs.effort_money']) {
      if (stateOf(id) === 'active') {
        out.push({ switch: id, reason: 'PLAN §7: this lives only in her own profiles' });
      }
    }
  }

  return out;
}

/** Every switch a profile needs a position for, given its platforms. */
export function switchesForProfile(platforms: string[]): SwitchDeclaration[] {
  const extra = platforms
    .filter(p => !findSwitch(platformSwitchId(p)))
    .map(p => platformSwitch(p));
  return [...SWITCHES, ...extra];
}

/** Every declared path that names a switch, for the registry integrity check. */
export function pathsBySwitch(): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const d of DECLARATIONS) {
    const list = m.get(d.switch) ?? [];
    list.push(d.path);
    m.set(d.switch, list);
  }
  return m;
}

export { stateRank };
