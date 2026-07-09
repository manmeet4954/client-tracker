import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authConfigured, verifyToken, SESSION_COOKIE } from '@/lib/auth';
import { canvaConfigured, makePkce, makeState, authorizeUrl } from '@/lib/canva';

export const dynamic = 'force-dynamic';

function isOwner(): boolean {
  if (!authConfigured()) return true; // open mode = owner
  return verifyToken(cookies().get(SESSION_COOKIE)?.value) === 'owner';
}

// Kick off the Canva OAuth flow: stash the PKCE verifier + state (and where to
// return to) in short-lived cookies, then bounce to Canva's consent page.
export async function GET(req: Request) {
  if (!isOwner()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!canvaConfigured()) return NextResponse.json({ error: 'canva-not-configured' }, { status: 500 });

  const from = new URL(req.url).searchParams.get('from') || '/';
  const { verifier, challenge } = makePkce();
  const state = makeState();

  const res = NextResponse.redirect(authorizeUrl(challenge, state));
  const opts = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', maxAge: 600 };
  res.cookies.set('canva_pkce', verifier, opts);
  res.cookies.set('canva_state', state, opts);
  res.cookies.set('canva_return', from, opts);
  return res;
}
