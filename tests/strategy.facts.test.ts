// Strategy as a layer, not a gate — lib/strategy/facts.ts.
//
// The eight facts, counted. A fact is known when its box is non-empty; the
// count informs and never blocks. These tests pin the counting rules so the
// Facts page's status line can never drift from the data.

import { suite, test, ok, eq } from './harness.ts';
import { FACT_NAMES, draftingNote, factsKnown, factsLine, type FactsInput } from '../lib/strategy/facts.ts';
import { FACT_ASKS, factAnswers, openFactsRound } from '../lib/intake/factsRound.ts';
import { INTAKE_PATH, fileAnswer, readQuestions } from '../lib/intake/rounds.ts';
import { readPath } from '../lib/tree/body.ts';
import { migrateProfile } from '../lib/tree/migrate.ts';
import { normalizeState } from '../lib/access.ts';
import { fixtureState } from './fixtures.ts';
import type { ProfileBody } from '../lib/tree/body.ts';

function full(): FactsInput {
  return {
    brand: {
      tagline: 'Resumes that get read',
      audience: 'Job seekers early in their career',
      voice: 'Direct, warm, no jargon',
    },
    pillars: [{ id: 'p1', name: 'AI', color: '#8B5CF6', createdAt: '2026-08-01' }],
    platforms: ['Instagram'],
    postTarget: 12,
    goals: ['links'],
    brandKit: { colors: [{ id: 'c1', name: 'Green', hex: '#25B763' }], fonts: [] },
  };
}

suite('strategy facts — the count');

test('an empty profile knows none of eight, and names all eight blanks in order', () => {
  const f = factsKnown({});
  eq(f.known, 0, 'nothing is known');
  eq(f.total, 8, 'the total is always eight');
  eq(f.missing, [...FACT_NAMES], 'every fact is missing, in the page order');
});

test('a fully filled profile knows eight of eight with nothing missing', () => {
  const f = factsKnown(full());
  eq(f.known, 8, 'all eight');
  eq(f.missing, [], 'nothing missing');
});

test('each fact flips its own count and no other', () => {
  const empty = factsKnown({});
  const cases: [string, FactsInput][] = [
    ['Positioning', { brand: { tagline: 'We make resumes readable' } }],
    ['Audience', { brand: { audience: 'Early career job seekers' } }],
    ['Voice', { brand: { voice: 'Plain and direct' } }],
    ['Pillars', { pillars: [{ id: 'p', name: 'AI', color: '#000', createdAt: '2026-08-01' }] }],
    ['Platforms', { platforms: ['Instagram'] }],
    ['Cadence', { postTarget: 8 }],
    ['Goals', { goals: ['followers'] }],
    ['Look', { brandKit: { colors: [{ id: 'c', name: '', hex: '#111' }], fonts: [] } }],
  ];
  for (const [name, input] of cases) {
    const f = factsKnown(input);
    eq(f.known, 1, `${name} alone counts as one known`);
    ok(!f.missing.includes(name), `${name} left the missing list`);
    eq(f.missing.length, 7, `the other seven stay missing for ${name}`);
  }
  eq(empty.known, 0, 'and the empty baseline was zero');
});

test('whitespace is not knowledge', () => {
  const f = factsKnown({ brand: { tagline: '   ', audience: '\n', voice: '\t' }, platforms: [' '] });
  eq(f.known, 0, 'blank strings count as blank boxes');
});

test('a cadence of zero is not a cadence', () => {
  ok(factsKnown({ postTarget: 0 }).missing.includes('Cadence'), 'zero stays missing');
  ok(!factsKnown({ postTarget: 1 }).missing.includes('Cadence'), 'one is known');
});

test('fonts alone are enough for Look', () => {
  const f = factsKnown({
    brandKit: { colors: [], fonts: [{ id: 'f', name: 'Manrope', role: 'Body', weights: 'Regular' }] },
  });
  ok(!f.missing.includes('Look'), 'a font counts');
});

suite('strategy facts — the lines she reads');

test('the status line is derived and reads like progress', () => {
  eq(factsLine(factsKnown({})), 'None of eight known.', 'the empty line');
  eq(factsLine(factsKnown({ brand: { tagline: 'x', audience: 'y', voice: 'z' } })),
    'Three of eight known.', 'three known');
  eq(factsLine(factsKnown(full())), 'Eight of eight known.', 'the full line');
});

test('the drafting note shows while positioning, audience, voice or platforms are blank', () => {
  const partial = factsKnown({ brand: { tagline: 'x', audience: 'y' } });
  eq(draftingNote(partial), 'Drafting works best once positioning, audience and voice are in.',
    'voice is still blank, so the note shows');
  eq(draftingNote(factsKnown(full())), null, 'all four in, no note');
});

test('the note never appears as a block: pillars, cadence, goals and look do not trigger it', () => {
  const f = factsKnown({
    brand: { tagline: 'x', audience: 'y', voice: 'z' },
    platforms: ['Instagram'],
  });
  eq(draftingNote(f), null, 'the four drafting facts are in; the other four blanks say nothing');
});

test('no line she reads carries an em dash', () => {
  for (const line of [
    factsLine(factsKnown({})),
    factsLine(factsKnown(full())),
    draftingNote(factsKnown({})) ?? '',
  ]) {
    ok(!line.includes('—'), `"${line}" has an em dash`);
  }
});

// ── The round made from the blanks ───────────────────────────────────────────
//
// Her intake model: the questionnaire is built from the gaps. One question per
// blank fact, in the page's own wording, and nothing already known is asked.

suite('a facts round — the questionnaire built from the gaps');

const RNOW = '2026-08-09T12:00:00.000Z';

function bodyFor(): ProfileBody {
  const s = normalizeState(fixtureState());
  const c = s.clients.find(x => x.id === 'divine-studio')!;
  return migrateProfile(c, s.clientData['divine-studio'], { now: RNOW }).body;
}

test('one question per asked blank, in her wording, marked sent', () => {
  const { body, round } = openFactsRound(bodyFor(), ['Voice', 'Look'], RNOW);
  eq(round.status, 'sent', 'a facts round is out the moment it is made');
  eq(round.parameters, ['fact.voice', 'fact.look'], 'it asks exactly what was chosen');
  const qs = readQuestions(body, round.version);
  eq(qs.length, 2, 'two blanks, two questions');
  eq(qs[0].text, FACT_ASKS.Voice.question, 'the wording is the page\'s, not the bank\'s');
  ok(qs.every(q => !q.vocabulary_draft), 'her wording never counts as a draft');
});

test('the answer comes back attached to the fact it was asked for', () => {
  const opened = openFactsRound(bodyFor(), ['Voice'], RNOW);
  const withAnswer = fileAnswer(opened.body, {
    round: opened.round.version, parameter_id: 'fact.voice',
    value: 'Straight talk, no fitness jargon, a little playful.',
    by: 'client', source: `round-${opened.round.version}`, now: RNOW, writer: 'owner',
  });
  const got = factAnswers(withAnswer);
  ok(got.Voice, 'the voice answer is found');
  eq(got.Voice?.value, 'Straight talk, no fitness jargon, a little playful.', 'verbatim');
  eq(got.Voice?.landsInBox, true, 'voice is free text, so one tap can take it');
});

test('a facts round asks nothing when nothing is chosen', () => {
  let threw = false;
  try { openFactsRound(bodyFor(), [], RNOW); } catch { threw = true; }
  ok(threw, 'an empty round is refused, not written');
});

test('earlier rounds move to history when a facts round opens', () => {
  const first = openFactsRound(bodyFor(), ['Voice'], RNOW);
  const second = openFactsRound(first.body, ['Look'], RNOW);
  const entries = readPath(second.body, INTAKE_PATH);
  const active = entries.filter(e => e.state === 'active');
  eq(active.length, 1, 'one live round at a time');
  eq((active[0].data as { version?: number }).version, 2, 'and it is the newer one');
  eq(entries.length, 2, 'the earlier round stays on the record as history');
});
