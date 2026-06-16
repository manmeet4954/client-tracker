import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authConfigured, verifyToken, SESSION_COOKIE } from '@/lib/auth';
import { readState, writeState } from '@/lib/supabaseServer';
import { allowedClientIds, normalizeState, mergeRoleWrite, type Role } from '@/lib/access';
import { generateId } from '@/lib/utils';
import { Reference } from '@/types';

export const dynamic = 'force-dynamic';

function currentRole(): Role | null {
  if (!authConfigured()) return 'owner';
  return verifyToken(cookies().get(SESSION_COOKIE)?.value);
}

// POST { url, title, text } → saves a link Reference to the caller's client.
export async function POST(req: Request) {
  const role = currentRole();
  if (!role) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const url = String(body?.url ?? '').trim();
  const text = String(body?.text ?? '').trim();
  const title = String(body?.title ?? '').trim();

  // Prefer an explicit URL; else the first URL inside the shared text; else text.
  const urlInText = text.match(/https?:\/\/\S+/)?.[0] ?? '';
  const content = url || urlInText || text;
  if (!content) return NextResponse.json({ error: 'nothing-to-save' }, { status: 400 });

  const current = await readState();
  if (!current) return NextResponse.json({ error: 'no-state' }, { status: 409 });
  const norm = normalizeState(current);

  const targetId = allowedClientIds(norm, role)[0];
  if (!targetId) return NextResponse.json({ error: 'no-client' }, { status: 409 });

  const ref: Reference = {
    id: generateId(),
    type: 'link',
    content,
    title: title || (text && text !== content ? text.slice(0, 120) : ''),
    pinned: false,
    createdAt: new Date().toISOString(),
  };

  const cd = norm.clientData[targetId];
  const incoming = {
    ...norm,
    clientData: {
      ...norm.clientData,
      [targetId]: { ...cd, references: [ref, ...(cd?.references ?? [])] },
    },
  };
  await writeState(role === 'owner' ? incoming : mergeRoleWrite(norm, incoming, role));

  const clientName = norm.clients.find(c => c.id === targetId)?.name ?? 'References';
  return NextResponse.json({ ok: true, clientName });
}
