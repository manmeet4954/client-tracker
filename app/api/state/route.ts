import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authConfigured, verifyToken, signRole, SESSION_COOKIE, cookieOptionsForRole } from '@/lib/auth';
import { readState, writeState } from '@/lib/supabaseServer';
import { filterStateForRole, mergeRoleWrite, normalizeState, emptyState, type Role } from '@/lib/access';

export const dynamic = 'force-dynamic';

function currentRole(): Role | null {
  if (!authConfigured()) return 'owner'; // open mode
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifyToken(token);
}

// GET → returns the caller's role + the slice of state they're allowed to see.
export async function GET() {
  const role = currentRole();
  if (!role) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const raw = await readState();
  const state = !raw
    ? (role === 'owner' ? null : emptyState()) // no saved row yet
    : filterStateForRole(raw, role);

  const res = NextResponse.json({ role, state });
  // Refresh the cookie on each visit (keeps persistent roles persistent).
  if (authConfigured()) res.cookies.set(SESSION_COOKIE, signRole(role), cookieOptionsForRole(role));
  return res;
}

// POST { state } → owners write everything; interns may only change the two
// allowed clients' data (enforced server-side via mergeInternWrite).
export async function POST(req: Request) {
  const role = currentRole();
  if (!role) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const incoming = body?.state;
  if (!incoming) return NextResponse.json({ error: 'bad-request' }, { status: 400 });

  if (role === 'owner') {
    await writeState(normalizeState(incoming));
  } else {
    const current = await readState();
    if (!current) return NextResponse.json({ error: 'no-state' }, { status: 409 });
    await writeState(mergeRoleWrite(current, incoming, role));
  }
  return NextResponse.json({ ok: true });
}
