// Spec 34 §4 and §5 — lib/strategy/plainSwitches.ts.
//
// What these check, in the order the spec asks for it:
//
//   1. She never sees an id. Every switch in the registry has a plain name and
//      a plain line, and no name, line or sentence this file produces contains
//      an id or a path.
//   2. The groups are the three questions: what this client gets, what we do
//      for them, what they can see.
//   3. Only what differs from the sensible default is open. Everything else
//      folds behind one line with a count, and the count is counted from the
//      array it describes: each one is asserted by CHANGING the array and
//      reading the sentence again.
//   4. A suggestion she has not touched behaves as the suggestion, and the one
//      act that confirms the rest never writes a position `active` on top of a
//      prerequisite that is not.
//   5. The lock lists ONLY what is missing. Nothing decided appears at all,
//      fourteen identical sentences collapse into the one thing to go and do,
//      and what locking does is stated before she is asked to do it.
//
// Plain Node, no dependencies, in the house harness style.
//
// NOT REGISTERED in tests/run.ts (that file is shared and owned by the
// integrator). Run it on its own with:
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \
//     "import('./tests/strategy.plain.test.ts').then(async m => \
//      process.exit(await (await import('./tests/harness.ts')).run()))"

import { suite, test, ok, eq } from './harness.ts';
import { emptyBody, type ProfileBody } from '../lib/tree/body.ts';
import type { PathState, SwitchConfig } from '../lib/tree/contract.ts';
import {
  SWITCHES, findSwitch, platformSwitchId, switchesForProfile, trackingSwitchId,
} from '../lib/tree/switches.ts';
import {
  LOCKABLE_STRATEGY_PATHS, lockViolations, setSwitchPosition, switchConfigFromBody,
  unsetSwitches,
} from '../lib/strategy/derivation.ts';
import { cascadeTrace } from '../lib/shell/trace.ts';
import {
  PLAIN_SWITCHES, SWITCH_GROUPS, WHAT_LOCKING_DOES, composeLock, composeMove,
  composeSwitchboard, listWords, missingPlainNames, plainName, plainSentence, plainSwitch,
  positionsToConfirm, stateWords, type SwitchRow,
} from '../lib/strategy/plainSwitches.ts';

const NOW = '2026-08-08T09:00:00.000Z';
const PLATFORMS = ['Instagram'];

/** Every id a switch could carry on a profile, generated families included. */
function allIds(platforms: string[] = PLATFORMS): string[] {
  return switchesForProfile(platforms).map(s => s.id);
}

/** Does this sentence contain a switch id or a path? The whole point of §5. */
function idsInside(text: string): string[] {
  const hits: string[] = [];
  for (const id of allIds(['Instagram', 'LinkedIn', 'YouTube'])) {
    if (text.includes(id)) hits.push(id);
  }
  if (/[a-z-]+\/[a-z-]+/.test(text)) hits.push('a path');
  return hits;
}

function rowsOf(view: ReturnType<typeof composeSwitchboard>): SwitchRow[] {
  return [
    ...view.open.flatMap(g => g.rows),
    ...view.folded.flatMap(g => g.rows),
  ];
}

// ── 1. She never sees an id ──────────────────────────────────────────────────

suite('spec 34 §5 — she never sees an id');

test('every switch in the registry has a plain name and a plain line', () => {
  eq(missingPlainNames(), [], 'a registered switch has no plain name');
  eq(missingPlainNames(['Instagram', 'LinkedIn', 'YouTube']), [],
    'a platform switch has no plain name');
});

test('a platform nobody hard-coded still gets a name, never an id', () => {
  const p = plainSwitch(platformSwitchId('Threads'));
  ok(p, 'a generated platform switch has no plain name');
  eq(p!.name, 'Threads', 'the generated platform name is not the platform');
  eq(idsInside(p!.line), [], 'the generated line carries an id');

  const t = plainSwitch(trackingSwitchId('Threads'));
  ok(t, 'a generated collector switch has no plain name');
  eq(t!.name, 'Threads numbers', 'the generated collector name is wrong');
  eq(missingPlainNames(['Threads']), [], 'a profile on a new platform hits a nameless switch');
});

test('no plain name or line contains an id or a path', () => {
  for (const [id, plain] of Object.entries(PLAIN_SWITCHES)) {
    eq(idsInside(plain.name), [], `the name for ${id} carries an id or a path`);
    eq(idsInside(plain.line), [], `the line for ${id} carries an id or a path`);
  }
});

test('no line she reads carries an em dash', () => {
  for (const [id, plain] of Object.entries(PLAIN_SWITCHES)) {
    ok(!plain.name.includes('—'), `the name for ${id} has an em dash`);
    ok(!plain.line.includes('—'), `the line for ${id} has an em dash`);
  }
  for (const line of WHAT_LOCKING_DOES) ok(!line.includes('—'), 'the lock copy has an em dash');
});

test('a validator sentence comes back with its ids swapped for names', () => {
  const said = plainSentence('requires "creation.board", which is hidden');
  eq(idsInside(said), [], 'the translated sentence still carries an id');
  ok(said.includes('their board'), `the plain name is missing: ${said}`);
});

test('the plain name is never the id, even for a switch nobody named', () => {
  eq(plainName('made.up.switch'), 'a switch with no plain name yet',
    'an unknown switch falls back to its id');
});

// ── 2. Three groups, and they are the three questions ────────────────────────

suite('spec 34 §5 — grouped by the question they answer');

test('the three groups are the three questions', () => {
  eq(SWITCH_GROUPS.map(g => g.title),
    ['What this client gets', 'What we do for them', 'What they can see'],
    'the groups are not the three questions');
});

test('every switch on the screen sits in one of the three', () => {
  const view = composeSwitchboard({ config: {}, platforms: PLATFORMS });
  const ids = new Set(SWITCH_GROUPS.map(g => g.id));
  for (const r of rowsOf(view)) ok(ids.has(r.group), `${r.name} is in no group`);
});

test('a group with nothing in it never draws', () => {
  const view = composeSwitchboard({ config: {}, platforms: PLATFORMS });
  for (const g of [...view.open, ...view.folded]) {
    ok(g.rows.length > 0, `the group "${g.title}" drew with nothing in it`);
  }
});

test('a switch she cannot move is not on the screen at all', () => {
  const view = composeSwitchboard({ config: {}, platforms: PLATFORMS });
  const shown = new Set(rowsOf(view).map(r => r.id));
  for (const s of SWITCHES) {
    if (!s.fixed) continue;
    ok(!shown.has(s.id), `${s.id} is fixed and it drew a row anyway`);
  }
});

// ── 3. Only what differs is open, and the counts are counted ─────────────────

suite('spec 34 §5 — only what differs is open');

test('with nothing set, everything with a default is folded', () => {
  const view = composeSwitchboard({ config: {}, platforms: PLATFORMS });
  for (const r of rowsOf(view)) {
    if (r.sensible === null) {
      ok(r.differs, `${r.name} has no default and folded anyway`);
    } else {
      eq(r.differs, false, `${r.name} sits at its default and it opened`);
    }
  }
});

test('a switch with no sensible default is always open', () => {
  const id = platformSwitchId('Instagram');
  const view = composeSwitchboard({ config: {}, platforms: PLATFORMS });
  const row = rowsOf(view).find(r => r.id === id)!;
  eq(row.sensible, null, 'the platform switch claims a default it does not have');
  ok(row.differs, 'a switch with no default folded behind "as it should be"');
});

test('moving one switch off its default opens exactly that one', () => {
  const base = composeSwitchboard({ config: {}, platforms: PLATFORMS });
  const config: SwitchConfig = {
    'creation.publishing': { state: 'active', set_at: NOW },
  };
  const after = composeSwitchboard({ config, platforms: PLATFORMS });
  eq(after.openCount, base.openCount + 1, 'moving one switch did not open exactly one');
  const opened = after.open.flatMap(g => g.rows).find(r => r.id === 'creation.publishing');
  ok(opened, 'the moved switch is not open');
  eq(opened!.positionWords, 'on', 'the moved switch does not read as on');
});

test('setting a switch to what it already was leaves it folded', () => {
  const config: SwitchConfig = {
    'creation.board': { state: findSwitch('creation.board')!.suggested_default!, set_at: NOW },
  };
  const view = composeSwitchboard({ config, platforms: PLATFORMS });
  const row = rowsOf(view).find(r => r.id === 'creation.board')!;
  eq(row.differs, false, 'agreeing with the default counted as a change');
});

test('the migration suggestion IS the sensible default for this profile', () => {
  const suggested: SwitchConfig = {
    'creation.funnel': { state: 'active', set_at: NOW, suggested: true },
  };
  const view = composeSwitchboard({ config: {}, suggested, platforms: PLATFORMS });
  const row = rowsOf(view).find(r => r.id === 'creation.funnel')!;
  eq(row.position, 'active', 'the suggestion did not behave as the suggestion');
  eq(row.differs, false, 'a suggestion she has not touched read as a change');
});

test('the fold line counts the folded array, at call time', () => {
  const base = composeSwitchboard({ config: {}, platforms: PLATFORMS });
  eq(base.foldLine, `${base.foldedCount} more are as they should be`,
    'the fold line does not say what the array holds');

  const after = composeSwitchboard({
    config: { 'creation.publishing': { state: 'active', set_at: NOW } },
    platforms: PLATFORMS,
  });
  eq(after.foldedCount, base.foldedCount - 1, 'the folded count did not move with the array');
  eq(after.foldLine, `${after.foldedCount} more are as they should be`,
    'the fold line held a number of its own');
});

test('a platform this profile does not work is off, and that is as it should be', () => {
  const view = composeSwitchboard({ config: {}, platforms: PLATFORMS });
  const row = rowsOf(view).find(r => r.id === platformSwitchId('LinkedIn'))!;
  eq(row.sensible, 'hidden', 'a platform nobody works here claims a live default');
  eq(row.differs, false, 'a platform nobody works here opened for no reason');
  eq(row.position, 'hidden', 'a platform nobody works here reads as on');
});

test('the collector follows whether that platform is connected', () => {
  const off = composeSwitchboard({ config: {}, platforms: PLATFORMS });
  eq(off.folded.flatMap(g => g.rows).find(r => r.id === trackingSwitchId('Instagram'))!.position,
    'hidden', 'the collector is suggested on with nothing connected');

  const on = composeSwitchboard({ config: {}, platforms: PLATFORMS, connected: ['Instagram'] });
  const row = rowsOf(on).find(r => r.id === trackingSwitchId('Instagram'))!;
  eq(row.position, 'active', 'the collector is off on a connected account');
  eq(row.differs, false, 'the connected collector opened as if it were a change');
});

test('a second platform adds its two rows, and the counts follow', () => {
  const one = composeSwitchboard({ config: {}, platforms: PLATFORMS });
  const two = composeSwitchboard({ config: {}, platforms: ['Instagram', 'Threads'] });
  eq(rowsOf(two).length, rowsOf(one).length + 2,
    'a new platform did not bring its platform switch and its collector');
});

test('the state words are hers, and there is no third state on screen', () => {
  eq(stateWords('active'), 'on', 'active does not read as on');
  eq(stateWords('hidden'), 'off', 'hidden does not read as off');
  eq(stateWords('history'), 'off, keep what is there', 'history does not say what survives');
});

// ── 4. A suggestion behaves as the suggestion ────────────────────────────────

suite('spec 34 §5 — the suggestion behaves as the suggestion');

test('an untouched suggestion still counts as unconfirmed in the data', () => {
  const view = composeSwitchboard({ config: {}, platforms: PLATFORMS });
  eq(view.unconfirmed.length, rowsOf(view).length,
    'a profile with nothing set has confirmed positions');
  const migrated = composeSwitchboard({
    config: { 'creation.funnel': { state: 'active', set_at: NOW, suggested: true } },
    platforms: PLATFORMS,
  });
  const row = rowsOf(migrated).find(r => r.id === 'creation.funnel')!;
  ok(row.unconfirmed, 'a migration suggestion counted as her yes');
});

test('confirming the rest never puts a switch on top of a prerequisite that is off', () => {
  const config: SwitchConfig = { 'creation.board': { state: 'hidden', set_at: NOW } };
  const writes = positionsToConfirm({ config, platforms: PLATFORMS });
  const byId = new Map(writes.map(w => [w.id, w.state]));
  eq(byId.get('creation.review'), 'hidden',
    'a switch was confirmed active while the board it needs is off');
  eq(byId.get('creation.making'), 'hidden',
    'making was confirmed active while the board it needs is off');
});

test('every written position is one the switch actually allows', () => {
  const writes = positionsToConfirm({ config: {}, platforms: PLATFORMS });
  for (const w of writes) {
    const dec = findSwitch(w.id) ?? null;
    ok(dec === null || dec.allowed_states.includes(w.state),
      `${w.id} would be written a state it does not allow: ${w.state}`);
  }
});

test('confirming the rest answers the lock, and the switches stop being missing', () => {
  let body: ProfileBody = emptyBody();
  // Platforms carry no default, so they are hers to place first.
  body = setSwitchPosition(body, platformSwitchId('Instagram'), 'active', NOW);
  const writes = positionsToConfirm({ config: switchConfigFromBody(body), platforms: PLATFORMS });
  for (const w of writes) body = setSwitchPosition(body, w.id, w.state, NOW);
  eq(unsetSwitches(body, PLATFORMS), [], 'switches are still without a position after confirming');

  const after = composeSwitchboard({ config: switchConfigFromBody(body), platforms: PLATFORMS });
  eq(after.unconfirmed.length, 0, 'the screen still says positions are unconfirmed');
});

// ── 4b. Moving one switch, previewed before it commits ───────────────────────

suite('spec 34 §5 — the move preview');

test('turning something off names what goes with it, in her words', () => {
  const move = composeMove('creation.review', 'hidden', {}, cascadeTrace('creation.review', 'hidden'));
  eq(move.title, 'They approve pieces', 'the preview is titled with an id');
  eq(move.kicker, 'Turning this to off', 'the preview does not say where it is going');
  ok(move.takingAway, 'turning a switch off did not read as taking something away');
  ok(move.theirs.includes('A preview link anyone can open'),
    `the client column is not in her words: ${move.theirs.join(', ')}`);
  for (const n of [...move.hers, ...move.theirs]) eq(idsInside(n), [], `${n} is an id`);
  ok(move.survives.includes('stays'), 'the preview does not say what survives');
});

test('turning something on takes nothing away, and says so', () => {
  const move = composeMove('creation.publishing', 'active', {}, cascadeTrace('creation.publishing', 'active'));
  eq(move.takingAway, false, 'turning a switch on read as taking something away');
  eq(move.hers, [], 'turning something on listed things going away');
  eq(move.theirs, [], 'turning something on listed things going away for them');
  eq(move.survives, 'Nothing is taken away by turning something on.',
    'the on-preview still talks about removal');
});

test('turning something on that is held down says what is holding it', () => {
  const config: SwitchConfig = { 'creation.board': { state: 'hidden', set_at: NOW } };
  const move = composeMove('creation.review', 'active', config, cascadeTrace('creation.review', 'active'));
  eq(move.held, 'It stays off until Their board is on.', 'the preview hid the thing holding it down');
  eq(idsInside(move.held!), [], 'the held line carries an id');
});

test('nothing is held when every prerequisite is on', () => {
  const move = composeMove('creation.publishing', 'active', {
    'creation.scheduling': { state: 'active', set_at: NOW },
    'creation.channels': { state: 'active', set_at: NOW },
  }, cascadeTrace('creation.publishing', 'active'));
  eq(move.held, null, 'a switch with every prerequisite on was called held');
});

// ── 5. The lock says what it does, and lists only what is missing ────────────

suite('spec 34 §4 — the lock');

function lockOf(body: ProfileBody) {
  return composeLock({
    failures: lockViolations({
      body, lifecycle: 'setup', owner_kind: 'client', platforms: PLATFORMS, now: NOW, goals: [],
    }),
    locked: typeof body.strategy_version === 'number',
    version: body.strategy_version ?? null,
    decisionCount: LOCKABLE_STRATEGY_PATHS.length,
  });
}

test('what locking does is said before she is asked to do it', () => {
  const view = lockOf(emptyBody());
  eq(view.does.length, 2, 'what locking does is not two lines');
  ok(view.does[0].toLowerCase().includes('creation'), 'the first line does not say Creation opens');
  ok(view.does[1].toLowerCase().includes('judged'),
    'the second line does not say what the frozen version is for');
});

test('fourteen identical sentences about switches become one thing to go and do', () => {
  const view = lockOf(emptyBody());
  const switchLines = view.missing.filter(m => m.go === 'switches');
  eq(switchLines.length, 1, 'the switches are still listed one by one');
  ok(/^\d+ switches still need your yes$/.test(switchLines[0].what),
    `the one line does not say how many: ${switchLines[0].what}`);
});

test('the switch count on the lock is counted from the failures it describes', () => {
  const empty = lockOf(emptyBody());
  const line = empty.missing.find(m => m.go === 'switches')!.what;
  const said = Number(/^(\d+)/.exec(line)![1]);
  eq(said, unsetSwitches(emptyBody(), PLATFORMS).length,
    'the lock quoted a number the array does not hold');

  let body: ProfileBody = emptyBody();
  body = setSwitchPosition(body, 'creation.funnel', 'hidden', NOW);
  const after = lockOf(body);
  const nextLine = after.missing.find(m => m.go === 'switches')!.what;
  eq(Number(/^(\d+)/.exec(nextLine)![1]), said - 1, 'the number did not move with the array');
});

test('three or fewer are named, never counted', () => {
  const view = composeLock({
    failures: [
      { condition: 4, where: 'creation.publishing', fix: 'switchboard', why: 'no position' },
      { condition: 4, where: 'analysis.compare', fix: 'switchboard', why: 'no position' },
    ],
    locked: false, version: null, decisionCount: 14,
  });
  eq(view.missing.length, 1, 'two unset switches did not collapse to one line');
  eq(view.missing[0].what, 'We post for them and Comparing pieces still need your yes',
    'the two are not named in her words');
});

test('nothing already decided appears on the lock at all', () => {
  const view = composeLock({
    failures: [{ condition: 1, where: 'Platforms', fix: 'derivation', why: 'no decision' }],
    locked: false, version: null, decisionCount: 14,
  });
  eq(view.missing.map(m => m.what), ['Platforms: not decided yet'],
    'the lock listed something other than what is missing');
  eq(view.ready, false, 'the lock read as ready with something missing');
});

test('no line on the lock carries an id or a path', () => {
  const view = lockOf(emptyBody());
  for (const m of view.missing) eq(idsInside(m.what), [], `a lock line carries an id: ${m.what}`);
  for (const line of [...view.does, view.actionLine, ...view.changeLines]) {
    eq(idsInside(line), [], `a lock line carries an id: ${line}`);
  }
});

test('a validator contradiction reaches her in her own words', () => {
  const view = composeLock({
    failures: [{
      condition: 5, where: 'creation.publishing', fix: 'switchboard',
      why: 'working-mode says the client posts',
    }],
    locked: false, version: null, decisionCount: 14,
  });
  eq(view.missing[0].what, 'We post for them: working-mode says the client posts',
    'the contradiction did not come through in her words');
});

test('the missing gates are counted, not restated', () => {
  const view = composeLock({
    failures: [{ condition: 3, where: 'Gate set', fix: 'gates', why: '2 brand gates of 5' }],
    locked: false, version: null, decisionCount: 14,
  });
  eq(view.missing[0].what, '3 of the 5 checks are still to write', 'the gates line is not hers');
  eq(view.missing[0].go, 'gates', 'the gates line does not go to the gates');
});

test('a missing account says which platform, and goes to the accounts', () => {
  const view = composeLock({
    failures: [{ condition: 6, where: 'Instagram', fix: 'channels', why: 'this platform is on and has no channel record' }],
    locked: false, version: null, decisionCount: 14,
  });
  eq(view.missing[0].what, 'Instagram: on, with no account recorded yet', 'the accounts line is not hers');
  eq(view.missing[0].go, 'channels', 'the accounts line does not go to the accounts');
});

test('with nothing missing the lock is ready, and says what it will change', () => {
  const view = composeLock({ failures: [], locked: false, version: null, decisionCount: 14 });
  eq(view.missing, [], 'a ready lock still listed something');
  eq(view.ready, true, 'a lock with nothing missing did not read as ready');
  eq(view.action, 'Lock it and open Creation', 'the action does not say what it opens');
  eq(view.actionLine, 'Creation opens for writing, and 14 decisions freeze as version 1.',
    'the action line does not say what it will change');
});

test('the action counts the decisions it is given, never a number of its own', () => {
  const view = composeLock({ failures: [], locked: true, version: 2, decisionCount: 9 });
  ok(view.actionLine.includes('9 decisions freeze'), `the count is wrong: ${view.actionLine}`);
  eq(view.action, 'Lock version 3', 'a re-lock does not say which version it makes');
});

test('unlocking is possible, and it says what it costs', () => {
  const view = composeLock({ failures: [], locked: true, version: 1, decisionCount: 14 });
  eq(view.changeTitle, 'Changing it after the lock', 'the change block has no title');
  ok(view.changeLines.some(l => l.toLowerCase().includes('costs')),
    'nothing on the lock says what changing it costs');
  ok(view.changeLines.some(l => l.includes('keeps seeing the locked version')),
    'the cost does not say what the client sees meanwhile');
});

test('the list joiner reads like a sentence', () => {
  eq(listWords(['one']), 'one', 'one item is not itself');
  eq(listWords(['one', 'two']), 'one and two', 'two items do not join');
  eq(listWords(['one', 'two', 'three']), 'one, two and three', 'three items do not join');
});
