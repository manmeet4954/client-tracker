import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { authConfigured, verifyToken, SESSION_COOKIE } from '@/lib/auth';
import { readState } from '@/lib/supabaseServer';
import { normalizeState, type Role } from '@/lib/access';
import { assertRegistriesValid } from '@/lib/tree/validate';
import { migrateTracking, trackingReportToText } from '@/lib/tree/migrateTracking';
import type { LegacyTracking, TrackingMigrationRows } from '@/lib/tree/migrateTracking';

// Next caches fetch() by URL and supabase-js rides on fetch; long-lived query
// URLs get served from the data cache at random. That one behavior ate previews
// for eight days (see lib/supabaseServer.ts). Every server client pins no-store.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });


/**
 * Migrate the existing `ig_*` history into the tracking store — spec 26 §14,
 * steps 1 to 7. It follows spec 21's `/api/migrate-profile` pattern exactly:
 *
 *   POST { }                → the report, NOTHING written
 *   POST { apply: true }    → the same report, and the rows are inserted
 *
 * Owner only. A dry run by default, because the default answer she should get is
 * a report she can read. Running it twice writes nothing the second time: every
 * copy is keyed, and rows already present are skipped and counted.
 *
 * Step 0 — fixing the collection stall — is NOT this route's job and does not
 * wait for it (§14.0). Step 1, the backup, is hers: export every `ig_*` table
 * before the first `apply: true`. Nothing here drops or edits a legacy table.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function currentRole(): Role | null {
  if (!authConfigured()) return 'owner';
  return verifyToken(cookies().get(SESSION_COOKIE)?.value);
}

function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase env vars missing');
  return createClient(url, key, { global: { fetch: noStoreFetch } });
}

async function rowsOf<T>(supabase: SupabaseClient, table: string, columns = '*'): Promise<T[]> {
  const { data, error } = await supabase.from(table).select(columns);
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []) as T[];
}

export async function POST(req: Request) {
  if (currentRole() !== 'owner') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const input = await req.json().catch(() => null);
  const apply = input?.apply === true;

  // Declarations before data, exactly as spec 21's migration orders it: if the
  // registry does not validate, nothing migrates.
  try {
    assertRegistriesValid();
  } catch (e) {
    return NextResponse.json(
      { error: 'declarations-invalid', detail: e instanceof Error ? e.message : '' }, { status: 500 });
  }

  const supabase = getSupabase();

  let legacy: LegacyTracking;
  try {
    const [ig_accounts, ig_posts, ig_daily_snapshots, ig_account_snapshots, ig_post_links, ig_post_tags] =
      await Promise.all([
        rowsOf<LegacyTracking['ig_accounts'][number]>(supabase, 'ig_accounts'),
        rowsOf<LegacyTracking['ig_posts'][number]>(supabase, 'ig_posts'),
        rowsOf<LegacyTracking['ig_daily_snapshots'][number]>(supabase, 'ig_daily_snapshots'),
        rowsOf<LegacyTracking['ig_account_snapshots'][number]>(supabase, 'ig_account_snapshots'),
        rowsOf<LegacyTracking['ig_post_links'][number]>(supabase, 'ig_post_links'),
        rowsOf<LegacyTracking['ig_post_tags'][number]>(supabase, 'ig_post_tags'),
      ]);
    legacy = { ig_accounts, ig_posts, ig_daily_snapshots, ig_account_snapshots, ig_post_links, ig_post_tags };
  } catch (e) {
    return NextResponse.json(
      { error: 'legacy-read-failed', detail: e instanceof Error ? e.message : '' }, { status: 500 });
  }

  // What the new tables already hold, so a second run is a no-op rather than a
  // second copy of everything.
  const existing = {
    channel_ids: [] as string[], platform_post_ids: [] as string[],
    observation_keys: [] as string[], account_observation_keys: [] as string[],
    link_keys: [] as string[], reading_ids: [] as string[],
  };
  try {
    const [conns, posts, obs, accObs, links, readings] = await Promise.all([
      rowsOf<{ channel_id: string }>(supabase, 'channel_connections', 'channel_id'),
      rowsOf<{ platform_post_id: string }>(supabase, 'platform_posts', 'platform_post_id'),
      rowsOf<{ platform_post_id: string; fetched_at: string; window: string }>(supabase, 'post_observations', 'platform_post_id,fetched_at,window'),
      rowsOf<{ channel_id: string; fetched_at: string }>(supabase, 'account_observations', 'channel_id,fetched_at'),
      rowsOf<{ piece_id: string; id_kind: string }>(supabase, 'post_links', 'piece_id,id_kind'),
      rowsOf<{ platform_post_id: string }>(supabase, 'post_readings', 'platform_post_id'),
    ]);
    existing.channel_ids = conns.map(c => c.channel_id);
    existing.platform_post_ids = posts.map(p => p.platform_post_id);
    existing.observation_keys = obs.map(o => `${o.platform_post_id}|${o.fetched_at}|${o.window}`);
    existing.account_observation_keys = accObs.map(o => `${o.channel_id}|${o.fetched_at}`);
    existing.link_keys = links.map(l => `${l.id_kind}:${l.piece_id}`);
    existing.reading_ids = readings.map(r => r.platform_post_id);
  } catch (e) {
    return NextResponse.json({
      error: 'new-tables-missing',
      detail: `${e instanceof Error ? e.message : ''} — run supabase/spec-26-tracking-store.sql first (§14.2).`,
    }, { status: 409 });
  }

  // Which profiles carry the piece identity, and which piece ids they hold. A
  // link converts to `piece` only where the id is actually there (§8).
  const migratedPieceIds: Record<string, string[]> = {};
  const bodyChannelIds: string[] = [];
  const raw = await readState();
  if (raw) {
    const state = normalizeState(raw);
    for (const [profileId, data] of Object.entries(state.clientData ?? {})) {
      const pieces = data.body?.paths?.['work-log/creation'] ?? [];
      if (pieces.length) migratedPieceIds[profileId] = pieces.map(p => p.id);
      for (const ch of data.body?.paths?.['work-log/creation/channels'] ?? []) bodyChannelIds.push(ch.id);
    }
  }

  const { rows, report } = migrateTracking(legacy, existing, { migratedPieceIds, bodyChannelIds });

  if (!apply) {
    return NextResponse.json({
      applied: false, report, text: trackingReportToText(report),
      wouldInsert: countRows(rows),
    });
  }

  const written: Record<string, number> = {};
  const failures: string[] = [];
  // Order matters: connections, then posts, then everything that references them.
  const order: [keyof TrackingMigrationRows, string][] = [
    ['channel_connections', 'channel_connections'],
    ['platform_posts', 'platform_posts'],
    ['post_observations', 'post_observations'],
    ['account_observations', 'account_observations'],
    ['post_links', 'post_links'],
    ['post_readings', 'post_readings'],
  ];
  for (const [key, table] of order) {
    const list = rows[key] as unknown[];
    if (!list.length) { written[table] = 0; continue; }
    // In chunks, so one large history does not hit a payload limit mid-copy.
    let count = 0;
    for (let i = 0; i < list.length; i += 500) {
      const chunk = list.slice(i, i + 500);
      const { error } = await supabase.from(table).insert(chunk);
      if (error) { failures.push(`${table}: ${error.message}`); break; }
      count += chunk.length;
    }
    written[table] = count;
  }

  return NextResponse.json({
    applied: true, report, text: trackingReportToText(report), written, failures,
    note: 'The ig_* tables are untouched and stay readable — this is a copy, not a move (§13). ' +
      'sync_runs is deliberately empty: no run history was invented.',
  });
}

function countRows(rows: TrackingMigrationRows): Record<string, number> {
  return {
    channel_connections: rows.channel_connections.length,
    platform_posts: rows.platform_posts.length,
    post_observations: rows.post_observations.length,
    account_observations: rows.account_observations.length,
    post_links: rows.post_links.length,
    post_readings: rows.post_readings.length,
    sync_runs: rows.sync_runs.length,
  };
}
