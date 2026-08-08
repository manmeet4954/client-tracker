// Spec 34 §3 and §9 — the input each parameter takes, and what it refuses.
//
// The two things these tests exist to hold:
//   1. A decision made with a chip is the SAME record a typed one made. That
//      means every pick still produces a non-blank reason, because the lock
//      counts a blank reason as a failure.
//   2. No parameter is left without an input, and no input exists for something
//      the lock does not count.

import { suite, test, ok, eq } from './harness.ts';
import {
  STRATEGY_INPUTS, inputFor, inputCoverage, decodeValue, emptyValue, summarize,
  problems, isComplete, autoReason, reasonFor, canSave, rowStatus, decidedLine,
  pillarShareTotal, goalsWithoutMeasure, formatsFor, canonicalPlatform,
  PLATFORM_LIBRARY, PILLARS_MIN, PILLARS_MAX, MEASUREMENT_LINE,
  type CadenceValue, type GoalItem, type Pillar, type PlatformPick, type VoiceValue,
  type BoundariesValue, type WorkingModeValue, type ObligationsValue, type ProofItem,
  type AudienceValue,
} from '../lib/strategy/inputs.ts';
import { LOCKABLE_STRATEGY_PATHS, lockViolations, writeStrategy } from '../lib/strategy/derivation.ts';
import { emptyBody } from '../lib/tree/body.ts';

const CS = 'context/content-strategy';
const NOW = '2026-08-08T09:00:00.000Z';

suite('spec 34 — decide: an input per parameter');

test('every lockable parameter has an input, and nothing extra does', () => {
  eq(inputCoverage(), [], 'the input map and the lock count the same fourteen');
  eq(STRATEGY_INPUTS.length, LOCKABLE_STRATEGY_PATHS.length, 'fourteen inputs for fourteen parameters');
});

test('the free text box survives only where the answer is genuinely prose', () => {
  const prose = STRATEGY_INPUTS.filter(s => s.kind === 'prose' || s.kind === 'audience').map(s => s.label);
  eq(prose, ['Positioning', 'Audience', 'Funnel shape'], 'three prose parameters, no more');
});

test('the required reason line dies on every pick', () => {
  const asking = STRATEGY_INPUTS.filter(s => s.reasonRequired).map(s => s.label);
  eq(asking, ['Positioning', 'Audience', 'Funnel shape', 'Working mode'],
    'only the four arguable ones still ask her why');
});

test('platforms is a pick with formats, and never a text box', () => {
  const spec = inputFor(`${CS}/platforms`)!;
  eq(spec.kind, 'platforms', 'platforms is a list pick');
  ok(PLATFORM_LIBRARY.length >= 3, 'there is a list to pick from');
  eq(formatsFor('instagram').includes('Reel'), true, 'a picked platform opens its formats');
  eq(canonicalPlatform('  linkedin '), 'LinkedIn', 'a typed name matches the library spelling');
});

test('visual branding is not a text box, and cannot be saved from Decide', () => {
  const spec = inputFor(`${CS}/visual-branding`)!;
  eq(spec.kind, 'brand-kit', 'the row opens Brand kit');
  eq(canSave(spec, '', ''), false, 'nothing is written here');
});

suite('spec 34 — decide: what each input refuses');

test('pillars: three to five, each with a job, shares that add up', () => {
  const two: Pillar[] = [
    { name: 'teaching', job: 'trust', share: 50 },
    { name: 'proof', job: 'convert', share: 50 },
  ];
  ok(problems('pillars', two).some(p => p.includes('threes to fives')), 'two is too few');

  const noJob: Pillar[] = [
    { name: 'teaching', job: null, share: 40 },
    { name: 'proof', job: 'convert', share: 30 },
    { name: 'story', job: 'reach', share: 30 },
  ];
  ok(problems('pillars', noJob).some(p => p === 'teaching has no job yet.'), 'a pillar needs its job');

  const off: Pillar[] = [
    { name: 'teaching', job: 'trust', share: 40 },
    { name: 'proof', job: 'convert', share: 30 },
    { name: 'story', job: 'reach', share: 20 },
  ];
  eq(pillarShareTotal(off), 90, 'the total is counted from the array');
  ok(problems('pillars', off).some(p => p === 'The shares add up to 90, not 100.'),
    'it says so when they do not add up');

  const good: Pillar[] = [
    { name: 'teaching', job: 'trust', share: 40 },
    { name: 'proof', job: 'convert', share: 30 },
    { name: 'story', job: 'reach', share: 30 },
  ];
  eq(problems('pillars', good), [], 'three, jobbed, adding to 100, is clean');
  eq(PILLARS_MIN, 3, 'three is the floor');
  eq(PILLARS_MAX, 5, 'five is the ceiling');
});

test('goals: the measurement is not optional, and the screen says why', () => {
  const goals: GoalItem[] = [
    { goal: 'get more leads', number: 20, period: 'a month', measured: 'DMs started' },
    { goal: 'get known', number: 5000, period: 'in six months', measured: '' },
  ];
  eq(goalsWithoutMeasure(goals), ['get known'], 'the unmeasured goal is named');
  ok(problems('goals', goals).some(p => p.includes('Analysis stays off for it')),
    'the S16 block is said on the screen, not in a spec');
  ok(MEASUREMENT_LINE.includes('Analysis'), 'and the standing line says it too');
});

test('cadence is a number, per week or per month', () => {
  const blank: CadenceValue = { count: null, per: 'week' };
  eq(isComplete('cadence', blank), false, 'no number, nothing saved');
  const three: CadenceValue = { count: 3, per: 'week' };
  eq(summarize('cadence', three), '3 pieces a week', 'the row shows the decision');
  eq(summarize('cadence', { count: 1, per: 'month' }), '1 piece a month', 'one is singular');
});

test('working mode is two picks, and both are needed', () => {
  const half: WorkingModeValue = { ideas: 'they-bring', posting: null };
  ok(problems('working-mode', half).some(p => p === 'Say who presses post.'), 'both picks are needed');
  const both: WorkingModeValue = { ideas: 'she-leads', posting: 'we-post' };
  eq(summarize('working-mode', both), 'You lead it. We post', 'the row shows both');
});

test('platforms, voice, ctas, boundaries, obligations and proof all refuse an empty set', () => {
  eq(isComplete('platforms', []), false, 'no platform is not a decision');
  eq(isComplete('voice', { sounds_like: [], never_says: ['guru'] } as VoiceValue), false,
    'a never-says list alone is not a voice');
  eq(isComplete('chips', []), false, 'no CTA is not a decision');
  eq(isComplete('boundaries', { never_claim: [], never_promise: [], not_for: [] } as BoundariesValue), false,
    'no boundary is not a decision');
  eq(isComplete('obligations', { theirs: [], ours: [] } as ObligationsValue), false,
    'no obligation is not a decision');
  eq(isComplete('proof', [] as ProofItem[]), false, 'no proof is not a decision');
});

suite('spec 34 — decide: the record does not change');

test('a pick writes its own reason line, so a chip decision locks like a typed one', () => {
  for (const spec of STRATEGY_INPUTS) {
    if (spec.reasonRequired || spec.kind === 'brand-kit') continue;
    const value = sampleFor(spec.kind);
    const reason = reasonFor(spec, value, '');
    ok(reason.trim().length > 0, `${spec.label} produced a blank reason with nothing typed`);
  }
});

test('an arguable parameter still takes her own reason and nothing else', () => {
  const spec = inputFor(`${CS}/positioning`)!;
  eq(reasonFor(spec, 'The plain one in a loud room.', ''), '', 'nothing is written for her');
  eq(canSave(spec, 'The plain one in a loud room.', ''), false, 'and it will not save without it');
  eq(canSave(spec, 'The plain one in a loud room.', 'It is the only gap in the market.'), true,
    'with her line, it saves');
});

test('a strategy decided through the new inputs passes the lock the same way', () => {
  let body = emptyBody();
  for (const path of LOCKABLE_STRATEGY_PATHS) {
    const spec = inputFor(path)!;
    const value = spec.kind === 'brand-kit' ? 'set in Brand kit' : sampleFor(spec.kind);
    const reason = spec.reasonRequired ? 'Because that is what the evidence says.' : reasonFor(spec, value, '');
    body = writeStrategy(body, path, {
      key: path.split('/').pop()!,
      value: value as unknown,
      reason,
      owner_declared: true,
      sources: [],
      strategy_version: null,
    }, NOW);
  }
  const failures = lockViolations({
    body, lifecycle: 'setup', owner_kind: 'client', platforms: ['Instagram'], now: NOW,
  });
  const strategyFailures = failures.filter(f => f.fix === 'derivation');
  eq(strategyFailures, [], 'no strategy parameter is missing a value or a reason');
});

suite('spec 34 — decide: reading what is already there');

test('a typed answer from the old form is read back into the new input', () => {
  const platforms = decodeValue('platforms', 'Instagram, linkedin') as PlatformPick[];
  eq(platforms.map(p => p.platform), ['Instagram', 'LinkedIn'], 'a typed list becomes picks');
  const voice = decodeValue('voice', 'plain, warm, direct') as VoiceValue;
  eq(voice.sounds_like, ['plain', 'warm', 'direct'], 'a typed voice becomes chips');
  const cadence = decodeValue('cadence', '4 a month') as CadenceValue;
  eq(cadence, { count: 4, per: 'month' }, 'a typed cadence becomes a number and a period');
  const pillars = decodeValue('pillars', 'teaching\nproof\nstory') as Pillar[];
  eq(pillars.map(p => p.name), ['teaching', 'proof', 'story'], 'typed pillars keep their names');
  eq(pillars.every(p => p.job === null && p.share === null), true, 'and admit what is still missing');
});

test('a structured answer round trips', () => {
  const value: GoalItem[] = [{ goal: 'sell the offer', number: 4, period: 'a month', measured: 'sales' }];
  eq(decodeValue('goals', value), value, 'goals come back as they went in');
  const proof: ProofItem[] = [{ line: 'Took her from 900 to 12k', link: 'https://example.com' }];
  eq(decodeValue('proof', proof), proof, 'proof items come back as they went in');
});

test('an empty value is the shape the input works in', () => {
  eq(emptyValue('boundaries'), { never_claim: [], never_promise: [], not_for: [] }, 'three groups');
  eq(emptyValue('working-mode'), { ideas: null, posting: null }, 'two picks, neither made');
});

suite('spec 34 — decide: the row label');

test('the row says decided or not yet, and shows the decision', () => {
  const spec = inputFor(`${CS}/platforms`)!;
  eq(rowStatus(spec, null), { decided: false, state: 'not yet', detail: '' }, 'undecided says not yet');

  const decided = rowStatus(spec, { value: [{ platform: 'Instagram', formats: ['Reel'] }] });
  eq(decided.state, 'decided', 'decided says decided');
  eq(decided.detail, 'Instagram', 'and shows the decision itself');

  const na = rowStatus(spec, { value: null, not_applicable: true });
  eq(na.state, 'not used here', 'an explicit not applicable says so');
});

test('no row label counts sources, and the header counts decisions from the array', () => {
  const spec = inputFor(`${CS}/cadence`)!;
  const line = rowStatus(spec, { value: { count: 3, per: 'week' } }).detail;
  ok(!/source/i.test(line), 'the word source never appears on a row');
  eq(decidedLine(0, 14), 'Nothing decided yet. 14 to go.', 'nothing decided reads plainly');
  eq(decidedLine(9, 14), '9 of 14 decided.', 'part way reads plainly');
  eq(decidedLine(14, 14), 'All 14 decided.', 'and done reads plainly');
});

// ── A filled-in answer for every kind ────────────────────────────────────────

function sampleFor(kind: string): never | ReturnType<typeof emptyValue> {
  switch (kind) {
    case 'platforms':
      return [{ platform: 'Instagram', formats: ['Reel', 'Carousel'] }] as PlatformPick[];
    case 'pillars':
      return [
        { name: 'teaching', job: 'trust', share: 40 },
        { name: 'proof', job: 'convert', share: 30 },
        { name: 'story', job: 'reach', share: 30 },
      ] as Pillar[];
    case 'voice':
      return { sounds_like: ['plain', 'warm'], never_says: ['guru'] } as VoiceValue;
    case 'goals':
      return [{ goal: 'get more leads', number: 20, period: 'a month', measured: 'DMs started' }] as GoalItem[];
    case 'chips':
      return ['DM the word', 'link in bio'];
    case 'boundaries':
      return { never_claim: ['guaranteed results'], never_promise: ['a number'], not_for: ['students'] } as BoundariesValue;
    case 'cadence':
      return { count: 3, per: 'week' } as CadenceValue;
    case 'obligations':
      return { theirs: ['photos each month'], ours: ['the calendar by the 25th'] } as ObligationsValue;
    case 'proof':
      return [{ line: 'Took her from 900 to 12k', link: '' }] as ProofItem[];
    case 'working-mode':
      return { ideas: 'she-leads', posting: 'we-post' } as WorkingModeValue;
    case 'audience':
      return { who: 'Designers two years in', stages: ['following'] } as AudienceValue;
    default:
      return 'A plain line.';
  }
}
