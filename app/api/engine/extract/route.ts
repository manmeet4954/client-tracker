import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authConfigured, verifyToken, SESSION_COOKIE } from '@/lib/auth';
import { readState } from '@/lib/supabaseServer';
import { runExtraction, extractionAvailability } from '@/lib/engine/extraction';
import { sdkCaller } from '@/lib/engine/sdkCaller';
import { switchConfigFromBody, strategyLocked } from '@/lib/strategy/derivation';
import { effectiveState } from '@/lib/tree/switches';

/**
 * Seed extraction (spec 23 §5). SHE triggers it, the engine proposes, she picks
 * (PLAN §5.1 refinement 4). Nothing extracts behind her back — not on paste, not
 * on a timer, not when a client message arrives, not ever.
 *
 * The packet is assembled SERVER SIDE from the authoritative state, so a forged
 * payload cannot smuggle another profile's context into the call. What comes
 * back is the proposals and the run record; the browser writes both through the
 * one path-scoped write door, exactly like every other save.
 *
 * Owner only. Without a key the room still opens and the bank still works —
 * nothing here ever fabricates a proposal.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function currentRole() {
  if (!authConfigured()) return 'owner';
  return verifyToken(cookies().get(SESSION_COOKIE)?.value);
}

interface ExtractRequest {
  clientId: string;
  captureId: string;
  captureText: string;
  seedId?: string;
  runId: string;
  packetId: string;
}

export async function POST(req: Request) {
  if (currentRole() !== 'owner') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as ExtractRequest | null;
  if (!body?.clientId || !body?.captureText) {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const state = await readState();
  const profile = state?.clientData?.[body.clientId];
  const profileBody = profile?.body;
  if (!profileBody) return NextResponse.json({ error: 'not-migrated' }, { status: 409 });

  const config = switchConfigFromBody(profileBody);
  const lifecycle = state?.clients?.find(c => c.id === body.clientId)?.lifecycle ?? 'active';
  const availability = extractionAvailability({
    hasApiKey: !!apiKey,
    extractionSwitchActive: effectiveState('creation.seed_extraction', config) === 'active',
    strategyLocked: strategyLocked(profileBody),
    lifecycle,
  });
  if (!availability.available) {
    // No run is logged: nothing ran (acceptance test 10).
    return NextResponse.json({ error: 'unavailable', detail: availability.reason }, { status: 409 });
  }

  const now = new Date().toISOString();
  const result = await runExtraction({
    profile_id: body.clientId,
    body: profileBody,
    config,
    capture: { id: body.captureId, text: body.captureText, seed_id: body.seedId },
    run_id: body.runId,
    packet_id: body.packetId,
    now,
  }, sdkCaller(apiKey!));

  return NextResponse.json({
    outcome: result.outcome,
    message: result.message,
    run: result.run,
    proposals: result.checked.shown,
    rejected: result.checked.rejected.length,
    trimmed: result.packet.trimmed,
  });
}
