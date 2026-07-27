import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authConfigured, verifyToken, SESSION_COOKIE } from '@/lib/auth';
import { readState } from '@/lib/supabaseServer';
import { briefSubject, resolveBrief } from '@/lib/engine/brief';
import { runGateRun } from '@/lib/engine/drafting';
import { formatFamilyOf, resolveDraft } from '@/lib/engine/drafts';
import { gatesOf, publicationDate, rightsVerdict } from '@/lib/engine/gates';
import { sdkCaller } from '@/lib/engine/sdkCaller';
import { switchConfigFromBody, readGateSet } from '@/lib/strategy/derivation';

/**
 * The gate run (spec 25 §6). A SEPARATE call from drafting, always: a model
 * grading its own output in the same turn is not a check.
 *
 * The machine checks run first. If a hard one fails, the model call is not made
 * at all — the draft is going back regardless. The run is still logged, with
 * `model: null` and the failing check named.
 *
 * With no key the machine checks still run and report, and the model-judged
 * gates come back `not-run`. Nothing fabricates a verdict, and the piece cannot
 * leave build (§15 test 15).
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

function currentRole() {
  if (!authConfigured()) return 'owner';
  return verifyToken(cookies().get(SESSION_COOKIE)?.value);
}

interface GateRequest {
  clientId: string;
  pieceId: string;
  runId: string;
  packetId: string;
  gateRunId: string;
  overrides?: Record<string, { by: string; at: string; reason: string }>;
  ownerVerified?: { by: string; at: string; reason: string; claim: string }[];
}

export async function POST(req: Request) {
  if (currentRole() !== 'owner') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as GateRequest | null;
  if (!body?.clientId || !body?.pieceId || !body?.gateRunId) {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const state = await readState();
  const profileBody = state?.clientData?.[body.clientId]?.body;
  if (!profileBody) return NextResponse.json({ error: 'not-migrated' }, { status: 409 });

  const gateSet = readGateSet(profileBody);
  if (!gateSet) {
    return NextResponse.json({
      error: 'no-gate-set',
      detail: 'This profile has no locked gate set, so there is no standard to judge against. Lock the gates first.',
    }, { status: 409 });
  }

  const draft = resolveDraft(profileBody, body.pieceId);
  if (!draft) {
    return NextResponse.json({
      error: 'no-draft',
      detail: 'There is no draft on this piece yet, so there is nothing to judge.',
    }, { status: 409 });
  }

  let subject;
  try {
    subject = briefSubject(profileBody, body.pieceId);
  } catch (e) {
    return NextResponse.json({
      error: 'no-subject',
      detail: e instanceof Error ? e.message : 'That piece cannot be gated.',
    }, { status: 409 });
  }

  const brief = resolveBrief(profileBody, body.pieceId);
  const now = new Date().toISOString();
  const config = switchConfigFromBody(profileBody);

  const result = await runGateRun({
    profile_id: body.clientId,
    body: profileBody,
    config,
    piece_id: body.pieceId,
    seed: subject.seed,
    costume: subject.costume,
    rule: subject.rule,
    brief: {
      brief_version: brief?.brief_version ?? draft.brief_version,
      one_point: brief?.one_point ?? '',
      tension: brief?.tension ?? '',
      realization: brief?.realization ?? '',
      takeaway: brief?.takeaway ?? '',
      product_role: brief?.product_role ?? null,
      tone: brief?.tone ?? '',
      ending: brief?.ending ?? '',
      leave_out: brief?.leave_out ?? [],
      hook: brief?.hook ?? subject.piece.hook,
    },
    family: formatFamilyOf(subject.costume.format, subject.costume.platform),
    gates: gatesOf(profileBody).gates,
    gate_set_version: gateSet.version,
    strategy_version: profileBody.strategy_version ?? 0,
    run_id: body.runId,
    packet_id: body.packetId,
    now,
    subject: {
      piece: subject.piece,
      draft,
      costume: subject.costume,
      rule: subject.rule,
      gate_set: gateSet,
      seed: subject.seed,
      her_hook: brief?.hook ?? subject.piece.hook,
    },
    gate_run_id: body.gateRunId,
    run_by: 'owner',
    overrides: body.overrides,
    owner_verified: body.ownerVerified,
    // The rights verdict rides along, judged against the day this actually
    // posts rather than today (§7.2). It never decides build → review (§7.3).
    rights: rightsVerdict(
      profileBody, subject.piece, publicationDate(profileBody, subject.piece, now), gateSet.version,
    ),
  }, apiKey ? sdkCaller(apiKey) : null);

  return NextResponse.json({
    gateRun: result.run,
    run: result.engine_run,
    checks: result.checks,
    message: result.message,
    trimmed: result.packet?.trimmed ?? [],
  });
}
