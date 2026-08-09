// The content-strategy derivation map, the gate set, the switchboard and the
// lock — spec 22 §8.
//
// content-strategy is "not collected. DERIVED by her from personal-details +
// business-details. This is what a brand book deliverable really is. Locked
// before any content is created." (PLAN §3.4.) This file is the machinery of
// the room where that happens.
//
// Strategy is NOT a switch (PLAN §3.10): it is the always-on layer that owns
// the switchboard. It is present in every profile, owner-only, and cannot be
// turned off.
//
// Nothing here generates a strategy value. No AI writes strategy (§8.3, §15).

import type { ClientData } from '../../types/index.ts';
import type { PathState, SwitchConfig } from '../tree/contract.ts';
import type { BodyEntry, Gate, GateSet, Lifecycle, Provenance } from '../tree/objects.ts';
import { OPERATIONAL_GATES } from '../tree/objects.ts';
import type { ProfileBody } from '../tree/body.ts';
import { putEntry, readPath } from '../tree/body.ts';
import { findDeclaration } from '../tree/declarations.ts';
import {
  SWITCHES, effectiveState, findSwitch, platformSwitchId, switchesForProfile, validateSwitchConfig,
} from '../tree/switches.ts';
import { PARAMETERS, findParameter } from '../intake/parameters.ts';

const CS = 'context/content-strategy';

export const TOOLSET_PATH = `${CS}/toolset`;
export const GATES_PATH = `${CS}/gates`;
export const CHANNELS_PATH = 'work-log/creation/channels';

// ── §8.1 The derivation map ──────────────────────────────────────────────────
// Which detail parameters feed which strategy parameter. This IS law 3 written
// at parameter level, and it is what the surface puts on screen.

export interface DerivationRow {
  /** The strategy parameter's declared path. */
  path: string;
  label: string;
  /** Registry parameter ids (spec 22 §4). */
  from_parameters: string[];
  /** Other strategy parameters it derives from. */
  from_strategy: string[];
  /** Where the source is the universal library rather than this client. */
  from_universal?: string;
  /** Where she declares it herself, outside intake. */
  owner_declared?: string;
  /** Counted by the lock's "every strategy parameter" conditions (§8.6). */
  lockable: boolean;
}

const R = (r: DerivationRow): DerivationRow => r;

export const DERIVATION_MAP: DerivationRow[] = [
  R({
    path: `${CS}/positioning`, label: 'Positioning', lockable: true,
    from_parameters: ['identity.one-line', 'identity.credentials', 'journey.origin', 'journey.why',
      'market.usp', 'offers.hero', 'audience.best-customer'],
    from_strategy: [],
  }),
  R({
    path: `${CS}/platforms`, label: 'Platforms', lockable: true,
    from_parameters: ['materials.existing-accounts', 'audience.where', 'numbers.production', 'camera.face'],
    from_strategy: [],
  }),
  R({
    path: `${CS}/platforms/*/formats`, label: 'Formats, per platform', lockable: false,
    from_parameters: ['camera.face', 'numbers.production'],
    from_strategy: [],
    from_universal: 'the universal format library per platform, narrowed by what this client can actually make',
  }),
  R({
    path: `${CS}/platforms/*/rules`, label: 'Format rules, per platform', lockable: false,
    from_parameters: [], from_strategy: [],
    from_universal: 'universal format rules, overridden per client as the relationship matures (PLAN §5.1: override beats universal, always)',
  }),
  R({
    path: `${CS}/pillars`, label: 'Pillars', lockable: true,
    from_parameters: ['ambitions.known-or-sold', 'audience.pain', 'offers.hero', 'market.usp', 'journey.why'],
    from_strategy: [],
  }),
  R({
    path: `${CS}/pillars/*/job`, label: 'Pillar job', lockable: false,
    from_parameters: ['ambitions.known-or-sold', 'ambitions.six-months'],
    from_strategy: [],
  }),
  R({
    path: `${CS}/pillars/*/mix-target`, label: 'Pillar mix target', lockable: false,
    from_parameters: ['ambitions.known-or-sold'],
    from_strategy: [`${CS}/cadence`],
  }),
  R({
    path: `${CS}/voice`, label: 'Voice', lockable: true,
    from_parameters: ['voice.natural-tone', 'voice.sounds-like', 'voice.never-sounds-like',
      'voice.words-they-hate', 'voice.pace', 'audience.dm-words'],
    from_strategy: [],
  }),
  R({
    path: `${CS}/audience-decided`, label: 'Audience, decided', lockable: true,
    from_parameters: ['audience.best-customer', 'audience.where', 'audience.search-words',
      'audience.dm-words', 'audience.pain'],
    from_strategy: [],
    from_universal: 'plus the stage lens: unaware to existing customer (PLAN §5.1)',
  }),
  R({
    path: `${CS}/goals`, label: 'Goals', lockable: true,
    from_parameters: ['ambitions.six-months', 'ambitions.known-or-sold', 'buying.where', 'offers.hero'],
    from_strategy: [],
    owner_declared: 'plus an S16 metric declaration per goal, which she writes at the switchboard step',
  }),
  R({
    path: `${CS}/funnel-shape`, label: 'Funnel shape', lockable: true,
    from_parameters: ['buying.last-sale', 'buying.where', 'buying.next-step', 'buying.attribution'],
    from_strategy: [],
  }),
  R({
    path: `${CS}/ctas`, label: 'CTAs', lockable: true,
    from_parameters: ['buying.next-step', 'offers.hero', 'buying.where'],
    from_strategy: [],
  }),
  R({
    path: `${CS}/visual-branding`, label: 'Visual branding', lockable: true,
    from_parameters: ['materials.brand-book', 'materials.logo-files'],
    from_strategy: [],
  }),
  R({
    path: `${CS}/proof-library`, label: 'Proof library', lockable: true,
    from_parameters: ['history.wins', 'offers.list', 'market.usp'],
    from_strategy: [],
    owner_declared: 'every item carries its rights record (S21)',
  }),
  R({
    path: `${CS}/boundaries`, label: 'Boundaries', lockable: true,
    from_parameters: ['audience.unwanted', 'voice.words-they-hate', 'market.usp', 'pains.growth-worry'],
    from_strategy: [],
  }),
  R({
    path: `${CS}/cadence`, label: 'Cadence', lockable: true,
    from_parameters: ['numbers.sustainable-output', 'numbers.production'],
    from_strategy: [],
  }),
  R({
    path: `${CS}/working-mode`, label: 'Working mode', lockable: true,
    from_parameters: ['materials.existing-accounts', 'numbers.production'],
    from_strategy: [],
    owner_declared: 'plus her commercial agreement, which is hers and never comes from intake',
  }),
  R({
    path: `${CS}/obligations`, label: 'Obligations', lockable: true,
    from_parameters: ['materials.brand-book', 'materials.logo-files', 'materials.photo-bank',
      'materials.old-content', 'materials.existing-accounts', 'numbers.production'],
    from_strategy: [`${CS}/working-mode`],
  }),
  R({
    path: GATES_PATH, label: 'Gate set', lockable: false,
    from_parameters: [], from_strategy: [`${CS}/voice`, `${CS}/positioning`],
    from_universal: 'S14: the five brand gates come out of strategy, never a separate questionnaire',
  }),
  R({
    path: TOOLSET_PATH, label: 'Switchboard', lockable: false,
    from_parameters: [], from_strategy: [`${CS}`],
    from_universal: 'the whole strategy: the switchboard step (§8.5)',
  }),
];

const ROW_BY_PATH = new Map(DERIVATION_MAP.map(r => [r.path, r]));

export function derivationRow(path: string): DerivationRow | null {
  return ROW_BY_PATH.get(path) ?? null;
}

/** The strategy parameters the lock counts (§8.6 conditions 1 and 2). */
export const LOCKABLE_STRATEGY_PATHS = DERIVATION_MAP.filter(r => r.lockable).map(r => r.path);

/** Which strategy parameters read this detail parameter — the map, inverted. */
export function readersOfParameter(parameterId: string): string[] {
  return DERIVATION_MAP.filter(r => r.from_parameters.includes(parameterId)).map(r => r.path);
}

// ── §8.2 The workspace, and §8.3 what it refuses ─────────────────────────────

/** One strategy parameter's stored decision. */
export interface StrategyValue {
  key: string;
  value: unknown;
  /** An explicit "not applicable", which still needs its reason. */
  not_applicable?: boolean;
  /** REQUIRED. Spec 09's citation rule as a data requirement, not an AI feature. */
  reason: string;
  /** Decided ahead of the evidence: allowed, visible, counted in the lock report. */
  owner_declared?: boolean;
  /** The curated detail parameters she cited. */
  sources: string[];
  /** Stamped at the lock; null while it is a working edit (§8.8, §10). */
  strategy_version: number | null;
}

export interface SourceReading {
  parameter_id: string;
  label: string;
  path: string;
  /** The curated value, if one exists. */
  value: unknown;
  confidence: string | null;
  curated: boolean;
}

/** The sources panel (§8.2 part 1). A missing or unknown source SAYS SO here —
 *  this is where "we never asked them that" becomes visible instead of silent. */
export function sourcesFor(body: ProfileBody, path: string): SourceReading[] {
  const row = derivationRow(path);
  if (!row) return [];
  return row.from_parameters.map(id => {
    const p = findParameter(id);
    const entries = p ? readPath(body, p.path) : [];
    const hit = entries.find(e => e.id === id && e.state === 'active');
    return {
      parameter_id: id,
      label: p?.label ?? id,
      path: p?.path ?? '',
      value: hit ? (hit.data as { value?: unknown }).value ?? null : null,
      confidence: hit?.provenance?.confidence ?? null,
      curated: !!hit,
    };
  });
}

/**
 * §8.3: a strategy parameter cannot be written before at least one of its
 * declared sources is curated. If she wants to decide ahead of the evidence she
 * marks it `owner_declared` with a reason — allowed, visible, and counted.
 */
export function mayWriteStrategy(
  body: ProfileBody, path: string, ownerDeclared = false,
): { ok: true } | { ok: false; why: string } {
  const row = derivationRow(path);
  if (!row) return { ok: false, why: `${path} is not a strategy parameter in the derivation map` };
  if (ownerDeclared) return { ok: true };
  if (row.from_parameters.length === 0) return { ok: true };
  const any = sourcesFor(body, path).some(s => s.curated);
  if (!any) {
    return {
      ok: false,
      why: 'none of its sources is curated yet. Curate one, or mark this owner declared with a reason.',
    };
  }
  return { ok: true };
}

/** The current decision at a strategy folder. Past versions live beside it at
 *  `decision-v<n>`, state `history` — readable forever, never overwritten. */
export const DECISION_ENTRY = 'decision';

function decisionEntry(body: ProfileBody, path: string): BodyEntry | null {
  return readPath(body, path).find(e => e.id === DECISION_ENTRY && e.state === 'active') ?? null;
}

export function readStrategy(body: ProfileBody, path: string): StrategyValue | null {
  const hit = decisionEntry(body, path);
  return hit ? (hit.data as unknown as StrategyValue) : null;
}

/** Every locked version of one strategy parameter, oldest first (§8.8). */
export function strategyHistory(body: ProfileBody, path: string): StrategyValue[] {
  return readPath(body, path)
    .filter(e => e.id.startsWith(`${DECISION_ENTRY}-v`))
    .map(e => e.data as unknown as StrategyValue);
}

function provenanceFor(value: StrategyValue, now: string, curator: string): Provenance {
  return {
    source_refs: value.sources.length ? value.sources : [`owner-direct:${value.reason}`],
    curator, at: now, confidence: value.owner_declared ? 'inferred' : 'confirmed',
  };
}

/**
 * Write one strategy decision. A change to an already-locked parameter archives
 * the locked version at `decision-v<n>` first, so analysis can still read a
 * piece against the strategy version that existed when it was born (S15), and
 * the new working edit carries `strategy_version: null` until she locks again.
 * A working edit is invisible to the client (§8.8, §10).
 */
export function writeStrategy(
  body: ProfileBody, path: string, value: StrategyValue, now: string, curator = 'owner',
): ProfileBody {
  const dec = findDeclaration(path);
  if (!dec) throw new Error(`[strategy] no address, no write: "${path}"`);
  let next = body;
  const current = decisionEntry(body, path);
  const locked = current ? (current.data as unknown as StrategyValue).strategy_version : null;
  if (current && typeof locked === 'number') {
    next = putEntry(next, path, {
      id: `${DECISION_ENTRY}-v${locked}`, type: dec.entry_type, data: current.data,
      provenance: current.provenance, state: 'history',
    }, { writer: 'owner', now });
  }
  const working: StrategyValue = { ...value, strategy_version: null };
  return putEntry(next, path, {
    id: DECISION_ENTRY, type: dec.entry_type,
    data: working as unknown as Record<string, unknown>,
    provenance: provenanceFor(working, now, curator),
  }, { writer: 'owner', now });
}

/** The lock's stamp. Only `lockStrategy` calls it (§8.6). */
function stampStrategy(body: ProfileBody, path: string, version: number, now: string): ProfileBody {
  const dec = findDeclaration(path)!;
  const current = decisionEntry(body, path)!;
  const stamped: StrategyValue = {
    ...(current.data as unknown as StrategyValue), strategy_version: version,
  };
  return putEntry(body, path, {
    id: DECISION_ENTRY, type: dec.entry_type,
    data: stamped as unknown as Record<string, unknown>, provenance: current.provenance,
  }, { writer: 'owner', now });
}

/**
 * Spec 25 §8.4: her acceptance of a feedback diff creates strategy parameter
 * version N+1 DIRECTLY — dated, with the feedback as its reason line — rather
 * than a working edit waiting for another whole-strategy lock. Spec 22 §8.8
 * always allowed one parameter to change after the lock; this is that path, and
 * the archived version stays readable at `decision-v<n>` exactly as before.
 *
 * The strategy changelog gets its entry for free, because `strategyHistory`
 * already reads the archive.
 */
export function nextStrategyVersionFor(body: ProfileBody, path: string): number {
  const current = readStrategy(body, path);
  const at = typeof current?.strategy_version === 'number'
    ? current.strategy_version
    : body.strategy_version ?? 0;
  return at + 1;
}

export function writeStrategyVersion(
  body: ProfileBody, path: string, value: Omit<StrategyValue, 'strategy_version'>,
  version: number, now: string, curator = 'owner',
): ProfileBody {
  const dec = findDeclaration(path);
  if (!dec) throw new Error(`[strategy] no address, no write: "${path}"`);
  let next = body;
  const current = decisionEntry(body, path);
  const locked = current ? (current.data as unknown as StrategyValue).strategy_version : null;
  if (current && typeof locked === 'number') {
    next = putEntry(next, path, {
      id: `${DECISION_ENTRY}-v${locked}`, type: dec.entry_type, data: current.data,
      provenance: current.provenance, state: 'history',
    }, { writer: 'owner', now });
  }
  const stamped: StrategyValue = { ...value, strategy_version: version };
  return putEntry(next, path, {
    id: DECISION_ENTRY, type: dec.entry_type,
    data: stamped as unknown as Record<string, unknown>,
    provenance: provenanceFor(stamped, now, curator),
  }, { writer: 'owner', now });
}

// ── §8.4 The gate set, v1 (S14) ──────────────────────────────────────────────

export const BRAND_GATE_COUNT = 5;

export interface GateDraft {
  id: string;
  name: string;
  question: string;
  /** The voice or positioning line it came from. Shown beside the slot. */
  from: string;
}

/** The lines the five slots may be built from: voice and positioning only.
 *  There is no gate questionnaire (PLAN §5.1 item 3). */
export function gateSources(body: ProfileBody): { voice: StrategyValue | null; positioning: StrategyValue | null } {
  return { voice: readStrategy(body, `${CS}/voice`), positioning: readStrategy(body, `${CS}/positioning`) };
}

export function gateSetViolations(body: ProfileBody, gates: GateDraft[]): string[] {
  const out: string[] = [];
  const { voice, positioning } = gateSources(body);
  if (!voice) out.push('voice is empty, and the brand gates come out of it');
  if (!positioning) out.push('positioning is empty, and the brand gates come out of it');
  const filled = gates.filter(g => g.name.trim() && g.question.trim());
  if (filled.length < BRAND_GATE_COUNT) {
    out.push(`the gate set needs ${BRAND_GATE_COUNT} brand gates, and ${filled.length} are written`);
  }
  return out;
}

/** The versioned set: five brand gates plus the two fixed operational ones. */
export function buildGateSet(gates: GateDraft[], version: number, strategyVersion: number, now: string): GateSet {
  const brand: Gate[] = gates
    .filter(g => g.name.trim() && g.question.trim())
    .map(g => ({ id: g.id, name: g.name.trim(), question: g.question.trim(), kind: 'brand' as const }));
  return {
    version,
    locked_with_strategy_version: strategyVersion,
    gates: [...brand, ...OPERATIONAL_GATES],
    locked_at: now,
  };
}

export function readGateSet(body: ProfileBody): GateSet | null {
  const entries = readPath(body, GATES_PATH).filter(e => e.state === 'active');
  const hit = entries[entries.length - 1];
  return hit ? (hit.data as unknown as GateSet) : null;
}

export function writeGateSet(body: ProfileBody, set: GateSet, now: string): ProfileBody {
  return putEntry(body, GATES_PATH, {
    id: `gates-v${set.version}`, type: 'gate_set', data: set as unknown as Record<string, unknown>,
  }, { writer: 'owner', now });
}

// ── §8.5 The switchboard step ────────────────────────────────────────────────

export interface SwitchPosition {
  id: string;
  state: PathState;
  set_at: string;
  strategy_version?: number;
  /** True while this is still only a suggestion nobody confirmed (§8.5). */
  suggested?: boolean;
}

/** Her positions, read out of the toolset folder. */
export function switchConfigFromBody(body: ProfileBody): SwitchConfig {
  const config: SwitchConfig = {};
  for (const e of readPath(body, TOOLSET_PATH)) {
    if (e.state !== 'active') continue;
    const d = e.data as unknown as SwitchPosition;
    config[d.id] = {
      state: d.state, set_at: d.set_at, strategy_version: d.strategy_version, suggested: d.suggested,
    };
  }
  return config;
}

export function setSwitchPosition(
  body: ProfileBody, id: string, state: PathState, now: string, suggested = false,
): ProfileBody {
  return putEntry(body, TOOLSET_PATH, {
    id, type: 'switch_setting',
    data: { id, state, set_at: now, suggested } as unknown as Record<string, unknown>,
  }, { writer: 'owner', now });
}

/** Every switch this profile needs a position for. Structural switches carry
 *  their own fixed state and are not hers to move (spec 21 §5.4). */
export function switchesNeedingPosition(platforms: string[]): string[] {
  return switchesForProfile(platforms).filter(s => !s.fixed).map(s => s.id);
}

/** §8.5: a suggestion is not a setting. `suggested: true` counts as unset. */
export function unsetSwitches(body: ProfileBody, platforms: string[]): string[] {
  const config = switchConfigFromBody(body);
  return switchesNeedingPosition(platforms)
    .filter(id => !config[id] || config[id].suggested === true);
}

/** The cascade preview beside every switch: what goes away if she moves it,
 *  her side AND the client's, because switches design her dashboard too. */
export function switchAudience(id: string): 'owner' | 'client' | 'both' {
  return findSwitch(id)?.audience ?? 'owner';
}

// ── §8.6 The lock — one act ──────────────────────────────────────────────────

export interface LockFailure {
  /** Which of the six conditions in §8.6 refused. */
  condition: 1 | 2 | 3 | 4 | 5 | 6;
  where: string;
  why: string;
  /** The surface that fixes it. */
  fix: 'derivation' | 'gates' | 'switchboard' | 'channels';
}

export interface LockInput {
  body: ProfileBody;
  lifecycle: Lifecycle;
  owner_kind: 'client' | 'hers';
  platforms: string[];
  now: string;
  /** Which goals carry an S16 metric declaration. */
  goalsWithMetricDeclaration?: string[];
  goals?: string[];
  postingOwnership?: 'we-post' | 'client-posts';
  clientAccess?: boolean;
}

export interface LockResult {
  ok: boolean;
  failures: LockFailure[];
  body: ProfileBody;
  lifecycle: Lifecycle;
  strategy_version: number | null;
}

interface ChannelRow { platform: string; id: string; canPost: boolean }

function channelsOf(body: ProfileBody): ChannelRow[] {
  return readPath(body, CHANNELS_PATH)
    .filter(e => e.state === 'active')
    .map(e => {
      const d = e.data as { platform?: string; posting_permission?: string };
      return { id: e.id, platform: d.platform ?? '', canPost: d.posting_permission === 'we-post' };
    });
}

/** Validate the whole configuration. Contradictions refuse activation (S8). */
export function lockViolations(input: LockInput): LockFailure[] {
  const out: LockFailure[] = [];
  const { body } = input;

  // 1 and 2 — every strategy parameter has a value or an explicit not
  // applicable, and everything with a value carries its reason line.
  for (const path of LOCKABLE_STRATEGY_PATHS) {
    const v = readStrategy(body, path);
    const row = derivationRow(path)!;
    if (!v || (v.value == null && !v.not_applicable)) {
      out.push({
        condition: 1, where: row.label, fix: 'derivation',
        why: 'it has no decision yet, and no explicit "not applicable" with a reason',
      });
      continue;
    }
    if (!v.reason || !v.reason.trim()) {
      out.push({ condition: 2, where: row.label, fix: 'derivation', why: 'it has a decision and no reason line' });
    }
  }

  // 3 — the gate set.
  const gates = readGateSet(body);
  const brandGates = (gates?.gates ?? []).filter(g => g.kind === 'brand');
  if (!gates) {
    out.push({ condition: 3, where: 'Gate set', fix: 'gates', why: 'no gate set has been written yet' });
  } else if (brandGates.length < BRAND_GATE_COUNT) {
    out.push({
      condition: 3, where: 'Gate set', fix: 'gates',
      why: `${brandGates.length} brand gates of ${BRAND_GATE_COUNT}`,
    });
  }
  if (!readStrategy(body, `${CS}/voice`) || !readStrategy(body, `${CS}/positioning`)) {
    out.push({
      condition: 3, where: 'Gate set', fix: 'derivation',
      why: 'voice or positioning is empty, and the brand gates come out of them',
    });
  }

  // 4 — every switch carries a position SHE set.
  for (const id of unsetSwitches(body, input.platforms)) {
    out.push({
      condition: 4, where: id, fix: 'switchboard',
      why: 'no position set by her yet. A suggestion is not a position.',
    });
  }

  // 5 — spec 21 §5.3's own validation.
  const config = switchConfigFromBody(body);
  const channels = channelsOf(body);
  for (const v of validateSwitchConfig({
    config,
    owner_kind: input.owner_kind,
    channels,
    goals: input.goals,
    goalsWithMetricDeclaration: input.goalsWithMetricDeclaration,
    postingOwnership: input.postingOwnership,
    clientAccess: input.clientAccess,
  })) {
    out.push({ condition: 5, where: v.switch, fix: 'switchboard', why: v.reason });
  }

  // 6 — every active platform has a channel record (S17).
  for (const p of input.platforms) {
    if (effectiveState(platformSwitchId(p), config) !== 'active') continue;
    if (!channels.some(c => c.platform.toLowerCase() === p.toLowerCase())) {
      out.push({
        condition: 6, where: p, fix: 'channels',
        why: 'this platform is on and has no channel record: account, owner, timezone and posting permission',
      });
    }
  }

  return out;
}

/**
 * The lock. One action, and the gate between understanding a client and making
 * things for them. It validates first; on failure NOTHING changes (no partial
 * lock). On success, in one pass: every strategy parameter is stamped, the gate
 * set locks at its version, every switch position is stamped and its
 * `suggested` flag cleared, the lifecycle moves setup to active, and creation
 * opens (§8.7).
 */
export function lockStrategy(input: LockInput): LockResult {
  const failures = lockViolations(input);
  if (failures.length) {
    return {
      ok: false, failures, body: input.body, lifecycle: input.lifecycle,
      strategy_version: input.body.strategy_version ?? null,
    };
  }

  const version = (input.body.strategy_version ?? 0) + 1;
  let body = input.body;

  for (const path of LOCKABLE_STRATEGY_PATHS) {
    body = stampStrategy(body, path, version, input.now);
  }

  const gates = readGateSet(body)!;
  body = writeGateSet(body, { ...gates, locked_with_strategy_version: version, locked_at: input.now }, input.now);

  const config = switchConfigFromBody(body);
  for (const id of Object.keys(config)) {
    body = putEntry(body, TOOLSET_PATH, {
      id, type: 'switch_setting',
      data: {
        id, state: config[id].state, set_at: input.now, strategy_version: version, suggested: false,
      } as unknown as Record<string, unknown>,
    }, { writer: 'owner', now: input.now });
  }

  body = { ...body, strategy_version: version };
  const lifecycle: Lifecycle = input.lifecycle === 'setup' ? 'active' : input.lifecycle;
  return { ok: true, failures: [], body, lifecycle, strategy_version: version };
}

// ── §8.7 Recording always works. Generation is what needs strategy ───────────
//
// HER DECISION, 2026-08-09, and it replaces the rule this section used to hold.
//
// The old rule was "until a profile's Strategy is locked, Creation cannot be
// written to", and both functions below enforced it: every card, every stage
// move, every seed, every saved reply refused until the strategy was written up.
// In practice that locked her out of her own clients. The clients already exist,
// the work is already happening, and the only thing missing is the write-up.
//
// The rule now:
//
//   RECORDING what is happening is ALWAYS allowed, locked or not. Cards and
//   pieces, the stage they sit at, dates, live links, previews, seeds and
//   topics, channels, saved replies, tasks and notes. None of it needs a
//   strategy to be true, and refusing it only loses the record.
//
//   GENERATION still needs the strategy, because a draft or a brief written
//   with no positioning, voice or pillars is a guess wearing her name. That gate
//   is NOT here: the engine surfaces already receive a `strategyLocked` flag and
//   answer for themselves (`app/api/engine/*`, `EngineRoomView`, `CostumeView`).
//   Nothing in this file changes that.
//
// So strategy is a layer of understanding, not a gate on work.
//
// Reading was never touched by either function, and still is not.

export const CREATION_PREFIX = 'work-log/creation';

export function strategyLocked(body: ProfileBody | undefined): boolean {
  return !!body && typeof body.strategy_version === 'number';
}

/**
 * The tree half of the old lock. It now refuses NOTHING, and that is the whole
 * of it: every path under `work-log/creation` is a record of work that happened,
 * and a record does not need a strategy to be allowed to exist.
 *
 * We went through the addresses under the prefix one by one looking for anything
 * that genuinely cannot be DECIDED without a strategy, and there is nothing. The
 * generated things that could qualify — drafts, briefs, gate runs, resolved
 * costumes — are already gated where they are made, before they ever reach a
 * write, and each has its own guard at this same door (`refusedDraftWrites`,
 * `refusedGateRunWrites`, `refusedCostumeWrites`, and the rest).
 *
 * KEPT rather than deleted, on purpose. Two routes import it as the named place
 * where "does the strategy lock refuse this write?" is answered
 * (`app/api/state/route.ts`, `app/api/desk-chat/route.ts`). Keeping the call and
 * emptying the answer means the decision lives in ONE readable place instead of
 * disappearing into two deleted imports, and if a later spec finds a creation
 * write that truly needs a locked strategy, it goes here and nowhere else.
 */
export function refusedCreationWrites(
  _current: ProfileBody | undefined, _incoming: ProfileBody | undefined,
): string[] {
  return [];
}

// ── §8.7 part two: the legacy slices ARE creation ────────────────────────────
//
// The board she uses every day renders from the legacy slices rather than from
// the tree, so the same answer has to hold for both halves or the rule is a rule
// on paper only. The address map below stays: it is the standing statement of
// which legacy slices live under `work-log/creation`, taken from the same map
// the write scopes use (`PROFILE_SCOPES` in lib/tree/scopes.ts), and a later
// spec that adds a creation slice still has one list to add it to.

export interface LegacyCreationRefusal {
  /** The legacy slice the write touched. */
  slice: string;
  /** Its address in the tree — the same prefix `refusedCreationWrites` guards. */
  path: string;
  /** What was refused, and why. */
  why: string;
}

interface LegacySliceAddress {
  slice: keyof ClientData;
  path: string;
  what: string;
}

const LEGACY_CREATION: LegacySliceAddress[] = [
  { slice: 'contentCards', path: CREATION_PREFIX, what: 'a piece on the board' },
  { slice: 'topics', path: `${CREATION_PREFIX}/topics`, what: 'a seed' },
  { slice: 'evergreenIdeas', path: `${CREATION_PREFIX}/topics`, what: 'an evergreen idea' },
  { slice: 'previewPosts', path: `${CREATION_PREFIX}/review`, what: 'a preview' },
  { slice: 'instagram', path: `${CREATION_PREFIX}/channels`, what: 'the account this profile posts from' },
  { slice: 'leadAnswers', path: `${CREATION_PREFIX}/funnel/replies`, what: 'a saved reply' },
];

/** The slices this guard covers. Exported so a test can prove the list is the
 *  whole of what the address map files under creation, and stays that way. */
export const LEGACY_CREATION_SLICES: string[] = LEGACY_CREATION.map(r => r.slice as string);

/**
 * The legacy half, and it refuses NOTHING for the same reason the tree half
 * does: every slice in the list above is a record of work that happened. A card
 * she made, the stage she dragged it to, the preview she sent, the seed she
 * caught, the account she posts from, the reply she saved. All of it is true
 * whether or not the strategy has been written up, and refusing it only means
 * the record is lost.
 *
 * KEPT for the same reason as `refusedCreationWrites`: the two routes call it by
 * name, so this file stays the one readable place where the lock's effect on
 * writing is decided.
 *
 * One thing this being empty quietly fixes: CLAUDE.md gotcha 3. `contentCards`
 * is deliberately never defaulted, because the client's one-time LOAD migration
 * keys off it being absent, and that migration used to need an exception carved
 * out of this guard so it was not mistaken for a write. With nothing refused,
 * there is nothing to carve.
 */
export function refusedLegacyCreationWrites(
  _current: ClientData | undefined, _incoming: ClientData | undefined,
): LegacyCreationRefusal[] {
  return [];
}

// ── Cross-checks the validator runs (§4.6, acceptance test 10) ───────────────

export interface DerivationViolation {
  where: string;
  reason: string;
}

/** Both directions of the no-orphan-parameter rule. A parameter nothing reads
 *  is a question asked for nothing, and it is exactly what spec 08 promised to
 *  prevent. */
export function derivationViolations(): DerivationViolation[] {
  const out: DerivationViolation[] = [];

  for (const p of PARAMETERS) {
    if (p.required_for.length === 0 && p.reader !== 'none-by-design') {
      out.push({ where: p.id, reason: 'no strategy reader and no `reader: none-by-design` reason (§4.6)' });
    }
    if (p.reader === 'none-by-design' && !p.reader_reason) {
      out.push({ where: p.id, reason: 'marked none-by-design with no reason line (§4.6)' });
    }
    for (const path of p.required_for) {
      const row = derivationRow(path);
      if (!row) { out.push({ where: p.id, reason: `required_for "${path}" is not in the derivation map` }); continue; }
      if (!row.from_parameters.includes(p.id)) {
        out.push({ where: p.id, reason: `claims to feed "${path}", which does not name it as a source` });
      }
    }
  }

  for (const row of DERIVATION_MAP) {
    if (!findDeclaration(row.path)) {
      out.push({ where: row.path, reason: 'the derivation map names an undeclared path (law 4)' });
    }
    const named = row.from_parameters.length + row.from_strategy.length;
    if (named === 0 && !row.from_universal && !row.owner_declared) {
      out.push({ where: row.path, reason: 'a strategy parameter with no named source (§4.6)' });
    }
    for (const id of row.from_parameters) {
      const p = findParameter(id);
      if (!p) { out.push({ where: row.path, reason: `names an unknown parameter "${id}"` }); continue; }
      if (!p.required_for.includes(row.path)) {
        out.push({ where: row.path, reason: `names "${id}" as a source, which does not name it back` });
      }
    }
    for (const s of row.from_strategy) {
      if (!findDeclaration(s)) out.push({ where: row.path, reason: `derives from undeclared "${s}"` });
    }
  }

  // Every switch the switchboard offers has to exist in the registry.
  for (const id of switchesNeedingPosition([])) {
    if (!SWITCHES.some(s => s.id === id)) {
      out.push({ where: id, reason: 'the switchboard offers a switch that is not registered' });
    }
  }

  return out;
}

export type { BodyEntry };
