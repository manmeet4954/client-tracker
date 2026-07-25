import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authConfigured, verifyToken, signRole, SESSION_COOKIE, cookieOptionsForRole } from '@/lib/auth';
import { readState, writeState } from '@/lib/supabaseServer';
import { filterStateForRole, mergeRoleWrite, normalizeState, emptyState, type Role } from '@/lib/access';
import { applyScopes, checkScopes } from '@/lib/tree/scopes';

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

// POST { state, paths } → a PATH-SCOPED write (spec 21 §3.4).
//
// The old door replaced the whole blob, so two overlapping saves clobbered each
// other — last write won on everything (CLAUDE.md gotcha 2). Now a save DECLARES
// the paths it touched and only those paths merge onto the authoritative state;
// everything else comes from what is stored. An undeclared path is refused
// outright (law 4).
//
// `paths` missing = a client bundle from before this shipped: it falls back to
// the old whole-blob behavior rather than losing her work mid-deploy.
export async function POST(req: Request) {
  const role = currentRole();
  if (!role) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const incoming = body?.state;
  const paths: string[] | undefined = Array.isArray(body?.paths) ? body.paths : undefined;
  if (!incoming) return NextResponse.json({ error: 'bad-request' }, { status: 400 });

  if (paths) {
    const rejected = checkScopes(paths);
    if (rejected.length) {
      return NextResponse.json({ error: 'undeclared-path', rejected }, { status: 400 });
    }
  }

  try {
    const current = await readState();

    if (!current) {
      // Nothing stored yet: there is nothing to merge against.
      if (role !== 'owner') return NextResponse.json({ error: 'no-state' }, { status: 409 });
      await writeState(normalizeState(incoming));
      return NextResponse.json({ ok: true, scoped: false });
    }

    const base = normalizeState(current);
    // Role filtering first, always — a restricted role's write can only reach
    // its own bound profiles (CLAUDE.md rule 2), and only then is it narrowed
    // to the paths this save declared.
    const merged = role === 'owner' ? normalizeState(incoming) : mergeRoleWrite(base, incoming, role);
    const next = paths ? applyScopes(base, merged, paths) : merged;

    await writeState(next);
    return NextResponse.json({ ok: true, scoped: !!paths });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'write failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
