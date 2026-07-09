import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authConfigured, verifyToken, SESSION_COOKIE } from '@/lib/auth';
import { canvaConfigured, isConnected } from '@/lib/canva';

export const dynamic = 'force-dynamic';

function isOwner(): boolean {
  if (!authConfigured()) return true;
  return verifyToken(cookies().get(SESSION_COOKIE)?.value) === 'owner';
}

// Tells the UI whether the Canva integration exists (env set) and whether the
// account is connected, so the button can show Connect vs Import.
export async function GET() {
  if (!isOwner()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const configured = canvaConfigured();
  return NextResponse.json({ configured, connected: configured ? await isConnected() : false });
}
