import { NextResponse } from 'next/server';
import { authConfigured, roleForPasscode, signRole, SESSION_COOKIE, cookieOptionsForRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET → diagnostic: reports WHICH passcodes are configured on the live
// deployment (booleans only — never the actual values). Also reports the
// trimmed length so we can spot stray spaces in the env value.
export async function GET() {
  const o = process.env.OWNER_PASSCODE ?? '';
  const i = process.env.INTERN_PASSCODE ?? '';
  const m = process.env.MOM_PASSCODE ?? '';
  return NextResponse.json({
    owner: { set: !!o, len: o.length, trimmedLen: o.trim().length },
    intern: { set: !!i, len: i.length, trimmedLen: i.trim().length },
    mom: { set: !!m, len: m.length, trimmedLen: m.trim().length },
  });
}

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
  res.cookies.set(SESSION_COOKIE, signRole(role), cookieOptionsForRole(role));
  return res;
}

// DELETE → log out (clear the session cookie).
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
