import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authConfigured, verifyToken, SESSION_COOKIE } from '@/lib/auth';
import { mutateState, readState } from '@/lib/supabaseServer';
import { allowedClientIds, normalizeState, type Role } from '@/lib/access';
import { applyScopes, checkScopes, scopeKey } from '@/lib/tree/scopes';
import { applySkip, writeSkipped } from '@/lib/intake/form';
import { readPath } from '@/lib/tree/body';
import type { IntakeRound } from '@/lib/tree/objects';

export const dynamic = 'force-dynamic';

/**
 * "I'll come back to this" — spec 33 §4, for a CLIENT.
 *
 * Why this route exists at all, because it looks like a detour and is not.
 *
 * A skip is a third state that lives on the ROUND (`context/intake`), and that
 * folder is `fed_by: ['owner']`. That is not an oversight to patch: no client
 * action may write the round object, and an acceptance test pins it. Adding
 * `client` to that folder's writers would open a door S19 does not allow, to
 * fix a button.
 *
 * So the client does not write it. They ASK, and the system records it on their
 * behalf, having first checked they are actually bound to this profile and that
 * the round is actually theirs and open. That keeps the door count at four and
 * still lets a person on a long form say "not this one, not yet".
 *
 * Her own side never comes here: it writes the round directly, as the owner,
 * the way it always has.
 */

function currentRole(): Role | null {
  if (!authConfigured()) return 'owner'; // open mode, local dev
  return verifyToken(cookies().get(SESSION_COOKIE)?.value);
}

const INTAKE_PATH = 'context/intake';

export async function POST(req: Request) {
  const role = currentRole();
  if (!role) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const profileId = String(body?.profileId ?? '');
  const roundId = String(body?.roundId ?? '');
  const parameterId = String(body?.parameterId ?? '');
  const on = body?.on !== false;              // default: set it aside
  if (!profileId || !roundId || !parameterId) {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }

  // The binding check. A role may only touch a profile it actually holds, and
  // `allowedClientIds` is the same authority every other write is judged by.
  const stored = await readState();
  if (!stored) return NextResponse.json({ error: 'no-state' }, { status: 409 });
  const base = normalizeState(stored);
  if (role !== 'owner' && !allowedClientIds(base, role).includes(profileId)) {
    return NextResponse.json({ error: 'not-yours' }, { status: 403 });
  }

  const profile = base.clientData?.[profileId];
  if (!profile?.body) return NextResponse.json({ error: 'no-body' }, { status: 409 });

  // The round has to be theirs, open, and actually asking for this parameter.
  // A skip against a curated round, or a parameter nobody asked for, is not a
  // thing that can happen by accident, so it is refused rather than tidied up.
  const round = readPath(profile.body, INTAKE_PATH)
    .find(e => e.id === roundId)?.data as unknown as IntakeRound | undefined;
  if (!round) return NextResponse.json({ error: 'no-round' }, { status: 404 });
  if (round.status === 'curated') {
    return NextResponse.json({ error: 'round-closed' }, { status: 409 });
  }
  if (!round.parameters.includes(parameterId)) {
    return NextResponse.json({ error: 'not-asked' }, { status: 400 });
  }

  const now = new Date().toISOString();

  // Out through the ordinary door: one declared path, nothing else touched.
  const paths = [scopeKey(profileId, INTAKE_PATH)];
  const rejected = checkScopes(paths);
  if (rejected.length) {
    return NextResponse.json({ error: 'undeclared-path', rejected }, { status: 400 });
  }

  // Compare-and-swap (2026-08-09): the skip is recomputed against a fresh base
  // on every attempt, so a retry can never resurrect an older round.
  const result = await mutateState(fresh => {
    const fp = fresh.clientData?.[profileId];
    const fr = fp?.body
      ? (readPath(fp.body, INTAKE_PATH).find(e => e.id === roundId)?.data as unknown as IntakeRound | undefined)
      : undefined;
    if (!fp?.body || !fr || fr.status === 'curated') return null;
    const nextBody = writeSkipped(fp.body, roundId, applySkip(fr.skipped ?? [], parameterId, on), now);
    return applyScopes(fresh, {
      ...fresh,
      clientData: { ...fresh.clientData, [profileId]: { ...fp, body: nextBody } },
    }, paths);
  });
  if (result === 'aborted') return NextResponse.json({ error: 'round-closed' }, { status: 409 });
  if (result === 'no-row') return NextResponse.json({ error: 'no-state' }, { status: 409 });
  return NextResponse.json({ ok: true, skipped: (round.skipped ?? []).length + (on ? 1 : -1) });
}
