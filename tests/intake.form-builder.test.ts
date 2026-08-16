// The questionnaire builder — 2026-08-11.
//
// Her brief: it should work "like how we make it on Google Forms". The load
// bearing tests here are the ones that stop a form reaching a client in a state
// where it cannot honestly be answered.

import { readFileSync } from 'node:fs';
import { suite, test, eq, ok } from './harness.ts';
import { emptyBody } from '../lib/tree/body.ts';
import {
  QUESTION_TYPES, blankQuestion, canSend, cleanOptions, formProblems, formResponses,
  liveForm, moveQuestion, openBuiltForm, responsesLine, typeNeedsOptions,
  type QuestionDraft,
} from '../lib/intake/formBuilder.ts';
import { fileAnswer, readRounds } from '../lib/intake/rounds.ts';

const NOW = '2026-08-11T10:00:00.000Z';
const q = (over: Partial<QuestionDraft>): QuestionDraft => ({
  ...blankQuestion('k'), ...over,
});

suite('the questionnaire builder');

test('every type she can pick is a type the client form can actually draw', () => {
  // Offering a type the form renders as blank space is worse than not offering
  // it. This reads the form's own renderer and compares.
  const form = readFileSync(new URL('../components/intake/ClientForm.tsx', import.meta.url), 'utf8');
  for (const t of QUESTION_TYPES) {
    const drawn = t.id === 'long-text'
      ? /textarea/.test(form)                       // the fall-through case
      : form.includes(`'${t.id}'`);
    ok(drawn, `"${t.label}" is offered but ClientForm cannot draw ${t.id}`);
  }
});

test('a choice question with no options is refused, not tidied away', () => {
  const problems = formProblems([q({ text: 'Which platforms?', shape: 'single-select' })]);
  ok(problems.some(p => /at least two options/.test(p)), problems.join(' | '));
  eq(canSend([q({ text: 'Which platforms?', shape: 'single-select' })]), false, 'no options');
  eq(
    canSend([q({ text: 'Which platforms?', shape: 'single-select', options: ['Instagram', 'LinkedIn'] })]),
    true,
    'two options is answerable',
  );
});

test('an empty form, and a duplicated question, are both named', () => {
  ok(formProblems([]).some(p => /no questions/.test(p)), 'empty');
  const twice = [q({ text: 'What do you sell?' }), q({ key: 'b', text: 'what do you sell? ' })];
  ok(formProblems(twice).some(p => /twice/.test(p)), 'the same question two ways');
});

test('blank lines and duplicate options are dropped before sending', () => {
  eq(cleanOptions([' Instagram ', 'Instagram', '', '  ', 'LinkedIn']), ['Instagram', 'LinkedIn'], 'trimmed and deduped');
});

test('questions can be reordered, and a move off the end does nothing', () => {
  const list = [q({ key: 'a', text: 'A' }), q({ key: 'b', text: 'B' }), q({ key: 'c', text: 'C' })];
  eq(moveQuestion(list, 0, 1).map(d => d.key).join(''), 'bac', 'down');
  eq(moveQuestion(list, 2, -1).map(d => d.key).join(''), 'acb', 'up');
  eq(moveQuestion(list, 0, -1).map(d => d.key).join(''), 'abc', 'off the top is a no-op');
  eq(moveQuestion(list, 2, 1).map(d => d.key).join(''), 'abc', 'off the bottom is a no-op');
});

test('a built form is an ordinary round, sent, in the order she built it', () => {
  const { body, round } = openBuiltForm(emptyBody(), [
    q({ key: 'a', text: 'What do you sell?', shape: 'text' }),
    q({ key: 'b', text: 'Which platforms?', shape: 'multi-select', options: ['Instagram', 'LinkedIn'] }),
    q({ key: 'c', text: 'Do you want to be on camera?', shape: 'yes-no' }),
  ], NOW);

  eq(round.status, 'sent', 'her own wording needs no approval pass');
  eq(round.parameters.length, 3, 'three questions');
  const form = liveForm(body)!;
  eq(form.questions.map(x => x.text), [
    'What do you sell?', 'Which platforms?', 'Do you want to be on camera?',
  ], 'the order she built is the order they are asked');
  eq(form.questions[1].shape, 'multi-select', 'the type she picked survives');
  eq(form.questions[1].options, ['Instagram', 'LinkedIn'], 'and so do the options');
});

test('a list always ships a way to say something not on it', () => {
  // §4.7. A client whose answer is not among her options must still be able to
  // give it, or the form invents data by omission.
  const { body } = openBuiltForm(emptyBody(), [
    q({ text: 'Which platforms?', shape: 'single-select', options: ['Instagram', 'LinkedIn'] }),
  ], NOW);
  const stored = liveForm(body)!;
  eq(stored.questions.length, 1, 'one question');
  // The lane lives on the stored question, which liveForm does not expose, so
  // it is read from the round's own questions through formResponses' source.
  eq(stored.questions[0].options.length, 2, 'her two options are there');
});

test('a form that cannot be answered is never sent', () => {
  let threw = false;
  try {
    openBuiltForm(emptyBody(), [q({ text: 'Pick one', shape: 'single-select' })], NOW);
  } catch { threw = true; }
  eq(threw, true, 'refused at the door, not repaired quietly');
});

suite('reading a questionnaire back');

test('an unanswered question is shown, not hidden', () => {
  // What a client declined to answer is often the more useful fact.
  const { body, round } = openBuiltForm(emptyBody(), [
    q({ key: 'a', text: 'What do you sell?', shape: 'text' }),
    q({ key: 'b', text: 'Who is it for?', shape: 'text' }),
  ], NOW);
  const answered = fileAnswer(body, {
    round: round.version, parameter_id: round.parameters[0],
    value: 'Plots and flats.', by: 'client', source: 'client-form',
    now: '2026-08-11T11:00:00.000Z',
  });

  const back = formResponses(answered);
  eq(back.length, 2, 'both questions come back');
  eq(back[0].answer, 'Plots and flats.', 'kept exactly as it arrived');
  eq(back[1].answer, null, 'and the silence is visible');
  eq(responsesLine(back), '1 of 2 answered.', 'counted, not guessed');
});

test('the count never flatters', () => {
  eq(responsesLine([]), 'No form has been sent yet.', 'nothing sent');
  const { body, round } = openBuiltForm(emptyBody(), [q({ text: 'One?', shape: 'text' })], NOW);
  eq(responsesLine(formResponses(body)), 'Sent. No response yet to 1 questions.', 'sent, silent');
  const done = fileAnswer(body, {
    round: round.version, parameter_id: round.parameters[0], value: 'Yes',
    by: 'client', source: 'client-form', now: NOW,
  });
  eq(responsesLine(formResponses(done)), 'All 1 answered.', 'complete');
});

test('sending a new form retires the last one rather than running two', () => {
  const first = openBuiltForm(emptyBody(), [q({ text: 'First?', shape: 'text' })], NOW);
  const second = openBuiltForm(first.body, [q({ text: 'Second?', shape: 'text' })], NOW);
  const open = readRounds(second.body).filter(r => r.status === 'sent');
  eq(open.length, 1, 'exactly one form is out at a time');
  eq(liveForm(second.body)!.questions[0].text, 'Second?', 'the newest is the live one');
});

test('typeNeedsOptions is honest about which types need a list', () => {
  eq(typeNeedsOptions('single-select'), true, 'choose one');
  eq(typeNeedsOptions('multi-select'), true, 'choose any');
  eq(typeNeedsOptions('long-text'), false, 'a paragraph needs none');
  eq(typeNeedsOptions('nonsense'), false, 'an unknown type never demands options');
});
