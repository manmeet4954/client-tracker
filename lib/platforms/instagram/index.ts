// The Instagram connector — spec 26 §6.1.
//
// THIS IS THE EXISTING `app/api/ig-sync/route.ts` LOGIC MOVED, NOT REWRITTEN.
// Every part of it was already working in production: the weekly token refresh
// against the 60-day expiry, the account snapshot with its best-effort
// profile_views / website_clicks call, media paging until the tracking window is
// passed, and the three-set insights fallback. The only changes are the shape of
// the return values (the connector contract) and metric ids coming from the
// catalogue instead of being spelled out at the call site.
//
// `extractPostRef` is `lib/igShortcode.ts`, UNCHANGED — one function, both sides
// of the join, exactly as its own header comment already says.

import type { FetchedPost, PlatformConnector, RefreshedToken } from '../index.ts';
import { extractIgShortcode } from '../../igShortcode.ts';
import { IG_INSIGHT_SETS, IG_METRICS } from './metrics.ts';

const GRAPH = 'https://graph.instagram.com/v23.0';

interface IgMedia {
  id: string;
  caption?: string;
  media_type: string;
  media_product_type?: string;
  timestamp: string;
  permalink: string;
  like_count?: number;
  comments_count?: number;
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

/** The counts the listing already carries, kept as the floor under insights. */
function rawCounts(m: IgMedia): Record<string, number> {
  const out: Record<string, number> = {};
  if (typeof m.like_count === 'number') out.likes = m.like_count;
  if (typeof m.comments_count === 'number') out.comments = m.comments_count;
  return out;
}

function toFetchedPost(m: IgMedia): FetchedPost {
  return {
    platform_post_id: m.id,
    published_at: m.timestamp,
    permalink: m.permalink ?? null,
    post_ref: extractIgShortcode(m.permalink),
    media_kind: m.media_type ?? null,
    // The platform's own word for the container. A HINT: where a fetched post
    // has no piece, the hint is all there is, and anything computed from it is
    // labeled unplanned (§5.2).
    format_hint: m.media_product_type ?? m.media_type ?? null,
    caption: m.caption ?? null,
    raw_metrics: rawCounts(m),
  };
}

export const instagram: PlatformConnector = {
  id: 'instagram',
  display_name: 'Instagram',
  metrics: IG_METRICS,
  extractPostRef: extractIgShortcode,

  /** Weekly refresh so the 60-day expiry never bites. */
  async refreshToken(token: string): Promise<RefreshedToken> {
    const r = await fetch(
      `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`,
      { cache: 'no-store' },
    ).then(x => x.json());
    if (!r.access_token) throw new Error(r.error?.message ?? 'no token returned');
    return { token: r.access_token, refreshed_at: new Date().toISOString() };
  },

  /** Page through media until we pass the tracking window (today's behavior). */
  async listPosts(token: string, since: string): Promise<FetchedPost[]> {
    const posts: FetchedPost[] = [];
    let next: string | null =
      `${GRAPH}/me/media?fields=id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count&limit=50&access_token=${token}`;
    while (next) {
      const page: {
        data?: IgMedia[]; paging?: { next?: string }; error?: { message: string };
      } = await fetch(next, { cache: 'no-store' }).then(x => x.json());
      if (page.error) throw new Error(`media page: ${page.error.message}`);
      let passedWindow = false;
      for (const m of page.data ?? []) {
        if (m.timestamp >= since) posts.push(toFetchedPost(m));
        else passedWindow = true;
      }
      next = passedWindow ? null : page.paging?.next ?? null;
    }
    return posts;
  },

  /** The three-set fallback, kept: metric availability differs by media type. */
  async postMetrics(token: string, post: FetchedPost): Promise<Record<string, number>> {
    const raw = post.raw_metrics ?? {};
    for (const metric of IG_INSIGHT_SETS) {
      try {
        const data = await ig(`/${post.platform_post_id}/insights`, token, { metric });
        const out: Record<string, number> = { ...raw };
        for (const item of data.data ?? []) {
          out[item.name] = item.values?.[0]?.value ?? item.total_value?.value ?? 0;
        }
        return out;
      } catch { /* try the next, smaller set */ }
    }
    return raw;
  },

  /**
   * The account snapshot. The insights half is BEST EFFORT, exactly as today: if
   * the account cannot report profile visits and website taps, the follower
   * numbers still land rather than the whole call failing.
   */
  async accountMetrics(token: string): Promise<Record<string, number>> {
    const me = await ig('/me', token, { fields: 'followers_count,media_count' });
    const out: Record<string, number> = {};
    if (typeof me.followers_count === 'number') out.followers = me.followers_count;
    if (typeof me.media_count === 'number') out.media_count = me.media_count;
    try {
      const ins = await ig('/me/insights', token, {
        metric: 'profile_views,website_clicks', period: 'day', metric_type: 'total_value',
      });
      for (const item of ins.data ?? []) {
        const v = item.total_value?.value ?? item.values?.[0]?.value ?? null;
        if (typeof v === 'number') out[item.name] = v;
      }
    } catch { /* metric not available for this account — it stays absent, not zero */ }
    return out;
  },
};

/** The account identity, used when seeding a connection from the env token. */
export async function igIdentity(token: string): Promise<{ id: string; username: string }> {
  const me = await ig('/me', token, { fields: 'user_id,username' });
  return { id: String(me.user_id ?? me.id), username: me.username };
}
