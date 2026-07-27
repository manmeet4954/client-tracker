import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authConfigured, verifyToken, SESSION_COOKIE } from '@/lib/auth';
import { readState } from '@/lib/supabaseServer';
import { switchConfigFromBody } from '@/lib/strategy/derivation';
import { effectiveState } from '@/lib/tree/switches';
import type { ObservationWindow } from '@/lib/tree/objects';
import {
  buildAnalysisContext, readProfileFacts, readSnapshot, type AnalysisContext,
} from '@/lib/analysis/read';
import { coverageFor, monthBounds, monthOf, stickFor, SUGGESTED_VALUES } from '@/lib/analysis/compute';
import { dimensionsFor, slice } from '@/lib/analysis/bifurcate';
import { scorecard } from '@/lib/analysis/scorecard';
import { funnel } from '@/lib/analysis/funnel';
import { goals } from '@/lib/analysis/goals';
import {
  buildComparison, plannedPieceIds, plannedStatus, readComparisons, resolve, selectablePieces,
} from '@/lib/analysis/compare';
import { latestVerdict, readVerdicts } from '@/lib/analysis/verdict';
import { computedWords } from '@/lib/analysis/words';
import { monthToDate, nowView, readDigests } from '@/lib/analysis/digest';
import { supabaseAnalysisStore } from './store';

/**
 * The owner read endpoint for every surface — spec 27 §21.
 *
 * One endpoint, because there is one computation layer (§4): no screen queries
 * Supabase, and no screen implements its own idea of what "typical" means. A tab
 * whose switch is not `active` is NOT RENDERED, so this route answers `hidden`
 * rather than returning data a screen would then have to hide.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function currentRole() {
  if (!authConfigured()) return 'owner';
  return verifyToken(cookies().get(SESSION_COOKIE)?.value);
}

/** The eight tabs and the switch each one asks about (§5). */
const TAB_SWITCH: Record<string, string> = {
  now: 'analysis.always_live',
  slices: 'analysis.bifurcation',
  scorecard: 'analysis.scorecard',
  funnel: 'analysis.funnel',
  compare: 'analysis.compare',
  goals: 'analysis.goal_tracking',
  verdicts: 'analysis.verdicts',
  health: 'analysis.sync_health',
};

export async function GET(req: Request) {
  if (currentRole() !== 'owner') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const clientId = url.searchParams.get('clientId') ?? '';
  const tab = url.searchParams.get('tab') ?? 'now';
  const dimension = url.searchParams.get('dimension') ?? 'hook_type';
  const cross = url.searchParams.get('cross') ?? undefined;
  const metricId = url.searchParams.get('metric') ?? '';
  const window = (url.searchParams.get('window') ?? '7d') as ObservationWindow;
  const month = url.searchParams.get('month') ?? '';
  const pieceIds = (url.searchParams.get('pieces') ?? '').split(',').filter(Boolean);

  const state = await readState();
  const body = state?.clientData?.[clientId]?.body;
  if (!body) {
    return NextResponse.json({
      error: 'not-migrated',
      detail: 'This profile has not moved into the tree yet, so the analysis app has nothing to read.',
    }, { status: 409 });
  }

  const config = switchConfigFromBody(body);
  const now = new Date().toISOString();
  const facts = readProfileFacts(body, config, clientId);

  // The tabs, with the ones that are not `active` marked so the shell does not
  // render them at all (PLAN §2 item 2).
  const tabs = Object.entries(TAB_SWITCH).map(([id, switchId]) => ({
    id, switch: switchId, state: effectiveState(switchId, config),
  }));

  const period = month
    ? monthBounds(month)
    : tab === 'now' ? monthToDate(now) : monthBounds(monthOf(now));

  let snapshot;
  try {
    snapshot = await readSnapshot(supabaseAnalysisStore(), clientId, period);
  } catch (e) {
    return NextResponse.json({
      error: 'store-unavailable',
      detail: e instanceof Error ? e.message : 'The tracking store could not be read.',
      tabs,
    }, { status: 503 });
  }

  const ctx = buildAnalysisContext({ facts, snapshot, period, now });
  const metric = metricFor(ctx, metricId, window);

  const payload: Record<string, unknown> = {
    profile_id: clientId,
    tabs,
    period,
    metric,
    // Coverage travels with EVERY answer, so no screen can render performance
    // without it (§4.4).
    coverage: coverageFor(ctx.gaps, period.from, period.to),
    suggested_values: SUGGESTED_VALUES,
  };

  switch (tab) {
    case 'now':
      payload.now = nowView(ctx, metric, latestVerdict(body));
      break;
    case 'slices':
      payload.dimensions = dimensionsFor(ctx);
      payload.slice = slice(ctx, { dimension, metric, cross });
      break;
    case 'scorecard':
      payload.cards = scorecard(ctx, { planned_comparison_piece_ids: plannedPieceIds(body) });
      break;
    case 'funnel':
      payload.funnel = funnel(ctx);
      break;
    case 'compare': {
      payload.selectable = selectablePieces(ctx).map(p => ({
        piece_id: p.piece.id, title: p.piece.title, published: p.published_day,
        costume: p.piece.birth?.costume ?? null,
      }));
      payload.saved = readComparisons(body).map(c => ({
        ...c, planned_status: c.planned ? plannedStatus(ctx, c) : undefined,
      }));
      if (pieceIds.length >= 2) {
        const built = buildComparison(ctx, {
          id: `cmp-preview-${pieceIds.join('-')}`, piece_ids: pieceIds,
          metric_id: metric.metric_id, window, now,
        });
        payload.preview = resolve(ctx, built, metric.metric_id);
      }
      break;
    }
    case 'goals':
      payload.goals = goals(ctx);
      break;
    case 'verdicts': {
      const verdicts = readVerdicts(body);
      payload.verdicts = verdicts.map(v => ({
        ...v,
        // With the wording off, keyless or withheld, the screen still has real
        // words — written by code, with no model involved (§12.5).
        rendered_words: v.words ?? computedWords(v),
        words_are_computed: !v.words,
      }));
      payload.digests = readDigests(body);
      break;
    }
    case 'health':
      payload.health = {
        channels: snapshot.channels,
        runs: snapshot.runs.slice(0, 50),
        gaps: ctx.gaps,
        update_now_note:
          'This fetches today’s totals. It cannot recover the days we missed.',
      };
      break;
    default:
      return NextResponse.json({ error: 'unknown-tab', tabs }, { status: 400 });
  }

  return NextResponse.json(payload);
}

/**
 * Which metric a surface reads by default: the first switched-on pillar's own
 * declaration, so even the default measuring stick comes from her strategy
 * rather than from a constant in this file (§7.1).
 */
function metricFor(ctx: AnalysisContext, metricId: string, window: ObservationWindow) {
  if (metricId) return { metric_id: metricId, window, denominator: null };
  for (const p of ctx.facts.pillars) {
    const stick = stickFor(p.declaration, ctx.facts.platforms);
    if (stick.metric) return stick.metric;
  }
  return { metric_id: 'views', window, denominator: null };
}
