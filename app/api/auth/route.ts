import { NextResponse } from 'next/server';
import { authConfigured, roleForPasscode, signRole, SESSION_COOKIE, cookieOptionsForRole } from '@/lib/auth';
import { mutateState, readState } from '@/lib/supabaseServer';
import { findByCode, markUsed, roleForInvite } from '@/lib/access/invites';
import type { Role } from '@/lib/access';

export const dynamic = 'force-dynamic';
// redeploy: apply updated MOM_PASSCODE (v3)

// POST { passcode } → sets a signed session cookie and returns the role.
export async function POST(req: Request) {
  // Open mode (no passcodes configured): everyone is the owner, no gate.
  if (!authConfigured()) {
    return NextResponse.json({ role: 'owner', open: true });
  }

  const body = await req.json().catch(() => ({}));
  const passcode = String(body?.passcode ?? '');
  // The five environment passcodes first: her own login must never depend on a
  // database read, so it keeps working when everything else is down.
  let role: Role | null = roleForPasscode(passcode);

  // Then the invites she made (2026-08-11). Her words: "I cannot register
  // everyone's password every time." A code here is a row, not a deploy.
  if (!role) {
    const stored = await readState();
    const invite = stored ? findByCode(stored.invites ?? [], passcode) : null;
    if (invite) {
      role = roleForInvite(invite) as Role;
      // Best effort: knowing whether an invite has ever been used is worth a
      // lot to her and nothing to the login, so a failure here never blocks it.
      try {
        const now = new Date().toISOString();
        await mutateState(fresh => ({ ...fresh, invites: markUsed(fresh.invites ?? [], invite.id, now) }));
      } catch { /* the login is what matters */ }
    }
  }

  if (!role) {
    return NextResponse.json({ error: 'Incorrect passcode' }, { status: 401 });
  }

  const res = NextResponse.json({ role });
  res.cookies.set(SESSION_COOKIE, signRole(role), cookieOptionsForRole(role));
  return res;
}

// DELETE → log out (clear the session cookie).
//
// 2026-08-17: THIS DID NOT CLEAR THE COOKIE, and it locked her out of her own
// app for an afternoon. The session is SET with `secure` and `sameSite: lax`
// (cookieOptionsForRole); this cleared it without them. A browser matches a
// cookie on its attributes, and Safari is the strictest about it, so the
// delete silently missed. The screen flipped to the passcode gate for a
// moment, then the next load found the cookie still there and signed the
// person straight back in as whoever they were.
//
// The clear now carries the SAME attributes as the set, from the same helper,
// so the two can never drift apart again. `expires` rides along with `maxAge`
// because older Safari honours only the former.
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  // Any role gives the same base attributes; only `maxAge` differs, and we
  // override that here. Passing the owner is just a way to ask for the base.
  const { maxAge: _ignored, ...base } = { maxAge: 0, ...cookieOptionsForRole('owner' as Role) };
  res.cookies.set(SESSION_COOKIE, '', { ...base, maxAge: 0, expires: new Date(0) });
  return res;
}
