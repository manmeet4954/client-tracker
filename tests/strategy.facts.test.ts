// Strategy as a layer, not a gate — lib/strategy/facts.ts.
//
// The eight facts, counted. A fact is known when its box is non-empty; the
// count informs and never blocks. These tests pin the counting rules so the
// Facts page's status line can never drift from the data.

import { suite, test, ok, eq } from './harness.ts';
import { FACT_NAMES, draftingNote, factsKnown, factsLine, type FactsInput } from '../lib/strategy/facts.ts';

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
