import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authConfigured, verifyToken, SESSION_COOKIE } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

// Next caches fetch() by URL and supabase-js rides on fetch; long-lived query
// URLs get served from the data cache at random. That one behavior ate previews
// for eight days (see lib/supabaseServer.ts). Every server client pins no-store.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });


export const dynamic = 'force-dynamic';

// Signed uploads for the Asset Vault. The browser asks here for permission,
// then sends the file STRAIGHT to Supabase storage — skipping this server, so
// big phone photos avoid the Vercel request-size wall and arrive untouched
// (no resize, no recompression). Only the `assets` bucket is signable.
const BUCKET = 'assets';
const SAFE_EXT = /^[a-z0-9]{1,8}$/;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { fetch: noStoreFetch } });

function currentRole() {
  if (!authConfigured()) return 'owner';
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifyToken(token);
}

export async function POST(req: Request) {
  const role = currentRole();
  if (!role) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const rawExt = String(body?.ext ?? 'jpg').toLowerCase();
  const ext = SAFE_EXT.test(rawExt) ? rawExt : 'jpg';
  const prefix = body?.kind === 'thumb' ? 'thumb' : 'orig';

  const path = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'sign-failed' }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ path: data.path, token: data.token, publicUrl });
}
