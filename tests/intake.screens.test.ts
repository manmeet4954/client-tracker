// The Intake screens, phase 5 of the restructure — lib/intake/screens.ts.
//
// These check the two things the design calls guarantees rather than taste:
//
//   1. Every count shown in copy is derived at render time from the array it
//      describes. The tests assert that by CHANGING the array and reading the
//      sentence again, which is the only way to catch a hardcoded number.
//   2. A raw answer is permanent, and no curated value exists without its
//      provenance: which answer, who, when, how sure, and what it superseded.
//
// Plain Node, no dependencies, in the house harness style.
//
// NOT YET REGISTERED in tests/run.ts (that file is shared and owned by the
// integrator). Run it on its own with:
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \
//     "import('./tests/intake.screens.test.ts').then(async m => \
//      process.exit(await (await import('./tests/harness.ts')).run()))"

import { suite, test, ok, eq } from './harness.ts';
import { emptyBody, putEntry, type ProfileBody } from '../lib/tree/body.ts';
import type { IntakeRound } from '../lib/tree/objects.ts';
import type { SwitchConfig } from '../lib/tree/contract.ts';
import { openRound, fileAnswer, readRounds, refreshRounds, markCurated, INTAKE_PATH } from '../lib/intake/rounds.ts';
import { curateParameter } from '../lib/intake/curate.ts';
import {
  composeRounds, intakeHeadline, sendBlockedLine, composeCuration, curationQueue,
  curationProgress, selectParameter, nextParameter, clientIdeas, hasCuration,
  shortDate, listWords, confidenceWords,
} from '../lib/intake/screens.ts';

const NOW = '2026-07-27T09:00:00.000Z';
const LATER = '2026-07-28T09:00:00.000Z';
const CONFIG: SwitchConfig = {};

const ONE_LINE = 'identity.one-line';
const HATE = 'voice.words-they-hate';
const NAME = 'identity.name';
const PAIN = 'audience.pain';

/** A round holding exactly the parameters named, at `not sent`. */
function withRound(body: ProfileBody, parameters: string[], now = NOW): ProfileBody {
  return openRound(body, {
    parameters, delivery: 'dashboard-questionnaire', config: CONFIG, now,
  }).body;
}

/**
 * Force a round out of the door. Every parameter ships `vocabulary: draft`, so
 * `sendRound` correctly refuses in a fixture; the states after the send are
 * still real states and still have to render.
 */
function markSent(body: ProfileBody, version: number, now = NOW): ProfileBody {
  const round = readRounds(body).find(r => r.version === version)!;
  const sent: IntakeRound = { ...round, status: 'sent' };
  return putEntry(body, INTAKE_PATH, {
    id: round.id, type: 'intake_round', data: sent as unknown as Record<string, unknown>,
  }, { writer: 'owner', now });
}

function answer(body: ProfileBody, version: number, parameter: string, value: string, now = NOW): ProfileBody {
  const next = fileAnswer(body, {
    round: version, parameter_id: parameter, value, by: 'client',
    source: `round-${version}`, now,
  });
  return refreshRounds(next, now);
}

// ── Rounds ───────────────────────────────────────────────────────────────────

suite('intake screens — Rounds');

test('a round she has written but not sent has nothing open, and says so', () => {
  const body = withRound(emptyBody(NOW), [ONE_LINE, HATE]);
  const [card] = composeRounds(body);

  eq(card.status, 'not-sent', 'it is not sent');
  eq(card.pill, 'not sent yet', 'the pill says the true thing');
  eq(card.openCount, 0, 'nothing is open with anyone, because it never went to anyone');
  eq(card.done, false, 'the dot is the open colour');
  eq(card.questions.length, 2, 'both questions are listed');
  eq(card.name, 'Round 1, they fill it in', 'the name carries how it is being asked');
  eq(card.sendable, false, 'and it cannot be sent, because the wording is still the draft');
  ok(sendBlockedLine(card).includes('2 questions are still in the draft wording'),
    'the reason is counted from the parameters, not written into the sentence');
});

test('a sent round counts what is open from the questions, not from a stored number', () => {
  let body = markSent(withRound(emptyBody(NOW), [ONE_LINE, HATE, PAIN]), 1);
  let card = composeRounds(body)[0];
  eq(card.openCount, 3, 'three questions, three open');
  eq(card.pill, '3 still open', '');

  body = answer(body, 1, ONE_LINE, 'I help people who feel stuck at work.');
  card = composeRounds(body)[0];
  eq(card.openCount, 2, 'one came back, so the count moved on its own');
  eq(card.pill, '2 still open', 'and the pill moved with it');

  const line = card.questions.find(q => q.parameterId === ONE_LINE)!;
  eq(line.state, 'answered', '');
  eq(line.label, 'answered', '');
  eq(line.answers[0].value, 'I help people who feel stuck at work.', 'kept word for word');
  eq(card.questions.find(q => q.parameterId === PAIN)!.label, 'waiting', '');
});

test('a refusal to answer is knowledge, not a gap', () => {
  let body = markSent(withRound(emptyBody(NOW), [ONE_LINE, HATE]), 1);
  body = fileAnswer(body, {
    round: 1, parameter_id: HATE, kind: 'skipped', value: '', by: 'client',
    source: 'round-1', now: NOW,
  });
  body = refreshRounds(body, NOW);

  const card = composeRounds(body)[0];
  const line = card.questions.find(q => q.parameterId === HATE)!;
  eq(line.state, 'not-said', 'it is closed, not waiting');
  eq(line.label, 'they would not say', '');
  eq(card.openCount, 1, 'and it does not count as still open');
});

test('every question back turns the dot green, and curating turns the pill to the date', () => {
  let body = markSent(withRound(emptyBody(NOW), [ONE_LINE, HATE]), 1);
  body = answer(body, 1, ONE_LINE, 'One line.');
  body = answer(body, 1, HATE, 'Hustle.');

  let card = composeRounds(body)[0];
  eq(card.status, 'answered', '');
  eq(card.done, true, 'the dot is the answered colour');
  eq(card.pill, 'all back, waiting on you', '');
  eq(card.openCount, 0, '');

  body = markCurated(body, ONE_LINE, LATER);
  body = markCurated(body, HATE, LATER);
  card = composeRounds(body)[0];
  eq(card.status, 'curated', '');
  eq(card.pill, 'curated 28 Jul', 'the date comes from the curation record');
});

test('rounds are newest first, and reopening does not disturb the old one', () => {
  let body = withRound(emptyBody(NOW), [ONE_LINE]);
  body = markSent(body, 1);
  body = answer(body, 1, ONE_LINE, 'One line.');
  body = markCurated(body, ONE_LINE, NOW);
  body = withRound(body, [HATE], LATER);

  const cards = composeRounds(body);
  eq(cards.map(c => c.version), [2, 1], 'newest first');
  eq(cards[1].questions[0].answers[0].value, 'One line.', 'and round 1 still reads exactly as it did');
});

suite('intake screens — the headline counts from the rounds');

test('with no rounds it says there are none', () => {
  eq(intakeHeadline(composeRounds(emptyBody(NOW))),
    'No rounds yet. Open one to see the questions it would ask.', '');
});

test('the number in the headline follows the array', () => {
  const two = markSent(withRound(emptyBody(NOW), [ONE_LINE, HATE]), 1);
  eq(intakeHeadline(composeRounds(two)), '2 questions still open from round 1.', '');

  const three = markSent(withRound(emptyBody(NOW), [ONE_LINE, HATE, PAIN]), 1);
  eq(intakeHeadline(composeRounds(three)), '3 questions still open from round 1.',
    'a different array, a different number, with nothing in the copy changed');

  const one = answer(markSent(withRound(emptyBody(NOW), [ONE_LINE, HATE]), 1), 1, ONE_LINE, 'x');
  eq(intakeHeadline(composeRounds(one)), '1 question still open from round 1.',
    'and it says question, not questions');
});

test('the headline names each state in turn', () => {
  const written = withRound(emptyBody(NOW), [ONE_LINE, HATE]);
  eq(intakeHeadline(composeRounds(written)),
    'Round 1 is written and not sent yet. 2 questions in it.', '');

  let body = markSent(withRound(emptyBody(NOW), [ONE_LINE, HATE]), 1);
  body = answer(body, 1, ONE_LINE, 'One line.');
  body = answer(body, 1, HATE, 'Hustle.');
  eq(intakeHeadline(composeRounds(body)), '2 answers are back and waiting on your reading.', '');

  body = markCurated(body, ONE_LINE, LATER);
  body = markCurated(body, HATE, LATER);
  eq(intakeHeadline(composeRounds(body)), 'All rounds answered and curated.', '');
});

// ── Curation ─────────────────────────────────────────────────────────────────

/** A profile with two answers back on one parameter and one on another. */
function answered(): ProfileBody {
  let body = markSent(withRound(emptyBody(NOW), [ONE_LINE, HATE]), 1);
  body = answer(body, 1, ONE_LINE, 'I help people who feel stuck at work.');
  body = answer(body, 1, HATE, 'Hustle, grind, and anything with a countdown.');
  return body;
}

function curate(body: ProfileBody, parameter: string, value: string, sources: string[], now = LATER): ProfileBody {
  return curateParameter(body, {
    parameter_id: parameter, value, source_refs: sources,
    curator: 'owner', confidence: 'confirmed', now,
  });
}

suite('intake screens — Curation');

test('the raw side is permanent: nothing it returns can be edited', () => {
  const panel = composeCuration(answered(), HATE)!;
  eq(panel.raw.length, 1, '');
  eq(panel.raw[0].value, 'Hustle, grind, and anything with a countdown.', 'verbatim');
  for (const a of panel.raw) eq(a.editable, false, 'a raw answer is never editable (S11)');
  eq(panel.rawLine, '1 answer, kept exactly as it arrived.', 'and the line counts from the array');
});

test('the raw line says plainly when nothing has come back', () => {
  const panel = composeCuration(emptyBody(NOW), HATE)!;
  eq(panel.raw.length, 0, '');
  eq(panel.rawLine, 'Nothing has come back for this one yet.',
    'missing is shown as missing, never as an empty value');
  eq(panel.current, null, '');
  eq(panel.provenanceLine, 'Nothing written yet.', '');
});

test('a curated value carries who, when, from what, and how sure', () => {
  const body = answered();
  const source = composeCuration(body, HATE)!.raw[0].id;
  const panel = composeCuration(
    curate(body, HATE, 'No hustle words. No countdowns.', [source]), HATE,
  )!;

  eq(panel.current!.value, 'No hustle words. No countdowns.', '');
  eq(panel.current!.curator, 'owner', '');
  eq(panel.current!.confidence, 'confirmed', '');
  eq(panel.current!.sources.length, 1, '');
  eq(panel.current!.sources[0].kind, 'answer', 'the source resolves to the answer that produced it');
  eq(panel.current!.sources[0].text, 'Hustle, grind, and anything with a countdown.', '');
  eq(panel.provenanceLine,
    'Curated by owner on 28 Jul. From 1 answer. They said it plainly.',
    'the whole provenance in one sentence');
});

test('a second reading supersedes the first, and both stay legible', () => {
  const body = answered();
  const source = composeCuration(body, HATE)!.raw[0].id;
  let next = curate(body, HATE, 'No hustle words.', [source]);
  next = curate(next, HATE, 'No hustle words. No countdowns. Claims stay checkable.', [source],
    '2026-08-02T09:00:00.000Z');

  const panel = composeCuration(next, HATE)!;
  eq(panel.current!.value, 'No hustle words. No countdowns. Claims stay checkable.', 'the newest reads');
  eq(panel.superseded.length, 1, 'and the earlier one is kept, not overwritten');
  eq(panel.superseded[0].value, 'No hustle words.', '');
  ok(panel.provenanceLine.includes('It replaced 1 earlier reading, kept below.'),
    `what it superseded is named: ${panel.provenanceLine}`);
});

test('a value assembled from her own note says so', () => {
  const panel = composeCuration(
    curate(emptyBody(NOW), ONE_LINE, 'Designer who runs personal brands.', ['owner-direct:I wrote this one']),
    ONE_LINE,
  )!;
  eq(panel.current!.ownerDirectOnly, true, '');
  eq(panel.current!.sources[0].kind, 'owner', '');
  ok(panel.provenanceLine.includes('From your own note, not from an answer.'),
    panel.provenanceLine);
});

test('the footer names the Strategy parameters it feeds, and says so when there are none', () => {
  eq(composeCuration(emptyBody(NOW), HATE)!.feedsLine,
    'Feeds Strategy, Voice and Boundaries.', '');
  eq(composeCuration(emptyBody(NOW), ONE_LINE)!.feedsLine,
    'Feeds Strategy, Positioning.', '');
  eq(composeCuration(emptyBody(NOW), NAME)!.feedsLine,
    'No strategy decision reads this one.', '');
});

test('an id that is not a parameter composes nothing', () => {
  eq(composeCuration(emptyBody(NOW), 'not-a-parameter'), null, '');
});

// ── The queue: one parameter at a time ───────────────────────────────────────

suite('intake screens — the curation queue');

test('a parameter nobody has spoken to is absent on a client profile', () => {
  const queue = curationQueue(answered());
  eq(queue.map(i => i.id), [ONE_LINE, HATE], 'only what has something behind it');
  ok(!queue.some(i => i.id === PAIN), 'off means absent: nothing was said, so there is no row');
  eq(hasCuration(emptyBody(NOW)), false,
    'and with nothing at all, the Curation screen does not exist');
});

test('on one of her own profiles she can write from her own note, so everything is offered', () => {
  const queue = curationQueue(emptyBody(NOW), { includeUnanswered: true });
  ok(queue.length > 30, 'the whole inventory');
  ok(queue.some(i => i.id === PAIN), '');
  eq(queue.every(i => i.id !== 'client-ideas'), true,
    'except the ideas lane, which becomes a seed in the Engine and never a fact about them');
});

test('the work is first and the written ones are last', () => {
  const body = answered();
  const source = composeCuration(body, ONE_LINE)!.raw[0].id;
  const queue = curationQueue(curate(body, ONE_LINE, 'Stuck, not jobless.', [source]));

  eq(queue.map(i => i.id), [HATE, ONE_LINE], 'the one still waiting is on top');
  eq(queue[0].waiting, true, '');
  eq(queue[1].curated, true, '');
  eq(queue[0].answers, 1, 'and the answer count is counted, not stored');
});

test('the progress line counts from the queue', () => {
  const body = answered();
  eq(curationProgress(curationQueue(body)).line, '0 of 2 written.', '');

  const source = composeCuration(body, ONE_LINE)!.raw[0].id;
  const one = curate(body, ONE_LINE, 'Stuck, not jobless.', [source]);
  eq(curationProgress(curationQueue(one)).line, '1 of 2 written.',
    'one more written, one more counted, with the sentence untouched');
  eq(curationProgress([]).line, 'Nothing has come back to curate yet.', '');
});

test('the screen opens on the next job, and walks to the one after it', () => {
  const body = answered();
  const queue = curationQueue(body);

  eq(selectParameter(queue, null), ONE_LINE, 'the first thing waiting');
  eq(selectParameter(queue, HATE), HATE, 'unless she asked for one');
  eq(selectParameter(queue, 'not-a-parameter'), ONE_LINE, 'a bad id falls back to the work');
  eq(nextParameter(queue, ONE_LINE), HATE, '');
  eq(nextParameter(queue, HATE), ONE_LINE, 'it wraps rather than dead-ending');

  const source = composeCuration(body, HATE)!.raw[0].id;
  const done = curationQueue(curate(body, HATE, 'No hustle words.', [source]));
  eq(nextParameter(done, ONE_LINE), null, 'and when nothing is waiting it says so');
  eq(selectParameter([], null), null, '');
});

test('their ideas are read in the Engine, not curated here', () => {
  let body = markSent(withRound(emptyBody(NOW), [ONE_LINE]), 1);
  body = fileAnswer(body, {
    round: 1, parameter_id: 'client-ideas', value: 'Can we talk about the pricing thing?',
    by: 'client', source: 'round-1', now: NOW,
  });

  eq(clientIdeas(body).length, 1, '');
  eq(clientIdeas(body)[0].value, 'Can we talk about the pricing thing?', '');
  eq(clientIdeas(body)[0].editable, false, 'their idea is a raw answer too, so it is permanent');
  ok(!curationQueue(body).some(i => i.id === 'client-ideas'), 'and it is not in the queue');
  eq(clientIdeas(emptyBody(NOW)).length, 0, 'with none, there is nothing to render at all');
});

// ── The small shared words ───────────────────────────────────────────────────

suite('intake screens — the words');

test('dates read the way she says them, and do not move with the machine', () => {
  eq(shortDate('2026-06-04T23:30:00.000Z'), '4 Jun', '');
  eq(shortDate('2026-12-31T00:00:00.000Z'), '31 Dec', '');
  eq(shortDate('not a date'), '', 'a broken date renders nothing rather than Invalid Date');
});

test('lists read as a sentence', () => {
  eq(listWords([]), '', '');
  eq(listWords(['Voice']), 'Voice', '');
  eq(listWords(['Voice', 'Boundaries']), 'Voice and Boundaries', '');
  eq(listWords(['Voice', 'Pillars', 'Boundaries']), 'Voice, Pillars and Boundaries', '');
});

test('every confidence state has plain words', () => {
  eq(confidenceWords('confirmed'), 'They said it plainly.', '');
  eq(confidenceWords('inferred'), 'Read out of what they said.', '');
  eq(confidenceWords('legacy-unverified'), 'Carried over from the old system and never checked.', '');
  eq(confidenceWords('unknown'), 'Still a gap.', '');
});
