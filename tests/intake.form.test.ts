// The client's questionnaire — spec 33 §4, and §5's standing rule.
//
// These check the four things the spec calls guarantees rather than taste:
//
//   1. Where am I, how do I go on, how do I go back, how do I leave without
//      losing anything. All four are computed, and the tests read them.
//   2. Every count is counted from the array it describes. The tests prove it
//      the only way it can be proved: change the array, read the sentence again.
//   3. A skip is a third state. It writes no answer record, and a round cannot
//      reach `answered` while anything is only skipped.
//   4. A raw answer is never altered (S11).
//
// Plain Node, no dependencies, in the house harness style.
//
// NOT REGISTERED in tests/run.ts — that file is shared and owned by the
// integrator. Run it on its own with:
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \
//     "import('./tests/intake.form.test.ts').then(async m => \
//      process.exit(await (await import('./tests/harness.ts')).run()))"

import { suite, test, ok, eq, throws } from './harness.ts';
import { emptyBody, putEntry, type ProfileBody } from '../lib/tree/body.ts';
import type { IntakeRound } from '../lib/tree/objects.ts';
import type { SwitchConfig } from '../lib/tree/contract.ts';
import {
  openRound, fileAnswer, readRounds, readAnswers, readQuestions, refreshRounds, INTAKE_PATH,
} from '../lib/intake/rounds.ts';
import { computeStatus, type AnswerRecord, type RoundView } from '../lib/intake/status.ts';
import {
  buildSteps, progressOf, progressLine, resumeIndex, resumeLine, nextUnfinished,
  formModel, modelFromSteps, clampCursor, goNext, goBack, jumpTo, sendLine,
  applySkip, readSkipped, writeSkipped, onlySkipped, roundCanBeAnswered, openFormFor,
  stateLine, type FormInput, type FormStep,
} from '../lib/intake/form.ts';

const NOW = '2026-08-08T09:00:00.000Z';
const CONFIG: SwitchConfig = {};

const ONE_LINE = 'identity.one-line';
const NAME = 'identity.name';
const HATE = 'voice.words-they-hate';
const PAIN = 'audience.pain';

const FOUR = [NAME, ONE_LINE, HATE, PAIN];

/** A round holding exactly these parameters, forced out of the door. */
function withRound(parameters: string[], now = NOW): ProfileBody {
  const { body, round } = openRound(emptyBody(now), {
    parameters, delivery: 'dashboard-questionnaire', config: CONFIG, now,
  });
  // Every parameter still ships the draft wording, so `sendRound` correctly
  // refuses in a fixture. The state after a send is still a real state.
  const sent: IntakeRound = { ...round, status: 'sent' };
  return putEntry(body, INTAKE_PATH, {
    id: round.id, type: 'intake_round', data: sent as unknown as Record<string, unknown>,
  }, { writer: 'owner', now });
}

function answer(body: ProfileBody, version: number, parameter: string, value: string): ProfileBody {
  return refreshRounds(fileAnswer(body, {
    round: version, parameter_id: parameter, value, by: 'client',
    source: `round-${version}`, now: NOW, writer: 'client',
  }), NOW);
}

function inputFrom(body: ProfileBody, extra: Partial<FormInput> = {}): FormInput {
  const round = readRounds(body).pop()!;
  return {
    parameters: round.parameters,
    questions: readQuestions(body, round.version),
    answers: readAnswers(body),
    skipped: round.skipped ?? [],
    roundVersion: round.version,
    ...extra,
  };
}

// ── Where am I ───────────────────────────────────────────────────────────────

suite('spec 33 §4 — one question at a time, and where am I');

test('the walk is one step per parameter, in the round\'s own order', () => {
  const body = withRound(FOUR);
  const steps = buildSteps(inputFrom(body));

  eq(steps.length, 4, 'four parameters, four steps');
  eq(steps.map(s => s.parameterId), FOUR, 'in the order the round asks them');
  eq(steps.map(s => s.number), [1, 2, 3, 4], 'numbered the way a person counts');
  ok(steps.every(s => s.text.length > 0), 'every step carries the words the client reads');
});

test('"1 of 4" is counted from the array, and changes when the array does', () => {
  const four = modelFromSteps(buildSteps(inputFrom(withRound(FOUR))), 0);
  eq(four.positionLine, '1 of 4', 'four questions, so four');

  const two = modelFromSteps(buildSteps(inputFrom(withRound([NAME, ONE_LINE]))), 0);
  eq(two.positionLine, '1 of 2', 'two questions, so two — nothing here is stored');
  eq(two.total, 2, 'and the total is the length of the array it describes');
});

test('the position moves with the cursor, and the last step is not the end', () => {
  const steps = buildSteps(inputFrom(withRound(FOUR)));
  eq(modelFromSteps(steps, 2).positionLine, '3 of 4', 'third of four');
  eq(modelFromSteps(steps, 3).onReview, false, 'the fourth question is still a question');
  eq(modelFromSteps(steps, 4).onReview, true, 'the review screen sits one past the last');
  eq(modelFromSteps(steps, 4).positionLine, 'Review', 'and it says what it is');
});

// ── How do I go on, how do I go back ─────────────────────────────────────────

suite('spec 33 §5 — go on, go back, and neither is the browser');

test('back and next exist on every step, and clamp at both ends', () => {
  const steps = buildSteps(inputFrom(withRound(FOUR)));

  const first = modelFromSteps(steps, 0);
  eq(first.backIndex, null, 'nothing behind the first question');
  eq(first.nextIndex, 1, 'and the way on is on the screen');

  const middle = modelFromSteps(steps, 2);
  eq(middle.backIndex, 1, 'back is a step, not a browser button');
  eq(middle.nextIndex, 3, 'and next is the next one');

  const review = modelFromSteps(steps, 4);
  eq(review.nextIndex, null, 'the review screen is the last thing');
  eq(review.backIndex, 3, 'and you can still walk back into the questions');
});

test('moving never falls off either end', () => {
  const steps = buildSteps(inputFrom(withRound(FOUR)));
  eq(goBack(modelFromSteps(steps, 0)), 0, 'back at the first stays at the first');
  eq(goNext(modelFromSteps(steps, 4)), 4, 'next at the review stays at the review');
  eq(goNext(modelFromSteps(steps, 3)), 4, 'next on the last question reaches the review');
  eq(clampCursor(-9, 4), 0, 'a nonsense cursor lands somewhere real');
  eq(clampCursor(99, 4), 4, 'and so does the other kind');
  eq(jumpTo(modelFromSteps(steps, 0), 2), 2, 'the list view jumps');
  eq(jumpTo(modelFromSteps(steps, 0), 40), 4, 'and clamps when it is asked for nonsense');
});

// ── The third state ──────────────────────────────────────────────────────────

suite('spec 33 §4 — skip is a third state, not a soft no');

test('answered, skipped and blank are three different things', () => {
  let body = withRound(FOUR);
  body = answer(body, 1, NAME, 'Kaur Studio');
  const steps = buildSteps(inputFrom(body, { skipped: [HATE] }));

  eq(steps[0].state, 'answered', 'they said it');
  eq(steps[1].state, 'blank', 'they have not reached it');
  eq(steps[2].state, 'skipped', 'they said they would come back');
  eq(steps[2].stateLine, 'Marked for later', 'and it is visible as that');
  eq(stateLine('blank'), 'Not answered yet', 'blank says the true, different thing');
});

test('a skip writes no answer record at all', () => {
  const body = withRound(FOUR);
  const before = readAnswers(body).length;
  const skipped = applySkip([], HATE, true);

  eq(skipped, [HATE], 'the skip is a list of parameter ids');
  eq(readAnswers(body).length, before, 'and nothing was written to the answers — a skip is not something they said');
});

test('the skip list is idempotent, and answering clears it', () => {
  let s = applySkip([], HATE, true);
  s = applySkip(s, HATE, true);
  eq(s, [HATE], 'skipping twice is one skip');
  s = applySkip(s, PAIN, true);
  eq(s, [HATE, PAIN], 'two skips are two');
  s = applySkip(s, HATE, false);
  eq(s, [PAIN], 'and answering it takes it back off the list');
});

test('a round cannot be marked answered while anything is only skipped', () => {
  let body = withRound(FOUR);
  for (const p of FOUR) {
    if (p === HATE) continue;
    body = answer(body, 1, p, `said something about ${p}`);
  }
  body = writeSkipped(body, 'round-1', [HATE], NOW);

  const round = readRounds(body).pop()!;
  const answers = readAnswers(body);
  eq(onlySkipped(round, answers), [HATE], 'one thing is only skipped');
  eq(roundCanBeAnswered(round, answers), false, 'so the round is not answered');

  const view: RoundView = {
    version: round.version, parameters: round.parameters,
    sent: true, curation: round.curation ?? {},
  };
  eq(computeStatus(view, answers), 'sent', 'and the status function agrees: still open');

  // Then they come back to it, which is what a skip is FOR.
  body = answer(body, 1, HATE, 'nothing corporate');
  const after = readRounds(body).pop()!;
  eq(onlySkipped(after, readAnswers(body)), [], 'nothing is only skipped now');
  eq(roundCanBeAnswered(after, readAnswers(body)), true, 'and the round can close');
  eq(computeStatus(view, readAnswers(body)), 'answered', 'the status says so too');
});

test('the skip is kept on the round, and the client can never write it there', () => {
  let body = withRound(FOUR);
  eq(readSkipped(body, 'round-1'), [], 'nothing skipped yet');

  body = writeSkipped(body, 'round-1', [HATE, PAIN], NOW);
  eq(readSkipped(body, 'round-1'), [HATE, PAIN], 'it round-trips through the body');

  throws(
    () => writeSkipped(body, 'round-1', [HATE], NOW, 'client'),
    'is not a declared writer',
    'the round object refuses a client writer, exactly as spec 22 §5.2 requires',
  );
  throws(
    () => writeSkipped(body, 'round-9', [], NOW),
    'no round round-9',
    'and a round that does not exist is not silently invented',
  );
});

// ── Save as you go, and the resume point ─────────────────────────────────────

suite('spec 33 §4 — closing the tab loses nothing, and reopening says so');

test('a fresh form starts at the first question and promises the save', () => {
  const steps = buildSteps(inputFrom(withRound(FOUR)));
  eq(resumeIndex(steps), 0, 'nothing is done, so the first thing is the first thing');
  eq(
    resumeLine(steps, 0),
    '4 questions. Your answers are saved automatically, so you can return at any time.',
    'and it says the one thing a stranger needs to hear',
  );
});

test('reopening returns to the first thing not yet done, and says which', () => {
  let body = withRound(FOUR);
  body = answer(body, 1, NAME, 'Kaur Studio');
  body = answer(body, 1, ONE_LINE, 'I make things people keep');
  const steps = buildSteps(inputFrom(body));

  eq(resumeIndex(steps), 2, 'two are done, so the third is where they left off');
  eq(
    resumeLine(steps, resumeIndex(steps)),
    'Resuming at question 3 of 4. Your previous answers are saved.',
    'in one plain line',
  );
});

test('a skipped question is not done, so the resume point goes back to it', () => {
  let body = withRound(FOUR);
  for (const p of [ONE_LINE, HATE, PAIN]) body = answer(body, 1, p, `about ${p}`);
  const steps = buildSteps(inputFrom(body, { skipped: [NAME] }));

  eq(steps[0].state, 'skipped', 'the first one was left for later');
  eq(resumeIndex(steps), 0, 'so reopening lands on it, not on the review screen');
  eq(nextUnfinished(steps, 0), null, 'and there is nothing else unfinished after it');
});

test('when everything is answered the resume point is the review screen', () => {
  let body = withRound(FOUR);
  for (const p of FOUR) body = answer(body, 1, p, `about ${p}`);
  const steps = buildSteps(inputFrom(body));

  eq(resumeIndex(steps), 4, 'one past the last question');
  eq(resumeLine(steps, 4), 'All 4 questions answered. Review and submit when ready.', 'and it says so');
  eq(modelFromSteps(steps, resumeIndex(steps)).onReview, true, 'which is the review screen');
});

test('an answer is never altered, and the step carries the words as they arrived', () => {
  let body = withRound(FOUR);
  body = answer(body, 1, NAME, '  Kaur Studio  ');
  const step = buildSteps(inputFrom(body))[0];
  eq(step.answer, '  Kaur Studio  ', 'kept exactly as it came, spaces and all (S11)');

  throws(
    () => fileAnswer(body, {
      round: 1, parameter_id: NAME, value: 'something else', by: 'client',
      source: 'round-1', now: NOW, writer: 'client',
    }),
    /amend|append|exists/i,
    'and a second write over the same answer is refused',
  );
});

// ── Progress, counted ────────────────────────────────────────────────────────

suite('spec 33 §4 — progress is counted from the array, never a percentage');

test('the progress line changes because the array changed', () => {
  let body = withRound(FOUR);
  eq(progressLine(buildSteps(inputFrom(body))), '0 answered and 4 remaining.', 'at the start');

  body = answer(body, 1, NAME, 'Kaur Studio');
  eq(progressLine(buildSteps(inputFrom(body))), '1 answered and 3 remaining.', 'after one answer');

  const withSkip = buildSteps(inputFrom(body, { skipped: [HATE] }));
  eq(progressLine(withSkip), '1 answered, 1 marked for later and 2 remaining.', 'and a skip is counted as itself');

  const p = progressOf(withSkip);
  eq(p.answered + p.skipped + p.blank, p.total, 'the three states account for every question, always');
});

test('no percentage appears anywhere in what the screen says', () => {
  let body = withRound(FOUR);
  body = answer(body, 1, NAME, 'Kaur Studio');
  const m = formModel(inputFrom(body, { skipped: [HATE] }), 1);
  const copy = [m.positionLine, m.progressLine, m.resumeLine, m.sendLine, m.leaveLine].join(' ');
  ok(!copy.includes('%'), 'a percentage rounded from nothing is exactly what she said not to show');
});

// ── The review screen ────────────────────────────────────────────────────────

suite('spec 33 §4 — the last step is a review, not a submit button');

test('the review partitions every question into what it actually is', () => {
  let body = withRound(FOUR);
  body = answer(body, 1, NAME, 'Kaur Studio');
  body = answer(body, 1, ONE_LINE, 'I make things people keep');
  const m = formModel(inputFrom(body, { skipped: [HATE] }), 4);

  ok(m.onReview, 'the cursor is on the review');
  eq(m.review.answered.map(s => s.parameterId), [NAME, ONE_LINE], 'what they answered');
  eq(m.review.skipped.map(s => s.parameterId), [HATE], 'what they left to come back to');
  eq(m.review.blank.map(s => s.parameterId), [PAIN], 'and what is still blank');
  eq(
    m.review.answered.length + m.review.skipped.length + m.review.blank.length,
    m.total,
    'nothing falls out of the review, which is the point of having one',
  );
});

test('it cannot be sent while anything is blank or only skipped', () => {
  let body = withRound(FOUR);
  eq(formModel(inputFrom(body), 4).canSend, false, 'nothing answered yet');

  for (const p of [NAME, ONE_LINE, PAIN]) body = answer(body, 1, p, `about ${p}`);
  const held = formModel(inputFrom(body, { skipped: [HATE] }), 4);
  eq(held.canSend, false, 'one is only skipped, so it is not finished');
  eq(
    held.sendLine,
    '1 marked for later. Complete it to submit.',
    'and it says which, in her words',
  );

  body = answer(body, 1, HATE, 'nothing corporate');
  const done = formModel(inputFrom(body), 4);
  eq(done.canSend, true, 'now it can go');
  eq(done.sendLine, 'All 4 questions answered. Submit when you are ready.', 'and it says that');
});

test('blank and skipped are both named when both are outstanding', () => {
  let body = withRound(FOUR);
  body = answer(body, 1, NAME, 'Kaur Studio');
  const steps = buildSteps(inputFrom(body, { skipped: [HATE] }));
  eq(
    sendLine(steps),
    '2 not answered and 1 marked for later. Complete them to submit.',
    'both, counted',
  );
});

// ── Attachments, and the walls ───────────────────────────────────────────────

suite('spec 33 §4 — attach here, and what this screen may see');

test('a document given against one question is counted on that question', () => {
  const body = withRound(FOUR);
  const steps = buildSteps(inputFrom(body, {
    documents: [
      { answers_parameter: HATE },
      { answers_parameter: HATE },
      { answers_parameter: undefined },
    ],
  }));
  eq(steps.map(s => s.attachments), [0, 0, 2, 0], 'counted from the array, and only the ones aimed at a question');
});

test('only this round\'s answers reach this round\'s form', () => {
  let body = withRound(FOUR);
  body = answer(body, 1, NAME, 'this round');
  // An answer filed against a different round is not this form's business.
  body = fileAnswer(body, {
    round: 7, parameter_id: ONE_LINE, value: 'a different round entirely',
    by: 'client', source: 'round-7', now: NOW, writer: 'client',
  });

  const steps = buildSteps(inputFrom(body));
  eq(steps[0].state, 'answered', 'its own answer counts');
  eq(steps[1].state, 'blank', 'and another round\'s answer does not');
  ok(!steps.some(s => s.answer.includes('different round')), 'nothing from elsewhere is rendered here');
});

test('the form reads the one profile body it is given, and nothing when there is no round', () => {
  eq(openFormFor(emptyBody(NOW)), null, 'no round, no form — and no invented one');

  let body = withRound(FOUR);
  body = answer(body, 1, NAME, 'Kaur Studio');
  const open = openFormFor(body)!;
  eq(open.round.version, 1, 'the open round');
  eq(open.answers.length, 1, 'its own answers');
  eq(open.questions.length, 4, 'and its own questions');
  ok(open.answers.every(a => a.round_version === 1), 'never another round\'s, never another profile\'s');
});

test('an empty round is a review screen that says so, not a broken walk', () => {
  const m = modelFromSteps([] as FormStep[], 0);
  eq(m.total, 0, 'nothing to walk');
  eq(m.onReview, true, 'so there is nowhere to be but the end');
  eq(m.canSend, false, 'and nothing to send');
  eq(m.progressLine, 'No questions to answer right now.', 'said plainly');
});
