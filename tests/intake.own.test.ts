// Her own questions, and meeting notes — 2026-08-11.
//
// One of these covers a regression: filing what a meeting produced lived only
// on the Rounds screen, and removing that screen removed the route. These tests
// exist so it cannot go missing a second time.

import { suite, test, eq, ok } from './harness.ts';
import { emptyBody } from '../lib/tree/body.ts';
import {
  fileMeetingNote, isOwnQuestion, openOwnQuestions, openOwnRound, readMeetingNotes,
  readOwnAnswers,
} from '../lib/intake/ownQuestions.ts';
import { fileAnswer, readRounds } from '../lib/intake/rounds.ts';

const NOW = '2026-08-11T10:00:00.000Z';

suite('intake — her own questions');

test('she can ask a question nobody wrote for her', () => {
  const { body, round } = openOwnRound(emptyBody(), [
    'What does a good month look like for the studio?',
    'Who else do you want to be seen beside?',
  ], NOW);
  eq(round.parameters.length, 2, 'two questions asked');
  eq(round.status, 'sent', 'her own wording needs no approval pass');
  const asked = openOwnQuestions(body).map(q => q.text);
  eq(asked.includes('What does a good month look like for the studio?'), true, 'the first');
  eq(asked.includes('Who else do you want to be seen beside?'), true, 'the second');
});

test('blank lines are dropped, and an empty round refuses', () => {
  const { round } = openOwnRound(emptyBody(), ['  ', 'Real question', ''], NOW);
  eq(round.parameters.length, 1, 'only the real one is asked');
  let threw = false;
  try { openOwnRound(emptyBody(), ['   ', ''], NOW); } catch { threw = true; }
  eq(threw, true, 'a round of nothing is refused rather than sent empty');
});

test('an answer comes back attached to the question she wrote', () => {
  const { body, round } = openOwnRound(emptyBody(), ['What does a good month look like?'], NOW);
  const answered = fileAnswer(body, {
    round: round.version,
    parameter_id: round.parameters[0],
    value: 'Twelve posts and two enquiries.',
    by: 'client',
    source: 'client-form',
    now: '2026-08-11T11:00:00.000Z',
  });
  const back = readOwnAnswers(answered);
  eq(back.length, 1, 'one answer back');
  eq(back[0].question, 'What does a good month look like?', 'it remembers what was asked');
  eq(back[0].value, 'Twelve posts and two enquiries.', 'kept exactly as it arrived');
});

test('her questions never look like bank parameters or the eight facts', () => {
  const { round } = openOwnRound(emptyBody(), ['Anything'], NOW);
  ok(isOwnQuestion(round.parameters[0]), 'carries its own prefix');
  eq(isOwnQuestion('fact.voice'), false, 'a fact is not one of hers');
  eq(isOwnQuestion('identity.name'), false, 'a bank parameter is not one of hers');
});

suite('intake — what a meeting produced');

test('a meeting can be filed, and reads back with who said it', () => {
  const body = fileMeetingNote(emptyBody(), {
    title: 'Call with Sanat, 11 Aug',
    text: 'They want to stop posting reels for a month and push the Hyrox series.',
    said_by: 'Sanat',
    now: NOW,
    id: 'm1',
  });
  const notes = readMeetingNotes(body);
  eq(notes.length, 1, 'one meeting filed');
  eq(notes[0].title, 'Call with Sanat, 11 Aug', 'her heading');
  eq(notes[0].text, 'They want to stop posting reels for a month and push the Hyrox series.', 'their words');
  eq(notes[0].by, 'Sanat (meeting)', 'the source travels with the claim');
});

test('a meeting never sits in the way of a real question', () => {
  // The trap: a meeting opens a round, and an open round is what the screen
  // shows as "waiting on the client". A meeting is waiting on nobody.
  const withMeeting = fileMeetingNote(emptyBody(), {
    title: 'A call', text: 'Something said', now: NOW, id: 'm1',
  });
  eq(readRounds(withMeeting).some(r => r.status === 'sent'), false, 'nothing is left open');
  eq(openOwnQuestions(withMeeting).length, 0, 'and nothing reads as asked');
});

test('an empty meeting note is refused rather than filed blank', () => {
  let threw = false;
  try {
    fileMeetingNote(emptyBody(), { title: 'A call', text: '   ', now: NOW, id: 'm1' });
  } catch { threw = true; }
  eq(threw, true, 'a blank meeting is refused');
});

test('several meetings stack newest first, and keep their own words', () => {
  let body = fileMeetingNote(emptyBody(), {
    title: 'First call', text: 'One', now: '2026-08-01T10:00:00.000Z', id: 'm1',
  });
  body = fileMeetingNote(body, {
    title: 'Second call', text: 'Two', now: '2026-08-09T10:00:00.000Z', id: 'm2',
  });
  const notes = readMeetingNotes(body);
  eq(notes.length, 2, 'both kept');
  eq(notes[0].title, 'Second call', 'newest first');
  eq(notes[1].text, 'One', 'and the older one is untouched');
});
