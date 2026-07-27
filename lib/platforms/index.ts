// The connector contract — spec 26 §6.1.
//
// One interface, one folder per platform. The per-platform difference lives in
// a connector; the store stays platform-neutral (§3.2: a `linkedin_*` table
// family would be a second storage pattern by another name).
//
// Instagram is the first implementation and it is the EXISTING ig-sync code
// moved, not rewritten: token refresh against the 60-day expiry, the account
// snapshot with its best-effort profile_views / website_clicks call, media
// paging until the tracking window is passed, batched insights with the
// three-set fallback, and per-account error isolation.
//
// The second connector ships when a profile switches that platform on. That is
// law 3 working as designed, not a deferral (§17).

import type { MetricDefinition, MetricKind } from '../tree/objects.ts';
import { instagram } from './instagram/index.ts';

/** One post as the platform reports it, before anything is stored. */
export interface FetchedPost {
  platform_post_id: string;
  published_at: string;
  permalink: string | null;
  /** The join key. Produced by this connector's own extractPostRef. */
  post_ref: string | null;
  media_kind: string | null;
  /** The platform's own word for the container. A hint, never the truth (S15). */
  format_hint: string | null;
  caption: string | null;
  /**
   * Counts the listing already carried (Instagram returns like_count and
   * comments_count on the media itself). Kept as the floor under `postMetrics`
   * so a post whose insights call fails still records what is known — today's
   * behavior, and the reason it exists is that a missing number and a zero are
   * not the same thing.
   */
  raw_metrics?: Record<string, number>;
}

export interface RefreshedToken {
  token: string;
  refreshed_at: string;
}

export interface PlatformConnector {
  id: string;
  display_name: string;
  /** Throws on failure; the caller records it and continues with the old token. */
  refreshToken(token: string): Promise<RefreshedToken>;
  /** Every post published at or after `since`. */
  listPosts(token: string, since: string): Promise<FetchedPost[]>;
  postMetrics(token: string, post: FetchedPost): Promise<Record<string, number>>;
  accountMetrics(token: string): Promise<Record<string, number>>;
  extractPostRef(url: string | null | undefined): string | null;
  /** The catalogue (§5.4). A connector may never write a metric outside it. */
  metrics: MetricDefinition[];
}

const REGISTRY: Record<string, PlatformConnector> = {
  [instagram.id]: instagram,
};

export function connectorFor(platform: string): PlatformConnector | null {
  return REGISTRY[platform.toLowerCase()] ?? null;
}

export function connectors(): PlatformConnector[] {
  return Object.values(REGISTRY);
}

/** Is there a connector for this platform yet? A `false` is a plain answer, not an error. */
export function isConnected(platform: string): boolean {
  return connectorFor(platform) !== null;
}

// ── The catalogue, read ──────────────────────────────────────────────────────

export function metricDefinition(platform: string, metricId: string): MetricDefinition | null {
  return connectorFor(platform)?.metrics.find(m => m.metric_id === metricId) ?? null;
}

export function metricKind(platform: string, metricId: string): MetricKind | null {
  return metricDefinition(platform, metricId)?.kind ?? null;
}

/**
 * The version stamped on every observation of this metric. Two observations of
 * the same id with different versions are NOT comparable, and the store marks
 * them so (§5.4). Migrated history carries 0 — pre-registry, and it never
 * claims to have been measured under today's definitions.
 */
export function definitionVersion(platform: string, metricIds: string[]): number {
  const versions = metricIds
    .map(id => metricDefinition(platform, id)?.definition_version)
    .filter((v): v is number => typeof v === 'number');
  return versions.length ? Math.max(...versions) : 0;
}

/** Which metrics this platform reports for a given format (a static has no watch time). */
export function metricsForFormat(platform: string, format: string | null): MetricDefinition[] {
  const all = connectorFor(platform)?.metrics ?? [];
  if (!format) return all;
  return all.filter(m => m.available_for.length === 0 || m.available_for.includes(format));
}

/** The exposure metric a comparison measures reach by — from the CATALOGUE, not a
 *  hard-coded string. Spec 26 §7: the threshold's metric comes from the platform. */
export function exposureMetricFor(platform: string): string | null {
  const all = connectorFor(platform)?.metrics ?? [];
  for (const preferred of ['views', 'reach', 'impressions']) {
    if (all.some(m => m.metric_id === preferred && !m.superseded_by)) return preferred;
  }
  return all.find(m => m.kind === 'cumulative')?.metric_id ?? null;
}

/**
 * §6.1's rule: a connector may not add a metric that is not in its catalogue.
 * An unknown API field is DROPPED and named in the run's error summary — never
 * written under a guessed id.
 */
export function filterToCatalogue(
  platform: string, values: Record<string, number>,
): { kept: Record<string, number>; dropped: string[] } {
  const known = new Set((connectorFor(platform)?.metrics ?? []).map(m => m.metric_id));
  const kept: Record<string, number> = {};
  const dropped: string[] = [];
  for (const [k, v] of Object.entries(values)) {
    if (known.has(k) && typeof v === 'number' && Number.isFinite(v)) kept[k] = v;
    else dropped.push(k);
  }
  return { kept, dropped };
}

/**
 * The per-profile override (§5.4). The code catalogue is the shelf — it
 * describes the platform; `platforms/<platform>/metrics` says what THIS account
 * actually reports. Override beats universal, always (PLAN §5.1).
 */
export interface ProfileMetricOverride {
  metric_id: string;
  available: boolean;
  note?: string;
}

export function availableMetrics(
  platform: string, overrides: ProfileMetricOverride[] = [], format: string | null = null,
): string[] {
  const byId = new Map(overrides.map(o => [o.metric_id, o]));
  return metricsForFormat(platform, format)
    .filter(m => byId.get(m.metric_id)?.available !== false)
    .map(m => m.metric_id);
}
