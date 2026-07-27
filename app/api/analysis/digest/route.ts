import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authConfigured, verifyToken, SESSION_COOKIE } from '@/lib/auth';
import { readState, writeState } from '@/lib/supabaseServer';
import { switchConfigFromBody } from '@/lib/strategy/derivation';
import { effectiveState } from '@/lib/tree/switches';
import type { AppState } from '@/types';
import { EMPTY_USAGE, writeRun } from '@/lib/engine/runs';
import { buildAnalysisContext, readProfileFacts, readSnapshot } from '@/lib/analysis/read';
import { monthBounds, monthOf, stickFor } from '@/lib/analysis/compute';
import { latestVerdict } from '@/lib/analysis/verdict';
import {
  approvePublication, draftPublication, monthlyDigest, readDigests, weeklyPulse, writeDigest,
} from '@/lib/analysis/digest';
import { supabaseAnalysisStore } from '../store';

/**
 * The digest — spec 27 §13. Cron (monthly on the 1st, weekly on Monday) or
 * owner-triggered, plus the two owner actions the publication gate needs:
 * DRAFT a client publication, and APPROVE one.
 *
 * Nothing publishes on a timer. `approve` is the only thing in this system that
 * ever sets `published: true`, and it is a deliberate act with a date and her
 * name on it (§14).
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

type Kind = 'monthly' | 'weekly-pulse' | 'draft-publication' | 'approve-publication';

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const kind = (url.searchParams.get('kind') ?? 'monthly') as Kind;
  const only = url.searchParams.get('clientId');
  const digestId = url.searchParams.get('digestId') ?? '';
  const now = new Date().toISOString();

  const state = await readState();
  if (!state) return NextResponse.json({ error: 'no-state' }, { status: 409 });

  // Approval is her act on one entry, and it needs none of the machinery below.
  if (kind === 'approve-publication') {
    if (!isOwner()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (!only || !digestId) return NextResponse.json({ error: 'bad-request' }, { status: 400 });
    const body = state.clientData?.[only]?.body;
    if (!body) return NextResponse.json({ error: 'not-migrated' }, { status: 409 });
    const draft = readDigests(body, 'client-publication').find(d => d.id === digestId);
    if (!draft) return NextResponse.json({ error: 'no-draft' }, { status: 404 });

    const edits = await req.json().catch(() => null) as { sections?: typeof draft.sections } | null;
    const approved = approvePublication(draft, 'owner', now, edits?.sections);
    // The path is append-only, so approval arrives as an AMENDMENT: the draft
    // stays byte-identical underneath it, which is the whole point (S13, §14).
    const path = 'work-log/analysis/digests';
    const next: AppState = {
      ...state,
      clientData: {
        ...state.clientData,
        [only]: {
          ...state.clientData[only],
          body: {
            ...body,
            paths: {
              ...body.paths,
              [path]: body.paths[path].map(e => (e.id === digestId
                ? {
                  ...e,
                  amendments: [...(e.amendments ?? []), {
                    at: now, by: 'owner', note: 'Approved for the client.',
                    changed: {
                      published: true, approved_by: approved.approved_by,
                      approved_at: approved.approved_at, sections: approved.sections,
                    },
                  }],
                  updated_at: now,
                }
                : e)),
            },
          },
        },
      },
    };
    await writeState(next);
    return NextResponse.json({ ok: true, published: digestId, approved_at: now });
  }

  let next: AppState = state;
  const ran: { profile_id: string; digest_id: string; kind: string }[] = [];
  const skipped: { profile_id: string; why: string }[] = [];

  for (const profileId of Object.keys(state.clientData ?? {})) {
    if (only && profileId !== only) continue;
    const body = next.clientData[profileId]?.body;
    if (!body) { skipped.push({ profile_id: profileId, why: 'not migrated into the tree yet' }); continue; }

    const config = switchConfigFromBody(body);
    const gate = kind === 'weekly-pulse' ? 'analysis.pulse_owner'
      : kind === 'draft-publication' ? 'analysis.client_publication'
        : 'analysis.digest_owner';
    if (effectiveState(gate, config) !== 'active') {
      skipped.push({ profile_id: profileId, why: `${gate} is not active for this profile` });
      continue;
    }

    const period = kind === 'weekly-pulse'
      ? { from: dayOffset(now, -7), to: now.slice(0, 10) }
      // The month that just ended, in the profile's own month boundary.
      : monthBounds(monthOf(dayOffset(now, -1)));

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

    const runId = `drun-${profileId}-${kind}-${now.slice(0, 10)}`;
    const id = `digest-${profileId}-${kind}-${now.slice(0, 10)}`;
    const verdict = latestVerdict(body);
    const digest = kind === 'weekly-pulse'
      ? weeklyPulse({ ctx, id, run_id: runId, metric, now })
      : kind === 'draft-publication'
        ? draftPublication({
          ctx, id, run_id: runId, now, verdict,
          from_digest: readDigests(body, 'monthly')[0] ?? null,
          supersedes: readDigests(body, 'client-publication').find(d => d.published)?.id,
        })
        : monthlyDigest({ ctx, id, run_id: runId, metric, now, verdict });

    let profileBody = writeDigest(next.clientData[profileId].body!, digest);
    profileBody = writeRun(profileBody, {
      id: runId, kind: 'analysis_digest', profile_id: profileId, triggered_by: 'owner',
      packet: {
        packet_id: `dpacket-${runId}`, context_version: body.context_version ?? 0,
        folders: ['work-log/analysis/digests'], mandatory_constraints: [], trimmed: [],
      },
      model: null, effort: 'none', thinking: 'none',
      schema_version: 1, prompt_version: 1, capture_ids: [], proposal_ids: [],
      usage: { ...EMPTY_USAGE }, cost_estimate_usd: 0, latency_ms: 0,
      stop_reason: 'computed', checks: { rejected: 0, badged: [] },
      started_at: now, finished_at: new Date().toISOString(),
    }, 'engine:analysis');

    next = {
      ...next,
      clientData: {
        ...next.clientData,
        [profileId]: { ...next.clientData[profileId], body: profileBody },
      },
    };
    ran.push({ profile_id: profileId, digest_id: id, kind });
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
