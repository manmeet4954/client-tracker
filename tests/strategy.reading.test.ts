// Spec 34 §6, §7, §8 — the three reading sections of the Strategy room.
//
// What these prove, in the order the spec asks for it:
//   §6  a channel says what connecting gets her; not connected is a state, not
//       an error; a platform decided with no channel is still on screen.
//   §7  the actual sentences a piece is checked against; the two fixed ones
//       shown as fixed with a reason; no set means "here is what makes one".
//   §8  the kit counts come from the arrays.
//   §9  no screen may show a switch id, a path or a count of sources, and every
//       count is counted from the array it describes.

import { suite, test, ok, eq } from './harness.ts';
import { emptyBody, putEntry } from '../lib/tree/body.ts';
import type { ProfileBody } from '../lib/tree/body.ts';
import {
  buildGateSet, writeGateSet, writeStrategy, CHANNELS_PATH, type GateDraft, type StrategyValue,
} from '../lib/strategy/derivation.ts';
import {
  BRAND_KIT_PURPOSE, CHANNELS_PURPOSE, brandKitCounts, brandKitEmpty, brandKitSummary,
  buildChannelRows, canConnectHere, channelRecords, channelSummary, channelsNote, collectable,
  decidedPlatforms, gatesHeadline, gatesWritable, readGates, whatProducesGates,
  type ChannelRecord,
} from '../lib/strategy/reading.ts';

const NOW = '2026-08-08T10:00:00.000Z';
const CS = 'context/content-strategy';

function decided(key: string, value: unknown): StrategyValue {
  return { key, value, reason: `because that is what the sources say about ${key}`, sources: [], strategy_version: null };
}

function withChannel(body: ProfileBody, id: string, data: Record<string, unknown>): ProfileBody {
  return putEntry(body, CHANNELS_PATH, { id, type: 'channel', data }, { writer: 'owner', now: NOW });
}

function fiveGates(): GateDraft[] {
  return [
    { id: 'plain', name: 'Plain', question: 'Would she say this line out loud to a person?', from: 'voice' },
    { id: 'proof', name: 'Proof', question: 'Is there a real thing behind this claim?', from: 'positioning' },
    { id: 'one-idea', name: 'One idea', question: 'Does this piece carry exactly one idea?', from: 'voice' },
    { id: 'stance', name: 'Stance', question: 'Does this take a position someone could disagree with?', from: 'positioning' },
    { id: 'useful', name: 'Useful', question: 'Does a stranger leave with something they did not have?', from: 'voice' },
  ];
}

// ── §6 Channels ──────────────────────────────────────────────────────────────

suite('spec 34 §6 — Channels says what it is for');

test('the purpose line names both jobs: where it posts, and where numbers come from', () => {
  ok(/where this brand posts/i.test(CHANNELS_PURPOSE), 'it says where the brand posts');
  ok(/where the numbers come from/i.test(CHANNELS_PURPOSE), 'it says where the numbers come from');
  ok(/Analysis/.test(CHANNELS_PURPOSE), 'it says connecting is what makes Analysis work');
});

test('only Instagram is collectable, and the screen is told so rather than guessing', () => {
  ok(collectable('Instagram'), 'Instagram');
  ok(collectable('instagram'), 'case does not matter');
  ok(!collectable('LinkedIn'), 'LinkedIn has no collector in this app');
});

test('a channel with a connected account reads connected, and offers no failure line', () => {
  const rows = buildChannelRows({
    channels: [{ id: 'c1', platform: 'Instagram', handle: 'resumeguru.ai', posting_permission: 'we-post' }],
    platforms: [],
    accounts: [{ id: 'a1', username: 'resumeguru.ai' }],
  });
  eq(rows.length, 1, 'one row');
  ok(rows[0].connected, 'it is connected');
  eq(rows[0].state, 'Connected', 'and it says so in a word');
  eq(rows[0].account, '@resumeguru.ai', 'the account is shown with its @');
  eq(rows[0].without, '', 'nothing is unavailable, so nothing is said about it');
  ok(rows[0].gets.length > 0, 'what the connection gets her is still stated');
});

test('not connected is a state, not an error: one line saying what stays unavailable', () => {
  const rows = buildChannelRows({
    channels: [{ id: 'c1', platform: 'Instagram', handle: '@krnl.studio' }],
    platforms: [],
    accounts: [],
  });
  ok(!rows[0].connected, 'it is not connected');
  eq(rows[0].state, 'Not connected', 'the state is a plain word');
  ok(/Analysis has nothing to read/i.test(rows[0].without), 'it says what is unavailable');
  ok(/Everything else/i.test(rows[0].without), 'and that everything else works');
  ok(!/error|fail|problem|must|fix/i.test(rows[0].without), 'no failure language anywhere in it');
  eq(rows[0].without.split('. ').length, 2, 'and it is one line, not a paragraph');
});

test('an account connected under a different handle does not count as this channel', () => {
  const rows = buildChannelRows({
    channels: [{ id: 'c1', platform: 'Instagram', handle: 'divine.studio' }],
    platforms: [],
    accounts: [{ id: 'a1', username: 'resumeguru.ai' }],
  });
  ok(!rows[0].connected, 'a different account is not this channel connected');
  eq(rows[0].account, '@divine.studio', 'the channel keeps its own handle on screen');
});

test('a channel with no handle takes any account linked to this profile', () => {
  const rows = buildChannelRows({
    channels: [{ id: 'c1', platform: 'Instagram' }],
    platforms: [],
    accounts: [{ id: 'a1', username: 'resumeguru.ai' }],
  });
  ok(rows[0].connected, 'connected');
  eq(rows[0].account, '@resumeguru.ai', 'and it shows which account it is');
});

test('a platform decided with no channel record still gets a row', () => {
  const rows = buildChannelRows({
    channels: [{ id: 'c1', platform: 'Instagram', handle: 'resumeguru.ai' }],
    platforms: ['Instagram', 'LinkedIn'],
    accounts: [],
  });
  eq(rows.length, 2, 'the decided platform with no record is on screen');
  const linkedin = rows.find(r => r.platform === 'LinkedIn')!;
  ok(!linkedin.connected, 'it is not connected');
  ok(!linkedin.collectable, 'and this app cannot collect from it');
  ok(/recorded by hand/i.test(linkedin.gets), 'it says plainly what happens instead');
});

test('a platform nothing can be collected from does not read as not connected', () => {
  const rows = buildChannelRows({
    channels: [{ id: 'c1', platform: 'LinkedIn', handle: 'manmeet' }],
    platforms: [], accounts: [],
  });
  eq(rows[0].state, 'By hand', 'there is nothing to connect, so it is not a missing connection');
  eq(rows[0].without, '', 'and the line about what is unavailable would only repeat itself');
});

test('an uncollectable platform never implies a connect button', () => {
  const rows = buildChannelRows({
    channels: [{ id: 'c1', platform: 'LinkedIn', handle: 'manmeet' }],
    platforms: [],
    accounts: [],
  });
  ok(!canConnectHere(rows), 'nothing here can be connected, so nothing offers to');
  ok(/only platform numbers are collected from/i.test(channelsNote(rows)), 'and the note names the limit once');
  eq(channelsNote(buildChannelRows({
    channels: [{ id: 'c1', platform: 'Instagram' }], platforms: [], accounts: [],
  })), '', 'with nothing hand-recorded there is no note at all');
});

test('the summary is counted from the rows, in every shape', () => {
  const one: ChannelRecord[] = [{ id: 'c1', platform: 'Instagram', handle: 'a' }];
  eq(channelSummary(buildChannelRows({ channels: [], platforms: [], accounts: [] })),
    'No channel here yet.', 'empty');
  eq(channelSummary(buildChannelRows({ channels: one, platforms: [], accounts: [] })),
    '1 channel, nothing connected yet.', 'one, singular, none connected');
  eq(channelSummary(buildChannelRows({ channels: one, platforms: [], accounts: [{ id: 'a', username: 'a' }] })),
    '1 channel, everything that can be connected is.', 'one, connected');
  eq(channelSummary(buildChannelRows({ channels: [{ id: 'c2', platform: 'LinkedIn' }], platforms: [], accounts: [] })),
    '1 channel, all recorded by hand.', 'nothing here can be connected at all');
});

test('a hand-recorded channel is not counted as a missing connection', () => {
  const rows = buildChannelRows({
    channels: [{ id: 'c1', platform: 'Instagram', handle: 'a' }, { id: 'c2', platform: 'LinkedIn' }],
    platforms: [], accounts: [{ id: 'a', username: 'a' }],
  });
  eq(channelSummary(rows), '2 channels, everything that can be connected is.',
    'LinkedIn does not make the profile two thirds unfinished');
});

test('the posting line is words, never the stored token', () => {
  const rows = buildChannelRows({
    channels: [
      { id: 'c1', platform: 'Instagram', posting_permission: 'we-post' },
      { id: 'c2', platform: 'Instagram', posting_permission: 'client-posts' },
      { id: 'c3', platform: 'Instagram' },
    ],
    platforms: [], accounts: [],
  });
  eq(rows[0].posting, 'We post here', 'we post');
  eq(rows[1].posting, 'They post here', 'they post');
  eq(rows[2].posting, 'Nobody has said who posts here', 'nobody said');
  for (const r of rows) ok(!/we-post|client-posts|_/.test(r.posting), 'no stored token reaches the screen');
});

test('channel records are read from the body, and a nameless one is dropped', () => {
  let body = emptyBody(NOW);
  body = withChannel(body, 'c1', { platform: 'Instagram', handle: 'resumeguru.ai' });
  body = withChannel(body, 'c2', { handle: 'nameless' });
  const rows = channelRecords(body);
  eq(rows.length, 1, 'only the one that names a platform');
  eq(rows[0].platform, 'Instagram', 'and it is that one');
  eq(channelRecords(undefined).length, 0, 'no body, no rows, no throw');
});

test('the decided platforms read as a list whether they were picked or typed', () => {
  let picked = emptyBody(NOW);
  picked = writeStrategy(picked, `${CS}/platforms`, decided('platforms', ['Instagram', 'LinkedIn']), NOW);
  eq(decidedPlatforms(picked), ['Instagram', 'LinkedIn'], 'a pick-list writes an array');

  let typed = emptyBody(NOW);
  typed = writeStrategy(typed, `${CS}/platforms`, decided('platforms', 'Instagram and LinkedIn'), NOW);
  eq(decidedPlatforms(typed), ['Instagram', 'LinkedIn'], 'a typed one still reads');

  eq(decidedPlatforms(emptyBody(NOW)), [], 'undecided is empty, never a guess');
});

test('nothing a channel row puts on screen is an id or a path', () => {
  let body = emptyBody(NOW);
  body = withChannel(body, 'c1', { platform: 'Instagram', handle: 'resumeguru.ai', posting_permission: 'we-post' });
  const rows = buildChannelRows({ channels: channelRecords(body), platforms: ['Instagram'], accounts: [] });
  for (const r of rows) {
    for (const line of [r.platform, r.account, r.posting, r.gets, r.without]) {
      ok(!line.includes('work-log/'), 'no path');
      ok(!line.includes('context/'), 'no path');
      ok(!/platforms\.[a-z]/.test(line), 'no switch id');
    }
  }
});

// ── §7 Gates ─────────────────────────────────────────────────────────────────

suite('spec 34 §7 — Gates, the checks written out');

test('with nothing decided, it says what will produce a set instead of drawing an empty list', () => {
  const r = readGates(emptyBody(NOW));
  eq(r.brand.length, 0, 'no brand gates yet');
  eq(r.fixed.length, 2, 'the two that never change are still shown');
  ok(r.missing.length === 2, 'both missing decisions are named');
  ok(/voice/i.test(r.whatProduces) && /positioning/i.test(r.whatProduces), 'it names what produces one');
  ok(!gatesWritable(r), 'and it cannot be written yet');
});

test('the missing lines are her words, not condition numbers', () => {
  const r = readGates(emptyBody(NOW));
  for (const m of r.missing) {
    ok(!/condition|not applicable|reason line/i.test(m), `plain: ${m}`);
    ok(!m.includes('/'), `no path: ${m}`);
  }
});

test('voice decided alone moves the line on to the one that is left', () => {
  let body = emptyBody(NOW);
  body = writeStrategy(body, `${CS}/voice`, decided('voice', 'Direct, warm, no jargon'), NOW);
  const r = readGates(body);
  eq(r.voice, 'Direct, warm, no jargon', 'the voice is read as written');
  eq(r.positioning, null, 'positioning is still undecided');
  eq(r.missing.length, 1, 'only one thing is missing');
  ok(/Decide the positioning/i.test(r.whatProduces), 'and it says which');
});

test('both decided and no set written: it says the set can be written now', () => {
  let body = emptyBody(NOW);
  body = writeStrategy(body, `${CS}/voice`, decided('voice', 'Direct, warm, no jargon'), NOW);
  body = writeStrategy(body, `${CS}/positioning`, decided('positioning', 'The designer who explains'), NOW);
  const r = readGates(body);
  ok(gatesWritable(r), 'it can be written');
  ok(/can be written now/i.test(r.whatProduces), 'and it says so');
});

test('a written set shows the actual sentences, not the word gate and a dot', () => {
  let body = emptyBody(NOW);
  body = writeStrategy(body, `${CS}/voice`, decided('voice', 'Direct, warm'), NOW);
  body = writeStrategy(body, `${CS}/positioning`, decided('positioning', 'The designer who explains'), NOW);
  body = writeGateSet(body, buildGateSet(fiveGates(), 1, 0, NOW), NOW);
  const r = readGates(body);
  eq(r.brand.length, 5, 'five brand checks');
  eq(r.brand[0].sentence, 'Would she say this line out loud to a person?', 'the sentence itself is on screen');
  eq(r.version, 1, 'and the version it came from');
  eq(r.missing.length, 0, 'nothing missing');
  eq(r.whatProduces, '', 'and nothing to explain');
  for (const g of r.brand) ok(g.sentence.trim().length > 0, 'every brand check carries its sentence');
});

test('the two fixed checks are shown as fixed AND say why', () => {
  const r = readGates(emptyBody(NOW));
  const ids = r.fixed.map(f => f.id).sort();
  eq(ids, ['accuracy', 'format'], 'accuracy and format');
  for (const f of r.fixed) {
    ok(f.sentence.trim().length > 0, `${f.id} carries its sentence`);
    ok(/same for every brand/i.test(f.why), `${f.id} says why it never varies`);
  }
});

test('the headline is counted from the two arrays, never typed', () => {
  const r = readGates(emptyBody(NOW));
  eq(r.headline, '2 checks so far, and they are the two that never change.', 'nothing written yet');

  let body = emptyBody(NOW);
  body = writeStrategy(body, `${CS}/voice`, decided('voice', 'Direct'), NOW);
  body = writeStrategy(body, `${CS}/positioning`, decided('positioning', 'Clear'), NOW);
  body = writeGateSet(body, buildGateSet(fiveGates(), 1, 0, NOW), NOW);
  eq(readGates(body).headline, '7 checks: 5 for this brand, 2 that never change.', 'counted from both arrays');

  eq(gatesHeadline(
    [{ id: 'a', name: 'A', sentence: 'One?' }],
    [{ id: 'accuracy', name: 'Accuracy', sentence: 'True?', why: 'same for every brand' }],
  ), '2 checks: 1 for this brand, 1 that never change.', 'singular counts still come from the arrays');
});

test('a voice stored as chips reads as words, because Decide is being rebuilt around chips', () => {
  let body = emptyBody(NOW);
  body = writeStrategy(body, `${CS}/voice`, decided('voice', ['direct', 'warm', 'no jargon']), NOW);
  eq(readGates(body).voice, 'direct, warm, no jargon', 'the chips read as a line');
});

test('a decision marked not applicable is not a decision the gates can be built from', () => {
  let body = emptyBody(NOW);
  body = writeStrategy(body, `${CS}/voice`, {
    key: 'voice', value: null, not_applicable: true, reason: 'not used here', sources: [], strategy_version: null,
  }, NOW);
  const r = readGates(body);
  eq(r.voice, null, 'not applicable is not a voice');
  ok(!gatesWritable(r), 'so nothing can be written from it');
});

test('no body at all answers plainly and never throws', () => {
  const r = readGates(undefined);
  eq(r.brand.length, 0, 'no brand checks');
  eq(r.fixed.length, 2, 'the fixed two still stand');
  ok(r.whatProduces.length > 0, 'and it still says what makes a set');
});

test('whatProducesGates covers all four states', () => {
  ok(/Decide those two/i.test(whatProducesGates(null, null)), 'neither');
  ok(/Decide the voice/i.test(whatProducesGates(null, 'p')), 'positioning only');
  ok(/Decide the positioning/i.test(whatProducesGates('v', null)), 'voice only');
  ok(/can be written now/i.test(whatProducesGates('v', 'p')), 'both');
});

// ── §8 Brand kit ─────────────────────────────────────────────────────────────

suite('spec 34 §8 — Brand kit, the same rhythm');

test('the purpose line says what it is and who it is for', () => {
  ok(/colours/i.test(BRAND_KIT_PURPOSE) && /type/i.test(BRAND_KIT_PURPOSE) && /logo/i.test(BRAND_KIT_PURPOSE),
    'colours, type and logo');
});

test('the counts come from the arrays', () => {
  eq(brandKitCounts({ colors: [1, 2, 3], fonts: [1], logos: [] }), { colors: 3, fonts: 1, logos: 0 }, 'counted');
  eq(brandKitCounts(undefined), { colors: 0, fonts: 0, logos: 0 }, 'nothing stored is nothing counted');
  eq(brandKitCounts({}), { colors: 0, fonts: 0, logos: 0 }, 'missing arrays are zero, not a throw');
});

test('the summary reads as a sentence at every size', () => {
  eq(brandKitSummary({ colors: 0, fonts: 0, logos: 0 }), 'Nothing in the kit yet.', 'empty');
  eq(brandKitSummary({ colors: 1, fonts: 0, logos: 0 }), '1 colour.', 'one colour, singular');
  eq(brandKitSummary({ colors: 4, fonts: 2, logos: 0 }), '4 colours and 2 fonts.', 'two parts');
  eq(brandKitSummary({ colors: 4, fonts: 2, logos: 1 }), '4 colours, 2 fonts and 1 logo.', 'three parts');
});

test('an empty section says what to put there, and never scolds', () => {
  for (const s of ['colors', 'fonts', 'logos'] as const) {
    const line = brandKitEmpty(s);
    ok(line.length > 0, `${s} has a line`);
    ok(!/must|required|missing|error/i.test(line), `${s} does not scold`);
  }
});
