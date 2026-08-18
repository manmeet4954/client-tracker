import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Read one stored picture back through our own origin — 2026-08-17.
 *
 * WHY THIS EXISTS. The PNG export kept arriving with an empty avatar, empty
 * highlight circles and a blank grid, three attempts running. The pictures
 * live in Supabase storage, a different origin, and the browser would not let
 * the canvas read them — first from cache, then on a direct fetch. Every
 * browser-side fix failed for the same underlying reason, and the failures
 * were SILENT, which is what made it look like a layout bug three times.
 *
 * A server has no same-origin rule. It fetches the picture and hands it back
 * from this app's own address, so by the time the browser sees it there is
 * nothing left to refuse.
 *
 * NOT AN OPEN PROXY. It will only fetch from the hosts this app actually
 * stores pictures on, over https, and it returns the bytes as an image and
 * nothing else. An open proxy would let anyone use this server to reach
 * addresses it can see and they cannot, which is a real hole and an easy one
 * to leave open by accident.
 */
function allowedHosts(): Set<string> {
  const out = new Set<string>();
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabase) {
    try { out.add(new URL(supabase).host); } catch { /* misconfigured env */ }
  }
  // Cloudinary is where the older uploads live (CLAUDE.md: signed uploads).
  out.add('res.cloudinary.com');
  return out;
}

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get('u') ?? '';
  if (!raw) return NextResponse.json({ error: 'no-url' }, { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: 'bad-url' }, { status: 400 });
  }

  if (target.protocol !== 'https:' || !allowedHosts().has(target.host)) {
    return NextResponse.json({ error: 'not-allowed' }, { status: 403 });
  }

  const upstream = await fetch(target.toString(), { cache: 'no-store' }).catch(() => null);
  if (!upstream?.ok) return NextResponse.json({ error: 'upstream' }, { status: 502 });

  const type = upstream.headers.get('content-type') ?? '';
  // Only pictures come back through here. Anything else is not ours to serve.
  if (!type.startsWith('image/')) {
    return NextResponse.json({ error: 'not-an-image' }, { status: 415 });
  }

  return new NextResponse(await upstream.arrayBuffer(), {
    headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=300' },
  });
}
