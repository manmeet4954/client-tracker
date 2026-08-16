// Topic suggestions ride the client-ideas lane — 2026-08-11.
//
// The security fact these pin: a suggestion opens NO new door. It is an intake
// answer at the declared answers path, under the parameter spec 22 §7.5 named,
// which is what lets a client write it at all.

import { suite, test, eq, ok } from './harness.ts';
import { emptyBody } from '../lib/tree/body.ts';
import { IDEAS_PARAMETER, fileSuggestion, readSuggestions } from '../lib/intake/suggestions.ts';
import { findParameter } from '../lib/intake/parameters.ts';
import { readAnswers } from '../lib/intake/rounds.ts';

const NOW = '2026-08-11T20:00:00.000Z';

suite('intake — topics the client suggests');

test('a suggestion is an ordinary answer on the declared lane', () => {
  const body = fileSuggestion(emptyBody(), { text: 'A Diwali offer post', by: 'guest:riti', now: NOW });
  const answers = readAnswers(body);
  eq(answers.length, 1, 'one answer, nothing else written');
  eq(answers[0].parameter_id, IDEAS_PARAMETER, 'on the client-ideas lane');
  eq(answers[0].value, 'A Diwali offer post', 'their words, exactly');
});

test('the lane is the one the inventory declares, not an invention', () => {
  const declared = findParameter(IDEAS_PARAMETER);
  ok(!!declared, 'spec 22 §7.5 declares client-ideas; this file must not coin its own');
});

test('suggestions read back newest first, and blanks are refused', () => {
  let body = fileSuggestion(emptyBody(), { text: 'First', by: 'c', now: '2026-08-01T09:00:00.000Z' });
  body = fileSuggestion(body, { text: 'Second', by: 'c', now: '2026-08-09T09:00:00.000Z' });
  const got = readSuggestions(body);
  eq(got.map(s => s.text), ['Second', 'First'], 'newest first');
  let threw = false;
  try { fileSuggestion(emptyBody(), { text: '   ', by: 'c', now: NOW }); } catch { threw = true; }
  eq(threw, true, 'a blank suggestion is refused');
});

test('two different suggestions in the same instant both survive', () => {
  let body = fileSuggestion(emptyBody(), { text: 'One', by: 'c', now: NOW });
  body = fileSuggestion(body, { text: 'Two', by: 'c', now: NOW });
  eq(readSuggestions(body).length, 2, 'ids differ by content, not only by time');
});
