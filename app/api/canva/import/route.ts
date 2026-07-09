import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authConfigured, verifyToken, SESSION_COOKIE } from '@/lib/auth';
import { resolveDesignId, getValidAccessToken, exportDesignPages } from '@/lib/canva';
import { uploadToStorage } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // export polling can take a while for big decks

function isOwner(): boolean {
  if (!authConfigured()) return true;
  return verifyToken(cookies().get(SESSION_COOKIE)?.value) === 'owner';
}

// POST { link } → exports the Canva design's pages, re-hosts them in the
// post-images bucket (Canva's own URLs expire in ~24h), and returns the
// permanent slide URLs in page order.
export async function POST(req: Request) {
  if (!isOwner()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const designId = await resolveDesignId(String(body?.link ?? ''));
  if (!designId) {
    return NextResponse.json(
      { error: 'Could not read a design from that link. Open the design in Canva and copy the link from the address bar, then paste it here.' },
      { status: 400 },
    );
  }

  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: 'not-connected' }, { status: 409 });

  try {
    const pageUrls = await exportDesignPages(designId, token);
    const images: string[] = [];
    for (const pageUrl of pageUrls) {
      const resp = await fetch(pageUrl);
      if (!resp.ok) throw new Error(`Could not download a slide from Canva (${resp.status}).`);
      const bytes = await resp.arrayBuffer();
      images.push(await uploadToStorage('post-images', bytes, 'image/png', 'png'));
    }
    return NextResponse.json({ images });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Canva import failed.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
