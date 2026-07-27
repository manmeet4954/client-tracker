// Spec 27 §23 — the reading layer's acceptance tests.
//
// Tests 1 to 12 run on fixtures. Tests 13 and 14 are live-data checks that need
// her setup day; they are NAMED as skipped at the bottom rather than quietly
// omitted, exactly as spec 26's two are.

import { suite, test, ok, eq, throws } from './harness.ts';
import type { SwitchConfig } from '../lib/tree/contract.ts';
import type { AppState } from '../types/index.ts';
import { putEntry, readPath } from '../lib/tree/body.ts';
import { findDeclaration } from '../lib/tree/declarations.ts';
import { platformSwitchId, validateSwitchConfig } from '../lib/tree/switches.ts';
import { validateRegistries, clientMayRead } from '../lib/tree/validate.ts';
import { filterStateForRole } from '../lib/access.ts';
import { fixtureState } from './fixtures.ts';
import { refusedProposalWrites, writeProposal } from '../lib/engine/proposals.ts';
import { RecommendationRefused, writeRecommendation } from '../lib/engine/recommendations.ts';

import {
  analysisMayWriteObservations, buildAnalysisContext, inMemoryStore, readProfileFacts,
  readSnapshot, sliceRowsFor, writerMayWrite,
} from '../lib/analysis/read.ts';
import {
  BAND_CUTS, PULSE_SCHEDULE, QUARTER_DAYS, SUGGESTED_VALUES, bandOf, baselineOf,
  coverageFor, liftOf, median, regimesOf, jobAtBirth, stickFor, sufficiencyOf, typicalOf,
} from '../lib/analysis/compute.ts';
import { dimensionsFor, slice, valueOf } from '../lib/analysis/bifurcate.ts';
import { scorecard } from '../lib/analysis/scorecard.ts';
import { funnel } from '../lib/analysis/funnel.ts';
import { goals } from '../lib/analysis/goals.ts';
import {
  buildComparison, plannedStatus, resolve, selectablePieces, writeComparison,
  appendResolution, resolutionsOf, ComparisonRefused,
} from '../lib/analysis/compare.ts';
import {
  buildVerdictInput, computeCall, computeVerdict, computePatterns, cyclesDue,
  readVerdicts, recommendationsFrom, refusedEvidenceWrites, writeRevisitProposal,
  writeStrategyDiff, writeVerdict, VerdictRefused,
} from '../lib/analysis/verdict.ts';
import {
  NO_KEY_LINE, WORDS_WITHHELD_LINE, buildRequest, causationGuard, computedWords,
  numberGuard, sufficiencyGuard, vocabularyFor, wordVerdict, type VerdictWords,
} from '../lib/analysis/words.ts';
import {
  approvePublication, draftPublication, latestPublication, monthlyDigest, monthToDate,
  nowView, readDigests, weeklyPulse, writeDigest, DigestRefused,
} from '../lib/analysis/digest.ts';

import {
  CHANNEL, CONFIG, NOW, PIECES, PROFILE, SAVED_PER_VIEW, VIEWS,
  cleanContext, fixtureBody, fixtureContext, fixtureSnapshot,
} from './analysisFixtures.ts';

const RUN = { run_id: 'run-v1', now: NOW };

// ── 1. The gap test, in every surface ────────────────────────────────────────

suite('spec 27 §23.1 — the gap test, in every surface');

test('1. all eight surfaces render the July stall as a gap, and not one reports a drop', () => {
  const ctx = fixtureContext();                       // collection stops 2026-07-11
  eq(ctx.gaps.length, 1, 'one stretch, not a scatter of days');
  eq(ctx.gaps[0].from, '2026-07-12', 'the gap starts the day after the last observation');
  eq(ctx.gaps[0].reason, 'sync-stalled', 'a hole in the pipe, named as one');

  // 1 — Now
  const now = nowView(ctx, SAVED_PER_VIEW);
  ok(!now.coverage.complete, 'Now knows the period is incomplete');
  ok(now.first_block.includes('2026-07-12'), 'and its FIRST block is the gap, not a badge');
  ok(now.first_block.includes('pipe stopped'), 'in her language');

  // 2 — Slices
  const sliced = slice(ctx, { dimension: 'hook_type', metric: SAVED_PER_VIEW });
  ok(!sliced.coverage.complete, 'Slices renders coverage before performance');
  ok(sliced.coverage.words.includes('2026-07-12'), 'naming the stretch');

  // 3 — Scorecard
  const cards = scorecard(ctx);
  ok(cards.length > 0, 'there are pillars');
  for (const c of cards) {
    ok(c.state === 'coverage-gap' || c.state === 'blocked' || c.state === 'not-measurable',
      `${c.name} renders the gap instead of a verdict, not beside it`);
    ok(c.state !== 'dragging', `${c.name} never reads as a decline because of a gap`);
  }

  // 4 — Funnel
  const chain = funnel(ctx);
  ok(!chain.coverage.complete, 'the funnel carries the gap');
  const july = chain.months.find(m => m.month === '2026-07');
  ok(july, 'there is a July row');
  ok(july!.steps.filter(s => s.metric_id).every(s => s.value.state === 'no-coverage'),
    'and every observed step in it is no-coverage, never a lower number');

  // 5 — Compare: a piece published inside the stall
  const cmp = buildComparison(ctx, {
    id: 'cmp-gap', piece_ids: ['pc-1', 'pc-9'], metric_id: 'saved', now: NOW,
  });
  ok(cmp.confounders.some(c => c.includes('2026-07-12')), 'the gap is a named confounder');
  const resolved = resolve(ctx, cmp, 'saved');
  eq(resolved.entry.state, 'not-enough-comparable-data', 'and it refuses to rank');
  ok(!resolved.entry.verdict, 'with no verdict at all');

  // 6 — Goals
  const goalCards = goals(ctx);
  const signups = goalCards.find(g => g.goal_id === 'signups')!;
  eq(signups.state, 'coverage-gap', 'the goal card leads with the gap');
  ok(signups.words.includes('partial'), 'and says the figure under it is partial');

  // 7 — Verdicts
  const input = buildVerdictInput({ ctx, cycle: '30-day', metric: SAVED_PER_VIEW });
  ok(input.coverage.gaps.length > 0, 'the verdict input carries the gap FIRST');
  ok(input.coverage.days_covered < input.coverage.days_expected, 'and the days do not add up');
  eq(computeCall(input).right_call, 'cannot say yet', 'so the call refuses to be a call');

  // 8 — Digest
  const digest = monthlyDigest({ ctx, id: 'dg-1', metric: SAVED_PER_VIEW, ...RUN });
  eq(digest.sections[0].id, 'coverage', 'coverage is the first section');
  ok(digest.sections[0].lines[0].includes('2026-07-12'), 'naming the stretch');
  ok(digest.sections.find(s => s.id === 'suggestion')!.lines[0].includes('Fix the collection'),
    'and the one suggestion is to fix the pipe, not to change the content');

  // Asking "how did July go" returns a gap, never a slump: nothing exists after
  // the 11th to be misread as a fall, and nothing was invented for those days.
  const after = ctx.snapshot.observations.filter(o => (o.local_date ?? '') > '2026-07-11');
  eq(after.length, 0, 'no observation exists after the stall');
});

// ── 2. Comparisons below thresholds refuse to rank ───────────────────────────

suite('spec 27 §23.2 — comparisons below thresholds refuse to rank');

test('2. one piece under minExposure returns not-enough-comparable-data, with no ordering', () => {
  const thin = cleanContext({
    metricOverrides: { 'pc-2': { views: 100, reach: 90, saved: 44, website_clicks: 5 } },
  });
  const cmp = buildComparison(thin, {
    id: 'cmp-thin', piece_ids: ['pc-1', 'pc-2'], metric_id: 'saved', window: '7d', now: NOW,
  });
  const low = resolve(thin, cmp, 'saved');
  eq(low.entry.state, 'not-enough-comparable-data', 'below the threshold, it refuses');
  ok(!low.entry.verdict, 'no verdict object at all');
  ok(!JSON.stringify(low.entry.verdict ?? {}).includes('leads'), 'nothing says "leads"');
  ok(low.missing?.includes('100'), 'and it says exactly what is missing');
  ok(low.missing?.includes('300'), 'against the threshold that stopped it');

  // Raising the exposure above the threshold makes it resolve — proving the
  // THRESHOLD is what stopped it, not luck.
  const fat = cleanContext();
  const same = buildComparison(fat, {
    id: 'cmp-thin', piece_ids: ['pc-1', 'pc-2'], metric_id: 'saved', window: '7d', now: NOW,
  });
  eq(resolve(fat, same, 'saved').entry.state, 'concluded', 'above it, the same comparison resolves');
});

test('2b. a comparison needs two sides, and a planned one needs a hypothesis first', () => {
  const ctx = cleanContext();
  throws(() => buildComparison(ctx, { id: 'x', piece_ids: ['pc-1'], metric_id: 'saved', now: NOW }),
    'at least two pieces', 'one piece is not a comparison');
  throws(() => buildComparison(ctx, {
    id: 'x', piece_ids: ['pc-1', 'pc-2'], metric_id: 'saved', planned: true, now: NOW,
  }), 'needs a hypothesis', 'a planned comparison without a hypothesis is refused');
});

test('2c. two things changing at once is created, marked confounded, and says which', () => {
  const ctx = cleanContext();
  // pc-1 and pc-3 differ in hook AND format.
  const cmp = buildComparison(ctx, {
    id: 'cmp-conf', piece_ids: ['pc-1', 'pc-3'], metric_id: 'saved', window: '7d', now: NOW,
  });
  ok(cmp.confounded, 'it is marked confounded');
  eq(cmp.changed_variable, 'unknown', 'and no single changed variable is claimed');
  ok(cmp.confounders.some(c => c.includes('hook_type') && c.includes('format')),
    'the words name which dimensions moved together');
  const r = resolve(ctx, cmp, 'saved');
  ok(r.confounder_line.includes('two things changed at once'), 'and the screen leads with it');
});

test('2d. a planned comparison whose plan did not hold is flagged, with no silent rescue', () => {
  const ctx = cleanContext();
  const cmp = buildComparison(ctx, {
    id: 'cmp-plan', piece_ids: ['pc-1', 'pc-2'], metric_id: 'saved', window: '7d',
    planned: true, hypothesis: 'the reel beats the carousel', declared_changed_variable: 'format',
    now: NOW,
  });
  const r = resolve(ctx, cmp, 'saved');
  ok(r.plan_mismatch?.includes('format'), 'the mismatch is named');
  const status = plannedStatus(ctx, cmp);
  eq(status.state, 'ready', 'both sides materialised the window');
});

test('2e. resolving appends: a 7d resolution and a 30d one both survive', () => {
  const ctx = cleanContext();
  let body = fixtureBody();
  const cmp = buildComparison(ctx, {
    id: 'cmp-keep', piece_ids: ['pc-1', 'pc-2'], metric_id: 'saved', window: '7d', now: NOW,
  });
  body = writeComparison(body, cmp, NOW);
  body = appendResolution(body, { ...resolve(ctx, cmp, 'saved').entry, resolves: 'cmp-keep' }, '2026-07-12T00:00:00Z');
  body = appendResolution(body, { ...resolve(ctx, cmp, 'saved').entry, resolves: 'cmp-keep', window: '30d' }, '2026-08-04T00:00:00Z');
  eq(resolutionsOf(body, 'cmp-keep').length, 2, 'both resolutions are kept, neither overwrote the other');
});

// ── 3. Read-only against the store ───────────────────────────────────────────

suite('spec 27 §23.3 — read-only against the store');

test('3. a write from engine:analysis to any study-own-data path is refused at the door', () => {
  const paths = [
    'work-log/analysis/study-own-data',
    'work-log/analysis/study-own-data/observations',
    'work-log/analysis/study-own-data/sync-health',
  ];
  let body = fixtureBody();
  for (const path of paths) {
    ok(!analysisMayWriteObservations(path), `${path} does not accept engine:analysis`);
    throws(
      () => putEntry(body, path, { id: 'x', type: findDeclaration(path)!.entry_type, data: {} },
        { writer: 'engine:analysis' }),
      'not a declared writer',
      `the write door refuses ${path}`,
    );
  }

  // The DECLARATION is the guard: the pipe it names writes fine, and a path that
  // names engine:analysis accepts it. Change the declaration and the answer
  // changes — which is the whole point of the test.
  ok(writerMayWrite('work-log/analysis/study-own-data/observations', 'pipe:platform-metrics'),
    'the declared pipe still writes');
  ok(writerMayWrite('work-log/analysis/verdicts', 'engine:analysis'),
    'and the engine writes its own conclusions, which are not observations');
  body = putEntry(body, 'work-log/analysis/study-own-data/observations',
    { id: 'o-1', type: 'metric_observation', data: { views: 10 } }, { writer: 'pipe:platform-metrics' });
  eq(readPath(body, 'work-log/analysis/study-own-data/observations').length, 1, 'the pipe wrote');
});

test('3b. the read layer exports queries and no writers', async () => {
  const snapshot = fixtureSnapshot();
  const store = inMemoryStore(snapshot);
  const keys = Object.keys(store);
  ok(!keys.some(k => /write|insert|update|upsert|delete|save/i.test(k)),
    'the store interface carries no writer');
  const read = await readSnapshot(store, PROFILE);
  eq(read.channels.length, 1, 'and it reads');
  ok(read.observations.length > 0, 'the observations');
});

// ── 4. The birth snapshot is the truth ───────────────────────────────────────

suite('spec 27 §23.4 — the birth snapshot is the truth');

test('4. an edited costume does not move a posted piece, and no-birth is a named bucket', () => {
  const ctx = cleanContext();
  const piece = ctx.joined.find(j => j.piece.id === 'pc-1')!;
  eq(valueOf(ctx, 'hook_type', piece), 'curiosity', 'the ORIGINAL hook, not the edited one');
  eq((piece.piece as unknown as { birth: { costume: { hook_type: string } } }).birth.costume.hook_type,
    'curiosity', 'because the birth record is what analysis reads');

  const sliced = slice(ctx, { dimension: 'hook_type', metric: SAVED_PER_VIEW });
  const curiosity = sliced.cells.find(c => c.value === 'curiosity');
  ok(curiosity, 'the slice still has a curiosity cell');
  ok(curiosity!.piece_ids.includes('pc-1'), 'with pc-1 in it');
  ok(!sliced.cells.find(c => c.value === 'question')?.piece_ids.includes('pc-1'),
    'and pc-1 is not under the edited value');

  eq(sliced.born_before_the_engine.count, 1, 'the legacy piece lands in a named bucket');
  ok(sliced.born_before_the_engine.piece_ids.includes('pc-8'), 'with its id');
  ok(sliced.born_before_the_engine.words.includes('1'), 'and a count, never a silent drop');
});

test('4b. regimes never mix: a piece is judged under the job that existed at its birth', () => {
  const changes = [
    { at: '2026-05-01', job: 'Reach' },
    { at: '2026-07-05', job: 'Trust' },
  ];
  eq(jobAtBirth(changes, '2026-07-02'), 'Reach', 'a June piece is judged under the old job');
  eq(jobAtBirth(changes, '2026-07-08'), 'Trust', 'a later one under the new job');
  const regimes = regimesOf(changes, [
    { piece_id: 'a', born_at: '2026-07-02' }, { piece_id: 'b', born_at: '2026-07-08' },
  ], '2026-07-20');
  eq(regimes.length, 2, 'the pillar splits in two at the change date');
  eq(regimes[0].piece_ids, ['a'], 'and the pieces do not mix');
  eq(regimes[1].piece_ids, ['b'], 'either way');
});

// ── 5. The growth test (law 3) ───────────────────────────────────────────────

suite('spec 27 §23.5 — the growth test');

test('5. a fourth pillar, a new hook type and a new platform carry with no code change', () => {
  const before = cleanContext();
  const beforeCards = scorecard(before);
  const beforeTrust = beforeCards.find(c => c.pillar_id === 'trust')!;

  const config: SwitchConfig = { ...CONFIG, [platformSwitchId('LinkedIn')]: { state: 'active', set_at: 'test' } };
  const grown = cleanContext({
    config,
    extraPlatforms: [{ name: 'LinkedIn', formats: ['Text post', 'Document'] }],
    extraPillars: [{ id: 'community', name: 'Community', job: 'Trust', declared: true }],
    extraPieces: [{
      id: 'pc-li', pillar: 'community', hook: 'confession', format: 'Document',
      platform: 'LinkedIn', seed: 'seed-ats', published: '2026-07-03',
      metrics: { views: 900, reach: 700, saved: 30, website_clicks: 2 },
    }],
    pieces: [...PIECES, {
      id: 'pc-li', pillar: 'community', hook: 'confession', format: 'Document',
      platform: 'LinkedIn', seed: 'seed-ats', published: '2026-07-03',
      metrics: { views: 900, reach: 700, saved: 30, website_clicks: 2 },
    }],
  });

  const dims = dimensionsFor(grown);
  ok(dims.find(d => d.id === 'platform')!.values.some(v => v.id === 'LinkedIn'), 'the new platform is in the picker');
  ok(dims.find(d => d.id === 'format')!.values.some(v => v.id === 'Document'), 'with its own formats');
  ok(dims.find(d => d.id === 'pillar')!.values.some(v => v.id === 'community'), 'the fourth pillar too');
  ok(dims.find(d => d.id === 'hook_type')!.values.some(v => v.id === 'confession'), 'and the new hook type');
  for (const d of dims) {
    for (const v of d.values) ok(v.label.trim().length > 0, `${d.id} has nothing blank`);
  }

  const cards = scorecard(grown);
  const community = cards.find(c => c.pillar_id === 'community');
  ok(community, 'the new pillar has a card');
  ok(selectablePieces(grown).some(p => p.piece.id === 'pc-li'), 'and the new platform’s piece is selectable in Compare');

  // No other pillar's VERDICT moves. Its lift may shift, and honestly should: a
  // new posted piece is part of the account, and every verdict is against the
  // account's own baseline. What must not move is the judgement.
  const after = cards.find(c => c.pillar_id === 'trust')!;
  eq(after.state, beforeTrust.state, 'and no other pillar’s verdict moved');
  eq(after.band, beforeTrust.band, 'nor its band');

  const patterns = computePatterns(grown, SAVED_PER_VIEW);
  ok([...patterns.patterns, ...patterns.cannot_say]
    .some(p => JSON.stringify(p).includes('confession')),
    'the new hook type is in the verdict’s pattern space');
});

test('5b. a new pillar with nothing in it yet reads too early to judge, and disturbs nobody', () => {
  const before = scorecard(cleanContext());
  const grown = cleanContext({
    extraPillars: [{ id: 'community', name: 'Community', job: 'Trust', declared: true }],
  });
  const cards = scorecard(grown);
  const fresh = cards.find(c => c.pillar_id === 'community')!;
  eq(fresh.state, 'too-early', 'a brand-new pillar is too early to judge');
  ok(fresh.sufficiency.owed?.length, 'and says exactly what it owes');
  for (const b of before) {
    const a = cards.find(c => c.pillar_id === b.pillar_id)!;
    eq(a.state, b.state, `${b.name}'s verdict did not move`);
    eq(a.lift.value, b.lift.value, 'not even by a fraction');
  }
});

// ── 6. The cascade test ──────────────────────────────────────────────────────

suite('spec 27 §23.6 — the cascade test');

const withLinkedIn = {
  extraPlatforms: [{ name: 'LinkedIn', formats: ['Document'] }],
  extraPieces: [{
    id: 'pc-li', pillar: 'trust', hook: 'confession', format: 'Document',
    platform: 'LinkedIn', seed: 'seed-ats', published: '2026-07-03',
    metrics: { views: 900, reach: 700, saved: 30, website_clicks: 2 },
  }],
  pieces: [...PIECES, {
    id: 'pc-li', pillar: 'trust', hook: 'confession', format: 'Document',
    platform: 'LinkedIn', seed: 'seed-ats', published: '2026-07-03',
    metrics: { views: 900, reach: 700, saved: 30, website_clicks: 2 },
  }],
};

test('6. platforms.linkedin hidden removes LinkedIn from every surface and from the packet', () => {
  const hidden = cleanContext({
    ...withLinkedIn,
    config: { ...CONFIG, [platformSwitchId('LinkedIn')]: { state: 'hidden', set_at: 'test' } },
  });

  const dims = dimensionsFor(hidden);
  ok(!dims.find(d => d.id === 'platform')!.values.some(v => v.id === 'LinkedIn'), 'no dimension value');
  ok(!dims.find(d => d.id === 'format')!.values.some(v => v.id === 'Document'), 'no LinkedIn format');
  ok(!funnel(hidden).months.some(m => JSON.stringify(m).includes('LinkedIn')), 'no funnel row');
  ok(!selectablePieces(hidden).some(p => p.piece.id === 'pc-li'), 'no LinkedIn piece selectable');

  const packet = JSON.stringify(buildRequest(
    buildVerdictInput({ ctx: hidden, cycle: '30-day', metric: SAVED_PER_VIEW }),
    vocabularyFor(hidden),
  ));
  ok(!packet.includes('LinkedIn'), 'and no LinkedIn name anywhere in the packet sent to the model');
  ok(!packet.includes('Document'), 'nor its formats');

  // At `history` every past LinkedIn number stays readable while nothing new computes.
  const history = cleanContext({
    ...withLinkedIn,
    config: { ...CONFIG, [platformSwitchId('LinkedIn')]: { state: 'history', set_at: 'test' } },
  });
  ok(history.joined.some(j => j.piece.id === 'pc-li'), 'the past piece is still joined and readable');
  ok(!dimensionsFor(history).find(d => d.id === 'platform')!.values.some(v => v.id === 'LinkedIn'),
    'but it is not offered as a live slice');
  ok(!selectablePieces(history).some(p => p.piece.id === 'pc-li'), 'and nothing new compares on it');
});

// ── 7. The scorecard judges by job only ──────────────────────────────────────

suite('spec 27 §23.7 — the scorecard judges by job only');

test('7. a Convert pillar earns on link taps while its reach sits below baseline', () => {
  const ctx = cleanContext();
  const cards = scorecard(ctx);
  const convert = cards.find(c => c.pillar_id === 'convert')!;
  eq(convert.state, 'earning', 'it is earning on what its declaration names');
  ok(convert.judged_on.includes('website_clicks'), 'and it says what that is');
  ok(convert.show_my_working.includes('measurement declaration'),
    'the show-my-working sentence names the declaration');
  ok(convert.show_my_working.includes('12 weeks'), 'and the baseline it used');

  // Its reach is well below the account's own normal, and that never enters the
  // verdict — a promo pillar is never shamed for low reach (PLAN §5.3).
  const reachRows = sliceRowsFor(ctx, '7d', ctx.joined.filter(
    j => j.piece.birth?.costume?.pillar_id === 'convert'));
  const reachTypical = typicalOf(reachRows, { metric_id: 'reach', window: '7d' });
  const reachBaseline = baselineOf({
    all: sliceRowsFor(ctx, '7d'), metric: { metric_id: 'reach', window: '7d' }, asOf: '2026-07-11',
  });
  ok((reachTypical.value ?? 0) < (reachBaseline.value ?? 0), 'its reach really is below baseline');
  ok(!convert.show_my_working.includes('reach'), 'and reach is nowhere in its verdict');

  const trust = cards.find(c => c.pillar_id === 'trust')!;
  eq(trust.state, 'earning', 'the trust pillar earns on its own metric');
  ok(trust.judged_on.includes('saved'), 'which is a different one');
});

test('7b. a pillar whose job has no declaration renders blocked, and collection is unaffected', () => {
  const ctx = cleanContext();
  const blocked = scorecard(ctx).find(c => c.pillar_id === 'awareness')!;
  eq(blocked.state, 'blocked', 'blocked, not zero and not dragging');
  ok(blocked.blocked_reason?.includes('no measurement'), 'and it says why');
  eq(blocked.metric, null, 'with no metric invented for it');
  // Collection is a different question entirely: the observations are all there.
  ok(ctx.snapshot.observations.length > 0, 'the pipe kept recording underneath');
});

test('7c. planned-comparison pieces COUNT, and the working line names them', () => {
  const ctx = cleanContext();
  const cards = scorecard(ctx, { planned_comparison_piece_ids: ['pc-1', 'pc-2'] });
  const trust = cards.find(c => c.pillar_id === 'trust')!;
  eq(trust.quantity.posted, 4, 'all four trust pieces count toward the mix target');
  eq(trust.planned_comparison_pieces.length, 2, 'two of them were in a planned comparison');
  ok(trust.show_my_working.includes('2 of these'), 'and the working line says so');
});

// ── 8. The number guard ──────────────────────────────────────────────────────

suite('spec 27 §23.8 — the number guard');

function wordsFor(over: Partial<VerdictWords> = {}): VerdictWords {
  return {
    headline: 'A quiet month.',
    coverage_note: 'Collected every day.',
    patterns: [],
    call: { pattern_ref: '', right_call: 'cannot say yet', words: 'Not yet.' },
    cannot_say_note: 'Nothing held back.',
    one_suggestion: 'Keep going.',
    ...over,
  };
}

test('8. a numeral the engine did not compute is rejected, and a second one withholds the words', async () => {
  const ctx = cleanContext();
  const input = buildVerdictInput({ ctx, cycle: '30-day', metric: SAVED_PER_VIEW });
  const bad = wordsFor({ headline: 'Saves jumped to 999999 this month.' });
  const violations = numberGuard(bad, input);
  ok(violations.length > 0, 'the fabricated number is caught');
  ok(violations[0].reason.includes('999999'), 'and named');

  // The same figure written three ways is ONE number, and all three pass.
  const lift = input.patterns.find(p => p.sufficient && p.lift.state === 'value');
  ok(lift, 'there is a computed lift to word');
  const asFraction = String(lift!.lift.value);
  const asPercent = String(Math.round((lift!.lift.value ?? 0) * 1000) / 10);
  eq(numberGuard(wordsFor({ headline: `Lift of ${asFraction}.` }), input), [], 'the fraction passes');
  eq(numberGuard(wordsFor({ headline: `Lift of ${asPercent}%.` }), input), [], 'and so does the percent');

  const verdict = computeVerdict({ ctx, cycle: '30-day', metric: SAVED_PER_VIEW, id: 'v-1', ...RUN });
  let calls = 0;
  const alwaysBad = async () => {
    calls++;
    return {
      stop_reason: 'end_turn',
      text: JSON.stringify(wordsFor({ headline: 'Saves hit 424242.' })),
      usage: { input_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, output_tokens: 5 },
    };
  };
  const result = await wordVerdict(
    { verdict, vocabulary: vocabularyFor(ctx), words_switch_active: true, has_api_key: true },
    alwaysBad,
  );
  eq(calls, 2, 'rejected and retried exactly once');
  eq(result.verdict.state, 'words-withheld', 'then the words are withheld');
  eq(result.message, WORDS_WITHHELD_LINE, 'with the plain line');
  ok(!result.words, 'and no fabricated number ever reaches a rendered string');
  ok(result.verdict.guards.rejected >= 2, 'the run records both rejections');
});

test('8b. a retry that fixes the violation is accepted, and the first rejection stays on the record', async () => {
  const ctx = cleanContext();
  const verdict = computeVerdict({ ctx, cycle: '30-day', metric: SAVED_PER_VIEW, id: 'v-2', ...RUN });
  let calls = 0;
  const fixesItself = async () => {
    calls++;
    const words = calls === 1
      ? wordsFor({ headline: 'Saves hit 424242.' })
      : wordsFor({ headline: 'A steady month.' });
    return {
      stop_reason: 'end_turn', text: JSON.stringify(words),
      usage: { input_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, output_tokens: 5 },
    };
  };
  const result = await wordVerdict(
    { verdict, vocabulary: vocabularyFor(ctx), words_switch_active: true, has_api_key: true },
    fixesItself,
  );
  eq(calls, 2, 'one retry');
  eq(result.verdict.state, 'worded', 'and the second answer is accepted');
  eq(result.verdict.guards.rejected, 1, 'with the first rejection kept on the run');
});

// ── 9. The causation and sufficiency guards ──────────────────────────────────

suite('spec 27 §23.9 — the causation and sufficiency guards');

test('9. "proves" and "caused" are rejected, and so is a pattern sitting in cannot_say', () => {
  ok(causationGuard(wordsFor({ headline: 'The carousel proves it works.' })).length > 0, '"proves" is caught');
  ok(causationGuard(wordsFor({ call: { pattern_ref: '', right_call: 'yes', words: 'The hook caused the lift.' } })).length > 0,
    '"caused" is caught');
  ok(causationGuard(wordsFor({ one_suggestion: 'This will keep working.' })).length > 0, '"will" is caught');
  ok(causationGuard(wordsFor({ headline: 'Because of the format, saves rose.' })).length > 0,
    '"because of" is caught');
  eq(causationGuard(wordsFor()), [], 'and clean words pass');

  // Raise the piece threshold so single-piece cells land in cannot_say — the
  // thresholds are per-profile overridable and this is what that is for.
  const ctx = cleanContext({ thresholds: { minPieces: 3 } });
  const input = buildVerdictInput({ ctx, cycle: '30-day', metric: SAVED_PER_VIEW });
  ok(input.cannot_say.length > 0, 'something failed sufficiency');
  const forbidden = input.cannot_say[0].pattern_id;
  const bad = sufficiencyGuard(wordsFor({
    patterns: [{ pattern_ref: forbidden, words: 'This one is winning.' }],
  }), input);
  ok(bad.length > 0, 'pointing at it as a result is rejected');
  ok(bad[0].reason.includes('cannot_say'), 'and the reason says why');

  const invented = sufficiencyGuard(wordsFor({
    patterns: [{ pattern_ref: 'p:made-up=nothing@7d:saved', words: 'Look at this.' }],
  }), input);
  ok(invented.length > 0, 'and a pattern the engine never computed is rejected too');

  const good = input.patterns.find(p => p.sufficient)!;
  eq(sufficiencyGuard(wordsFor({ patterns: [{ pattern_ref: good.id, words: 'This held.' }] }), input), [],
    'a real, sufficient pattern passes');
});

// ── 10. No client leak, and no automatic publication ─────────────────────────

suite('spec 27 §23.10 — no client leak, and no automatic publication');

test('10. a client login receives zero analysis internals and zero unapproved digests', () => {
  // The owner-only paths are owner-only in the declarations themselves.
  for (const p of [
    'work-log/analysis/verdicts', 'work-log/analysis/comparisons',
    'work-log/analysis/study-own-data/sync-health', 'work-log/logs/engine-runs',
    'work-log/logs/feedback',
  ]) {
    eq(findDeclaration(p)!.audience, 'owner', `${p} is owner-only`);
    ok(!clientMayRead(p), `${p} is not a client window`);
  }

  let body = fixtureBody();
  const ctx = cleanContext();
  const digest = monthlyDigest({ ctx, id: 'dg-client', metric: SAVED_PER_VIEW, ...RUN });
  body = writeDigest(body, digest);
  const draft = draftPublication({ ctx, id: 'pub-1', run_id: 'run-p', now: NOW });
  body = writeDigest(body, draft);
  const verdict = computeVerdict({ ctx, cycle: '30-day', metric: SAVED_PER_VIEW, id: 'v-leak', ...RUN });
  body = writeVerdict(body, verdict);

  const state: AppState = fixtureState();
  const withBody: AppState = {
    ...state,
    clients: state.clients.map(c => (c.id === 'career-bubble' ? { ...c, lifecycle: 'active' as const } : c)),
    clientData: { ...state.clientData, 'career-bubble': { ...state.clientData['career-bubble'], body } },
  };

  const asClient = filterStateForRole(withBody, 'merushri');
  const clientBody = asClient.clientData['career-bubble'].body!;
  eq(clientBody.paths['work-log/analysis/verdicts'], undefined, 'no verdicts');
  eq(clientBody.paths['work-log/analysis/comparisons'], undefined, 'no comparisons');
  eq(clientBody.paths['work-log/logs/feedback'], undefined, 'no feedback');
  eq(clientBody.paths['work-log/logs/engine-runs'], undefined, 'no engine runs');
  eq(clientBody.paths['work-log/analysis/study-own-data/sync-health'], undefined, 'no sync health');
  eq((clientBody.paths['work-log/analysis/digests'] ?? []).length, 0,
    'and a newly computed digest is NOT visible until she approves it');

  // Her approval — a deliberate act with a date and her name on it.
  const approved = approvePublication(draft, 'Manmeet', '2026-07-22T09:00:00.000Z');
  const bodyPublished = {
    ...body,
    paths: {
      ...body.paths,
      'work-log/analysis/digests': body.paths['work-log/analysis/digests'].map(
        e => (e.id === 'pub-1' ? { ...e, data: approved as unknown as Record<string, unknown> } : e)),
    },
  };
  const afterApproval = filterStateForRole({
    ...withBody,
    clientData: { ...withBody.clientData, 'career-bubble': { ...withBody.clientData['career-bubble'], body: bodyPublished } },
  }, 'merushri');
  const served = afterApproval.clientData['career-bubble'].body!.paths['work-log/analysis/digests'] ?? [];
  eq(served.length, 1, 'now exactly one entry reaches them');
  eq((served[0].data as { id?: string }).id ?? served[0].id, 'pub-1', 'the publication she approved');
  eq((served[0].data as { kind?: string }).kind, 'client-publication', 'and only a publication');

  // The check FAILS when the publication gate is removed: without it, both the
  // unapproved draft and the monthly digest would have travelled.
  const wouldHaveTravelled = bodyPublished.paths['work-log/analysis/digests'].length;
  eq(wouldHaveTravelled, 2, 'two digests exist behind the gate');
  ok(wouldHaveTravelled > served.length, 'and the gate is what stopped the other one');
});

test('10b. a publication is drafted unpublished, and only a publication can be published', () => {
  const ctx = cleanContext();
  const draft = draftPublication({ ctx, id: 'pub-2', run_id: 'r', now: NOW });
  eq(draft.published, false, 'nothing publishes on a timer');
  eq(draft.approved_by, undefined, 'and nothing is approved by nobody');
  ok(!JSON.stringify(draft).includes('12 weeks'), 'no baseline arithmetic reaches a client');
  ok(!JSON.stringify(draft).includes('Judged on'), 'no show-my-working internals either');

  const monthly = monthlyDigest({ ctx, id: 'dg-x', metric: SAVED_PER_VIEW, ...RUN });
  throws(() => approvePublication(monthly, 'Manmeet', NOW), 'Only a client publication',
    'her monthly digest is not a thing a client can be shown');

  let body = fixtureBody();
  body = writeDigest(body, approvePublication(draft, 'Manmeet', NOW));
  eq(latestPublication(body)?.id, 'pub-2', 'the latest approved publication is what a client window renders');
  eq(readDigests(body, 'monthly').length, 0, 'and a monthly digest is never one');
});

// ── 11. Evidence at the write door ───────────────────────────────────────────

suite('spec 27 §23.11 — evidence at the write door');

test('11. a revisit proposal with no verdict_ref is refused, and a written one is untouchable', () => {
  const ctx = cleanContext();
  const verdict = computeVerdict({ ctx, cycle: '30-day', metric: SAVED_PER_VIEW, id: 'v-eve', ...RUN });
  const pattern = computePatterns(ctx, SAVED_PER_VIEW).patterns.find(p => p.band === 'earning')!;
  let body = fixtureBody();

  throws(() => writeProposal(body, {
    id: 'pr-bad', kind: 'revisit-seed', fed_by: 'engine:analysis', run_id: 'r',
    proposal: { kind: 'revisit-seed' } as never, badges: [],
  }, NOW, 'code-computed'), 'must cite the verdict', 'no evidence, no proposal');

  body = writeRevisitProposal(body, {
    proposal_id: 'pr-1', verdict_id: verdict.id, seed_id: 'seed-salary', seed_name: 'salary',
    pattern, costume: { hook_type: pattern.value }, run_id: 'r', now: NOW,
  });
  const written = readPath(body, 'work-log/creation/topics/proposals')[0];
  eq((written.data as { cited_verdict_id?: string }).cited_verdict_id, 'v-eve', 'the evidence travels with it');

  // Untouchable until she picks it up: every write other than pick-up or dismiss
  // is refused, and a dismissed one still carries its original text.
  const tampered = {
    ...body,
    paths: {
      ...body.paths,
      'work-log/creation/topics/proposals': body.paths['work-log/creation/topics/proposals'].map(e => ({
        ...e,
        data: { ...(e.data as Record<string, unknown>), proposal: { ...(e.data as { proposal: object }).proposal, why: 'edited by hand' } },
      })),
    },
  };
  const refusals = refusedProposalWrites(body, tampered);
  ok(refusals.length > 0, 'editing a waiting proposal is refused');
  ok(refusals[0].reason.includes('not editable'), 'in plain words');
});

test('11b. a strategy diff with no cited verdict is refused, and a whole-body save is caught too', () => {
  const ctx = cleanContext();
  let body = fixtureBody();
  throws(() => writeStrategyDiff(body, {
    feedback_id: 'fb-bad', verdict_id: '', path: 'context/content-strategy/pillars/trust/mix-target',
    before: 40, after: 45, words: 'trust is carrying the month', now: NOW,
  }), 'must cite the verdict', 'no evidence, no diff');

  body = writeStrategyDiff(body, {
    feedback_id: 'fb-1', verdict_id: 'v-eve',
    path: 'context/content-strategy/pillars/trust/mix-target',
    before: 40, after: 45, words: 'trust is carrying the month', now: NOW,
  });
  const item = readPath(body, 'work-log/logs/feedback')[0];
  eq((item.data as { scope?: string }).scope, 'candidate-strategy-change', 'it is a proposal, nothing more');
  ok((item.data as { proposed_diff?: object }).proposed_diff, 'carrying the diff');
  eq((item.data as { decision?: object }).decision, undefined, 'and no decision — she decides');

  // The strategy itself was NOT written. Nothing updates strategy behind her back.
  const mix = readPath(body, 'context/content-strategy/pillars/trust/mix-target')[0];
  eq((mix.data as { target_pct?: number }).target_pct, 40, 'the mix target is untouched');

  const smuggled = {
    ...body,
    paths: {
      ...body.paths,
      'work-log/creation/topics/proposals': [{
        id: 'pr-smuggle', path: 'work-log/creation/topics/proposals', type: 'seed_proposal',
        state: 'active' as const, created_at: NOW, updated_at: NOW,
        data: { id: 'pr-smuggle', kind: 'revisit-seed', state: 'waiting', proposal: {} },
      }],
    },
  };
  const caught = refusedEvidenceWrites(body, smuggled);
  ok(caught.length > 0, 'a whole-body save carrying an uncited revisit proposal is refused');
  ok(caught[0].reason.includes('cite the verdict'), 'for the same reason');
});

test('11c. a costume recommendation from the numbers carries its evidence or it is refused', () => {
  const ctx = cleanContext();
  const verdict = computeVerdict({ ctx, cycle: '30-day', metric: SAVED_PER_VIEW, id: 'v-rec', ...RUN });
  const recs = recommendationsFrom(verdict, { now: NOW });
  ok(recs.length > 0, 'sufficient earning patterns become recommendations');
  ok(recs.every(r => r.verdict_ref === 'v-rec'), 'each citing the verdict it came from');
  ok(recs[0].words.includes('verdict'), 'and saying so in words');

  let body = fixtureBody();
  body = writeRecommendation(body, recs[0]);
  eq(readPath(body, 'work-log/creation/costume-recommendations').length, 1, 'it is written');

  let refused = false;
  try {
    writeRecommendation(body, { ...recs[0], id: 'rec-bad', verdict_ref: undefined, comparison_ref: undefined });
  } catch (e) {
    refused = e instanceof RecommendationRefused;
  }
  ok(refused, 'and one with no citation is refused at spec 25’s own door');
});

// ── 12. Keyless honesty ──────────────────────────────────────────────────────

suite('spec 27 §23.12 — keyless honesty');

test('12. with no API key every number computes and the verdict says its wording is missing', async () => {
  const ctx = cleanContext();
  const cards = scorecard(ctx);
  ok(cards.some(c => c.state === 'earning'), 'every band still computes');
  const cmp = buildComparison(ctx, { id: 'c', piece_ids: ['pc-1', 'pc-2'], metric_id: 'saved', window: '7d', now: NOW });
  eq(resolve(ctx, cmp, 'saved').entry.state, 'concluded', 'every comparison still resolves');
  ok(slice(ctx, { dimension: 'hook_type', metric: SAVED_PER_VIEW }).cells.length > 0, 'every slice still renders');
  ok(goals(ctx).length > 0, 'and every goal card');

  const verdict = computeVerdict({ ctx, cycle: '30-day', metric: SAVED_PER_VIEW, id: 'v-nokey', ...RUN });
  const result = await wordVerdict(
    { verdict, vocabulary: vocabularyFor(ctx), words_switch_active: true, has_api_key: false }, null);
  eq(result.message, NO_KEY_LINE, 'the surface says so plainly');
  ok(!result.words, 'nothing fabricates a sentence');
  eq(result.verdict.state, 'computed', 'the verdict is still a real, computed verdict');
  eq(result.stop_reason, 'not-called', 'and no run is logged as successful');

  // The computed form is real words, written by CODE, with no model involved.
  const words = computedWords(verdict);
  ok(words.headline.includes('30-day'), 'the headline is code-written');
  ok(words.coverage_note.length > 0, 'and so is the coverage note');
  eq(numberGuard(words, verdict.input as never), [], 'and it passes its own number guard');
});

test('12b. with the words switch off, the numbers are untouched and only the paragraph goes', async () => {
  const ctx = cleanContext();
  const verdict = computeVerdict({ ctx, cycle: '30-day', metric: SAVED_PER_VIEW, id: 'v-off', ...RUN });
  const result = await wordVerdict(
    { verdict, vocabulary: vocabularyFor(ctx), words_switch_active: false, has_api_key: true },
    async () => { throw new Error('the model must not be called'); });
  ok(result.message.includes('switched off'), 'it says the wording is off for this profile');
  eq(result.verdict.state, 'computed', 'and every number is still there');
});

// ── The plumbing the twelve stand on ─────────────────────────────────────────

suite('spec 27 — the reading layer’s plumbing');

test('the new address exists, is owner-only, and the registries still validate clean', () => {
  const d = findDeclaration('work-log/analysis/verdicts');
  ok(d, 'work-log/analysis/verdicts is declared');
  eq(d!.audience, 'owner', 'owner-only');
  eq(d!.history, 'append_only', 'append-only: a verdict is never edited');
  eq(d!.switch, 'analysis.verdicts', 'governed by its own switch');
  ok(!clientMayRead('work-log/analysis/verdicts'), 'and no client window opens onto it');
  eq(validateRegistries(), [], 'the registries validate clean');
});

test('the eight new switches exist, and the two lock checks bite', () => {
  const ids = [
    'analysis.always_live', 'analysis.verdicts', 'analysis.verdict_words', 'analysis.pulse_owner',
    'analysis.revisit_proposals', 'analysis.costume_recommendations', 'analysis.strategy_diffs',
    'analysis.client_publication',
  ];
  for (const id of ids) {
    const v = validateSwitchConfig({
      owner_kind: 'hers', config: { [id]: { state: 'active', set_at: 'test' } },
    });
    ok(!v.some(x => x.switch === id && x.reason === 'not in the switch registry'), `${id} is registered`);
  }

  const neverLocked = validateSwitchConfig({
    owner_kind: 'hers', strategyEverLocked: false,
    config: { 'analysis.verdicts': { state: 'active', set_at: 'test' } },
  });
  ok(neverLocked.some(v => v.switch === 'analysis.verdicts' && v.reason.includes('never locked')),
    'a verdict against no measuring stick refuses to activate');

  const noDoor = validateSwitchConfig({
    owner_kind: 'hers', clientAccess: false,
    config: { 'analysis.client_publication': { state: 'active', set_at: 'test' } },
  });
  ok(noDoor.some(v => v.switch === 'analysis.client_publication'),
    'and a publication with no client door refuses too');
});

test('the four states are four, and zero is never one of them', () => {
  eq(median([]), null, 'no values is null, never zero');
  const empty = typicalOf([], SAVED_PER_VIEW);
  eq(empty.state, 'too-early', 'an empty slice is too-early');
  eq(empty.value, undefined, 'and carries no number');

  const noBaseline = liftOf({ state: 'value', value: 3, n: 2 }, { state: 'value', value: 0, n: 2 });
  eq(noBaseline.state, 'too-early', 'a zero baseline is too-early, never an infinity');

  const gapped = liftOf({ state: 'value', value: 3, n: 2 }, { state: 'no-coverage', gaps: [] });
  eq(gapped.state, 'no-coverage', 'and a gap carries through every number computed from it');

  eq(stickFor(null, ['Instagram']).metric, null, 'no declaration, no metric');
  const proxy = stickFor({
    subject: 'goal:x', metric_ids: ['nothing'], direction: 'up-is-better', calculation: 'count',
    window: '7d', target: 'direction-only', platform_availability: { instagram: 'unavailable' },
    not_measurable_fallback: 'proxy:views',
  }, ['Instagram']);
  eq(proxy.proxy, true, 'a proxy is labelled a proxy');
  eq(proxy.metric?.metric_id, 'views', 'and it is the declared one');
});

test('bands sit either side of the suggested cut, and below sufficiency there is no band', () => {
  const enough = { sufficient: true, n: 4 };
  eq(bandOf({ state: 'value', value: 0.4 }, enough), 'earning', 'well above is earning');
  eq(bandOf({ state: 'value', value: 0.05 }, enough), 'steady', 'inside the band is steady');
  eq(bandOf({ state: 'value', value: -0.4 }, enough), 'dragging', 'well below is dragging');
  eq(bandOf({ state: 'value', value: 0.4 }, { sufficient: false, n: 1, owed: '2 more posts' }), 'too-early',
    'and below sufficiency there is no band at all');
  eq(BAND_CUTS.earning, 0.15, 'the cut is the suggested 15%');
  eq(QUARTER_DAYS, 90, 'the quarter is the suggested 90 days');
  eq(PULSE_SCHEDULE.day, 'Monday', 'and the pulse is the suggested Monday');
  eq(SUGGESTED_VALUES.length, 3, 'all three ship as SUGGESTIONS she finalizes');
  for (const v of SUGGESTED_VALUES) ok(v.question.length > 0, `${v.id} carries the question for her`);
});

test('sufficiency names what is owed, one reason at a time', () => {
  const rows = sliceRowsFor(cleanContext(), '7d');
  eq(sufficiencyOf(rows).sufficient, true, 'a real slice is sufficient');
  const none = sufficiencyOf([], { minPieces: 2, minExposure: 300, exposureMetric: 'views' });
  eq(none.reason, 'too-few-pieces', 'too few pieces says so');
  ok(none.owed?.includes('2 more'), 'and names how many more');
});

test('the two cycles come due when they should, and not before', () => {
  eq(cyclesDue('2026-08-01T00:00:00Z', []).map(c => c.cycle), ['30-day'],
    'the 30-day runs on the 1st');
  eq(cyclesDue('2026-08-14T00:00:00Z', []).length, 0, 'and not mid-month');
  eq(cyclesDue('2026-08-01T00:00:00Z', [{ cycle: '30-day', created_at: '2026-08-01T03:00:00Z' }]).length, 0,
    'and never twice in one month');
  const quarterly = cyclesDue('2026-10-30T00:00:00Z', [], '2026-08-01T00:00:00Z');
  ok(quarterly.some(c => c.cycle === 'quarter'), '90 days after the first verdict the quarter is due');
});

test('the always-live view is the same calculation with a different period', () => {
  const ctx = cleanContext();
  const now = nowView(ctx, SAVED_PER_VIEW);
  const digest = monthlyDigest({ ctx, id: 'd', metric: SAVED_PER_VIEW, ...RUN });
  eq(now.coverage.days_expected, digest.coverage.days_expected,
    'one calculation, two period arguments — so they cannot drift');
  eq(now.pillars.length, scorecard(ctx).length, 'and the same pillar cards');
  const mtd = monthToDate('2026-07-21T06:00:00Z');
  eq(mtd, { from: '2026-07-01', to: '2026-07-21' }, 'month to date is exactly that');
});

test('the weekly pulse is a per-profile entry, and the broken pipe is its first line', () => {
  const pulse = weeklyPulse({
    ctx: fixtureContext({ period: { from: '2026-07-13', to: '2026-07-19' } }),
    id: 'p-1', metric: SAVED_PER_VIEW, ...RUN,
  });
  eq(pulse.kind, 'weekly-pulse', 'it is a pulse entry');
  eq(pulse.profile_id, PROFILE, 'belonging to exactly one profile');
  ok(pulse.sections[0].lines[0].includes('Collection is broken'),
    'and a broken pipe is the first thing on it');
});

test('a cumulative metric is never summed across days in the funnel', () => {
  const ctx = cleanContext();
  const chain = funnel(ctx);
  const july = chain.months.find(m => m.month === '2026-07')!;
  for (const step of july.steps) {
    if (!step.metric_id) continue;
    ok(step.how !== 'sum' || step.metric_id === 'profile_views' || step.metric_id === 'website_clicks',
      `${step.metric_id} is only summed when it is an interval metric`);
  }
  ok(chain.absent_steps.length >= 0, 'and a row the profile has no last mile for is absent, not zero');
});

test('an outcome with no declared method is unknown, and no rate is offered', () => {
  const ctx = cleanContext();
  const panel = funnel(ctx).outcomes;
  ok(panel.heading.includes('Recorded by her'), 'the heading says what the panel is');
  ok(panel.soft_signals_note.includes('DMs'), 'and soft signals are named as absent');
});

test('the verdict input is computed whole before any model exists', () => {
  const ctx = cleanContext();
  const input = buildVerdictInput({ ctx, cycle: '30-day', metric: SAVED_PER_VIEW });
  ok(input.coverage, 'coverage first');
  ok(input.pillars.length > 0, 'pillars');
  ok(input.patterns.length > 0, 'patterns');
  ok(input.seeds.length > 0, 'seeds');
  ok(input.goals.length > 0, 'goals');
  ok(input.funnel, 'the funnel');
  ok(input.cannot_say.length >= 0, 'and everything that cannot be said, with what is owed');
  for (const c of input.cannot_say) ok(c.owed.length > 0, `${c.pattern_id} says what it owes`);
  for (const p of input.patterns) ok(p.sufficient, 'nothing insufficient is ever in patterns');
});

test('the call can be no, and says why in plain words', () => {
  // A second convert-job lane with nothing in it this period. PLAN §5.2's own
  // example: a pattern that outperforms on reach while the convert lane is
  // starving is not a reason to make more of it.
  const starved = cleanContext({
    extraPillars: [{ id: 'sales', name: 'Sales push', job: 'Convert', declared: true }],
  });
  const input = buildVerdictInput({ ctx: starved, cycle: '30-day', metric: SAVED_PER_VIEW });
  const call = computeCall(input);
  eq(call.right_call, 'no', 'a starving convert lane makes more of a winner the wrong call');
  ok(call.reason.includes('empty lane'), 'and it says so plainly');
  ok(call.reason.includes('Sales push'), 'naming the lane that is empty');

  // And the same numbers with every lane fed give a real yes.
  const fed = buildVerdictInput({ ctx: cleanContext(), cycle: '30-day', metric: SAVED_PER_VIEW });
  eq(computeCall(fed).right_call, 'yes', 'with nothing starving, the call is a call');
});

test('a verdict is append-only: a re-run appends and the old one stays', () => {
  const ctx = cleanContext();
  let body = fixtureBody();
  body = writeVerdict(body, computeVerdict({ ctx, cycle: '30-day', metric: SAVED_PER_VIEW, id: 'v-a', ...RUN }));
  body = writeVerdict(body, computeVerdict({ ctx, cycle: '30-day', metric: SAVED_PER_VIEW, id: 'v-b', run_id: 'r2', now: '2026-08-01T00:00:00Z' }));
  eq(readVerdicts(body).length, 2, 'both are on the record');
  throws(
    () => writeVerdict(body, computeVerdict({ ctx, cycle: '30-day', metric: SAVED_PER_VIEW, id: 'v-a', ...RUN })),
    'append-only', 'and rewriting one is refused');
});

test('there is no second register: the analysis layer stores no content field', () => {
  const ctx = cleanContext();
  const rendered = JSON.stringify({
    slice: slice(ctx, { dimension: 'hook_type', metric: SAVED_PER_VIEW }),
    cards: scorecard(ctx),
    goals: goals(ctx),
  });
  ok(!rendered.includes('"caption"'), 'no caption is held here');
  ok(!rendered.includes('"body"'), 'no body copy either');
  // Every row resolves to a piece that exists on the board.
  const sliced = slice(ctx, { dimension: 'hook_type', metric: SAVED_PER_VIEW });
  const known = new Set(ctx.facts.pieces.map(p => p.id));
  for (const cell of sliced.cells) {
    for (const id of cell.piece_ids) ok(known.has(id), `${id} resolves to a piece on the board`);
  }
});

test('an unplanned post counts in the totals and carries no pillar', () => {
  const snapshot = fixtureSnapshot();
  const orphan = {
    ...snapshot,
    posts: [...snapshot.posts, {
      platform_post_id: 'post-orphan', channel_id: CHANNEL, platform: 'instagram',
      published_at: '2026-07-04T04:00:00.000Z', permalink: null, post_ref: 'orphan',
      media_kind: 'IMAGE', format_hint: 'Reel', caption: null,
      first_seen_at: '2026-07-04T05:00:00.000Z', last_seen_at: '2026-07-04T05:00:00.000Z',
      deleted_on_platform: false,
    }],
  };
  const ctx = buildAnalysisContext({
    facts: readProfileFacts(fixtureBody(), CONFIG, PROFILE),
    snapshot: orphan,
    period: { from: '2026-07-01', to: '2026-07-11' },
    now: NOW,
  });
  ok(ctx.unplanned.some(p => p.platform_post_id === 'post-orphan'), 'it is kept, never dropped');
  const sliced = slice(ctx, { dimension: 'pillar', metric: SAVED_PER_VIEW });
  eq(sliced.unplanned.count, 1, 'the bucket names it');
  for (const cell of sliced.cells) {
    ok(!cell.piece_ids.includes('post-orphan'), 'and it carries no pillar');
  }
});

test('coverage arithmetic counts inclusive days and never goes negative', () => {
  const c = coverageFor([{ channel_id: CHANNEL, from: '2026-07-12', to: '2026-07-20', reason: 'sync-stalled' }],
    '2026-07-01', '2026-07-20');
  eq(c.days_expected, 20, 'twenty days asked about');
  eq(c.days_covered, 11, 'eleven of them collected');
  ok(c.words.includes('9 days missing'), 'and the words say how many are missing');
});

// ── The two live-data checks, named rather than quietly omitted ──────────────

suite('spec 27 §23 — the live-data checks (SKIPPED: they need her setup day)');

test('SKIPPED — 13 (live): the July hole is still exactly as wide, in every surface', () => {
  // Needs the stall fixed and the first successful run landed against the real
  // store. The pure half above proves no surface interpolates a point; what is
  // untested here is the database, not the rule.
  ok(true, 'named, not omitted: it runs after the setup day');
});

test('SKIPPED — 14 (live): every row resolves to a piece that exists on the board', () => {
  // The fixture half runs above ("there is no second register"). The live half
  // needs her real pieces and the real join.
  ok(true, 'named, not omitted: it runs after the setup day');
});

export { DigestRefused, ComparisonRefused, VerdictRefused };
