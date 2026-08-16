// The rebuilt Intake page's words — 2026-08-11.
//
// These pin the one thing that makes the page honest rather than nagging: a
// gap only claims to hold something up when it actually does. Four of the eight
// facts block nothing, and the page has to be willing to say so.

import { suite, test, eq } from './harness.ts';
import { blocksOf, gapNote, knownLine } from '../lib/intake/known.ts';
import { factsKnown, FACT_NAMES } from '../lib/strategy/facts.ts';

suite('intake — what the page says about itself');

test('the count reads in words, and full is said plainly', () => {
  eq(knownLine({ known: 0, total: 8, missing: [...FACT_NAMES] }), 'Brand profile 0 of 8 complete.', 'nothing in yet');
  eq(knownLine({ known: 3, total: 8, missing: ['Cadence'] }), 'Brand profile 3 of 8 complete.', 'counted in words');
  eq(knownLine({ known: 8, total: 8, missing: [] }), 'Brand profile complete.', 'full is said plainly');
});

test('nothing missing means nothing waiting', () => {
  eq(gapNote({ known: 8, total: 8, missing: [] }), 'No outstanding information.', 'nothing missing');
});

test('a gap that blocks nothing SAYS it blocks nothing', () => {
  // The heart of it. Cadence blank must never imply the app is stuck.
  eq(
    gapNote({ known: 7, total: 8, missing: ['Cadence'] }),
    'Cadence is outstanding. Nothing depends on it.',
    'one optional gap',
  );
  eq(
    gapNote({ known: 5, total: 8, missing: ['Cadence', 'Goals', 'Look'] }),
    'The remaining details are optional. Nothing depends on them.',
    'several optional gaps',
  );
});

test('a gap that does block names what it blocks', () => {
  eq(
    gapNote({ known: 7, total: 8, missing: ['Platforms'] }),
    'Platforms outstanding, which holds up scheduling.',
    'one blocking gap names what it blocks',
  );
  eq(
    gapNote({ known: 6, total: 8, missing: ['Positioning', 'Voice'] }),
    'Positioning and Voice outstanding, which holds up copywriting.',
    'two gaps blocking the same thing say it once',
  );
});

test('optional gaps never inflate a real one', () => {
  // Cadence rides along in `missing` but must not appear in the sentence, and
  // must not make "drafting" plural.
  eq(
    gapNote({ known: 6, total: 8, missing: ['Positioning', 'Cadence'] }),
    'Positioning outstanding, which holds up copywriting.',
    'the optional gap is left out of the sentence',
  );
});

test('every fact name the page can show has a known verdict', () => {
  // A fact the map has never met must block nothing rather than throw or
  // invent urgency. This is what keeps a future ninth fact safe.
  for (const name of FACT_NAMES) {
    const v = blocksOf(name);
    eq(v === null || typeof v === 'string', true, `${name} has a verdict`);
  }
  eq(blocksOf('SomethingAddedLater'), null, 'an unmet fact blocks nothing');
});

test('no line she reads carries an em dash', () => {
  // The house rule from tests/strategy.plain.test.ts, applied to this page's
  // copy as well: her lines do not use them, and a test is the only thing that
  // keeps that true when copy is edited later.
  const lines = [
    knownLine({ known: 8, total: 8, missing: [] }),
    gapNote({ known: 8, total: 8, missing: [] }),
    gapNote({ known: 7, total: 8, missing: ['Cadence'] }),
    gapNote({ known: 5, total: 8, missing: ['Cadence', 'Goals', 'Look'] }),
    gapNote({ known: 6, total: 8, missing: ['Positioning', 'Voice'] }),
  ];
  for (const line of lines) eq(line.includes('—'), false, line);
});

test('the counter and the note agree on a real profile shape', () => {
  const count = factsKnown({ brand: { tagline: 'x', audience: '', voice: '' }, platforms: ['Instagram'] });
  eq(count.known, 2, 'positioning and platforms only');
  eq(
    gapNote(count),
    'Audience, Voice and Pillars outstanding, which holds up copywriting and assigning posts to pillars.',
    'the counter and the note agree',
  );
});
