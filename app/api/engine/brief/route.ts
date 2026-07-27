import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authConfigured, verifyToken, SESSION_COOKIE } from '@/lib/auth';
import { readState } from '@/lib/supabaseServer';
import { briefAvailability, briefSubject, runBrief } from '@/lib/engine/brief';
import { sdkCaller } from '@/lib/engine/sdkCaller';
import { switchConfigFromBody, strategyLocked, readGateSet } from '@/lib/strategy/derivation';
import { effectiveState } from '@/lib/tree/switches';

/**
 * The internal brief (spec 24 §6). SHE triggers it, one press at a time or one
 * confirmed batch, and nothing runs behind her (PLAN §5.1 refinement 4).
 *
 * The packet is assembled SERVER SIDE from the authoritative state, so a forged
 * payload cannot smuggle another profile's context into the call. What comes
 * back is the brief and the run record; the browser writes both through the one
 * path-scoped write door, exactly like every other save.
 *
 * Owner only. Without a key the costume surface still resolves pieces and
 * "Write it myself" still works — nothing here ever fabricates a brief.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function currentRole() {
  if (!authConfigured()) return 'owner';
  return verifyToken(cookies().get(SESSION_COOKIE)?.value);
}

interface BriefRequest {
  clientId: string;
  pieceId: string;
  runId: string;
  packetId: string;
}

export async function POST(req: Request) {
  if (currentRole() !== 'owner') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as BriefRequest | null;
  if (!body?.clientId || !body?.pieceId) {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const state = await readState();
  const profileBody = state?.clientData?.[body.clientId]?.body;
  if (!profileBody) return NextResponse.json({ error: 'not-migrated' }, { status: 409 });

  const config = switchConfigFromBody(profileBody);
  const lifecycle = state?.clients?.find(c => c.id === body.clientId)?.lifecycle ?? 'active';
  const availability = briefAvailability({
    hasApiKey: !!apiKey,
    briefSwitchActive: effectiveState('creation.brief', config) === 'active',
    strategyLocked: strategyLocked(profileBody),
    gateSetLocked: !!readGateSet(profileBody),
    lifecycle,
  });
  if (!availability.available) {
    // No run is logged: nothing ran (acceptance test 11).
    return NextResponse.json({ error: 'unavailable', detail: availability.reason }, { status: 409 });
  }

  let subject;
  try {
    subject = briefSubject(profileBody, body.pieceId);
  } catch (e) {
    return NextResponse.json({
      error: 'no-subject',
      detail: e instanceof Error ? e.message : 'That piece cannot be briefed.',
    }, { status: 409 });
  }

  const now = new Date().toISOString();
  const result = await runBrief({
    profile_id: body.clientId,
    body: profileBody,
    config,
    piece_id: body.pieceId,
    seed: subject.seed,
    costume: subject.costume,
    rule: subject.rule,
    run_id: body.runId,
    packet_id: body.packetId,
    now,
  }, sdkCaller(apiKey!));

  return NextResponse.json({
    outcome: result.outcome,
    message: result.message,
    run: result.run,
    brief: result.brief,
    badges: result.badges,
    trimmed: result.packet.trimmed,
    rule: {
      rule_id: subject.rule.rule?.id ?? null,
      version: subject.rule.rule?.version ?? 0,
      overridden_fields: subject.rule.overridden_fields,
    },
  });
}
