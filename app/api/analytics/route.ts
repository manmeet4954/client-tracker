import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { authConfigured, verifyToken, SESSION_COOKIE } from '@/lib/auth';
import { clientAllowedForRole, type Role } from '@/lib/access';
import { contentMonth } from '@/lib/utils';
import type { AppState, ClientData, ClientGoal, ContentCard, ContentPillar } from '@/types';
import type {
  AnalyticsPayload, ComparisonData, ExpressionNumbers, ExpressionStat,
  FunnelData, FunnelMonth, MetricReading, PatternInsight, PatternsData,
  PillarScore, PillarVerdict, PostTags,
} from '@/types/analytics';

// Spec 05: every number on the Analytics tab is computed HERE, in code, from
// the ig_* tables (the pipe) and the one AppState blob (the record). The
// browser receives finished JSON only: no tokens, no other client's data.
//
// Honesty rules baked in:
// - verdicts use MEDIANS (typical post), never averages
// - window = last 70 days (about 10 weeks)
// - minimum 5 linked posts per pillar, else "too early to judge"
// - experiment-flagged cards never enter pillar verdict math
// - only posted cards linked to a fetched post count; ideas never do
// - baseline = this account's own posts, format-matched when possible;
//   never another account's numbers

export const dynamic = 'force-dynamic';

const WINDOW_DAYS = 70;
const MIN_POSTS = 5;
const EARNING_AT = 1.15; // typical post 15%+ above the comparison point
const DRAGGING_AT = 0.85;

function currentRole(): Role | null {
  if (!authConfigured()) return 'owner'; // open mode
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifyToken(token);
}

// Lazy so a missing env var can never crash the build, only this route at
// runtime (same pattern as ig-sync). Service role key required: ig_* tables
// keep RLS on with no policies.
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase env vars missing');
  return createClient(url, key);
}

// ── small math helpers ───────────────────────────────────────────────────────

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function mean(xs: number[]): number | null {
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function clampRatio(r: number): number {
  return Math.min(3, Math.max(0, r));
}

// ── row shapes from the pipe ─────────────────────────────────────────────────

type IgPostRow = {
  id: string; media_type: string | null; media_product_type: string | null;
  permalink: string | null; posted_at: string | null;
};

type SnapRow = {
  post_id: string; snapshot_date: string;
  views: number | null; reach: number | null; likes: number | null;
  comments: number | null; saves: number | null; shares: number | null;
};

type AccountSnapRow = {
  account_id: string; snapshot_date: string; followers: number | null;
  profile_views?: number | null; website_clicks?: number | null;
};

// Spec 06: one row from the reading layer (ig_post_tags).
type TagRow = {
  ig_media_id: string;
  topic_type: string | null; hook_type: string | null; close_type: string | null;
  cta_type: string | null; caption_style: string | null;
  has_face: boolean | null; trending_audio: boolean | null;
  summary: string | null; corrected: unknown;
};

function toPostTags(row: TagRow): PostTags {
  return {
    topicType: row.topic_type,
    hookType: row.hook_type,
    closeType: row.close_type,
    ctaType: row.cta_type,
    captionStyle: row.caption_style,
    hasFace: row.has_face,
    trendingAudio: row.trending_audio,
    summary: row.summary,
    corrected: Array.isArray(row.corrected)
      ? row.corrected.filter((f): f is string => typeof f === 'string')
      : [],
  };
}

// Latest lifetime snapshot per post (the API only reports totals as of today,
// so the newest row IS the post's current numbers). Paged because posts x days
// can pass the 1000-row default.
async function latestSnapshots(
  supabase: SupabaseClient, postIds: string[],
): Promise<Map<string, SnapRow>> {
  const latest = new Map<string, SnapRow>();
  if (!postIds.length) return latest;
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('ig_daily_snapshots')
      .select('post_id, snapshot_date, views, reach, likes, comments, saves, shares')
      .in('post_id', postIds)
      .order('snapshot_date', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`snapshots: ${error.message}`);
    for (const row of (data ?? []) as SnapRow[]) {
      if (!latest.has(row.post_id)) latest.set(row.post_id, row);
    }
    if (!data || data.length < PAGE || latest.size === postIds.length) break;
  }
  return latest;
}

// ── metric machinery ─────────────────────────────────────────────────────────

type MetricKey = 'reach' | 'sharesPerView' | 'savesPerView';

const METRIC_META: Record<MetricKey, { label: string; explainer: string }> = {
  reach:         { label: 'Reach',           explainer: 'How many people saw the post' },
  sharesPerView: { label: 'Shares per view', explainer: 'How often viewers sent it to someone' },
  savesPerView:  { label: 'Saves per view',  explainer: 'How often people kept it to come back to' },
};

function metricValue(key: MetricKey, snap: SnapRow): number | null {
  const denom = snap.views ?? snap.reach;
  switch (key) {
    case 'reach': return snap.reach;
    case 'sharesPerView': return snap.shares != null && denom ? snap.shares / denom : null;
    case 'savesPerView': return snap.saves != null && denom ? snap.saves / denom : null;
  }
}

// Reels, carousels and stills perform on different scales, so each post is
// compared with the account's typical post of ITS OWN format when the account
// has enough of that format, and with all posts otherwise.
function formatBucket(p: IgPostRow): string {
  if (p.media_product_type === 'REELS' || p.media_type === 'VIDEO') return 'reel';
  if (p.media_type === 'CAROUSEL_ALBUM') return 'carousel';
  return 'image';
}

class Baseline {
  private byBucket = new Map<string, Map<MetricKey, number[]>>();
  private all = new Map<MetricKey, number[]>();
  readonly postCount: number;

  constructor(posts: IgPostRow[], snaps: Map<string, SnapRow>) {
    let n = 0;
    for (const p of posts) {
      const snap = snaps.get(p.id);
      if (!snap) continue;
      n++;
      const bucket = formatBucket(p);
      for (const key of Object.keys(METRIC_META) as MetricKey[]) {
        const v = metricValue(key, snap);
        if (v == null) continue;
        if (!this.byBucket.has(bucket)) this.byBucket.set(bucket, new Map());
        const bm = this.byBucket.get(bucket)!;
        bm.set(key, [...(bm.get(key) ?? []), v]);
        this.all.set(key, [...(this.all.get(key) ?? []), v]);
      }
    }
    this.postCount = n;
  }

  /** Median for a metric, format-matched when >= 3 posts of that format exist. */
  medianFor(key: MetricKey, bucket: string): { value: number | null; formatMatched: boolean } {
    const inBucket = this.byBucket.get(bucket)?.get(key) ?? [];
    if (inBucket.length >= 3) return { value: median(inBucket), formatMatched: true };
    return { value: median(this.all.get(key) ?? []), formatMatched: false };
  }
}

// ── the route ────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const role = currentRole();
  if (!role) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const clientId = req.nextUrl.searchParams.get('clientId') ?? '';
  if (!clientId) return NextResponse.json({ error: 'bad-request' }, { status: 400 });

  try {
    const supabase = getSupabase();

    // The AUTHORITATIVE state, read server-side with the service client. The
    // clientId from the URL is only a selector: access is checked against the
    // stored client's name via the same matchers lib/access.ts uses everywhere.
    const { data: stateRow, error: stateErr } = await supabase
      .from('app_state').select('data').eq('id', 'manmeet').single();
    if (stateErr || !stateRow?.data) {
      return NextResponse.json({ error: 'state read failed' }, { status: 500 });
    }
    const state = stateRow.data as AppState;
    const client = (state.clients ?? []).find(c => c.id === clientId);
    if (!client) return NextResponse.json({ error: 'not-found' }, { status: 404 });
    if (!clientAllowedForRole(role, client.name)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const cdata: Partial<ClientData> = state.clientData?.[clientId] ?? {};
    const pillars = cdata.pillars ?? [];
    const cards = cdata.contentCards ?? [];
    const topics = cdata.topics ?? [];
    const goals = cdata.goals ?? [];
    const journey = cdata.journey;

    // The pipe: this client's connected account(s). Tokens are never selected.
    const { data: accounts, error: accErr } = await supabase
      .from('ig_accounts').select('id, username').eq('client_id', clientId);
    if (accErr) return NextResponse.json({ error: accErr.message }, { status: 500 });
    const accountIds = (accounts ?? []).map(a => a.id);
    const connected = accountIds.length > 0;

    let igPosts: IgPostRow[] = [];
    let snaps = new Map<string, SnapRow>();
    let accountSnaps: AccountSnapRow[] = [];
    let links: { card_id: string; ig_media_id: string }[] = [];
    let tagsByMedia = new Map<string, PostTags>();

    if (connected) {
      const { data: postRows, error: postErr } = await supabase
        .from('ig_posts')
        .select('id, media_type, media_product_type, permalink, posted_at')
        .in('account_id', accountIds);
      if (postErr) return NextResponse.json({ error: postErr.message }, { status: 500 });
      igPosts = (postRows ?? []) as IgPostRow[];

      snaps = await latestSnapshots(supabase, igPosts.map(p => p.id));

      const { data: accSnapRows, error: accSnapErr } = await supabase
        .from('ig_account_snapshots')
        .select('*')
        .in('account_id', accountIds)
        .order('snapshot_date', { ascending: false })
        .limit(1000);
      if (accSnapErr) return NextResponse.json({ error: accSnapErr.message }, { status: 500 });
      accountSnaps = ((accSnapRows ?? []) as AccountSnapRow[]).reverse(); // oldest first

      const { data: linkRows, error: linkErr } = await supabase
        .from('ig_post_links')
        .select('card_id, ig_media_id')
        .eq('client_id', clientId);
      if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 });
      links = linkRows ?? [];

      // Spec 06: tags from the reading layer, for this account's posts only.
      if (igPosts.length) {
        const { data: tagRows, error: tagErr } = await supabase
          .from('ig_post_tags')
          .select('ig_media_id, topic_type, hook_type, close_type, cta_type, caption_style, has_face, trending_audio, summary, corrected')
          .in('ig_media_id', igPosts.map(p => p.id));
        if (tagErr) return NextResponse.json({ error: tagErr.message }, { status: 500 });
        tagsByMedia = new Map(((tagRows ?? []) as TagRow[]).map(t => [t.ig_media_id, toPostTags(t)]));
      }
    }

    const igById = new Map(igPosts.map(p => [p.id, p]));
    const linkByCard = new Map(links.map(l => [l.card_id, l.ig_media_id]));
    const baseline = new Baseline(igPosts, snaps);

    const scorecard = buildScorecard(pillars, cards, goals, journey?.checkIns ?? [],
      linkByCard, igById, snaps, baseline, accountSnaps);
    const funnel = buildFunnel(cards, journey, goals, igPosts, snaps, accountSnaps);
    const comparison: ComparisonData | null = role === 'owner'
      ? buildComparison(topics, cards, pillars, linkByCard, igById, snaps, tagsByMedia, baseline, goals)
      : null;

    const payload: AnalyticsPayload = {
      connected,
      accountUsername: accounts?.[0]?.username ?? null,
      windowDays: WINDOW_DAYS,
      minPostsForVerdict: MIN_POSTS,
      baselinePostCount: baseline.postCount,
      scorecard,
      funnel,
      comparison,
      generatedAt: new Date().toISOString(),
    };
    return NextResponse.json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'analytics failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── Layer 1: the scorecard ───────────────────────────────────────────────────

const GOAL_LABEL: Record<ClientGoal, string> = {
  links: 'link taps', conversations: 'DMs', followers: 'followers',
};

function buildScorecard(
  pillars: ContentPillar[],
  cards: ContentCard[],
  goals: ClientGoal[],
  checkIns: { month: string; value: number }[],
  linkByCard: Map<string, string>,
  igById: Map<string, IgPostRow>,
  snaps: Map<string, SnapRow>,
  baseline: Baseline,
  accountSnaps: AccountSnapRow[],
): PillarScore[] {
  const now = Date.now();
  const windowStart = now - WINDOW_DAYS * 86400000;

  // A card enters analysis only if it is posted AND linked to a fetched post
  // that has metrics and went live inside the window (the never-posted rule).
  type LinkedPost = { card: ContentCard; ig: IgPostRow; snap: SnapRow };
  const linkedInWindow: LinkedPost[] = [];
  for (const card of cards) {
    if (card.stage !== 'posted') continue;
    const mediaId = linkByCard.get(card.id);
    if (!mediaId) continue;
    const ig = igById.get(mediaId);
    const snap = snaps.get(mediaId);
    if (!ig || !snap || !ig.posted_at) continue;
    const t = new Date(ig.posted_at).getTime();
    if (t < windowStart || t > now) continue;
    linkedInWindow.push({ card, ig, snap });
  }
  const totalInWindow = linkedInWindow.length;

  return pillars.map<PillarScore>(pillar => {
    const mine = linkedInWindow.filter(lp => lp.card.pillarId === pillar.id);
    const experiments = mine.filter(lp => lp.card.experiment);
    // Verdict math: no experiments, and no posts from before a job change
    // (jobChangedAt), so regimes never mix.
    const judged = mine.filter(lp => !lp.card.experiment
      && (!pillar.jobChangedAt || (lp.ig.posted_at ?? '') >= pillar.jobChangedAt));

    const base: Omit<PillarScore, 'verdict' | 'metrics' | 'howJudged'> = {
      pillarId: pillar.id,
      name: pillar.name,
      color: pillar.color,
      job: pillar.job ?? null,
      purpose: pillar.purpose ?? '',
      postedInWindow: mine.length,
      experimentCount: experiments.length,
      judgedPostCount: judged.length,
      mixActualPct: totalInWindow ? Math.round((mine.length / totalInWindow) * 100) : null,
      mixTargetPct: pillar.targetPct ?? null,
    };

    if (!pillar.job) {
      return { ...base, verdict: 'no-job', metrics: [], howJudged: 'This pillar has no job yet, so there is nothing fair to judge it on.' };
    }

    if (judged.length < MIN_POSTS) {
      const jobMetrics = pillar.job === 'reach' ? 'reach and shares per view'
        : pillar.job === 'trust' ? 'saves per view'
        : 'the goals this account chose';
      return {
        ...base, verdict: 'too-early', metrics: [],
        howJudged: `Too early to judge fairly: only ${judged.length} linked post${judged.length === 1 ? '' : 's'} in the last 10 weeks, and a verdict needs at least ${MIN_POSTS}. Once there are enough, it will be judged on ${jobMetrics} against this account's own baseline.`,
      };
    }

    if (pillar.job === 'convert') {
      return convertScore(base, goals, checkIns, accountSnaps, judged.length);
    }

    // reach / trust: median of per-post ratios against the account's own,
    // format-matched baseline.
    const keys: MetricKey[] = pillar.job === 'reach' ? ['reach', 'sharesPerView'] : ['savesPerView'];
    const metrics: MetricReading[] = [];
    let allFormatMatched = true;
    for (const key of keys) {
      const ratios: number[] = [];
      for (const lp of judged) {
        const v = metricValue(key, lp.snap);
        if (v == null) continue;
        const b = baseline.medianFor(key, formatBucket(lp.ig));
        if (!b.value || b.value <= 0) continue;
        ratios.push(clampRatio(v / b.value));
        if (!b.formatMatched) allFormatMatched = false;
      }
      metrics.push({
        key, ...METRIC_META[key],
        ratio: median(ratios), postCount: ratios.length, vs: 'baseline',
      });
    }

    const available = metrics.map(m => m.ratio).filter((r): r is number => r != null);
    const score = mean(available);
    const verdict: PillarVerdict = score == null ? 'too-early'
      : score >= EARNING_AT ? 'earning'
      : score <= DRAGGING_AT ? 'dragging'
      : 'steady';

    const metricNames = metrics.map(m => m.label.toLowerCase()).join(' and ');
    const baselineWords = allFormatMatched
      ? "this account's own typical post of the same format"
      : "this account's own typical post";
    const trustNote = pillar.job === 'trust'
      ? ' Profile visits count for the whole account, not per post, so they show in the funnel below.'
      : '';
    const howJudged = score == null
      ? `The linked posts have no usable numbers for ${metricNames} yet, so there is no fair verdict.`
      : `Judged on ${metricNames} because this pillar's job is ${pillar.job === 'reach' ? 'Reach' : 'Trust'}. Each post was compared with ${baselineWords}, using the middle (typical) value so one viral post cannot swing it. Based on ${judged.length} posts over the last 10 weeks.${trustNote}`;

    return { ...base, verdict, metrics, howJudged };
  });
}

// Convert pillars are judged on account-level movement in the goals this
// client chose: the last 5 weeks against the 5 weeks before.
function convertScore(
  base: Omit<PillarScore, 'verdict' | 'metrics' | 'howJudged'>,
  goals: ClientGoal[],
  checkIns: { month: string; value: number }[],
  accountSnaps: AccountSnapRow[],
  judgedCount: number,
): PillarScore {
  if (!goals.length) {
    return {
      ...base, verdict: 'no-goals', metrics: [],
      howJudged: 'This pillar\'s job is Convert, but no goals are chosen for this account yet. Pick goals on the Journey tab and it gets judged on them.',
    };
  }

  const now = Date.now();
  const half = 35 * 86400000;
  const inRange = (d: string, from: number, to: number) => {
    const t = new Date(d + 'T00:00:00Z').getTime();
    return t > from && t <= to;
  };
  const sumField = (field: 'profile_views' | 'website_clicks', from: number, to: number): number | null => {
    const rows = accountSnaps.filter(s => s[field] != null && inRange(s.snapshot_date, from, to));
    if (!rows.length) return null;
    return rows.reduce((a, s) => a + (s[field] ?? 0), 0);
  };
  const followersAt = (before: number): number | null => {
    let best: AccountSnapRow | null = null;
    for (const s of accountSnaps) {
      if (new Date(s.snapshot_date + 'T00:00:00Z').getTime() <= before && s.followers != null) best = s;
    }
    return best?.followers ?? null;
  };

  const metrics: MetricReading[] = [];

  if (goals.includes('links')) {
    const recent = sumField('website_clicks', now - half, now);
    const prior = sumField('website_clicks', now - 2 * half, now - half);
    const ratio = recent != null && prior != null && prior > 0 ? clampRatio(recent / prior) : null;
    metrics.push({
      key: 'linkTaps', label: 'Link taps', explainer: 'People who tapped the link in bio',
      ratio, postCount: judgedCount, vs: 'previous',
      note: ratio == null ? 'Not enough weeks of link tap data collected yet' : undefined,
    });
  }
  if (goals.includes('followers')) {
    const nowF = followersAt(now);
    const midF = followersAt(now - half);
    const oldF = followersAt(now - 2 * half);
    let ratio: number | null = null;
    if (nowF != null && midF != null && oldF != null) {
      const d1 = nowF - midF;
      const d0 = midF - oldF;
      ratio = d0 > 0 ? clampRatio(d1 / d0)
        : d1 > 0 ? 1.2
        : d1 < d0 ? 0.8
        : 1;
    }
    metrics.push({
      key: 'followers', label: 'Follower growth', explainer: 'New followers gained',
      ratio, postCount: judgedCount, vs: 'previous',
      note: ratio == null ? 'Not enough weeks of follower data yet' : undefined,
    });
  }
  if (goals.includes('conversations')) {
    const sorted = [...checkIns].sort((a, b) => a.month.localeCompare(b.month));
    const latest = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2];
    const ratio = latest && prev && prev.value > 0 ? clampRatio(latest.value / prev.value) : null;
    metrics.push({
      key: 'northStar', label: 'Goal number (from Journey)',
      explainer: 'The number logged monthly on the Journey tab. Instagram cannot count DMs, so this is the honest source.',
      ratio, postCount: judgedCount, vs: 'previous',
      note: ratio == null ? 'Needs two monthly check-ins on the Journey tab' : undefined,
    });
  }

  const available = metrics.map(m => m.ratio).filter((r): r is number => r != null);
  const score = mean(available);
  const verdict: PillarVerdict = score == null ? 'too-early'
    : score >= EARNING_AT ? 'earning'
    : score <= DRAGGING_AT ? 'dragging'
    : 'steady';

  const goalWords = goals.map(g => GOAL_LABEL[g]).join(', ');
  const howJudged = score == null
    ? `This pillar's job is Convert, judged on ${goalWords}. Those numbers are still being collected, so there is no fair verdict yet.`
    : `Judged on ${goalWords} because this pillar's job is Convert and those are this account's chosen goals. The last 5 weeks were compared with the 5 weeks before, on this account only. These numbers count for the whole account, not one post, so every convert post shares the credit. Based on ${judgedCount} posts over the last 10 weeks.`;

  return { ...base, verdict, metrics, howJudged };
}

// ── Layer 3: the funnel ──────────────────────────────────────────────────────

function monthOf(dateish: string): string {
  return dateish.slice(0, 7);
}

function buildFunnel(
  cards: ContentCard[],
  journey: ClientData['journey'],
  goals: ClientGoal[],
  igPosts: IgPostRow[],
  snaps: Map<string, SnapRow>,
  accountSnaps: AccountSnapRow[],
): FunnelData {
  const posted = cards.filter(c => c.stage === 'posted');
  const checkIns = journey?.checkIns ?? [];

  const monthSet = new Set<string>();
  for (const c of posted) { const m = contentMonth(c); if (m) monthSet.add(m); }
  for (const p of igPosts) if (p.posted_at) monthSet.add(monthOf(p.posted_at));
  for (const s of accountSnaps) monthSet.add(monthOf(s.snapshot_date));
  for (const ci of checkIns) monthSet.add(ci.month);
  const current = new Date().toISOString().slice(0, 7);
  monthSet.add(current);
  const months = Array.from(monthSet).sort().slice(-12);

  const profileVisitsSince = accountSnaps.find(s => s.profile_views != null)?.snapshot_date ?? null;
  const linkTapsSince = accountSnaps.find(s => s.website_clicks != null)?.snapshot_date ?? null;

  const rows = months.map<FunnelMonth>(month => {
    const posts = posted.filter(c => contentMonth(c) === month).length;

    // Reach: what the whole account did that month (every fetched post, linked
    // or not), summed from each post's latest lifetime numbers.
    const monthPosts = igPosts.filter(p => p.posted_at && monthOf(p.posted_at) === month);
    const reachVals = monthPosts.map(p => snaps.get(p.id)?.reach).filter((v): v is number => v != null);
    const reach = reachVals.length ? reachVals.reduce((a, b) => a + b, 0) : null;

    const daily = accountSnaps.filter(s => monthOf(s.snapshot_date) === month);
    const pv = daily.filter(s => s.profile_views != null);
    const wc = daily.filter(s => s.website_clicks != null);
    const profileVisits = pv.length ? pv.reduce((a, s) => a + (s.profile_views ?? 0), 0) : null;
    const linkTaps = wc.length ? wc.reduce((a, s) => a + (s.website_clicks ?? 0), 0) : null;

    // Follower change: last snapshot of this month minus last of the previous.
    const monthSnaps = daily.filter(s => s.followers != null);
    const prevSnaps = accountSnaps.filter(s => s.followers != null && monthOf(s.snapshot_date) < month);
    const endF = monthSnaps.length ? monthSnaps[monthSnaps.length - 1].followers : null;
    const startF = prevSnaps.length ? prevSnaps[prevSnaps.length - 1].followers : null;
    const followerChange = endF != null && startF != null ? endF - startF : null;

    const northStar = checkIns.find(ci => ci.month === month)?.value ?? null;

    return { month, posts, reach, profileVisits, linkTaps, followerChange, northStar };
  });

  return {
    months: rows,
    northStarLabel: journey?.northStar ?? '',
    profileVisitsSince,
    linkTapsSince,
    goals,
  };
}

// ── Layer 2: the comparison (owner window) ───────────────────────────────────

function numbersFor(snap: SnapRow | undefined): ExpressionNumbers | null {
  if (!snap) return null;
  const denom = snap.views ?? snap.reach;
  return {
    views: snap.views, reach: snap.reach, likes: snap.likes,
    comments: snap.comments, saves: snap.saves, shares: snap.shares,
    savesPerView: snap.saves != null && denom ? snap.saves / denom : null,
    sharesPerView: snap.shares != null && denom ? snap.shares / denom : null,
  };
}

function buildComparison(
  topics: { id: string; name: string }[],
  cards: ContentCard[],
  pillars: ContentPillar[],
  linkByCard: Map<string, string>,
  igById: Map<string, IgPostRow>,
  snaps: Map<string, SnapRow>,
  tagsByMedia: Map<string, PostTags>,
  baseline: Baseline,
  goals: ClientGoal[],
): ComparisonData {
  const pillarById = new Map(pillars.map(p => [p.id, p]));

  const expressionFor = (card: ContentCard): ExpressionStat => {
    const mediaId = linkByCard.get(card.id);
    const ig = mediaId ? igById.get(mediaId) : undefined;
    const pillar = pillarById.get(card.pillarId);
    return {
      cardId: card.id,
      title: card.title || 'Untitled',
      format: card.contentType || '',
      pillarName: pillar?.name ?? 'No pillar',
      pillarColor: pillar?.color ?? '#d6d3d1',
      stage: card.stage,
      postedAt: ig?.posted_at ?? null,
      numbers: mediaId ? numbersFor(snaps.get(mediaId)) : null,
      igMediaId: mediaId ?? null,
      tags: mediaId ? tagsByMedia.get(mediaId) ?? null : null,
    };
  };

  const topicGroups = topics
    .map(t => ({
      topicId: t.id,
      name: t.name,
      expressions: cards.filter(c => c.topicId === t.id).map(expressionFor),
    }))
    .filter(g => g.expressions.length > 0);

  const experiments = cards
    .filter(c => c.experiment)
    .map(c => ({
      cardId: c.id,
      title: c.title || 'Untitled',
      hypothesis: c.experiment?.hypothesis ?? '',
      stage: c.stage,
      pillarName: pillarById.get(c.pillarId)?.name ?? 'No pillar',
      numbers: linkByCard.has(c.id) ? numbersFor(snaps.get(linkByCard.get(c.id)!)) : null,
    }));

  const patterns = buildPatterns(cards, pillars, linkByCard, igById, snaps, tagsByMedia, baseline, goals);

  return { topics: topicGroups, experiments, patterns };
}

// ── Spec 06: patterns from the reading layer ─────────────────────────────────
// Combinations of topic type x format x pillar in the window. 3+ occurrences
// make a pattern (with a median performance ratio vs this account's own
// baseline); fewer make an early signal. All numbers are code-computed here;
// the AI only supplied the tags.

const TOPIC_LABEL: Record<string, string> = {
  'how-to': 'How-to', story: 'Story', 'myth-busting': 'Myth-busting',
  'fear-based': 'Fear-based', listicle: 'Listicle', 'proof-win': 'Proof and win',
  trend: 'Trend', other: 'Other',
};

function formatPlural(bucket: string): string {
  return bucket === 'image' ? 'image posts' : `${bucket}s`;
}

function buildPatterns(
  cards: ContentCard[],
  pillars: ContentPillar[],
  linkByCard: Map<string, string>,
  igById: Map<string, IgPostRow>,
  snaps: Map<string, SnapRow>,
  tagsByMedia: Map<string, PostTags>,
  baseline: Baseline,
  goals: ClientGoal[],
): PatternsData {
  const pillarById = new Map(pillars.map(p => [p.id, p]));
  const now = Date.now();
  const windowStart = now - WINDOW_DAYS * 86400000;

  // Same entry rule as the scorecard: posted, linked, with metrics, inside
  // the window. Experiments stay out, so a wild test cannot paint a pattern.
  type Entry = { tags: PostTags; bucket: string; pillarName: string; snap: SnapRow; ig: IgPostRow };
  const entries: Entry[] = [];
  for (const card of cards) {
    if (card.stage !== 'posted' || card.experiment) continue;
    const mediaId = linkByCard.get(card.id);
    if (!mediaId) continue;
    const ig = igById.get(mediaId);
    const snap = snaps.get(mediaId);
    const tags = tagsByMedia.get(mediaId);
    if (!ig || !snap || !tags || !ig.posted_at) continue;
    const t = new Date(ig.posted_at).getTime();
    if (t < windowStart || t > now) continue;
    entries.push({
      tags, bucket: formatBucket(ig),
      pillarName: pillarById.get(card.pillarId)?.name ?? 'No pillar',
      snap, ig,
    });
  }

  // Group by topic type x format x pillar.
  const groups = new Map<string, Entry[]>();
  for (const e of entries) {
    if (!e.tags.topicType) continue;
    const key = `${e.tags.topicType}|${e.bucket}|${e.pillarName}`;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }

  const patterns: PatternInsight[] = [];
  const earlySignals: PatternInsight[] = [];
  for (const [key, group] of Array.from(groups.entries())) {
    const [topicType, bucket, pillarName] = key.split('|');
    const label = `${TOPIC_LABEL[topicType] ?? topicType} ${formatPlural(bucket)} under ${pillarName}`;
    if (group.length >= 3) {
      // Median of per-post reach ratios against the account's own,
      // format-matched baseline (the same comparison the scorecard uses).
      const ratios: number[] = [];
      for (const e of group) {
        const v = metricValue('reach', e.snap);
        if (v == null) continue;
        const b = baseline.medianFor('reach', e.bucket);
        if (!b.value || b.value <= 0) continue;
        ratios.push(clampRatio(v / b.value));
      }
      const medianRatio = median(ratios);
      const verdictWords = medianRatio == null ? 'no usable numbers yet'
        : medianRatio >= EARNING_AT ? 'usually above your average'
        : medianRatio <= DRAGGING_AT ? 'usually below your average'
        : 'around your average';
      patterns.push({
        topicType, format: bucket, pillarName, postCount: group.length, medianRatio,
        sentence: `${label}: ${verdictWords}, based on ${group.length} posts.`,
      });
    } else {
      earlySignals.push({
        topicType, format: bucket, pillarName, postCount: group.length, medianRatio: null,
        sentence: `${label}: only ${group.length} post${group.length === 1 ? '' : 's'} so far. Too few to call a pattern.`,
      });
    }
  }
  // Strongest patterns first; early signals by count.
  patterns.sort((a, b) => (b.medianRatio ?? 0) - (a.medianRatio ?? 0));
  earlySignals.sort((a, b) => b.postCount - a.postCount);

  // CTA alignment check (Spec 05 hook): declared goals vs what the window's
  // posts actually ask for. Code-computed sentences, no AI wording.
  const ctaFlags: string[] = [];
  const taggedCtas = entries.map(e => e.tags.ctaType).filter((c): c is string => c != null);
  if (taggedCtas.length > 0) {
    if (goals.includes('links') && !taggedCtas.includes('link')) {
      ctaFlags.push('Your goal is link taps but recent posts never ask for the link.');
    }
    if (goals.includes('conversations') && !taggedCtas.includes('dm') && !taggedCtas.includes('comment')) {
      ctaFlags.push('Your goal is DMs but recent posts never invite a comment or a DM.');
    }
    if (goals.includes('followers') && !taggedCtas.includes('follow')) {
      ctaFlags.push('Your goal is followers but recent posts never ask people to follow.');
    }
  }

  return { taggedPostCount: entries.length, patterns, earlySignals, ctaFlags };
}
