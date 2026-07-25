// Spec 21 §10 — acceptance tests 2, 3, 4 and 5, plus the registry integrity and
// the §8.11 orphan check they stand on.

import { suite, test, ok, eq, throws } from './harness.ts';
import { assertDeclared, findDeclaration, isDeclared, readersOf, writersOf, DECLARATIONS } from '../lib/tree/declarations.ts';
import { FEATURES } from '../lib/tree/features.ts';
import { SWITCHES, effectiveState, pathState, platformCascade, platformSwitchId, validateSwitchConfig } from '../lib/tree/switches.ts';
import { validateRegistries, featureViolations, declarationViolations, clientMayWrite, clientWritablePaths } from '../lib/tree/validate.ts';
import { emptyBody, putEntry, readPath, setPathState } from '../lib/tree/body.ts';
import { visibleChannels, visibleFormats, visibleAnalysisColumns, visibleStrategyQuestions } from '../lib/tree/cascade.ts';
import type { SwitchConfig } from '../lib/tree/contract.ts';
import type { Channel } from '../lib/tree/objects.ts';

suite('spec 21 §4 — the declaration contract');

test('the registries validate clean (no address, no switch, no fifth door, no orphan)', () => {
  const v = validateRegistries();
  eq(v.map(x => `${x.check} ${x.where}: ${x.reason}`), [], 'the build refuses to proceed on any violation');
});

test('every declared path carries both connection lines and a switch (law 3)', () => {
  for (const d of DECLARATIONS) {
    ok(d.switch, `${d.path} declares no switch`);
    ok(Array.isArray(d.fed_by), `${d.path} declares no writers`);
    ok(Array.isArray(d.read_by), `${d.path} declares no readers`);
    // Only dispositions may be dead ends.
    if (d.zone === 'tree') {
      ok(d.fed_by.length > 0, `${d.path} is inside the spine but nothing feeds it`);
      ok(d.read_by.length > 0, `${d.path} is inside the spine but nothing reads it`);
    }
  }
});

test('the spine is frozen: context/ and work-log/ are the only tree roots (law 1)', () => {
  const roots = new Set(DECLARATIONS.filter(d => d.zone === 'tree').map(d => d.path.split('/')[0]));
  eq([...roots].sort(), ['context', 'work-log'], 'nothing new grows at the top');
});

suite('spec 21 §10.4 — the no-address test (law 4)');

test('a read or write against an undeclared path throws', () => {
  throws(() => assertDeclared('work-log/creation/inbox', 'write'), 'no address',
    'an invented path must be refused, not silently created');
  throws(() => readPath(emptyBody(), 'context/vibes'), 'no address',
    'reads are refused the same way');
});

test('a feature writing an undeclared path fails validation', () => {
  const v = featureViolations({
    id: 'test.invented', today: 'nowhere', writes: 'work-log/creation/secret-lane',
    reads: [], switch: 'creation.board', state: 'active',
  });
  ok(v.some(x => x.check === 'no-address'), 'the validator must bite on an undeclared write path');
});

test('law 2 nesting resolves: an entry inside a variable folder inherits its declaration', () => {
  ok(isDeclared('context/content-strategy/platforms/instagram/formats'),
    'a platform’s formats folder resolves through the wildcard');
  ok(isDeclared('context/content-strategy/pillars/trust/job'), 'so does a pillar’s job');
  eq(findDeclaration('context/content-strategy/platforms/youtube/formats')?.entry_type, 'format',
    'and it knows what lives inside');
});

suite('spec 21 §10.5 — the no-switch test (PLAN §6 rule 3)');

test('a feature with no registered switch fails validation', () => {
  const v = featureViolations({
    id: 'test.switchless', today: 'nowhere', writes: 'work-log/creation',
    reads: [], switch: 'creation.vibes', state: 'active',
  });
  ok(v.some(x => x.check === 'no-switch'), 'a feature that names no real switch is rejected');
});

test('every feature alive today names a switch that exists', () => {
  for (const f of FEATURES) {
    ok(f.switch, `${f.id} registers no switch`);
    eq(featureViolations(f).filter(v => v.check === 'no-switch'), [], `${f.id} names an unknown switch`);
  }
});

test('nothing structural escapes the registry (§5.4)', () => {
  const fixed = SWITCHES.filter(s => s.fixed);
  ok(fixed.length >= 5, 'the fixed switches are still listed, not exempted');
  for (const s of fixed) {
    ok(s.allowed_states.length === 1, `${s.id} is fixed but offers more than one state`);
  }
});

suite('spec 21 §10.6 — the no-fifth-door test (S19)');

test('every client-facing path names one of the four give-points or a see-point', () => {
  const v = DECLARATIONS.flatMap(declarationViolations).filter(x => x.check === 'no-fifth-door');
  eq(v, [], 'a client audience with no door is a fifth workflow');
});

test('the client may write only through the four give-points', () => {
  const doors = new Set(clientWritablePaths().map(p => p.door));
  eq([...doors].sort(), ['give:assets', 'give:intake', 'give:perception', 'give:review'],
    'exactly four doors, no more');
  ok(!clientMayWrite('work-log/logs/observations'), 'her private notes are not a client door');
  ok(!clientMayWrite('context/content-strategy/pillars'), 'strategy is hers');
  ok(!clientMayWrite('work-log/creation'), 'a client never writes a piece directly');
  ok(clientMayWrite('work-log/assets/sets'), 'assets is give-point 2');
});

test('a see-point can never be written through', () => {
  const seeOnly = DECLARATIONS.filter(d => d.client_door?.startsWith('see:'));
  ok(seeOnly.length > 0, 'there are see-points to check');
  for (const d of seeOnly) ok(!clientMayWrite(d.path), `${d.path} is a window, not a door`);
});

suite('spec 21 §10.2 — the growth test (law 3)');

test('a fourth pillar is wired the moment it exists — nothing goes blank', () => {
  const path = 'context/content-strategy/pillars/proof';
  ok(isDeclared(path), 'a new pillar resolves without a code change');
  const readers = readersOf(path);
  for (const r of ['work-log/creation', 'work-log/analysis', 'work-log/creation/topics']) {
    ok(readers.includes(r), `the new pillar is already read by ${r}`);
  }
  let body = emptyBody();
  body = putEntry(body, path, { id: 'proof', type: 'pillar', data: { name: 'Proof', job: 'trust', targetPct: 20 } }, { writer: 'owner' });
  eq(readPath(body, path).length, 1, 'and it stores at its own address');
});

test('a new platform rides in with its formats (a format never exists apart from its platform)', () => {
  const formats = 'context/content-strategy/platforms/youtube/formats';
  ok(isDeclared(formats), 'YouTube’s formats folder exists the moment YouTube does');
  const readers = readersOf(formats);
  for (const r of ['work-log/creation/topics', 'work-log/creation', 'work-log/analysis']) {
    ok(readers.includes(r), `the seed picker / scheduling / analysis already read ${r}`);
  }
  ok(writersOf(formats).includes('owner'), 'and she is its declared writer');

  const config: SwitchConfig = {
    'strategy.fixed': { state: 'active', set_at: 'test' },
    [platformSwitchId('YouTube')]: { state: 'active', set_at: 'test' },
  };
  eq(pathState(formats, config), 'active', 'a platform she switched on renders its formats immediately');
  const picker = visibleFormats({ YouTube: ['Long video', 'Short'] }, config);
  eq(picker.length, 2, 'both of its formats reach the seed picker with no code change');
});

suite('spec 21 §10.3 — the cascade test (PLAN §3.4)');

const instagramOnly: SwitchConfig = {
  'strategy.fixed': { state: 'active', set_at: 'test' },
  'creation.board': { state: 'active', set_at: 'test' },
  'creation.channels': { state: 'active', set_at: 'test' },
  'analysis.tracking': { state: 'active', set_at: 'test' },
  [platformSwitchId('Instagram')]: { state: 'active', set_at: 'test' },
  [platformSwitchId('LinkedIn')]: { state: 'hidden', set_at: 'test' },
};

const channels: Channel[] = [
  { id: 'ch-ig', platform: 'Instagram', account_handle: 'resumeguru.ai', ownership: 'krnl', connection: 'connected', timezone: 'Asia/Kolkata', posting_permission: 'we-post' },
  { id: 'ch-li', platform: 'LinkedIn', account_handle: 'manmeet', ownership: 'client', connection: 'never-connected', timezone: null, posting_permission: 'unknown' },
];

test('LinkedIn off removes its formats, its strategy questions, its channel and its analysis column', () => {
  const trace = platformCascade('LinkedIn');
  eq(pathState(trace.formats, instagramOnly), 'hidden', 'LinkedIn formats never reach the seed picker');
  for (const q of trace.strategyQuestions) {
    eq(pathState(q, instagramOnly), 'hidden', `LinkedIn strategy is never asked for (${q})`);
  }
  eq(visibleChannels(channels, instagramOnly).map(c => c.id), ['ch-ig'], 'no LinkedIn channel');
  eq(visibleAnalysisColumns(['Instagram', 'LinkedIn'], instagramOnly), ['Instagram'], 'no LinkedIn column');
  eq(visibleStrategyQuestions(['Instagram', 'LinkedIn'], instagramOnly).filter(p => p.includes('linkedin')), [],
    'nothing dormant asks to be filled in');
});

test('the trace runs identically in reverse (LinkedIn-only)', () => {
  const linkedinOnly: SwitchConfig = {
    ...instagramOnly,
    [platformSwitchId('Instagram')]: { state: 'hidden', set_at: 'test' },
    [platformSwitchId('LinkedIn')]: { state: 'active', set_at: 'test' },
  };
  eq(pathState('context/content-strategy/platforms/instagram/formats', linkedinOnly), 'hidden',
    'Instagram vanishes the same way');
  eq(visibleChannels(channels, linkedinOnly).map(c => c.id), ['ch-li'], 'only the LinkedIn channel remains');
  eq(visibleAnalysisColumns(['Instagram', 'LinkedIn'], linkedinOnly), ['LinkedIn'], 'and only its column');
});

test('the cascade is the same for her and for the client', () => {
  // pathState takes no audience: activation travels the connections, not the role.
  const forEither = pathState('context/content-strategy/platforms/linkedin/formats', instagramOnly);
  eq(forEither, 'hidden', 'off is off on both sides (PLAN §3.4)');
});

test('history keeps every past piece and its metrics readable (S9)', () => {
  const withHistory: SwitchConfig = {
    ...instagramOnly,
    [platformSwitchId('LinkedIn')]: { state: 'history', set_at: 'test' },
  };
  const path = 'context/content-strategy/platforms/linkedin/rules';
  eq(pathState(path, withHistory), 'history', 'turning a platform off never deletes it');

  let body = emptyBody();
  body = putEntry(body, path, { id: 'r1', type: 'platform_parameter', data: { rule: 'no hashtag walls' } }, { writer: 'owner' });
  body = setPathState(body, path, 'history');
  eq(readPath(body, path).length, 1, 'the past record is still readable');
  throws(
    () => putEntry(body, path, { id: 'r1', type: 'platform_parameter', data: { rule: 'changed' } }, { writer: 'owner' }),
    'accepts no writes',
    'a path at history accepts no writes, from anyone, including the engines',
  );
});

test('effective state is the minimum of a switch and its prerequisites', () => {
  const config: SwitchConfig = {
    'creation.board': { state: 'hidden', set_at: 'test' },
    'creation.review': { state: 'active', set_at: 'test' },
    'strategy.fixed': { state: 'active', set_at: 'test' },
  };
  eq(effectiveState('creation.review', config), 'hidden',
    'review cannot outlive the board it depends on');
});

suite('spec 21 §5.3 — validation at strategy lock (S8)');

test('contradictions refuse activation', () => {
  const violations = validateSwitchConfig({
    owner_kind: 'client',
    config: {
      'creation.publishing': { state: 'active', set_at: 'test' },
      'creation.scheduling': { state: 'active', set_at: 'test' },
      'creation.channels': { state: 'active', set_at: 'test' },
      'logs.effort_meter': { state: 'active', set_at: 'test' },
      [platformSwitchId('LinkedIn')]: { state: 'hidden', set_at: 'test' },
    },
    channels: [{ id: 'ch-li', platform: 'LinkedIn', canPost: false }],
    postingOwnership: 'client-posts',
    goals: ['signups'],
    goalsWithMetricDeclaration: [],
  });
  const reasons = violations.map(v => `${v.switch}: ${v.reason}`);
  ok(reasons.some(r => r.startsWith('creation.publishing') && r.includes('client posts')),
    'publishing is refused where the client posts');
  ok(reasons.some(r => r.startsWith('creation.channels') && r.includes('LinkedIn')),
    'a channel cannot be active on a hidden platform');
  ok(reasons.some(r => r.startsWith('logs.effort_meter')),
    'the effort meter is refused on a client profile (PLAN §7)');
});

test('a clean configuration locks without complaint', () => {
  const violations = validateSwitchConfig({
    owner_kind: 'hers',
    config: {
      'strategy.fixed': { state: 'active', set_at: 'test' },
      'creation.board': { state: 'active', set_at: 'test' },
      'creation.scheduling': { state: 'active', set_at: 'test' },
      'creation.channels': { state: 'active', set_at: 'test' },
      'logs.effort_meter': { state: 'active', set_at: 'test' },
      [platformSwitchId('Instagram')]: { state: 'active', set_at: 'test' },
    },
    channels: [{ id: 'ch-ig', platform: 'Instagram', canPost: true }],
    postingOwnership: 'we-post',
    goals: [],
  });
  eq(violations, [], 'nothing contradicts');
});

test('a goal with no metric declaration blocks goal tracking (S16)', () => {
  const violations = validateSwitchConfig({
    owner_kind: 'hers',
    config: { 'analysis.goal_tracking': { state: 'active', set_at: 'test' } },
    goals: ['signups', 'link-taps'],
    goalsWithMetricDeclaration: ['signups'],
  });
  ok(violations.some(v => v.reason.includes('link-taps')), 'the undeclared goal is named');
});
