import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { authConfigured, verifyToken, SESSION_COOKIE } from '@/lib/auth';

// Small weekly summary of the ig_* tables for the Momentum meter's results
// row. Owner-only, server-side keys. Reads only; the daily /api/ig-sync cron
// writes the tables.

export const dynamic = 'force-dynamic';

type DailySnap = {
  snapshot_date: string;
  reach: number | null; likes: number | null; comments: number | null;
  saves: number | null; shares: number | null;
};

export async function GET() {
  if (authConfigured()) {
    const role = verifyToken(cookies().get(SESSION_COOKIE)?.value);
    if (role !== 'owner') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const since = new Date();
  since.setDate(since.getDate() - 16);
  const sinceStr = since.toISOString().slice(0, 10);

  const [{ data: accSnaps }, { data: snaps }] = await Promise.all([
    supabase.from('ig_account_snapshots').select('snapshot_date,followers')
      .gte('snapshot_date', sinceStr).order('snapshot_date', { ascending: true }),
    supabase.from('ig_daily_snapshots').select('snapshot_date,reach,likes,comments,saves,shares')
      .gte('snapshot_date', sinceStr),
  ]);

  // Per-post metrics are lifetime counters, so summing them across all posts
  // per day gives an account-level counter; day-to-day differences are what
  // was GAINED. A new post entering the set counts its full numbers as gained,
  // which is what we want.
  const byDate = new Map<string, { engagement: number; reach: number }>();
  for (const s of (snaps ?? []) as DailySnap[]) {
    const cur = byDate.get(s.snapshot_date) ?? { engagement: 0, reach: 0 };
    cur.engagement += (s.likes ?? 0) + (s.comments ?? 0) + (s.saves ?? 0) + (s.shares ?? 0);
    cur.reach += s.reach ?? 0;
    byDate.set(s.snapshot_date, cur);
  }
  const dates = Array.from(byDate.keys()).sort();
  if (dates.length === 0) {
    return NextResponse.json({ ok: false, reason: 'no-data' });
  }

  // Closest tracked day at or before (latest − n days); older weeks may be
  // missing while history is still short.
  const latestDate = dates[dates.length - 1];
  const dayAt = (daysBack: number): string | null => {
    const target = new Date(latestDate + 'T00:00:00Z');
    target.setUTCDate(target.getUTCDate() - daysBack);
    const t = target.toISOString().slice(0, 10);
    for (let i = dates.length - 1; i >= 0; i--) if (dates[i] <= t) return dates[i];
    return null;
  };
  const weekAgo = dayAt(7);
  const twoWeeksAgo = dayAt(14);

  const at = (d: string | null) => (d ? byDate.get(d)! : null);
  const latest = at(latestDate)!;
  const wk = at(weekAgo);
  const wk2 = at(twoWeeksAgo);

  const followersRows = (accSnaps ?? []) as { snapshot_date: string; followers: number | null }[];
  const followersNow = followersRows[followersRows.length - 1]?.followers ?? null;
  const followersWeekAgoRow = weekAgo
    ? [...followersRows].reverse().find(r => r.snapshot_date <= weekAgo)
    : null;

  return NextResponse.json({
    ok: true,
    lastSync: latestDate,
    followers: followersNow,
    followersDelta7d: followersNow != null && followersWeekAgoRow?.followers != null
      ? followersNow - followersWeekAgoRow.followers : null,
    engagement7d: wk ? latest.engagement - wk.engagement : null,
    engagementPrev7d: wk && wk2 ? wk.engagement - wk2.engagement : null,
    reach7d: wk ? latest.reach - wk.reach : null,
    reachPrev7d: wk && wk2 ? wk.reach - wk2.reach : null,
  });
}
