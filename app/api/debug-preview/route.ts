import { NextResponse } from 'next/server';
import { readState } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

// Diagnostic endpoint — returns structure info (no content) to help debug
// "preview not available" issues without exposing sensitive post data.
// Visit: /api/debug-preview?id=<shareId>
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const shareId = searchParams.get('id') ?? '';

  let state;
  try {
    state = await readState();
  } catch (e) {
    return NextResponse.json({
      ok: false,
      stage: 'readState',
      error: e instanceof Error ? e.message : String(e),
    });
  }

  if (!state) {
    return NextResponse.json({ ok: false, stage: 'readState', error: 'returned null — check Supabase logs' });
  }

  const clients = Object.entries(state.clientData ?? {}).map(([id, data]) => ({
    id,
    postCount: (data.previewPosts ?? []).length,
    shareIds: (data.previewPosts ?? []).map(p => p.shareId),
  }));

  const found = shareId
    ? clients.some(c => c.shareIds.includes(shareId))
    : null;

  return NextResponse.json({
    ok: true,
    clientCount: clients.length,
    clients,
    ...(shareId ? { searchedFor: shareId, found } : {}),
  });
}
