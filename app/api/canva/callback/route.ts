import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authConfigured, verifyToken, SESSION_COOKIE } from '@/lib/auth';
import { exchangeCode } from '@/lib/canva';

export const dynamic = 'force-dynamic';

function isOwner(): boolean {
  if (!authConfigured()) return true;
  return verifyToken(cookies().get(SESSION_COOKIE)?.value) === 'owner';
}

// Canva redirects here after the user allows (or denies) access. Verify the
// state, swap the code for tokens, then send them back to where they started
// with a ?canva= flag the UI can react to.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const jar = cookies();
  const back = jar.get('canva_return')?.value || '/';
  const done = (flag: string) => {
    const res = NextResponse.redirect(new URL(`${back}${back.includes('?') ? '&' : '?'}canva=${flag}`, url.origin));
    res.cookies.delete('canva_pkce');
    res.cookies.delete('canva_state');
    res.cookies.delete('canva_return');
    return res;
  };

  if (!isOwner()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const error = url.searchParams.get('error');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const savedState = jar.get('canva_state')?.value;
  const verifier = jar.get('canva_pkce')?.value;

  if (error) return done('denied');
  if (!code || !state || !savedState || state !== savedState || !verifier) return done('error');

  try {
    await exchangeCode(code, verifier);
    return done('connected');
  } catch {
    return done('error');
  }
}
