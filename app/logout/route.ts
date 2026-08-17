import { NextResponse } from 'next/server';
import { SESSION_COOKIE, cookieOptionsForRole } from '@/lib/auth';
import type { Role } from '@/lib/access';

export const dynamic = 'force-dynamic';

/**
 * /logout — the way out that needs nothing to work.
 *
 * 2026-08-17. She was locked into a client session inside her own app for an
 * afternoon. Three fixes chased it: a button in the client sidebar, a button on
 * the zero-profile screen, then the cookie attributes the DELETE was missing.
 * Every one of them depended on the right screen rendering, the right
 * JavaScript having loaded, and a button being reachable. When someone is
 * locked out, all three of those are exactly what cannot be relied on.
 *
 * So this is an ADDRESS. She types it. It clears the session and drops her at
 * the sign-in gate. No component, no bundle, no cached page, no button. A GET,
 * so it works from the address bar, from a bookmark, from a phone, from a
 * screen showing nothing at all.
 *
 * It is safe as a GET because it destroys a session and nothing else: the worst
 * a stray visit can do is ask someone to sign in again.
 */
export async function GET(req: Request) {
  // Straight to `/`, NOT to `/login`. `/login` does the same job but does it
  // from the browser, so it needs its bundle to load and run; this route has
  // already killed the session by the time the redirect is followed, and the
  // app then finds no session and shows the gate. Nothing to load, nothing to
  // click, nothing to go wrong.
  const res = NextResponse.redirect(new URL('/', req.url));
  // The SAME attributes as the set, from the same helper — the drift between
  // those two is what caused this in the first place (see app/api/auth/route.ts).
  const base = cookieOptionsForRole('owner' as Role);
  res.cookies.set(SESSION_COOKIE, '', { ...base, maxAge: 0, expires: new Date(0) });
  return res;
}
