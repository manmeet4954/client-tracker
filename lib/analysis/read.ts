// The reading layer — spec 27 §4.1.
//
// This is the ONLY module that touches spec 26's tables, and it is read-only BY
// CONSTRUCTION: it exports queries and no writers. There is no insert here, no
// update, no upsert, and nothing that returns a writer. What this spec writes,
// it writes at its own addresses (§17.1) — conclusions are not observations.
//
// The store is injected, never reached for: production passes the Supabase-backed
// one, the tests pass rows in memory. That is what makes the whole reading layer
// provable without a database, exactly as spec 23's model layer is provable
// without a network.

import type { SwitchConfig } from '../tree/contract.ts';
import type { ProfileBody } from '../tree/body.ts';
import { readPath, readUnder } from '../tree/body.ts';
import type {
  AttributedOutcome, Channel, CoverageGap, MeasurementDeclaration, MetricObservation,
  Piece, PlatformPost, PostLink, Seed, SyncRun,
} from '../tree/objects.ts';
import { findDeclaration } from '../tree/declarations.ts';
import { pathState } from '../tree/switches.ts';
import type { ComparisonThresholds } from '../tree/metrics.ts';
import { detectCoverageGaps, thresholdsFor } from '../tree/metrics.ts';
import type { SliceRow } from './compute.ts';

// ── What the store holds, as this layer reads it ─────────────────────────────

/** Spec 26's `post_readings` — the AI reading layer, a FALLBACK source only. */
export interface PostReading {
  platform_post_id: string;
  platform: string;
  topic_type?: string | null;
  hook_type?: string | null;
  close_type?: string | null;
  cta_type?: string | null;
  caption_style?: string | null;
  has_face?: boolean | null;
  trending_audio?: boolean | null;
  corrected?: string[];
}

export interface ChannelConnection {
  channel_id: string;
  profile_id: string;
  platform: string;
  account_handle: string | null;
  connection_status: string;
  last_successful_sync: string | null;
  revoked_at: string | null;
}

export interface StoreQuery {
  profile_id: string;
  channel_ids: string[];
  /** Day bounds. A query with no bounds reads everything this profile has. */
  from?: string;
  to?: string;
}

/**
 * The store's read face. Queries only — adding a writer to this interface would
 * make §4.1's sentence false, and acceptance test 3 exists to catch it.
 */
export interface AnalysisStore {
  channelConnections(profileId: string): Promise<ChannelConnection[]>;
  platformPosts(q: StoreQuery): Promise<PlatformPost[]>;
  postObservations(q: StoreQuery): Promise<MetricObservation[]>;
  accountObservations(q: StoreQuery): Promise<MetricObservation[]>;
  syncRuns(q: StoreQuery): Promise<SyncRun[]>;
  postLinks(q: StoreQuery): Promise<PostLink[]>;
  postReadings(q: StoreQuery): Promise<PostReading[]>;
}

export interface StoreSnapshot {
  profile_id: string;
  channels: ChannelConnection[];
  posts: PlatformPost[];
  observations: MetricObservation[];
  account_observations: MetricObservation[];
  runs: SyncRun[];
  links: PostLink[];
  readings: PostReading[];
}

export const EMPTY_SNAPSHOT: StoreSnapshot = {
  profile_id: '', channels: [], posts: [], observations: [],
  account_observations: [], runs: [], links: [], readings: [],
};

/** One read of everything a surface needs, in one place. */
export async function readSnapshot(
  store: AnalysisStore, profileId: string, bounds?: { from?: string; to?: string },
): Promise<StoreSnapshot> {
  const channels = await store.channelConnections(profileId);
  const q: StoreQuery = {
    profile_id: profileId,
    channel_ids: channels.map(c => c.channel_id),
    from: bounds?.from, to: bounds?.to,
  };
  const [posts, observations, account_observations, runs, links, readings] = await Promise.all([
    store.platformPosts(q), store.postObservations(q), store.accountObservations(q),
    store.syncRuns(q), store.postLinks(q), store.postReadings(q),
  ]);
  return { profile_id: profileId, channels, posts, observations, account_observations, runs, links, readings };
}

/** A store over rows already in hand. The tests use it; nothing else does. */
export function inMemoryStore(snapshot: Partial<StoreSnapshot>): AnalysisStore {
  const s = { ...EMPTY_SNAPSHOT, ...snapshot };
  const within = (day: string | undefined, q: StoreQuery) =>
    (!q.from || !day || day >= q.from) && (!q.to || !day || day <= q.to);
  return {
    channelConnections: async () => s.channels,
    platformPosts: async q => s.posts.filter(p => q.channel_ids.includes(p.channel_id)),
    postObservations: async q => s.observations.filter(
      o => q.channel_ids.includes(o.channel_id) && within(o.local_date ?? o.fetched_at.slice(0, 10), q)),
    accountObservations: async q => s.account_observations.filter(
      o => q.channel_ids.includes(o.channel_id) && within(o.local_date ?? o.fetched_at.slice(0, 10), q)),
    syncRuns: async q => s.runs.filter(r => q.channel_ids.includes(r.channel_id)),
    postLinks: async q => s.links.filter(l => l.profile_id === q.profile_id),
    postReadings: async () => s.readings,
  };
}

// ── §4.1 read-only, proved at the write door ─────────────────────────────────

export const OBSERVATION_PREFIX = 'work-log/analysis/study-own-data';

/**
 * Acceptance test 3, as a function rather than a convention: `engine:analysis`
 * is not a declared writer of any observation path, and the declaration is what
 * says so. Remove `pipe:platform-metrics` from the declaration's `fed_by`, or add
 * `engine:analysis` to it, and this returns true — which is the test's point.
 */
export function writerMayWrite(path: string, writer: string): boolean {
  const dec = findDeclaration(path);
  if (!dec) return false;
  if (dec.fed_by.includes(writer as never)) return true;
  // A path fed only by pipes accepts only the pipes it names (spec 26 S3: the
  // observations are BODY-OWNED; the engine computes from them, never owns them).
  if (dec.fed_by.length && dec.fed_by.every(w => w.startsWith('pipe:'))) return false;
  return dec.fed_by.some(w => w.startsWith('path:') || w.startsWith('pipe:'));
}

export function analysisMayWriteObservations(path: string): boolean {
  return writerMayWrite(path, 'engine:analysis');
}

// ── What the BODY knows: identity, the measuring sticks, the vocabulary ──────

export interface PillarFacts {
  id: string;
  name: string;
  job: string | null;
  mix_target_pct: number | null;
  purpose: string | null;
  declaration: MeasurementDeclaration | null;
  /** Dated job changes, so regimes never mix (§4.3). */
  job_changes: { at: string; job: string }[];
}

export interface GoalFacts {
  id: string;
  name: string;
  declaration: MeasurementDeclaration | null;
}

export interface PieceFacts {
  id: string;
  seed_id: string | null;
  title: string;
  stage: string;
  channel_id: string | null;
  created_month: string | null;
  /** The BIRTH record, never the piece's current fields (§4.3). */
  birth: Piece['birth'];
  /** Null where the piece predates the engine — a named bucket, never a drop. */
  born_at: string | null;
}

export interface ProfileFacts {
  profile_id: string;
  config: SwitchConfig;
  strategy_locked: boolean;
  pillars: PillarFacts[];
  goals: GoalFacts[];
  /** Switched-ON platforms only. A hidden platform never reaches a picker or the packet. */
  platforms: string[];
  formats: Record<string, string[]>;
  channels: Channel[];
  pieces: PieceFacts[];
  seeds: { id: string; name: string }[];
  ctas: string[];
  voice: string[];
  funnel_shape: string[];
  outcomes: AttributedOutcome[];
}

function activePath(path: string, config: SwitchConfig): boolean {
  if (!findDeclaration(path)) return false;
  try {
    return pathState(path, config) === 'active';
  } catch {
    return false;
  }
}

function safeRead(body: ProfileBody, path: string) {
  try {
    return readPath(body, path);
  } catch {
    return [];
  }
}

function safeUnder(body: ProfileBody, prefix: string) {
  try {
    return readUnder(body, prefix);
  } catch {
    return [];
  }
}

function textOf(data: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = data[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function declarationAt(body: ProfileBody, path: string): MeasurementDeclaration | null {
  const entry = safeUnder(body, 'context/content-strategy')
    .find(e => e.path === path && e.state === 'active');
  if (!entry) return null;
  const d = entry.data as Record<string, unknown>;
  const raw = (d.declaration ?? d.value ?? d) as unknown;
  const dec = raw as MeasurementDeclaration;
  return dec && Array.isArray(dec.metric_ids) ? dec : null;
}

/** Every pillar, with its job, its mix target and its S16 declaration. */
export function readPillars(body: ProfileBody, config: SwitchConfig): PillarFacts[] {
  const entries = safeUnder(body, 'context/content-strategy/pillars');
  return entries
    .filter(e => e.type === 'pillar' && e.state === 'active')
    .filter(e => activePath(e.path, config))
    .map(e => {
      const d = e.data as Record<string, unknown>;
      const jobEntry = entries.find(x => x.path === `${e.path}/job`);
      const mixEntry = entries.find(x => x.path === `${e.path}/mix-target`);
      const descEntry = entries.find(x => x.path === `${e.path}/description`);
      const jobData = (jobEntry?.data ?? {}) as Record<string, unknown>;
      const job = textOf(jobData, ['job', 'value', 'text']) ?? (d.job ? String(d.job) : null);
      const mix = Number((mixEntry?.data as Record<string, unknown> | undefined)?.target_pct ?? NaN);
      const changes: { at: string; job: string }[] = [];
      if (job) changes.push({ at: (jobEntry?.created_at ?? e.created_at ?? '').slice(0, 10) || '0000-01-01', job });
      for (const a of jobEntry?.amendments ?? []) {
        const next = a.changed?.job ?? a.changed?.value;
        if (typeof next === 'string') changes.push({ at: a.at.slice(0, 10), job: next });
      }
      return {
        id: e.id,
        name: String(d.name ?? e.id),
        job,
        mix_target_pct: Number.isFinite(mix) ? mix : null,
        purpose: textOf((descEntry?.data ?? {}) as Record<string, unknown>, ['value', 'text', 'description']),
        declaration: declarationAt(body, `${e.path}/measurement`),
        job_changes: changes,
      };
    });
}

export function readGoals(body: ProfileBody, config: SwitchConfig): GoalFacts[] {
  const entries = safeUnder(body, 'context/content-strategy/goals');
  return entries
    .filter(e => e.state === 'active' && !e.path.endsWith('/measurement'))
    .filter(e => activePath(e.path, config))
    .map(e => {
      const d = e.data as Record<string, unknown>;
      return {
        id: e.id,
        name: String(d.name ?? d.label ?? d.value ?? e.id),
        declaration: declarationAt(body, `context/content-strategy/goals/${e.id}/measurement`)
          ?? declarationAt(body, `${e.path}/measurement`),
      };
    });
}

export function readPlatforms(body: ProfileBody, config: SwitchConfig): {
  platforms: string[]; formats: Record<string, string[]>;
} {
  const entries = safeUnder(body, 'context/content-strategy/platforms');
  const platforms: string[] = [];
  const formats: Record<string, string[]> = {};
  for (const e of entries) {
    if (e.type !== 'platform' || e.state !== 'active') continue;
    if (!activePath(e.path, config)) continue;
    const d = e.data as Record<string, unknown>;
    const name = String(d.name ?? e.id);
    platforms.push(name);
    formats[name] = entries
      .filter(f => f.type === 'format' && f.state === 'active' && f.path === `${e.path}/formats`)
      .map(f => String((f.data as Record<string, unknown>).name ?? f.id));
  }
  return { platforms, formats };
}

export function readPieces(body: ProfileBody): PieceFacts[] {
  return safeRead(body, 'work-log/creation').map(e => {
    const p = e.data as unknown as Piece;
    return {
      id: e.id,
      seed_id: p.seed_id ?? null,
      title: String(p.title ?? ''),
      stage: String(p.stage ?? 'idea'),
      channel_id: p.channel_id ?? null,
      created_month: p.created_month ?? null,
      birth: p.birth ?? null,
      born_at: p.birth?.at ? p.birth.at.slice(0, 10) : null,
    };
  });
}

function labelsAt(body: ProfileBody, path: string, config: SwitchConfig): string[] {
  if (!activePath(path, config)) return [];
  return safeRead(body, path)
    .filter(e => e.state === 'active')
    .map(e => {
      const d = e.data as Record<string, unknown>;
      return String(d.label ?? d.name ?? d.value ?? e.id);
    });
}

/** Everything the reading layer needs from the body, in one read. */
export function readProfileFacts(
  body: ProfileBody, config: SwitchConfig, profileId: string,
): ProfileFacts {
  const { platforms, formats } = readPlatforms(body, config);
  return {
    profile_id: profileId,
    config,
    strategy_locked: typeof body.strategy_version === 'number',
    pillars: readPillars(body, config),
    goals: readGoals(body, config),
    platforms,
    formats,
    channels: safeRead(body, 'work-log/creation/channels')
      .filter(e => e.state === 'active')
      .map(e => ({ ...(e.data as unknown as Channel), id: e.id })),
    pieces: readPieces(body),
    seeds: safeRead(body, 'work-log/creation/topics').map(e => ({
      id: e.id, name: String((e.data as unknown as Seed).name ?? e.id),
    })),
    ctas: labelsAt(body, 'context/content-strategy/ctas', config),
    voice: labelsAt(body, 'context/content-strategy/voice', config),
    funnel_shape: labelsAt(body, 'context/content-strategy/funnel-shape', config),
    outcomes: safeRead(body, 'work-log/analysis/attributed-outcomes')
      .filter(e => e.state === 'active')
      .map(e => ({ ...(e.data as unknown as AttributedOutcome), id: e.id })),
  };
}

// ── §4.2 Identity comes from the pieces, where they live ─────────────────────

export interface JoinedPiece {
  piece: PieceFacts;
  platform_post_id: string;
  channel_id: string;
  published_at: string;
  published_day: string;
  deleted_on_platform: boolean;
}

/**
 * The join, read from spec 26's `post_links`. A row holds a `piece_id` and
 * RESOLVES it — no piece is ever copied into analysis (§4.2, PLAN §3.11).
 */
export function joinPieces(facts: ProfileFacts, snapshot: StoreSnapshot): {
  joined: JoinedPiece[];
  /** Fetched posts with no piece. They count in totals, never carry a pillar (§4.3). */
  unplanned: PlatformPost[];
  /** Pieces with no birth snapshot. A NAMED bucket with a count, never a drop. */
  bornBeforeTheEngine: PieceFacts[];
} {
  const byId = new Map(facts.pieces.map(p => [p.id, p]));
  const posts = new Map(snapshot.posts.map(p => [p.platform_post_id, p]));
  const joined: JoinedPiece[] = [];
  const claimed = new Set<string>();
  for (const link of snapshot.links) {
    const piece = byId.get(link.piece_id);
    const post = posts.get(link.platform_post_id);
    if (!piece || !post) continue;
    claimed.add(post.platform_post_id);
    joined.push({
      piece,
      platform_post_id: post.platform_post_id,
      channel_id: post.channel_id,
      published_at: post.published_at,
      published_day: (post.published_at ?? '').slice(0, 10),
      deleted_on_platform: post.deleted_on_platform,
    });
  }
  return {
    joined,
    unplanned: snapshot.posts.filter(p => !claimed.has(p.platform_post_id)),
    bornBeforeTheEngine: joined.filter(j => !j.piece.birth).map(j => j.piece),
  };
}

/** Every observation for one piece at one window, newest reading last. */
export function observationsFor(
  snapshot: StoreSnapshot, platformPostId: string, window: string,
): MetricObservation[] {
  return snapshot.observations
    .filter(o => o.platform_post_id === platformPostId && o.window === window)
    .sort((a, b) => (a.fetched_at < b.fetched_at ? -1 : 1));
}

// ── The one context every surface is a window onto (§4) ──────────────────────

/**
 * Assembled once, read by all eight surfaces. Coverage is computed HERE, before
 * anything else, because §4.4's rule is that every surface renders coverage
 * before it renders performance — and a rule that each screen has to remember is
 * a rule that one screen will forget.
 */
export interface AnalysisContext {
  facts: ProfileFacts;
  snapshot: StoreSnapshot;
  joined: JoinedPiece[];
  unplanned: PlatformPost[];
  born_before_the_engine: PieceFacts[];
  gaps: CoverageGap[];
  thresholds: ComparisonThresholds;
  period: { from: string; to: string };
  now: string;
}

export interface ContextInput {
  facts: ProfileFacts;
  snapshot: StoreSnapshot;
  period: { from: string; to: string };
  now: string;
  thresholds?: Partial<ComparisonThresholds>;
}

export function buildAnalysisContext(input: ContextInput): AnalysisContext {
  const { joined, unplanned, bornBeforeTheEngine } = joinPieces(input.facts, input.snapshot);
  const platform = input.facts.platforms[0] ?? 'instagram';
  const gaps: CoverageGap[] = [];
  for (const channel of input.snapshot.channels) {
    const trackingState = pathStateFor('work-log/analysis/study-own-data', input.facts.config);
    gaps.push(...detectCoverageGaps(
      input.snapshot.observations, channel.channel_id, input.period.from, input.period.to,
      {
        runs: input.snapshot.runs,
        trackSince: null,
        trackingState,
        runsRecordedFrom: input.snapshot.runs.length
          ? input.snapshot.runs.map(r => r.started_at).sort()[0].slice(0, 10)
          : null,
      },
    ));
  }
  return {
    facts: input.facts,
    snapshot: input.snapshot,
    joined,
    unplanned,
    born_before_the_engine: bornBeforeTheEngine,
    gaps,
    thresholds: thresholdsFor(platform.toLowerCase(), input.thresholds ?? {}),
    period: input.period,
    now: input.now,
  };
}

function pathStateFor(path: string, config: SwitchConfig): 'active' | 'history' | 'hidden' {
  try {
    return pathState(path, config);
  } catch {
    return 'active';
  }
}

/**
 * One row per piece at one window — the shape every computation takes. A piece
 * with no reading at that window simply produces no row: it is `too-early` or
 * `unavailable`, and neither of those is a zero (§4.4).
 */
export function sliceRowsFor(
  ctx: AnalysisContext, window: string, pieces: JoinedPiece[] = ctx.joined,
): SliceRow[] {
  const out: SliceRow[] = [];
  for (const j of pieces) {
    if (j.deleted_on_platform) continue;
    const rows = ctx.snapshot.observations.filter(
      o => o.platform_post_id === j.platform_post_id && o.window === window
        && (o.window_state ?? 'materialized') === 'materialized');
    const row = rows.sort((a, b) => (a.fetched_at < b.fetched_at ? 1 : -1))[0];
    if (!row) continue;
    out.push({
      piece_id: j.piece.id,
      channel_id: j.channel_id,
      platform: row.platform ?? ctx.facts.platforms[0] ?? 'instagram',
      row,
      published_day: j.published_day,
    });
  }
  return out;
}

/**
 * The pieces published inside the period, on platforms that are switched ON.
 *
 * Two rules meet here. Never-posted pieces never enter analysis — spec 05's rule,
 * kept (§22.1). And the cascade reaches the COMPUTATION, not only the pickers: a
 * piece born on a platform now at `history` or `hidden` computes nothing new,
 * while `ctx.joined` still holds it so every past number stays readable (S9,
 * acceptance test 6).
 */
export function piecesInPeriod(ctx: AnalysisContext): JoinedPiece[] {
  const live = new Set(ctx.facts.platforms);
  return ctx.joined.filter(j => {
    if (j.published_day < ctx.period.from || j.published_day > ctx.period.to) return false;
    const platform = j.piece.birth?.costume?.platform;
    // A piece with no birth snapshot has no platform to check. It stays in the
    // account totals and in its own named bucket (§4.3).
    return !platform || live.has(platform);
  });
}
