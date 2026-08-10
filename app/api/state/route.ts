import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authConfigured, verifyToken, signRole, SESSION_COOKIE, cookieOptionsForRole } from '@/lib/auth';
import { readState, writeState } from '@/lib/supabaseServer';
import {
  filterStateForRole, mergeRoleWrite, normalizeState, emptyState, windowsForRole, type Role,
} from '@/lib/access';
import { applyScopes, checkScopes } from '@/lib/tree/scopes';
import { refusedCreationWrites, refusedLegacyCreationWrites } from '@/lib/strategy/derivation';
import { refusedPieceWrites } from '@/lib/engine/seeds';
import { refusedProposalWrites } from '@/lib/engine/proposals';
import { refusedCaptureWrites } from '@/lib/engine/captures';
import { refusedCostumeWrites } from '@/lib/engine/resolve';
import { refusedMaterialWrites } from '@/lib/engine/materials';
import { refusedDraftWrites } from '@/lib/engine/drafts';
import { refusedGateRunWrites, refusedStageWrites } from '@/lib/engine/gates';
import { refusedRecommendationWrites } from '@/lib/engine/recommendations';
import { refusedEvidenceWrites } from '@/lib/analysis/verdict';
import type { AppState } from '@/types';

/**
 * The strategy lock's effect on writing, asked at the write door.
 *
 * Her decision, 2026-08-09: recording what is happening always works, locked or
 * not, so this now refuses nothing. Generation is what needs a strategy, and it
 * is gated where it is made rather than here. The full reasoning, and why the
 * call is kept rather than deleted, is in lib/strategy/derivation.ts §8.7.
 */
function creationRefusals(current: AppState, incoming: AppState): { profileId: string; paths: string[] }[] {
  const out: { profileId: string; paths: string[] }[] = [];
  for (const id of Object.keys(incoming.clientData ?? {})) {
    const paths = refusedCreationWrites(current.clientData?.[id]?.body, incoming.clientData[id]?.body);
    if (paths.length) out.push({ profileId: id, paths });
  }
  return out;
}

/** The same question for the legacy slices the board renders from, and the same
 *  answer: nothing is refused. See lib/strategy/derivation.ts §8.7. */
function legacyCreationRefusals(current: AppState, incoming: AppState): { profileId: string; reasons: string[] }[] {
  const out: { profileId: string; reasons: string[] }[] = [];
  for (const id of Object.keys(incoming.clientData ?? {})) {
    const refusals = refusedLegacyCreationWrites(current.clientData?.[id], incoming.clientData[id]);
    if (refusals.length) out.push({ profileId: id, reasons: refusals.map(r => r.why) });
  }
  return out;
}

/**
 * Spec 23's three data-layer guards, at the same door and for the same reason:
 *  §9.1 only a LOCKED seed may mother a piece (S1),
 *  §8.2 a waiting proposal is untouchable until she picks it up (PLAN §5.2),
 *  §4.1 a capture is kept exactly as given, forever (PLAN §5.1).
 *
 * Plus spec 24's two, at the same door and for the same reason:
 *  §5.2 one value per dimension, and the birth record is never rewritten (S4, S15),
 *  §9.1 a restricted asset is refused at attachment (S21).
 *
 * And spec 25's four:
 *  §3.3 a draft version is never rewritten — an edit is the next version,
 *  §6.2 nothing leaves build until all seven gates pass,
 *  §7.3 nothing schedules or posts while a required right is missing (S21),
 *  §6.7 a gate run is never rewritten, and the rights baseline is forward only.
 *
 * They live here rather than in a screen so no later spec can route around them.
 */
function engineRefusals(current: AppState, incoming: AppState): { profileId: string; reasons: string[] }[] {
  const out: { profileId: string; reasons: string[] }[] = [];
  const now = new Date().toISOString();
  for (const id of Object.keys(incoming.clientData ?? {})) {
    const before = current.clientData?.[id]?.body;
    const after = incoming.clientData[id]?.body;
    const reasons = [
      ...refusedPieceWrites(before, after).map(r => `piece ${r.piece_id}: ${r.reason}`),
      ...refusedProposalWrites(before, after).map(r => `proposal ${r.proposal_id}: ${r.reason}`),
      ...refusedCaptureWrites(before, after).map(r => `capture ${r.capture_id}: ${r.reason}`),
      ...refusedCostumeWrites(before, after).map(r => `piece ${r.piece_id}: ${r.reason}`),
      ...refusedMaterialWrites(before, after).map(r => `piece ${r.piece_id}: ${r.reason}`),
      ...refusedDraftWrites(before, after).map(r => `draft ${r.draft_id}: ${r.reason}`),
      ...refusedStageWrites(before, after, now).map(r => `piece ${r.piece_id}: ${r.reason}`),
      ...refusedGateRunWrites(before, after).map(r => `piece ${r.piece_id}: ${r.reason}`),
      ...refusedRecommendationWrites(before, after).map(r => `recommendation ${r.recommendation_id}: ${r.reason}`),
      // And spec 27's one, at the same door and for the same reason:
      //  §15.1 / §15.3 every suggestion cites its evidence — a revisit proposal
      //  or a proposed strategy change arriving with no cited verdict is refused,
      //  not warned (PLAN §5.2's honesty rule made structural).
      ...refusedEvidenceWrites(before, after).map(r => `${r.id}: ${r.reason}`),
    ];
    if (reasons.length) out.push({ profileId: id, reasons });
  }
  return out;
}

export const dynamic = 'force-dynamic';

function currentRole(): Role | null {
  if (!authConfigured()) return 'owner'; // open mode
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifyToken(token);
}

// GET → returns the caller's role + the slice of state they're allowed to see.
export async function GET() {
  const role = currentRole();
  if (!role) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const raw = await readState();
  const state = !raw
    ? (role === 'owner' ? null : emptyState()) // no saved row yet
    : filterStateForRole(raw, role);

  // Spec 28 §15.2: the client's navigation, computed here from the AUTHORITATIVE
  // state — doors + switches + lifecycle — and asserted server side. It grants
  // nothing: every window it names reads paths the filter above already let
  // through, and a window whose door is shut is simply not in the list.
  const windows = raw && role !== 'owner' ? windowsForRole(raw, role) : {};

  const res = NextResponse.json({ role, state, windows });
  // Refresh the cookie on each visit (keeps persistent roles persistent).
  if (authConfigured()) res.cookies.set(SESSION_COOKIE, signRole(role), cookieOptionsForRole(role));
  return res;
}

// POST { state, paths } → a PATH-SCOPED write (spec 21 §3.4).
//
// The old door replaced the whole blob, so two overlapping saves clobbered each
// other — last write won on everything (CLAUDE.md gotcha 2). Now a save DECLARES
// the paths it touched and only those paths merge onto the authoritative state;
// everything else comes from what is stored. An undeclared path is refused
// outright (law 4).
//
// `paths` MISSING IS REFUSED (2026-08-01). It used to fall back to the old
// whole-blob behavior "rather than lose her work mid-deploy", and that fallback
// is what ate two of her previews the day after the shell shipped: a tab still
// open from before the deploy runs the old bundle, auto-saves its stale snapshot
// with no paths, and the server dutifully replaces everything newer with it.
// A stale tab reloading loses nothing; a stale tab SAVING loses everything since
// it loaded. So the door now says no, and says why, and the tab reloads itself.
export async function POST(req: Request) {
  const role = currentRole();
  if (!role) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const incoming = body?.state;
  const paths: string[] | undefined = Array.isArray(body?.paths) ? body.paths : undefined;
  if (!incoming) return NextResponse.json({ error: 'bad-request' }, { status: 400 });

  if (!paths) {
    return NextResponse.json({
      error: 'stale-tab',
      detail: 'This tab is running an old version of the dashboard. Reload the page and your next save will land.',
    }, { status: 409 });
  }

  const rejected = checkScopes(paths);
  if (rejected.length) {
    return NextResponse.json({ error: 'undeclared-path', rejected }, { status: 400 });
  }

  try {
    const current = await readState();

    if (!current) {
      // Nothing stored yet: there is nothing to merge against.
      if (role !== 'owner') return NextResponse.json({ error: 'no-state' }, { status: 409 });
      await writeState(normalizeState(incoming));
      return NextResponse.json({ ok: true, scoped: false });
    }

    const base = normalizeState(current);
    // Role filtering first, always — a restricted role's write can only reach
    // its own bound profiles (CLAUDE.md rule 2), and only then is it narrowed
    // to the paths this save declared.
    const merged = role === 'owner' ? normalizeState(incoming) : mergeRoleWrite(base, incoming, role);
    const next = applyScopes(base, merged, paths);

    const refused = creationRefusals(base, next);
    if (refused.length) {
      return NextResponse.json({
        error: 'creation-locked',
        detail: 'Strategy has not locked on this profile yet, so nothing can be written into creation.',
        refused,
      }, { status: 409 });
    }

    const legacyRefused = legacyCreationRefusals(base, next);
    if (legacyRefused.length) {
      return NextResponse.json({
        error: 'creation-locked',
        detail: 'Strategy has not locked on this profile yet, so nothing can be written into creation.',
        refused: legacyRefused,
      }, { status: 409 });
    }

    const engineRefused = engineRefusals(base, next);
    if (engineRefused.length) {
      return NextResponse.json({
        error: 'engine-guard',
        detail: engineRefused[0].reasons[0],
        refused: engineRefused,
      }, { status: 409 });
    }

    // ── 2026-08-09 diagnostic: a preview died twice in front of a client and
    // every layer swore it was fine. Until that is understood, any save that
    // declares a review scope logs what actually happened to the previews,
    // in one line vercel logs can show. Counts and ids only, never content.
    for (const key of paths) {
      if (!key.includes('work-log/creation/review')) continue;
      const pid = key.split(':')[0];
      const before = (base.clientData?.[pid]?.previewPosts ?? []).length;
      const inc = (incoming?.clientData?.[pid]?.previewPosts ?? []).length;
      const after = (next.clientData?.[pid]?.previewPosts ?? []).length;
      console.log(`[preview-save] role=${role} profile=${pid} stored_before=${before} incoming=${inc} stored_after=${after} paths=${paths.length}`);
    }

    await writeState(next);
    return NextResponse.json({ ok: true, scoped: !!paths });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'write failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
