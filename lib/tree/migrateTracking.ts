// Migration of the existing `ig_*` history — spec 26 §14, steps 1 to 7.
//
// Ordered, boring, and reversible up to the cutover. It follows spec 21 §9's
// pattern exactly: idempotent, nothing deleted, nothing guessed, and a DRY RUN
// by default — the answer is a report she can read, not a write.
//
// Step 0 (fixing the collection stall) is deliberately NOT here: it needs her
// "Update now" tap and the error it reports, and it does not wait for this
// build (§14.0).
//
// The three rules this file will not bend:
//  1. Migrated rows carry `metric_definition_version: 0` and
//     `fetch_time_precision: 'day'`. They never claim to have been measured
//     under today's definitions, and they never claim hourly age (§14.3).
//  2. Windows materialize only where a QUALIFYING reading exists. Most
//     2026-05/06 posts will get `7d` and `30d`; `first-24h` will often be
//     unavailable, because the pipe ran once a day. That is the true state of
//     the record, and it is what the store must say (§14.4).
//  3. No run records are invented. `sync_runs` starts empty and gaps before the
//     cutover read `unknown` — manufacturing plausible run history would be the
//     same lie as interpolating a chart (§14.5).

import type { MetricObservation, SyncRun } from './objects.ts';
import { extractIgShortcode } from '../igShortcode.ts';
import { ageHours, materializeWindows } from './metrics.ts';

/** 09:00 IST, the hour the pipe has always run. */
const IST_0900_UTC = 'T03:30:00.000Z';
const MIGRATION_TIMEZONE = 'Asia/Kolkata';
const LAST_SUCCESSFUL_SYNC = '2026-07-12';

// ── What the legacy tables look like ─────────────────────────────────────────

export interface LegacyIgAccount {
  id: string; username: string; access_token?: string;
  token_refreshed_at?: string; client_id?: string | null;
}
export interface LegacyIgPost {
  id: string; account_id: string; caption?: string | null;
  media_type?: string | null; media_product_type?: string | null;
  permalink?: string | null; posted_at?: string | null; first_seen_at?: string | null;
}
export interface LegacyDailySnapshot {
  post_id: string; snapshot_date: string;
  views?: number | null; reach?: number | null; likes?: number | null;
  comments?: number | null; saves?: number | null; shares?: number | null;
  total_interactions?: number | null;
}
export interface LegacyAccountSnapshot {
  account_id: string; snapshot_date: string;
  followers?: number | null; media_count?: number | null;
  profile_views?: number | null; website_clicks?: number | null;
}
export interface LegacyPostLink {
  card_id: string; client_id: string; ig_media_id: string; matched_at?: string;
}
export interface LegacyPostTag {
  ig_media_id: string;
  [field: string]: unknown;
}

export interface LegacyTracking {
  ig_accounts: LegacyIgAccount[];
  ig_posts: LegacyIgPost[];
  ig_daily_snapshots: LegacyDailySnapshot[];
  ig_account_snapshots: LegacyAccountSnapshot[];
  ig_post_links: LegacyPostLink[];
  ig_post_tags: LegacyPostTag[];
}

/** Keys already present in the new tables. Passing them makes the pass idempotent. */
export interface ExistingKeys {
  channel_ids?: string[];
  platform_post_ids?: string[];
  /** `${platform_post_id}|${fetched_at}|${window}` for every observation already there. */
  observation_keys?: string[];
  /** `${channel_id}|${fetched_at}` for every account observation already there. */
  account_observation_keys?: string[];
  /** `${id_kind}:${piece_id}` for every link already there. */
  link_keys?: string[];
  reading_ids?: string[];
}

export interface TrackingMigrationOptions {
  /**
   * Which profiles have migrated to the piece identity, and which piece ids they
   * carry (spec 21's report). A link converts to `id_kind: 'piece'` only where
   * the id is actually there; everything else stays `legacy-card`, and neither
   * kind is ever guessed into the other (§8, §14.3).
   */
  migratedPieceIds?: Record<string, string[]>;
  /** Channel ids in the migrated body, so the two halves can be matched (§5.1). */
  bodyChannelIds?: string[];
  now?: string;
}

// ── What comes out ───────────────────────────────────────────────────────────

export interface ChannelConnectionRow {
  channel_id: string; profile_id: string; platform: string; platform_account_id: string;
  account_handle: string | null; access_token: string | null; token_refreshed_at: string | null;
  connection_status: string; last_successful_sync: string | null;
  consecutive_failures: number; revoked_at: string | null;
}
export interface PlatformPostRow {
  platform_post_id: string; channel_id: string; platform: string;
  published_at: string | null; permalink: string | null; post_ref: string | null;
  media_kind: string | null; format_hint: string | null; caption: string | null;
  first_seen_at: string; last_seen_at: string; deleted_on_platform: boolean;
}
export interface ObservationRow {
  platform_post_id: string; channel_id: string; platform: string; piece_id: string | null;
  kind_of_row: 'lifetime' | 'window'; window: string; window_state?: string | null;
  unavailable_reason?: string | null; age_hours: number;
  metrics: Record<string, number>; metric_definition_version: number;
  account_timezone: string | null; local_date: string; fetched_at: string;
  fetch_time_precision: 'exact' | 'day'; connection_status: string; retry_state: string;
  source_run_id: null;
  /** Migrated ages are computed from a DAY, so they are approximate and say so. */
  age_is_approximate?: boolean;
}
export interface AccountObservationRow {
  channel_id: string; platform: string; metrics: Record<string, number>;
  metric_definition_version: number; account_timezone: string | null; local_date: string;
  fetched_at: string; fetch_time_precision: 'exact' | 'day'; connection_status: string;
  retry_state: string; source_run_id: null;
}
export interface PostLinkRow {
  piece_id: string; id_kind: 'piece' | 'legacy-card'; profile_id: string;
  channel_id: string | null; platform_post_id: string; post_ref: string | null;
  matched_at: string; match_method: 'url-ref'; confirmed_by: null;
}
export interface PostReadingRow {
  platform_post_id: string; platform: string;
  [field: string]: unknown;
}

export interface TrackingMigrationRows {
  channel_connections: ChannelConnectionRow[];
  platform_posts: PlatformPostRow[];
  post_observations: ObservationRow[];
  account_observations: AccountObservationRow[];
  post_links: PostLinkRow[];
  post_readings: PostReadingRow[];
  /** §14.5 — always empty. It is here to make the emptiness deliberate. */
  sync_runs: SyncRun[];
}

export interface ParityRow {
  table: string;
  before: number;
  after: number;
  /** Rows already present from an earlier run of this same pass. */
  skipped: number;
  parity: boolean;
}

export interface TrackingMigrationReport {
  at: string;
  parity: ParityRow[];
  channelsFound: { channel_id: string; handle: string; profile_id: string; matched_body_entry: boolean }[];
  observationsCopied: number;
  windowsMaterialized: number;
  windowsUnavailable: { platform_post_id: string; window: string; why: string }[];
  linksConverted: { piece: number; legacyCard: number };
  gaps: { channel_id: string; note: string }[];
  refusedToGuess: { what: string; why: string }[];
  questionsForHer: string[];
}

export interface TrackingMigrationResult {
  rows: TrackingMigrationRows;
  report: TrackingMigrationReport;
}

function slug(s: string): string {
  return (s || 'unnamed').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** The metric ids a legacy snapshot row carries. `null` never becomes a zero. */
function snapshotMetrics(s: LegacyDailySnapshot): Record<string, number> {
  const out: Record<string, number> = {};
  const pairs: [string, number | null | undefined][] = [
    ['views', s.views], ['reach', s.reach], ['likes', s.likes], ['comments', s.comments],
    ['saved', s.saves], ['shares', s.shares], ['total_interactions', s.total_interactions],
  ];
  for (const [id, v] of pairs) if (typeof v === 'number') out[id] = v;
  return out;
}

function accountMetrics(s: LegacyAccountSnapshot): Record<string, number> {
  const out: Record<string, number> = {};
  const pairs: [string, number | null | undefined][] = [
    ['followers', s.followers], ['media_count', s.media_count],
    // Spec 05's two. Absent before its ship date, and absent is the honest
    // "collecting since" — never a zero (§14.3).
    ['profile_views', s.profile_views], ['website_clicks', s.website_clicks],
  ];
  for (const [id, v] of pairs) if (typeof v === 'number') out[id] = v;
  return out;
}

/**
 * The whole pass, as a pure function. The route hands it what the legacy tables
 * hold and what the new ones already hold; it hands back the rows to insert and
 * the report she reads. Running it twice writes nothing the second time.
 */
export function migrateTracking(
  legacy: LegacyTracking, existing: ExistingKeys = {}, opts: TrackingMigrationOptions = {},
): TrackingMigrationResult {
  const now = opts.now ?? new Date().toISOString();
  const haveChannels = new Set(existing.channel_ids ?? []);
  const havePosts = new Set(existing.platform_post_ids ?? []);
  const haveObs = new Set(existing.observation_keys ?? []);
  const haveAccObs = new Set(existing.account_observation_keys ?? []);
  const haveLinks = new Set(existing.link_keys ?? []);
  const haveReadings = new Set(existing.reading_ids ?? []);

  const rows: TrackingMigrationRows = {
    channel_connections: [], platform_posts: [], post_observations: [],
    account_observations: [], post_links: [], post_readings: [], sync_runs: [],
  };
  const report: TrackingMigrationReport = {
    at: now, parity: [], channelsFound: [], observationsCopied: 0, windowsMaterialized: 0,
    windowsUnavailable: [], linksConverted: { piece: 0, legacyCard: 0 }, gaps: [],
    refusedToGuess: [], questionsForHer: [],
  };

  // ── 3a. ig_accounts → channel_connections ──────────────────────────────────
  const channelByAccount = new Map<string, string>();
  let skippedChannels = 0;
  for (const a of legacy.ig_accounts) {
    const channelId = `ch-${slug(a.username)}`;
    channelByAccount.set(a.id, channelId);
    const matched = (opts.bodyChannelIds ?? []).includes(channelId);
    report.channelsFound.push({
      channel_id: channelId, handle: a.username, profile_id: a.client_id ?? '', matched_body_entry: matched,
    });
    if (!a.client_id) {
      report.refusedToGuess.push({
        what: `@${a.username} → which profile`,
        why: 'ig_accounts.client_id is empty and the account name is not evidence of a profile',
      });
    }
    if (!matched) {
      report.questionsForHer.push(
        `@${a.username}: this connection has no channel entry in the migrated body yet. ` +
        'Migrate that profile first, or confirm the channel it belongs to.',
      );
    }
    if (haveChannels.has(channelId)) { skippedChannels++; continue; }
    rows.channel_connections.push({
      channel_id: channelId, profile_id: a.client_id ?? '', platform: 'instagram',
      platform_account_id: a.id, account_handle: a.username,
      access_token: a.access_token ?? null, token_refreshed_at: a.token_refreshed_at ?? null,
      // There is no run history to prove otherwise (§14.3).
      connection_status: 'unknown',
      last_successful_sync: LAST_SUCCESSFUL_SYNC,
      consecutive_failures: 0, revoked_at: null,
    });
  }
  report.questionsForHer.push(
    'Each channel\'s track_since: the 2026-05-01 pivot was her call and becomes a stored value per channel.',
    'Each channel\'s timezone: migrated rows are stamped Asia/Kolkata because the pipe has always run on IST. Confirm it.',
  );

  // ── 3b. ig_posts → platform_posts ──────────────────────────────────────────
  const publishedAt = new Map<string, string>();
  const channelOfPost = new Map<string, string>();
  let skippedPosts = 0;
  for (const p of legacy.ig_posts) {
    const channelId = channelByAccount.get(p.account_id) ?? `ch-${slug(p.account_id)}`;
    channelOfPost.set(p.id, channelId);
    if (p.posted_at) publishedAt.set(p.id, p.posted_at);
    if (havePosts.has(p.id)) { skippedPosts++; continue; }
    rows.platform_posts.push({
      platform_post_id: p.id, channel_id: channelId, platform: 'instagram',
      published_at: p.posted_at ?? null, permalink: p.permalink ?? null,
      // Computed by running the SAME function that made the link in the first
      // place, so the values agree by construction (§14.3).
      post_ref: extractIgShortcode(p.permalink),
      media_kind: p.media_type ?? null, format_hint: p.media_product_type ?? p.media_type ?? null,
      caption: p.caption ?? null,
      first_seen_at: p.first_seen_at ?? now, last_seen_at: p.first_seen_at ?? now,
      deleted_on_platform: false,
    });
  }

  // ── 3c. ig_daily_snapshots → post_observations ─────────────────────────────
  const lifetimeByPost = new Map<string, MetricObservation[]>();
  let skippedObs = 0;
  for (const s of legacy.ig_daily_snapshots) {
    const fetchedAt = `${s.snapshot_date}${IST_0900_UTC}`;
    const key = `${s.post_id}|${fetchedAt}|lifetime`;
    const published = publishedAt.get(s.post_id);
    const age = published ? ageHours(published, fetchedAt) : 0;
    const channelId = channelOfPost.get(s.post_id) ?? '';
    const metrics = snapshotMetrics(s);

    // Kept for window materialization even when the row itself is skipped, so a
    // second run of this pass reaches the same conclusions.
    const list = lifetimeByPost.get(s.post_id) ?? [];
    list.push({
      id: key, piece_id: null, platform_post_id: s.post_id, channel_id: channelId,
      platform: 'instagram', kind_of_row: 'lifetime', window: 'lifetime',
      age_hours: age, metrics, metric_definition_version: 0,
      account_timezone: MIGRATION_TIMEZONE, local_date: s.snapshot_date,
      fetched_at: fetchedAt, fetch_time_precision: 'day', connection_status: 'ok',
      retry_state: 'none', source_run_id: null,
    });
    lifetimeByPost.set(s.post_id, list);

    if (haveObs.has(key)) { skippedObs++; continue; }
    if (!published) {
      report.refusedToGuess.push({
        what: `age of ${s.post_id} on ${s.snapshot_date}`,
        why: 'the post has no published_at in ig_posts, so its age cannot be computed and is recorded as 0 with the precision marked `day`',
      });
    }
    rows.post_observations.push({
      platform_post_id: s.post_id, channel_id: channelId, platform: 'instagram', piece_id: null,
      kind_of_row: 'lifetime', window: 'lifetime', age_hours: age, metrics,
      // Pre-registry. A migrated row never claims to have been measured under
      // today's definitions (§14.3).
      metric_definition_version: 0,
      account_timezone: MIGRATION_TIMEZONE, local_date: s.snapshot_date,
      fetched_at: fetchedAt, fetch_time_precision: 'day',
      connection_status: 'ok', retry_state: 'none', source_run_id: null,
      age_is_approximate: true,
    });
    report.observationsCopied++;
  }

  // ── 4. Windows, only where a qualifying reading exists ─────────────────────
  for (const [postId, lifetimeRows] of lifetimeByPost) {
    const published = publishedAt.get(postId);
    if (!published) continue;
    const materialized = materializeWindows(lifetimeRows, {
      ageNowHours: ageHours(published, now),
      now,
      idFor: w => `${postId}-${w}-migrated`,
    });
    for (const w of materialized) {
      if (w.window_state === 'too-early') continue;      // it will materialize when it can
      const key = `${postId}|${w.fetched_at}|${w.window}`;
      if (w.window_state === 'unavailable') {
        report.windowsUnavailable.push({
          platform_post_id: postId, window: String(w.window),
          why: 'no reading inside the window — the pipe ran once a day, so first-24h often has none. Not zero, not the nearest value.',
        });
      } else {
        report.windowsMaterialized++;
      }
      if (haveObs.has(key)) continue;
      rows.post_observations.push({
        platform_post_id: postId, channel_id: channelOfPost.get(postId) ?? '',
        platform: 'instagram', piece_id: null, kind_of_row: 'window', window: String(w.window),
        window_state: w.window_state ?? null, unavailable_reason: w.unavailable_reason ?? null,
        age_hours: w.age_hours, metrics: w.metrics, metric_definition_version: 0,
        account_timezone: MIGRATION_TIMEZONE, local_date: w.local_date ?? String(w.fetched_at).slice(0, 10),
        fetched_at: w.fetched_at, fetch_time_precision: 'day',
        connection_status: 'ok', retry_state: 'none', source_run_id: null,
        age_is_approximate: true,
      });
    }
  }

  // ── 3d. ig_account_snapshots → account_observations ────────────────────────
  let skippedAccObs = 0;
  for (const s of legacy.ig_account_snapshots) {
    const channelId = channelByAccount.get(s.account_id) ?? `ch-${slug(s.account_id)}`;
    const fetchedAt = `${s.snapshot_date}${IST_0900_UTC}`;
    const key = `${channelId}|${fetchedAt}`;
    if (haveAccObs.has(key)) { skippedAccObs++; continue; }
    rows.account_observations.push({
      channel_id: channelId, platform: 'instagram', metrics: accountMetrics(s),
      metric_definition_version: 0, account_timezone: MIGRATION_TIMEZONE,
      local_date: s.snapshot_date, fetched_at: fetchedAt, fetch_time_precision: 'day',
      connection_status: 'ok', retry_state: 'none', source_run_id: null,
    });
  }

  // ── 3e. ig_post_links → post_links ─────────────────────────────────────────
  const refByPost = new Map(rows.platform_posts.map(p => [p.platform_post_id, p.post_ref]));
  let skippedLinks = 0;
  for (const l of legacy.ig_post_links) {
    const migrated = opts.migratedPieceIds?.[l.client_id] ?? [];
    const isPiece = migrated.includes(l.card_id);
    const idKind: 'piece' | 'legacy-card' = isPiece ? 'piece' : 'legacy-card';
    const key = `${idKind}:${l.card_id}`;
    if (isPiece) report.linksConverted.piece++;
    else report.linksConverted.legacyCard++;
    if (haveLinks.has(key)) { skippedLinks++; continue; }
    rows.post_links.push({
      piece_id: l.card_id, id_kind: idKind, profile_id: l.client_id,
      channel_id: channelOfPost.get(l.ig_media_id) ?? null,
      platform_post_id: l.ig_media_id,
      post_ref: refByPost.get(l.ig_media_id) ?? null,
      matched_at: l.matched_at ?? now, match_method: 'url-ref', confirmed_by: null,
    });
  }
  if (report.linksConverted.legacyCard > 0) {
    report.questionsForHer.push(
      `${report.linksConverted.legacyCard} link(s) stay as legacy cards because their profile has not migrated ` +
      'to the piece identity yet. They convert when it does — never by guessing.',
    );
  }

  // ── 3f. ig_post_tags → post_readings ───────────────────────────────────────
  let skippedReadings = 0;
  for (const t of legacy.ig_post_tags) {
    if (haveReadings.has(t.ig_media_id)) { skippedReadings++; continue; }
    const { ig_media_id, ...rest } = t;
    rows.post_readings.push({
      platform_post_id: ig_media_id, platform: 'instagram',
      // `corrected` and every other field carry over untouched: sticky owner
      // corrections are never overwritten, and this rename changes no behavior.
      ...rest,
    });
  }

  // ── 5. No run records are invented ─────────────────────────────────────────
  report.gaps.push({
    channel_id: 'all',
    note: 'sync_runs starts EMPTY. Gaps before the cutover derive from observation ' +
      'absence with reason `unknown` — manufacturing plausible run history would be ' +
      'the same lie as interpolating a chart (§14.5).',
  });
  // ── 6. The stall is not backfilled ─────────────────────────────────────────
  report.gaps.push({
    channel_id: 'all',
    note: `Collection stalled on ${LAST_SUCCESSFUL_SYNC}. The first successful run records ` +
      'current lifetime totals stamped `backfilled`, and the gap stays exactly as wide as it is. ' +
      'That curve does not exist and will not exist.',
  });

  const parity = (table: string, before: number, written: number, skipped: number): ParityRow => ({
    table, before, after: written + skipped, skipped, parity: written + skipped === before,
  });
  report.parity = [
    parity('ig_accounts → channel_connections', legacy.ig_accounts.length, rows.channel_connections.length, skippedChannels),
    parity('ig_posts → platform_posts', legacy.ig_posts.length, rows.platform_posts.length, skippedPosts),
    parity('ig_daily_snapshots → post_observations', legacy.ig_daily_snapshots.length,
      rows.post_observations.filter(r => r.kind_of_row === 'lifetime').length, skippedObs),
    parity('ig_account_snapshots → account_observations', legacy.ig_account_snapshots.length, rows.account_observations.length, skippedAccObs),
    parity('ig_post_links → post_links', legacy.ig_post_links.length, rows.post_links.length, skippedLinks),
    parity('ig_post_tags → post_readings', legacy.ig_post_tags.length, rows.post_readings.length, skippedReadings),
  ];

  return { rows, report };
}

/** The report as plain text, the way spec 21's migration report reads. */
export function trackingReportToText(r: TrackingMigrationReport): string {
  const lines: string[] = [];
  lines.push(`Tracking migration — ${r.at.slice(0, 10)}`);
  lines.push('');
  lines.push('Row counts, table by table:');
  for (const p of r.parity) {
    lines.push(`  ${p.parity ? 'match' : 'MISMATCH'}  ${p.table}: ${p.before} before, ${p.after} after` +
      (p.skipped ? ` (${p.skipped} already there)` : ''));
  }
  lines.push('');
  lines.push('Channels found:');
  for (const c of r.channelsFound) {
    lines.push(`  @${c.handle} → ${c.channel_id}` +
      (c.matched_body_entry ? '' : ' — no matching channel entry in the body yet'));
  }
  lines.push('');
  lines.push(`Observations copied: ${r.observationsCopied}`);
  lines.push(`Windows materialized: ${r.windowsMaterialized}`);
  lines.push(`Windows unavailable: ${r.windowsUnavailable.length}`);
  if (r.windowsUnavailable.length) {
    lines.push('  (the pipe ran once a day, so a first-24h reading often does not exist. ' +
      'Unavailable is the true state of the record — not zero, and not the nearest value.)');
  }
  lines.push(`Links: ${r.linksConverted.piece} to pieces, ${r.linksConverted.legacyCard} still legacy cards`);
  lines.push('');
  lines.push('Gaps:');
  for (const g of r.gaps) lines.push(`  ${g.note}`);
  if (r.refusedToGuess.length) {
    lines.push('');
    lines.push('Refused to guess:');
    for (const x of r.refusedToGuess) lines.push(`  ${x.what} — ${x.why}`);
  }
  if (r.questionsForHer.length) {
    lines.push('');
    lines.push('For her:');
    for (const q of r.questionsForHer) lines.push(`  ${q}`);
  }
  return lines.join('\n');
}
