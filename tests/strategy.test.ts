// Spec 22 §14 — acceptance tests 10, 13, 14, 15, 16 and 20.
//
// The derivation map, the gate set, the switchboard, the one-act lock, and the
// wall that keeps creation shut until strategy locks.

import { suite, test, ok, eq } from './harness.ts';
import { fixtureState } from './fixtures.ts';
import { PARAMETERS, findParameter } from '../lib/intake/parameters.ts';
import {
  DERIVATION_MAP, LOCKABLE_STRATEGY_PATHS, derivationRow, derivationViolations,
  buildGateSet, gateSetViolations, lockStrategy, lockViolations, mayWriteStrategy,
  readGateSet, readStrategy, refusedCreationWrites, setSwitchPosition, sourcesFor,
  strategyLocked, switchConfigFromBody, switchesNeedingPosition, unsetSwitches,
  writeGateSet, writeStrategy, type GateDraft, type StrategyValue,
} from '../lib/strategy/derivation.ts';
import { curateParameter } from '../lib/intake/curate.ts';
import { emptyBody, putEntry, readPath } from '../lib/tree/body.ts';
import type { ProfileBody } from '../lib/tree/body.ts';
import type { PathState, SwitchConfig } from '../lib/tree/contract.ts';
import {
  SWITCHES, findSwitch, pathState, platformCascade, platformSwitchId, validateSwitchConfig,
} from '../lib/tree/switches.ts';
import { validateRegistries } from '../lib/tree/validate.ts';
import { migrateProfile } from '../lib/tree/migrate.ts';

const NOW = '2026-07-27T10:00:00.000Z';
const PLATFORMS = ['Instagram'];

// ── A profile walked all the way to the edge of the lock ─────────────────────

function decided(key: string, value: string): StrategyValue {
  return { key, value, reason: `because that is what the sources say about ${key}`, sources: [], strategy_version: null };
}

function withStrategy(body: ProfileBody): ProfileBody {
  let next = body;
  for (const path of LOCKABLE_STRATEGY_PATHS) {
    const row = derivationRow(path)!;
    next = writeStrategy(next, path, decided(row.label.toLowerCase().replace(/[^a-z]+/g, '-'), row.label), NOW);
  }
  return next;
}

function fiveGates(): GateDraft[] {
  return ['coach', 'hook', 'value', 'stance', 'friend'].map(id => ({
    id, name: id, question: `Does this piece pass the ${id} gate?`, from: 'voice',
  }));
}

function withGates(body: ProfileBody): ProfileBody {
  return writeGateSet(body, buildGateSet(fiveGates(), 1, 1, NOW), NOW);
}

/** Every non-fixed switch given a real position, resolved so nothing
 *  contradicts: a switch whose prerequisite is off goes off with it. */
function withSwitches(body: ProfileBody): ProfileBody {
  const wanted = new Map<string, PathState>();
  for (const id of switchesNeedingPosition(PLATFORMS)) {
    const dec = findSwitch(id);
    let state: PathState = dec?.suggested_default ?? 'hidden';
    if (id === platformSwitchId('Instagram')) state = 'active';
    if (id.startsWith('platforms.') && id !== platformSwitchId('Instagram')) state = 'hidden';
    wanted.set(id, state);
  }
  // Settle: nothing may be active on a prerequisite that is not.
  for (let pass = 0; pass < 6; pass++) {
    for (const [id, state] of wanted) {
      if (state !== 'active') continue;
      const dec = findSwitch(id) ?? null;
      for (const req of dec?.requires ?? []) {
        const reqState = wanted.get(req) ?? findSwitch(req)?.suggested_default ?? 'active';
        if (reqState !== 'active') wanted.set(id, 'hidden');
      }
    }
  }
  let next = body;
  for (const [id, state] of wanted) next = setSwitchPosition(next, id, state, NOW);
  return next;
}

function withChannel(body: ProfileBody): ProfileBody {
  return putEntry(body, 'work-log/creation/channels', {
    id: 'ch-ig', type: 'channel',
    data: {
      platform: 'Instagram', account_handle: 'careerbubble', ownership: 'client',
      connection: 'connected', timezone: 'Asia/Kolkata', posting_permission: 'we-post',
    },
  }, { writer: 'owner', now: NOW });
}

function readyToLock(): ProfileBody {
  return withChannel(withSwitches(withGates(withStrategy(emptyBody(NOW)))));
}

function lockInput(body: ProfileBody) {
  return {
    body, lifecycle: 'setup' as const, owner_kind: 'client' as const,
    platforms: PLATFORMS, now: NOW, goals: [], postingOwnership: 'we-post' as const,
  };
}

suite('spec 22 §14.10 — no orphan parameter, both directions');

test('10. every parameter names its reader, and every strategy parameter names its sources', () => {
  eq(derivationViolations(), [], 'the two directions agree, and the build refuses if they do not');

  for (const p of PARAMETERS) {
    ok(p.required_for.length > 0 || p.reader === 'none-by-design',
      `${p.id} is a question asked for nothing`);
    if (p.reader === 'none-by-design') ok(p.reader_reason, `${p.id} says none-by-design with no reason`);
  }
  for (const row of DERIVATION_MAP) {
    const named = row.from_parameters.length + row.from_strategy.length;
    ok(named > 0 || row.from_universal || row.owner_declared, `${row.path} has no source at all`);
  }

  // The check bites in both directions.
  const one = findParameter('identity.one-line')!;
  const original = [...one.required_for];
  one.required_for = ['context/content-strategy/cadence'];
  try {
    ok(derivationViolations().some(v => v.where === 'identity.one-line'),
      'a parameter claiming a reader that does not name it back is a violation');
  } finally {
    one.required_for = original;
  }
});

test('the derivation map only names declared paths and real parameters', () => {
  for (const row of DERIVATION_MAP) {
    for (const id of row.from_parameters) ok(findParameter(id), `${row.path} names unknown parameter ${id}`);
  }
  const sources = sourcesFor(emptyBody(NOW), 'context/content-strategy/positioning');
  eq(sources.length, 7, 'the sources panel shows every source the map declares');
  ok(sources.every(s => !s.curated), 'and says plainly that none of them is curated yet (§8.2)');
});

test('a strategy parameter refuses to be written before its evidence exists (§8.3)', () => {
  const empty = emptyBody(NOW);
  const refused = mayWriteStrategy(empty, 'context/content-strategy/positioning');
  ok(!refused.ok, 'nothing curated, so nothing to derive from');

  const curated = curateParameter(empty, {
    parameter_id: 'identity.one-line', value: 'Careers, without the guesswork',
    source_refs: ['a1-identity.one-line-client-1'], curator: 'owner', confidence: 'confirmed', now: NOW,
  });
  ok(mayWriteStrategy(curated, 'context/content-strategy/positioning').ok, 'one curated source is enough');
  ok(mayWriteStrategy(empty, 'context/content-strategy/positioning', true).ok,
    'and she may decide ahead of the evidence by marking it owner declared, visibly');
});

suite('spec 22 §14.13 — the gate set, v1 (S14)');

test('13. five brand gates, derived from voice and positioning, immutable once locked', () => {
  const bare = emptyBody(NOW);
  const bareViolations = gateSetViolations(bare, fiveGates());
  ok(bareViolations.some(v => v.includes('voice')), 'it refuses while voice is empty');
  ok(bareViolations.some(v => v.includes('positioning')), 'and while positioning is empty');

  const withText = withStrategy(bare);
  ok(gateSetViolations(withText, fiveGates().slice(0, 4)).some(v => v.includes('5 brand gates')),
    'four gates is not a gate set');
  eq(gateSetViolations(withText, fiveGates()), [], 'five, with voice and positioning written, passes');

  let body = withGates(withText);
  const v1 = readGateSet(body)!;
  eq(v1.version, 1, 'version 1');
  eq(v1.gates.filter(g => g.kind === 'brand').length, 5, 'five brand gates');
  eq(v1.gates.filter(g => g.kind === 'operational').map(g => g.id), ['accuracy', 'format'],
    'plus the two operational gates that never vary');

  const changed = [...fiveGates().slice(0, 4), { id: 'proof', name: 'proof', question: 'Is the claim proved?', from: 'positioning' }];
  body = writeGateSet(body, buildGateSet(changed, 2, 1, NOW), NOW);
  eq(readGateSet(body)!.version, 2, 'a gate change produces version 2');
  const stored = readPath(body, 'context/content-strategy/gates');
  const one = stored.find(e => e.id === 'gates-v1')!;
  eq((one.data as unknown as typeof v1).gates.filter(g => g.kind === 'brand').map(g => g.id),
    ['coach', 'hook', 'value', 'stance', 'friend'],
    'and version 1 is exactly as it was: gate versions apply forward only');
});

suite('spec 22 §14.14 — the switchboard blocks the lock');

test('14. a suggestion is not a position', () => {
  let body = withGates(withStrategy(emptyBody(NOW)));
  body = withChannel(body);
  const missing = unsetSwitches(body, PLATFORMS);
  ok(missing.length > 20, 'every switch this profile needs still has no position');
  ok(lockViolations(lockInput(body)).some(f => f.condition === 4), 'and the lock refuses on it');

  // A migrated profile's suggestions are exactly that — suggestions.
  const suggested = setSwitchPosition(body, 'creation.board', 'active', NOW, true);
  ok(unsetSwitches(suggested, PLATFORMS).includes('creation.board'),
    'suggested: true counts as unset (§8.5)');
  const set = setSwitchPosition(body, 'creation.board', 'active', NOW, false);
  ok(!unsetSwitches(set, PLATFORMS).includes('creation.board'), 'a position she set counts');
});

suite('spec 22 §14.15 — lock validation bites');

test('15. each of the six conditions blocks the lock on its own, and says which', () => {
  const ready = readyToLock();
  eq(lockViolations(lockInput(ready)), [], 'the finished profile locks clean');

  // 1 — a strategy parameter with no decision at all.
  const noDecision = { ...ready, paths: { ...ready.paths, 'context/content-strategy/cadence': [] } };
  const one = lockViolations(lockInput(noDecision));
  ok(one.some(f => f.condition === 1 && f.fix === 'derivation'), 'condition 1: no decision, no lock');

  // 2 — a decision with no reason line.
  let noReason = ready;
  noReason = putEntry(noReason, 'context/content-strategy/cadence', {
    id: 'decision', type: 'strategy_parameter',
    data: { key: 'cadence', value: '3 a week', reason: '', sources: [], strategy_version: null },
  }, { writer: 'owner', now: NOW });
  ok(lockViolations(lockInput(noReason)).some(f => f.condition === 2),
    'condition 2: no strategy parameter locks without its reason');

  // 3 — the gate set.
  const noGates = { ...ready, paths: { ...ready.paths, 'context/content-strategy/gates': [] } };
  ok(lockViolations(lockInput(noGates)).some(f => f.condition === 3), 'condition 3: no gate set, no lock');

  // 4 — an unset switch.
  const unset = { ...ready, paths: { ...ready.paths, 'context/content-strategy/toolset': [] } };
  ok(lockViolations(lockInput(unset)).some(f => f.condition === 4), 'condition 4: a switch with no position');

  // 5 — a contradiction spec 21's validator catches.
  const contradiction = setSwitchPosition(ready, 'creation.publishing', 'active', NOW);
  ok(lockViolations({ ...lockInput(contradiction), postingOwnership: 'client-posts' })
    .some(f => f.condition === 5), 'condition 5: contradictions refuse activation (S8)');

  // 6 — an active platform with no channel.
  const noChannel = { ...ready, paths: { ...ready.paths, 'work-log/creation/channels': [] } };
  const six = lockViolations(lockInput(noChannel));
  ok(six.some(f => f.condition === 6 && f.where === 'Instagram'), 'condition 6: an active platform needs a channel');
  ok(six.some(f => f.why.includes('timezone')), 'and it says why: without the timezone every metric is meaningless');

  // The failing lock changes NOTHING. No partial lock.
  const failed = lockStrategy(lockInput(noChannel));
  eq(failed.ok, false, 'it refuses');
  eq(failed.strategy_version, null, 'and nothing was stamped');

  // The successful lock stamps everything, in one act.
  const locked = lockStrategy(lockInput(ready));
  eq(locked.ok, true, 'the finished profile locks');
  eq(locked.strategy_version, 1, 'strategy version 1');
  eq(locked.lifecycle, 'active', 'and the profile moves from setup to active (S22)');
  for (const path of LOCKABLE_STRATEGY_PATHS) {
    eq(readStrategy(locked.body, path)!.strategy_version, 1, `${path} is stamped`);
  }
  eq(readGateSet(locked.body)!.locked_with_strategy_version, 1, 'the gate set locks with it');
  const config = switchConfigFromBody(locked.body);
  ok(Object.values(config).every(s => s.suggested === false), 'and no position is a suggestion any more');
  eq(validateSwitchConfig({ config, owner_kind: 'client', channels: [{ id: 'ch-ig', platform: 'Instagram', canPost: true }], postingOwnership: 'we-post' }), [],
    'after the lock the configuration validates clean');

  // And the canonical cascade trace still holds on the locked configuration.
  const trace = platformCascade('LinkedIn');
  eq(pathState(trace.formats, config), 'hidden', 'LinkedIn is off, so its formats are not rendered');
  eq(pathState('context/content-strategy/platforms/instagram/formats', config), 'active',
    'and Instagram, which she switched on, renders');
});

suite('spec 22 §14.16 — creation stays locked until strategy locks');

test('16. a write under work-log/creation is refused until the lock, and the legacy slices keep working', () => {
  const state = fixtureState();
  const rg = state.clients.find(c => c.id === 'resumeguru')!;
  const migrated = migrateProfile(rg, state.clientData['resumeguru'], { now: NOW });
  const before = migrated.body;
  ok(!strategyLocked(before), 'a migrated profile has not locked anything');

  const newSeed = putEntry(before, 'work-log/creation/topics', {
    id: 'seed-new', type: 'seed',
    data: { name: 'A new seed', raw_thought: 'x', raw_material: [], status: 'draft' },
  }, { writer: 'owner', now: NOW });
  eq(refusedCreationWrites(before, newSeed), ['work-log/creation/topics'],
    'the write door refuses it, and names the path');

  // Nothing else about the profile is affected — including everything spec 21
  // deliberately left rendering.
  eq(refusedCreationWrites(before, before), [], 'an unchanged body writes nothing and is refused nothing');
  eq(state.clientData['resumeguru'].contentCards.length, 3,
    'the legacy slices are untouched: this binds new writes through the tree, never them');

  const lockedBody = { ...readyToLock(), strategy_version: 1 };
  const afterLock = putEntry(lockedBody, 'work-log/creation/topics', {
    id: 'seed-new', type: 'seed',
    data: { name: 'A new seed', raw_thought: 'x', raw_material: [], status: 'draft' },
  }, { writer: 'owner', now: NOW });
  eq(refusedCreationWrites(lockedBody, afterLock), [], 'after the lock the same write is allowed');
});

suite('spec 22 §14.20 — nothing regressed');

test('20. the registries still validate with the inventory, the new folder and the corrections in place', () => {
  eq(validateRegistries().map(v => `${v.check} ${v.where}: ${v.reason}`), [],
    'no address, no switch, no fifth door, no orphan, no intake violation');
});

test('the six switches spec 22 registers exist, and the structural ones cannot be moved', () => {
  for (const id of ['intake.curation', 'intake.reminders', 'strategy.derivation', 'strategy.gate_set',
    'strategy.switchboard', 'strategy.lock']) {
    const s = findSwitch(id);
    ok(s, `${id} is not registered, and a feature with no switch is rejected`);
  }
  const lock = findSwitch('strategy.lock')!;
  ok(lock.dependents.includes('creation.board'),
    'creation cannot be active where strategy has not locked (§8.7, at switch level)');
  ok(SWITCHES.filter(s => s.fixed).every(s => s.allowed_states.length === 1),
    'structural switches still offer exactly one state');
});

test('a client-facing switch cannot be active while the lifecycle keeps its door shut (§11.1)', () => {
  const config: SwitchConfig = {
    'intake.questionnaire': { state: 'active', set_at: NOW },
    'assets.client_upload': { state: 'active', set_at: NOW },
    'client_access.login': { state: 'active', set_at: NOW },
    'assets.library': { state: 'active', set_at: NOW },
  };
  const atSetup = validateSwitchConfig({ config, owner_kind: 'client', clientDoors: ['give:intake'] });
  ok(!atSetup.some(v => v.switch === 'intake.questionnaire'), 'intake is open at setup, which is the whole point');
  ok(atSetup.some(v => v.switch === 'assets.client_upload' && v.reason.includes('give:assets')),
    'and nothing else is');
});
