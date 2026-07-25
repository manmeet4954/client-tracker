// Spec 21 §10 — acceptance tests 1 (the proof walk), 7 (one truth), 8 (honesty)
// and 9 (append-only), run against the migrated pilot profile.
//
// The pilot is ResumeGuru, one of HER profiles: a client profile is never the
// experiment (§9.4).

import { suite, test, ok, eq, throws } from './harness.ts';
import { fixtureState } from './fixtures.ts';
import { migrateProfile, reportToText } from '../lib/tree/migrate.ts';
import {
  amendEntry, putEntry, readPath, readUnder, supersedeEntry, findEntry, bodyStats,
} from '../lib/tree/body.ts';
import { findDeclaration } from '../lib/tree/declarations.ts';
import { detectCoverageGaps, resolveComparison, gapCoversDay } from '../lib/tree/metrics.ts';
import type { MetricObservation, MatchedComparison } from '../lib/tree/objects.ts';

const NOW = '2026-07-25T12:00:00.000Z';

function pilot() {
  const state = fixtureState();
  const client = state.clients.find(c => c.id === 'resumeguru')!;
  return migrateProfile(client, state.clientData['resumeguru'], { now: NOW, observations: state.observations });
}

suite('spec 21 §9 — migrating the pilot profile (ResumeGuru, one of hers)');

test('every address the migration writes is a declared one', () => {
  const { body } = pilot();
  const stats = bodyStats(body);
  eq(stats.undeclared, [], 'the migration cannot invent an address');
  ok(stats.entries > 30, 'and it actually moved the profile');
});

test('the body records its version, and legacy slices are left untouched', () => {
  const state = fixtureState();
  const { body } = pilot();
  eq(body.body_version, 21, 'body_version 21');
  eq(state.clientData['resumeguru'].contentCards.length, 3,
    'the legacy slices still hold everything — the screens keep rendering what they render today');
});

test('a client profile is refused the effort and money meters (PLAN §7)', () => {
  const state = fixtureState();
  const asClient = { ...state.clients[0], id: 'divine-studio', name: 'Divine Studio', ownerKind: 'client' as const };
  const { report } = migrateProfile(asClient, { ...state.clientData['resumeguru'] }, { now: NOW });
  ok(report.refused.some(r => r.what.includes('momentum')), 'refused, and it says why');
  ok(report.suggestedSwitches.every(s => s.switchId !== 'logs.effort_meter'), 'and nothing suggests turning it on');
});

test('switches are suggested, never set (§9.6)', () => {
  const { report, suggestedSwitches } = pilot();
  ok(report.suggestedSwitches.length > 3, 'suggestions were derived from what the profile actually has');
  ok(Object.values(suggestedSwitches).every(s => s.suggested === true),
    'every one is marked a suggestion — she sets the positions after strategy');
  const linkedin = report.suggestedSwitches.find(s => s.switchId === 'platforms.youtube');
  eq(linkedin?.state, 'hidden', 'a platform nothing touches is suggested hidden, not deleted');
});

test('nothing is guessed: what the old data never said goes to her sort queue', () => {
  const { report } = pilot();
  const questions = report.needsHerSort.map(q => q.question).join(' | ');
  ok(questions.includes('hero offer'), 'the hero offer was never marked');
  ok(questions.includes('came FROM the client'), 'references carry no source signal');
  ok(questions.includes('timezone'), 'the channel’s timezone was never recorded, and metrics need it');
  ok(report.legacyUnverified.some(u => u.path === 'work-log/references/our-vision'),
    'and legacy references are marked unverified rather than attributed');
});

test('the migration report reads in plain words', () => {
  const text = reportToText(pilot().report);
  ok(text.includes('MOVED'), 'what moved');
  ok(text.includes('LEFT WHERE IT IS'), 'what stayed');
  ok(text.includes('NEEDS YOU'), 'what she has to decide');
  ok(text.includes('suggestions only, nothing is set'), 'and that no switch was set behind her back');
});

suite('spec 21 §10.7 — the one-truth test (S2, PLAN §3.11)');

test('one piece identity: making, review and scheduling reference it, never copy it', () => {
  const { body } = pilot();
  const pieces = readPath(body, 'work-log/creation');
  eq(pieces.length, 3, 'three cards, three pieces');
  const ids = new Set(pieces.map(p => p.id));
  eq(ids.size, pieces.length, 'no piece exists twice');

  for (const path of ['work-log/creation/making', 'work-log/creation/scheduling']) {
    for (const view of readPath(body, path)) {
      ok(view.data.piece_id, `${path} entries carry a piece reference`);
      ok(ids.has(view.data.piece_id as string), 'pointing at a piece that exists');
      ok(!('title' in view.data), 'and they do not re-state the piece’s own fields');
    }
  }
});

test('a seed never has a stage; only pieces do (S1)', () => {
  const { body } = pilot();
  for (const seed of readPath(body, 'work-log/creation/topics')) {
    ok(!('stage' in seed.data), 'a seed carries a status, never a stage');
    eq(seed.data.status, 'draft', 'and a migrated subject starts as a draft shell (S24)');
  }
});

test('the seed bank holds seeds only — a topic came over as capture input', () => {
  const { body, report } = pilot();
  const dec = findDeclaration('work-log/creation/topics')!;
  eq(dec.entry_type, 'seed', 'the path permits seeds only');
  ok(report.legacyUnverified.some(u => u.path === 'work-log/creation/topics'),
    'so every migrated subject is flagged as needing her narration before it can be locked');
});

suite('spec 21 §10.1 — the proof walk, on migrated data (PLAN §3.9)');

test('one entry, seven stations, zero repeated typing', () => {
  let { body } = pilot();

  // 1. The seed is in the bank, and it was born wired: the pickers read the
  //    pillars, the platforms, and THAT platform's formats.
  const seed = readPath(body, 'work-log/creation/topics').find(s => s.id === 't-salary');
  ok(seed, 'the salary seed is in topics/');
  const pillars = readUnder(body, 'context/content-strategy/pillars').filter(e => e.type === 'pillar');
  ok(pillars.length === 3, 'the pillar picker has something to read');
  const igFormats = readPath(body, 'context/content-strategy/platforms/instagram/formats');
  ok(igFormats.some(f => f.data.name === 'Carousel'), 'the format picker reads THIS platform’s formats');

  // 2. The piece carries its costume from birth — nothing re-typed.
  const piece = readPath(body, 'work-log/creation').find(p => p.id === 'card-salary')!;
  eq(piece.data.stage, 'posted', 'it is at the posted station');
  const costume = piece.data.costume as Record<string, string>;
  eq(costume.pillar_id, 'p-trust', 'pillar from birth');
  eq(costume.platform, 'Instagram', 'platform from birth');
  eq(costume.format, 'Carousel', 'format from birth');
  eq(piece.data.seed_id, 't-salary', 'and it points back at its seed');

  // 3. Making pulled voice and look by address, not by asking.
  const draft = readPath(body, 'work-log/creation/making').find(d => d.data.piece_id === 'card-salary');
  ok(draft, 'the draft is a version of the same piece');

  // 4. Review: the migrated preview knows it needs linking — it does not invent one.
  const review = readPath(body, 'work-log/creation/review')[0];
  eq(review.data.piece_id, null, 'an unlinked legacy preview says so honestly');

  // 5. Scheduling reads cadence; the record references the piece.
  const cadence = readPath(body, 'context/content-strategy/cadence')[0];
  eq(cadence.data.posts_per_month, 12, 'cadence is where scheduling looks, already filled');

  // 6. Posted: the piece already carries pillar, platform, format, month, channel
  //    and its live link. Nobody records anything.
  eq(piece.data.created_month, '2026-07', 'month from birth');
  eq(piece.data.channel_id, 'ch-resumeguru-ai', 'channel from birth');
  ok(piece.data.live_link, 'and the live link is on the piece itself');

  // 7. Analysis judges it by its pillar's JOB, read from the pillar folder.
  const job = readPath(body, 'context/content-strategy/pillars/interview-truth/job')[0];
  eq(job.data.job, 'trust', 'the measuring stick is this pillar’s job, not a generic metric');

  // The loop closes: the engine's suggestion goes back into the seed bank,
  // marked engine-proposed, and does not touch strategy on its own.
  body = putEntry(body, 'work-log/creation/topics', {
    id: 'seed-proposed-1', type: 'seed',
    data: {
      name: 'More salary-question carousels', raw_thought: '', status: 'draft',
      raw_material: [{ at: NOW, source: 'engine:analysis', text: 'carousels on salary topics keep winning' }],
      engine_proposed: true, proposed_costume: { pillar_id: 'p-trust', platform: 'Instagram', format: 'Carousel' },
    },
  }, { writer: 'engine:analysis', now: NOW });
  eq(readPath(body, 'work-log/creation/topics').filter(s => s.data.engine_proposed).length, 1,
    'the suggestion lands in the seed bank for her to pick up');

  // And a strategy change from the engine is a PROPOSAL, not a write.
  const decl = findDeclaration('context/content-strategy/pillars')!;
  ok(decl.fed_by.includes('engine:analysis'), 'the engine may propose against strategy');
  eq(decl.history, 'versioned', 'and every change to it is dated and versioned');
});

suite('spec 21 §10.9 — the append-only test (S11, S15)');

test('a raw intake answer cannot be altered at all', () => {
  const { body } = pilot();
  const answer = readPath(body, 'context/intake/answers')[0];
  ok(answer, 'the legacy answers came over');
  throws(
    () => putEntry(body, 'context/intake/answers',
      { id: answer.id, type: 'answer', data: { round: 0, answer: 'reworded' } },
      { writer: 'owner', now: NOW }),
    'append-only',
    'raw answers are never altered (S11)',
  );
});

test('a piece’s birth snapshot cannot be overwritten — corrections append', () => {
  let { body } = pilot();
  const piece = readPath(body, 'work-log/creation').find(p => p.id === 'card-salary')!;
  ok(piece.data.birth, 'the posted piece has a birth record');

  throws(
    () => putEntry(body, 'work-log/creation',
      { id: 'card-salary', type: 'piece', data: { ...piece.data, birth: null } },
      { writer: 'owner', now: NOW }),
    'append-only',
    'the analytical birth record is never overwritten (S15)',
  );

  body = amendEntry(body, 'work-log/creation', 'card-salary', {
    at: NOW, by: 'owner', note: 'pillar was wrong at the time', changed: { 'costume.pillar_id': 'p-ai' },
  });
  const amended = findEntry(body, 'card-salary')!;
  eq(amended.amendments?.length, 1, 'the correction is a dated amendment');
  ok(amended.data.birth, 'and the birth record is still there underneath');
});

test('a curated parameter supersedes and keeps its history (S11)', () => {
  let { body } = pilot();
  const before = readPath(body, 'context/business-details/audience-raw')[0];
  body = supersedeEntry(body, 'context/business-details/audience-raw', before.id, {
    id: 'audience-2', type: 'curated_parameter',
    data: { key: 'audience', value: 'Final-year students in tier-2 cities' },
  }, {
    writer: 'owner', now: NOW,
    provenance: { source_refs: ['a-ob-1'], curator: 'manmeet', at: NOW, confidence: 'confirmed' },
  });
  const all = readPath(body, 'context/business-details/audience-raw');
  eq(all.length, 2, 'the old value is kept, not replaced');
  eq(all.find(e => e.id === before.id)!.state, 'history', 'it moves to history');
  eq(all.find(e => e.id === 'audience-2')!.provenance?.supersedes, before.id, 'and the new one records what it replaced');
});

suite('spec 21 §10.8 — the honesty test (S6, S7)');

const CHANNEL = 'ch-resumeguru-ai';

function observation(day: string, ageHours: number, metrics: Record<string, number>, pieceId: string): MetricObservation {
  return {
    id: `${pieceId}-${day}`, piece_id: pieceId, platform_post_id: `pid-${pieceId}`, channel_id: CHANNEL,
    age_hours: ageHours, window: '7d', metrics, metric_definition_version: 1,
    account_timezone: 'Asia/Kolkata', fetched_at: `${day}T09:00:00.000Z`, connection_status: 'ok',
  };
}

test('the stalled collection renders as a coverage gap, never as a slump', () => {
  // Collection has been stalled since 2026-07-12 (STATE.md). Data up to the
  // 11th, nothing after.
  const observations = ['2026-07-09', '2026-07-10', '2026-07-11']
    .map(d => observation(d, 24, { views: 900, saves: 40 }, 'card-salary'));

  const gaps = detectCoverageGaps(observations, CHANNEL, '2026-07-09', '2026-07-25');
  eq(gaps.length, 1, 'one continuous gap');
  eq(gaps[0].from, '2026-07-12', 'starting the day collection stopped');
  eq(gaps[0].to, '2026-07-25', 'and running to today');
  ok(gapCoversDay(gaps, '2026-07-20'), 'a day inside the gap reads as missing data');
  ok(!gapCoversDay(gaps, '2026-07-10'), 'a day with data does not');
});

test('below the thresholds a comparison says so instead of ranking', () => {
  const comparison: MatchedComparison = {
    id: 'cmp-1', hypothesis: 'The reel beats the carousel on reach',
    piece_ids: ['card-salary', 'card-ats'], held_variables: ['seed', 'pillar'],
    changed_variable: 'format', posting_windows: [], confounders: [], window: '7d', state: 'open',
  };
  const thin = [
    observation('2026-07-09', 24, { views: 120, saves: 8 }, 'card-salary'),
    observation('2026-07-09', 24, { views: 90, saves: 4 }, 'card-ats'),
  ];
  eq(resolveComparison(comparison, thin, 'saves').state, 'not-enough-comparable-data',
    'thin exposure gets an honest answer, not a winner');

  const enough = [
    observation('2026-07-09', 168, { views: 4200, saves: 310 }, 'card-salary'),
    observation('2026-07-09', 168, { views: 3900, saves: 120 }, 'card-ats'),
  ];
  const resolved = resolveComparison(comparison, enough, 'saves');
  eq(resolved.state, 'concluded', 'with real exposure it concludes');
  eq(resolved.verdict?.direction, 'favours', 'directionally');
  ok(resolved.verdict!.words.includes('evidence, not proof'),
    'and it never claims causation (S5)');
});

test('pieces compare only at equivalent ages', () => {
  const comparison: MatchedComparison = {
    id: 'cmp-2', hypothesis: 'x', piece_ids: ['card-salary', 'card-ats'],
    held_variables: [], changed_variable: 'hook', posting_windows: [], confounders: [],
    window: 'first-24h', state: 'open',
  };
  const mismatched = [
    observation('2026-07-09', 24, { views: 4200, saves: 300 }, 'card-salary'),
    observation('2026-07-09', 168, { views: 4000, saves: 500 }, 'card-ats'), // a week old
  ];
  eq(resolveComparison(comparison, mismatched, 'saves').state, 'not-enough-comparable-data',
    'a 7-day-old piece is not compared against a 24-hour-old one (S6)');
});
