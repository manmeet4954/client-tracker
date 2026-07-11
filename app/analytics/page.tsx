import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { verifyToken, SESSION_COOKIE, authConfigured } from '@/lib/auth';

// Instagram performance analytics — reads the ig_* tables filled daily by
// /api/ig-sync. Owner-only. Server-rendered so tokens/keys never reach the browser.

export const dynamic = 'force-dynamic';

type Snapshot = {
  post_id: string; snapshot_date: string; views: number | null; reach: number | null;
  likes: number | null; comments: number | null; saves: number | null; shares: number | null;
};
type Post = {
  id: string; caption: string | null; media_type: string; media_product_type: string | null;
  permalink: string; posted_at: string;
};

const fmt = (n: number | null | undefined) => (n == null ? '–' : new Intl.NumberFormat('en-IN').format(n));

function kind(p: Post): string {
  if (p.media_product_type === 'REELS') return 'Reel';
  if (p.media_type === 'CAROUSEL_ALBUM') return 'Carousel';
  return 'Image';
}

export default async function AnalyticsPage() {
  if (authConfigured()) {
    const role = verifyToken(cookies().get(SESSION_COOKIE)?.value);
    if (role !== 'owner') redirect('/');
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const [{ data: account }, { data: accSnaps }, { data: posts }, { data: snaps }] = await Promise.all([
    supabase.from('ig_accounts').select('id,username').limit(1).maybeSingle(),
    supabase.from('ig_account_snapshots').select('*').order('snapshot_date', { ascending: false }).limit(2),
    supabase.from('ig_posts').select('id,caption,media_type,media_product_type,permalink,posted_at').order('posted_at', { ascending: false }),
    supabase.from('ig_daily_snapshots').select('*').order('snapshot_date', { ascending: false }),
  ]);

  // Latest snapshot per post (first hit wins because snaps are date-descending).
  const latest = new Map<string, Snapshot>();
  for (const s of (snaps ?? []) as Snapshot[]) if (!latest.has(s.post_id)) latest.set(s.post_id, s);

  const rows = ((posts ?? []) as Post[]).map(p => ({ post: p, m: latest.get(p.id) }));
  const tracked = rows.filter(r => r.m);

  const sum = (f: (m: Snapshot) => number | null) =>
    tracked.reduce((acc, r) => acc + (f(r.m!) ?? 0), 0);
  const totals = { views: sum(m => m.views), reach: sum(m => m.reach), saves: sum(m => m.saves), shares: sum(m => m.shares) };

  const bySaves = [...tracked].sort((a, b) => (b.m!.saves ?? 0) - (a.m!.saves ?? 0)).slice(0, 3);
  const followers = accSnaps?.[0]?.followers;
  const lastSync = accSnaps?.[0]?.snapshot_date;
  const trackedDays = new Set((snaps ?? []).map((s: Snapshot) => s.snapshot_date)).size;

  return (
    <div className="min-h-screen bg-[#F7F7F5] text-stone-800">
      <div className="mx-auto max-w-5xl px-4 py-8">

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-stone-400">Instagram Analytics</p>
            <h1 className="mt-1 text-2xl font-bold">@{account?.username ?? '—'}</h1>
            <p className="mt-1 text-sm text-stone-500">
              Tracking since 1 May 2026 · {tracked.length} posts · {trackedDays} day{trackedDays === 1 ? '' : 's'} of history · last sync {lastSync ?? '—'}
            </p>
          </div>
          <div className="rounded-xl bg-white px-4 py-2 shadow-sm ring-1 ring-stone-200">
            <p className="text-xs text-stone-400">Followers</p>
            <p className="text-xl font-bold">{fmt(followers)}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[['Views', totals.views], ['Reach', totals.reach], ['Saves', totals.saves], ['Shares', totals.shares]].map(([label, v]) => (
            <div key={label as string} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
              <p className="text-xs uppercase tracking-wide text-stone-400">{label}</p>
              <p className="mt-1 text-2xl font-bold">{fmt(v as number)}</p>
              <p className="text-[11px] text-stone-400">across tracked posts</p>
            </div>
          ))}
        </div>

        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-stone-500">Top posts by saves</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {bySaves.map(({ post, m }) => (
            <a key={post.id} href={post.permalink} target="_blank" rel="noreferrer"
               className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200 transition hover:ring-orange-300">
              <div className="flex items-center justify-between text-[11px] text-stone-400">
                <span>{kind(post)}</span><span>{post.posted_at?.slice(0, 10)}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm">{post.caption ?? '(no caption)'}</p>
              <div className="mt-3 flex gap-4 text-sm">
                <span><b>{fmt(m!.saves)}</b> <span className="text-stone-400">saves</span></span>
                <span><b>{fmt(m!.shares)}</b> <span className="text-stone-400">shares</span></span>
                <span><b>{fmt(m!.views)}</b> <span className="text-stone-400">views</span></span>
              </div>
            </a>
          ))}
        </div>

        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-stone-500">All tracked posts</h2>
        <div className="mt-2 overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-stone-200">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left text-[11px] uppercase tracking-wide text-stone-400">
                <th className="px-4 py-3">Post</th>
                <th className="px-2 py-3">Type</th>
                <th className="px-2 py-3 text-right">Views</th>
                <th className="px-2 py-3 text-right">Reach</th>
                <th className="px-2 py-3 text-right">Likes</th>
                <th className="px-2 py-3 text-right">Comments</th>
                <th className="px-2 py-3 text-right">Saves</th>
                <th className="px-2 py-3 text-right pr-4">Shares</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ post, m }) => (
                <tr key={post.id} className="border-b border-stone-50 hover:bg-orange-50/40">
                  <td className="max-w-[280px] px-4 py-2.5">
                    <a href={post.permalink} target="_blank" rel="noreferrer" className="hover:text-orange-600">
                      <span className="block truncate">{post.caption ?? '(no caption)'}</span>
                      <span className="text-[11px] text-stone-400">{post.posted_at?.slice(0, 10)}</span>
                    </a>
                  </td>
                  <td className="px-2 py-2.5 text-stone-500">{kind(post)}</td>
                  <td className="px-2 py-2.5 text-right">{fmt(m?.views)}</td>
                  <td className="px-2 py-2.5 text-right">{fmt(m?.reach)}</td>
                  <td className="px-2 py-2.5 text-right">{fmt(m?.likes)}</td>
                  <td className="px-2 py-2.5 text-right">{fmt(m?.comments)}</td>
                  <td className="px-2 py-2.5 text-right font-semibold">{fmt(m?.saves)}</td>
                  <td className="px-2 py-2.5 pr-4 text-right">{fmt(m?.shares)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-center text-[11px] text-stone-400">
          Numbers come from the official Instagram API, refreshed daily around 9:00 AM. Day-by-day curves grow from 11 July 2026 onward.
        </p>
      </div>
    </div>
  );
}
