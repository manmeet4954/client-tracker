import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { authConfigured, verifyToken, SESSION_COOKIE } from '@/lib/auth';
import type { AppState } from '@/types';
import { connectorFor, filterToCatalogue, definitionVersion } from '@/lib/platforms';
import type { FetchedPost } from '@/lib/platforms';
import { igIdentity } from '@/lib/platforms/instagram';
import {
  POST_BATCH_SIZE, RUN_BUDGET_MS, closePartialRun, decideCollection, decideRetry,
  localDate, resumeFrom, retryStateFor, tokenNeedsRefresh, withinTrackWindow,
} from '@/lib/tree/collector';
import { ageHours, materializeWindows, deletionsAfterRuns } from '@/lib/tree/metrics';
import { resolvePostLinks } from '@/lib/tree/postLinks';
import type { JoinablePiece } from '@/lib/tree/postLinks';
import type { MetricObservation, SyncRun } from '@/lib/tree/objects';

// Next caches fetch() by URL and supabase-js rides on fetch; long-lived query
// URLs get served from the data cache at random. That one behavior ate previews
// for eight days (see lib/supabaseServer.ts). Every server client pins no-store.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });


// The metric collector — spec 26 §6. One daily-and-forever pipe per connected
// channel, generalized from "Instagram" to "any platform this profile publishes
// on". This route IS the old `/api/ig-sync`, looping over connectors instead of
// over Instagram accounts; `/api/ig-sync` now forwards here.
//
// Triggered by the Vercel cron (twice daily, 09:00 and 21:00 IST — §6.3), by
// ?secret=CRON_SECRET, or by a logged-in OWNER (the "Update now" button, which
// keeps working unchanged).
//
// The two rules to hold in mind while reading:
//  1. Every observation is an INSERT. A second run the same day adds a row and
//     overwrites nothing (§5.3). A correction is a new row.
//  2. Backfill records current lifetime totals at TODAY's age. It closes no gap,
//     and there is no interpolation anywhere in this file (§6.4).

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/** The pivot window, kept as the fallback for a channel with no `track_since`. */
const DEFAULT_TRACK_SINCE = '2026-05-01';

/** §14.7: the collector writes both stores for seven days, then reads move over.
 *  Both sides are idempotent per run, which is what makes it safe. */
const DUAL_WRITE_IG = true;

function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase env vars missing');
  return createClient(url, key, { global: { fetch: noStoreFetch } });
}

interface ConnectionRow {
  channel_id: string;
  profile_id: string;
  platform: string;
  platform_account_id: string;
  account_handle: string | null;
  access_token: string | null;
  token_refreshed_at: string | null;
  connection_status: string;
  last_successful_sync: string | null;
  consecutive_failures: number;
  revoked_at: string | null;
}

interface ChannelFacts {
  timezone: string | null;
  track_since: string;
  metrics_permission: 'granted' | 'not-granted' | 'unknown';
  positionsSet: boolean;
  config: Record<string, { state: 'active' | 'history' | 'hidden'; set_at: string }>;
  lifecycle: string | undefined;
}

function slug(s: string): string {
  return (s || 'unnamed').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * What the BODY knows about this channel: its timezone, when it started
 * collecting, and whether we may read its numbers. The token is not here and
 * never will be — that split is the reason `channel_connections` exists (§5.1).
 */
function channelFacts(state: AppState | null, conn: ConnectionRow): ChannelFacts {
  const client = state?.clients?.find(c => c.id === conn.profile_id);
  const data = state?.clientData?.[conn.profile_id];
  const entries = data?.body?.paths?.['work-log/creation/channels'] ?? [];
  const entry = entries.find(e => e.id === conn.channel_id)
    ?? entries.find(e => slug(String((e.data as { account_handle?: string }).account_handle ?? '')) === slug(conn.account_handle ?? ''));
  const d = (entry?.data ?? {}) as {
    timezone?: string | null; track_since?: string | null;
    metrics_permission?: 'granted' | 'not-granted' | 'unknown';
  };
  return {
    timezone: d.timezone ?? null,
    track_since: d.track_since ?? DEFAULT_TRACK_SINCE,
    metrics_permission: d.metrics_permission ?? 'unknown',
    // Spec 21 §9.6: a profile whose switchboard she has never walked behaves
    // exactly as it does today. Collection never stops on a position nobody set.
    positionsSet: Object.keys(client?.switches ?? {}).length > 0,
    config: (client?.switches ?? {}) as ChannelFacts['config'],
    lifecycle: client?.lifecycle,
  };
}

/** Every connected channel. Seeds from `ig_accounts`, then from the env token —
 *  the original single-token behavior, kept, so nothing needs a setup day to run. */
async function loadConnections(supabase: SupabaseClient, errors: string[]): Promise<ConnectionRow[]> {
  const { data: rows } = await supabase.from('channel_connections').select('*');
  if (rows?.length) return rows as ConnectionRow[];

  const seeded: ConnectionRow[] = [];
  const { data: legacy } = await supabase.from('ig_accounts').select('*');
  for (const a of (legacy ?? []) as {
    id: string; username: string; access_token: string;
    token_refreshed_at: string; client_id?: string | null;
  }[]) {
    seeded.push({
      channel_id: `ch-${slug(a.username)}`,
      profile_id: a.client_id ?? '',
      platform: 'instagram',
      platform_account_id: a.id,
      account_handle: a.username,
      access_token: a.access_token,
      token_refreshed_at: a.token_refreshed_at,
      // There is no run history to prove otherwise, and a guess here would be
      // the first lie in a store built to refuse them (§14.3).
      connection_status: 'unknown',
      last_successful_sync: null,
      consecutive_failures: 0,
      revoked_at: null,
    });
  }

  if (!seeded.length) {
    const token = process.env.IG_ACCESS_TOKEN;
    if (!token) return [];
    try {
      const me = await igIdentity(token);
      seeded.push({
        channel_id: `ch-${slug(me.username)}`, profile_id: '', platform: 'instagram',
        platform_account_id: me.id, account_handle: me.username, access_token: token,
        token_refreshed_at: new Date().toISOString(), connection_status: 'unknown',
        last_successful_sync: null, consecutive_failures: 0, revoked_at: null,
      });
    } catch (e) {
      errors.push(`seed from env token: ${e instanceof Error ? e.message : String(e)}`);
      return [];
    }
  }

  if (seeded.length) {
    const { error } = await supabase.from('channel_connections').upsert(seeded);
    if (error) errors.push(`seed channel_connections: ${error.message}`);
  }
  return seeded;
}

interface RunResult {
  channel: string;
  platform: string;
  status: SyncRun['connection_status'];
  posts_seen: number;
  posts_observed: number;
  completed: boolean;
  reason?: string;
}

/** One channel's full run — §6.2, step by step, every step's failure isolated so
 *  one bad token never blocks another account (today's behavior, kept). */
async function syncChannel(
  supabase: SupabaseClient, conn: ConnectionRow, facts: ChannelFacts,
  trigger: SyncRun['trigger'], startedAt: number, errors: string[],
): Promise<RunResult> {
  const tag = conn.account_handle ?? conn.channel_id;
  const connector = connectorFor(conn.platform);
  const runId = `${conn.channel_id}-${new Date().toISOString()}`;
  const now = new Date().toISOString();

  const openRun = async (attempt: number) => {
    await supabase.from('sync_runs').insert({
      run_id: runId, channel_id: conn.channel_id, platform: conn.platform,
      started_at: now, trigger, connection_status: 'unknown', attempt,
    });
  };
  const closeRun = async (fields: Partial<SyncRun>) => {
    await supabase.from('sync_runs').update({
      ended_at: new Date().toISOString(), ...fields,
    }).eq('run_id', runId);
  };

  // 1 + attempt. A failed channel is retried on the next tick, up to three
  // attempts, then it is left for the next day (§6.4).
  const { data: lastRuns } = await supabase.from('sync_runs')
    .select('completed,attempt').eq('channel_id', conn.channel_id)
    .order('started_at', { ascending: false }).limit(1);
  const retry = decideRetry((lastRuns?.[0] as Pick<SyncRun, 'completed' | 'attempt'> | undefined) ?? null);
  await openRun(retry.attempt);

  if (!connector) {
    await closeRun({ connection_status: 'not-connected', completed: true, error_summary: [`no connector for ${conn.platform}`] });
    return { channel: tag, platform: conn.platform, status: 'not-connected', posts_seen: 0, posts_observed: 0, completed: true, reason: `no connector for ${conn.platform} yet` };
  }

  // 2, 3 and 4 — the switches, the lifecycle and the metrics permission. A stop
  // here writes NOTHING but the run, and the run is what makes the absence
  // explainable later (§5.5).
  const decision = decideCollection({
    platform: conn.platform, config: facts.config, positionsSet: facts.positionsSet,
    lifecycle: facts.lifecycle as never, metricsPermission: facts.metrics_permission,
    connectionRevokedAt: conn.revoked_at,
  });
  if (!decision.collect) {
    await closeRun({ connection_status: decision.status, completed: true, error_summary: [decision.reason] });
    return {
      channel: tag, platform: conn.platform, status: decision.status,
      posts_seen: 0, posts_observed: 0, completed: true, reason: decision.reason,
    };
  }

  let token = conn.access_token ?? '';
  const runErrors: string[] = [];

  // 5. Refresh the token weekly; on failure record it and continue with the old
  //    one — it may still work, which is today's behavior.
  if (tokenNeedsRefresh(conn.token_refreshed_at)) {
    try {
      const refreshed = await connector.refreshToken(token);
      token = refreshed.token;
      await supabase.from('channel_connections').update({
        access_token: refreshed.token, token_refreshed_at: refreshed.refreshed_at,
      }).eq('channel_id', conn.channel_id);
    } catch (e) {
      runErrors.push(`${tag} token refresh: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const stamp = localDate(new Date().toISOString(), facts.timezone);
  const retryState = retryStateFor(trigger);

  // 6. Account metrics — one row, INSERT, with the local date in the channel's
  //    own timezone (or UTC, labeled as such, for a channel with none).
  try {
    const raw = await connector.accountMetrics(token);
    const { kept, dropped } = filterToCatalogue(conn.platform, raw);
    if (dropped.length) runErrors.push(`${tag} unknown account fields dropped: ${dropped.join(', ')}`);
    await supabase.from('account_observations').insert({
      channel_id: conn.channel_id, platform: conn.platform, metrics: kept,
      metric_definition_version: definitionVersion(conn.platform, Object.keys(kept)),
      account_timezone: stamp.account_timezone, local_date: stamp.local_date,
      fetched_at: new Date().toISOString(), fetch_time_precision: 'exact',
      connection_status: 'ok', retry_state: retryState, source_run_id: runId,
    });
    if (DUAL_WRITE_IG && conn.platform === 'instagram') {
      await supabase.from('ig_account_snapshots').upsert({
        account_id: conn.platform_account_id, snapshot_date: stamp.local_date,
        followers: kept.followers ?? null, media_count: kept.media_count ?? null,
        profile_views: kept.profile_views ?? null, website_clicks: kept.website_clicks ?? null,
      });
    }
  } catch (e) {
    runErrors.push(`${tag} account metrics: ${e instanceof Error ? e.message : String(e)}`);
  }

  // 7. List posts published since this channel's own track_since, and upsert.
  let posts: FetchedPost[] = [];
  try {
    posts = (await connector.listPosts(token, facts.track_since))
      .filter(p => withinTrackWindow(p.published_at, facts.track_since));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    runErrors.push(`${tag} list posts: ${msg}`);
    await closeRun({ connection_status: 'platform-error', completed: false, error_summary: runErrors });
    errors.push(...runErrors);
    return { channel: tag, platform: conn.platform, status: 'platform-error', posts_seen: 0, posts_observed: 0, completed: false };
  }

  if (posts.length) {
    const { error } = await supabase.from('platform_posts').upsert(posts.map(p => ({
      platform_post_id: p.platform_post_id, channel_id: conn.channel_id, platform: conn.platform,
      published_at: p.published_at, permalink: p.permalink, post_ref: p.post_ref,
      media_kind: p.media_kind, format_hint: p.format_hint, caption: p.caption,
      last_seen_at: new Date().toISOString(),
    })));
    if (error) runErrors.push(`${tag} upsert posts: ${error.message}`);
    if (DUAL_WRITE_IG && conn.platform === 'instagram') {
      await supabase.from('ig_posts').upsert(posts.map(p => ({
        id: p.platform_post_id, account_id: conn.platform_account_id, caption: p.caption,
        media_type: p.media_kind, media_product_type: p.format_hint,
        permalink: p.permalink, posted_at: p.published_at,
      })));
    }
  }

  // 8. Post metrics in batches of five (today's batching, kept for the 60-second
  //    ceiling), INSERT-only, each row stamped with its own age.
  const order = posts.map(p => p.platform_post_id);
  const { data: openRuns } = await supabase.from('sync_runs')
    .select('resume_cursor').eq('channel_id', conn.channel_id).eq('completed', false)
    .order('started_at', { ascending: false }).limit(1);
  const queue = resumeFrom(order, (openRuns?.[0] as { resume_cursor?: string } | undefined)?.resume_cursor);
  const byId = new Map(posts.map(p => [p.platform_post_id, p]));
  const observedIds: string[] = [];

  for (let i = 0; i < queue.length; i += POST_BATCH_SIZE) {
    if (Date.now() - startedAt > RUN_BUDGET_MS) break;   // §6.6: stop honestly
    const batch = queue.slice(i, i + POST_BATCH_SIZE)
      .map(id => byId.get(id)).filter((p): p is FetchedPost => !!p);
    const rows = await Promise.all(batch.map(async post => {
      const raw = await connector.postMetrics(token, post).catch(() => ({}));
      const { kept, dropped } = filterToCatalogue(conn.platform, raw);
      if (dropped.length) runErrors.push(`${tag} unknown fields on ${post.platform_post_id} dropped: ${dropped.join(', ')}`);
      const fetchedAt = new Date().toISOString();
      return {
        platform_post_id: post.platform_post_id, channel_id: conn.channel_id,
        platform: conn.platform, piece_id: null,
        kind_of_row: 'lifetime', window: 'lifetime',
        age_hours: ageHours(post.published_at, fetchedAt),
        metrics: kept,
        metric_definition_version: definitionVersion(conn.platform, Object.keys(kept)),
        account_timezone: stamp.account_timezone, local_date: stamp.local_date,
        fetched_at: fetchedAt, fetch_time_precision: 'exact',
        connection_status: 'ok', retry_state: retryState,
        last_successful_sync: conn.last_successful_sync, source_run_id: runId,
      };
    }));
    const { error } = await supabase.from('post_observations').insert(rows);
    if (error) runErrors.push(`${tag} observations batch ${i / POST_BATCH_SIZE}: ${error.message}`);
    else observedIds.push(...rows.map(r => r.platform_post_id));

    if (DUAL_WRITE_IG && conn.platform === 'instagram') {
      await supabase.from('ig_daily_snapshots').upsert(rows.map(r => ({
        post_id: r.platform_post_id, snapshot_date: r.local_date,
        views: r.metrics.views ?? null, reach: r.metrics.reach ?? null,
        likes: r.metrics.likes ?? null, comments: r.metrics.comments ?? null,
        saves: r.metrics.saved ?? null, shares: r.metrics.shares ?? null,
        total_interactions: r.metrics.total_interactions ?? null,
      })));
    }
  }

  const partial = closePartialRun(order, observedIds);

  // 9. Materialize any window readings that just became eligible (§7). A window
  //    is materialized ONCE and never recomputed.
  try {
    await materializeForChannel(supabase, conn, posts);
  } catch (e) {
    runErrors.push(`${tag} windows: ${e instanceof Error ? e.message : String(e)}`);
  }

  // 11. Deletion markers — two consecutive COMPLETED runs, never one (§6.5).
  try {
    await markDeletions(supabase, conn, observedIds, partial.completed);
  } catch (e) {
    runErrors.push(`${tag} deletions: ${e instanceof Error ? e.message : String(e)}`);
  }

  // 12. Close the run. On a fully successful run the connection records its
  //     last successful sync and its failure count resets.
  const status: SyncRun['connection_status'] = runErrors.length ? 'error' : 'ok';
  await closeRun({
    connection_status: status, posts_seen: posts.length, posts_observed: observedIds.length,
    completed: partial.completed, error_summary: runErrors,
    resume_cursor: partial.resume_cursor,
    missed_platform_post_ids: partial.missed_platform_post_ids,
  } as Partial<SyncRun>);

  if (partial.completed && status === 'ok') {
    await supabase.from('channel_connections').update({
      connection_status: 'ok', last_successful_sync: new Date().toISOString(), consecutive_failures: 0,
    }).eq('channel_id', conn.channel_id);
  } else {
    await supabase.from('channel_connections').update({
      connection_status: status === 'ok' ? 'partial' : 'error',
      consecutive_failures: (conn.consecutive_failures ?? 0) + 1,
    }).eq('channel_id', conn.channel_id);
  }

  errors.push(...runErrors);
  return {
    channel: tag, platform: conn.platform, status,
    posts_seen: posts.length, posts_observed: observedIds.length, completed: partial.completed,
  };
}

/** §7, applied: one pass per post, writing only the windows that are new. */
async function materializeForChannel(
  supabase: SupabaseClient, conn: ConnectionRow, posts: FetchedPost[],
): Promise<void> {
  for (const post of posts) {
    const { data: rows } = await supabase.from('post_observations')
      .select('*').eq('platform_post_id', post.platform_post_id);
    const all = (rows ?? []) as unknown as MetricObservation[];
    const lifetime = all.filter(r => (r.kind_of_row ?? 'lifetime') === 'lifetime');
    const existing = all.filter(r => r.kind_of_row === 'window');
    const fresh = materializeWindows(lifetime, {
      ageNowHours: ageHours(post.published_at, new Date().toISOString()),
      existing,
    });
    // A window row that already exists in the same state is not rewritten:
    // recomputing a window would silently change history (§7).
    const have = new Set(existing.map(r => `${r.window}|${r.window_state}`));
    const toWrite = fresh.filter(r => !have.has(`${r.window}|${r.window_state}`));
    if (!toWrite.length) continue;
    await supabase.from('post_observations').insert(toWrite.map(r => ({
      platform_post_id: post.platform_post_id, channel_id: conn.channel_id,
      platform: conn.platform, piece_id: r.piece_id,
      kind_of_row: 'window', window: r.window, window_state: r.window_state,
      unavailable_reason: r.unavailable_reason ?? null,
      age_hours: r.age_hours, metrics: r.metrics,
      metric_definition_version: r.metric_definition_version,
      account_timezone: r.account_timezone, local_date: r.local_date,
      fetched_at: r.fetched_at, fetch_time_precision: r.fetch_time_precision,
      connection_status: r.connection_status, retry_state: r.retry_state ?? 'none',
      source_run_id: r.source_run_id ?? null,
    })));
  }
}

/**
 * §6.5. A post absent from TWO consecutive completed runs is marked deleted, and
 * its observations stay forever — the history is real and was collected honestly.
 */
async function markDeletions(
  supabase: SupabaseClient, conn: ConnectionRow, seenNow: string[], completed: boolean,
): Promise<void> {
  if (!completed) return;                       // a partial run proves nothing
  const { data: previous } = await supabase.from('sync_runs')
    .select('run_id,channel_id,completed').eq('channel_id', conn.channel_id).eq('completed', true)
    .order('started_at', { ascending: false }).limit(2);
  if ((previous ?? []).length < 1) return;

  const { data: known } = await supabase.from('platform_posts')
    .select('platform_post_id,channel_id,deleted_on_platform').eq('channel_id', conn.channel_id);
  const { data: prevObs } = await supabase.from('post_observations')
    .select('platform_post_id').eq('channel_id', conn.channel_id)
    .eq('source_run_id', (previous ?? [])[0]?.run_id ?? '');

  const gone = deletionsAfterRuns(
    (known ?? []) as { platform_post_id: string; channel_id: string; deleted_on_platform: boolean }[],
    [
      { run_id: 'now', channel_id: conn.channel_id, seen: seenNow },
      { run_id: 'previous', channel_id: conn.channel_id, seen: [...new Set((prevObs ?? []).map(o => o.platform_post_id))] },
    ],
  );
  if (!gone.length) return;
  await supabase.from('platform_posts')
    .update({ deleted_on_platform: true }).in('platform_post_id', gone);
}

/**
 * The link join (§8), generalized from spec 03: she pastes the live link, and
 * that paste IS the trigger. Nothing new to type, ever.
 *
 * The decisions live in `lib/tree/postLinks.ts` so they can be proven without a
 * database; this function is only the reading and the writing around them.
 */
async function joinPostLinks(
  supabase: SupabaseClient, state: AppState | null, errors: string[],
): Promise<{ attached: number; conflicts: number; unmatched: number; unplanned: number }> {
  const empty = { attached: 0, conflicts: 0, unmatched: 0, unplanned: 0 };
  if (!state) return empty;
  const { data: posts, error } = await supabase.from('platform_posts')
    .select('platform_post_id, platform, post_ref, channel_id, published_at');
  if (error) {
    errors.push(`link join: read platform_posts: ${error.message}`);
    return empty;
  }

  const pieces: JoinablePiece[] = [];
  for (const [profileId, data] of Object.entries(state.clientData ?? {})) {
    const migrated = data.body?.paths?.['work-log/creation'] ?? [];
    // The canonical piece identity first (S2); the legacy card only where the
    // profile has not migrated. Neither kind is ever guessed into the other.
    for (const piece of migrated) {
      const d = piece.data as { live_link?: string; costume?: { platform?: string } };
      pieces.push({
        id: piece.id, id_kind: 'piece', profile_id: profileId,
        live_link: d.live_link ?? null, platform: (d.costume?.platform ?? 'instagram').toLowerCase(),
      });
    }
    for (const card of data.contentCards ?? []) {
      if (migrated.some(p => p.id === card.id)) continue;
      pieces.push({
        id: card.id, id_kind: 'legacy-card', profile_id: profileId,
        live_link: card.postUrl ?? null, platform: 'instagram',
      });
    }
  }

  const { data: existingLinks } = await supabase.from('post_links').select('piece_id, id_kind, platform_post_id');
  const existing: Record<string, string> = {};
  for (const l of existingLinks ?? []) existing[`${l.id_kind}:${l.piece_id}`] = l.platform_post_id;

  const result = resolvePostLinks({
    posts: (posts ?? []).map(p => ({
      platform_post_id: p.platform_post_id, platform: p.platform,
      post_ref: p.post_ref, channel_id: p.channel_id, published_at: p.published_at,
    })),
    pieces, existing,
  });

  if (result.attach.length) {
    const { error: upErr } = await supabase.from('post_links').upsert(result.attach);
    if (upErr) errors.push(`link join: upsert: ${upErr.message}`);
    if (DUAL_WRITE_IG) {
      await supabase.from('ig_post_links').upsert(result.attach
        .filter(f => f.id_kind === 'legacy-card')
        .map(f => ({ card_id: f.piece_id, client_id: f.profile_id, ig_media_id: f.platform_post_id, matched_at: f.matched_at })));
    }
  }
  // A conflict is hers to settle: two pieces claiming one post attach to neither.
  for (const c of result.conflicts) errors.push(`link conflict on ${c.platform_post_id}: ${c.question}`);

  return {
    attached: result.attach.length, conflicts: result.conflicts.length,
    unmatched: result.unmatched.length, unplanned: result.unplanned.length,
  };
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  const qs = req.nextUrl.searchParams.get('secret');
  const secretOk = !!secret && (auth === `Bearer ${secret}` || qs === secret);
  // The owner's session is as trusted as the cron secret; this is what lets the
  // "Update now" button work with zero setup (today's behavior, kept).
  const ownerOk = authConfigured() && verifyToken(cookies().get(SESSION_COOKIE)?.value) === 'owner';
  if (!secretOk && !ownerOk) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const requested = req.nextUrl.searchParams.get('trigger');
  const trigger: SyncRun['trigger'] =
    requested === 'backfill' ? 'backfill'
    : requested === 'retry' ? 'retry'
    : ownerOk && !secretOk ? 'owner' : 'cron';

  const startedAt = Date.now();
  const supabase = getSupabase();
  const errors: string[] = [];

  const { data: stateRow } = await supabase.from('app_state').select('data').eq('id', 'manmeet').single();
  const state = (stateRow?.data ?? null) as AppState | null;
  if (!state) errors.push('app state read failed — channels fall back to their defaults');

  const connections = await loadConnections(supabase, errors);
  if (!connections.length) {
    return NextResponse.json({ error: 'no connected channel and no IG_ACCESS_TOKEN set', errors }, { status: 500 });
  }

  const runs: RunResult[] = [];
  for (const conn of connections) {
    try {
      runs.push(await syncChannel(supabase, conn, channelFacts(state, conn), trigger, startedAt, errors));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${conn.account_handle ?? conn.channel_id}: ${msg}`);
      runs.push({
        channel: conn.account_handle ?? conn.channel_id, platform: conn.platform,
        status: 'error', posts_seen: 0, posts_observed: 0, completed: false,
      });
    }
  }

  const links = await joinPostLinks(supabase, state, errors);

  return NextResponse.json({
    at: new Date().toISOString(), trigger, channels: runs, links, errors,
    note: 'Observations are append-only: a second run today adds rows and overwrites nothing. ' +
      'A backfill records current totals at today\'s age and closes no gap.',
  });
}
