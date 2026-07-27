import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authConfigured, verifyToken, SESSION_COOKIE } from '@/lib/auth';
import { readState } from '@/lib/supabaseServer';
import { briefSubject } from '@/lib/engine/brief';
import { resolveBrief } from '@/lib/engine/brief';
import { draftingAvailability, reviseNotesFrom, reviseState, runDraft } from '@/lib/engine/drafting';
import { formatFamilyOf } from '@/lib/engine/drafts';
import { failedGateRunCount, gatesOf, readGateRuns } from '@/lib/engine/gates';
import { tasteRulesForPacket } from '@/lib/engine/taste';
import { sdkCaller } from '@/lib/engine/sdkCaller';
import { switchConfigFromBody, strategyLocked, readGateSet } from '@/lib/strategy/derivation';
import { effectiveState } from '@/lib/tree/switches';
import { readPieces } from '@/lib/engine/resolve';

/**
 * The drafting call (spec 25 §4). SHE triggers it; nothing runs behind her
 * (PLAN §5.1 refinement 4).
 *
 * The packet is assembled SERVER SIDE from the authoritative state, so a forged
 * payload cannot smuggle another profile's context — or another profile's taste
 * evidence — into the call. What comes back is the draft payload and the run
 * record; the browser writes both through the one path-scoped write door.
 *
 * Owner only. Without a key, build state still opens and she writes the draft
 * herself: nothing here ever fabricates one.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

function currentRole() {
  if (!authConfigured()) return 'owner';
  return verifyToken(cookies().get(SESSION_COOKIE)?.value);
}

interface DraftRequest {
  clientId: string;
  pieceId: string;
  runId: string;
  packetId: string;
  /** Present on a revise: the gate run whose verdicts are being fixed. */
  gateRunId?: string;
  herNote?: string;
}

export async function POST(req: Request) {
  if (currentRole() !== 'owner') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as DraftRequest | null;
  if (!body?.clientId || !body?.pieceId) {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const state = await readState();
  const profileBody = state?.clientData?.[body.clientId]?.body;
  if (!profileBody) return NextResponse.json({ error: 'not-migrated' }, { status: 409 });

  const config = switchConfigFromBody(profileBody);
  const lifecycle = state?.clients?.find(c => c.id === body.clientId)?.lifecycle ?? 'active';
  const brief = resolveBrief(profileBody, body.pieceId);

  const availability = draftingAvailability({
    hasApiKey: !!apiKey,
    draftingSwitchActive: effectiveState('creation.drafting', config) === 'active',
    strategyLocked: strategyLocked(profileBody),
    gateSetLocked: !!readGateSet(profileBody),
    hasBrief: !!brief,
    lifecycle,
  });
  if (!availability.available) {
    // No run is logged: nothing ran (acceptance test 15).
    return NextResponse.json({ error: 'unavailable', detail: availability.reason }, { status: 409 });
  }

  let subject;
  try {
    subject = briefSubject(profileBody, body.pieceId);
  } catch (e) {
    return NextResponse.json({
      error: 'no-subject',
      detail: e instanceof Error ? e.message : 'That piece cannot be drafted.',
    }, { status: 409 });
  }

  // §4.10: two automatic revise attempts, then it stops. Attempt three is not
  // offered, and the screen says why.
  const failed = failedGateRunCount(profileBody, body.pieceId);
  const revise = reviseState(failed);
  if (!revise.offered) {
    return NextResponse.json({ error: 'revise-ceiling', detail: revise.message }, { status: 409 });
  }

  const lastRun = body.gateRunId
    ? readGateRuns(profileBody, body.pieceId).find(r => r.id === body.gateRunId)
    : undefined;

  const gateSet = readGateSet(profileBody)!;
  const posted = readPieces(profileBody)
    .filter(p => p.piece.stage === 'posted' && p.piece.seed_id === subject.piece.seed_id)
    .slice(0, 20)
    .map(p => ({ title: p.piece.title, hook: p.piece.hook ?? '' }));

  const now = new Date().toISOString();
  const result = await runDraft({
    profile_id: body.clientId,
    body: profileBody,
    config,
    piece_id: body.pieceId,
    seed: subject.seed,
    costume: subject.costume,
    rule: subject.rule,
    brief: {
      brief_version: brief!.brief_version,
      one_point: brief!.one_point,
      tension: brief!.tension,
      realization: brief!.realization,
      takeaway: brief!.takeaway,
      product_role: brief!.product_role,
      tone: brief!.tone,
      ending: brief!.ending,
      leave_out: brief!.leave_out,
      hook: brief!.hook ?? subject.piece.hook,
    },
    family: formatFamilyOf(subject.costume.format, subject.costume.platform),
    gates: gatesOf(profileBody).gates,
    posted,
    // §9.3 rules 3 and 5: rule and strength only, and only where this profile
    // has consented. Evidence refs never leave the owner surface.
    taste_rules: tasteRulesForPacket(state!, {
      consent: effectiveState('creation.taste_rules', config) === 'active',
    }),
    gate_set_version: gateSet.version,
    strategy_version: profileBody.strategy_version ?? 0,
    run_id: body.runId,
    packet_id: body.packetId,
    now,
    revise_notes: lastRun ? reviseNotesFrom(lastRun, body.herNote) : undefined,
    attempt: revise.attempt,
  }, sdkCaller(apiKey!));

  return NextResponse.json({
    outcome: result.outcome,
    message: result.message,
    run: result.run,
    payload: result.payload,
    trimmed: result.packet.trimmed,
    attempt: revise.attempt,
  });
}
