// Spec 22 §14 — acceptance tests 1 to 9, 11, 12, 17, 18 and 19.
//
// Plain Node, no dependencies, no build step, alongside spec 21's 70 checks.

import { suite, test, ok, eq, throws } from './harness.ts';
import { fixtureState } from './fixtures.ts';
import {
  PARAMETERS, findParameter, findVocabularyList, askedOfClient, type ParameterRecord,
} from '../lib/intake/parameters.ts';
import { generateRound, blockedFromSending, activePlatforms } from '../lib/intake/generate.ts';
import { computeStatus, intakeRetired, type AnswerRecord, type RoundView } from '../lib/intake/status.ts';
import {
  openRound, sendRound, fileAnswer, readRounds, readAnswers, readQuestions, markCurated, reopenRound,
} from '../lib/intake/rounds.ts';
import { curateParameter, readCurated, curationHistory, answersFor } from '../lib/intake/curate.ts';
import { mapRoundZero } from '../lib/intake/roundZero.ts';
import { emptyBody, amendEntry, putEntry, readPath } from '../lib/tree/body.ts';
import { isDeclared, findDeclaration } from '../lib/tree/declarations.ts';
import { platformSwitchId } from '../lib/tree/switches.ts';
import { intakeViolations, clientMayWrite, clientMayReadAt } from '../lib/tree/validate.ts';
import { doorsOpenAt } from '../lib/tree/objects.ts';
import { filterStateForRole, mergeRoleWrite, allowedClientIds, normalizeState } from '../lib/access.ts';
import { migrateProfile } from '../lib/tree/migrate.ts';
import { applyScopes, changedScopes, scopeKey } from '../lib/tree/scopes.ts';
import type { SwitchConfig } from '../lib/tree/contract.ts';
import type { AppState } from '../types/index.ts';

const NOW = '2026-07-27T09:00:00.000Z';
const CONFIG: SwitchConfig = {};

const CLIENT_IDEAS = 'client-ideas';

suite('spec 22 §14.1 — intake is HOW, never WHAT');

test('1. every generated question resolves to a parameter in a declared detail folder', () => {
  const { questions } = generateRound({ config: CONFIG, version: 1, platforms: ['Instagram'] });
  ok(questions.length > 30, 'the inventory actually generates a round');
  for (const q of questions) {
    const p = findParameter(q.parameter_id);
    ok(p, `question ${q.id} resolves to no parameter — a question with no parameter fails the build`);
    ok(isDeclared(p!.path), `${p!.id} addresses an undeclared path`);
    const detail = p!.path.startsWith('context/personal-details/') || p!.path.startsWith('context/business-details/');
    ok(detail || p!.id === CLIENT_IDEAS,
      `${p!.id} is not in a detail folder, and it is not the one named client-ideas lane`);
  }
  eq(intakeViolations(), [], 'and the validator agrees, with the build refusing on any violation');
});

test('2. no strategy question, and exactly one lane into the seed bank', () => {
  for (const p of PARAMETERS) {
    ok(!p.path.startsWith('context/content-strategy'),
      `${p.id} asks a strategy question, and content-strategy is derived, never collected`);
  }
  const lanes = PARAMETERS.filter(p => p.curates_to === 'work-log/creation/topics');
  eq(lanes.map(p => p.id), [CLIENT_IDEAS], 'exactly one, and it is the named one (§7.5)');
  eq(lanes[0].path, 'context/intake/answers', 'it lands at the same door as every other answer, give-point 1');

  // The check bites: a second lane fails the build.
  const forged: ParameterRecord = { ...lanes[0], id: 'client-ideas-2' };
  PARAMETERS.push(forged);
  try {
    ok(intakeViolations().some(v => v.reason.includes('exactly one parameter may curate into the seed bank')),
      'a second lane into the seed bank is a fifth door and must be refused');
  } finally {
    PARAMETERS.pop();
  }
});

test('3. the growth test at parameter level: a new parameter rides into the next round', () => {
  const before = generateRound({ config: CONFIG, version: 1 });
  const sentQuestions = before.questions;   // this round is already out; it is a snapshot
  const added: ParameterRecord = {
    id: 'market.regulation', path: 'context/business-details/market', label: 'Regulation',
    question: 'Is anything about to change in the rules of your industry?',
    shape: 'long-text', asked_of: 'client', required_for: [],
    reader: 'none-by-design', reader_reason: 'market-research reads it',
    vocabulary: 'draft', spec08: 'new',
  };
  PARAMETERS.push(added);
  try {
    const after = generateRound({ config: CONFIG, version: 2 });
    ok(after.questions.some(q => q.parameter_id === 'market.regulation'),
      'it appears in the next round with no code change (law 3)');
    ok(!sentQuestions.some(q => q.parameter_id === 'market.regulation'),
      'and never in the round that was already sent — questions are snapshots');
  } finally {
    PARAMETERS.pop();
  }
});

test('4. the cascade reaches the questions', () => {
  const instagramOnly: SwitchConfig = {
    'strategy.fixed': { state: 'active', set_at: 'test' },
    [platformSwitchId('Instagram')]: { state: 'active', set_at: 'test' },
    [platformSwitchId('LinkedIn')]: { state: 'hidden', set_at: 'test' },
  };
  const linkedinOnly: SwitchConfig = {
    ...instagramOnly,
    [platformSwitchId('Instagram')]: { state: 'hidden', set_at: 'test' },
    [platformSwitchId('LinkedIn')]: { state: 'active', set_at: 'test' },
  };
  const li: ParameterRecord = {
    id: 'materials.linkedin-page', path: 'context/business-details/materials', label: 'LinkedIn page',
    question: 'Who runs the company LinkedIn page?', shape: 'text', platform: 'LinkedIn',
    asked_of: 'client', required_for: [], reader: 'none-by-design', reader_reason: 'test only',
    vocabulary: 'draft', spec08: 'new',
  };
  PARAMETERS.push(li);
  try {
    const off = generateRound({ config: instagramOnly, version: 1, platforms: ['Instagram', 'LinkedIn'] });
    ok(!off.questions.some(q => q.parameter_id === li.id),
      'nothing dormant asks to be filled in (PLAN §3.4)');
    ok(off.skipped.some(s => s.parameter_id === li.id && s.why.includes('LinkedIn')), 'and it says why');
    const on = generateRound({ config: linkedinOnly, version: 2, platforms: ['Instagram', 'LinkedIn'] });
    ok(on.questions.some(q => q.parameter_id === li.id), 'flip it and the question comes back');

    // The options a question offers are narrowed the same way.
    const accounts = off.questions.find(q => q.parameter_id === 'materials.existing-accounts')!;
    eq(accounts.options, ['Instagram'], 'a switched-off platform is never offered as an answer either');
    eq(activePlatforms(['Instagram', 'LinkedIn'], linkedinOnly), ['LinkedIn'], 'and it behaves identically in reverse');
  } finally {
    PARAMETERS.pop();
  }
});

suite('spec 22 §14.5 — draft vocabulary blocks sending');

test('5. a round carrying her unfinished wording cannot be sent', () => {
  let body = emptyBody(NOW);
  const opened = openRound(body, { delivery: 'dashboard-questionnaire', config: CONFIG, now: NOW });
  body = opened.body;
  const blocked = sendRound(body, opened.round.id, NOW);
  ok('blocked' in blocked, 'the send is refused while any parameter still carries Claude’s wording');
  ok((blocked as { blocked: string[] }).blocked.length > 30, 'and it names every one of them');
  eq(askedOfClient().every(p => p.vocabulary === 'draft'), true,
    'the whole inventory ships draft until her vocabulary pass (§4)');
  eq(blockedFromSending(['identity.name']), ['identity.name'], 'one parameter is enough to block a round');
});

suite('spec 22 §14.6 — raw answers are immutable');

test('6. an answer cannot be rewritten, and cannot be amended at all', () => {
  let body = emptyBody(NOW);
  body = fileAnswer(body, {
    round: 1, parameter_id: 'identity.name', value: 'ResumeGuru', by: 'client-1',
    source: 'round-1', now: NOW,
  });
  throws(
    () => putEntry(body, 'context/intake/answers', {
      id: 'a1-identity.name-client-1', type: 'answer', data: { answer: 'changed' },
    }, { writer: 'client', now: NOW }),
    'append-only',
    'a second write on the same answer id is refused',
  );
  throws(
    () => amendEntry(body, 'context/intake/answers', 'a1-identity.name-client-1', {
      at: NOW, by: 'owner', note: 'heard it wrong', changed: { answer: 'fixed' },
    }),
    'accepts no amendments',
    'and amendEntry, the escape hatch for append-only records, is shut here (§11.2)',
  );
  const corrected = fileAnswer(body, {
    round: 2, parameter_id: 'identity.name', value: 'Resume Guru', by: 'client-1',
    source: 'round-2', now: NOW,
  });
  eq(readAnswers(corrected).length, 2, 'a correction is a new answer in a new round, and both survive');
});

suite('spec 22 §14.7 — no curated value without its source');

test('7. lineage is required, and it resolves to a real answer', () => {
  let body = emptyBody(NOW);
  body = fileAnswer(body, {
    round: 1, parameter_id: 'identity.one-line', value: 'I help students land their first job',
    by: 'client-1', source: 'round-1', now: NOW,
  });
  const answerId = readAnswers(body)[0].id;

  throws(() => curateParameter(body, {
    parameter_id: 'identity.one-line', value: 'Careers, without the guesswork',
    source_refs: [], curator: 'owner', confidence: 'confirmed', now: NOW,
  }), 'no curated value without its source', 'an empty source list is refused');

  throws(() => curateParameter(body, {
    parameter_id: 'identity.one-line', value: 'x', source_refs: [answerId],
    curator: '', confidence: 'confirmed', now: NOW,
  }), 'without a curator', 'so is a value with no curator');

  const curated = curateParameter(body, {
    parameter_id: 'identity.one-line', value: 'Careers, without the guesswork',
    source_refs: [answerId], curator: 'owner', confidence: 'confirmed', now: NOW,
  });
  const value = readCurated(curated, 'identity.one-line')!;
  eq(value.provenance.source_refs, [answerId], 'the trail runs back to the sentence they actually said');
  ok(readAnswers(curated).some(a => a.id === answerId), 'and that answer is still there, verbatim');

  // §7.4 — on one of HER profiles the route in is shorter, nothing else bends.
  const direct = curateParameter(emptyBody(NOW), {
    parameter_id: 'identity.one-line', value: 'Careers, without the guesswork',
    source_refs: ['owner-direct:she wrote this herself'], curator: 'owner',
    confidence: 'confirmed', now: NOW,
  });
  ok(readCurated(direct, 'identity.one-line'), 'owner-direct curation is allowed and still carries its provenance');
});

test('8. re-curating supersedes: the old reading stays legible', () => {
  let body = emptyBody(NOW);
  body = curateParameter(body, {
    parameter_id: 'voice.pace', value: 'short and sharp', source_refs: ['a1-voice.pace-client-1'],
    curator: 'owner', confidence: 'confirmed', now: NOW,
  });
  const later = '2026-09-01T09:00:00.000Z';
  body = curateParameter(body, {
    parameter_id: 'voice.pace', value: 'explains fully', source_refs: ['a2-voice.pace-client-1'],
    curator: 'owner', confidence: 'confirmed', now: later,
  });

  const entries = readPath(body, 'context/personal-details/voice-of-the-person');
  const old = entries.find(e => e.id === 'voice.pace')!;
  const current = entries.find(e => e.id !== 'voice.pace')!;
  eq(old.state, 'history', 'the old entry stays, at history');
  eq(current.provenance?.supersedes, 'voice.pace', 'and the new one records what it supersedes');
  eq(readCurated(body, 'voice.pace')!.value, 'explains fully', 'the current reading is the new one');
  eq(curationHistory(body, 'voice.pace').length, 2, 'both are readable, neither is deleted');
});

suite('spec 22 §14.9 — the status flow');

test('9. not sent, sent, answered, curated', () => {
  const round: RoundView = {
    version: 1, parameters: ['identity.name', 'identity.one-line'], sent: false, curation: {},
  };
  const answers: AnswerRecord[] = [];
  eq(computeStatus(round, answers), 'not-sent', 'she has not sent it');

  const sent = { ...round, sent: true };
  eq(computeStatus(sent, answers), 'sent', 'nothing answered yet');

  answers.push({
    id: 'a1', parameter_id: 'identity.name', round_version: 1, kind: 'answer',
    value: 'ResumeGuru', by: 'client-1', at: NOW, source: 'round-1',
  });
  eq(computeStatus(sent, answers), 'sent', 'one parameter still has neither an answer nor a skip');

  answers.push({
    id: 'a2', parameter_id: 'identity.one-line', round_version: 1, kind: 'skipped',
    value: '', by: 'client-1', at: NOW, source: 'round-1',
  });
  eq(computeStatus(sent, answers), 'answered', 'an explicit skip counts: "they refused to say" is knowledge');

  const curated = {
    ...sent,
    curation: {
      'identity.name': { curated: true, at: NOW, by: 'owner' },
      'identity.one-line': { curated: true, at: NOW, by: 'owner' },
    },
  };
  eq(computeStatus(curated, answers), 'curated', 'every parameter has a curation decision');
});

suite('spec 22 §14.11 and §14.12 — the four doors, and setup access');

/** The fixture with Career Bubble at `setup` and a body holding one of each. */
function setupProfile(): AppState {
  const state = fixtureState();
  state.clients = state.clients.map(c => c.id === 'career-bubble' ? { ...c, lifecycle: 'setup' as const } : c);
  const cb = state.clients.find(c => c.id === 'career-bubble')!;
  let body = migrateProfile(cb, state.clientData['career-bubble'], { now: NOW }).body;
  body = fileAnswer(body, {
    round: 1, parameter_id: 'identity.name', value: 'Career Bubble', by: 'merushri',
    source: 'round-1', now: NOW, writer: 'client',
  });
  body = putEntry(body, 'work-log/assets/sets', {
    id: 'set-cb', type: 'asset_set', data: { name: 'Shoot 1' },
  }, { writer: 'owner', now: NOW });
  body = putEntry(body, 'context/content-strategy/positioning', {
    id: 'decision', type: 'strategy_parameter',
    data: { key: 'positioning', value: 'The friendly careers desk', reason: 'their words', sources: [], strategy_version: null },
  }, { writer: 'owner', now: NOW });
  state.clientData['career-bubble'].body = body;
  return state;
}

test('11. a client writes through give:intake and nowhere else', () => {
  const current = setupProfile();
  const forged = structuredClone(filterStateForRole(current, 'merushri'));
  const body = forged.clientData['career-bubble'].body!;
  body.paths['context/intake'] = [{
    id: 'round-1', path: 'context/intake', type: 'intake_round', state: 'active',
    data: { version: 1, status: 'curated' }, created_at: NOW, updated_at: NOW,
  }];
  body.paths['context/personal-details/identity'] = [{
    id: 'identity.name', path: 'context/personal-details/identity', type: 'curated_parameter',
    state: 'active', data: { value: 'injected' }, created_at: NOW, updated_at: NOW,
  }];
  body.paths['context/content-strategy/positioning'] = [];
  body.paths['context/intake/answers'] = [
    ...(body.paths['context/intake/answers'] ?? []),
    {
      id: 'a1-identity.one-line-merushri', path: 'context/intake/answers', type: 'answer',
      state: 'active', data: { round: 1, parameter_id: 'identity.one-line', answer: 'we help people switch careers', by: 'merushri' },
      created_at: NOW, updated_at: NOW,
    },
  ];

  const merged = mergeRoleWrite(current, forged, 'merushri');
  const after = merged.clientData['career-bubble'].body!;
  ok(!after.paths['context/intake']?.some(e => (e.data as { status?: string }).status === 'curated'),
    'the round object is hers: status is computed, never client-written (§5.2)');
  ok(!after.paths['context/personal-details/identity']?.some(e => e.id === 'identity.name'),
    'a client never writes a detail folder — she writes parameters, they write answers');
  eq(after.paths['context/content-strategy/positioning'].length, 1,
    'and strategy cannot be emptied through a window');
  eq(after.paths['context/intake/answers'].length, 2, 'the answer through give-point 1 lands, which is the point of it');

  ok(clientMayWrite('context/intake/answers'), 'answers are a door');
  ok(!clientMayWrite('context/intake'), 'the round record is not');
  ok(!clientMayWrite('context/personal-details/identity'), 'nor is any detail folder');
  ok(!clientMayWrite('context/content-strategy/positioning'), 'nor any strategy folder');
});

test('12. a profile at setup opens the same doors as active, and lifecycle still closes the rest', () => {
  // REWRITTEN 2026-08-11. Spec 22 acceptance test 12 pinned setup to
  // give:intake alone, and her order removed that rule: "get rid of this rule
  // that they can't use or see anything without a set strategy for clients."
  // Her switches are now the one authority on what a client sees; what this
  // pins instead is the half of lifecycle that SURVIVES, because paused,
  // closing and archived closing every door is what makes pausing real.
  eq(doorsOpenAt('setup'), doorsOpenAt('active'), 'setup no longer narrows the doors');
  eq(doorsOpenAt('paused'), [], 'paused still closes everything');
  eq(doorsOpenAt('closing'), [], 'and so does closing');
  eq(doorsOpenAt('archived'), [], 'and archived');
});

suite('spec 22 §14.17 — retirement and reopen');

test('17. every round curated retires intake; reopening returns it, and loses nothing', () => {
  let body = emptyBody(NOW);
  const first = openRound(body, {
    parameters: ['identity.name', 'identity.one-line'], delivery: 'finding-session',
    config: CONFIG, now: NOW,
  });
  body = first.body;
  body = putEntry(body, 'context/intake', {
    id: first.round.id, type: 'intake_round',
    data: { ...first.round, status: 'sent' } as unknown as Record<string, unknown>,
  }, { writer: 'owner', now: NOW });
  for (const p of first.round.parameters) {
    body = fileAnswer(body, { round: 1, parameter_id: p, value: `answer for ${p}`, by: 'client-1', source: 'round-1', now: NOW });
    body = markCurated(body, p, NOW);
  }
  ok(intakeRetired(readRounds(body).filter(r => r.version === 1)), 'with every round curated, intake retires');

  const later = '2026-09-01T09:00:00.000Z';
  const reopened = reopenRound(body, ['identity.name', 'voice.pace'], 'dashboard-questionnaire', CONFIG, later);
  body = reopened.body;
  eq(reopened.round.version, 2, 'a new round at version last + 1');
  eq(readQuestions(body, 2).length, 2, 'holding exactly the two parameters she picked');
  const rounds = readRounds(body);
  eq(rounds.length, 2, 'the old round is still there');
  const oldEntry = readPath(body, 'context/intake').find(e => e.id === 'round-1')!;
  eq(oldEntry.state, 'history', 'at history, readable forever, accepting no writes (S9)');
  eq(readAnswers(body).length, 2, 'and its answers are untouched');
  ok(!intakeRetired(readRounds(body)), 'reopening returns the app to active');
});

suite('spec 22 §14.18 — the migration is honest');

test('18. every legacy answer is preserved, proposed or named — and nothing is auto-curated', () => {
  const state = fixtureState();
  const rg = state.clients.find(c => c.id === 'resumeguru')!;
  const migrated = migrateProfile(rg, state.clientData['resumeguru'], { now: NOW });
  const legacy = state.clientData['resumeguru'].onboarding;

  const answers = readAnswers(migrated.body).filter(a => a.round_version === 0);
  eq(answers.length, legacy.length, 'round 0 holds every legacy answer');
  for (const item of legacy) {
    ok(answers.some(a => a.value === item.answer), `"${item.answer}" survived verbatim`);
  }

  const mapped = mapRoundZero(migrated.body, NOW);
  eq(mapped.proposals.length, answers.length, 'every answer got a reading');
  for (const p of mapped.proposals) {
    ok(p.parameter_id !== null || mapped.unmapped.includes(p.question) || mapped.unmapped.includes(p.answer_id),
      'each one is either proposed to a parameter or listed by name, never dropped');
  }
  ok(mapped.proposals.some(p => p.parameter_id === 'audience.best-customer'),
    '"Who is this for?" reads as the best-customer parameter');

  for (const p of PARAMETERS) {
    eq(readCurated(mapped.body, p.id), null, `${p.id} was NOT auto-curated — the pass only proposes`);
  }
  ok(mapped.body.sort_queue.length >= answers.length, 'and every proposal is in her queue');

  const again = mapRoundZero(mapped.body, NOW);
  eq(again.body.sort_queue.length, mapped.body.sort_queue.length, 'running it twice does not double her queue');
});

suite('spec 22 §14.19 — the save race at this spec’s seam');

test('19. a client answering and her curating at the same moment both survive', () => {
  const stored = fixtureState();
  let body = emptyBody(NOW);
  body = fileAnswer(body, {
    round: 1, parameter_id: 'identity.one-line', value: 'we make resumes readable',
    by: 'client-1', source: 'round-1', now: NOW,
  });
  stored.clientData['career-bubble'].body = body;

  const client = structuredClone(stored);
  client.clientData['career-bubble'].body = fileAnswer(client.clientData['career-bubble'].body!, {
    round: 1, parameter_id: 'identity.name', value: 'Career Bubble', by: 'client-1',
    source: 'round-1', now: '2026-07-27T09:05:00.000Z', writer: 'client',
  });

  const her = structuredClone(stored);
  her.clientData['career-bubble'].body = curateParameter(her.clientData['career-bubble'].body!, {
    parameter_id: 'identity.one-line', value: 'Resumes people can read',
    source_refs: ['a1-identity.one-line-client-1'], curator: 'owner', confidence: 'confirmed',
    now: '2026-07-27T09:05:30.000Z',
  });

  const clientScopes = changedScopes(stored, client);
  const herScopes = changedScopes(stored, her);
  ok(clientScopes.includes(scopeKey('career-bubble', 'context/intake/answers')), 'the answer declares its own path');
  ok(herScopes.includes(scopeKey('career-bubble', 'context/personal-details/identity')),
    'her curation declares another');

  const merged = applyScopes(applyScopes(stored, client, clientScopes), her, herScopes);
  const after = merged.clientData['career-bubble'].body!;
  eq(after.paths['context/intake/answers'].length, 2, 'both answers survive');
  ok(after.paths['context/personal-details/identity']?.length, 'and so does the curated value');
});

suite('spec 22 §4.7 — the vocabulary lists');

test('every list a parameter points at exists, and the one that is hers is marked', () => {
  for (const p of PARAMETERS) {
    if (!p.options) continue;
    ok(findVocabularyList(p.options), `${p.id} points at an unknown list "${p.options}"`);
  }
  const revenue = findVocabularyList('revenue-band')!;
  eq(revenue.drafted, false, 'the revenue band words are hers, and nothing was drafted for her');
  const q = generateRound({ config: CONFIG, version: 1 }).questions
    .find(x => x.parameter_id === 'voice.natural-tone')!;
  ok(q.options.length >= 10, 'the lists ship FULL, breadth over shortlisting (PLAN §5.1 item 1)');
  eq(q.free_text_lane, 'Something else', 'and a list that cannot be escaped produces false answers');
});

test('every parameter carries a question, a shape and a declared home', () => {
  for (const p of PARAMETERS) {
    ok(p.question.trim().length > 0, `${p.id} has no question`);
    ok(p.label.trim().length > 0, `${p.id} has no label`);
    eq(p.vocabulary, 'draft', `${p.id} claims her vocabulary pass already happened`);
    ok(findDeclaration(p.path), `${p.id} lives at an undeclared path`);
  }
});
