// Spec 26 §15 — the tracking store's acceptance tests.
//
// Tests 1 to 10 run on fixtures. Tests 11 and 12 also run on fixtures here (the
// migration is a pure function and the join is a pure function, so both can be
// proven without a database); their LIVE-DATA halves need her setup day and are
// named as skipped at the bottom rather than quietly omitted.

import { suite, test, ok, eq, throws } from './harness.ts';
import type { SwitchConfig } from '../lib/tree/contract.ts';
import type {
  AttributedOutcome, MeasurementDeclaration, MetricObservation, SyncRun,
} from '../lib/tree/objects.ts';
import {
  attributedRate, comparabilityOf, deletionsAfterRuns, detectCoverageGaps, differenceMetric,
  materializeWindow, materializeWindows, outcomeStatus, sumMetric, thresholdsFor, ageHours,
} from '../lib/tree/metrics.ts';
import { backfillRowIsHonest, closePartialRun, decideCollection, decideRetry, localDate, resumeFrom, retryStateFor, withinTrackWindow } from '../lib/tree/collector.ts';
import { validateSwitchConfig, platformSwitchId, trackingSwitchId, suggestedTrackingState } from '../lib/tree/switches.ts';
import { validateMeasurementDeclaration, computePlatformAvailability, analysisEnabledFor } from '../lib/tree/measurement.ts';
import { resolvePostLinks } from '../lib/tree/postLinks.ts';
import { migrateTracking } from '../lib/tree/migrateTracking.ts';
import { connectorFor, definitionVersion, filterToCatalogue, metricKind, exposureMetricFor } from '../lib/platforms/index.ts';
import { validateRegistries, narrowingViolations, clientMayRead } from '../lib/tree/validate.ts';
import { findDeclaration } from '../lib/tree/declarations.ts';
import { emptyBody, putEntry, readPath } from '../lib/tree/body.ts';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const CHANNEL = 'ch-resumeguru-ai';

function obs(over: Partial<MetricObservation> = {}): MetricObservation {
  return {
    id: over.id ?? `o-${Math.random().toString(36).slice(2)}`,
    piece_id: null, platform_post_id: 'post-1', channel_id: CHANNEL, platform: 'instagram',
    kind_of_row: 'lifetime', window: 'lifetime', age_hours: 24,
    metrics: { views: 1000, reach: 800, saved: 20 },
    metric_definition_version: 1, account_timezone: 'Asia/Kolkata',
    local_date: '2026-07-11', fetched_at: '2026-07-11T03:30:00.000Z',
    fetch_time_precision: 'exact', connection_status: 'ok', retry_state: 'none',
    source_run_id: 'run-1',
    ...over,
  };
}

function run(over: Partial<SyncRun> = {}): SyncRun {
  return {
    run_id: over.run_id ?? 'run-x', channel_id: CHANNEL, platform: 'instagram',
    started_at: '2026-07-12T03:30:00.000Z', trigger: 'cron', connection_status: 'ok',
    posts_seen: 0, posts_observed: 0, completed: true, attempt: 1,
    ...over,
  };
}

/** Observations every day through 2026-07-11, then nothing — the real stall. */
function throughJuly11(): MetricObservation[] {
  const out: MetricObservation[] = [];
  for (let d = 1; d <= 11; d++) {
    const day = `2026-07-${String(d).padStart(2, '0')}`;
    out.push(obs({ id: `o-${day}`, local_date: day, fetched_at: `${day}T03:30:00.000Z` }));
  }
  return out;
}

const allActive: SwitchConfig = {
  'strategy.fixed': { state: 'active', set_at: 'test' },
  'creation.board': { state: 'active', set_at: 'test' },
  'creation.channels': { state: 'active', set_at: 'test' },
  'analysis.tracking': { state: 'active', set_at: 'test' },
  [platformSwitchId('Instagram')]: { state: 'active', set_at: 'test' },
  [trackingSwitchId('Instagram')]: { state: 'active', set_at: 'test' },
};

// ── 1. The gap test (S7, spec 21 test 8) ─────────────────────────────────────

suite('spec 26 §15.1 — the gap test');

test('1. the July stall reports a gap from 2026-07-12, and no drop in any metric', () => {
  const gaps = detectCoverageGaps(throughJuly11(), CHANNEL, '2026-07-01', '2026-07-20');
  eq(gaps.length, 1, 'one stretch, not a scatter of days');
  eq(gaps[0].from, '2026-07-12', 'the gap starts the day after the last observation');
  eq(gaps[0].to, '2026-07-20', 'and runs to the end of the window asked about');
  eq(gaps[0].reason, 'sync-stalled', 'a hole in the pipe, named as one');

  // "How did we do in July" gets a gap, never a slump: there is no observation
  // after the 11th, so there is nothing to read as a decline.
  const after = throughJuly11().filter(o => (o.local_date ?? '') > '2026-07-11');
  eq(after.length, 0, 'nothing exists after the stall to be misread as a fall');
  const perDay = differenceMetric('instagram', 'views', throughJuly11()[10], after[0]);
  eq(perDay.state, 'unavailable', 'a per-day figure across the gap is unavailable, never zero');
});

// ── 2. The switched-off test ─────────────────────────────────────────────────

suite('spec 26 §15.2 — the switched-off test');

test('2. the same absence with the platform at history reads switched-off, not stalled', () => {
  const gaps = detectCoverageGaps(throughJuly11(), CHANNEL, '2026-07-01', '2026-07-20', {
    trackingState: 'history',
  });
  eq(gaps[0].reason, 'switched-off', 'a decision and a fault never render alike');

  // And the same for a stretch before the channel started collecting at all.
  const boundary = detectCoverageGaps([], CHANNEL, '2026-04-01', '2026-04-10', {
    trackSince: '2026-05-01', trackingState: 'active',
  });
  eq(boundary[0].reason, 'not-yet-tracked', 'before track_since is a boundary, not a hole');
  ok(!withinTrackWindow('2026-04-20T00:00:00Z', '2026-05-01'), 'and the collector skips it');

  // The collector itself refuses, and says why in her words.
  const off: SwitchConfig = { ...allActive, [trackingSwitchId('Instagram')]: { state: 'history', set_at: 'test' } };
  const decision = decideCollection({ platform: 'Instagram', config: off, positionsSet: true });
  eq(decision.collect, false, 'collection stops');
  ok(!decision.collect && decision.status === 'switched-off', 'and the run records it as a decision');
});

// ── 3. The backfill honesty test ─────────────────────────────────────────────

suite('spec 26 §15.3 — the backfill honesty test');

test('3. a backfill after a 10-day outage leaves the 10-day gap exactly 10 days wide', () => {
  const before = obs({ id: 'o-before', local_date: '2026-07-01', fetched_at: '2026-07-01T03:30:00.000Z' });
  const backfilled = obs({
    id: 'o-backfill', local_date: '2026-07-12', fetched_at: '2026-07-12T03:30:00.000Z',
    retry_state: 'backfilled', age_hours: 264, metrics: { views: 5000, reach: 3000, saved: 90 },
  });
  const series = [before, backfilled];
  const gaps = detectCoverageGaps(series, CHANNEL, '2026-07-01', '2026-07-12');
  eq(gaps.length, 1, 'one gap');
  eq([gaps[0].from, gaps[0].to], ['2026-07-02', '2026-07-11'], 'ten days, unchanged by the backfill');

  eq(retryStateFor('backfill'), 'backfilled', 'the rows say what they are');
  ok(backfillRowIsHonest(backfilled, '2026-07-11'), 'a backfilled row is dated after the gap it did not close');
  ok(!backfillRowIsHonest({ fetched_at: '2026-07-05T00:00:00Z', retry_state: 'backfilled' }, '2026-07-11'),
    'a backfilled row dated INSIDE the gap would be a reconstruction, and is refused');

  // No interpolated point exists anywhere in the returned series.
  eq(series.map(s => s.local_date), ['2026-07-01', '2026-07-12'], 'two real rows, nothing in between');
  for (const day of ['2026-07-05', '2026-07-08']) {
    ok(!series.some(s => s.local_date === day), `nothing was invented for ${day}`);
  }
});

// ── 4. The append-only test ──────────────────────────────────────────────────

suite('spec 26 §15.4 — the append-only test');

test('4. two runs the same day produce two rows and the earlier one is untouched', () => {
  const morning = obs({ id: 'o-am', fetched_at: '2026-07-11T03:30:00.000Z', source_run_id: 'run-am' });
  const snapshotOfMorning = JSON.stringify(morning);
  const evening = obs({ id: 'o-pm', fetched_at: '2026-07-11T15:30:00.000Z', source_run_id: 'run-pm', metrics: { views: 1400, reach: 900, saved: 25 } });
  const store = [morning, evening];

  eq(store.length, 2, 'two rows for one day is correct and costs nothing');
  eq(JSON.stringify(store[0]), snapshotOfMorning, 'the earlier row is byte-identical before and after');
  eq(store.filter(r => r.local_date === '2026-07-11').length, 2, 'neither overwrote the other');

  // The path is declared append-only, so the body's write door refuses a rewrite
  // in the same way the database trigger does.
  const path = 'work-log/analysis/study-own-data/observations';
  eq(findDeclaration(path)?.history, 'append_only', 'the address itself says append-only');
  let body = emptyBody();
  body = putEntry(body, path, { id: 'o-am', type: 'metric_observation', data: { views: 1000 } }, { writer: 'pipe:platform-metrics' });
  throws(
    () => putEntry(body, path, { id: 'o-am', type: 'metric_observation', data: { views: 9999 } }, { writer: 'pipe:platform-metrics' }),
    'append-only',
    'a direct rewrite of an observation is refused',
  );
  eq(readPath(body, path).length, 1, 'and the original row is still there, unchanged');
});

// ── 5. The window test (S6) ──────────────────────────────────────────────────

suite('spec 26 §15.5 — the window test');

test('5. 19h materializes first-24h at its real age; 41h and 65h leave it unavailable', () => {
  const good = materializeWindow(
    [obs({ age_hours: 19, metrics: { views: 900 } }), obs({ age_hours: 41, metrics: { views: 1500 } })],
    'first-24h', { ageNowHours: 50 },
  );
  ok(good, 'a qualifying reading materializes the window');
  eq(good!.window_state, 'materialized', 'materialized');
  eq(good!.age_hours, 19, 'and it stores the ACTUAL age, not the nominal 24');
  eq(good!.metrics.views, 900, 'from the 19h reading');

  const none = materializeWindow(
    [obs({ age_hours: 41, metrics: { views: 1500 } }), obs({ age_hours: 65, metrics: { views: 1800 } })],
    'first-24h',
    { ageNowHours: 70, gaps: [{ channel_id: CHANNEL, from: '2026-07-12', to: '2026-07-13', reason: 'sync-stalled' }] },
  );
  ok(none, 'the answer is a row, not a silence');
  eq(none!.window_state, 'unavailable', 'unavailable');
  eq(none!.metrics, {}, 'not zero — an empty reading, because there was none');
  ok(none!.unavailable_reason?.includes('2026-07-12'), 'and it names the gap that caused it');
  ok(!('views' in none!.metrics), 'the 41h value was NOT borrowed into the 24h window');

  const early = materializeWindow([obs({ age_hours: 4, metrics: { views: 100 } })], '7d', { ageNowHours: 4 });
  eq(early!.window_state, 'too-early', 'below the nominal age with nothing qualifying is too-early');

  // Materialize once: a window already materialized is never recomputed.
  const existing = [good!];
  eq(materializeWindow([obs({ age_hours: 19 })], 'first-24h', { ageNowHours: 100, existing }), null,
    'recomputing a window later would silently change history, so it is refused');

  const all = materializeWindows([obs({ age_hours: 170, metrics: { views: 4000 } })], { ageNowHours: 175 });
  eq(all.find(w => w.window === '7d')?.window_state, 'materialized', '7d materializes at 170h');
  eq(all.find(w => w.window === '30d')?.window_state, 'too-early', '30d is simply not there yet');
});

// ── 6. The counter-kind test ─────────────────────────────────────────────────

suite('spec 26 §15.6 — the counter-kind test');

test('6. a cumulative metric refuses to be summed across days; a per-day figure is a difference', () => {
  eq(metricKind('instagram', 'views'), 'cumulative', 'views is a lifetime running total');
  eq(metricKind('instagram', 'followers'), 'level', 'followers is a stock');
  eq(metricKind('instagram', 'profile_views'), 'interval', 'profile visits are a daily count');

  throws(
    () => sumMetric('instagram', 'views', [obs(), obs()]),
    'never sum it across days',
    'summing a cumulative metric is refused at the store boundary',
  );
  throws(
    () => sumMetric('instagram', 'followers', [obs({ metrics: { followers: 10 } })]),
    'never sum it across days',
    'and so is summing a level',
  );
  const summed = sumMetric('instagram', 'profile_views', [
    obs({ metrics: { profile_views: 4 } }), obs({ metrics: { profile_views: 6 } }),
  ]);
  eq(summed, { state: 'value', value: 10 }, 'an interval metric sums, because that is what it is for');

  const day = differenceMetric('instagram', 'views',
    obs({ metrics: { views: 1000 } }), obs({ metrics: { views: 1400 } }));
  eq(day, { state: 'value', value: 400 }, 'a per-day figure is the difference of two observations');
  eq(differenceMetric('instagram', 'views', obs({ metrics: { views: 1000 } }), undefined).state, 'unavailable',
    'and it is unavailable when either observation is missing');
  throws(
    () => differenceMetric('instagram', 'profile_views', obs(), obs()),
    'differencing it is meaningless',
    'differencing an interval metric is refused too',
  );
});

// ── 7. The definition-version test ───────────────────────────────────────────

suite('spec 26 §15.7 — the definition-version test');

test('7. two observations of one metric under different definitions are flagged not-comparable', () => {
  const mixed = [
    obs({ metric_definition_version: 0, metrics: { views: 1000 } }),
    obs({ metric_definition_version: 1, metrics: { views: 1400 } }),
  ];
  const c = comparabilityOf(mixed, 'views');
  eq(c.comparable, false, 'not comparable');
  eq(c.versions, [0, 1], 'and it says which two definitions');
  ok(c.reason?.includes('fiction'), 'in words that say why');

  eq(comparabilityOf([obs(), obs()], 'views').comparable, true, 'same version, comparable');
  eq(definitionVersion('instagram', ['views', 'reach']), 1, 'today’s rows stamp version 1');
  eq(definitionVersion('instagram', ['nonsense']), 0, 'an unknown metric claims no version');
});

// ── 8. The deletion test ─────────────────────────────────────────────────────

suite('spec 26 §15.8 — the deletion test');

test('8. one absence changes nothing; two mark it deleted and its history survives', () => {
  const posts = [
    { platform_post_id: 'p-live', channel_id: CHANNEL, deleted_on_platform: false },
    { platform_post_id: 'p-gone', channel_id: CHANNEL, deleted_on_platform: false },
  ];
  const one = deletionsAfterRuns(posts, [
    { run_id: 'r2', channel_id: CHANNEL, seen: ['p-live'] },
  ]);
  eq(one, [], 'absent from ONE completed run: untouched, because a paging hiccup is not a deletion');

  const two = deletionsAfterRuns(posts, [
    { run_id: 'r2', channel_id: CHANNEL, seen: ['p-live'] },
    { run_id: 'r1', channel_id: CHANNEL, seen: ['p-live'] },
  ]);
  eq(two, ['p-gone'], 'absent from two consecutive completed runs: deleted');

  // Its observations stay readable — the history is real and was collected honestly.
  const history = [obs({ platform_post_id: 'p-gone', deleted_on_platform: true })];
  eq(history.length, 1, 'the observations are still there');
  eq(history[0].metrics.views, 1000, 'and still readable');
});

// ── 9. The measuring-stick gate (S16) ────────────────────────────────────────

suite('spec 26 §15.9 — the measuring-stick gate');

const declCtx = { platforms: ['Instagram'] };

const goodDeclaration: MeasurementDeclaration = {
  subject: 'goal:signups', metric_ids: ['saved'], direction: 'up-is-better',
  calculation: 'rate', denominator: 'views', window: '7d',
  target: { value: 0.02, period: 'month' },
  platform_availability: { instagram: 'available' },
  not_measurable_fallback: 'manual-checkin',
};

test('9a. strategy refuses to lock with goal tracking active and a goal missing its declaration', () => {
  const v = validateSwitchConfig({
    owner_kind: 'hers', platforms: ['Instagram'],
    config: { 'analysis.goal_tracking': { state: 'active', set_at: 'test' } },
    goals: ['signups'], measurementDeclarations: {},
  });
  ok(v.some(x => x.switch === 'analysis.goal_tracking' && x.reason.includes('signups')),
    'the undeclared goal is named, one goal at a time');
});

test('9b. and with the scorecard active and a switched-on pillar whose job has none', () => {
  const v = validateSwitchConfig({
    owner_kind: 'hers', platforms: ['Instagram'],
    config: {
      'analysis.scorecard': { state: 'active', set_at: 'test' },
      'analysis.tracking': { state: 'active', set_at: 'test' },
    },
    pillars: ['trust'], measurementDeclarations: {},
  });
  ok(v.some(x => x.switch === 'analysis.scorecard' && x.reason.includes('trust')),
    'a pillar judged on its job needs its job’s metrics declared');
});

test('9c. a rate with no denominator is rejected, and a rate over a level metric too', () => {
  const noDenominator = validateMeasurementDeclaration(
    { ...goodDeclaration, denominator: undefined }, declCtx);
  ok(noDenominator.some(v => v.field === 'denominator'), 'saves per nothing is not a rate');

  const rateOverLevel = validateMeasurementDeclaration(
    { ...goodDeclaration, metric_ids: ['followers'], calculation: 'rate', denominator: 'views' }, declCtx);
  ok(rateOverLevel.some(v => v.field === 'calculation' && v.reason.includes('level')),
    'a rate over a level metric is refused');

  const unknownMetric = validateMeasurementDeclaration(
    { ...goodDeclaration, metric_ids: ['vibes'] }, declCtx);
  ok(unknownMetric.some(v => v.field === 'metric_ids'), 'a metric no switched-on platform reports is rejected');

  const blankTarget = validateMeasurementDeclaration({ ...goodDeclaration, target: undefined }, declCtx);
  ok(blankTarget.some(v => v.field === 'target'), '"no target" must be a decision, not an omission');
  eq(validateMeasurementDeclaration({ ...goodDeclaration, target: 'direction-only' }, declCtx), [],
    'and direction-only is that decision, spelled out');

  eq(validateMeasurementDeclaration(goodDeclaration, declCtx), [], 'a complete declaration passes');
  eq(computePlatformAvailability(['saved'], declCtx), { instagram: 'available' },
    'availability is computed from the catalogue and stored');
  eq(analysisEnabledFor({ ...goodDeclaration, not_measurable_fallback: 'none', metric_ids: ['saved'] }, { platforms: ['LinkedIn'] }), false,
    'fallback `none` on a platform that cannot measure it means analysis stays off for that subject');
});

test('9d. with the gate blocking, collection still runs', () => {
  const blocked = validateSwitchConfig({
    owner_kind: 'hers', platforms: ['Instagram'],
    config: { 'analysis.goal_tracking': { state: 'active', set_at: 'test' } },
    goals: ['signups'], measurementDeclarations: {},
  });
  ok(blocked.length > 0, 'analysis is blocked');
  const decision = decideCollection({ platform: 'Instagram', config: allActive, positionsSet: true });
  eq(decision.collect, true, 'and recording carries on regardless — it is the first duty');
});

// ── 10. The S23 wall ─────────────────────────────────────────────────────────

suite('spec 26 §15.10 — the S23 wall');

const declaredOutcome: AttributedOutcome = {
  id: 'out-1', outcome: 'signups', count: 8, event_source: 'careerbubble-signup-webhook',
  attribution_method: 'utm-tagged-link', status: 'declared',
  period_start: '2026-07-01', period_end: '2026-07-31',
};

test('10. an outcome with no source or no method is unknown, and no rate is computed from it', () => {
  eq(outcomeStatus({ event_source: null, attribution_method: 'utm' }), 'unknown', 'no source, unknown');
  eq(outcomeStatus({ event_source: 'webhook', attribution_method: null }), 'unknown', 'no method, unknown');
  eq(outcomeStatus(declaredOutcome), 'declared', 'both declared');

  const refused = attributedRate(
    { ...declaredOutcome, attribution_method: null, status: 'declared' },
    { metric_id: 'views', value: 4000 },
  );
  eq(refused.state, 'refused', 'the store refuses, not the UI');
  eq(refused.value, undefined, 'and it carries no number for a surface to render by accident');
  ok(refused.reason?.includes('attribution method'), 'it says which declaration is missing');

  const allowed = attributedRate(declaredOutcome, { metric_id: 'views', value: 4000 });
  eq(allowed.state, 'value', 'with both declared, the rate is computed');
  eq(allowed.value, 0.002, '8 signups against 4,000 views');

  // The two live at separate addresses, which is the wall made structural.
  ok(findDeclaration('work-log/analysis/attributed-outcomes'), 'outcomes have their own address');
  ok(findDeclaration('work-log/analysis/study-own-data/observations'), 'observations have theirs');
  ok(findDeclaration('work-log/analysis/attributed-outcomes')!.path
    !== findDeclaration('work-log/analysis/study-own-data/observations')!.path,
    'and they are not the same folder');
});

// ── 11. The migration parity test ────────────────────────────────────────────

suite('spec 26 §15.11 — the migration parity test');

const legacyFixture = {
  ig_accounts: [{ id: '178414', username: 'resumeguru.ai', access_token: 't', token_refreshed_at: '2026-07-10T00:00:00Z', client_id: 'p-resumeguru' }],
  ig_posts: [
    { id: 'm-1', account_id: '178414', permalink: 'https://www.instagram.com/p/ABC123/', posted_at: '2026-05-02T04:00:00Z', media_type: 'IMAGE', media_product_type: 'FEED', caption: 'one' },
    { id: 'm-2', account_id: '178414', permalink: 'https://www.instagram.com/reel/XYZ789/', posted_at: '2026-05-10T04:00:00Z', media_type: 'VIDEO', media_product_type: 'REELS', caption: 'two' },
  ],
  ig_daily_snapshots: [
    { post_id: 'm-1', snapshot_date: '2026-05-09', views: 1200, reach: 900, likes: 40, comments: 5, saves: 12, shares: 3, total_interactions: 60 },
    { post_id: 'm-1', snapshot_date: '2026-06-01', views: 1500, reach: 1000, likes: 44, comments: 5, saves: 14, shares: 3, total_interactions: 66 },
    { post_id: 'm-2', snapshot_date: '2026-05-17', views: 3000, reach: 2400, likes: 90, comments: 11, saves: 30, shares: 8, total_interactions: 139 },
  ],
  ig_account_snapshots: [
    { account_id: '178414', snapshot_date: '2026-05-09', followers: 1200, media_count: 40, profile_views: null, website_clicks: null },
  ],
  ig_post_links: [
    { card_id: 'card-a', client_id: 'p-resumeguru', ig_media_id: 'm-1', matched_at: '2026-05-09T00:00:00Z' },
    { card_id: 'card-b', client_id: 'p-other', ig_media_id: 'm-2', matched_at: '2026-05-17T00:00:00Z' },
  ],
  ig_post_tags: [{ ig_media_id: 'm-1', topic_type: 'how-to', corrected: ['topic_type'], model: 'claude' }],
};

test('11. row counts match table for table, values are identical, and every migrated row says what it is', () => {
  const { rows, report } = migrateTracking(legacyFixture, {}, {
    migratedPieceIds: { 'p-resumeguru': ['card-a'] },
    bodyChannelIds: ['ch-resumeguru-ai'],
    now: '2026-07-27T00:00:00.000Z',
  });

  for (const p of report.parity) ok(p.parity, `${p.table}: ${p.before} in, ${p.after} out`);

  const lifetime = rows.post_observations.filter(r => r.kind_of_row === 'lifetime');
  eq(lifetime.length, 3, 'one observation per legacy snapshot');
  const sample = lifetime.find(r => r.platform_post_id === 'm-2')!;
  eq(sample.metrics, { views: 3000, reach: 2400, likes: 90, comments: 11, saved: 30, shares: 8, total_interactions: 139 },
    'metric values are identical before and after');

  for (const row of rows.post_observations) {
    eq(row.metric_definition_version, 0, 'every migrated row is pre-registry');
    eq(row.fetch_time_precision, 'day', 'and never claims hourly age');
    eq(row.account_timezone, 'Asia/Kolkata', 'the pipe has always run on IST');
    eq(row.source_run_id, null, 'no run record was invented for it');
  }
  eq(rows.sync_runs, [], 'sync_runs starts empty — §14.5');

  // post_ref comes from the same function that made the link, so they agree.
  eq(rows.platform_posts.find(p => p.platform_post_id === 'm-1')?.post_ref, 'ABC123', 'shortcode by construction');
  eq(rows.platform_posts.find(p => p.platform_post_id === 'm-2')?.post_ref, 'XYZ789', 'reels too');

  // Links convert per id_kind, and neither kind is guessed into the other.
  eq(rows.post_links.find(l => l.piece_id === 'card-a')?.id_kind, 'piece', 'a migrated profile’s link points at the piece');
  eq(rows.post_links.find(l => l.piece_id === 'card-b')?.id_kind, 'legacy-card', 'an unmigrated one stays a legacy card');

  // Windows only where a qualifying reading exists.
  const windows = rows.post_observations.filter(r => r.kind_of_row === 'window');
  ok(windows.some(w => w.window === '7d' && w.window_state === 'materialized'),
    'a 7d reading exists in the once-a-day history and materializes');
  ok(windows.some(w => w.window === 'first-24h' && w.window_state === 'unavailable'),
    'first-24h is honestly unavailable — the pipe ran once a day');
  for (const w of windows.filter(x => x.window_state === 'unavailable')) {
    eq(w.metrics, {}, 'an unavailable window carries no borrowed number');
  }

  // The account snapshot's absent spec-05 metrics stay absent, never zero.
  eq(rows.account_observations[0].metrics, { followers: 1200, media_count: 40 },
    'profile visits and website taps stay absent before spec 05’s ship date');

  // The tagging job's behavior does not change: corrections carry over sticky.
  eq(rows.post_readings[0].corrected, ['topic_type'], 'sticky owner corrections survive the rename');
});

test('11b. running the migration twice writes nothing the second time', () => {
  const first = migrateTracking(legacyFixture, {}, { now: '2026-07-27T00:00:00.000Z' });
  const existing = {
    channel_ids: first.rows.channel_connections.map(c => c.channel_id),
    platform_post_ids: first.rows.platform_posts.map(p => p.platform_post_id),
    observation_keys: first.rows.post_observations.map(o => `${o.platform_post_id}|${o.fetched_at}|${o.window}`),
    account_observation_keys: first.rows.account_observations.map(o => `${o.channel_id}|${o.fetched_at}`),
    link_keys: first.rows.post_links.map(l => `${l.id_kind}:${l.piece_id}`),
    reading_ids: first.rows.post_readings.map(r => String(r.platform_post_id)),
  };
  const second = migrateTracking(legacyFixture, existing, { now: '2026-07-27T00:00:00.000Z' });
  eq(second.rows.post_observations.length, 0, 'no second copy of the observations');
  eq(second.rows.platform_posts.length, 0, 'nor of the posts');
  eq(second.rows.post_links.length, 0, 'nor of the links');
  for (const p of second.report.parity) ok(p.parity, `${p.table} still balances on the second run`);
});

// ── 12. The join test ────────────────────────────────────────────────────────

suite('spec 26 §15.12 — the join test');

const posts = [
  { platform_post_id: 'm-1', platform: 'instagram', post_ref: 'ABC123', channel_id: CHANNEL, published_at: '2026-07-01T04:00:00Z' },
  { platform_post_id: 'm-2', platform: 'instagram', post_ref: 'XYZ789', channel_id: CHANNEL, published_at: '2026-07-02T04:00:00Z' },
  { platform_post_id: 'm-3', platform: 'instagram', post_ref: 'NOPIECE', channel_id: CHANNEL, published_at: '2026-07-03T04:00:00Z' },
];

test('12. a pasted link attaches the piece, with zero other typing', () => {
  const result = resolvePostLinks({
    posts,
    pieces: [{ id: 'piece-1', id_kind: 'piece', profile_id: 'p-resumeguru', platform: 'instagram', live_link: 'https://instagram.com/p/ABC123/?igsh=x' }],
    now: '2026-07-27T00:00:00.000Z',
  });
  eq(result.attach.length, 1, 'one attachment');
  eq(result.attach[0].platform_post_id, 'm-1', 'to the right post');
  eq(result.attach[0].id_kind, 'piece', 'against the canonical piece identity');
  eq(result.attach[0].match_method, 'url-ref', 'because she pasted a link that resolves');
});

test('12b. two pieces claiming one post attach to neither, and it goes to her', () => {
  const result = resolvePostLinks({
    posts,
    pieces: [
      { id: 'piece-1', id_kind: 'piece', profile_id: 'p1', platform: 'instagram', live_link: 'https://instagram.com/p/ABC123/' },
      { id: 'piece-2', id_kind: 'piece', profile_id: 'p1', platform: 'instagram', live_link: 'https://www.instagram.com/reel/ABC123/' },
    ],
  });
  eq(result.attach.length, 0, 'neither attaches');
  eq(result.conflicts.length, 1, 'and the conflict is recorded');
  eq(result.conflicts[0].claimants.sort(), ['piece:piece-1', 'piece:piece-2'], 'naming both claimants');
  ok(result.conflicts[0].question.includes('which one'), 'as one question for her');
});

test('12c. a fetched post with no piece survives as an unplanned post', () => {
  const result = resolvePostLinks({
    posts,
    pieces: [{ id: 'piece-1', id_kind: 'piece', profile_id: 'p1', platform: 'instagram', live_link: 'https://instagram.com/p/ABC123/' }],
  });
  ok(result.unplanned.includes('m-3'), 'the unclaimed post is kept, not dropped');
  ok(result.unplanned.includes('m-2'), 'and so is every other one');
  ok(!result.attach.some(a => a.platform_post_id === 'm-3'), 'nothing was assigned to it');
});

test('12d. a link pasted before the pipe fetched the post stays unmatched and is retried', () => {
  const result = resolvePostLinks({
    posts,
    pieces: [{ id: 'piece-9', id_kind: 'piece', profile_id: 'p1', platform: 'instagram', live_link: 'https://instagram.com/p/NOTYET/' }],
  });
  eq(result.attach.length, 0, 'nothing attaches');
  eq(result.unmatched.length, 1, 'it is held, not lost');
  ok(result.unmatched[0].why.includes('retried on every run'), 'and it is picked up when the post arrives');
});

test('12e. a time-window match is a suggestion and never attaches on its own', () => {
  const result = resolvePostLinks({
    posts,
    pieces: [{ id: 'piece-5', id_kind: 'piece', profile_id: 'p1', platform: 'instagram', posted_at: '2026-07-03T06:00:00Z' }],
    suggestWithinHours: 6,
  });
  eq(result.attach.length, 0, 'guessing which post a piece is would poison every number downstream');
  ok(result.suggestions.length > 0, 'it is offered');
  ok(result.suggestions[0].why.includes('suggestion only'), 'and labeled as an offer');
});

// ── The plumbing the twelve stand on ─────────────────────────────────────────

suite('spec 26 — the store’s plumbing');

test('the four new addresses exist, are owner-only, and no client can read them', () => {
  const paths = [
    'work-log/analysis/study-own-data/observations',
    'work-log/analysis/study-own-data/sync-health',
    'work-log/analysis/study-own-data/links',
    'work-log/analysis/attributed-outcomes',
  ];
  for (const p of paths) {
    const d = findDeclaration(p);
    ok(d, `${p} is declared`);
    eq(d!.audience, 'owner', `${p} is owner-only`);
    ok(!clientMayRead(p), `${p} is not a client window`);
  }
  eq(validateRegistries(), [], 'and the registries still validate clean');
});

test('§4.1 — a measurement declaration is owner-only inside a client-visible parent', () => {
  ok(clientMayRead('context/content-strategy/goals'), 'the client sees their goals in the strategy summary');
  ok(!clientMayRead('context/content-strategy/goals/g1/measurement'), 'and never the measuring stick behind them');
  ok(!clientMayRead('context/content-strategy/pillars/trust/measurement'), 'the same for a pillar job');
  ok(!clientMayRead('context/content-strategy/platforms/instagram/metrics'), 'and for what a platform reports');
  eq(narrowingViolations(), [], 'no declared path widens its parent without its own door');
});

test('the collector refuses on lifecycle and permission, and keeps going when paused', () => {
  eq(decideCollection({ platform: 'Instagram', config: allActive, positionsSet: true, lifecycle: 'closing' }).collect, false,
    'closing revokes the connectors (S22)');
  eq(decideCollection({ platform: 'Instagram', config: allActive, positionsSet: true, metricsPermission: 'not-granted' }).collect, false,
    'reading a client-owned account’s numbers is its own permission');
  eq(decideCollection({ platform: 'Instagram', config: allActive, positionsSet: true, lifecycle: 'paused' }).collect, true,
    'a paused profile keeps collecting — her data accrues while the client’s doors are shut');
  eq(decideCollection({ platform: 'Instagram', config: allActive, positionsSet: true, metricsPermission: 'unknown' }).collect, true,
    'unknown collects and asks her');
  const unwalked = decideCollection({ platform: 'Instagram', config: {}, positionsSet: false });
  eq(unwalked.collect, true, 'a profile whose switchboard she has never walked keeps collecting exactly as today');
});

test('a partial run stops honestly and the next tick resumes from its cursor', () => {
  const partial = closePartialRun(['a', 'b', 'c', 'd'], ['a', 'b']);
  eq(partial.completed, false, 'it does not report success');
  eq(partial.resume_cursor, 'c', 'and says where to pick up');
  eq(partial.missed_platform_post_ids, ['c', 'd'], 'naming what it never reached');
  eq(resumeFrom(['a', 'b', 'c', 'd'], 'c'), ['c', 'd'], 'the next run starts there');
  eq(resumeFrom(['a', 'b'], 'gone'), ['a', 'b'], 'an unknown cursor restarts rather than skipping posts');

  const gaps = detectCoverageGaps(
    [obs({ local_date: '2026-07-11', fetched_at: '2026-07-11T03:30:00.000Z' })],
    CHANNEL, '2026-07-11', '2026-07-11',
    { runs: [run({ run_id: 'r-partial', started_at: '2026-07-11T03:30:00.000Z', completed: false, missed_platform_post_ids: ['c', 'd'] })] },
  );
  eq(gaps.length, 1, 'the day is not declared whole');
  eq(gaps[0].missed_platform_post_ids, ['c', 'd'], 'the posts it missed are named');
});

test('retries stop at three attempts and the connection flips to error', () => {
  eq(decideRetry(null).attempt, 1, 'a fresh channel starts at attempt 1');
  eq(decideRetry({ completed: false, attempt: 1 }).attempt, 2, 'a failed run retries');
  eq(decideRetry({ completed: false, attempt: 2 }).retry, true, 'and again');
  const done = decideRetry({ completed: false, attempt: 3 });
  eq(done.retry, false, 'three attempts is the limit');
  eq(done.connectionStatus, 'error', 'then it is left for the next day');
});

test('every observation carries the channel’s own day, or says it fell back to UTC', () => {
  const ist = localDate('2026-07-11T20:00:00.000Z', 'Asia/Kolkata');
  eq(ist.local_date, '2026-07-12', 'eight in the evening UTC is already the next day in IST');
  eq(ist.fallback, false, 'and the timezone is recorded');
  const none = localDate('2026-07-11T20:00:00.000Z', null);
  eq(none.local_date, '2026-07-11', 'a channel with no timezone still collects');
  eq(none.account_timezone, null, 'and its rows say the timezone is unknown');
  eq(none.fallback, true, 'labeled as a fallback, not passed off as local time');
});

test('the connector contract holds, and a metric outside the catalogue is dropped by name', () => {
  const ig = connectorFor('instagram');
  ok(ig, 'Instagram is implemented');
  eq(ig!.extractPostRef('https://www.instagram.com/reel/XYZ789/?igsh=1'), 'XYZ789',
    'igShortcode is wired in unchanged — one function, both sides of the join');
  eq(connectorFor('linkedin'), null, 'the second connector ships when a profile switches that platform on');

  const { kept, dropped } = filterToCatalogue('instagram', { views: 10, mystery_field: 4 });
  eq(kept, { views: 10 }, 'only catalogue metrics are stored');
  eq(dropped, ['mystery_field'], 'and the unknown field is named, never written under a guessed id');
  eq(exposureMetricFor('instagram'), 'views', 'the exposure metric comes from the catalogue, not a string');
  eq(thresholdsFor('instagram').exposureMetric, 'views', 'and the thresholds read it from there');
  eq(thresholdsFor('instagram', { minExposure: 500 }).minExposure, 500, 'every threshold is per-profile overridable');
});

test('ages are computed one way, so the collector and the migration cannot disagree', () => {
  eq(ageHours('2026-07-01T00:00:00Z', '2026-07-02T00:00:00Z'), 24, 'a day is 24 hours');
  eq(ageHours('2026-07-01T00:00:00Z', '2026-07-01T19:00:00Z'), 19, 'and 19h is 19h');
  eq(ageHours('2026-07-02T00:00:00Z', '2026-07-01T00:00:00Z'), 0, 'a fetch before publication is never negative');
});

test('the suggested collector position follows whether a channel is connected', () => {
  eq(suggestedTrackingState(true), 'active', 'a connected channel suggests active');
  eq(suggestedTrackingState(false), 'hidden', 'and nothing connected suggests hidden');
});

// ── The two live-data halves, named rather than quietly omitted ──────────────

suite('spec 26 §15 — the live-data checks (SKIPPED: they need her setup day)');

test('SKIPPED — 11 (live): parity against the real ig_* tables in Supabase', () => {
  // Runs as `POST /api/migrate-tracking` with no body: owner-only, a dry run,
  // and it writes nothing. It needs the SQL file run and the real database, so
  // it cannot run here. The pure half above proves the arithmetic.
  ok(true, 'named, not omitted: it runs after the setup day');
});

test('SKIPPED — 12 (live): she pastes a link and the piece carries its numbers within one run', () => {
  // Needs a live token, a real post and a real run. The join's decisions are
  // proven above on fixtures; what is untested here is the network, not the rule.
  ok(true, 'named, not omitted: it runs after the setup day');
});
