// The digest — spec 27 §13. Monthly, weekly pulse, always-live, and the
// client publication.
//
// All three cadences are PLAN §5.2's and spec 07's, already hers. They are
// carried, not re-decided.
//
// The always-live view is not a fourth thing: it is the SAME computation layer
// with `period = month to date`, which is why it costs nothing extra and cannot
// drift from the monthly digest. They are one calculation with two period
// arguments (§13.3).

import type { ProfileBody } from '../tree/body.ts';
import { putEntry, readPath } from '../tree/body.ts';
import type { BodyEntry, Digest, DigestKind, Verdict } from '../tree/objects.ts';
import type { AnalysisContext } from './read.ts';
import { piecesInPeriod } from './read.ts';
import type { MetricSpec } from './compute.ts';
import { PULSE_SCHEDULE, coverageFor, monthBounds, monthOf, percent } from './compute.ts';
import { scorecard, forClient as pillarsForClient, type PillarCard } from './scorecard.ts';
import { goals as goalCards, forClient as goalsForClient } from './goals.ts';
import { funnel } from './funnel.ts';
import { computePatterns } from './verdict.ts';

export const DIGEST_PATH = 'work-log/analysis/digests';

export class DigestRefused extends Error {}

export interface DigestSection {
  id: string;
  heading: string;
  lines: string[];
}

// ── §13.1 The monthly digest, per profile, right after month-end ─────────────

export interface MonthlyInput {
  ctx: AnalysisContext;
  id: string;
  run_id: string;
  metric: MetricSpec;
  now: string;
  verdict?: Verdict | null;
}

/**
 * Contents, in the order §13.1 fixes: coverage, what outperformed, which pillar
 * is earning BY ITS JOB, which combinations are winning, what the funnel says,
 * ONE concrete suggestion, and what cannot be said yet with what is owed.
 *
 * Numbers are code-computed; the words a model adds sit on top and pass §12's
 * guards first.
 */
export function monthlyDigest(input: MonthlyInput): Digest {
  const { ctx } = input;
  const coverage = coverageFor(ctx.gaps, ctx.period.from, ctx.period.to);
  const cards = scorecard(ctx);
  const { patterns, cannot_say } = computePatterns(ctx, input.metric);
  const chain = funnel(ctx);

  const sufficient = patterns.filter(p => p.sufficient && p.band === 'earning')
    .sort((a, b) => (b.lift.value ?? 0) - (a.lift.value ?? 0));
  const pairs = sufficient.filter(p => p.dimension.includes('×'));

  const sections: DigestSection[] = [
    { id: 'coverage', heading: 'Coverage', lines: [coverage.words] },
    {
      id: 'outperformed', heading: 'What outperformed',
      lines: sufficient.length
        ? sufficient.slice(0, 5).map(p =>
          `${p.dimension} "${p.value}": ${liftLine(p.lift.value, p.n)}`)
        : ['Nothing cleared the threshold this month. Near misses are listed at the end.'],
    },
    {
      id: 'pillars', heading: 'Pillar performance, by job',
      lines: cards.length ? cards.map(pillarLine) : ['No pillars are set up yet.'],
    },
    {
      id: 'combinations', heading: 'Top combinations',
      lines: pairs.length
        ? pairs.slice(0, 3).map(p => `${p.value}: ${liftLine(p.lift.value, p.n)}`)
        : ['No combination has enough data yet.'],
    },
    {
      id: 'funnel', heading: 'Funnel',
      lines: [chain.brand_building.words, ...chain.absent_steps.map(
        s => `No ${s.replace(/_/g, ' ')} step: not configured for this profile.`)],
    },
    {
      id: 'suggestion', heading: 'Recommendation',
      lines: [oneSuggestion(sufficient[0], cards, coverage.complete)],
    },
    {
      id: 'cannot-say', heading: 'Awaiting sufficient data',
      lines: cannot_say.length
        ? cannot_say.slice(0, 5).map(c => `${c.dimension} "${c.value}": ${c.owed}.`)
        : ['All patterns had sufficient data.'],
    },
  ];

  return {
    id: input.id,
    profile_id: ctx.facts.profile_id,
    kind: 'monthly',
    period_start: ctx.period.from,
    period_end: ctx.period.to,
    sections,
    coverage: {
      days_expected: coverage.days_expected,
      days_covered: coverage.days_covered,
      gaps: coverage.gaps,
    },
    verdict_ref: input.verdict?.id,
    published: false,
    run_id: input.run_id,
    created_at: input.now,
  };
}

function pillarLine(c: PillarCard): string {
  switch (c.state) {
    case 'blocked': return `${c.name}: not measured yet, its job has no measurement declared.`;
    case 'not-measurable': return `${c.name}: marked as not measurable for this profile.`;
    case 'coverage-gap': return `${c.name}: data collection was incomplete for part of this period.`;
    case 'too-early': return `${c.name}: insufficient data. ${c.sufficiency.owed ?? ''}`.trim();
    default:
      return `${c.name} (job: ${c.job ?? 'not set'}) is ${c.state}, measured on ${c.judged_on}. ${c.quantity.words}.`;
  }
}

function liftLine(lift: number | undefined, n: number): string {
  return lift === undefined
    ? `${n} pieces, no lift computed`
    : `${percent(lift)} against this account's typical, on ${n} pieces`;
}

/** ONE concrete suggestion. Never a list — a list is a dashboard (§13.1). */
function oneSuggestion(
  leading: { dimension: string; value: string } | undefined,
  cards: PillarCard[], coverageComplete: boolean,
): string {
  if (!coverageComplete) {
    return 'Fix data collection first. Everything below is based on a partial record until collection resumes.';
  }
  const empty = cards.find(c => c.quantity.posted === 0 && c.job);
  if (empty) return `Publish something in ${empty.name}. No content entered that pillar this month.`;
  if (leading) return `Test one more piece with ${leading.dimension} "${leading.value}" to confirm the pattern.`;
  return 'Keep publishing. There is not yet enough data to support a change.';
}

// ── §13.2 The weekly owner pulse, per profile ────────────────────────────────

export interface PulseInput {
  ctx: AnalysisContext;
  id: string;
  run_id: string;
  metric: MetricSpec;
  now: string;
}

/**
 * PLAN §5.3 says everything belongs to exactly one profile and the only thing
 * between profiles is her shelf. So the pulse is NOT a cross-profile object: each
 * profile writes its OWN entry, and the shelf composes her one screen from them
 * (spec 28 does the composing). Nothing is stored between profiles.
 *
 * FIRST, always: any profile whose collection is broken.
 */
export function weeklyPulse(input: PulseInput): Digest {
  const { ctx } = input;
  const coverage = coverageFor(ctx.gaps, ctx.period.from, ctx.period.to);
  const cards = scorecard(ctx);
  const { patterns } = computePatterns(ctx, input.metric);
  const moving = patterns.filter(p => p.sufficient && p.band !== 'steady' && p.band !== 'too-early');

  const lines: string[] = [];
  if (!coverage.complete) lines.push(`Data collection is interrupted. ${coverage.words}`);
  const posted = piecesInPeriod(ctx).length;
  lines.push(`${posted} posted this week.`);
  for (const p of moving.slice(0, 3)) {
    lines.push(`${p.band}: ${p.dimension} "${p.value}", ${liftLine(p.lift.value, p.n)}.`);
  }
  const slipping = cards.filter(c => c.state === 'dragging');
  for (const c of slipping) lines.push(`${c.name} is underperforming against its job.`);
  const early = cards.filter(c => c.state === 'too-early');
  if (early.length) lines.push(`${early.length} with insufficient data.`);

  return {
    id: input.id,
    profile_id: ctx.facts.profile_id,
    kind: 'weekly-pulse',
    period_start: ctx.period.from,
    period_end: ctx.period.to,
    sections: [{ id: 'pulse', heading: 'This week', lines }],
    coverage: {
      days_expected: coverage.days_expected,
      days_covered: coverage.days_covered,
      gaps: coverage.gaps,
    },
    published: false,
    run_id: input.run_id,
    created_at: input.now,
  };
}

/** The suggested schedule (§13.2). Hers to finalize, never silently applied. */
export const PULSE_SUGGESTION =
  `Suggested: ${PULSE_SCHEDULE.day} ${PULSE_SCHEDULE.time} ${PULSE_SCHEDULE.timezone}. Yours to finalize.`;

// ── §13.3 The always-live view ───────────────────────────────────────────────

export interface NowView {
  period: { from: string; to: string };
  coverage: ReturnType<typeof coverageFor>;
  /** Coverage is the FIRST block, not a badge in a corner (§5). */
  first_block: string;
  pillars: PillarCard[];
  posted: number;
  moving: { dimension: string; value: string; band: string; words: string }[];
  last_verdict?: { cycle: string; created_at: string; headline: string };
}

/**
 * The Now tab. The same layer, period = month to date. No waiting for month-end
 * (spec 07's locked decision), and it cannot drift from the digest because it is
 * the same calculation.
 */
export function nowView(
  ctx: AnalysisContext, metric: MetricSpec, lastVerdict?: Verdict | null,
): NowView {
  const coverage = coverageFor(ctx.gaps, ctx.period.from, ctx.period.to);
  const cards = scorecard(ctx);
  const { patterns } = computePatterns(ctx, metric);
  return {
    period: ctx.period,
    coverage,
    first_block: coverage.complete
      ? `Data collection is up to date. ${coverage.days_covered} of ${coverage.days_expected} days collected this month.`
      : coverage.words,
    pillars: cards,
    posted: piecesInPeriod(ctx).length,
    moving: patterns
      .filter(p => p.sufficient && p.band !== 'steady' && p.band !== 'too-early')
      .slice(0, 5)
      .map(p => ({
        dimension: p.dimension, value: p.value, band: p.band,
        words: liftLine(p.lift.value, p.n),
      })),
    last_verdict: lastVerdict
      ? {
        cycle: lastVerdict.cycle,
        created_at: lastVerdict.created_at,
        headline: lastVerdict.words?.headline
          ?? `${lastVerdict.cycle} verdict, computed ${lastVerdict.created_at.slice(0, 10)}.`,
      }
      : undefined,
  };
}

/** The month-to-date period the Now tab runs on. */
export function monthToDate(now: string): { from: string; to: string } {
  const month = monthOf(now);
  return { from: monthBounds(month).from, to: now.slice(0, 10) };
}

// ── §14 The client publication ───────────────────────────────────────────────

export interface PublicationInput {
  ctx: AnalysisContext;
  id: string;
  run_id: string;
  now: string;
  /** The digest whose words she is publishing, when there is one. */
  from_digest?: Digest | null;
  verdict?: Verdict | null;
  supersedes?: string;
}

/**
 * A publication is DRAFTED here and published nowhere: `published` is false, and
 * only her approval flips it (§14). Nothing publishes on a timer.
 *
 * It carries the approved scorecard cards, the approved goal lines, the approved
 * digest words, its period and its coverage note — and never the show-my-working
 * internals, never the baseline arithmetic, never another profile (§7.5).
 */
export function draftPublication(input: PublicationInput): Digest {
  const { ctx } = input;
  const coverage = coverageFor(ctx.gaps, ctx.period.from, ctx.period.to);
  const cards = pillarsForClient(scorecard(ctx));
  const lines = goalsForClient(goalCards(ctx));

  const sections: DigestSection[] = [
    {
      id: 'coverage', heading: 'Reporting period',
      lines: [coverage.complete
        ? `${ctx.period.from} to ${ctx.period.to}.`
        : `${ctx.period.from} to ${ctx.period.to}. Some days in this period were not collected.`],
    },
    {
      id: 'pillars', heading: 'Pillar performance',
      lines: cards.map(c => `${c.name}: ${c.verdict}.${c.purpose ? ` ${c.purpose}` : ''}`),
    },
    {
      id: 'goals', heading: 'Goals',
      lines: lines.map(g => `${g.name}: ${g.actual} against ${g.target}.`),
    },
  ];
  if (input.from_digest) {
    const summary = input.from_digest.sections.find(s => s.id === 'suggestion');
    if (summary) sections.push({ id: 'summary', heading: 'Summary', lines: summary.lines });
  }

  return {
    id: input.id,
    profile_id: ctx.facts.profile_id,
    kind: 'client-publication',
    period_start: ctx.period.from,
    period_end: ctx.period.to,
    sections,
    coverage: {
      days_expected: coverage.days_expected,
      days_covered: coverage.days_covered,
      gaps: coverage.gaps,
    },
    verdict_ref: input.verdict?.id,
    published: false,
    supersedes: input.supersedes,
    run_id: input.run_id,
    created_at: input.now,
  };
}

/**
 * Her approval. A deliberate act with a date and her name on it — and the only
 * thing in this system that ever sets `published: true`.
 */
export function approvePublication(
  digest: Digest, by: string, at: string, edits?: DigestSection[],
): Digest {
  if (digest.kind !== 'client-publication') {
    throw new DigestRefused('Only a client publication is ever published to a client.');
  }
  return {
    ...digest,
    sections: edits ?? digest.sections,
    published: true,
    approved_by: by,
    approved_at: at,
  };
}

/** The empty state, until she approves the first one (§14). */
export const CLIENT_EMPTY_STATE =
  'Your first monthly summary will appear here once it is ready.';

export function writeDigest(
  body: ProfileBody, digest: Digest, writer: 'engine:analysis' | 'owner' = 'engine:analysis',
): ProfileBody {
  return putEntry(body, DIGEST_PATH, {
    id: digest.id, type: 'digest',
    data: digest as unknown as Record<string, unknown>,
  }, { writer, now: digest.created_at });
}

export function readDigests(body: ProfileBody, kind?: DigestKind): Digest[] {
  let entries: BodyEntry[];
  try {
    entries = readPath(body, DIGEST_PATH);
  } catch {
    return [];
  }
  return entries
    .map(e => {
      const d = { ...(e.data as unknown as Digest), id: e.id };
      // The path is append-only, so approval arrives as an amendment. The draft
      // stays byte-identical underneath it, which is the whole point.
      for (const a of e.amendments ?? []) {
        Object.assign(d as unknown as Record<string, unknown>, a.changed);
      }
      return d;
    })
    .filter(d => !kind || d.kind === kind)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

/** The latest APPROVED publication — what a client's analysis window renders,
 *  never a live query (§14). */
export function latestPublication(body: ProfileBody): Digest | null {
  return readDigests(body, 'client-publication').find(d => d.published) ?? null;
}
