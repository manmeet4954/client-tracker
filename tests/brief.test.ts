// Spec 24 §15, tests 9 to 14 and 19 — the brief, the handoff, the leak, the race.
//
// Nothing here reaches the network: `runBrief` takes an injected `createMessage`
// exactly as spec 23's extraction does, and every check beside it is pure.

import { suite, test, ok, eq, throws } from './harness.ts';
import {
  FULL, NOW, PROFILE, allActive, bodyWithOnePiece, confirm, costumeBody, rowsFrom,
} from './costumeFixtures.ts';
import { fixtureState } from './fixtures.ts';
import { migrateProfile } from '../lib/tree/migrate.ts';
import { putEntry, readPath, type ProfileBody } from '../lib/tree/body.ts';
import { applyScopes, changedScopes, scopeKey } from '../lib/tree/scopes.ts';
import { filterStateForRole } from '../lib/access.ts';
import type { AppState } from '../types/index.ts';

import { PIECE_PATH } from '../lib/engine/seeds.ts';
import { findPiece, readPieces, resolveVariants } from '../lib/engine/resolve.ts';
import { attachMaterial, materialsOf } from '../lib/engine/materials.ts';
import { readRuns, runIsComplete, writeRun } from '../lib/engine/runs.ts';
import {
  BRIEF_FIELD_CAPS, BRIEF_PATH, BRIEF_SCHEMA, briefAvailability, briefBatchEstimate,
  briefConflicts, briefSubject, checkBrief, herEdit, mergeKeepingHers, parseBrief, proofLibraryFor,
  readBriefs, resolveBrief, runBrief, writeBrief, type BriefDraft,
} from '../lib/engine/brief.ts';
import {
  exportHandoff, handoffChain, importReturn, markHandoff, readHandoffs, HANDOFF_PATH,
} from '../lib/engine/handoff.ts';
import type { CreateMessage, ModelResponse } from '../lib/engine/extraction.ts';

// ── The stub ────────────────────────────────────────────────────────────────

function briefReply(over: Partial<BriefDraft> = {}, response: Partial<ModelResponse> = {}): ModelResponse {
  const draft: BriefDraft = {
    one_point: 'They ask about salary to anchor you, not to pay you.',
    tension: 'You are told to name a number and it always feels like a trap.',
    realization: 'It is an anchoring move, so the number is not the answer.',
    takeaway: 'You can answer it without naming a number.',
    product_role: 'CareerOS scripts the answer for you.',
    tone: 'Plain, a bit blunt, no cheerleading.',
    ending: 'Link in bio, it is free to start.',
    leave_out: ['Never suggest lying about a current salary.'],
    cta_id: 'cta-signup',
    proof_used: ['proof-numbers'],
    derived_from: ['core_message', 'reframe'],
    ...over,
  };
  return {
    stop_reason: 'end_turn',
    text: JSON.stringify(draft),
    usage: {
      input_tokens: 14000, cache_read_input_tokens: 0,
      cache_creation_input_tokens: 9000, output_tokens: 900,
    },
    ...response,
  };
}

function briefInputFor(body: ProfileBody, piece_id: string) {
  const subject = briefSubject(body, piece_id);
  return {
    profile_id: PROFILE, body, config: allActive(), piece_id,
    seed: subject.seed, costume: subject.costume, rule: subject.rule,
    run_id: 'run-brief-1', packet_id: 'pkt-brief-1', now: NOW, clock: () => 0,
  };
}

function draftFrom(over: Partial<BriefDraft> = {}): BriefDraft {
  return parseBrief(JSON.parse(briefReply(over).text));
}

// ── 9. The brief is grounded and logged (S12) ───────────────────────────────

suite('spec 24 §15.9 — one complete run entry per brief, every time');

test('9. success, refusal and error each write exactly one complete run', async () => {
  const { body, piece_id } = bodyWithOnePiece();
  const cases: { name: string; caller: CreateMessage; stop: string }[] = [
    { name: 'success', caller: async () => briefReply(), stop: 'end_turn' },
    {
      name: 'refusal',
      caller: async () => briefReply({}, { stop_reason: 'refusal', stop_details: { category: 'cyber' }, text: '' }),
      stop: 'refusal',
    },
    { name: 'error', caller: async () => { throw new Error('the network went away'); }, stop: 'error' },
  ];

  for (const c of cases) {
    const result = await runBrief(briefInputFor(body, piece_id), c.caller);
    eq(runIsComplete(result.run), [], `${c.name}: the run carries everything S12 asks for`);
    eq(result.run.kind, 'internal_brief', `${c.name}: logged as a brief run`);
    eq(result.run.stop_reason, c.stop, `${c.name}: the outcome is on the record`);
    eq(result.run.model, 'claude-opus-5', `${c.name}: with the model`);
    eq(result.run.effort, 'high', `${c.name}: at effort high, and there is no cheap mode`);
    ok(Array.isArray(result.run.packet.folders), `${c.name}: the packet folder list`);
    eq(typeof result.run.packet.context_version, 'number', `${c.name}: and the context version`);
    eq(result.run.piece_ids, [piece_id], `${c.name}: and the piece it was for`);
    eq(typeof result.run.usage.input_tokens, 'number', `${c.name}: with token counts`);
    ok(result.run.cost_estimate_usd >= 0, `${c.name}: and a cost estimate from run one`);
    ok(!JSON.stringify(result.run).includes('sk-ant'), `${c.name}: and never a key`);
    eq(readRuns(writeRun(body, result.run)).length, 1, `${c.name}: exactly one entry, not two`);
  }
});

test('9b. a run with no packet record is not a run', () => {
  const broken = { id: 'r', model: 'claude-opus-5', effort: 'high' } as unknown as Parameters<typeof runIsComplete>[0];
  ok(runIsComplete(broken).includes('packet'), 'the same shape check spec 23 uses, on the same log');
});

test('9c. the packet is the brief profile, and carries exactly what §6.4 lists', async () => {
  const { body, piece_id } = bodyWithOnePiece();
  const result = await runBrief(briefInputFor(body, piece_id), async () => briefReply());
  const text = result.packet.text;

  eq(result.packet.content_profile, 'brief', 'the one assembler ran its brief profile');
  ok(text.includes('they ask about salary to anchor you'), 'the seed travels in full, verbatim');
  ok(text.includes('Never read as "lie about your salary"'), 'with the prohibited interpretation');
  ok(text.includes('Some companies genuinely do have a band'), 'and the nuance');
  ok(text.includes('Would a stranger stop?'), 'the gate questions are in Block A, to write toward');
  ok(text.includes('Format rule: Carousel'), 'the merged format rule is here, which extraction never got');
  ok(text.includes('Link in bio'), 'and the CTA in its actual words');
  ok(!text.includes('ATS myths'), 'no other seed enters: a brief is written from ONE understood idea');
  ok(result.packet.universal_block.includes('is not copy'), 'and the method block says what a brief is');
});

test('9d. a refusal renders as words, and nothing is saved', async () => {
  const { body, piece_id } = bodyWithOnePiece();
  const result = await runBrief(briefInputFor(body, piece_id),
    async () => briefReply({}, { stop_reason: 'refusal', stop_details: { category: 'bio' }, text: '' }));
  eq(result.outcome, 'refusal', 'the outcome is a refusal');
  eq(result.brief, null, 'no brief comes back');
  eq(result.run.refusal_category, 'bio', 'logged with its category');
  ok(result.message.includes('your costume is still here'), 'and she is told her costume survived');
});

// ── 10. The brief checks bite ───────────────────────────────────────────────

suite('spec 24 §15.10 — checks 2 and 3 reject, 4 and 5 badge and never hide');

test('10. a brief answering a different CTA is rejected, and retried exactly once', async () => {
  const { body, piece_id } = bodyWithOnePiece();
  const sent: string[] = [];
  const wrongCta: CreateMessage = async req => {
    sent.push(req.messages[0].content);
    return briefReply({ cta_id: 'cta-comment', ending: 'Comment RESUME and I will send it.' });
  };
  const result = await runBrief(briefInputFor(body, piece_id), wrongCta);

  eq(sent.length, 2, 'it tried exactly twice, the one retry the spec allows');
  ok(sent[1].includes('cta_id came back as "cta-comment"'), 'and the retry names the violation');
  eq(result.outcome, 'rejected', 'a brief that answers a different request is not a brief');
  eq(result.brief, null, 'and it is never shown');
  eq(result.run.checks.rejected, 2, 'both rejections are on the run record');
});

test('10b. a brief citing proof that does not resolve is rejected', () => {
  const { body, piece_id } = bodyWithOnePiece();
  const subject = briefSubject(body, piece_id);
  const ctx = {
    costume: subject.costume, seed: subject.seed,
    proof_library: proofLibraryFor(body), never_promises: [], never_words: [],
  };

  const invented = checkBrief(draftFrom({ proof_used: ['proof-invented'] }), ctx);
  ok(invented.rejections.some(r => r.includes('not in the proof library')),
    'inventing evidence is the one failure that must never reach a draft');

  const wrongPlatform = checkBrief(draftFrom({ proof_used: ['proof-linkedin-only'] }), ctx);
  ok(wrongPlatform.rejections.some(r => r.includes('permitted on LinkedIn')),
    'and proof permitted elsewhere is rejected for this platform, with both named');

  eq(checkBrief(draftFrom(), ctx).rejections, [], 'while the honest one passes clean');
});

test('10c. a never-promise phrase or a never-word is BADGED, not hidden', async () => {
  const { body, piece_id } = bodyWithOnePiece();
  const crossing: CreateMessage = async () => briefReply({
    takeaway: 'You get guaranteed placement if you follow the system.',
    tone: 'Hustle energy.',
  });
  const result = await runBrief(briefInputFor(body, piece_id), crossing);
  eq(result.outcome, 'brief', 'it is still shown');
  ok(!!result.brief, 'the brief comes back');
  const badge = result.badges.find(b => b.check === 'boundary')!;
  ok(!!badge, 'badged');
  eq(badge.label, 'crosses a boundary', 'in her words');
  ok(badge.detail!.includes('guaranteed placement'), 'with the boundary named');
  ok(badge.detail!.includes('hustle'), 'and the never-word named too');
});

test('10d. a brief naming no real seed field is badged, and still shown', async () => {
  const { body, piece_id } = bodyWithOnePiece();
  const result = await runBrief(briefInputFor(body, piece_id),
    async () => briefReply({ derived_from: ['deeper_problem'] }));   // empty on this seed
  eq(result.outcome, 'brief', 'shown');
  ok(result.badges.some(b => b.check === 'seed-fidelity'), 'and badged: check this against the seed');
});

test('10e. every prose field is capped, so a draft cannot be smuggled into a brief', async () => {
  for (const field of ['one_point', 'tension', 'realization', 'takeaway', 'tone', 'ending']) {
    ok(typeof BRIEF_FIELD_CAPS[field] === 'number', `${field} carries a hard cap`);
    const prop = (BRIEF_SCHEMA.properties as Record<string, { maxLength?: number }>)[field];
    eq(prop.maxLength, BRIEF_FIELD_CAPS[field],
      'and the SCHEMA carries it, which is what makes the guard mechanical rather than an instruction');
  }

  const { body, piece_id } = bodyWithOnePiece();
  const slideDeck = 'Slide 1: they ask about salary. Slide 2: it is an anchor. '.repeat(20);
  const result = await runBrief(briefInputFor(body, piece_id), async () => briefReply({ one_point: slideDeck }));
  eq(result.outcome, 'rejected', 'a draft in a brief field is refused');
  eq(result.brief, null, 'and never saved');
  ok(result.message.includes('a draft instead of a brief'), 'and she is told exactly what happened');
});

test('10f. check 1: a malformed response is a run error, not a brief', () => {
  throws(() => parseBrief({ tension: 'x' }), 'missing "one_point"', 'a half-built brief is refused');
  throws(() => parseBrief({
    one_point: 'a', tension: 'b', realization: 'c', takeaway: 'd', tone: 'e', ending: 'f',
  }), 'no cta_id', 'and one with no CTA is refused too');
});

// ── §6.9 Versions, and who wins ─────────────────────────────────────────────

suite('spec 24 §6.9 — versions, and where she wrote a field the engine never overwrites it');

test('a re-run creates version 2, and version 1 stays readable forever', () => {
  const { body, piece_id } = bodyWithOnePiece();
  const rule = briefSubject(body, piece_id).rule;
  const v1 = writeBrief(body, { piece_id, draft: draftFrom(), origin: 'engine', now: NOW, by: 'engine:content', rule });
  const v2 = writeBrief(v1, {
    piece_id, draft: draftFrom({ one_point: 'A second reading.' }),
    origin: 'engine', now: NOW, by: 'engine:content', rule,
  });
  eq(readBriefs(v2, piece_id).length, 2, 'both versions are kept');
  eq(readBriefs(v2, piece_id)[0].one_point, 'They ask about salary to anchor you, not to pay you.',
    'and version 1 is never rewritten');
  eq(resolveBrief(v2, piece_id)!.brief_version, 2, 'while resolveBrief gives the current one');
});

test('a re-run that touches a field she wrote shows both, and hers survives', () => {
  const { body, piece_id } = bodyWithOnePiece();
  const rule = briefSubject(body, piece_id).rule;

  // The engine wrote v1; she edited exactly one line of it. Only that line
  // becomes hers — the rest keeps its engine marker.
  const v1 = writeBrief(body, {
    piece_id, draft: draftFrom(), origin: 'engine', now: NOW, by: 'engine:content', rule,
  });
  const edit = herEdit(resolveBrief(v1, piece_id)!, { one_point: 'HER sentence.' });
  eq(edit.field_sources.one_point, 'her', 'the line she touched is hers');
  eq(edit.field_sources.tone, 'engine', 'and the ones she did not are still the engine\'s');

  const hers = writeBrief(v1, {
    piece_id, draft: edit.draft, origin: 'hers', now: NOW, by: 'owner', rule,
    field_sources: edit.field_sources,
  });
  const previous = resolveBrief(hers, piece_id);
  const rerun = draftFrom({ one_point: 'the engine sentence', tone: 'a new tone' });

  const clashes = briefConflicts(previous, rerun);
  ok(clashes.some(c => c.field === 'one_point'), 'the clash is surfaced');
  eq(clashes[0].hers, 'HER sentence.', 'with her wording');
  eq(clashes[0].engine, 'the engine sentence', 'beside the engine\'s');

  const merged = mergeKeepingHers(previous, rerun);
  eq(merged.draft.one_point, 'HER sentence.', 'and her wording is never overwritten');
  eq(merged.draft.tone, 'a new tone', 'while a field she did not write takes the new answer');
  eq(merged.field_sources.one_point, 'her', 'and the marking follows the field');
});

// ── 11. Keyless honesty ─────────────────────────────────────────────────────

suite('spec 24 §15.11 — keyless honesty');

test('11. with no key: pieces resolve, "Write it myself" works, the button says why', () => {
  const availability = briefAvailability({
    hasApiKey: false, briefSwitchActive: true, strategyLocked: true, gateSetLocked: true, lifecycle: 'active',
  });
  eq(availability.available, false, 'the brief call is off');
  ok(availability.reason!.includes('no key'), 'and it says so in plain words');
  ok(availability.reason!.includes('write the brief yourself'), 'pointing at what still works');

  // The costume surface still resolves, with no model anywhere near it.
  const { body, piece_id } = bodyWithOnePiece();
  eq(findPiece(body, piece_id)!.piece.stage, 'build', 'the piece resolved');
  eq(readRuns(body).length, 0, 'and no run was logged, because nothing ran');

  // And she writes the brief herself: no run, no cost, origin hers.
  const rule = briefSubject(body, piece_id).rule;
  const after = writeBrief(body, {
    piece_id, draft: draftFrom({ one_point: 'My own sentence.' }),
    origin: 'hers', now: NOW, by: 'owner', rule,
  });
  const stored = resolveBrief(after, piece_id)!;
  eq(stored.origin, 'hers', 'written by her');
  eq(stored.brief_version, 1, 'as version 1');
  eq(stored.field_sources!.one_point, 'her', 'and every field is marked hers');
  eq(readRuns(after).length, 0, 'still no run');
  eq(readBriefs(after, piece_id).length, 1, 'and nothing fabricated a second one');
});

test('11b. the brief also refuses without a locked strategy or a locked gate set', () => {
  const noStrategy = briefAvailability({
    hasApiKey: true, briefSwitchActive: true, strategyLocked: false, gateSetLocked: true, lifecycle: 'active',
  });
  ok(noStrategy.reason!.includes('strategy'), 'no strategy, and it names strategy');

  const noGates = briefAvailability({
    hasApiKey: true, briefSwitchActive: true, strategyLocked: true, gateSetLocked: false, lifecycle: 'active',
  });
  ok(noGates.reason!.includes('gate set'), 'no gate set, and it names the gates');

  const off = briefAvailability({
    hasApiKey: true, briefSwitchActive: false, strategyLocked: true, gateSetLocked: true, lifecycle: 'active',
  });
  ok(off.reason!.includes('yourself'), 'switched off, and the honest alternative is named');

  const paused = briefAvailability({
    hasApiKey: true, briefSwitchActive: true, strategyLocked: true, gateSetLocked: true, lifecycle: 'paused',
  });
  eq(paused.available, false, 'and a paused profile writes nothing new');
});

// ── 12. Nothing spends without a press ──────────────────────────────────────

suite('spec 24 §15.12 — nothing spends money without a press');

test('12. resolving six variants makes zero model calls', () => {
  const body = costumeBody();
  const rows = rowsFrom(body, {
    ...FULL, hook_type: ['direct claim', 'question', 'curiosity'], angle: ['contrarian', 'mistake'],
  });
  eq(rows.length, 6, 'six rows');
  const result = resolveVariants({
    body, seed_id: 'seed-salary', batch_id: 'b', rows: confirm(rows), now: NOW, by: 'owner',
  });
  eq(result.piece_ids.length, 6, 'six pieces written');
  eq(readRuns(result.body).length, 0, 'and not one run, because not one call was made');
  eq(readBriefs(result.body).length, 0, 'and not one brief');
});

test('12b. "Brief them all" states the count and the estimate, and runs only after she confirms', async () => {
  const body = costumeBody();
  const rows = rowsFrom(body, {
    ...FULL, hook_type: ['direct claim', 'question', 'curiosity'], angle: ['contrarian', 'mistake'],
  });
  const { body: withPieces, piece_ids } = resolveVariants({
    body, seed_id: 'seed-salary', batch_id: 'b', rows: confirm(rows), now: NOW, by: 'owner',
  });

  const estimate = briefBatchEstimate(piece_ids.length);
  eq(estimate.count, 6, 'the count is stated');
  ok(estimate.usd > 0, 'with a real dollar figure');
  ok(estimate.words.includes('6 briefs'), 'in plain words');
  ok(estimate.words.includes('Nothing runs until you say go'), 'and nothing runs until she says so');

  let calls = 0;
  const caller: CreateMessage = async () => { calls++; return briefReply(); };
  eq(calls, 0, 'before confirmation, zero calls');

  for (const id of piece_ids) {
    await runBrief({ ...briefInputFor(withPieces, id), run_id: `run-${id}` }, caller);
  }
  eq(calls, 6, 'after confirmation, exactly one call per piece');
});

test('12c. the estimate is cheaper after the first brief of a session, because the packet caches', () => {
  const cold = briefBatchEstimate(1, false).usd;
  const warm = briefBatchEstimate(1, true).usd;
  ok(warm < cold, 'one cold read, then cache reads at about a tenth');
  eq(briefBatchEstimate(0).count, 0, 'and nothing selected costs nothing');
});

// ── 13. The handoff round-trip (S18) ────────────────────────────────────────

suite('spec 24 §15.13 — the round trip lands on the same piece');

function withBrief(): { body: ProfileBody; piece_id: string } {
  const { body, piece_id } = bodyWithOnePiece();
  const rule = briefSubject(body, piece_id).rule;
  return {
    body: writeBrief(body, { piece_id, draft: draftFrom(), origin: 'engine', now: NOW, by: 'engine:content', rule }),
    piece_id,
  };
}

test('13. no brief, no handoff', () => {
  const { body, piece_id } = bodyWithOnePiece();
  throws(() => exportHandoff(body, {
    id: 'h-1', piece_id, destination_tool: 'Figma',
    expected_deliverable: 'one 8-slide carousel, 1080x1350', now: NOW,
  }), 'no brief yet', 'a design tool cannot be handed a piece with no point');
});

test('13b. the brief leaves, the asset comes back, and no second piece is created', () => {
  const { body, piece_id } = withBrief();
  const before = JSON.stringify(findPiece(body, piece_id)!.piece.birth);
  const pieceCount = readPieces(body).length;

  const exported = exportHandoff(body, {
    id: 'h-1', piece_id, destination_tool: 'Figma',
    expected_deliverable: 'one 8-slide carousel, 1080x1350', now: NOW,
  });
  eq(exported.handoff.piece_id, piece_id, 'the piece id travels, and it is immutable');
  eq(exported.handoff.brief_version, 1, 'with the version that LEFT');
  eq(exported.handoff.import_status, 'pending', 'and it waits');
  ok(exported.payload.includes('The one point:'), 'the payload is the brief, pasteable into any tool');
  ok(exported.payload.includes('1080x1350'), 'with what should come back, in her words');

  const returned = importReturn(exported.body, {
    handoff_id: 'h-1',
    asset: { id: 'asset-back', url: 'https://example.test/carousel.png', version: 1 },
    rights: { consent: 'given', permitted_platforms: ['Instagram'] },
    now: '2026-07-28T10:00:00.000Z', by: 'owner',
  });

  eq(returned.handoff.import_status, 'imported', 'the handoff moves to imported');
  eq(returned.handoff.returned_asset!.version, 1, 'carrying the returned asset');
  ok(readPath(returned.body, 'work-log/assets/sets').some(e => e.id === 'asset-back'),
    'and the asset lands in assets/sets like every other asset');

  const piece = findPiece(returned.body, piece_id)!;
  eq(readPieces(returned.body).length, pieceCount, 'NO second piece is created, ever');
  eq(piece.piece.id, piece_id, 'the piece that left is the piece that came back');
  eq(piece.piece.seed_id, 'seed-salary', 'its seed is untouched');
  eq(piece.piece.costume.format, 'Carousel', 'its costume is untouched');
  eq(JSON.stringify(piece.piece.birth), before, 'and its birth snapshot is untouched');
  eq(piece.piece.stage, 'build', 'it stays at build: review is spec 25 territory, after the gates');
  ok(piece.piece.materials!.some(m => m.id === 'asset-back'), 'and the asset is attached to it');
});

test('13c. a re-export sets supersedes, and the chain is never broken', () => {
  const { body, piece_id } = withBrief();
  const first = exportHandoff(body, {
    id: 'h-1', piece_id, destination_tool: 'Figma', expected_deliverable: 'v1', now: NOW,
  });
  const second = exportHandoff(first.body, {
    id: 'h-2', piece_id, destination_tool: 'Figma', expected_deliverable: 'v2, tighter cover',
    now: '2026-07-29T10:00:00.000Z', supersedes: 'h-1',
  });
  eq(second.handoff.supersedes, 'h-1', 'the new handoff names the one it replaces');

  const chain = handoffChain(second.body, piece_id);
  eq(chain.length, 2, 'and the earlier one is still there, entire');
  eq(chain[0].id, 'h-1', 'oldest first');
  eq(chain[0].expected_deliverable, 'v1', 'with what it originally asked for, unrewritten');

  throws(() => exportHandoff(second.body, {
    id: 'h-3', piece_id, destination_tool: 'Figma', expected_deliverable: 'v3',
    now: NOW, supersedes: 'nope',
  }), 'chain would be broken', 'and a handoff cannot supersede one that is not there');
});

test('13d. a later brief version does not retroactively change what the tool was given', () => {
  const { body, piece_id } = withBrief();
  const exported = exportHandoff(body, {
    id: 'h-1', piece_id, destination_tool: 'Figma', expected_deliverable: 'v1', now: NOW,
  });
  const rule = briefSubject(exported.body, piece_id).rule;
  const later = writeBrief(exported.body, {
    piece_id, draft: draftFrom({ one_point: 'A sharper point.' }),
    origin: 'hers', now: '2026-07-30T10:00:00.000Z', by: 'owner', rule,
  });
  eq(resolveBrief(later, piece_id)!.brief_version, 2, 'the brief moves to version 2');
  eq(readHandoffs(later, piece_id)[0].brief_version, 1,
    'and the handoff still says version 1, which is what actually left');
  eq(readBriefs(later, piece_id)[0].one_point, 'They ask about salary to anchor you, not to pay you.',
    'version 1 stays readable, and is never rewritten');
});

test('13e. a returned asset with unknown rights attaches blocked, and says so', () => {
  const { body, piece_id } = withBrief();
  const exported = exportHandoff(body, {
    id: 'h-1', piece_id, destination_tool: 'a designer on WhatsApp',
    expected_deliverable: 'the carousel', now: NOW,
  });
  const returned = importReturn(exported.body, {
    handoff_id: 'h-1', asset: { id: 'asset-unknown', url: 'https://example.test/x.png', version: 1 },
    now: NOW, by: 'owner',
  });
  ok(returned.message.includes('No consent'), 'the missing right is named, in words');
  eq(materialsOf(returned.body, piece_id).blocked.length, 1, 'the piece carries the block');
  eq(findPiece(returned.body, piece_id)!.piece.stage, 'build', 'and nothing about publication is decided');
});

test('13f. failed and abandoned are real endings, and they stay on the record', () => {
  const { body, piece_id } = withBrief();
  const exported = exportHandoff(body, {
    id: 'h-1', piece_id, destination_tool: 'Figma', expected_deliverable: 'the carousel', now: NOW,
  });
  const gone = markHandoff(exported.body, { handoff_id: 'h-1', status: 'abandoned', now: NOW, by: 'owner' });
  eq(readHandoffs(gone, piece_id)[0].import_status, 'abandoned', 'it is marked abandoned');
  eq(readHandoffs(gone, piece_id)[0].expected_deliverable, 'the carousel',
    'and what it asked for is still exactly what it asked for');
});

// ── 14. No client, no leak ──────────────────────────────────────────────────

suite('spec 24 §15.14 — no client, no leak, and no piece before review');

const OWNER_ONLY_PATHS = [
  BRIEF_PATH, HANDOFF_PATH, 'work-log/logs/engine-runs',
  'context/content-strategy/platforms/instagram/rules',
];

function stateWithBuildData(): AppState {
  const state = fixtureState();
  for (const id of ['resumeguru', 'career-bubble', 'divine-studio']) {
    const client = state.clients.find(c => c.id === id)!;
    let body = migrateProfile(client, state.clientData[id], { now: NOW }).body;

    const stages = [
      ['p-idea', 'idea'], ['p-build', 'build'], ['p-review', 'review'], ['p-posted', 'posted'],
    ] as const;
    for (const [pieceId, stage] of stages) {
      body = putEntry(body, PIECE_PATH, {
        id: `${id}-${pieceId}`, type: 'piece',
        data: {
          seed_id: null, title: `${stage} piece`, hook: 'a hook', stage,
          costume: { pillar_id: 'p-trust', platform: 'Instagram', format: 'Carousel', angle: 'contrarian' },
          birth: { at: NOW, costume: { platform: 'Instagram' }, gate_version: 1, strategy_version: 1 },
          batch_id: 'batch-secret',
          materials: [{
            kind: 'asset', id: 'a1', path: 'work-log/assets/sets',
            attached_at: NOW, by: 'owner', rights_state: 'cleared',
          }],
          notes: 'her private note about this one',
        },
      }, { writer: 'owner', now: NOW });
    }

    body = putEntry(body, BRIEF_PATH, {
      id: `${id}-brief`, type: 'internal_brief',
      data: { piece_id: `${id}-p-review`, brief_version: 1, one_point: 'the point' },
    }, { writer: 'owner', now: NOW });
    body = putEntry(body, HANDOFF_PATH, {
      id: `${id}-handoff`, type: 'handoff_record',
      data: { piece_id: `${id}-p-review`, brief_version: 1, destination_tool: 'Figma', import_status: 'pending' },
    }, { writer: 'owner', now: NOW });
    body = putEntry(body, 'context/content-strategy/platforms/instagram/rules', {
      id: `${id}-rule`, type: 'platform_parameter',
      data: { format: 'Carousel', length_bands: ['5 slides'] },
    }, { writer: 'owner', now: NOW });

    state.clientData[id].body = body;
  }
  return state;
}

test('14. a client login and an intern login both receive zero engine internals', () => {
  const state = stateWithBuildData();
  for (const role of ['merushri', 'intern'] as const) {
    const filtered = filterStateForRole(state, role);
    for (const id of Object.keys(filtered.clientData)) {
      const paths = filtered.clientData[id].body?.paths ?? {};
      for (const p of OWNER_ONLY_PATHS) {
        eq((paths[p] ?? []).length, 0, `${role} sees nothing at ${p}`);
      }
    }
  }
});

test('14b. no piece at idea or build reaches a non-owner login', () => {
  const state = stateWithBuildData();
  for (const role of ['merushri', 'intern'] as const) {
    const filtered = filterStateForRole(state, role);
    for (const id of Object.keys(filtered.clientData)) {
      for (const e of filtered.clientData[id].body?.paths?.[PIECE_PATH] ?? []) {
        const stage = (e.data as { stage?: string }).stage;
        ok(stage !== 'idea' && stage !== 'build',
          `${role}: nothing at ${stage} (PLAN §4, the client never sees drafts before review)`);
      }
    }
  }
});

test('14c. the pieces they DO receive arrive with the engine internals stripped', () => {
  const state = stateWithBuildData();
  const filtered = filterStateForRole(state, 'merushri');
  const pieces = filtered.clientData['career-bubble']?.body?.paths?.[PIECE_PATH] ?? [];
  ok(pieces.length > 0, 'review and posted pieces do arrive');
  for (const e of pieces) {
    const data = e.data as Record<string, unknown>;
    for (const f of ['costume', 'birth', 'batch_id', 'materials', 'notes']) {
      eq(data[f], undefined, `${f} is stripped`);
    }
    ok(!!data.title, 'while the title stays');
    ok(!!data.stage, 'and the stage');
    ok(!!data.hook, 'and the hook');
    ok(!JSON.stringify(e).includes('batch-secret'),
      'and nothing of the engine survives anywhere else on the entry');
  }
});

test('14d. each check FAILS when its guard is removed', () => {
  const state = stateWithBuildData();
  // Unfiltered, all of it is right there — which is what proves the filter is
  // doing the work rather than the data happening to be absent.
  const raw = state.clientData['career-bubble'].body!.paths;
  let leaked = 0;
  for (const p of OWNER_ONLY_PATHS) leaked += (raw[p] ?? []).length;
  ok(leaked >= 3, 'the briefs, handoffs, runs and rule overrides are all there');
  eq((raw[PIECE_PATH] ?? []).filter(e => ['idea', 'build'].includes(String((e.data as { stage?: string }).stage))).length,
    2, 'and both the idea and the build piece are there');
  ok(JSON.stringify(raw[PIECE_PATH]).includes('batch-secret'), 'with the batch id and the costume on them');

  const filtered = filterStateForRole(state, 'merushri').clientData['career-bubble']!.body!.paths;
  let seen = 0;
  for (const p of OWNER_ONLY_PATHS) seen += (filtered[p] ?? []).length;
  eq(seen, 0, 'and with the filter, nothing');
  eq(JSON.stringify(filtered[PIECE_PATH]).includes('batch-secret'), false, 'nor the internals');
});

// ── 19. The save-race test, extended ────────────────────────────────────────

suite('spec 24 §15.19 — a brief write and a materials attach, at the same time');

test('19. both survive, in either order', () => {
  const state = fixtureState();
  const { body: base, piece_id } = withBrief();
  const withAsset = putEntry(base, 'work-log/assets/sets', {
    id: 'a-race', type: 'asset_set',
    data: {
      name: 'a race asset',
      rights: {
        ownership: 'krnl', consent: 'given', permitted_platforms: ['Instagram'], permitted_uses: [],
        expiry: null, attribution_required: null, subject_releases: [], restriction: 'none',
      },
    },
  }, { writer: 'owner', now: NOW });
  state.clientData[PROFILE].body = withAsset;

  const rule = briefSubject(withAsset, piece_id).rule;

  // Tab A writes brief version 2. Tab B attaches a material. Neither saw the other.
  const tabA: AppState = {
    ...state,
    clientData: {
      ...state.clientData,
      [PROFILE]: {
        ...state.clientData[PROFILE],
        body: writeBrief(withAsset, {
          piece_id, draft: draftFrom({ one_point: 'From tab A.' }),
          origin: 'hers', now: NOW, by: 'owner', rule,
        }),
      },
    },
  };
  const tabB: AppState = {
    ...state,
    clientData: {
      ...state.clientData,
      [PROFILE]: {
        ...state.clientData[PROFILE],
        body: attachMaterial(withAsset, {
          piece_id, kind: 'asset', id: 'a-race', now: NOW, by: 'owner',
        }).body,
      },
    },
  };

  const scopesA = changedScopes(state, tabA);
  const scopesB = changedScopes(state, tabB);
  ok(scopesA.includes(scopeKey(PROFILE, BRIEF_PATH)), 'tab A declares the briefs path');
  ok(scopesB.includes(scopeKey(PROFILE, PIECE_PATH)), 'tab B declares the piece path');
  ok(!scopesA.includes(scopeKey(PROFILE, PIECE_PATH)), 'and tab A declares nothing it did not touch');

  let merged = applyScopes(state, tabA, scopesA);
  merged = applyScopes(merged, tabB, scopesB);
  eq(resolveBrief(merged.clientData[PROFILE].body!, piece_id)!.one_point, 'From tab A.', 'tab A survived');
  eq(materialsOf(merged.clientData[PROFILE].body!, piece_id).materials.length, 1, 'and so did tab B');

  let other = applyScopes(state, tabB, scopesB);
  other = applyScopes(other, tabA, scopesA);
  eq(resolveBrief(other.clientData[PROFILE].body!, piece_id)!.one_point, 'From tab A.',
    'and the other order is the same');
  eq(materialsOf(other.clientData[PROFILE].body!, piece_id).materials.length, 1, 'both ways');
});
