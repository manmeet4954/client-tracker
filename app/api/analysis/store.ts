// The Supabase-backed reader for spec 26's tables. SERVER ONLY.
//
// This is the only place `AnalysisStore` is implemented against a database, and
// it implements the READ face and nothing else: there is no insert here, no
// update, no upsert. Spec 27 §4.1's sentence — "read-only by construction" — is
// what this file exists to be true of.
//
// It lives beside the routes rather than inside `lib/analysis/` so the reading
// layer itself stays importable under plain Node in the acceptance tests, with
// no database driver anywhere near it.

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { MetricObservation, PlatformPost, PostLink, SyncRun } from '@/lib/tree/objects';
import type {

  AnalysisStore, ChannelConnection, PostReading, StoreQuery,
} from '@/lib/analysis/read';

// Next caches fetch() by URL and supabase-js rides on fetch; long-lived query
// URLs get served from the data cache at random. That one behavior ate previews
// for eight days (see lib/supabaseServer.ts). Every server client pins no-store.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });

function client(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase env vars missing');
  return createClient(url, key, { global: { fetch: noStoreFetch } });
}

/** A query with no channels reads nothing, rather than reading everything. */
function empty<T>(q: StoreQuery): T[] | null {
  return q.channel_ids.length ? null : ([] as T[]);
}

export function supabaseAnalysisStore(): AnalysisStore {
  const db = client();
  return {
    async channelConnections(profileId: string): Promise<ChannelConnection[]> {
      const { data } = await db
        .from('channel_connections')
        .select('channel_id, profile_id, platform, account_handle, connection_status, last_successful_sync, revoked_at')
        .eq('profile_id', profileId);
      return (data ?? []) as ChannelConnection[];
    },

    async platformPosts(q: StoreQuery): Promise<PlatformPost[]> {
      const short = empty<PlatformPost>(q);
      if (short) return short;
      let query = db.from('platform_posts').select('*').in('channel_id', q.channel_ids);
      if (q.from) query = query.gte('published_at', `${q.from}T00:00:00Z`);
      if (q.to) query = query.lte('published_at', `${q.to}T23:59:59Z`);
      const { data } = await query;
      return (data ?? []) as PlatformPost[];
    },

    async postObservations(q: StoreQuery): Promise<MetricObservation[]> {
      const short = empty<MetricObservation>(q);
      if (short) return short;
      let query = db.from('post_observations').select('*').in('channel_id', q.channel_ids);
      if (q.from) query = query.gte('local_date', q.from);
      if (q.to) query = query.lte('local_date', q.to);
      const { data } = await query;
      return (data ?? []) as MetricObservation[];
    },

    async accountObservations(q: StoreQuery): Promise<MetricObservation[]> {
      const short = empty<MetricObservation>(q);
      if (short) return short;
      let query = db.from('account_observations').select('*').in('channel_id', q.channel_ids);
      if (q.from) query = query.gte('local_date', q.from);
      if (q.to) query = query.lte('local_date', q.to);
      const { data } = await query;
      return (data ?? []) as MetricObservation[];
    },

    async syncRuns(q: StoreQuery): Promise<SyncRun[]> {
      const short = empty<SyncRun>(q);
      if (short) return short;
      const { data } = await db
        .from('sync_runs').select('*').in('channel_id', q.channel_ids)
        .order('started_at', { ascending: false }).limit(500);
      return (data ?? []) as SyncRun[];
    },

    async postLinks(q: StoreQuery): Promise<PostLink[]> {
      const { data } = await db.from('post_links').select('*').eq('profile_id', q.profile_id);
      return (data ?? []) as PostLink[];
    },

    async postReadings(q: StoreQuery): Promise<PostReading[]> {
      const short = empty<PostReading>(q);
      if (short) return short;
      const { data: posts } = await db
        .from('platform_posts').select('platform_post_id').in('channel_id', q.channel_ids);
      const ids = (posts ?? []).map(p => (p as { platform_post_id: string }).platform_post_id);
      if (!ids.length) return [];
      const { data } = await db.from('post_readings').select('*').in('platform_post_id', ids);
      return (data ?? []) as PostReading[];
    },
  };
}
