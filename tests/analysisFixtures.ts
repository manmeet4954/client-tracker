// Fixtures for spec 27's acceptance tests.
//
// One profile, real-shaped: three pillars with jobs and S16 declarations, two
// goals (one declared, one not), Instagram switched on, eight posted pieces with
// birth snapshots, one legacy piece with none, and a store whose observations
// stop on 2026-07-11 — the real stall, so the gap test runs against the shape
// the live system is actually in.

import type { SwitchConfig } from '../lib/tree/contract.ts';
import type { ProfileBody } from '../lib/tree/body.ts';
import { emptyBody, putEntry } from '../lib/tree/body.ts';
import type {
  MeasurementDeclaration, MetricObservation, PlatformPost, PostLink, SyncRun,
} from '../lib/tree/objects.ts';
import { platformSwitchId, trackingSwitchId } from '../lib/tree/switches.ts';
import type { AnalysisContext, StoreSnapshot } from '../lib/analysis/read.ts';
import { buildAnalysisContext, readProfileFacts } from '../lib/analysis/read.ts';

export const PROFILE = 'resumeguru';
export const CHANNEL = 'ch-resumeguru-ai';
export const NOW = '2026-07-21T06:00:00.000Z';

export const CONFIG: SwitchConfig = {
  'strategy.fixed': { state: 'active', set_at: 'test' },
  'creation.board': { state: 'active', set_at: 'test' },
  'creation.engine': { state: 'active', set_at: 'test' },
  'creation.channels': { state: 'active', set_at: 'test' },
  'analysis.tracking': { state: 'active', set_at: 'test' },
  'analysis.scorecard': { state: 'active', set_at: 'test' },
  'analysis.bifurcation': { state: 'active', set_at: 'test' },
  'analysis.compare': { state: 'active', set_at: 'test' },
  'analysis.goal_tracking': { state: 'active', set_at: 'test' },
  'analysis.funnel': { state: 'active', set_at: 'test' },
  'analysis.digest_owner': { state: 'active', set_at: 'test' },
  'analysis.verdicts': { state: 'active', set_at: 'test' },
  'analysis.verdict_words': { state: 'active', set_at: 'test' },
  'analysis.always_live': { state: 'active', set_at: 'test' },
  [platformSwitchId('Instagram')]: { state: 'active', set_at: 'test' },
  [trackingSwitchId('Instagram')]: { state: 'active', set_at: 'test' },
};

const CS = 'context/content-strategy';

function declaration(over: Partial<MeasurementDeclaration>): MeasurementDeclaration {
  return {
    subject: 'pillar-job:trust', metric_ids: ['saved'], direction: 'up-is-better',
    calculation: 'rate', denominator: 'views', window: '7d', target: 'direction-only',
    platform_availability: { instagram: 'available' },
    not_measurable_fallback: 'manual-checkin',
    ...over,
  };
}

export interface PieceSpec {
  id: string;
  pillar: string | null;
  hook: string;
  format: string;
  platform: string;
  seed: string | null;
  published: string;
  metrics: Record<string, number>;
  /** A piece with no birth snapshot: born before the engine. */
  noBirth?: boolean;
  /** Her CURRENT costume, edited after posting. Analysis must ignore it (§4.3). */
  currentHook?: string;
  cta?: string;
}

export const PIECES: PieceSpec[] = [
  { id: 'pc-1', pillar: 'trust', hook: 'curiosity', format: 'Carousel', platform: 'Instagram', seed: 'seed-salary', published: '2026-07-02', metrics: { views: 1000, reach: 800, saved: 40, website_clicks: 5 }, currentHook: 'question' },
  { id: 'pc-2', pillar: 'trust', hook: 'curiosity', format: 'Carousel', platform: 'Instagram', seed: 'seed-salary', published: '2026-07-03', metrics: { views: 1100, reach: 820, saved: 44, website_clicks: 5 } },
  { id: 'pc-3', pillar: 'trust', hook: 'pain recognition', format: 'Reel', platform: 'Instagram', seed: 'seed-ats', published: '2026-07-04', metrics: { views: 1000, reach: 810, saved: 40, website_clicks: 5 } },
  { id: 'pc-4', pillar: 'trust', hook: 'pain recognition', format: 'Reel', platform: 'Instagram', seed: 'seed-ats', published: '2026-07-05', metrics: { views: 1000, reach: 790, saved: 40, website_clicks: 5 } },
  { id: 'pc-5', pillar: 'convert', hook: 'direct claim', format: 'Reel', platform: 'Instagram', seed: 'seed-os', published: '2026-07-06', metrics: { views: 1000, reach: 300, saved: 10, website_clicks: 60 } },
  { id: 'pc-6', pillar: 'convert', hook: 'direct claim', format: 'Reel', platform: 'Instagram', seed: 'seed-os', published: '2026-07-07', metrics: { views: 1000, reach: 320, saved: 10, website_clicks: 70 } },
  { id: 'pc-7', pillar: 'awareness', hook: 'question', format: 'Carousel', platform: 'Instagram', seed: 'seed-ats', published: '2026-07-08', metrics: { views: 1000, reach: 800, saved: 20, website_clicks: 5 } },
  { id: 'pc-8', pillar: null, hook: '', format: '', platform: 'Instagram', seed: null, published: '2026-07-09', metrics: { views: 1000, reach: 800, saved: 20, website_clicks: 5 }, noBirth: true },
  // Published INSIDE the stall: no reading exists for it, and none is invented.
  { id: 'pc-9', pillar: 'trust', hook: 'curiosity', format: 'Carousel', platform: 'Instagram', seed: 'seed-salary', published: '2026-07-14', metrics: {} },
];

export interface FixtureOptions {
  /** Extra platform entries, for the growth and cascade tests. */
  extraPlatforms?: { name: string; formats: string[] }[];
  extraPillars?: { id: string; name: string; job: string; declared: boolean }[];
  extraPieces?: PieceSpec[];
  config?: SwitchConfig;
  /** The period the surfaces run over. */
  period?: { from: string; to: string };
  now?: string;
}

export function fixtureBody(opts: FixtureOptions = {}): ProfileBody {
  let body = emptyBody('2026-05-01T00:00:00.000Z');
  body = { ...body, strategy_version: 1 };
  const put = (path: string, id: string, type: string, data: Record<string, unknown>, writer = 'owner') =>
    (body = putEntry(body, path, { id, type, data }, { writer, now: '2026-05-01T00:00:00.000Z' }));

  // Platforms and their formats. Formats live INSIDE their platform, always.
  const platforms = [{ name: 'Instagram', formats: ['Carousel', 'Reel', 'Static'] }, ...(opts.extraPlatforms ?? [])];
  for (const p of platforms) {
    const key = p.name.toLowerCase();
    put(`${CS}/platforms/${key}`, key, 'platform', { name: p.name });
    for (const f of p.formats) {
      put(`${CS}/platforms/${key}/formats`, `${key}-${f.toLowerCase()}`, 'format', { name: f });
    }
  }

  // Pillars, their jobs, their mix targets and their S16 declarations.
  const pillars: { id: string; name: string; job: string; mix: number; declared: boolean; purpose: string }[] = [
    { id: 'trust', name: 'Interview truth', job: 'Trust', mix: 40, declared: true, purpose: 'Show we know how hiring works' },
    { id: 'convert', name: 'CareerOS', job: 'Convert', mix: 25, declared: true, purpose: 'Ask for the signup' },
    { id: 'awareness', name: 'AI for job hunting', job: 'Reach', mix: 35, declared: false, purpose: 'Bring new people in' },
    ...(opts.extraPillars ?? []).map(p => ({ ...p, mix: 0, purpose: '' })),
  ];
  for (const p of pillars) {
    put(`${CS}/pillars/${p.id}`, p.id, 'pillar', { name: p.name });
    put(`${CS}/pillars/${p.id}/job`, `${p.id}-job`, 'pillar_parameter', { job: p.job });
    put(`${CS}/pillars/${p.id}/mix-target`, `${p.id}-mix`, 'pillar_parameter', { target_pct: p.mix });
    put(`${CS}/pillars/${p.id}/description`, `${p.id}-desc`, 'pillar_parameter', { value: p.purpose });
    if (!p.declared) continue;
    put(`${CS}/pillars/${p.id}/measurement`, `${p.id}-measure`, 'measurement_declaration',
      declaration(p.job === 'Convert'
        ? { subject: `pillar-job:${p.id}`, metric_ids: ['website_clicks'], calculation: 'count', denominator: null }
        : { subject: `pillar-job:${p.id}` }) as unknown as Record<string, unknown>);
  }

  // Goals: one with its declaration, one blocked without.
  put(`${CS}/goals`, 'signups', 'goal', { name: 'Signups' });
  put(`${CS}/goals/signups/measurement`, 'signups-measure', 'measurement_declaration',
    declaration({
      subject: 'goal:signups', metric_ids: ['website_clicks'], calculation: 'count',
      denominator: null, target: { value: 120, period: 'month' },
    }) as unknown as Record<string, unknown>);
  put(`${CS}/goals`, 'brandlove', 'goal', { name: 'People remember us' });

  put(`${CS}/ctas`, 'cta-link', 'strategy_parameter', { label: 'Link in bio' });
  put(`${CS}/voice`, 'voice-main', 'strategy_parameter', { label: 'Plain and direct' });
  put(`${CS}/funnel-shape`, 'fs-1', 'strategy_parameter', { label: 'Views' });
  put(`${CS}/funnel-shape`, 'fs-2', 'strategy_parameter', { label: 'Reach' });

  put('work-log/creation/channels', CHANNEL, 'channel', {
    platform: 'Instagram', account_handle: 'resumeguru.ai', ownership: 'krnl',
    connection: 'connected', timezone: 'Asia/Kolkata', posting_permission: 'we-post',
  });

  for (const seed of ['seed-salary', 'seed-ats', 'seed-os']) {
    put('work-log/creation/topics', seed, 'seed', {
      name: seed.replace('seed-', ''), raw_thought: 'hers', raw_material: [], status: 'locked',
    });
  }

  for (const p of [...PIECES, ...(opts.extraPieces ?? [])]) {
    put('work-log/creation', p.id, 'piece', {
      id: p.id, seed_id: p.seed, title: p.id, stage: 'posted',
      channel_id: CHANNEL, created_month: p.published.slice(0, 7),
      costume: p.noBirth ? {} : {
        pillar_id: p.pillar, platform: p.platform, format: p.format,
        // Her CURRENT costume, edited after posting. Analysis reads the birth.
        hook_type: p.currentHook ?? p.hook, cta: p.cta ?? 'cta-link',
      },
      birth: p.noBirth ? null : {
        at: `${p.published}T04:00:00.000Z`,
        pillar_job: p.pillar === 'trust' ? 'Trust' : p.pillar === 'convert' ? 'Convert' : 'Reach',
        costume: {
          pillar_id: p.pillar, platform: p.platform, format: p.format,
          hook_type: p.hook, cta: p.cta ?? 'cta-link', objective: 'trust',
          audience_stage: 'problem-aware', angle: 'framework', product_intensity: 'none',
          voice: 'Plain and direct',
        },
      },
    });
  }

  return body;
}

/** Daily lifetime rows through 2026-07-11, then nothing — the real stall. */
function dailyRows(lastDay: number): MetricObservation[] {
  const out: MetricObservation[] = [];
  for (let d = 1; d <= lastDay; d++) {
    const day = `2026-07-${String(d).padStart(2, '0')}`;
    out.push({
      id: `acct-${day}`, piece_id: null, platform_post_id: '', channel_id: CHANNEL,
      platform: 'instagram', kind_of_row: 'lifetime', window: 'lifetime', age_hours: 0,
      metrics: { followers: 1200 + d, media_count: 40 + d, profile_views: 30 + d, website_clicks: 4 },
      metric_definition_version: 1, account_timezone: 'Asia/Kolkata', local_date: day,
      fetched_at: `${day}T03:30:00.000Z`, fetch_time_precision: 'exact',
      connection_status: 'ok', retry_state: 'none', source_run_id: `run-${day}`,
    });
  }
  return out;
}

export interface SnapshotOptions {
  /** The last day the pipe ran. 11 is the real stall; 20 is a healthy month. */
  lastCollectedDay?: number;
  pieces?: PieceSpec[];
  /** Override one piece's window metrics, for the threshold tests. */
  metricOverrides?: Record<string, Record<string, number>>;
  definitionVersions?: Record<string, number>;
}

export function fixtureSnapshot(opts: SnapshotOptions = {}): StoreSnapshot {
  const lastDay = opts.lastCollectedDay ?? 11;
  const pieces = opts.pieces ?? PIECES;
  const posts: PlatformPost[] = [];
  const links: PostLink[] = [];
  const observations: MetricObservation[] = [];

  for (const p of pieces) {
    const postId = `post-${p.id}`;
    posts.push({
      platform_post_id: postId, channel_id: CHANNEL, platform: 'instagram',
      published_at: `${p.published}T04:00:00.000Z`, permalink: `https://instagram.com/p/${p.id}/`,
      post_ref: p.id, media_kind: 'IMAGE', format_hint: p.format, caption: null,
      first_seen_at: `${p.published}T05:00:00.000Z`, last_seen_at: `${p.published}T05:00:00.000Z`,
      deleted_on_platform: false,
    });
    links.push({
      piece_id: p.id, id_kind: 'piece', profile_id: PROFILE, channel_id: CHANNEL,
      platform_post_id: postId, post_ref: p.id, matched_at: `${p.published}T05:00:00.000Z`,
      match_method: 'url-ref',
    });
    const metrics = opts.metricOverrides?.[p.id] ?? p.metrics;
    if (!Object.keys(metrics).length) continue;
    const day = addDays(p.published, 7);
    if (Number(day.slice(8)) > lastDay) continue;      // the window never materialised
    observations.push({
      id: `w7-${p.id}`, piece_id: p.id, platform_post_id: postId, channel_id: CHANNEL,
      platform: 'instagram', kind_of_row: 'window', window: '7d', window_state: 'materialized',
      age_hours: 168, metrics,
      metric_definition_version: opts.definitionVersions?.[p.id] ?? 1,
      account_timezone: 'Asia/Kolkata', local_date: day, fetched_at: `${day}T03:30:00.000Z`,
      fetch_time_precision: 'exact', connection_status: 'ok', retry_state: 'none',
      source_run_id: `run-${day}`,
    });
  }

  const runs: SyncRun[] = [];
  for (let d = 1; d <= lastDay; d++) {
    const day = `2026-07-${String(d).padStart(2, '0')}`;
    runs.push({
      run_id: `run-${day}`, channel_id: CHANNEL, platform: 'instagram',
      started_at: `${day}T03:30:00.000Z`, trigger: 'cron', connection_status: 'ok',
      posts_seen: pieces.length, posts_observed: pieces.length, completed: true, attempt: 1,
    });
  }

  return {
    profile_id: PROFILE,
    channels: [{
      channel_id: CHANNEL, profile_id: PROFILE, platform: 'instagram',
      account_handle: 'resumeguru.ai', connection_status: 'ok',
      last_successful_sync: `2026-07-${String(lastDay).padStart(2, '0')}T03:30:00.000Z`,
      revoked_at: null,
    }],
    posts,
    observations: [...observations, ...dailyRows(lastDay)],
    account_observations: dailyRows(lastDay),
    runs,
    links,
    readings: [
      { platform_post_id: 'post-pc-8', platform: 'instagram', topic_type: 'how-to', has_face: true, trending_audio: false },
    ],
  };
}

function addDays(day: string, n: number): string {
  return new Date(new Date(day).getTime() + n * 86400000).toISOString().slice(0, 10);
}

/** The whole thing, assembled the way a surface receives it. */
export function fixtureContext(
  opts: FixtureOptions & SnapshotOptions & { thresholds?: { minPieces?: number; minExposure?: number } } = {},
): AnalysisContext {
  const body = fixtureBody(opts);
  const config = opts.config ?? CONFIG;
  return buildAnalysisContext({
    facts: readProfileFacts(body, config, PROFILE),
    snapshot: fixtureSnapshot(opts),
    period: opts.period ?? { from: '2026-07-01', to: '2026-07-20' },
    now: opts.now ?? NOW,
    thresholds: opts.thresholds,
  });
}

/** A period with complete collection, for the tests that are not about gaps. */
export function cleanContext(
  opts: FixtureOptions & SnapshotOptions & { thresholds?: { minPieces?: number; minExposure?: number } } = {},
): AnalysisContext {
  return fixtureContext({
    lastCollectedDay: 20, period: { from: '2026-07-01', to: '2026-07-11' }, ...opts,
  });
}

export const SAVED_PER_VIEW = { metric_id: 'saved', window: '7d' as const, denominator: 'views' };
export const VIEWS = { metric_id: 'views', window: '7d' as const };
