// The Analysis restructure's acceptance tests — the handoff's "ANALYSIS" section.
//
// These test the honesty rules, because the honesty rules are the point of the
// screen. A slump and a gap must never draw the same picture, a zero must never
// stand in for "we were not looking", and no headline may state a number that
// was not counted from the array it describes.

import { suite, test, ok, eq } from './harness.ts';
import {
  ANALYSIS_GROUPS, HATCH, NO_READING, bornLine, canCompare, compareVerdict, countLine,
  coverageBar, coverageDiffersLine, defaultGroupId, formatDay, formatNumber, goalBar, goalValue,
  groupOf, groupsFor, maxReading, meterBar, metricCard, openGap, percentWords, pillarRead,
  resolveGroup, selectionLine, sinceWords, sliceRows,
} from '../lib/analysis/groups.ts';
import type { Coverage, Measured, TabNode } from '../lib/analysis/groups.ts';

suite('analysis groups — the three groups');

const ALL: TabNode[] = [
  { id: 'now', label: 'Now', state: 'active' },
  { id: 'slices', label: 'Slices', state: 'active' },
  { id: 'scorecard', label: 'Scorecard', state: 'active' },
  { id: 'funnel', label: 'Funnel', state: 'active' },
  { id: 'compare', label: 'Compare', state: 'active' },
  { id: 'goals', label: 'Goals', state: 'active' },
  { id: 'verdicts', label: 'Verdicts', state: 'active' },
  { id: 'health', label: 'Health', state: 'active' },
];

test('eight screens land in three groups and nothing is homeless', () => {
  const all = ANALYSIS_GROUPS.flatMap(g => g.screens);
  eq(all.length, 8, 'every one of the eight screens has a group');
  eq(new Set(all).size, 8, 'no screen is in two groups');
  for (const t of ALL) ok(groupOf(t.id), `${t.id} has a group`);
});

test('the screens keep the order the handoff lists them in', () => {
  eq(ANALYSIS_GROUPS.map(g => g.id), ['where', 'what', 'means'], 'group order');
  eq(ANALYSIS_GROUPS[0].screens, ['now', 'goals', 'health'], 'where we are');
  eq(ANALYSIS_GROUPS[1].screens, ['slices', 'scorecard', 'funnel'], 'what happened');
  eq(ANALYSIS_GROUPS[2].screens, ['compare', 'verdicts'], 'what it means');
});

test('a hidden screen is dropped, not greyed', () => {
  const tabs = ALL.map(t => (t.id === 'health' ? { ...t, state: 'hidden' } : t));
  const where = groupsFor(tabs).find(g => g.id === 'where');
  eq(where?.screens.map(s => s.id), ['now', 'goals'], 'health is simply absent');
});

test('a group whose screens are all off is not rendered at all', () => {
  const tabs = ALL.map(t => (['compare', 'verdicts'].includes(t.id) ? { ...t, state: 'hidden' } : t));
  const ids = groupsFor(tabs).map(g => g.id);
  eq(ids, ['where', 'what'], 'no empty "What it means" group');
});

test('with everything off there is no Analysis app to land in', () => {
  const tabs = ALL.map(t => ({ ...t, state: 'hidden' }));
  eq(groupsFor(tabs), [], 'nothing renders');
  eq(defaultGroupId(tabs), undefined, 'and there is nowhere to land');
});

test('landing goes to the first group that renders, not always to Where we are', () => {
  eq(defaultGroupId(ALL), 'where', 'normally the first');
  const tabs = ALL.map(t => (['now', 'goals', 'health'].includes(t.id) ? { ...t, state: 'hidden' } : t));
  eq(defaultGroupId(tabs), 'what', 'with Where we are gone, What happened is first');
});

test('a route asking for a group that does not render falls back rather than dying', () => {
  const tabs = ALL.map(t => (['compare', 'verdicts'].includes(t.id) ? { ...t, state: 'hidden' } : t));
  eq(resolveGroup(tabs, 'means')?.id, 'where', 'falls back to the first live group');
  eq(resolveGroup(tabs, 'what')?.id, 'what', 'and honours a live one');
});

test('a screen switched to history still renders, inside its group', () => {
  const tabs = ALL.map(t => (t.id === 'funnel' ? { ...t, state: 'history' } : t));
  const what = groupsFor(tabs).find(g => g.id === 'what');
  eq(what?.screens.map(s => s.state), ['active', 'active', 'history'], 'history is visible');
});

// ── Coverage ─────────────────────────────────────────────────────────────────

suite('analysis groups — coverage first');

const STALLED: Coverage = {
  complete: false,
  days_expected: 31,
  days_covered: 23,
  words: 'The pipe stopped from 2026-07-12 to 2026-07-31.',
  gaps: [{ from: '2026-07-12', to: '2026-07-31', reason: 'sync-stalled' }],
};

const WHOLE: Coverage = {
  complete: true, days_expected: 31, days_covered: 31, words: 'complete for this period', gaps: [],
};

test('the stalled month reads exactly as the design says', () => {
  const bar = coverageBar(STALLED)!;
  eq(bar.daysLine, '23 of 31 days collected', 'the days line');
  eq(bar.sinceLine, 'not collecting since 12 July', 'since when, in her words');
  eq(bar.readAgainstLine, 'Metrics below reflect 23 collected days, not 31.', 'the read-against line');
  ok(!bar.complete, 'and it is not complete');
});

test('the bar splits collected from uncollected and the two halves fill the track', () => {
  const bar = coverageBar(STALLED)!;
  eq(bar.collectedPct, 74.2, 'collected width');
  eq(bar.uncollectedPct, 25.8, 'uncollected width');
  eq(Math.round(bar.collectedPct + bar.uncollectedPct), 100, 'they fill it');
});

test('a complete month says nothing about stalls', () => {
  const bar = coverageBar(WHOLE)!;
  eq(bar.sinceLine, undefined, 'no since line');
  eq(bar.readAgainstLine, undefined, 'no read-against line');
  eq(bar.collectedPct, 100, 'the whole track is ink');
  ok(bar.complete, 'complete');
});

test('coverage the API did not send draws no bar at all', () => {
  eq(coverageBar(undefined), undefined, 'absent, not an empty bar');
});

test('a stall and a decision never read alike', () => {
  eq(sinceWords({ from: '2026-07-12', to: '2026-07-31', reason: 'sync-stalled' }),
    'not collecting since 12 July', 'a stall');
  eq(sinceWords({ from: '2026-07-12', to: '2026-07-31', reason: 'switched-off' }),
    'paused since 12 July', 'her own decision');
  eq(sinceWords({ from: '2026-07-12', to: '2026-07-31', reason: 'not-connected' }),
    'not connected since 12 July', 'never connected');
});

test('the open gap is the one that started last', () => {
  const many: Coverage = {
    ...STALLED,
    gaps: [
      { from: '2026-07-02', to: '2026-07-03', reason: 'platform-error' },
      { from: '2026-07-12', to: '2026-07-31', reason: 'sync-stalled' },
    ],
  };
  eq(openGap(many)?.from, '2026-07-12', 'the latest gap is the one still running');
  eq(coverageBar(many)!.sinceLine, 'not collecting since 12 July', 'and it is what the line says');
});

test('days are written the way she writes them', () => {
  eq(formatDay('2026-07-12'), '12 July', 'day then month, no zero padding');
  eq(formatDay('2026-01-01'), '1 January', 'the first of a month');
  eq(formatDay('not a date'), 'not a date', 'anything else passes through');
});

test('a screen reading a different stretch says so instead of borrowing the headline', () => {
  const narrower: Coverage = { ...STALLED, days_covered: 20 };
  eq(coverageDiffersLine(narrower, STALLED), 'This section covers 20 of 31 days, not 23.', 'it says so');
  eq(coverageDiffersLine(STALLED, STALLED), undefined, 'and stays quiet when they match');
});

// ── Metrics ──────────────────────────────────────────────────────────────────

suite('analysis groups — a missing number is missing');

test('an uncollected metric is an em dash and never a zero', () => {
  const card = metricCard('Followers', { state: 'no-coverage' }, STALLED);
  eq(card.value, NO_READING, 'em dash');
  ok(card.value !== '0', 'never a zero');
  eq(card.note, 'not collecting since 12 July', 'and it says since when');
  eq(card.tone, 'overdue', 'in the overdue colour');
});

test('a real zero is still a zero', () => {
  const card = metricCard('Replies', { state: 'value', value: 0, n: 4 }, STALLED);
  eq(card.value, '0', 'nobody replied, and that is a reading');
  eq(card.note, 'from 4 pieces', 'counted from the pieces behind it');
});

test('too early and not measurable both refuse rather than round to zero', () => {
  eq(metricCard('Saves', { state: 'too-early', owed: 'three more pieces' }).value, NO_READING, 'too early');
  eq(metricCard('Saves', { state: 'too-early', owed: 'three more pieces' }).note,
    'insufficient data. three more pieces', 'and says what is owed');
  eq(metricCard('Clicks', { state: 'not-measurable', because: 'no link on this platform' }).value,
    NO_READING, 'not measurable');
  eq(metricCard('Clicks', { state: 'not-measurable', because: 'no link on this platform' }).note,
    'no link on this platform', 'and says why');
});

test('a metric with a reading and no piece count is read against the collected days', () => {
  eq(metricCard('Reach', { state: 'value', value: 18400 }, STALLED).note,
    'over 23 collected days', 'never against 31');
});

test('a metric the API did not answer with is still not a zero', () => {
  eq(metricCard('Reach', undefined).value, NO_READING, 'em dash');
});

test('figures are written for reading', () => {
  eq(formatNumber(18400), '18,400', 'thousands');
  eq(formatNumber(undefined), NO_READING, 'nothing is an em dash');
  eq(percentWords(0.42), '+42%', 'a lift');
  eq(percentWords(-0.1), '-10%', 'a drop');
  eq(percentWords(undefined), 'no lift yet', 'no reading');
});

// ── Bars ─────────────────────────────────────────────────────────────────────

suite('analysis groups — a gap is drawn as a gap');

test('an uncollected row draws the hatch across the whole track, not a zero bar', () => {
  const bar = meterBar({ state: 'no-coverage' }, 6200);
  eq(bar.hatched, true, 'hatched');
  eq(bar.pct, 100, 'and full width, so it can be seen');
});

test('a collected row scales against the best reading beside it', () => {
  eq(meterBar({ state: 'value', value: 3100 }, 6200), { pct: 50, hatched: false }, 'half');
  eq(meterBar({ state: 'value', value: 6200 }, 6200), { pct: 100, hatched: false }, 'the best one');
});

test('a genuine zero draws a zero-length bar, because that is what happened', () => {
  eq(meterBar({ state: 'value', value: 0 }, 6200), { pct: 0, hatched: false }, 'a real floor');
});

test('the scale comes from the readings, and unread rows do not drag it down', () => {
  const rows = [
    { value: { state: 'value', value: 6200 } as Measured },
    { value: { state: 'no-coverage' } as Measured },
    { value: { state: 'value', value: 2400 } as Measured },
  ];
  eq(maxReading(rows), 6200, 'the biggest reading');
});

test('slice rows count their pieces from the pieces, not from a stored number', () => {
  const rows = sliceRows([
    { value: 'ai', label: 'AI Lane', typical: { state: 'value', value: 6200 }, n: 99, piece_ids: ['a', 'b'], band: 'earning' },
    { value: 'li', label: 'LinkedIn', typical: { state: 'no-coverage' }, piece_ids: [], band: 'too-early' },
  ]);
  eq(rows[0].count, '2 pieces', 'counted from piece_ids, ignoring the stale n');
  eq(rows[0].figure, '6,200', 'its figure');
  eq(rows[0].bar, { pct: 100, hatched: false }, 'the best row fills the track in ink');
  eq(rows[1].figure, NO_READING, 'the uncollected slice has no figure');
  eq(rows[1].bar, { pct: 100, hatched: true }, 'and draws the hatch, not a zero-length bar');
  eq(rows[1].count, '0 pieces', 'plural at zero');
});

test('one piece is a piece, not pieces', () => {
  eq(sliceRows([{ value: 'x', typical: { state: 'value', value: 1 }, piece_ids: ['a'] }])[0].count,
    '1 piece', 'singular');
});

test('the hatch is one value in one place', () => {
  eq(HATCH, 'repeating-linear-gradient(135deg,#e0dbd6 0 6px,#f4f1ee 6px 12px)', 'exactly the design');
});

// ── Goals ────────────────────────────────────────────────────────────────────

suite('analysis groups — goals');

test('a goal with a target gets a bar and a "7 of 16" line', () => {
  const goal = { target: { value: 16, period: 'month' }, actual: { state: 'value', value: 7 } as Measured };
  eq(goalBar(goal), { pct: 43.8, hatched: false }, 'the progress bar');
  eq(goalValue(goal), '7 of 16', 'the line');
});

test('a goal past its target does not overflow the track', () => {
  eq(goalBar({ target: { value: 10, period: 'month' }, actual: { state: 'value', value: 25 } })!.pct,
    100, 'clamped');
});

test('a goal with no reading draws the hatch, never an empty bar', () => {
  eq(goalBar({ target: { value: 16, period: 'month' }, actual: { state: 'no-coverage' } }),
    { pct: 100, hatched: true }, 'hatched');
  eq(goalValue({ target: { value: 16, period: 'month' }, actual: { state: 'no-coverage' } }),
    `${NO_READING} of 16`, 'and the value is an em dash');
});

test('a direction-only goal gets no bar at all', () => {
  eq(goalBar({ target: 'direction-only', actual: { state: 'value', value: 4 } }), undefined,
    'a bar with no end would be a decoration');
  eq(goalValue({ target: 'direction-only', actual: { state: 'value', value: 4 } }), '4', 'just the reading');
});

// ── Scorecard ────────────────────────────────────────────────────────────────

suite('analysis groups — each pillar on its own job');

test('a pillar that is earning passes, one that is dragging does not', () => {
  eq(pillarRead({ state: 'earning', piece_ids: ['a', 'b', 'c'] }),
    { words: 'performing', tone: 'positive' }, 'passing');
  eq(pillarRead({ state: 'dragging', piece_ids: ['a', 'b', 'c'] }),
    { words: 'underperforming', tone: 'attention' }, 'not passing');
});

test('"limited data" always names how many pieces it stands on', () => {
  eq(pillarRead({ state: 'too-early', piece_ids: ['a', 'b'] }),
    { words: 'limited data, 2 pieces', tone: 'attention' }, 'counted from its own pieces');
  eq(pillarRead({ state: 'too-early', piece_ids: ['a'] }).words, 'limited data, 1 piece', 'singular');
  eq(pillarRead(undefined).words, 'limited data, 0 pieces', 'nothing at all');
});

test('a collection gap is never reported as a failing pillar', () => {
  eq(pillarRead({ state: 'coverage-gap', piece_ids: ['a', 'b'] }),
    { words: 'not collecting', tone: 'attention' }, 'the gap is named as a gap');
  eq(pillarRead({ state: 'not-measurable' }).words, 'not measurable here', 'and so is the wrong stick');
});

// ── Compare ──────────────────────────────────────────────────────────────────

suite('analysis groups — what it means');

test('a piece shows how it was born above its numbers', () => {
  eq(bornLine({ format: 'carousel', angle: 'correction', platform: 'instagram' }, 'the career has no home'),
    'seed: the career has no home · correction · carousel · instagram', 'seed, angle, format');
  eq(bornLine({ format: 'reel', angle: 'teach' }), 'teach · reel', 'without a seed it starts at the angle');
  eq(bornLine(null), 'creation details not recorded', 'and never invents one');
});

test('the hook is only added when it says something the angle did not', () => {
  eq(bornLine({ angle: 'correction', hook_type: 'correction', format: 'carousel' }),
    'correction · carousel', 'no repetition');
});

test('below the thresholds the answer is a refusal, never a ranking', () => {
  const v = compareVerdict({
    entry: { state: 'not-enough-comparable-data' },
    missing: 'The reel has no 7d reading yet.',
  })!;
  eq(v.enough, false, 'not enough');
  eq(v.words, 'Not enough comparable data', 'her exact words');
  eq(v.detail, 'The reel has no 7d reading yet.', 'and what is missing');
});

test('a resolved comparison passes the engine words through untouched', () => {
  const v = compareVerdict({ entry: { state: 'resolved', verdict: { words: 'The angle is the variable.' } } })!;
  eq(v.enough, true, 'enough');
  eq(v.words, 'The angle is the variable.', 'the engine wrote this, not the screen');
});

test('two is the floor for a comparison', () => {
  eq(canCompare([]), false, 'nothing');
  eq(canCompare(['a']), false, 'one piece is not a comparison');
  eq(canCompare(['a', 'b']), true, 'two');
  eq(selectionLine([]), 'Select two or more pieces to compare.', 'the prompt');
  eq(selectionLine(['a']), '1 piece selected. Select one more.', 'one');
  eq(selectionLine(['a', 'b', 'c']), '3 pieces selected.', 'counted from the selection');
});

// ── Counting ─────────────────────────────────────────────────────────────────

suite('analysis groups — every count is counted');

test('countLine takes the array, so a headline cannot state a number nobody counted', () => {
  eq(countLine([1, 2, 3], 'verdict', 'verdicts'), '3 verdicts', 'plural');
  eq(countLine([1], 'verdict', 'verdicts'), '1 verdict', 'singular');
  eq(countLine([], 'verdict', 'verdicts'), '0 verdicts', 'empty');
  eq(countLine(undefined, 'verdict', 'verdicts'), '0 verdicts', 'nothing sent');
});
