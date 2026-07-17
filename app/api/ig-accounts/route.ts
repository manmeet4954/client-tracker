import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { authConfigured, verifyToken, SESSION_COOKIE } from '@/lib/auth';
import type { Role } from '@/lib/access';

// Owner-only management of connected Instagram accounts (Spec 03).
// Access tokens live in the ig_accounts table (RLS on, no policies) and are
// only ever read with the service role key. This route NEVER returns a token:
// the browser sees id, username, and the client link, nothing more.

export const dynamic = 'force-dynamic';

const GRAPH = 'https://graph.instagram.com/v23.0';

function currentRole(): Role | null {
  if (!authConfigured()) return 'owner'; // open mode
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifyToken(token);
}

// Lazy so a missing env var can never crash the build, only this route at runtime.
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase env vars missing');
  return createClient(url, key);
}

function guard(): NextResponse | null {
  const role = currentRole();
  if (!role) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (role !== 'owner') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return null;
}

// GET → the connected accounts, without their tokens.
export async function GET() {
  const blocked = guard();
  if (blocked) return blocked;

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('ig_accounts')
      .select('id, username, client_id, token_refreshed_at, created_at')
      .order('created_at');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ accounts: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'read failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST → two owner actions:
//   { accountId, clientId } → link an account to a dashboard client ('' unlinks)
//   { token }               → connect a new account from a pasted access token
export async function POST(req: Request) {
  const blocked = guard();
  if (blocked) return blocked;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'bad-request' }, { status: 400 });

  try {
    const supabase = getSupabase();

    // Connect a new account: verify the pasted token against the Graph API,
    // then store it server-side. The token is never echoed back.
    if (typeof body.token === 'string' && body.token.trim()) {
      const token = body.token.trim();
      const res = await fetch(
        `${GRAPH}/me?fields=user_id,username&access_token=${encodeURIComponent(token)}`,
        { cache: 'no-store' },
      );
      const me = await res.json();
      if (me.error) {
        return NextResponse.json(
          { error: `Instagram did not accept this token: ${me.error.message}` },
          { status: 400 },
        );
      }
      const { error } = await supabase.from('ig_accounts').upsert({
        id: String(me.user_id ?? me.id),
        username: me.username,
        access_token: token,
        token_refreshed_at: new Date().toISOString(),
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, account: { id: String(me.user_id ?? me.id), username: me.username } });
    }

    // Link (or unlink) an account to a dashboard client.
    if (typeof body.accountId === 'string' && body.accountId) {
      const clientId = typeof body.clientId === 'string' && body.clientId ? body.clientId : null;
      const { error } = await supabase
        .from('ig_accounts')
        .update({ client_id: clientId })
        .eq('id', body.accountId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'write failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
