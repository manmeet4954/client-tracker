import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authConfigured, verifyToken, SESSION_COOKIE } from '@/lib/auth';
import { readState, writeState } from '@/lib/supabaseServer';
import { filterStateForIntern, mergeInternWrite, normalizeState, emptyState, type Role } from '@/lib/access';

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
  if (!raw) {
    // No saved row yet: owner starts empty (client seeds), intern sees nothing.
    return NextResponse.json({ role, state: role === 'intern' ? emptyState() : null });
  }
  const state = role === 'intern' ? filterStateForIntern(raw) : normalizeState(raw);
  return NextResponse.json({ role, state });
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
    await writeState(mergeInternWrite(current, incoming));
  }
  return NextResponse.json({ ok: true });
}
