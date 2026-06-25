import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authConfigured, verifyToken, SESSION_COOKIE } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function currentRole() {
  if (!authConfigured()) return 'owner';
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifyToken(token);
}

export async function POST(req: Request) {
  const role = currentRole();
  if (!role) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const formData = await req.formData().catch(() => null);
  const file = formData?.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'no-file' }, { status: 400 });

  const bytes = await file.arrayBuffer();
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext || 'jpg'}`;

  const { error } = await supabase.storage
    .from('catalogue')
    .upload(filename, bytes, { contentType: file.type, upsert: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: { publicUrl } } = supabase.storage
    .from('catalogue')
    .getPublicUrl(filename);

  return NextResponse.json({ url: publicUrl });
}
