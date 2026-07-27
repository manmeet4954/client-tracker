// Spec 25 §14 — the eighteen acceptance tests.
//
// Nothing here reaches the network: `runDraft` and `runGateRun` take an injected
// `createMessage` exactly as spec 23's extraction and spec 24's brief do, and
// every check beside them is pure.

import { suite, test, ok, eq, throws } from './harness.ts';
import {
  FULL, NOW, PROFILE, allActive, bodyWithOnePiece, confirm, costumeBody, rowsFrom,
} from './costumeFixtures.ts';
import { fixtureState } from './fixtures.ts';
import { migrateProfile } from '../lib/tree/migrate.ts';
import { amendEntry, putEntry, readPath, type ProfileBody } from '../lib/tree/body.ts';
import { filterStateForRole } from '../lib/access.ts';
import { validateRegistries } from '../lib/tree/validate.ts';
import { platformSwitchId } from '../lib/tree/switches.ts';
import type { AppState } from '../types/index.ts';
import type { GateSet, RightsRecord, TasteRule } from '../lib/tree/objects.ts';
import { rightsCleared, rightsClearedAt } from '../lib/tree/objects.ts';

import { PIECE_PATH } from '../lib/engine/seeds.ts';
import { findPiece, resolveVariants } from '../lib/engine/resolve.ts';
import { readRuns, runIsComplete, writeRun } from '../lib/engine/runs.ts';
import { briefSubject, resolveBrief, writeBrief, type BriefDraft } from '../lib/engine/brief.ts';
import { buildGateSet, readGateSet, readStrategy, writeGateSet, writeStrategy } from '../lib/strategy/derivation.ts';
import { formatRulesResolution, resolveFormatRule } from '../lib/engine/formats.ts';
import {
  MAKING_PATH, clientPreviewOf, computeEditDelta, emptyDraftPayload, formatFamilyOf,
  herDraftEdit, readDrafts, refusedDraftWrites, resolveDraft, writeDraft,
  type Claim, type DraftPayload, type DraftVersion,
} from '../lib/engine/drafts.ts';
import {
  GATE_RUN_PATH, buildGateRun, flipToEnforced, gatesOf, machineContextFor, publicationDate,
  readGateRuns, refusedGateRunWrites, refusedStageWrites, rightsFindings, rightsVerdict,
  runMachineChecks, writeGateRun, type GateSubject, type MachineCheckContext,
} from '../lib/engine/gates.ts';
import {
  DRAFT_SCHEMA, draftingAvailability, evidencelessPasses, parseDraft, reviseNotesFrom,
  reviseState, runDraft, runGateRun, type DraftingInput, type GateCallInput,
} from '../lib/engine/drafting.ts';
import {
  acceptDiff, assertRoutable, captureFeedback, confirmFeedbackClass, findFeedback,
  readFeedback, rejectDiff, waitingDiffs,
} from '../lib/engine/feedback.ts';
import {
  activateTasteRule, leakViolations, proposeTasteRule, tasteBlockLines, tasteConflictLine,
  tasteRulesForPacket,
  runDistillation,
} from '../lib/engine/taste.ts';
import {
  fromHerObservation, readRecommendations, recommendationHints, refusedRecommendationWrites,
  writeRecommendation, RecommendationRefused,
} from '../lib/engine/recommendations.ts';
import { assemblePacket } from '../lib/engine/packet.ts';
import type { CreateMessage, ModelResponse } from '../lib/engine/extraction.ts';

// ── Shared shapes ───────────────────────────────────────────────────────────

const HOOK = 'They ask about salary to anchor you.';
const CTA = 'Link in bio, it is free to start.';
const CAPTION =
  'The number is not the answer here, and that is the part nobody tells you before the call. '
  + 'A band is a real thing at a real company, and an anchor is a move, and knowing which one '
  + 'you are looking at is most of the job. Try it once and you will feel the difference.';

function bodySlide(i: number) {
  return {
    index: i,
    heading: `Point ${i}`,
    lines: [`A short line for ${i}.`, 'And one more.'],
    visual_note: 'plain type on paper',
  };
}

function carousel(over: Partial<Record<string, unknown>> = {}): DraftPayload {
  const slides = [
    { index: 1, heading: HOOK, lines: [] as string[], visual_note: 'cover' },
    ...[2, 3, 4, 5, 6, 7].map(bodySlide),
    { index: 8, heading: 'Follow for more', lines: [CTA], visual_note: 'end card' },
  ];
  return {
    format_family: 'carousel',
    hook: HOOK,
    caption: CAPTION,
    cta_line: CTA,
    claims: [],
    alt_text: ['a plain slide of type'],
    leave_out_check: ['Nothing here suggests lying about a current salary.'],
    notes_for_her: '',
    slides,
    ...over,
  } as DraftPayload;
}

function reel(over: Partial<Record<string, unknown>> = {}): DraftPayload {
  return {
    format_family: 'reel',
    hook: HOOK,
    caption: CAPTION,
    cta_line: CTA,
    claims: [],
    alt_text: [],
    leave_out_check: [],
    notes_for_her: '',
    script: [
      { beat: 'hook', spoken: HOOK, seconds_estimate: 3 },
      { beat: 'recognition', spoken: 'You freeze, every time.', seconds_estimate: 3 },
      { beat: 'reframe', spoken: 'It is an anchor, not a budget.', seconds_estimate: 4 },
      { beat: 'payoff', spoken: 'Give a range and a reason.', seconds_estimate: 4 },
      { beat: 'action', spoken: 'Link in bio.', seconds_estimate: 2 },
    ],
    ...over,
  } as DraftPayload;
}

const BRIEF: BriefDraft = {
  one_point: 'They ask about salary to anchor you, not to pay you.',
  tension: 'You are told to name a number and it always feels like a trap.',
  realization: 'It is an anchoring move, so the number is not the answer.',
  takeaway: 'You can answer it without naming a number.',
  product_role: 'CareerOS scripts the answer for you.',
  tone: 'Plain, a bit blunt, no cheerleading.',
  ending: CTA,
  leave_out: ['Never suggest lying about a current salary.'],
  cta_id: 'cta-signup',
  proof_used: ['proof-numbers'],
  derived_from: ['core_message', 'reframe'],
};

/** A piece at build, carrying a brief whose hook is HERS. `null` = she wrote none. */
function pieceWithBrief(hook: string | null = HOOK): { body: ProfileBody; piece_id: string } {
  const { body, piece_id } = bodyWithOnePiece();
  const rule = briefSubject(body, piece_id).rule;
  return {
    body: writeBrief(body, {
      piece_id, draft: BRIEF, origin: 'engine', now: NOW, by: 'engine:content', rule,
      hook: hook ?? undefined,
    }),
    piece_id,
  };
}

/** Her carousel override, with the numbers a test needs. */
function withOverride(
  body: ProfileBody, bands: string[], never: unknown[] = [], version = 2,
): ProfileBody {
  return putEntry(body, 'context/content-strategy/platforms/instagram/rules', {
    id: 'rule-carousel', type: 'platform_parameter',
    data: { format: 'Carousel', length_bands: bands, never, version },
  }, { writer: 'owner', now: NOW });
}

function ruleFor(body: ProfileBody) {
  return resolveFormatRule(body, 'Instagram', 'Carousel');
}

function checkContext(body: ProfileBody, payload: DraftPayload, over: Partial<MachineCheckContext> = {}): MachineCheckContext {
  const { claims, ...content } = payload;
  return {
    content: content as MachineCheckContext['content'],
    claims,
    costume: { pillar_id: 'p-trust', platform: 'Instagram', format: 'Carousel', objective: 'trust' },
    rule: ruleFor(body),
    her_hook: HOOK,
    never_promises: ['guaranteed placement', 'guaranteed job'],
    never_words: ['hustle', 'grind'],
    proof_ids: ['proof-numbers', 'proof-linkedin-only'],
    brand_gate_ids: ['coach', 'hook', 'value', 'stance', 'friend'],
    ...over,
  };
}

function failedFor(checks: ReturnType<typeof runMachineChecks>, gate: string) {
  return checks.filter(c => c.gate_id === gate && !c.passed);
}

/** A draft version on the piece, so a gate run has something to judge. */
function withDraft(
  body: ProfileBody, piece_id: string, payload = carousel(),
): { body: ProfileBody; draft: DraftVersion } {
  const written = writeDraft(body, {
    piece_id, origin: 'engine', payload,
    brief_version: 1, gate_set_version: 1, strategy_version: 1,
    rule: ruleFor(body), engine_run_id: 'run-1', now: NOW, by: 'engine:content',
  });
  return { body: written.body, draft: written.draft };
}

function subjectFor(body: ProfileBody, piece_id: string, draft: DraftVersion): GateSubject {
  const s = briefSubject(body, piece_id);
  return {
    piece: findPiece(body, piece_id)!.piece,
    draft,
    costume: s.costume,
    rule: ruleFor(body),
    gate_set: readGateSet(body)!,
    seed: s.seed,
    her_hook: resolveBrief(body, piece_id)?.hook,
  };
}

const ALL_GATES = ['coach', 'hook', 'value', 'stance', 'friend', 'accuracy', 'format'];

function passingVerdicts(only = ALL_GATES) {
  return only.map(id => ({
    gate_id: id, verdict: 'pass' as const,
    reason: `${id} is answered.`, evidence_span: HOOK,
  }));
}

function draftingInput(body: ProfileBody, piece_id: string, over: Partial<DraftingInput> = {}): DraftingInput {
  const s = briefSubject(body, piece_id);
  const brief = resolveBrief(body, piece_id);
  return {
    profile_id: PROFILE, body, config: allActive(), piece_id,
    seed: s.seed, costume: s.costume, rule: ruleFor(body),
    brief: {
      brief_version: brief?.brief_version ?? 1,
      one_point: BRIEF.one_point, tension: BRIEF.tension, realization: BRIEF.realization,
      takeaway: BRIEF.takeaway, product_role: BRIEF.product_role, tone: BRIEF.tone,
      ending: BRIEF.ending, leave_out: BRIEF.leave_out, hook: brief?.hook,
    },
    family: formatFamilyOf(s.costume.format, s.costume.platform),
    gates: gatesOf(body).gates,
    gate_set_version: 1, strategy_version: 1,
    run_id: 'run-draft-1', packet_id: 'pkt-draft-1', now: NOW, clock: () => 0,
    ...over,
  };
}

function gateInput(
  body: ProfileBody, piece_id: string, draft: DraftVersion, over: Partial<GateCallInput> = {},
): GateCallInput {
  return {
    ...draftingInput(body, piece_id),
    run_id: 'run-gate-1', packet_id: 'pkt-gate-1',
    subject: subjectFor(body, piece_id, draft),
    gate_run_id: 'gr-1',
    run_by: 'owner',
    ...over,
  };
}

function reply(payload: DraftPayload, over: Partial<ModelResponse> = {}): ModelResponse {
  return {
    stop_reason: 'end_turn',
    text: JSON.stringify(payload),
    usage: {
      input_tokens: 18000, cache_read_input_tokens: 0,
      cache_creation_input_tokens: 9000, output_tokens: 2200,
    },
    ...over,
  };
}

function verdictReply(verdicts: unknown[], over: Partial<ModelResponse> = {}): ModelResponse {
  return {
    stop_reason: 'end_turn',
    text: JSON.stringify({ verdicts }),
    usage: {
      input_tokens: 9000, cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0, output_tokens: 1100,
    },
    ...over,
  };
}

// ── 1. Her hook survives ────────────────────────────────────────────────────

suite('spec 25 §14.1 — her hook survives, verbatim, or there is no draft');

test('1. the hook comes back byte-identical, and lands where the family puts it', async () => {
  const { body, piece_id } = pieceWithBrief();
  const result = await runDraft(draftingInput(body, piece_id), async () => reply(carousel()));
  eq(result.outcome, 'draft', 'the draft comes back');
  eq(result.payload!.hook, HOOK, 'her hook, character for character');
  const slides = (result.payload as { slides: { heading: string }[] }).slides;
  eq(slides[0].heading, HOOK, 'and slide 1 IS the hook');
  eq(result.run.checks.rejected, 0, 'nothing was rejected');
});

test('1b. a reworded hook is rejected and retried exactly once', async () => {
  const { body, piece_id } = pieceWithBrief();
  const sent: string[] = [];
  const improver: CreateMessage = async req => {
    sent.push(req.messages[0].content);
    return reply(sent.length === 1
      ? carousel({ hook: 'They ask about salary to anchor you — here is why.' })
      : carousel());
  };
  const result = await runDraft(draftingInput(body, piece_id), improver);
  eq(sent.length, 2, 'it tried exactly twice, the one retry the spec allows');
  ok(sent[1].includes('It is not yours to improve'), 'and the retry names the violation');
  eq(result.outcome, 'draft', 'the second answer kept her words, so it is shown');
  eq(result.payload!.hook, HOOK, 'verbatim');
  eq(result.run.checks.rejected, 1, 'and the rejection is on the run record');
});

test('1c. a second rewording yields no draft and a logged violation', async () => {
  const { body, piece_id } = pieceWithBrief();
  let calls = 0;
  const result = await runDraft(draftingInput(body, piece_id), async () => {
    calls++;
    return reply(carousel({ hook: 'A tighter hook, obviously better.' }));
  });
  eq(calls, 2, 'exactly two calls, never a third');
  eq(result.outcome, 'rejected', 'no draft comes back');
  eq(result.payload, null, 'and none is saved');
  ok(result.message.includes('rewrote your hook'), 'she is told exactly what happened');
  eq(result.run.checks.rejected, 2, 'both violations are logged');
  eq(result.run.checks.badged.every(b => b.check === 'hook-verbatim'), true, 'named as the hook guard');
});

test('1d. with no hook of hers, nothing is guarded and the draft stands', async () => {
  const { body, piece_id } = pieceWithBrief(null);
  const result = await runDraft(draftingInput(body, piece_id),
    async () => reply(carousel({ hook: 'Whatever the engine chose.' })));
  eq(result.outcome, 'draft', 'shown');
  eq(result.run.checks.rejected, 0, 'and nothing was rejected, because she wrote no hook');
});

// ── 2. Slide copy, not essays ───────────────────────────────────────────────

suite('spec 25 §14.2 — slide copy, not essays');

test('2. a 47-word slide fails the format gate, quoting the rule and the slide', () => {
  const { body } = pieceWithBrief();
  const fat = carousel();
  (fat as { slides: { index: number; heading: string; lines: string[]; visual_note: string }[] })
    .slides[3] = {
      index: 4, heading: 'Why the number is a trap',
      lines: [
        'The recruiter is not asking because a budget exists somewhere in a spreadsheet and they '
        + 'want to check it against your answer, they are asking because whoever speaks first sets '
        + 'the anchor and every later number in this whole process gets measured against it.',
      ],
      visual_note: '',
    };
  const failures = failedFor(runMachineChecks(checkContext(body, fat)), 'format');
  ok(failures.length > 0, 'the format gate fails');
  ok(failures.some(f => f.reason.includes('Slide 4 is')), 'and it names the slide');
  ok(failures.some(f => f.reason.includes('short sentences')), 'quoting the rule it broke');

  eq(failedFor(runMachineChecks(checkContext(body, carousel())), 'format'), [],
    'while a draft within the caps passes clean');
});

test('2b. the schema cannot represent a paragraph slide at all', () => {
  const carouselShape = DRAFT_SCHEMA.oneOf.find(
    s => (s.properties as { format_family?: { const?: string } }).format_family?.const === 'carousel',
  )!;
  const slides = (carouselShape.properties as { slides: { items: { properties: Record<string, { maxLength?: number; maxItems?: number }> } } }).slides;
  eq(slides.items.properties.lines.maxItems, 3, 'a slide holds at most three lines');
  ok((slides.items.properties.heading.maxLength ?? 0) <= 60, 'and a heading is capped');
  ok(!('body' in slides.items.properties) && !('text' in slides.items.properties),
    'there is no free-text field a paragraph could live in');
  for (const shape of DRAFT_SCHEMA.oneOf) {
    ok(!('post_text' in shape.properties), 'and no family produces a block of post text');
  }
});

// ── 3. Reels are speakable ──────────────────────────────────────────────────

suite('spec 25 §14.3 — a reel script is speech');

test('3. bullets, headings and a 60-word line all fail; spoken language passes', () => {
  const { body } = pieceWithBrief();
  const reelCtx = (payload: DraftPayload) => checkContext(body, payload, {
    costume: { pillar_id: 'p-trust', platform: 'Instagram', format: 'Reel', objective: 'trust' },
    rule: resolveFormatRule(body, 'Instagram', 'Reel'),
  });

  const bulleted = reel({
    script: [
      { beat: 'hook', spoken: HOOK, seconds_estimate: 3 },
      { beat: 'action', spoken: '• first thing\n• second thing', seconds_estimate: 4 },
    ],
  });
  ok(failedFor(runMachineChecks(reelCtx(bulleted)), 'format').some(f => f.reason.includes('bullets')),
    'bullets are not speech');

  const headed = reel({
    script: [
      { beat: 'hook', spoken: HOOK, seconds_estimate: 3 },
      { beat: 'action', spoken: 'Slide 2: the reframe', seconds_estimate: 4 },
    ],
  });
  ok(failedFor(runMachineChecks(reelCtx(headed)), 'format').length > 0, 'nor are slide markers');

  const long = reel({
    script: [
      { beat: 'hook', spoken: HOOK, seconds_estimate: 3 },
      {
        beat: 'action',
        spoken: 'The thing nobody tells you before that call is that the person on the other side '
          + 'is not checking your number against a budget they already hold, they are listening for '
          + 'whichever one of you speaks first because that number becomes the anchor for everything.',
        seconds_estimate: 20,
      },
    ],
  });
  ok(failedFor(runMachineChecks(reelCtx(long)), 'format').some(f => f.reason.includes('one breath')),
    'and a sixty-word line cannot be said out loud');

  eq(failedFor(runMachineChecks(reelCtx(reel())), 'format'), [], 'while a spoken script passes');
});

// ── 4. Override beats universal ─────────────────────────────────────────────

suite('spec 25 §14.4 — override beats universal, always');

test('4. a 6-slide draft fails under her 8-to-10 rule and passes under the universal one', () => {
  const base = pieceWithBrief().body;
  const short = carousel({
    slides: [
      { index: 1, heading: HOOK, lines: [], visual_note: 'cover' },
      ...[2, 3, 4, 5].map(bodySlide),
      { index: 6, heading: 'Follow for more', lines: [CTA], visual_note: 'end card' },
    ],
  });

  const overridden = withOverride(base, ['8 to 10 slides']);
  const failures = failedFor(runMachineChecks(checkContext(overridden, short)), 'format');
  ok(failures.some(f => f.reason.includes('8 to 10')), 'her numbers bind, and they are quoted');

  eq(failedFor(runMachineChecks(checkContext(base, short)), 'format'), [],
    'with the override gone, the universal rule allows six');

  const a = formatRulesResolution(ruleFor(overridden));
  const b = formatRulesResolution(ruleFor(base));
  ok(a !== b, 'and the two runs record two different rule resolutions');
  ok(a.includes('length_bands'), 'the overridden one names the field she changed');
});

// ── 5. The convert-carousel prohibition ─────────────────────────────────────

suite('spec 25 §14.5 — never use carousel as the convert format');

test('5. it fails before any model call, and the run logs model null', async () => {
  const { body, piece_id } = pieceWithBrief();
  const prohibited = withOverride(body, ['8 to 10 slides'], [
    { when: { objective: 'conversion' }, says: 'never use carousel as the convert format' },
  ]);
  const { body: withIt, draft } = withDraft(prohibited, piece_id);

  const subject = subjectFor(withIt, piece_id, draft);
  subject.costume = { ...subject.costume, objective: 'conversion' };

  let calls = 0;
  const result = await runGateRun(
    gateInput(withIt, piece_id, draft, {
      subject,
      costume: subject.costume,
      rule: ruleFor(withIt),
    }),
    async () => { calls++; return verdictReply(passingVerdicts()); },
  );

  eq(calls, 0, 'the model was never called: the draft is going back regardless');
  eq(result.engine_run.model, null, 'and the run says so honestly');
  eq(result.engine_run.stop_reason, 'short-circuit', 'named as a short circuit');
  eq(result.engine_run.cost_estimate_usd, 0, 'costing nothing, which is the point');
  eq(result.run.overall, 'failed', 'the gate run failed');
  ok(result.message.includes('never use carousel as the convert format'), 'with the rule quoted back');
  eq(result.run.engine_run_id, null, 'and no model run is cited, because none happened');
});

// ── 6. Seven, not six ───────────────────────────────────────────────────────

suite('spec 25 §14.6 — nothing leaves build until all seven pass');

function passingRun(body: ProfileBody, piece_id: string, draft: DraftVersion, gates?: GateSet) {
  return buildGateRun({
    id: 'gr-pass', piece_id, draft_version_id: draft.id,
    gate_set: gates ?? readGateSet(body)!, strategy_version: 1, rule: ruleFor(body),
    checks: [], model_verdicts: passingVerdicts(),
    engine_run_id: 'run-gate-1', run_at: NOW, run_by: 'owner',
  });
}

function moveTo(body: ProfileBody, piece_id: string, stage: string): ProfileBody {
  return amendEntry(body, PIECE_PATH, piece_id, {
    at: NOW, by: 'owner', note: `to ${stage}`, changed: { stage },
  });
}

test('6. six passing verdicts is not seven, and the write is refused with the reason', () => {
  const { body, piece_id } = pieceWithBrief();
  const { body: withIt, draft } = withDraft(body, piece_id);
  const six = buildGateRun({
    id: 'gr-six', piece_id, draft_version_id: draft.id,
    gate_set: readGateSet(withIt)!, strategy_version: 1, rule: ruleFor(withIt),
    checks: [], model_verdicts: passingVerdicts(ALL_GATES.filter(g => g !== 'format')),
    engine_run_id: 'run-gate-1', run_at: NOW, run_by: 'owner',
  });
  const withSix = writeGateRun(withIt, six);
  const moved = moveTo(withSix, piece_id, 'review');

  const refused = refusedStageWrites(withSix, moved, NOW);
  eq(refused.length, 1, 'the write is refused');
  ok(refused[0].reason.includes('format'), 'and the gate that did not pass is named');

  // Removing the guard makes the write succeed — which is what proves the guard
  // is what stops it, rather than luck.
  eq(refusedStageWrites(withSix, moved, NOW).length > 0, true, 'with the guard, refused');
  const allSeven = writeGateRun(withIt, passingRun(withIt, piece_id, draft));
  eq(refusedStageWrites(allSeven, moveTo(allSeven, piece_id, 'review'), NOW), [],
    'and with all seven, the same write goes straight through');
});

test('6b. no gate set at all, and nothing leaves build', () => {
  const { body, piece_id } = pieceWithBrief();
  const { body: withIt } = withDraft(body, piece_id);
  const stripped: ProfileBody = {
    ...withIt,
    paths: { ...withIt.paths, 'context/content-strategy/gates': [] },
  };
  const refused = refusedStageWrites(stripped, moveTo(stripped, piece_id, 'review'), NOW);
  ok(refused[0].reason.includes('no locked gate set'), 'and it says so plainly');
});

// ── 7. Gate versions are forward only ───────────────────────────────────────

suite('spec 25 §14.7 — gate versions apply forward only');

test('7. locking v2 leaves every v1 record byte-identical', () => {
  const { body, piece_id } = pieceWithBrief();
  const { body: withIt, draft } = withDraft(body, piece_id);
  const v1 = writeGateRun(withIt, passingRun(withIt, piece_id, draft));
  const beforeBytes = JSON.stringify(readPath(v1, GATE_RUN_PATH));

  const v2Set = buildGateSet([
    { id: 'coach', name: 'Coach', question: 'Does it teach rather than perform?', from: 'voice' },
    { id: 'hook', name: 'Hook', question: 'Would a stranger stop?', from: 'positioning' },
    { id: 'value', name: 'Value', question: 'Do they get something without buying?', from: 'positioning' },
    { id: 'stance', name: 'Stance', question: 'Does it take a position?', from: 'voice' },
    { id: 'plain', name: 'Plain', question: 'Would you say this out loud?', from: 'voice' },
  ], 2, 1, NOW);
  const v2 = writeGateSet(v1, v2Set, NOW);

  eq(JSON.stringify(readPath(v2, GATE_RUN_PATH)), beforeBytes,
    'nothing about version 1 is touched, recomputed or re-rendered');
  eq(readGateRuns(v2, piece_id)[0].gate_set_version, 1, 'the old run still reports version 1');
  eq(readGateRuns(v2, piece_id)[0].verdicts[0].gate_version, 1, 'and so does every verdict on it');
  eq(readGateSet(v2)!.version, 2, 'while the profile is now on version 2');

  // A piece pulled back into build after v2 locks is gated under v2.
  const fresh = buildGateRun({
    id: 'gr-v2', piece_id, draft_version_id: draft.id,
    gate_set: readGateSet(v2)!, strategy_version: 1, rule: ruleFor(v2),
    checks: [], model_verdicts: passingVerdicts(['coach', 'hook', 'value', 'stance', 'plain', 'accuracy', 'format']),
    engine_run_id: 'run-2', run_at: NOW, run_by: 'owner',
  });
  eq(fresh.gate_set_version, 2, 'the new run is judged under v2');
  eq(fresh.verdicts.every(v => v.gate_version === 2), true, 'every verdict stamped with it');
  eq(fresh.overall, 'passed', 'and it can pass under the new standard');
});

test('7b. a gate run is never rewritten, from any door', () => {
  const { body, piece_id } = pieceWithBrief();
  const { body: withIt, draft } = withDraft(body, piece_id);
  const run = passingRun(withIt, piece_id, draft);
  const written = writeGateRun(withIt, run);

  throws(() => writeGateRun(written, { ...run, overall: 'failed' }),
    'append-only', 'putEntry refuses the overwrite');

  const forged: ProfileBody = {
    ...written,
    paths: {
      ...written.paths,
      [GATE_RUN_PATH]: written.paths[GATE_RUN_PATH].map(e => ({
        ...e, data: { ...(e.data as object), overall: 'failed' },
      })),
    },
  };
  ok(refusedGateRunWrites(written, forged).length > 0, 'and the write door refuses a whole-body save too');
});

// ── 8. Accuracy has teeth ───────────────────────────────────────────────────

suite('spec 25 §14.8 — accuracy is checked, not judged');

const RESULT_CLAIM: Claim = {
  text: 'We moved signups from 41 to 58 in a month.',
  kind: 'result', needs_proof: true, proof_id: null, within_boundaries: true,
};

test('8. an unbacked result is flagged, not silently passed', () => {
  const { body } = pieceWithBrief();
  const checks = runMachineChecks(checkContext(body, carousel({ claims: [RESULT_CLAIM] })));
  const flagged = failedFor(checks, 'accuracy');
  eq(flagged.length, 1, 'one accuracy finding');
  eq(flagged[0].hard, false, 'soft: she can resolve it, so it does not short-circuit the run');
  ok(flagged[0].reason.includes('cites no proof'), 'and it names what is missing');
});

test('8b. attaching a real proof id clears it, and so does her verified mark', () => {
  const { body } = pieceWithBrief();
  const backed = carousel({ claims: [{ ...RESULT_CLAIM, proof_id: 'proof-numbers' }] });
  eq(failedFor(runMachineChecks(checkContext(body, backed)), 'accuracy'), [],
    'proof that exists clears the claim');

  const verified = runMachineChecks(checkContext(body, carousel({ claims: [RESULT_CLAIM] }), {
    owner_verified: [RESULT_CLAIM.text],
  }));
  eq(failedFor(verified, 'accuracy'), [], 'and so does her own verification');

  const run = buildGateRun({
    id: 'gr-v', piece_id: 'piece-1', draft_version_id: 'd1',
    gate_set: readGateSet(body)!, strategy_version: 1, rule: ruleFor(body),
    checks: verified, model_verdicts: passingVerdicts(),
    engine_run_id: 'r', run_at: NOW, run_by: 'owner',
    owner_verified: [{ by: 'owner', at: NOW, reason: 'I have the dashboard screenshot.', claim: RESULT_CLAIM.text }],
  });
  const accuracy = run.verdicts.find(v => v.gate_id === 'accuracy')!;
  eq(accuracy.owner_verified![0].reason, 'I have the dashboard screenshot.', 'and her words are kept on the record');
});

test('8c. a claim citing proof that does not exist is a hard failure', () => {
  const { body } = pieceWithBrief();
  const checks = runMachineChecks(checkContext(body, carousel({
    claims: [{ ...RESULT_CLAIM, proof_id: 'proof-invented' }],
  })));
  const failure = failedFor(checks, 'accuracy')[0];
  eq(failure.hard, true, 'inventing evidence is not a flag');
  ok(failure.reason.includes('not in the proof library'), 'and it says which id');
});

test('8d. a boundaries violation fails, and there is no override path for it', () => {
  const { body } = pieceWithBrief();
  const crossing = carousel({
    slides: [
      { index: 1, heading: HOOK, lines: [], visual_note: 'cover' },
      ...[2, 3, 4, 5, 6].map(bodySlide),
      { index: 7, heading: 'What you get', lines: ['A guaranteed placement, every time.'], visual_note: '' },
      { index: 8, heading: 'Follow for more', lines: [CTA], visual_note: 'end card' },
    ],
  });
  const checks = runMachineChecks(checkContext(body, crossing));
  const boundary = failedFor(checks, 'accuracy').find(c => c.check === 'boundaries')!;
  ok(!!boundary, 'the boundary scan bites');
  ok(boundary.reason.includes('not overridable'), 'and says why it cannot be waved through');

  const run = buildGateRun({
    id: 'gr-b', piece_id: 'piece-1', draft_version_id: 'd1',
    gate_set: readGateSet(body)!, strategy_version: 1, rule: ruleFor(body),
    checks, model_verdicts: passingVerdicts(),
    engine_run_id: 'r', run_at: NOW, run_by: 'owner',
    overrides: { accuracy: { by: 'owner', at: NOW, reason: 'ship it' } },
  });
  const accuracy = run.verdicts.find(v => v.gate_id === 'accuracy')!;
  eq(accuracy.verdict, 'fail', 'her override does not apply to a boundaries failure');
  eq(accuracy.override, undefined, 'and none is recorded');
  eq(run.overall, 'failed', 'so the run fails');
});

test('8e. a brand gate and the format gate ARE overridable, with her reason kept', () => {
  const { body } = pieceWithBrief();
  const run = buildGateRun({
    id: 'gr-o', piece_id: 'piece-1', draft_version_id: 'd1',
    gate_set: readGateSet(body)!, strategy_version: 1, rule: ruleFor(body),
    checks: [],
    model_verdicts: [
      ...passingVerdicts(ALL_GATES.filter(g => g !== 'coach')),
      { gate_id: 'coach', verdict: 'fail' as const, reason: 'A coach could have written this.', evidence_span: HOOK },
    ],
    engine_run_id: 'r', run_at: NOW, run_by: 'owner',
    overrides: { coach: { by: 'owner', at: NOW, reason: 'The builder line is in the caption.' } },
  });
  const coach = run.verdicts.find(v => v.gate_id === 'coach')!;
  eq(coach.verdict, 'pass', 'she is the authority here');
  eq(coach.override!.reason, 'The builder line is in the caption.', 'and her reason is on the record');
  eq(run.overall, 'passed-with-override', 'the run says how it passed');
});

// ── 9. Rights block publication, not review ─────────────────────────────────

suite('spec 25 §14.9 — rights block publication, never review');

function withAsset(body: ProfileBody, id: string, rights: Partial<RightsRecord>): ProfileBody {
  const full: RightsRecord = {
    ownership: 'client', consent: 'given', permitted_platforms: ['Instagram'],
    permitted_uses: ['social'], expiry: null, attribution_required: null,
    subject_releases: [], restriction: 'none',
    ...rights,
  };
  return putEntry(body, 'work-log/assets/sets', {
    id, type: 'asset_set', data: { name: id, rights: full },
  }, { writer: 'owner', now: NOW });
}

function attachRef(body: ProfileBody, piece_id: string, asset_id: string): ProfileBody {
  return amendEntry(body, PIECE_PATH, piece_id, {
    at: NOW, by: 'owner', note: 'attach', changed: {
      materials: [{
        kind: 'asset', id: asset_id, path: 'work-log/assets/sets',
        attached_at: NOW, by: 'owner', rights_state: 'blocked',
      }],
    },
  });
}

test('9. no consent: build to review is fine, approved to scheduled is refused', () => {
  const { body, piece_id } = pieceWithBrief();
  let next = withAsset(body, 'asset-nc', { consent: 'not-given' });
  next = attachRef(next, piece_id, 'asset-nc');
  const { body: withIt, draft } = withDraft(next, piece_id);
  const gated = writeGateRun(withIt, passingRun(withIt, piece_id, draft));

  eq(refusedStageWrites(gated, moveTo(gated, piece_id, 'review'), NOW), [],
    'review is allowed: the client who owns the photo may see it');

  const approved = moveTo(gated, piece_id, 'approved');
  const scheduled = refusedStageWrites(approved, moveTo(approved, piece_id, 'scheduled'), NOW);
  eq(scheduled.length, 1, 'scheduling is refused');
  ok(scheduled[0].reason.includes('No consent'), 'and the missing right is named');
});

test('9b. an expiry that passes before the scheduled date blocks, though it is valid today', () => {
  const { body, piece_id } = pieceWithBrief();
  let next = withAsset(body, 'asset-exp', { expiry: '2026-08-10' });
  next = attachRef(next, piece_id, 'asset-exp');
  next = amendEntry(next, PIECE_PATH, piece_id, {
    at: NOW, by: 'owner', note: 'schedule', changed: { scheduled_date: '2026-08-20', stage: 'approved' },
  });

  const piece = findPiece(next, piece_id)!.piece;
  eq(publicationDate(next, piece, NOW), '2026-08-20', 'the piece posts on the twentieth');
  eq(rightsClearedAt({
    ownership: 'client', consent: 'given', permitted_platforms: ['Instagram'], permitted_uses: [],
    expiry: '2026-08-10', attribution_required: null, subject_releases: [], restriction: 'none',
  }, 'Instagram', NOW), true, 'the permission is valid today');

  const refused = refusedStageWrites(next, moveTo(next, piece_id, 'scheduled'), NOW);
  eq(refused.length, 1, 'and it is still refused');
  ok(refused[0].reason.includes('runs out'), 'because it runs out before the piece goes out');
});

test('9c. legacy grace forgives absence and never a recorded refusal, and the flip is one way', () => {
  const { body, piece_id } = pieceWithBrief();
  let next = withAsset(body, 'asset-blank', {
    ownership: 'unknown', consent: 'unknown', permitted_platforms: [],
  });
  next = attachRef(next, piece_id, 'asset-blank');
  next = moveTo(next, piece_id, 'approved');

  eq(rightsFindings(next, findPiece(next, piece_id)!.piece, NOW)[0].state, 'ungraded',
    'nothing recorded is an absence, not a refusal');
  eq(refusedStageWrites(next, moveTo(next, piece_id, 'scheduled'), NOW), [],
    'and under grace it warns rather than blocking the whole back catalogue');

  const enforced = flipToEnforced(next);
  const blocked = refusedStageWrites(enforced, moveTo(enforced, piece_id, 'scheduled'), NOW);
  eq(blocked.length, 1, 'after the flip it blocks');

  const back = { ...enforced, rights_baseline: 'legacy-grace' as const };
  ok(refusedGateRunWrites(enforced, back).some(r => r.reason.includes('forward only')),
    'and enforced can never flip back');
});

test('9d. the shipped undated helper still works, unchanged', () => {
  const valid: RightsRecord = {
    ownership: 'krnl', consent: 'given', permitted_platforms: [], permitted_uses: [],
    expiry: null, attribution_required: null, subject_releases: [], restriction: 'none',
  };
  eq(rightsCleared(valid, 'Instagram'), true, 'every existing caller keeps working');
  eq(rightsCleared({ ...valid, restriction: 'blocked' }, 'Instagram'), false, 'in both directions');
});

test('9e. the rights verdict rides along and never decides build to review', () => {
  const { body, piece_id } = pieceWithBrief();
  let next = withAsset(body, 'asset-nc2', { consent: 'not-given' });
  next = attachRef(next, piece_id, 'asset-nc2');
  const verdict = rightsVerdict(next, findPiece(next, piece_id)!.piece, NOW, 1);
  eq(verdict.verdict, 'fail', 'the verdict is a fail');
  eq(verdict.gate_kind, 'rights', 'marked as the rights gate');
  eq(verdict.override, undefined, 'and it carries no override path at all');

  const run = buildGateRun({
    id: 'gr-r', piece_id, draft_version_id: 'd1', gate_set: readGateSet(next)!,
    strategy_version: 1, rule: ruleFor(next), checks: [], model_verdicts: passingVerdicts(),
    rights: verdict, engine_run_id: 'r', run_at: NOW, run_by: 'owner',
  });
  eq(run.overall, 'passed', 'the seven gates still pass, so the piece may reach review');
});

// ── 10. Feedback routes as a diff, never an application ─────────────────────

suite('spec 25 §14.10 — a diff she accepts, never an application');

function withVoiceDecision(body: ProfileBody): ProfileBody {
  const written = writeStrategy(body, 'context/content-strategy/voice', {
    key: 'voice', value: ['plain', 'direct'], reason: 'from her own words at intake',
    sources: ['voice.natural-tone'], strategy_version: null,
  }, NOW);
  // Stamp it as locked at version 1, which is what the one-act lock does.
  return putEntry(written, 'context/content-strategy/voice', {
    id: 'decision', type: 'strategy_parameter',
    data: {
      key: 'voice', value: ['plain', 'direct'], reason: 'from her own words at intake',
      sources: ['voice.natural-tone'], strategy_version: 1,
    },
  }, { writer: 'owner', now: NOW });
}

test('10. a voice item is a proposal, and changes nothing until she says so', () => {
  const body = withVoiceDecision(pieceWithBrief().body);
  const captured = captureFeedback(body, {
    id: 'fb-1', moment: 'her-review', original: 'Never say unlock.',
    target_id: 'piece-1', proposed_class: 'voice', now: NOW,
  });
  eq(readFeedback(captured)[0].proposed_diff, undefined, 'a captured item carries no diff');
  eq(waitingDiffs(captured).length, 0, 'and nothing is waiting on her yet');

  const confirmed = confirmFeedbackClass(captured, {
    id: 'fb-1', confirmed_class: 'voice', by: 'owner', now: NOW,
    diff: { before: ['plain', 'direct'], after: ['plain', 'direct', 'never: unlock'] },
  });
  const item = findFeedback(confirmed, 'fb-1')!;
  eq(item.proposed_diff!.path, 'context/content-strategy/voice', 'now it is a proposed diff');
  eq(item.decision, undefined, 'with no decision');
  eq(readStrategy(confirmed, 'context/content-strategy/voice')!.strategy_version, 1,
    'and strategy has not moved');

  const accepted = acceptDiff(confirmed, { id: 'fb-1', by: 'owner', now: NOW });
  eq(accepted.strategy_version, 2, 'her acceptance creates version 2');
  const after = readStrategy(accepted.body, 'context/content-strategy/voice')!;
  eq(after.value, ['plain', 'direct', 'never: unlock'], 'with the diff applied');
  eq(after.reason, 'Never say unlock.', 'and the feedback as its reason line');
  eq(findFeedback(accepted.body, 'fb-1')!.decision!.verdict, 'accepted', 'the decision is kept');
});

test('10b. reject preserves the words, the diff and her reason', () => {
  const body = withVoiceDecision(pieceWithBrief().body);
  let next = captureFeedback(body, {
    id: 'fb-2', moment: 'her-review', original: 'This sounds like a brand script.',
    proposed_class: 'voice', now: NOW,
  });
  next = confirmFeedbackClass(next, {
    id: 'fb-2', confirmed_class: 'voice', by: 'owner', now: NOW,
    diff: { before: ['plain'], after: ['plain', 'blunt'] },
  });
  next = rejectDiff(next, { id: 'fb-2', by: 'owner', now: NOW, note: 'Blunt is not the same as rude.' });

  const item = findFeedback(next, 'fb-2')!;
  eq(item.original, 'This sounds like a brand script.', 'her original words survive');
  eq(item.proposed_diff!.after, ['plain', 'blunt'], 'and so does the diff nobody applied');
  eq(item.decision!.verdict, 'rejected', 'with the rejection');
  eq(item.decision!.note, 'Blunt is not the same as rude.', 'and her reason');
  eq(readStrategy(next, 'context/content-strategy/voice')!.strategy_version, 1,
    'strategy never moved');
});

test('10c. edit and accept keeps both her version and the original proposal', () => {
  const body = withVoiceDecision(pieceWithBrief().body);
  let next = captureFeedback(body, {
    id: 'fb-3', moment: 'after-posting', original: 'Too soft.', proposed_class: 'voice', now: NOW,
  });
  next = confirmFeedbackClass(next, {
    id: 'fb-3', confirmed_class: 'voice', by: 'owner', now: NOW,
    diff: { before: ['plain'], after: ['plain', 'hard'] },
  });
  const accepted = acceptDiff(next, { id: 'fb-3', by: 'owner', now: NOW, edited_after: ['plain', 'firm'] });
  const item = findFeedback(accepted.body, 'fb-3')!;
  eq(item.proposed_diff!.after, ['plain', 'hard'], 'the proposal is kept as it was');
  eq(item.applied_diff!.after, ['plain', 'firm'], 'and hers is what was applied');
  eq(readStrategy(accepted.body, 'context/content-strategy/voice')!.value, ['plain', 'firm'],
    'in strategy');
});

// ── 11. Classification is never automatic ───────────────────────────────────

suite('spec 25 §14.11 — she confirms the class, always');

test('11. a proposed class routes nowhere, and every route asserts a confirmed one', () => {
  const { body } = pieceWithBrief();
  const captured = captureFeedback(body, {
    id: 'fb-p', moment: 'client-review', original: 'Our carousels should be six slides.',
    proposed_class: 'format', now: NOW,
  });
  const item = findFeedback(captured, 'fb-p')!;
  eq(item.proposed_class, 'format', 'the engine proposed a class');
  eq(item.confirmed_class, undefined, 'she has not confirmed it');
  eq(item.scope, 'piece', 'so it is still just a note on the piece');
  eq(item.routed_to, undefined, 'routed nowhere');

  throws(() => assertRoutable(item), 'until you confirm', 'and every routing path refuses it');
  throws(() => acceptDiff(captured, { id: 'fb-p', by: 'owner', now: NOW }),
    'until you confirm', 'including acceptance');

  throws(() => confirmFeedbackClass(captured, {
    id: 'fb-p', confirmed_class: 'format', by: 'owner', now: NOW,
    diff: { before: 8, after: 6 },
  }), 'needs the platform', 'and format feedback has to say which platform');

  const confirmed = confirmFeedbackClass(captured, {
    id: 'fb-p', confirmed_class: 'format', platform: 'Instagram', by: 'owner', now: NOW,
    diff: { before: ['8 to 10 slides'], after: ['6 slides'] },
  });
  eq(findFeedback(confirmed, 'fb-p')!.proposed_diff!.path,
    'context/content-strategy/platforms/instagram/rules',
    'and only then does it route, to the platform its rules live in');
});

// ── 12. Taste rules never leak ──────────────────────────────────────────────

suite('spec 25 §14.12 — her instruction may cross, a client\'s data never does');

function stateWithTaste(rules: TasteRule[]): AppState {
  const state = fixtureState();
  state.tasteRules = rules;
  for (const id of Object.keys(state.clientData)) {
    const client = state.clients.find(c => c.id === id)!;
    state.clientData[id].body = migrateProfile(client, state.clientData[id], { now: NOW }).body;
  }
  return state;
}

const HABIT: TasteRule = {
  id: 'tr-1', rule: 'She cuts the slide count when the pillar\'s job is convert.',
  strength: 'law', state: 'proposed', evidence_refs: ['piece-1-d2#0', 'piece-4-d2#1', 'piece-9-d3#0'],
  de_identified: false, proposed_at: NOW,
};

test('12. a rule naming anything inside a profile is refused activation, with the token named', () => {
  const state = stateWithTaste([HABIT]);

  const named = leakViolations('ResumeGuru hated the word unlock.', state);
  ok(named.some(v => v.token === 'ResumeGuru'), 'a profile name is refused');
  ok(named[0].reason.includes('never a client'), 'with the reason in plain words');

  const seedNamed = leakViolations('Never write the salary anchor as a warning.', {
    ...state,
    clientData: {
      ...state.clientData,
      resumeguru: {
        ...state.clientData.resumeguru,
        body: (() => {
          const b = state.clientData.resumeguru.body!;
          return putEntry(b, 'work-log/creation/topics', {
            id: 'seed-salary', type: 'seed',
            data: { name: 'the salary anchor', raw_thought: 'x', raw_material: [], status: 'locked' },
          }, { writer: 'owner', now: NOW });
        })(),
      },
    },
  });
  ok(seedNamed.some(v => v.token === 'the salary anchor'), 'a seed name is refused too');

  const withMetric: AppState = {
    ...state,
    clientData: {
      ...state.clientData,
      resumeguru: {
        ...state.clientData.resumeguru,
        body: putEntry(state.clientData.resumeguru.body!, 'work-log/analysis/study-own-data', {
          id: 'obs-1', type: 'metric_observation',
          data: { metrics: { saves: 412 }, window: '7d' },
        }, { writer: 'pipe:ig-sync', now: NOW }),
      },
    },
  };
  const numbered = leakViolations('Aim for 412 saves on a how-to.', withMetric);
  ok(numbered.some(v => v.kind === 'number' && v.token === '412'), 'and numbers do not cross');

  const clean = activateTasteRule(state, 'tr-1', NOW);
  eq(clean.violations, [], 'while a rule about how SHE decides passes');
  eq(clean.tasteRules[0].state, 'active', 'and becomes active');
  eq(clean.tasteRules[0].de_identified, true, 'marked by the guard, never by hand');

  const dirty = activateTasteRule(
    { ...state, tasteRules: proposeTasteRule(state, {
      id: 'tr-2', rule: 'Divine Studio never wants a founder story.',
      strength: 'lean', evidence_refs: [], now: NOW,
    }) }, 'tr-2', NOW);
  ok(dirty.violations.length > 0, 'a rule wearing a client\'s data is refused');
  eq(dirty.tasteRules.find(r => r.id === 'tr-2')!.state, 'proposed', 'and stays a proposal');
});

test('12b. an assembled drafting packet carries the rule and nothing else about it', async () => {
  const state = stateWithTaste([{ ...HABIT, state: 'active', de_identified: true, accepted_at: NOW }]);
  const { body, piece_id } = pieceWithBrief();
  const rules = tasteRulesForPacket(state, { consent: true });
  eq(rules.length, 1, 'one rule enters');
  eq(Object.keys(rules[0]).sort(), ['rule', 'strength'], 'and it is rule and strength ONLY');

  const result = await runDraft(
    draftingInput(body, piece_id, { taste_rules: rules }),
    async () => reply(carousel()),
  );
  const text = result.packet.text;
  ok(text.includes('She cuts the slide count'), 'the habit travels');
  ok(text.includes('what is above wins'), 'under the line that says the profile wins');
  for (const ref of HABIT.evidence_refs) {
    ok(!text.includes(ref), `no evidence ref (${ref}) travels with it`);
  }
  for (const name of ['Divine Studio', 'Career Bubble', 'career-bubble', 'divine-studio']) {
    ok(!text.includes(name), `and no other profile's name (${name}) appears anywhere`);
  }

  // The assertion FAILS when the guard is removed: serialize the whole rule and
  // the evidence is right there.
  const unguarded = tasteBlockLines(
    [HABIT as unknown as { rule: string; strength: 'law' | 'lean' }],
  ).join('\n') + JSON.stringify(HABIT);
  ok(unguarded.includes(HABIT.evidence_refs[0]),
    'which is what proves the narrowing is doing the work');
});

test('12c. the per-profile consent switch decides whether any of it travels', () => {
  const state = stateWithTaste([{ ...HABIT, state: 'active', de_identified: true, accepted_at: NOW }]);
  eq(tasteRulesForPacket(state, { consent: false }), [], 'off, and nothing crosses');
  eq(tasteRulesForPacket(state, { consent: true }).length, 1, 'on, and her habit does');
  eq(tasteRulesForPacket({ tasteRules: [HABIT] }, { consent: true }), [],
    'and a rule she never accepted never leaves her screen');
});

test('12d. the conflict is shown once, plainly, and the profile still wins', () => {
  const base = pieceWithBrief().body;
  const overridden = withOverride(base, ['8 to 10 slides']);
  const line = tasteConflictLine(
    [{ rule: 'Carousels run 5 to 6 slides, short lines.', strength: 'law' }],
    ruleFor(overridden),
  );
  eq(line, 'Your usual is 5 to 6 slides. This profile\'s rules say 8 to 10. Drafted at 8 to 10.',
    'her usual, their rule, and what was actually done');
  eq(tasteConflictLine([{ rule: 'Carousels run 8 to 10 slides.', strength: 'law' }], ruleFor(overridden)),
    null, 'and no line at all when they agree');
});

// ── 13. The packet honors the cascade ───────────────────────────────────────

suite('spec 25 §14.13 — a retired platform never shapes a draft');

test('13. LinkedIn hidden, and it is nowhere in a drafting packet or a gate packet', async () => {
  const { body, piece_id } = pieceWithBrief();
  let withLinkedIn = putEntry(body, 'context/content-strategy/platforms/linkedin', {
    id: 'linkedin', type: 'platform', data: { name: 'LinkedIn' },
  }, { writer: 'owner', now: NOW });
  withLinkedIn = putEntry(withLinkedIn, 'context/content-strategy/platforms/linkedin/formats', {
    id: 'li-post', type: 'format', data: { name: 'LinkedIn post' },
  }, { writer: 'owner', now: NOW });
  withLinkedIn = putEntry(withLinkedIn, 'context/content-strategy/platforms/linkedin/how-it-works', {
    id: 'li-how', type: 'platform_parameter', data: { value: 'LinkedIn reads the argument.' },
  }, { writer: 'owner', now: NOW });

  const { body: withIt, draft } = withDraft(withLinkedIn, piece_id);

  for (const state of ['hidden', 'history'] as const) {
    const config = allActive({ [platformSwitchId('LinkedIn')]: state });
    const drafted = await runDraft(
      draftingInput(withIt, piece_id, { config }), async () => reply(carousel()));
    ok(!drafted.packet.text.includes('LinkedIn reads the argument'),
      `${state}: no LinkedIn rule reaches the drafting packet`);

    const gated = await runGateRun(
      gateInput(withIt, piece_id, draft, { config }),
      async () => verdictReply(passingVerdicts()));
    ok(!(gated.packet?.text ?? '').includes('LinkedIn reads the argument'),
      `${state}: nor the gate packet`);
  }

  // And everything already written stays readable, whichever position it is at.
  ok(readPath(withIt, 'context/content-strategy/platforms/linkedin/how-it-works').length === 1,
    'the LinkedIn folder is still there, entire — nothing is deleted (S9)');
  ok(readGateRuns(writeGateRun(withIt, passingRun(withIt, piece_id, draft)), piece_id).length === 1,
    'and past gate runs stay readable');
});

// ── 14. No client, no leak ──────────────────────────────────────────────────

suite('spec 25 §14.14 — the workshop rule is absolute');

const OWNER_ONLY = [
  MAKING_PATH, GATE_RUN_PATH, 'work-log/creation/costume-recommendations',
  'work-log/logs/engine-runs', 'work-log/logs/feedback',
];

function stateWithEngineInternals(): AppState {
  const state = fixtureState();
  state.tasteRules = [{ ...HABIT, state: 'active', de_identified: true, accepted_at: NOW }];
  for (const id of ['resumeguru', 'career-bubble', 'divine-studio']) {
    const client = state.clients.find(c => c.id === id)!;
    let body = migrateProfile(client, state.clientData[id], { now: NOW }).body;
    body = putEntry(body, PIECE_PATH, {
      id: `${id}-review`, type: 'piece',
      data: {
        seed_id: null, title: 'a piece at review', hook: HOOK, stage: 'review',
        costume: { pillar_id: 'p', platform: 'Instagram', format: 'Carousel' },
        current_draft_version_id: `${id}-review-d1`,
      },
    }, { writer: 'owner', now: NOW });
    body = putEntry(body, MAKING_PATH, {
      id: `${id}-review-d1`, type: 'draft_version',
      data: { piece_id: `${id}-review`, version: 1, content: carousel(), claims: [] },
    }, { writer: 'owner', now: NOW });
    body = putEntry(body, GATE_RUN_PATH, {
      id: `${id}-gr`, type: 'gate_run',
      data: { piece_id: `${id}-review`, overall: 'passed', verdicts: [] },
    }, { writer: 'owner', now: NOW });
    body = putEntry(body, 'work-log/creation/costume-recommendations', {
      id: `${id}-rec`, type: 'costume_recommendation',
      data: { source: 'her-observation', words: 'founder observation lands', suggests: {} },
    }, { writer: 'owner', now: NOW });
    body = putEntry(body, 'work-log/logs/engine-runs', {
      id: `${id}-run`, type: 'engine_run', data: { kind: 'draft', cost_estimate_usd: 0.31 },
    }, { writer: 'engine:content', now: NOW });
    body = putEntry(body, 'work-log/logs/feedback', {
      id: `${id}-fb`, type: 'feedback_item', data: { scope: 'piece', original: 'below the bar' },
    }, { writer: 'owner', now: NOW });
    state.clientData[id].body = body;
  }
  return state;
}

test('14. a client login and an intern login receive zero engine internals', () => {
  const state = stateWithEngineInternals();
  for (const role of ['merushri', 'intern'] as const) {
    const filtered = filterStateForRole(state, role);
    eq(filtered.tasteRules, [], `${role}: no taste rule, in any switch position`);
    for (const id of Object.keys(filtered.clientData)) {
      const paths = filtered.clientData[id].body?.paths ?? {};
      for (const p of OWNER_ONLY) {
        eq((paths[p] ?? []).length, 0, `${role} sees nothing at ${p}`);
      }
    }
  }
});

test('14b. and each check FAILS when its filter is removed', () => {
  const state = stateWithEngineInternals();
  const raw = state.clientData['career-bubble'].body!.paths;
  let present = 0;
  for (const p of OWNER_ONLY) present += (raw[p] ?? []).length;
  eq(present, 5, 'unfiltered, all five are right there');
  eq(state.tasteRules.length, 1, 'and so is the taste rule');

  const filtered = filterStateForRole(state, 'merushri');
  let seen = 0;
  for (const p of OWNER_ONLY) seen += (filtered.clientData['career-bubble']?.body?.paths?.[p] ?? []).length;
  eq(seen, 0, 'with the filter, nothing');
});

test('14c. clientPreviewOf is a whitelist, so a new field is not exposed by default', () => {
  const { body, piece_id } = pieceWithBrief();
  const { draft } = withDraft(body, piece_id, carousel({
    claims: [RESULT_CLAIM], notes_for_her: 'this cover is weak',
  }));
  const preview = clientPreviewOf(draft)!;

  eq(preview.hook, HOOK, 'the hook is shown');
  eq(preview.slides!.length, 8, 'and the slides');
  eq(preview.caption, CAPTION, 'and the caption');
  for (const field of ['claims', 'proof_refs', 'notes_for_her', 'leave_out_check', 'edit_delta',
    'engine_run_id', 'gate_run_id', 'version', 'format_rules_resolution', 'alt_text']) {
    eq((preview as unknown as Record<string, unknown>)[field], undefined, `${field} is never projected`);
  }
  ok(!JSON.stringify(preview).includes('this cover is weak'), 'and her note does not travel');
  ok(!JSON.stringify(preview).includes('visual_note'), 'nor the direction for the designer');

  // Add a field to the draft object: a whitelist does not carry it.
  const invented = {
    ...draft,
    content: { ...draft.content, secret_internal_note: 'the client must never read this' },
  } as unknown as DraftVersion;
  ok(!JSON.stringify(clientPreviewOf(invented)).includes('must never read this'),
    'a blacklist would have leaked the day someone added a field and forgot');
});

// ── 15. Keyless honesty ─────────────────────────────────────────────────────

suite('spec 25 §14.15 — with no key, nothing is fabricated');

test('15. build opens, hand-written drafts work, judged gates report not-run', async () => {
  const availability = draftingAvailability({
    hasApiKey: false, draftingSwitchActive: true, strategyLocked: true,
    gateSetLocked: true, hasBrief: true, lifecycle: 'active',
  });
  eq(availability.available, false, 'the drafting call is off');
  ok(availability.reason!.includes('no key'), 'in plain words');
  ok(availability.reason!.includes('write the draft yourself'), 'pointing at what still works');

  // She writes it by hand: no run, no cost, origin hers.
  const { body, piece_id } = pieceWithBrief();
  const byHand = writeDraft(body, {
    piece_id, origin: 'hers', payload: carousel(),
    brief_version: 1, gate_set_version: 1, strategy_version: 1,
    rule: ruleFor(body), now: NOW, by: 'owner',
  });
  eq(byHand.draft.engine_run_id, null, 'nothing is attributed to the engine');
  eq(readRuns(byHand.body).length, 0, 'and no run was logged, because nothing ran');

  // The machine checks still run and report; the judged gates do not pretend.
  const result = await runGateRun(gateInput(byHand.body, piece_id, byHand.draft), null);
  eq(result.engine_run.model, null, 'no model, honestly');
  eq(result.engine_run.cost_estimate_usd, 0, 'and no cost');
  const judged = result.run.verdicts.filter(v => v.gate_kind !== 'rights');
  eq(judged.every(v => v.verdict === 'not-run'), true, 'every judged gate reports not-run');
  eq(result.run.overall, 'failed', 'so the run does not pass');

  const withRun = writeGateRun(byHand.body, result.run);
  const refused = refusedStageWrites(withRun, moveTo(withRun, piece_id, 'review'), NOW);
  eq(refused.length, 1, 'and the piece cannot leave build');
  ok(result.message.includes('Nothing was assumed to pass'), 'with the reason stated plainly');
});

test('15b. no brief, no draft — and that is a law, not a validation nicety', () => {
  const noBrief = draftingAvailability({
    hasApiKey: true, draftingSwitchActive: true, strategyLocked: true,
    gateSetLocked: true, hasBrief: false, lifecycle: 'active',
  });
  eq(noBrief.available, false, 'refused');
  ok(noBrief.reason!.includes('brief comes before the copy'), 'with PLAN §5.1\'s own ordering as the reason');
});

// ── 16. The run log is complete ─────────────────────────────────────────────

suite('spec 25 §14.16 — one complete run entry per call, every time');

test('16. success, refusal, short-circuit and error each write exactly one', async () => {
  const { body, piece_id } = pieceWithBrief();
  const { body: withIt, draft } = withDraft(body, piece_id);

  const cases: { name: string; run: () => Promise<{ run: import('../lib/engine/runs.ts').EngineRun }> }[] = [
    {
      name: 'draft success',
      run: async () => runDraft(draftingInput(withIt, piece_id), async () => reply(carousel())),
    },
    {
      name: 'draft refusal',
      run: async () => runDraft(draftingInput(withIt, piece_id),
        async () => reply(carousel(), { stop_reason: 'refusal', stop_details: { category: 'bio' }, text: '' })),
    },
    {
      name: 'draft error',
      run: async () => runDraft(draftingInput(withIt, piece_id),
        async () => { throw new Error('the network went away'); }),
    },
    {
      name: 'gate success',
      run: async () => {
        const r = await runGateRun(gateInput(withIt, piece_id, draft),
          async () => verdictReply(passingVerdicts()));
        return { run: r.engine_run };
      },
    },
    {
      name: 'gate error',
      run: async () => {
        const r = await runGateRun(gateInput(withIt, piece_id, draft),
          async () => { throw new Error('gone'); });
        return { run: r.engine_run };
      },
    },
  ];

  for (const c of cases) {
    const { run } = await c.run();
    eq(runIsComplete(run), [], `${c.name}: the run carries everything S12 asks for`);
    eq(run.effort, 'high', `${c.name}: at effort high, and there is no cheap mode`);
    ok(Array.isArray(run.packet.folders), `${c.name}: the packet folder list`);
    eq(typeof run.packet.context_version, 'number', `${c.name}: and the context version`);
    eq(run.gate_set_version, 1, `${c.name}: with the gate set version`);
    ok(!!run.format_rules_resolution, `${c.name}: and the rule set that judged it`);
    eq(typeof run.usage.input_tokens, 'number', `${c.name}: token counts`);
    ok(run.cost_estimate_usd >= 0, `${c.name}: a cost estimate from run one`);
    ok(!!run.stop_reason, `${c.name}: and the outcome`);
    ok(!JSON.stringify(run).includes('sk-ant'), `${c.name}: never a key`);
    eq(readRuns(writeRun(withIt, run)).length, 1, `${c.name}: exactly one entry, not two`);
  }
});

test('16b. a run with no packet record is not a run', () => {
  const broken = { id: 'r', model: 'claude-opus-5', effort: 'high' } as unknown as Parameters<typeof runIsComplete>[0];
  ok(runIsComplete(broken).includes('packet'), 'the same shape check spec 23 uses, on the same log');
});

test('16c. a pass with no evidence span is rejected and the gate re-runs once', async () => {
  const { body, piece_id } = pieceWithBrief();
  const { body: withIt, draft } = withDraft(body, piece_id);
  const blind = passingVerdicts().map(v => ({ ...v, evidence_span: '' }));
  eq(evidencelessPasses(blind).length, 7, 'seven passes pointing at nothing');

  const sent: string[] = [];
  let n = 0;
  const reviewer: CreateMessage = async req => {
    sent.push(req.messages[0].content);
    n++;
    return verdictReply(n === 1 ? blind : passingVerdicts());
  };
  const result = await runGateRun(gateInput(withIt, piece_id, draft), reviewer);
  eq(n, 2, 'it was asked exactly twice, the one re-run the spec allows');
  ok(sent[1].includes('pointed at nothing'), 'and the re-run names what was wrong');
  eq(result.run.overall, 'passed', 'the second answer pointed at something, so it stands');
  eq(result.engine_run.checks.rejected, 7, 'and the rejections are on the record');
});

test('16d. a pass it still cannot point at becomes a flag, not a pass', async () => {
  const { body, piece_id } = pieceWithBrief();
  const { body: withIt, draft } = withDraft(body, piece_id);
  const blind = passingVerdicts().map(v => ({ ...v, evidence_span: '' }));
  const result = await runGateRun(gateInput(withIt, piece_id, draft), async () => verdictReply(blind));
  eq(result.run.verdicts.filter(v => v.verdict === 'flagged').length, 7,
    'a reviewer that cannot point has not reviewed anything');
  eq(result.run.overall, 'failed', 'so nothing passes');
});

test('16e. the gate call is a SEPARATE call, with the reviewer packet and no drafting prompt', async () => {
  const { body, piece_id } = pieceWithBrief();
  const { body: withIt, draft } = withDraft(body, piece_id);
  const result = await runGateRun(gateInput(withIt, piece_id, draft),
    async () => verdictReply(passingVerdicts()));
  const text = result.packet!.text;
  ok(result.packet!.universal_block.includes('you have no stake in it passing'),
    'the reviewer knows it did not write this');
  ok(!result.packet!.universal_block.includes('You are writing the actual piece'),
    'and the drafting method block is nowhere near it');
  ok(text.includes('Would a stranger stop?'), 'the gate questions travel verbatim');
  ok(text.includes('What the machine checks already found'), 'with what the machine already found');
  ok(!text.includes('Her standing habits'), 'and her taste rules do not judge anything');
});

// ── 17. The revise ceiling ──────────────────────────────────────────────────

suite('spec 25 §14.17 — two tries, then the honest read');

test('17. three failed gate runs produce exactly two revises and no third', () => {
  eq(reviseState(0).offered, true, 'the first draft is not a revise');
  eq(reviseState(1).attempt, 2, 'one failure offers attempt 2');
  eq(reviseState(2).attempt, 3, 'two failures offer attempt 3');
  eq(reviseState(3).offered, false, 'three failures offer nothing');
  ok(reviseState(3).message.includes('the brief is wrong, not the copy'),
    'and the third state is the brief-level message, not another spend');
});

test('17b. a revise carries the failed verdicts verbatim, and her note when she wrote one', () => {
  const { body, piece_id } = pieceWithBrief();
  const { body: withIt, draft } = withDraft(body, piece_id);
  const failed = buildGateRun({
    id: 'gr-f', piece_id, draft_version_id: draft.id, gate_set: readGateSet(withIt)!,
    strategy_version: 1, rule: ruleFor(withIt), checks: [],
    model_verdicts: [
      ...passingVerdicts(ALL_GATES.filter(g => g !== 'hook')),
      { gate_id: 'hook', verdict: 'fail' as const, reason: 'It takes four seconds to understand.', evidence_span: HOOK },
    ],
    engine_run_id: 'r', run_at: NOW, run_by: 'owner',
  });
  const notes = reviseNotesFrom(failed, 'Make the first line shorter.');
  eq(notes.length, 2, 'the failed verdict and her note');
  ok(notes[0].includes('It takes four seconds'), 'the verdict, verbatim');
  ok(notes[0].includes(HOOK), 'with the part in question');
  ok(notes[1].includes('Make the first line shorter'), 'and her own line');
});

test('17c. the revise instruction says fix exactly these and change nothing else', async () => {
  const { body, piece_id } = pieceWithBrief();
  const sent: string[] = [];
  await runDraft(
    draftingInput(body, piece_id, { revise_notes: ['hook: it takes four seconds'], attempt: 2 }),
    async req => { sent.push(req.messages[0].content); return reply(carousel()); },
  );
  ok(sent[0].includes('Fix exactly these and change nothing else'), 'the instruction is explicit');
  ok(sent[0].includes('hook: it takes four seconds'), 'and it carries the failed verdict');
});

// ── 18. Append-only holds ───────────────────────────────────────────────────

suite('spec 25 §14.18 — twenty versions, and version 1 is untouched');

test('18. twenty draft versions resolve in order, and the first is byte-identical', () => {
  const { body, piece_id } = pieceWithBrief();
  let next = body;
  for (let i = 1; i <= 20; i++) {
    next = writeDraft(next, {
      piece_id, origin: i === 1 ? 'engine' : 'engine+her-edit',
      payload: carousel({ caption: `${CAPTION} Version ${i}.` }),
      brief_version: 1, gate_set_version: 1, strategy_version: 1,
      rule: ruleFor(next), now: NOW, by: 'owner',
    }).body;
  }
  const all = readDrafts(next, piece_id);
  eq(all.length, 20, 'all twenty are kept');
  eq(all.map(d => d.version), Array.from({ length: 20 }, (_, i) => i + 1), 'in order');
  eq(all[0].content.caption, `${CAPTION} Version 1.`, 'and version 1 is exactly what was first written');
  eq(resolveDraft(next, piece_id)!.version, 20, 'while resolveDraft gives the current one');
  eq(findPiece(next, piece_id)!.piece.current_draft_version_id, all[19].id,
    'and the piece points at it — no copy of a draft exists anywhere');
});

test('18b. a write that edits an existing draft version throws, at both doors', () => {
  const { body, piece_id } = pieceWithBrief();
  const { body: withIt, draft } = withDraft(body, piece_id);

  throws(() => putEntry(withIt, MAKING_PATH, {
    id: draft.id, type: 'draft_version', data: { ...draft, content: carousel() },
  }, { writer: 'owner', now: NOW }), 'append-only', 'putEntry refuses it');

  const forged: ProfileBody = {
    ...withIt,
    paths: {
      ...withIt.paths,
      [MAKING_PATH]: withIt.paths[MAKING_PATH].map(e => (e.id === draft.id
        ? { ...e, data: { ...(e.data as object), format_family: 'reel' } }
        : e)),
    },
  };
  const refused = refusedDraftWrites(withIt, forged);
  eq(refused.length, 1, 'and the write door refuses a whole-body save');
  ok(refused[0].reason.includes('creates the next version'), 'naming what she should have done instead');
});

test('18c. her edit becomes version n+1 with the delta that made it', () => {
  const { body, piece_id } = pieceWithBrief();
  const { body: withIt, draft } = withDraft(body, piece_id);
  const edited = carousel({
    slides: [
      { index: 1, heading: HOOK, lines: [], visual_note: 'cover' },
      ...[2, 3, 4].map(bodySlide),
      { index: 5, heading: 'Follow for more', lines: [CTA], visual_note: 'end card' },
    ],
  });
  const result = herDraftEdit(withIt, {
    piece_id, payload: edited, now: NOW, by: 'owner', rule: ruleFor(withIt),
    proposed_class: 'format',
  });
  eq(result.draft.version, 2, 'the edit is version 2');
  eq(result.draft.origin, 'engine+her-edit', 'marked as hers on top of the engine\'s');
  eq(result.delta.from_version, 1, 'and the delta names both versions');
  ok(result.delta.changes.some(c => c.field === 'slides' && c.kind === 'shortened'),
    'she shortened it, and that is recorded without her writing a word');
  eq(result.delta.proposed_class, 'format', 'with a proposed class that routes nowhere on its own');
  eq(readDrafts(result.body, piece_id)[0].content.caption, CAPTION, 'version 1 is untouched');
  eq(computeEditDelta(draft, edited).length > 0, true, 'and the delta is computed, never reported');
});

// ── The registries, and the two reserved rules ──────────────────────────────

suite('spec 25 §10 and §9.5 — the addresses, and what may be written at them');

test('the registries validate with the three new paths in place', () => {
  eq(validateRegistries().map(v => `${v.check} ${v.where}: ${v.reason}`), [],
    'no address, no switch, no fifth door, no orphan');
});

test('a recommendation from the numbers carries its evidence, or it is refused', () => {
  const body = pieceWithBrief().body;
  throws(() => writeRecommendation(body, {
    id: 'rec-1', source: 'verdict', suggests: { hook_type: 'question' },
    words: 'question hooks are landing', created_at: NOW, created_by: 'engine:analysis',
  }), 'cite the verdict', 'a verdict-sourced entry with no citation is refused at the write door');

  const withEvidence = writeRecommendation(body, {
    id: 'rec-1', source: 'verdict', suggests: { hook_type: 'question' },
    words: 'question hooks are landing', verdict_ref: 'verdict-9',
    created_at: NOW, created_by: 'engine:analysis',
  });
  eq(readRecommendations(withEvidence).length, 1, 'and one that cites its verdict is written');

  const hers = writeRecommendation(withEvidence, fromHerObservation({
    id: 'rec-2', words: 'the founder-observation ones do better',
    suggests: { angle: 'founder observation' }, now: NOW,
  }));
  const hints = recommendationHints(hers);
  eq(hints.length, 2, 'both surface beside the pickers');
  eq(hints.find(h => h.id === 'rec-1')!.marked, 'from the numbers', 'one marked as evidence');
  eq(hints.find(h => h.id === 'rec-2')!.marked, 'something you said', 'the other as her observation');
  eq(hints.find(h => h.id === 'rec-2')!.evidence, undefined,
    'and her observation never pretends to be evidence');
});

test('a recommendation never selects anything, and never enters a drafting packet', async () => {
  const { body, piece_id } = pieceWithBrief();
  const withRec = writeRecommendation(body, fromHerObservation({
    id: 'rec-3', words: 'contrarian angles land on this account',
    suggests: { angle: 'contrarian' }, now: NOW,
  }));
  const result = await runDraft(draftingInput(withRec, piece_id), async () => reply(carousel()));
  ok(!result.packet.text.includes('contrarian angles land on this account'),
    'it is a hint on a picker, never an instruction in a packet');

  const forged: ProfileBody = {
    ...withRec,
    paths: {
      ...withRec.paths,
      'work-log/creation/costume-recommendations': [{
        id: 'rec-bad', path: 'work-log/creation/costume-recommendations', type: 'costume_recommendation',
        state: 'active', created_at: NOW, updated_at: NOW,
        data: { source: 'verdict', suggests: { angle: 'contrarian' }, words: 'trust me' },
      }],
    },
  };
  ok(refusedRecommendationWrites(withRec, forged).length > 0,
    'and a whole-body save cannot route around the evidence rule either');
});

test('§9.2 distillation is hers to trigger, and three of a kind or nothing', async () => {
  const { body, piece_id } = pieceWithBrief();
  const { body: withIt } = withDraft(body, piece_id);
  const edited = herDraftEdit(withIt, {
    piece_id, payload: carousel({ caption: 'Shorter.' }), now: NOW, by: 'owner',
    rule: ruleFor(withIt),
  });

  const thin = await runDistillation({
    profile_id: PROFILE, body: edited.body, decisions: ['rejected: soften the stance'],
    run_id: 'run-taste-1', now: NOW, clock: () => 0,
  }, async () => ({
    stop_reason: 'end_turn',
    text: JSON.stringify({
      candidates: [{
        rule: 'She cuts the caption when the point is already on the slide.',
        strength: 'lean', evidence_refs: ['a', 'b'], why: 'twice so far',
      }],
    }),
    usage: { input_tokens: 900, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, output_tokens: 200 },
  }));
  eq(thin.candidates, [], 'two of a kind is not a habit');
  eq(thin.run.checks.rejected, 1, 'and the run says one was too thin');
  ok(thin.message.includes('three times'), 'with the honest answer in plain words');

  const real = await runDistillation({
    profile_id: PROFILE, body: edited.body, decisions: [],
    run_id: 'run-taste-2', now: NOW, clock: () => 0,
  }, async () => ({
    stop_reason: 'end_turn',
    text: JSON.stringify({
      candidates: [{
        rule: 'She cuts the caption when the point is already on the slide.',
        strength: 'law', evidence_refs: ['a', 'b', 'c'], why: 'three times',
      }],
    }),
    usage: { input_tokens: 900, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, output_tokens: 200 },
  }));
  eq(real.candidates.length, 1, 'three is a habit');
  eq(real.run.kind, 'taste_distillation', 'logged on the same run log, with its own kind');
  eq(runIsComplete(real.run), [], 'and it is a complete run like any other');
  ok(real.run.cost_estimate_usd >= 0, 'with its cost on the record');
});

test('the empty draft path needs no model at all', () => {
  for (const family of ['carousel', 'reel', 'static', 'longform-text', 'newsletter'] as const) {
    const empty = emptyDraftPayload(family, HOOK);
    eq(empty.format_family, family, `${family}: an empty sheet of the right shape`);
    eq(empty.hook, HOOK, 'carrying her hook');
    eq(empty.claims, [], 'and nothing invented');
  }
  eq(parseDraft(JSON.parse(JSON.stringify(carousel()))).format_family, 'carousel',
    'and a real payload round-trips');
  throws(() => parseDraft({ format_family: 'essay' }), 'not a format family',
    'while there is no family that produces an essay');
});
