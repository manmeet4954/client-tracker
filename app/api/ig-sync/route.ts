import { NextRequest, NextResponse } from 'next/server';
import { GET as metricsSync } from '../metrics-sync/route';

// Spec 26 §6.1: this route's work moved to `/api/metrics-sync`, which does the
// same job for every connected platform instead of only Instagram. Every part of
// the old logic — the weekly token refresh, the account snapshot with its
// best-effort profile_views / website_clicks call, media paging until the
// tracking window is passed, the three-set insights fallback, batching, and
// per-account error isolation — moved into `lib/platforms/instagram/`.
//
// This thin forward stays for ONE release so the live cron entry cannot break
// mid-cutover. It authenticates nothing of its own: the handler it calls does
// the same cron-secret-or-owner-session check it always did.

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const res = await metricsSync(req);
  // A caller that still reads this route gets told where the work went, without
  // its own response shape changing under it.
  if (res.status !== 200) return res;
  const body = await res.json();
  return NextResponse.json({ ...body, moved_to: '/api/metrics-sync' });
}
