import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authConfigured, verifyToken, SESSION_COOKIE } from '@/lib/auth';
import { readState, writeState } from '@/lib/supabaseServer';
import { switchConfigFromBody } from '@/lib/strategy/derivation';
import { effectiveState } from '@/lib/tree/switches';
import type { AppState } from '@/types';
import type { Verdict, VerdictCycle } from '@/lib/tree/objects';
import { estimateCostUsd, writeRun } from '@/lib/engine/runs';
import { sdkCaller } from '@/lib/engine/sdkCaller';
import { buildAnalysisContext, readProfileFacts, readSnapshot } from '@/lib/analysis/read';
import { stickFor } from '@/lib/analysis/compute';
import {
  computeVerdict, cyclesDue, readVerdicts, recommendationsFrom, writeRecommendations, writeVerdict,
} from '@/lib/analysis/verdict';
import { vocabularyFor, wordVerdict } from '@/lib/analysis/words';
import { supabaseAnalysisStore } from '../store';

/**
 * The verdict cycle — spec 27 §11. Cron (monthly and quarterly) or owner-triggered.
 *
 * The order is the spec's and it is not negotiable: the whole input is COMPUTED
 * AND STORED first, and only then is a model asked for words. With no key, with
 * the wording switched off, or with the guards rejecting twice, the verdict is
 * still a real verdict — it simply carries no paragraph, and says so (§12.5).
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function isOwner(): boolean {
  if (!authConfigured()) return true;
  return verifyToken(cookies().get(SESSION_COOKIE)?.value) === 'owner';
}

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  if (secret && url.searchParams.get('secret') === secret) return true;
  if (req.headers.get('authorization') === `Bearer ${secret}`) return true;
  return isOwner();
}

interface RunOne {
  profile_id: string;
  cycle: VerdictCycle;
  verdict_id: string;
  state: Verdict['state'];
  message: string;
  cost_estimate_usd: number;
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const only = url.searchParams.get('clientId');
  const forced = url.searchParams.get('cycle') as VerdictCycle | null;
  const now = new Date().toISOString();
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();

  const state = await readState();
  if (!state) return NextResponse.json({ error: 'no-state' }, { status: 409 });

  let next: AppState = state;
  const ran: RunOne[] = [];
  const skipped: { profile_id: string; why: string }[] = [];

  for (const profileId of Object.keys(state.clientData ?? {})) {
    if (only && profileId !== only) continue;
    const body = next.clientData[profileId]?.body;
    if (!body) { skipped.push({ profile_id: profileId, why: 'not migrated into the tree yet' }); continue; }

    const config = switchConfigFromBody(body);
    if (effectiveState('analysis.verdicts', config) !== 'active') {
      skipped.push({ profile_id: profileId, why: 'verdicts are not switched on for this profile' });
      continue;
    }

    const due = forced
      ? [{ cycle: forced, period_start: '', period_end: '' }]
      : cyclesDue(now, readVerdicts(body).map(v => ({ cycle: v.cycle, created_at: v.created_at })),
        readVerdicts(body).map(v => v.created_at).sort()[0]);
    if (!due.length) { skipped.push({ profile_id: profileId, why: 'nothing due today' }); continue; }

    for (const cycle of due) {
      const period = cycle.period_start
        ? { from: cycle.period_start, to: cycle.period_end }
        : { from: dayOffset(now, cycle.cycle === 'quarter' ? -90 : -30), to: now.slice(0, 10) };

      const facts = readProfileFacts(body, config, profileId);
      let snapshot;
      try {
        snapshot = await readSnapshot(supabaseAnalysisStore(), profileId, period);
      } catch (e) {
        skipped.push({ profile_id: profileId, why: e instanceof Error ? e.message : 'store unavailable' });
        continue;
      }
      const ctx = buildAnalysisContext({ facts, snapshot, period, now });
      const metric = facts.pillars
        .map(p => stickFor(p.declaration, facts.platforms).metric)
        .find(Boolean) ?? { metric_id: 'views', window: '7d' as const, denominator: null };

      const runId = `vrun-${profileId}-${cycle.cycle}-${now.slice(0, 10)}`;
      const computed = computeVerdict({
        ctx, cycle: cycle.cycle, metric,
        id: `verdict-${profileId}-${cycle.cycle}-${now.slice(0, 10)}`,
        run_id: runId, now, context_version: body.context_version ?? 0,
      });

      const worded = await wordVerdict({
        verdict: computed,
        vocabulary: vocabularyFor(ctx),
        words_switch_active: effectiveState('analysis.verdict_words', config) === 'active',
        has_api_key: !!apiKey,
      }, apiKey ? sdkCaller(apiKey) : null);

      let profileBody = writeVerdict(next.clientData[profileId].body!, worded.verdict);

      // §15.2: the recommendations are a projection of the sufficient patterns,
      // written through spec 25's own door and its own rules — evidence required.
      if (effectiveState('analysis.costume_recommendations', config) === 'active') {
        profileBody = writeRecommendations(
          profileBody, recommendationsFrom(worded.verdict, { now }));
      }

      // Every verdict run writes an engine_run entry (§11.4, S12).
      profileBody = writeRun(profileBody, {
        id: runId, kind: 'analysis_verdict', profile_id: profileId, triggered_by: 'owner',
        packet: {
          packet_id: `vpacket-${runId}`,
          context_version: worded.verdict.context_version,
          folders: ['work-log/analysis/verdicts', 'context/content-strategy'],
          mandatory_constraints: ['numbers computed by code', 'no causation', 'sufficiency respected'],
          trimmed: [],
        },
        model: worded.verdict.model,
        effort: worded.verdict.effort,
        thinking: 'adaptive',
        schema_version: 1, prompt_version: 1,
        capture_ids: [], proposal_ids: [],
        usage: worded.usage,
        cost_estimate_usd: estimateCostUsd(worded.usage),
        latency_ms: 0,
        stop_reason: worded.stop_reason,
        checks: { rejected: worded.verdict.guards.rejected, badged: [] },
        started_at: now, finished_at: new Date().toISOString(),
        error: worded.error,
      }, 'engine:analysis');

      next = {
        ...next,
        clientData: {
          ...next.clientData,
          [profileId]: { ...next.clientData[profileId], body: profileBody },
        },
      };

      ran.push({
        profile_id: profileId, cycle: cycle.cycle, verdict_id: worded.verdict.id,
        state: worded.verdict.state, message: worded.message,
        cost_estimate_usd: worded.cost_estimate_usd,
      });
    }
  }

  if (ran.length) await writeState(next);
  return NextResponse.json({ ran, skipped });
}

export async function GET(req: Request) {
  return POST(req);
}

function dayOffset(iso: string, days: number): string {
  return new Date(new Date(iso.slice(0, 10)).getTime() + days * 86400000).toISOString().slice(0, 10);
}
