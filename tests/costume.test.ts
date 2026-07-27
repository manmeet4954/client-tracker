// Spec 24 §15 — the nineteen acceptance tests.
//
// Every one of them asks a question the spec asks in words. Nothing here calls a
// model: the packet assembler, the five brief checks, the format merge and the
// resolve guards are all pure functions, and the one live-call path is exercised
// behind an injected stub — exactly as spec 23 does it.

import { suite, test, ok, eq, throws } from './harness.ts';
import {
  FULL, NOW, PROFILE, allActive, bodyWithOnePiece, confirm, costumeBody, rowsFrom,
  withCarouselOverride,
} from './costumeFixtures.ts';
import { putEntry, readPath, type ProfileBody } from '../lib/tree/body.ts';
import { validateRegistries } from '../lib/tree/validate.ts';
import { effectiveState, platformSwitchId, validateSwitchConfig } from '../lib/tree/switches.ts';
import type { Piece, RightsRecord } from '../lib/tree/objects.ts';

import { amendSeed, writeSeed, PIECE_PATH } from '../lib/engine/seeds.ts';
import {
  ANGLES, AUDIENCE_STAGES, HOOK_TYPES, OBJECTIVES, PRODUCT_INTENSITIES,
  ctaOptions, dimensionSpread, enumerateVariants, formatOptions, formatSelectionKey,
  isFreeText, lengthOptions, mixLine, pillarJob, pillarOptions, platformOptions,
  prefillFromRecommendation, proofGaps, proofOptions, seedSuggestions, variantCount,
  voiceOptions, type Selection,
} from '../lib/engine/costume.ts';
import {
  UNIVERSAL_FORMAT_RULES, describeMergedRule, forbiddenBy, resolveFormatRule, ruleHeadline,
} from '../lib/engine/formats.ts';
import {
  assertResolved, birthOf, completeLegacyCostume, findPiece, formatsForPlatform,
  offerComparison, readPieces, refusedCostumeWrites, resolvePiece, resolveVariants,
  writeComparison, COMPARISON_PATH, CostumeRefused,
} from '../lib/engine/resolve.ts';
import { attachMaterial, materialsOf, refusedMaterialWrites } from '../lib/engine/materials.ts';
import { assemblePacket } from '../lib/engine/packet.ts';

// ── 1. One value per dimension (S4, S17) ────────────────────────────────────

suite('spec 24 §15.1 — one value per dimension');

test('1. a costume carrying two of anything is refused, with the dimension named', () => {
  const body = costumeBody();
  const base = rowsFrom(body, FULL)[0].costume;

  for (const dimension of [
    'platform', 'format', 'objective', 'audience_stage', 'angle', 'hook_type', 'cta',
  ] as const) {
    const doubled = { ...base, [dimension]: [String(base[dimension]), 'a second one'] };
    throws(() => assertResolved(doubled), `"${dimension}" carries 2 values`,
      `two ${dimension} values are refused, and it says which dimension`);
  }

  // Proof as a set is accepted, and is the only such case (§5.3).
  const twoProof = { ...base, proof: ['proof-numbers', 'proof-linkedin-only'] };
  eq(assertResolved(twoProof).proof, ['proof-numbers', 'proof-linkedin-only'],
    'two proof items ride on one piece');

  // And the same refusal stands at the write door, not only in the function.
  const after = putEntry(body, PIECE_PATH, {
    id: 'piece-two-platforms', type: 'piece',
    data: {
      seed_id: 'seed-salary', title: 'x', stage: 'build', batch_id: 'b1',
      costume: { ...base, platform: ['Instagram', 'LinkedIn'] },
    },
  }, { writer: 'owner', now: NOW });
  const refused = refusedCostumeWrites(body, after);
  ok(refused.some(r => r.reason.includes('"platform"')), 'the write door names the dimension too');
});

test('1b. a piece with a batch id that is not fully resolved is refused at the door', () => {
  const body = costumeBody();
  const after = putEntry(body, PIECE_PATH, {
    id: 'piece-half', type: 'piece',
    data: {
      seed_id: 'seed-salary', title: 'half dressed', stage: 'build', batch_id: 'b1',
      costume: { pillar_id: 'p-trust', platform: 'Instagram', format: 'Carousel' },
    },
  }, { writer: 'owner', now: NOW });
  const refused = refusedCostumeWrites(body, after);
  eq(refused.length, 1, 'the engine-born piece is refused');
  ok(refused[0].reason.includes('has no value'), 'and it says what is missing');

  // A LEGACY piece with the same partial costume is untouched: it genuinely
  // carries one, and pretending otherwise would be a lie (§5.5).
  const legacy = putEntry(body, PIECE_PATH, {
    id: 'piece-legacy-new', type: 'piece',
    data: {
      seed_id: null, title: 'an old one', stage: 'idea',
      costume: { pillar_id: 'p-trust', platform: 'Instagram', format: 'Carousel' },
    },
  }, { writer: 'owner', now: NOW });
  eq(refusedCostumeWrites(body, legacy).length, 0, 'a legacy partial costume passes');
});

// ── 2. Multi-select births separate pieces ──────────────────────────────────

suite('spec 24 §15.2 — multi-select births separate pieces');

test('2. two hook types by three angles is six rows, six pieces, one batch', () => {
  const body = costumeBody();
  const selection: Selection = {
    ...FULL,
    hook_type: ['direct claim', 'question'],
    angle: ['contrarian', 'mistake', 'framework'],
  };
  const rows = rowsFrom(body, selection);
  eq(variantCount(rows), 6, 'six rows are enumerated');
  eq(new Set(rows.map(r => r.key)).size, 6, 'and every row is a distinct combination');

  // Cancel: nothing is written, nothing is logged, nothing is spent.
  eq(readPieces(body).filter(p => p.piece.batch_id).length, 0, 'enumerating wrote nothing');

  const result = resolveVariants({
    body, seed_id: 'seed-salary', batch_id: 'batch-1', rows: confirm(rows),
    now: NOW, by: 'owner',
  });
  eq(result.piece_ids.length, 6, 'confirming writes six pieces');
  const written = readPieces(result.body).filter(p => p.piece.batch_id === 'batch-1');
  eq(written.length, 6, 'six of them, all in the batch');
  eq(new Set(written.map(p => p.piece.id)).size, 6, 'each with a distinct id');
  eq(new Set(written.map(p => p.piece.seed_id)).size, 1, 'all pointing at one seed');
  eq(written[0].piece.seed_id, 'seed-salary', 'the seed they were dressed from');
  eq(written.every(p => p.piece.stage === 'build'), true, 'and all at stage build');
});

test('2b. unchecking two rows writes four', () => {
  const body = costumeBody();
  const rows = rowsFrom(body, { ...FULL, angle: ['contrarian', 'mistake', 'framework'], hook_type: ['direct claim', 'question'] });
  const kept = confirm(rows).slice(0, 4);
  const result = resolveVariants({
    body, seed_id: 'seed-salary', batch_id: 'batch-2', rows: kept, now: NOW, by: 'owner',
  });
  eq(result.piece_ids.length, 4, 'four rows checked, four pieces written');
});

test('2c. a batch with nothing checked writes nothing, and says so', () => {
  const body = costumeBody();
  throws(() => resolveVariants({
    body, seed_id: 'seed-salary', batch_id: 'batch-3', rows: [], now: NOW, by: 'owner',
  }), 'Nothing is checked', 'an empty confirmation is refused in plain words');
});

// ── 3. Only locked seeds mother pieces ──────────────────────────────────────

suite('spec 24 §15.3 — only locked seeds mother pieces');

test('3. resolving on a validated seed is refused at the write door', () => {
  let body = costumeBody();
  body = writeSeed(body, {
    id: 'seed-open', name: 'not locked yet', raw_thought: 'a thought',
    fields: {
      core_message: 'a', reframe: 'b', audience_value: 'c',
      prohibited_interpretation: 'd', possible_pillars: ['p-trust'],
    },
  }, NOW);
  body = amendSeed(body, 'seed-open', { status: 'validated' }, { at: NOW, by: 'owner', note: 'stands up' });

  const rows = rowsFrom(body, FULL);
  throws(() => resolveVariants({
    body, seed_id: 'seed-open', batch_id: 'b', rows: confirm(rows), now: NOW, by: 'owner',
  }), 'only a locked seed', 'the whole batch refuses, and it says why');
});

test('3b. removing the guard makes the write succeed — the guard is what stops it', () => {
  let body = costumeBody();
  body = amendSeed(body, 'seed-salary', { status: 'validated' }, { at: NOW, by: 'owner', note: 'unlocked' });
  const rows = rowsFrom(body, FULL);

  // With the guard, refused.
  throws(() => resolveVariants({
    body, seed_id: 'seed-salary', batch_id: 'b', rows: confirm(rows), now: NOW, by: 'owner',
  }), 'only a locked seed', 'with the guard in place it is refused');

  // Without it — writing the same piece straight to the path — nothing else in
  // the stack refuses it, which is what proves the guard is doing the work.
  const bypassed = putEntry(body, PIECE_PATH, {
    id: 'piece-bypass', type: 'piece',
    data: { seed_id: 'seed-salary', title: 'x', stage: 'build', costume: rows[0].costume },
  }, { writer: 'owner', now: NOW });
  eq(readPath(bypassed, PIECE_PATH).some(e => e.id === 'piece-bypass'), true,
    'with the lock check gone, the write lands');
});

// ── 4. The birth snapshot ───────────────────────────────────────────────────

suite('spec 24 §15.4 — the birth snapshot is taken, and never overwritten');

test('4. a resolve writes all five fields, from the profile as it stands now', () => {
  const body = costumeBody();
  const rows = rowsFrom(body, { ...FULL, pillar_id: ['p-convert'], objective: ['conversion'] });
  const result = resolveVariants({
    body, seed_id: 'seed-salary', batch_id: 'batch-b', rows: confirm(rows), now: NOW, by: 'owner',
  });
  const born = findPiece(result.body, 'piece-1')!.piece.birth!;
  eq(born.at, NOW, 'when it was born');
  eq(born.costume.platform, 'Instagram', 'the resolved costume');
  eq(born.costume.proof, ['proof-numbers'], 'including the proof set');
  eq(born.pillar_job, 'convert', 'the pillar job, read now and not looked up later');
  eq(born.goal_mapping, ['goal-signups'], 'the goals whose S16 declaration names this job');
  eq(born.gate_version, 1, 'the locked gate version');
  eq(born.strategy_version, 1, 'and the strategy version');
});

test('4b. a goal with no S16 declaration is never mapped, and an empty mapping is allowed', () => {
  let body = costumeBody();
  // Strip the one declared goal: nothing is left to match, and nothing is invented.
  body = {
    ...body,
    paths: {
      ...body.paths,
      'context/content-strategy/goals': body.paths['context/content-strategy/goals']
        .filter(e => e.id !== 'goal-signups'),
    },
  };
  const rows = rowsFrom(body, { ...FULL, pillar_id: ['p-convert'] });
  const result = resolveVariants({
    body, seed_id: 'seed-salary', batch_id: 'b', rows: confirm(rows), now: NOW, by: 'owner',
  });
  eq(findPiece(result.body, 'piece-1')!.piece.birth!.goal_mapping, [],
    'an empty mapping is honest, and the undeclared goal is not guessed into it');
});

test('4c. any second write to birth throws, and an amendment leaves it byte-identical', () => {
  const body = costumeBody();
  const rows = rowsFrom(body, FULL);
  const { body: after } = resolveVariants({
    body, seed_id: 'seed-salary', batch_id: 'b', rows: confirm(rows), now: NOW, by: 'owner',
  });
  const entry = readPath(after, PIECE_PATH).find(e => e.id === 'piece-1')!;
  const birthJson = JSON.stringify((entry.data as unknown as Piece).birth);

  // The path itself refuses the overwrite.
  throws(() => putEntry(after, PIECE_PATH, {
    id: 'piece-1', type: 'piece',
    data: { ...(entry.data as Record<string, unknown>), birth: { at: 'later' } },
  }, { writer: 'owner', now: NOW }), 'append-only', 'the append-only path refuses a rewrite');

  // And a rewrite smuggled through a whole-body save is caught at the door.
  const smuggled: ProfileBody = {
    ...after,
    paths: {
      ...after.paths,
      [PIECE_PATH]: after.paths[PIECE_PATH].map(e => (e.id === 'piece-1'
        ? { ...e, data: { ...(e.data as Record<string, unknown>), birth: { at: 'rewritten' } } }
        : e)),
    },
  };
  const refused = refusedCostumeWrites(after, smuggled);
  ok(refused.some(r => r.reason.includes('never rewritten')), 'the write door refuses it too');

  // A dated amendment correcting the costume leaves the birth record untouched.
  const amended = completeLegacyCostume(after, {
    piece_id: 'piece-1', costume: { angle: 'mistake' }, now: '2026-08-01T10:00:00.000Z', by: 'owner',
  });
  const now = findPiece(amended, 'piece-1')!;
  eq(now.piece.costume.angle, 'mistake', 'the current costume moved');
  eq(now.piece.birth!.costume.angle, 'contrarian', 'the birth costume did not');
  eq(JSON.stringify(birthOf(readPath(amended, PIECE_PATH).find(e => e.id === 'piece-1')!)), birthJson,
    'and the birth record is byte-identical to what was first written');
});

// ── 5. The growth test (law 3) ──────────────────────────────────────────────

suite('spec 24 §15.5 — a fourth pillar, a new CTA, a second voice, a new proof item');

test('5. all four appear in their pickers and in the packet, with no code change', () => {
  let body = costumeBody();
  const config = allActive();

  eq(pillarOptions(body, config).length, 3, 'three pillars to start');
  eq(ctaOptions(body, config).length, 2, 'two CTAs');
  eq(voiceOptions(body, config).length, 1, 'one voice, which the surface resolves automatically');
  eq(proofOptions(body, config).length, 2, 'two proof items');

  body = putEntry(body, 'context/content-strategy/pillars/proof-it-works', {
    id: 'p-proof', type: 'pillar', data: { name: 'Proof it works' },
  }, { writer: 'owner', now: NOW });
  body = putEntry(body, 'context/content-strategy/ctas', {
    id: 'cta-dm', type: 'strategy_parameter', data: { name: 'DM me', strategy_version: 1 },
  }, { writer: 'owner', now: NOW });
  body = putEntry(body, 'context/content-strategy/voice', {
    id: 'voice-sharp', type: 'strategy_parameter', data: { name: 'Sharp', strategy_version: 1 },
  }, { writer: 'owner', now: NOW });
  body = putEntry(body, 'context/content-strategy/proof-library', {
    id: 'proof-screens', type: 'strategy_parameter', data: { name: 'Offer letter screenshots', kind: 'screenshot' },
  }, { writer: 'owner', now: NOW });

  eq(pillarOptions(body, config).length, 4, 'the fourth pillar is in the picker immediately');
  eq(ctaOptions(body, config).length, 3, 'and the new CTA');
  eq(voiceOptions(body, config).length, 2, 'and the second voice register, which makes it a real choice');
  eq(proofOptions(body, config).length, 3, 'and the new proof item');
  ok(pillarOptions(body, config).some(p => p.label === 'Proof it works'), 'by name, never blank');

  const packet = assemblePacket({
    profile_id: PROFILE, body, config, now: NOW, packet_id: 'pkt',
  });
  ok(packet.text.includes('Proof it works'), 'the packet carries the new pillar');
  ok(packet.text.includes('Offer letter screenshots'), 'and the new proof item');
});

// ── 6. Format lives inside its platform, and the cascade reaches the costume ─

suite('spec 24 §15.6 — formats live inside platforms, and the cascade reaches here');

test('6. a format that is not in the resolved platform folder is refused', () => {
  const body = costumeBody();
  eq(formatsForPlatform(body, 'Instagram'), ['Carousel', 'Reel'], 'Instagram offers two formats');
  eq(formatsForPlatform(body, 'LinkedIn'), ['Static'], 'LinkedIn offers one');

  throws(() => assertResolved(
    { ...rowsFrom(body, FULL)[0].costume, format: 'Static' },
    { formatsForPlatform: p => formatsForPlatform(body, p) },
  ), 'is not a format Instagram offers', 'a LinkedIn format on an Instagram piece is refused');

  // And the picker cannot offer it in the first place.
  const igFormats = formatOptions(body, allActive(), 'Instagram').map(f => f.id);
  eq(igFormats.includes('Static'), false, 'the picker never shows it under the wrong platform');
});

test('6b. LinkedIn hidden: no platform, no format, no grid row, no packet mention', () => {
  const body = costumeBody();
  const hidden = allActive({ [platformSwitchId('LinkedIn')]: 'hidden' });

  eq(platformOptions(body, hidden).map(p => p.id), ['Instagram'], 'LinkedIn is not in the platform picker');
  eq(formatOptions(body, hidden, 'LinkedIn').length, 0, 'and none of its formats exist');

  const rows = enumerateVariants(body, hidden, {
    ...FULL, platform: ['Instagram', 'LinkedIn'],
    format: [formatSelectionKey('Instagram', 'Carousel'), formatSelectionKey('LinkedIn', 'Static')],
  });
  eq(rows.filter(r => r.costume.platform === 'LinkedIn' && r.costume.format).length, 0,
    'no LinkedIn row is enumerated with a format');

  const packet = assemblePacket({ profile_id: PROFILE, body, config: hidden, now: NOW, packet_id: 'p' });
  ok(!packet.text.toLowerCase().includes('linkedin'), 'and no LinkedIn name enters the packet, in any casing');
});

test('6c. at history it still does not enter, and every past LinkedIn piece stays readable', () => {
  const body = costumeBody();
  const history = allActive({ [platformSwitchId('LinkedIn')]: 'history' });
  eq(platformOptions(body, history).map(p => p.id), ['Instagram'], 'a retired platform is not offered');
  const packet = assemblePacket({ profile_id: PROFILE, body, config: history, now: NOW, packet_id: 'p' });
  ok(!packet.text.toLowerCase().includes('linkedin'), 'nor does it shape anything');

  const past = readPieces(body).filter(p => p.piece.costume?.platform === 'LinkedIn');
  ok(past.length > 0, 'and every past LinkedIn piece is still there, readable (S9)');
});

test('6d. the reverse trace with Instagram behaves identically', () => {
  const body = costumeBody();
  const hidden = allActive({ [platformSwitchId('Instagram')]: 'hidden' });
  eq(platformOptions(body, hidden).map(p => p.id), ['LinkedIn'], 'Instagram is gone instead');
  eq(formatOptions(body, hidden, 'Instagram').length, 0, 'with its formats');
  const packet = assemblePacket({ profile_id: PROFILE, body, config: hidden, now: NOW, packet_id: 'p' });
  ok(!packet.text.includes('Instagram'), 'and it shapes nothing');
  ok(readPieces(body).some(p => p.piece.costume?.platform === 'Instagram'), 'past Instagram pieces stay');
});

// ── 7. Override beats universal, field by field ─────────────────────────────

suite('spec 24 §15.7 — override beats universal, FIELD BY FIELD');

test('7. the override wins on two fields and every other field is still universal', () => {
  const plain = costumeBody();
  const universal = resolveFormatRule(plain, 'Instagram', 'Carousel');
  eq(universal.source, 'universal', 'with no override, the universal rule stands whole');
  eq(universal.overridden_fields, [], 'and nothing is marked overridden');

  const overridden = resolveFormatRule(withCarouselOverride(plain), 'Instagram', 'Carousel');
  eq(overridden.overridden_fields, ['length_bands', 'never'], 'exactly the two fields the patch supplied');
  eq(overridden.rule!.length_bands, ['5 slides', '6 slides', '7 slides'], 'shorter, bite-size slides');
  eq(overridden.rule!.structure, universal.rule!.structure, 'the universal structure survives whole');
  eq(overridden.rule!.carries_depth, universal.rule!.carries_depth, 'and so does where the depth lives');
  eq(overridden.rule!.format_gate_criteria, universal.rule!.format_gate_criteria,
    'and the format gate criteria spec 25 will read');

  // Removing the override restores the universal rule whole.
  eq(resolveFormatRule(plain, 'Instagram', 'Carousel').rule!.length_bands,
    universal.rule!.length_bands, 'remove it and the universal rule is back, entire');
});

test('7b. a format with no rule at either level reports "no rule" and invents nothing', () => {
  const body = costumeBody();
  const none = resolveFormatRule(body, 'LinkedIn', 'Static');
  eq(none.rule, null, 'no rule exists for it');
  eq(none.source, 'none', 'and it says so');
  eq(ruleHeadline(none), 'No rule for this format yet', 'the grid says it plainly');
  ok(describeMergedRule(none)[0].includes('do not invent one'),
    'and the packet tells the model not to invent one');
});

test('7c. the merged rule always reports where each field came from', () => {
  const lines = describeMergedRule(resolveFormatRule(withCarouselOverride(costumeBody()), 'Instagram', 'Carousel'));
  ok(lines.some(l => l.startsWith('Length options (this profile)')), 'the overridden field is marked as hers');
  ok(lines.some(l => l.startsWith('Structure (universal)')), 'and the inherited field as universal');
});

test('7d. the universal library holds PLAN §5.1 own drafts, and nothing invented beside them', () => {
  eq(UNIVERSAL_FORMAT_RULES.map(r => r.id), ['carousel', 'reel', 'linkedin:post', 'newsletter'],
    'the four the plan drafted, and only those');
  eq(resolveFormatRule(undefined, 'LinkedIn', 'post').rule!.id, 'linkedin:post',
    'platform-specific ids win over the bare format key');
});

// ── 8. A rule-forbidden combination is refused with its rule ────────────────

suite('spec 24 §15.8 — shown and explained, never un-rendered');

test('8. carousel plus conversion renders refused, with the rule quoted', () => {
  const body = withCarouselOverride(costumeBody());
  const rows = rowsFrom(body, { ...FULL, objective: ['conversion'], length: ['6 slides'] });
  eq(rows.length, 1, 'the row is still enumerated: a rule is not a switch');
  eq(rows[0].forbidden.length, 1, 'and it renders refused');
  eq(rows[0].forbidden[0].says, 'never use carousel as the convert format', 'with the rule quoted');

  // Confirming it without a reason is refused.
  throws(() => resolveVariants({
    body, seed_id: 'seed-salary', batch_id: 'b', rows: confirm(rows), now: NOW, by: 'owner',
  }), 'never use carousel as the convert format', 'passing it silently is refused');

  // With a reason, it writes, and the birth snapshot records that it happened.
  const result = resolveVariants({
    body, seed_id: 'seed-salary', batch_id: 'b', rows: confirm(rows, 'launch week, one exception'),
    now: NOW, by: 'owner',
  });
  const born = findPiece(result.body, 'piece-1')!.piece.birth!;
  eq(born.rule_overrides!.length, 1, 'the override is on the record analysis reads');
  eq(born.rule_overrides![0].reason, 'launch week, one exception', 'with her reason');
  eq(born.rule_overrides![0].by, 'owner', 'and who did it');
});

test('8b. a prose never-clause forbids nothing mechanically, and still travels', () => {
  const body = costumeBody();
  const rule = resolveFormatRule(body, 'Instagram', 'Carousel');
  eq(forbiddenBy(rule, { objective: 'conversion' }).length, 0,
    'the universal prose rule removes no square from her grid');
  ok(describeMergedRule(rule).some(l => l.includes('one point on a slide')),
    'but she reads it, because it travels with the rule');
});

// ── 15. Rights at attachment (S21) ──────────────────────────────────────────

suite('spec 24 §15.15 — rights at attachment');


function asset(id: string, rights: Partial<RightsRecord>): (b: ProfileBody) => ProfileBody {
  return b => putEntry(b, 'work-log/assets/sets', {
    id, type: 'asset_set',
    data: {
      name: id,
      rights: {
        ownership: 'krnl', consent: 'given', permitted_platforms: [], permitted_uses: [],
        expiry: null, attribution_required: null, subject_releases: [], restriction: 'none',
        ...rights,
      },
    },
  }, { writer: 'owner', now: NOW });
}

test('15. a restricted asset is refused, at the function and at the write door', () => {
  const { body: base, piece_id } = bodyWithOnePiece();
  const body = asset('a-blocked', { restriction: 'blocked' })(base);

  throws(() => attachMaterial(body, { piece_id, kind: 'asset', id: 'a-blocked', now: NOW, by: 'owner' }),
    'someone saying no', 'a restriction is an instruction to obey, so it does not attach');

  // And a save that smuggles it in anyway is refused at the door.
  const smuggled: ProfileBody = {
    ...body,
    paths: {
      ...body.paths,
      [PIECE_PATH]: body.paths[PIECE_PATH].map(e => (e.id === piece_id
        ? {
          ...e,
          amendments: [{
            at: NOW, by: 'owner', note: 'sneaked',
            changed: {
              materials: [{
                kind: 'asset', id: 'a-blocked', path: 'work-log/assets/sets',
                attached_at: NOW, by: 'owner', rights_state: 'cleared',
              }],
            },
          }],
        }
        : e)),
    },
  };
  const refused = refusedMaterialWrites(body, smuggled);
  eq(refused.length, 1, 'the write door refuses it');
  ok(refused[0].reason.includes('not a gap to fill'), 'and says why a restriction is different');
});

test('15b. an asset that does not clear ATTACHES, blocked, with the missing right named', () => {
  const { body: base, piece_id } = bodyWithOnePiece();
  const body = asset('a-noconsent', { consent: 'unknown' })(base);

  const result = attachMaterial(body, { piece_id, kind: 'asset', id: 'a-noconsent', now: NOW, by: 'owner' });
  eq(result.ref.rights_state, 'blocked', 'it attaches, carrying the block');
  ok(result.ref.rights_note!.includes('No consent'), 'with the specific missing right, in words');
  eq(materialsOf(result.body, piece_id).blocked.length, 1, 'and the piece carries a visible rights block');
  eq(findPiece(result.body, piece_id)!.piece.stage, 'build',
    'nothing about publication is decided here: the piece is still at build');
});

test('15c. an asset that clears attaches clean, and detaching touches nothing at the source', () => {
  const { body: base, piece_id } = bodyWithOnePiece();
  const body = asset('a-ok', { permitted_platforms: ['Instagram'] })(base);
  const result = attachMaterial(body, { piece_id, kind: 'asset', id: 'a-ok', now: NOW, by: 'owner' });
  eq(result.ref.rights_state, 'cleared', 'it clears');
  eq(result.message, '', 'and nothing else happens');
  eq(readPath(result.body, 'work-log/assets/sets').find(e => e.id === 'a-ok')!.data,
    readPath(body, 'work-log/assets/sets').find(e => e.id === 'a-ok')!.data,
    'the source asset is untouched, because this is a reference and not a copy');
});

test('15d. proof carries rights too, and behaves identically per resolved platform', () => {
  const ig = bodyWithOnePiece();
  const onInstagram = attachMaterial(ig.body, {
    piece_id: ig.piece_id, kind: 'proof', id: 'proof-linkedin-only', now: NOW, by: 'owner',
  });
  eq(onInstagram.ref.rights_state, 'blocked', 'a LinkedIn-only case study does not clear an Instagram piece');
  ok(onInstagram.ref.rights_note!.includes('LinkedIn'), 'and it names where it IS permitted');

  const li = bodyWithOnePiece({
    platform: ['LinkedIn'], format: [formatSelectionKey('LinkedIn', 'Static')], length: ['one image'],
  });
  const onLinkedIn = attachMaterial(li.body, {
    piece_id: li.piece_id, kind: 'proof', id: 'proof-linkedin-only', now: NOW, by: 'owner',
  });
  eq(onLinkedIn.ref.rights_state, 'cleared', 'and the same item clears on the platform it was permitted for');
});

test('15e. attaching to a piece with no resolved platform is refused, not guessed', () => {
  const body = costumeBody();
  const legacy = readPieces(body).find(p => !p.piece.costume?.platform);
  if (legacy) {
    throws(() => attachMaterial(body, {
      piece_id: legacy.piece.id, kind: 'proof', id: 'proof-numbers', now: NOW, by: 'owner',
    }), 'no resolved platform', 'there is nothing to check the rights against, and it says so');
  } else {
    ok(true, 'every migrated piece carries a platform on this fixture');
  }
});

// ── 16. The matched comparison is born honest (S5) ──────────────────────────

suite('spec 24 §15.16 — the matched comparison, born at the only honest moment');

test('16. exactly one changed dimension offers a comparison, taken from the costumes', () => {
  const body = costumeBody();
  const rows = rowsFrom(body, { ...FULL, hook_type: ['direct claim', 'question', 'curiosity'] });
  const result = resolveVariants({
    body, seed_id: 'seed-salary', batch_id: 'b', rows: confirm(rows), now: NOW, by: 'owner',
  });
  eq(result.spread.changed, ['hook_type'], 'one dimension changes, read off the costumes');

  const offer = offerComparison({
    piece_ids: result.piece_ids,
    costumes: result.piece_ids.map(id => findPiece(result.body, id)!.piece.costume),
    compareActive: true,
  });
  eq(offer.offered, true, 'the offer appears');
  eq(offer.changed_variable, 'hook_type', 'naming the changed variable');
  ok(offer.held_variables!.includes('angle'), 'and the held ones');

  const withComparison = writeComparison(result.body, {
    id: 'cmp-1', hypothesis: 'a direct claim beats a question on reach', offer, now: NOW,
  });
  // By id, not by position: the migration already wrote one from the legacy
  // experiment flag, and it is nobody's business here.
  const stored = readPath(withComparison, COMPARISON_PATH)
    .find(e => e.id === 'cmp-1')!.data as Record<string, unknown>;
  eq(stored.changed_variable, 'hook_type', 'the record carries it, never inferred');
  eq((stored.piece_ids as string[]).length, 3, 'with the pieces it compares');
  eq(stored.state, 'open', 'and it starts open — the verdict is the Analysis family\'s');
});

test('16b. two changed dimensions offer nothing, and say why', () => {
  const body = costumeBody();
  const rows = rowsFrom(body, { ...FULL, hook_type: ['direct claim', 'question'], angle: ['contrarian', 'mistake'] });
  const result = resolveVariants({
    body, seed_id: 'seed-salary', batch_id: 'b', rows: confirm(rows), now: NOW, by: 'owner',
  });
  const offer = offerComparison({
    piece_ids: result.piece_ids,
    costumes: result.piece_ids.map(id => findPiece(result.body, id)!.piece.costume),
    compareActive: true,
  });
  eq(offer.offered, false, 'no offer');
  ok(offer.reason!.includes('not a controlled test'), 'and calling it one would be the causation claim S5 forbids');
  throws(() => writeComparison(result.body, { id: 'c', hypothesis: 'x', offer, now: NOW }),
    'not a controlled comparison', 'and it cannot be written anyway');
});

test('16c. a batch differing only in proof offers nothing', () => {
  const body = costumeBody();
  const a = rowsFrom(body, FULL)[0];
  const b = rowsFrom(body, { ...FULL, proof: ['proof-numbers', 'proof-linkedin-only'] })[0];
  eq(dimensionSpread([a.costume, b.costume]).changed, [],
    'proof is not a controlled comparison variable (§5.3)');
  const offer = offerComparison({ piece_ids: ['p1', 'p2'], costumes: [a.costume, b.costume], compareActive: true });
  eq(offer.offered, false, 'so nothing is offered');
  ok(offer.reason!.includes('nothing to compare'), 'and it says so plainly');
});

test('16d. with tracking off the offer is not rendered at all', () => {
  const body = costumeBody();
  const rows = rowsFrom(body, { ...FULL, hook_type: ['direct claim', 'question'] });
  const result = resolveVariants({
    body, seed_id: 'seed-salary', batch_id: 'b', rows: confirm(rows), now: NOW, by: 'owner',
  });
  const off = allActive({ 'analysis.tracking': 'hidden' });
  eq(effectiveState('analysis.compare', off), 'hidden', 'compare cannot outlive tracking');
  const offer = offerComparison({
    piece_ids: result.piece_ids,
    costumes: result.piece_ids.map(id => findPiece(result.body, id)!.piece.costume),
    compareActive: effectiveState('analysis.compare', off) === 'active',
  });
  eq(offer.offered, false, 'no offer on an account nobody is collecting from');
  ok(offer.reason!.includes('tracking'), 'and the honest reason is named');
});

test('16e. no hypothesis, no comparison — the batch is just a batch, which is fine', () => {
  const body = costumeBody();
  const rows = rowsFrom(body, { ...FULL, hook_type: ['direct claim', 'question'] });
  const result = resolveVariants({
    body, seed_id: 'seed-salary', batch_id: 'b', rows: confirm(rows), now: NOW, by: 'owner',
  });
  const offer = offerComparison({
    piece_ids: result.piece_ids,
    costumes: result.piece_ids.map(id => findPiece(result.body, id)!.piece.costume),
    compareActive: true,
  });
  throws(() => writeComparison(result.body, { id: 'c', hypothesis: '   ', offer, now: NOW }),
    'one-line hypothesis', 'a comparison with no hypothesis is refused');
});

// ── 17. The append-only test ────────────────────────────────────────────────

suite('spec 24 §15.17 — twenty amendments, one untouched birth record');

test('17. they resolve in order, and the birth record is byte-identical', () => {
  const body = costumeBody();
  const rows = rowsFrom(body, FULL);
  const { body: after } = resolveVariants({
    body, seed_id: 'seed-salary', batch_id: 'b', rows: confirm(rows), now: NOW, by: 'owner',
  });
  const entry0 = readPath(after, PIECE_PATH).find(e => e.id === 'piece-1')!;
  const birth = JSON.stringify(entry0.data);

  let grown = after;
  for (let i = 1; i <= 20; i++) {
    grown = completeLegacyCostume(grown, {
      piece_id: 'piece-1', costume: { hook_type: `hook ${i}` },
      now: `2026-08-${String(i).padStart(2, '0')}T10:00:00.000Z`, by: 'owner',
    });
  }
  const record = findPiece(grown, 'piece-1')!;
  eq(record.entry.amendments!.length, 20, 'twenty amendments are all kept');
  eq(record.piece.costume.hook_type, 'hook 20', 'the last one wins, in order');
  eq(record.piece.birth!.costume.hook_type, 'direct claim', 'and the birth costume never moved');
  eq(JSON.stringify(record.entry.data), birth, 'the birth record is byte-identical to what was written');
  eq(resolvePiece(record.entry).costume.hook_type, 'hook 20', 'one read function gives the current state');
});

// ── 18. Legacy pieces ───────────────────────────────────────────────────────

suite('spec 24 §15.18 — legacy pieces are completed, never rewritten');

test('18. completing a reconstructed piece writes an amendment and leaves birth alone', () => {
  const body = costumeBody();
  const posted = readPieces(body).find(p => p.piece.stage === 'posted' && p.piece.birth)!;
  const before = JSON.stringify(posted.entry.data);

  const after = completeLegacyCostume(body, {
    piece_id: posted.piece.id,
    costume: { objective: 'trust', angle: 'contrarian', hook_type: 'direct claim' },
    now: '2026-08-02T10:00:00.000Z', by: 'owner',
  });
  const record = findPiece(after, posted.piece.id)!;
  eq(record.entry.amendments!.length, 1, 'it lands as one amendment');
  eq(record.piece.costume.objective, 'trust', 'the current costume is completed');
  eq(JSON.stringify(record.entry.data), before, 'and the reconstructed birth snapshot is byte-identical');
  ok(!record.piece.birth!.taken_late, 'a reconstructed snapshot is not relabelled late');
});

test('18b. a migrated piece at build with no birth gets one, carrying taken_late', () => {
  // Exactly what the migration writes for an old "writing" card (§14.1): a
  // partial costume, and `birth: null`, because that card never had a birth.
  let body = costumeBody();
  body = putEntry(body, PIECE_PATH, {
    id: 'piece-old-writing', type: 'piece',
    data: {
      seed_id: null, title: 'half written, from before', stage: 'build', birth: null,
      costume: { pillar_id: 'p-trust', platform: 'Instagram', format: 'Carousel' },
    },
  }, { writer: 'owner', now: NOW });

  const atBuild = readPieces(body).find(p => p.piece.stage === 'build' && !p.piece.birth);
  ok(!!atBuild, 'an old card sits at build with no birth record');

  const after = completeLegacyCostume(body, {
    piece_id: atBuild!.piece.id,
    costume: {
      objective: 'trust', audience_stage: 'problem-aware', angle: 'contrarian',
      hook_type: 'direct claim', length: '8 to 10 slides', product_intensity: 'light mention',
      cta: 'cta-signup', voice: 'voice-plain',
    },
    now: '2026-08-03T10:00:00.000Z', by: 'owner',
  });
  const born = findPiece(after, atBuild!.piece.id)!.piece.birth!;
  ok(!!born, 'it gets a birth record, because it is entering build state now');
  ok(!!born.taken_late, 'and it is marked late');
  ok(born.taken_late!.reason.includes('not when the piece was made'),
    'saying so in words, so analysis can tell a late snapshot from a real one');
});

test('18c. no legacy piece is re-parented to a seed automatically', () => {
  const body = costumeBody();
  const orphans = readPieces(body).filter(p => p.piece.seed_id == null);
  ok(orphans.length > 0, 'some legacy pieces have no seed at all');
  const after = completeLegacyCostume(body, {
    piece_id: orphans[0].piece.id, costume: { objective: 'reach' }, now: NOW, by: 'owner',
  });
  eq(findPiece(after, orphans[0].piece.id)!.piece.seed_id, null,
    'completing its costume never guesses which seed an old post belonged to');
});

test('18d. a legacy format absent from its platform folder still renders, and refuses a NEW resolve', () => {
  let body = costumeBody();
  // A legacy piece on a format nobody offers any more.
  body = putEntry(body, PIECE_PATH, {
    id: 'piece-old-poster', type: 'piece',
    data: {
      seed_id: null, title: 'an old poster', stage: 'posted',
      costume: { pillar_id: 'p-ai', platform: 'Instagram', format: 'Poster' },
    },
  }, { writer: 'owner', now: NOW });

  eq(findPiece(body, 'piece-old-poster')!.piece.costume.format, 'Poster', 'it renders normally');
  eq(formatsForPlatform(body, 'Instagram').includes('Poster'), false, 'the folder does not offer it');
  throws(() => assertResolved(
    { ...rowsFrom(body, FULL)[0].costume, format: 'Poster' },
    { formatsForPlatform: p => formatsForPlatform(body, p) },
  ), 'is not a format Instagram offers', 'and a NEW piece on it is refused until the format exists');
});

// ── The surface's hints, and the free-text lane ─────────────────────────────

suite('spec 24 §3.4 and §4.1 — hints never rails, and every list can be escaped');

test('the lists ship FULL, and nothing is trimmed to a recommended subset', () => {
  eq(OBJECTIVES.length, 7, 'all seven objectives');
  eq(AUDIENCE_STAGES.length, 5, 'all five audience stages');
  eq(ANGLES.length, 13, 'all thirteen angles');
  eq(HOOK_TYPES.length, 8, 'all eight hook types');
  eq(PRODUCT_INTENSITIES.length, 5, 'all five product intensities');
});

test('a free-text value resolves like any other, and never joins the universal list', () => {
  eq(isFreeText('angle', 'contrarian'), false, 'a listed value is not free text');
  eq(isFreeText('angle', 'a shape nobody named yet'), true, 'and hers is');
  const body = costumeBody();
  const rows = rowsFrom(body, { ...FULL, angle: ['a shape nobody named yet'] });
  eq(rows[0].costume.angle, 'a shape nobody named yet', 'it enumerates like any other value');
  eq(assertResolved(rows[0].costume).angle, 'a shape nobody named yet', 'and resolves verbatim');
  eq(ANGLES.includes('a shape nobody named yet'), false, 'while the universal list is untouched');
});

test('the seed suggests, the mix informs, and the missing proof is named without stopping her', () => {
  const body = costumeBody();
  const seed = { possible_pillars: ['p-trust', 'p-ai'], possible_angles: ['contrarian', 'mistake'] } as never;
  eq(seedSuggestions(seed).pillars, ['p-trust', 'p-ai'], 'the seed marks the pillars it suggests');

  const line = mixLine(body, 'p-trust', '2026-07');
  ok(line!.includes('target of 35%'), 'the mix line cites the pillar target from the tree, not from code');

  const gaps = proofGaps(body, {
    proof_required: ['41 to 58 signups in a month', 'a hiring manager saying it out loud'],
  } as never);
  eq(gaps.length, 2, 'both required proof items are checked');
  ok(!!gaps[0].found, 'one is in the library');
  eq(gaps[1].found, null, 'the other is missing, and she is told which, and may still proceed');
});

test('length comes from the format rule, and the rule is where the plan put it', () => {
  const plain = costumeBody();
  eq(lengthOptions(resolveFormatRule(plain, 'Instagram', 'Carousel')),
    ['6 to 8 slides', '8 to 10 slides', '10 to 12 slides'], 'the universal bands');
  eq(lengthOptions(resolveFormatRule(withCarouselOverride(plain), 'Instagram', 'Carousel')),
    ['5 slides', '6 slides', '7 slides'], 'and her override replaces them');
  eq(lengthOptions(resolveFormatRule(plain, 'LinkedIn', 'Static')), [],
    'a format with no rule offers no bands, and invents none');
});

test('a revisit proposal pre-fills the surface, and still writes nothing', () => {
  const selection = prefillFromRecommendation({
    pillar_id: 'p-trust', platform: 'Instagram', format: 'Carousel', angle: 'contrarian',
    proof: ['proof-numbers'],
  });
  eq(selection.platform, ['Instagram'], 'the platform is pre-selected');
  eq(selection.format, ['Instagram::Carousel'], 'and the format under its own platform');
  eq(selection.proof, ['proof-numbers'], 'with the proof set');
  eq(selection.length, undefined, 'and nothing it did not carry');
});

test('a row that is missing a dimension says which, and cannot be resolved', () => {
  const body = costumeBody();
  const rows = rowsFrom(body, { platform: ['Instagram'], format: [formatSelectionKey('Instagram', 'Reel')] });
  eq(rows.length, 1, 'it still enumerates: no required field until the resolve step');
  ok(rows[0].missing.includes('cta'), 'and it names what is still missing');
  throws(() => assertResolved(rows[0].costume), 'has no value', 'resolving it is refused');
});

test('pillarJob reads through the pillar own folder, not by id coincidence', () => {
  const body = costumeBody();
  eq(pillarJob(body, 'p-trust'), 'trust', 'the job comes from the pillar folder');
  eq(pillarJob(body, 'p-convert'), 'convert', 'for every pillar');
  eq(pillarJob(body, 'nope'), null, 'and a pillar that is not there has no job');
});

// ── The switch cascade and the lock-time checks (§12) ───────────────────────

suite('spec 24 §12 — the four switches, and what they take with them');

test('creation.costume hidden takes the surface and the brief with it', () => {
  const off = allActive({ 'creation.costume': 'hidden' });
  eq(effectiveState('creation.costume', off), 'hidden', 'the surface is gone');
  eq(effectiveState('creation.brief', off), 'hidden', 'and the brief cannot outlive it');
  eq(effectiveState('creation.board', off), 'active', 'while the board and every piece stay');
});

test('creation.brief hidden alone stops only the model call', () => {
  const off = allActive({ 'creation.brief': 'hidden' });
  eq(effectiveState('creation.costume', off), 'active', 'the whole costume surface still works');
  eq(effectiveState('creation.brief', off), 'hidden', 'and only the spend stops');
});

test('the two lock-time checks bite, and only where they can actually be false', () => {
  const config = allActive();
  eq(validateSwitchConfig({ config, owner_kind: 'hers' }).length, 0,
    'with nothing asserted, nothing is invented');

  const noStrategy = validateSwitchConfig({ config, owner_kind: 'hers', strategyEverLocked: false });
  ok(noStrategy.some(v => v.switch === 'creation.costume'), 'no locked strategy, no costume surface');

  const noGates = validateSwitchConfig({ config, owner_kind: 'hers', gateSetLocked: false });
  ok(noGates.some(v => v.switch === 'creation.brief'), 'no locked gate set, no brief');
  ok(noGates.every(v => v.switch !== 'creation.costume'), 'and the costume surface is untouched by that one');
});

test('the registries still validate with the two new paths and four new switches', () => {
  eq(validateRegistries().length, 0, 'no address, no switch, no fifth door, no orphan');
});
