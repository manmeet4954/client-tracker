import { NextResponse } from 'next/server';
import { authConfigured, roleForPasscode, signRole, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST { passcode } → sets a signed session cookie and returns the role.
export async function POST(req: Request) {
  // Open mode (no passcodes configured): everyone is the owner, no gate.
  if (!authConfigured()) {
    return NextResponse.json({ role: 'owner', open: true });
  }

  const body = await req.json().catch(() => ({}));
  const passcode = String(body?.passcode ?? '');
  const role = roleForPasscode(passcode);
  if (!role) {
    return NextResponse.json({ error: 'Incorrect passcode' }, { status: 401 });
  }

  const res = NextResponse.json({ role });
  res.cookies.set(SESSION_COOKIE, signRole(role), sessionCookieOptions());
  return res;
}

// DELETE → log out (clear the session cookie).
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
