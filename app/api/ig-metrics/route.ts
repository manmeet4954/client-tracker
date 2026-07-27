import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { authConfigured, verifyToken, SESSION_COOKIE } from '@/lib/auth';
import { metricKind } from '@/lib/platforms';

// Small weekly summary for the Momentum meter's results row. Owner-only,
// server-side keys, reads only.
//
// Spec 26 §13: repointed at `post_observations` / `account_observations`, with
// the legacy `ig_*` tables as the fallback while the cutover's dual-write window
// runs (§14.7). The old comment about lifetime counters not being summable is
// now an ENFORCED rule: `metricKind` says which metrics may be summed and which
// may only be differenced, and this route asserts it rather than describing it.
//
// What is legal here, precisely:
//  - summing a cumulative metric ACROSS POSTS at one moment: yes, that is a
//    cross-sectional account total;
//  - summing the same metric ACROSS DAYS: never — the day-to-day figure is a
//    DIFFERENCE, which is what this file computes.

export const dynamic = 'force-dynamic';

const ENGAGEMENT_METRICS = ['likes', 'comments', 'saved', 'shares'] as const;

/** If a platform ever reclassifies one of these, this throws rather than quietly
 *  producing a wrong number. */
function assertCumulative(metricIds: readonly string[]): void {
  for (const id of metricIds) {
    const kind = metricKind('instagram', id);
    if (kind && kind !== 'cumulative') {
      throw new Error(
        `[store] "${id}" is a ${kind} metric — this summary differences it across days, ` +
        'which is only legal for a lifetime counter (spec 26 §5.4)',
      );
    }
  }
}

interface DayTotals { engagement: number; reach: number }

export async function GET() {
  if (authConfigured()) {
    const role = verifyToken(cookies().get(SESSION_COOKIE)?.value);
    if (role !== 'owner') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  assertCumulative([...ENGAGEMENT_METRICS, 'reach']);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const since = new Date();
  since.setDate(since.getDate() - 16);
  const sinceStr = since.toISOString().slice(0, 10);

  const byDate = new Map<string, DayTotals>();
  const followersByDate = new Map<string, number>();

  // The new store first (§13). Only `lifetime` rows: a materialized window row
  // is a different kind of fact and must never join a daily total.
  const { data: obs } = await supabase.from('post_observations')
    .select('local_date,metrics,kind_of_row').gte('local_date', sinceStr);
  const { data: accObs } = await supabase.from('account_observations')
    .select('local_date,metrics').gte('local_date', sinceStr);

  for (const row of (obs ?? []) as { local_date: string; metrics: Record<string, number>; kind_of_row: string }[]) {
    if ((row.kind_of_row ?? 'lifetime') !== 'lifetime') continue;
    const cur = byDate.get(row.local_date) ?? { engagement: 0, reach: 0 };
    for (const m of ENGAGEMENT_METRICS) cur.engagement += row.metrics?.[m] ?? 0;
    cur.reach += row.metrics?.reach ?? 0;
    byDate.set(row.local_date, cur);
  }
  for (const row of (accObs ?? []) as { local_date: string; metrics: Record<string, number> }[]) {
    if (typeof row.metrics?.followers === 'number') followersByDate.set(row.local_date, row.metrics.followers);
  }

  // The legacy tables, while the dual-write window runs and for the history that
  // predates the migration.
  if (!byDate.size) {
    const { data: snaps } = await supabase.from('ig_daily_snapshots')
      .select('snapshot_date,reach,likes,comments,saves,shares').gte('snapshot_date', sinceStr);
    for (const s of (snaps ?? []) as Record<string, string | number | null>[]) {
      const date = String(s.snapshot_date);
      const cur = byDate.get(date) ?? { engagement: 0, reach: 0 };
      cur.engagement += Number(s.likes ?? 0) + Number(s.comments ?? 0) + Number(s.saves ?? 0) + Number(s.shares ?? 0);
      cur.reach += Number(s.reach ?? 0);
      byDate.set(date, cur);
    }
  }
  if (!followersByDate.size) {
    const { data: accSnaps } = await supabase.from('ig_account_snapshots')
      .select('snapshot_date,followers').gte('snapshot_date', sinceStr).order('snapshot_date', { ascending: true });
    for (const a of (accSnaps ?? []) as { snapshot_date: string; followers: number | null }[]) {
      if (typeof a.followers === 'number') followersByDate.set(a.snapshot_date, a.followers);
    }
  }

  const dates = Array.from(byDate.keys()).sort();
  if (dates.length === 0) return NextResponse.json({ ok: false, reason: 'no-data' });

  // Closest tracked day at or before (latest − n days). A week with no
  // observation returns null: a gap is never filled with a carried-forward value.
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

  const at = (d: string | null) => (d ? byDate.get(d) ?? null : null);
  const latest = at(latestDate)!;
  const wk = at(weekAgo);
  const wk2 = at(twoWeeksAgo);

  const followerDates = Array.from(followersByDate.keys()).sort();
  const followersNow = followerDates.length
    ? followersByDate.get(followerDates[followerDates.length - 1])! : null;
  const followersWeekAgo = weekAgo ? [...followerDates].reverse().find(d => d <= weekAgo) : undefined;

  return NextResponse.json({
    ok: true,
    lastSync: latestDate,
    followers: followersNow,
    followersDelta7d: followersNow != null && followersWeekAgo != null
      ? followersNow - followersByDate.get(followersWeekAgo)! : null,
    engagement7d: wk ? latest.engagement - wk.engagement : null,
    engagementPrev7d: wk && wk2 ? wk.engagement - wk2.engagement : null,
    reach7d: wk ? latest.reach - wk.reach : null,
    reachPrev7d: wk && wk2 ? wk.reach - wk2.reach : null,
  });
}
