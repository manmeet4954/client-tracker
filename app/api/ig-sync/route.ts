import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { authConfigured, verifyToken, SESSION_COOKIE } from '@/lib/auth';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppState } from '@/types';
import { extractIgShortcode } from '@/lib/igShortcode';

// Daily Instagram metrics snapshot. Triggered by Vercel cron (see vercel.json),
// manually with ?secret=CRON_SECRET, or by a logged-in OWNER (the "Update now"
// button on the Momentum card). Read-only against Instagram; writes posts +
// per-day metric snapshots to Supabase so history curves exist at all
// (the API only ever reports lifetime totals as of today).
//
// Spec 03: runs for EVERY row in ig_accounts (per-account tokens, stored
// server-side only), then matches content card links to fetched posts.
// Backward compatible: with an empty table and IG_ACCESS_TOKEN set, the env
// token seeds the first account exactly as before.

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const GRAPH = 'https://graph.instagram.com/v23.0';
// Pivot window: only track posts from May 2026 onward (Manmeet's call, 2026-07-11).
// Older posts can be backfilled later; their lifetime totals never expire.
const TRACK_SINCE = '2026-05-01';

// Lazy so a missing env var can never crash the build, only this route at runtime.
// Service role key is required for real use: the ig_* tables keep RLS on with no
// policies (tokens live there), so the anon key cannot read or write them.
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase env vars missing');
  return createClient(url, key);
}

type IgAccount = {
  id: string; username: string; access_token: string;
  token_refreshed_at: string; client_id?: string | null;
};

type IgMedia = {
  id: string; caption?: string; media_type: string; media_product_type?: string;
  timestamp: string; permalink: string; like_count?: number; comments_count?: number;
};

function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

async function ig(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(GRAPH + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('access_token', token);
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json();
  if (data.error) throw new Error(`${path}: ${data.error.message}`);
  return data;
}

// Metric availability differs by media type; fall back to smaller sets.
async function insightsFor(media: IgMedia, token: string): Promise<Record<string, number>> {
  const sets = [
    'views,reach,likes,comments,saved,shares,total_interactions',
    'reach,saved,shares',
    'reach',
  ];
  for (const metric of sets) {
    try {
      const data = await ig(`/${media.id}/insights`, token, { metric });
      const out: Record<string, number> = {};
      for (const item of data.data) {
        out[item.name] = item.values?.[0]?.value ?? item.total_value?.value ?? 0;
      }
      return out;
    } catch { /* try next set */ }
  }
  return {};
}

// One account's full sync: token refresh, follower snapshot, posts, per-post
// metrics. Errors are prefixed with the username so a multi-account run stays
// readable; a failure here never stops the other accounts.
async function syncAccount(
  supabase: SupabaseClient, account: IgAccount, date: string, errors: string[],
): Promise<{ account: string; posts: number; snapshots: number }> {
  const tag = account.username;
  let token: string = account.access_token;

  // 1. Refresh the token weekly so the 60-day expiry never bites.
  const ageDays = (Date.now() - new Date(account.token_refreshed_at).getTime()) / 86400000;
  if (ageDays > 7) {
    try {
      const r = await fetch(
        `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`,
        { cache: 'no-store' },
      ).then(x => x.json());
      if (r.access_token) {
        token = r.access_token;
        await supabase.from('ig_accounts').update({
          access_token: token, token_refreshed_at: new Date().toISOString(),
        }).eq('id', account.id);
      } else {
        errors.push(`${tag} token refresh: ${r.error?.message ?? 'no token returned'}`);
      }
    } catch (e: any) { errors.push(`${tag} token refresh: ${e.message}`); }
  }

  // 2. Account-level snapshot (follower growth line, plus the day's profile
  //    visits and website taps for the funnel — Spec 05). The insights call is
  //    best-effort: if the account can't report these metrics they stay null
  //    and the follower snapshot still writes.
  try {
    const me = await ig('/me', token, { fields: 'followers_count,media_count' });
    let profileViews: number | null = null;
    let websiteClicks: number | null = null;
    try {
      const ins = await ig('/me/insights', token, {
        metric: 'profile_views,website_clicks', period: 'day', metric_type: 'total_value',
      });
      for (const item of ins.data ?? []) {
        const v = item.total_value?.value ?? item.values?.[0]?.value ?? null;
        if (item.name === 'profile_views') profileViews = v;
        if (item.name === 'website_clicks') websiteClicks = v;
      }
    } catch { /* metric not available for this account — leave null */ }
    await supabase.from('ig_account_snapshots').upsert({
      account_id: account.id, snapshot_date: date,
      followers: me.followers_count, media_count: me.media_count,
      profile_views: profileViews, website_clicks: websiteClicks,
    });
  } catch (e: any) { errors.push(`${tag} account snapshot: ${e.message}`); }

  // 3. Page through media until we pass the tracking window.
  const posts: IgMedia[] = [];
  let next: string | null =
    `${GRAPH}/me/media?fields=id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count&limit=50&access_token=${token}`;
  while (next) {
    const page: any = await fetch(next, { cache: 'no-store' }).then(x => x.json());
    if (page.error) { errors.push(`${tag} media page: ${page.error.message}`); break; }
    let passedWindow = false;
    for (const m of (page.data ?? []) as IgMedia[]) {
      if (m.timestamp >= TRACK_SINCE) posts.push(m);
      else passedWindow = true;
    }
    next = passedWindow ? null : page.paging?.next ?? null;
  }

  // 4. Upsert posts.
  if (posts.length) {
    const { error } = await supabase.from('ig_posts').upsert(posts.map(p => ({
      id: p.id, account_id: account.id, caption: p.caption ?? null,
      media_type: p.media_type, media_product_type: p.media_product_type ?? null,
      permalink: p.permalink, posted_at: p.timestamp,
    })));
    if (error) errors.push(`${tag} upsert posts: ${error.message}`);
  }

  // 5. Today's snapshot per post, in small batches to stay under the time limit.
  let snapshots = 0;
  for (let i = 0; i < posts.length; i += 5) {
    const batch = posts.slice(i, i + 5);
    const rows = await Promise.all(batch.map(async p => {
      const ins = await insightsFor(p, token);
      return {
        post_id: p.id, snapshot_date: date,
        views: ins.views ?? null, reach: ins.reach ?? null,
        likes: ins.likes ?? p.like_count ?? null,
        comments: ins.comments ?? p.comments_count ?? null,
        saves: ins.saved ?? null, shares: ins.shares ?? null,
        total_interactions: ins.total_interactions ?? null,
      };
    }));
    const { error } = await supabase.from('ig_daily_snapshots').upsert(rows);
    if (error) errors.push(`${tag} snapshots batch ${i / 5}: ${error.message}`);
    else snapshots += rows.length;
  }

  return { account: tag, posts: posts.length, snapshots };
}

// The post join (Spec 03). Every content card that carries a live Instagram
// link gets matched to its fetched post by shortcode, across all clients, and
// the pair lands in ig_post_links. Idempotent: rows already matched to the
// same post are skipped, so re-runs write nothing. The card itself is never
// touched; no analytics data enters the AppState blob.
async function matchPostLinks(
  supabase: SupabaseClient, errors: string[],
): Promise<{ linked: number; fresh: number }> {
  try {
    // The app state blob, read directly with the service role client.
    const { data: stateRow, error: stateErr } = await supabase
      .from('app_state').select('data').eq('id', 'manmeet').single();
    if (stateErr || !stateRow?.data) {
      errors.push(`link match: app state read failed${stateErr ? `: ${stateErr.message}` : ''}`);
      return { linked: 0, fresh: 0 };
    }
    const state = stateRow.data as AppState;

    // Shortcode → media id, from every fetched post across all accounts.
    const { data: igPosts, error: postsErr } = await supabase.from('ig_posts').select('id, permalink');
    if (postsErr) {
      errors.push(`link match: read ig_posts: ${postsErr.message}`);
      return { linked: 0, fresh: 0 };
    }
    const byCode = new Map<string, string>();
    for (const p of igPosts ?? []) {
      const code = extractIgShortcode(p.permalink);
      if (code) byCode.set(code, p.id);
    }

    // Every content card with a postUrl, across all clients.
    const matches: { card_id: string; client_id: string; ig_media_id: string }[] = [];
    for (const [clientId, cdata] of Object.entries(state.clientData ?? {})) {
      for (const card of cdata.contentCards ?? []) {
        const code = extractIgShortcode(card.postUrl);
        if (!code) continue;
        const mediaId = byCode.get(code);
        if (mediaId) matches.push({ card_id: card.id, client_id: clientId, ig_media_id: mediaId });
      }
    }

    // Only write links that are new or point at a different post now.
    const { data: existing, error: linksErr } = await supabase.from('ig_post_links').select('card_id, ig_media_id');
    if (linksErr) {
      errors.push(`link match: read ig_post_links: ${linksErr.message}`);
      return { linked: 0, fresh: 0 };
    }
    const have = new Map((existing ?? []).map(l => [l.card_id, l.ig_media_id]));
    const fresh = matches
      .filter(m => have.get(m.card_id) !== m.ig_media_id)
      .map(m => ({ ...m, matched_at: new Date().toISOString() }));
    if (fresh.length) {
      const { error } = await supabase.from('ig_post_links').upsert(fresh);
      if (error) errors.push(`link match: upsert: ${error.message}`);
    }
    return { linked: matches.length, fresh: fresh.length };
  } catch (e: any) {
    errors.push(`link match: ${e.message}`);
    return { linked: 0, fresh: 0 };
  }
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  const qs = req.nextUrl.searchParams.get('secret');
  const secretOk = !!secret && (auth === `Bearer ${secret}` || qs === secret);
  // The owner's session cookie is just as trusted as the cron secret; this is
  // what lets the dashboard's "Update now" button work with zero setup.
  const ownerOk = authConfigured() && verifyToken(cookies().get(SESSION_COOKIE)?.value) === 'owner';
  if (!secretOk && !ownerOk) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = getSupabase();
  const errors: string[] = [];

  // 1. Load every connected account, seeding from the env token on first run
  //    (the original single-token behavior, kept as-is).
  let { data: accounts } = await supabase.from('ig_accounts').select('*');
  if (!accounts?.length) {
    const seed = process.env.IG_ACCESS_TOKEN;
    if (!seed) return NextResponse.json({ error: 'no account and no IG_ACCESS_TOKEN set' }, { status: 500 });
    const me = await ig('/me', seed, { fields: 'user_id,username' });
    const account: IgAccount = {
      id: String(me.user_id ?? me.id), username: me.username, access_token: seed,
      token_refreshed_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('ig_accounts').upsert(account);
    if (error) return NextResponse.json({ error: `seed account: ${error.message}` }, { status: 500 });
    accounts = [account];
  }

  const date = todayIST();

  // 2. Sync every account; one bad token never blocks the rest.
  const results: { account: string; posts: number; snapshots: number }[] = [];
  for (const account of accounts as IgAccount[]) {
    try {
      results.push(await syncAccount(supabase, account, date, errors));
    } catch (e: any) {
      errors.push(`${account.username}: ${e.message}`);
      results.push({ account: account.username, posts: 0, snapshots: 0 });
    }
  }

  // 3. Match content card links to fetched posts (the post join).
  const links = await matchPostLinks(supabase, errors);

  return NextResponse.json({ date, accounts: results, links, errors });
}
