import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Daily Instagram metrics snapshot. Triggered by Vercel cron (see vercel.json)
// or manually with ?secret=CRON_SECRET. Read-only against Instagram; writes
// posts + per-day metric snapshots to Supabase so history curves exist at all
// (the API only ever reports lifetime totals as of today).

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const GRAPH = 'https://graph.instagram.com/v23.0';
// Pivot window: only track posts from May 2026 onward (Manmeet's call, 2026-07-11).
// Older posts can be backfilled later; their lifetime totals never expire.
const TRACK_SINCE = '2026-05-01';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

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

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  const qs = req.nextUrl.searchParams.get('secret');
  if (!secret || (auth !== `Bearer ${secret}` && qs !== secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const errors: string[] = [];

  // 1. Load the connected account, seeding from the env token on first run.
  let { data: account } = await supabase.from('ig_accounts').select('*').limit(1).maybeSingle();
  if (!account) {
    const seed = process.env.IG_ACCESS_TOKEN;
    if (!seed) return NextResponse.json({ error: 'no account and no IG_ACCESS_TOKEN set' }, { status: 500 });
    const me = await ig('/me', seed, { fields: 'user_id,username' });
    account = {
      id: String(me.user_id ?? me.id), username: me.username, access_token: seed,
      token_refreshed_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('ig_accounts').upsert(account);
    if (error) return NextResponse.json({ error: `seed account: ${error.message}` }, { status: 500 });
  }
  let token: string = account.access_token;

  // 2. Refresh the token weekly so the 60-day expiry never bites.
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
        errors.push(`token refresh: ${r.error?.message ?? 'no token returned'}`);
      }
    } catch (e: any) { errors.push(`token refresh: ${e.message}`); }
  }

  const date = todayIST();

  // 3. Account-level snapshot (follower growth line).
  try {
    const me = await ig('/me', token, { fields: 'followers_count,media_count' });
    await supabase.from('ig_account_snapshots').upsert({
      account_id: account.id, snapshot_date: date,
      followers: me.followers_count, media_count: me.media_count,
    });
  } catch (e: any) { errors.push(`account snapshot: ${e.message}`); }

  // 4. Page through media until we pass the tracking window.
  const posts: IgMedia[] = [];
  let next: string | null =
    `${GRAPH}/me/media?fields=id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count&limit=50&access_token=${token}`;
  while (next) {
    const page: any = await fetch(next, { cache: 'no-store' }).then(x => x.json());
    if (page.error) { errors.push(`media page: ${page.error.message}`); break; }
    let passedWindow = false;
    for (const m of (page.data ?? []) as IgMedia[]) {
      if (m.timestamp >= TRACK_SINCE) posts.push(m);
      else passedWindow = true;
    }
    next = passedWindow ? null : page.paging?.next ?? null;
  }

  // 5. Upsert posts.
  if (posts.length) {
    const { error } = await supabase.from('ig_posts').upsert(posts.map(p => ({
      id: p.id, account_id: account.id, caption: p.caption ?? null,
      media_type: p.media_type, media_product_type: p.media_product_type ?? null,
      permalink: p.permalink, posted_at: p.timestamp,
    })));
    if (error) errors.push(`upsert posts: ${error.message}`);
  }

  // 6. Today's snapshot per post, in small batches to stay under the time limit.
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
    if (error) errors.push(`snapshots batch ${i / 5}: ${error.message}`);
    else snapshots += rows.length;
  }

  return NextResponse.json({
    account: account.username, date, posts: posts.length, snapshots, errors,
  });
}
