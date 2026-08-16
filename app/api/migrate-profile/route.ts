import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authConfigured, verifyToken, SESSION_COOKIE } from '@/lib/auth';
import { readState, writeStateScoped } from '@/lib/supabaseServer';
import { normalizeState, type Role } from '@/lib/access';
import { migrateProfile, reportToText } from '@/lib/tree/migrate';
import { applyScopes, changedScopes } from '@/lib/tree/scopes';
import { assertRegistriesValid } from '@/lib/tree/validate';
import { bodyStats } from '@/lib/tree/body';

export const dynamic = 'force-dynamic';

function currentRole(): Role | null {
  if (!authConfigured()) return 'owner';
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifyToken(token);
}

/**
 * Migrate ONE profile into its path-addressed body (spec 21 §9).
 *
 * Owner only, and a DRY RUN unless `apply: true` — the default answer is a
 * report she can read, not a write. Order is the spec's: declarations validate
 * first, then one profile at a time, pilot first, and nothing is deleted.
 *
 *   POST { profileId }                → the report, nothing written
 *   POST { profileId, apply: true }   → the same, and the body is stored
 */
export async function POST(req: Request) {
  const role = currentRole();
  if (role !== 'owner') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const input = await req.json().catch(() => null);
  const profileId: string = input?.profileId ?? '';
  const apply = input?.apply === true;
  const force = input?.force === true;
  if (!profileId) return NextResponse.json({ error: 'bad-request' }, { status: 400 });

  // Step 2 of the migration order: declarations before data. If the registry
  // does not validate, nothing migrates.
  try {
    assertRegistriesValid();
  } catch (e) {
    return NextResponse.json({ error: 'declarations-invalid', detail: e instanceof Error ? e.message : '' }, { status: 500 });
  }

  const raw = await readState();
  if (!raw) return NextResponse.json({ error: 'no-state' }, { status: 409 });
  const state = normalizeState(raw);

  const client = state.clients.find(c => c.id === profileId);
  if (!client) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  const data = state.clientData[profileId];
  if (!data) return NextResponse.json({ error: 'no-profile-data' }, { status: 404 });

  if (data.body && !force) {
    return NextResponse.json({
      error: 'already-migrated',
      detail: `This profile already has a body (version ${data.body.body_version}). Migrating twice would double every entry. Pass force only if you know the first run was thrown away.`,
    }, { status: 409 });
  }

  const { body, report, suggestedSwitches } = migrateProfile(client, data, {
    observations: state.observations,
  });

  const stats = bodyStats(body);
  if (stats.undeclared.length) {
    return NextResponse.json({ error: 'undeclared-paths', detail: stats.undeclared }, { status: 500 });
  }

  if (!apply) {
    return NextResponse.json({ applied: false, report, text: reportToText(report) });
  }

  // The body is written ALONGSIDE the legacy slices — nothing is deleted, and
  // the screens keep rendering exactly what they render today. Switches are
  // stored as SUGGESTIONS, separate from her positions (§9.6).
  const next = {
    ...state,
    clients: state.clients.map(c => c.id === profileId ? { ...c, suggestedSwitches } : c),
    clientData: { ...state.clientData, [profileId]: { ...data, body } },
  };
  const scopes = changedScopes(state, next);
  // CAS (2026-08-09): the migration's slices land on a fresh base, and cannot
  // erase anything that arrived while the report was being built.
  await writeStateScoped(next, scopes);

  return NextResponse.json({ applied: true, report, text: reportToText(report), scopes: scopes.length });
}
