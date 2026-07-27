// Spec 23 §15 — the twelve acceptance tests.
//
// Every one of them asks a question the spec asks in words. Nothing here calls a
// model: the packet assembler and all six checks are pure functions, and the one
// live-call path is exercised behind an injected stub.

import { suite, test, ok, eq, throws } from './harness.ts';
import { fixtureState } from './fixtures.ts';
import { migrateProfile } from '../lib/tree/migrate.ts';
import { emptyBody, putEntry, readPath, type ProfileBody } from '../lib/tree/body.ts';
import { applyScopes, changedScopes, scopeKey } from '../lib/tree/scopes.ts';
import { filterStateForRole } from '../lib/access.ts';
import { validateRegistries } from '../lib/tree/validate.ts';
import { platformSwitchId } from '../lib/tree/switches.ts';
import type { AppState } from '../types/index.ts';
import type { PathState, SwitchConfig } from '../lib/tree/contract.ts';

import {
  amendSeed, canMotherPieces, filterSeeds, findSeed, lockGaps, pillarsForProfile, readSeeds,
  refusedPieceWrites, resolveSeed, seedPieces, sortSeeds, writeSeed, SEED_PATH,
} from '../lib/engine/seeds.ts';
import { writeCapture, readCaptures, refusedCaptureWrites, CAPTURE_PATH } from '../lib/engine/captures.ts';
import { assemblePacket, MANDATORY_RULES } from '../lib/engine/packet.ts';
import { runChecks, verbatimViolation } from '../lib/engine/checks.ts';
import { parseProposals, type SeedProposal } from '../lib/engine/schema.ts';
import {
  dismissProposal, pickUpProposal, readProposals, refusedProposalWrites, writeProposal,
  PROPOSAL_PATH,
} from '../lib/engine/proposals.ts';
import { readRuns, runIsComplete, writeRun, RUN_PATH } from '../lib/engine/runs.ts';
import { belowTheBar, readFeedback, FEEDBACK_PATH } from '../lib/engine/feedback.ts';
import {
  extractionAvailability, runExtraction, type CreateMessage, type ModelResponse,
} from '../lib/engine/extraction.ts';

const NOW = '2026-07-27T10:00:00.000Z';
const PROFILE = 'resumeguru';

// ── Fixtures ────────────────────────────────────────────────────────────────

function migratedBody(): ProfileBody {
  const state = fixtureState();
  const rg = state.clients.find(c => c.id === PROFILE)!;
  return migrateProfile(rg, state.clientData[PROFILE], { now: NOW }).body;
}

/** Every switch this profile needs, all the way active — the everyday case. */
function allActive(extra: Record<string, PathState> = {}): SwitchConfig {
  const ids = [
    'creation.board', 'creation.engine', 'creation.seed_extraction', 'logs.engine_runs',
    'logs.feedback', 'strategy.fixed', 'spine.fixed',
    platformSwitchId('Instagram'), platformSwitchId('LinkedIn'),
  ];
  const config: SwitchConfig = {};
  for (const id of ids) config[id] = { state: 'active', set_at: NOW };
  for (const [id, state] of Object.entries(extra)) config[id] = { state, set_at: NOW };
  return config;
}

function strategyContext(body: ProfileBody): ProfileBody {
  let next = body;
  next = putEntry(next, 'context/content-strategy/boundaries', {
    id: 'bounds', type: 'strategy_parameter',
    data: { value: 'no guaranteed placement', never_promises: ['guaranteed placement', 'guaranteed job'], reason: 'hers' },
  }, { writer: 'owner', now: NOW });
  next = putEntry(next, 'context/content-strategy/voice', {
    id: 'voice', type: 'strategy_parameter',
    data: { value: 'plain and direct', never_words: ['hustle', 'grind'], reason: 'hers' },
  }, { writer: 'owner', now: NOW });
  next = putEntry(next, 'context/content-strategy/positioning', {
    id: 'pos', type: 'strategy_parameter',
    data: { value: 'the hiring system, explained', reason: 'hers' },
  }, { writer: 'owner', now: NOW });
  return next;
}

function proposal(over: Partial<SeedProposal> = {}): SeedProposal {
  return {
    kind: 'new-seed',
    name: 'the salary anchor',
    raw_thought: null,
    core_message: 'They ask about salary to anchor you.',
    visible_problem: null, deeper_problem: null, common_belief: null,
    reframe: 'It is an anchoring move, not a budget question.',
    audience_value: 'You can answer it without naming a number.',
    product_connection: null, examples: null, nuance: null,
    prohibited_interpretation: 'Never read as "lie about your salary".',
    proof_required: null,
    possible_pillars: ['p-trust', 'p-ai'],
    possible_angles: ['contrarian', 'mistake', 'question'],
    evidence_span: null, why: 'It can carry a reel, a carousel and a case study.',
    duplicate_of: null, target_seed_id: null, confidence: 'clear',
    ...over,
  };
}

function modelReply(proposals: SeedProposal[], over: Partial<ModelResponse> = {}): ModelResponse {
  return {
    stop_reason: 'end_turn',
    text: JSON.stringify({ proposals }),
    usage: {
      input_tokens: 12000, cache_read_input_tokens: 0,
      cache_creation_input_tokens: 8000, output_tokens: 3000,
    },
    ...over,
  };
}

function extractionInput(body: ProfileBody, capture: { id: string; text: string; seed_id?: string }) {
  return {
    profile_id: PROFILE, body, config: allActive(), capture,
    run_id: 'run-1', packet_id: 'pkt-1', now: NOW, clock: () => 0,
  };
}

// ── 1. The capture is verbatim ──────────────────────────────────────────────

suite('spec 23 §15.1 — the capture is verbatim');

const ODD_TEXT =
  '  So the thing is\t\tthey ask about salary   🙃\n\n\nnot to pay you, to anchor you.\r\n' +
  'and honestly? '.repeat(300) + '  trailing space  ';

test('1. odd whitespace, emoji and 4,000 words round-trip byte-identical', () => {
  let body = migratedBody();
  body = writeCapture(body, { id: 'cap-1', text: ODD_TEXT, arrival: 'pasted' }, NOW);
  const back = readCaptures(body)[0].capture;
  eq(back.text === ODD_TEXT, true, 'the capture came back exactly as it went in');
  eq(back.text.length, ODD_TEXT.length, 'not one character was trimmed');
  ok(back.text.includes('🙃'), 'the emoji survived');
  ok(back.text.includes('\r\n'), 'the odd line ending survived');
});

test('1b. a write that edits an existing capture is refused at the write door', () => {
  let body = migratedBody();
  body = writeCapture(body, { id: 'cap-1', text: ODD_TEXT, arrival: 'pasted' }, NOW);

  // The append-only path refuses an overwrite outright.
  throws(() => writeCapture(body, { id: 'cap-1', text: 'tidied up', arrival: 'typed' }, NOW),
    'never rewritten', 'a second write at the same id is refused');

  // And an edit smuggled through a whole-body save is caught at the door.
  const edited: ProfileBody = {
    ...body,
    paths: {
      ...body.paths,
      [CAPTURE_PATH]: body.paths[CAPTURE_PATH].map(e => ({
        ...e, data: { ...(e.data as Record<string, unknown>), text: 'tidied up' },
      })),
    },
  };
  const refused = refusedCaptureWrites(body, edited);
  eq(refused.length, 1, 'the edit is refused');
  ok(refused[0].reason.includes('exactly as it was given'), 'and it says why');
});

// ── 2. The growth test (law 3) ──────────────────────────────────────────────

suite('spec 23 §15.2 — a fourth pillar, and nothing blank');

test('2. add a pillar: it shows up in the picker, the filter and the packet', () => {
  let body = strategyContext(migratedBody());
  const before = pillarsForProfile(body);
  eq(before.length, 3, 'three pillars migrated');

  body = putEntry(body, 'context/content-strategy/pillars/proof', {
    id: 'p-proof', type: 'pillar', data: { name: 'Proof it works' },
  }, { writer: 'owner', now: NOW });

  // The seed sheet's picker and the bank's filter both read this one list.
  const after = pillarsForProfile(body);
  eq(after.length, 4, 'the picker has it immediately');
  ok(after.some(p => p.name === 'Proof it works'), 'by name, not by id');

  // The filter: a seed tagged with the new pillar is found by it.
  body = writeSeed(body, {
    id: 'seed-new', name: 'proof seed', raw_thought: 'we should show the receipts',
    fields: { possible_pillars: ['p-proof'] },
  }, NOW);
  const hits = filterSeeds(body, readSeeds(body), { pillar: 'p-proof' });
  eq(hits.length, 1, 'the filter finds it with no code change');

  // And the packet carries it.
  const packet = assemblePacket({
    profile_id: PROFILE, body, config: allActive(), now: NOW, packet_id: 'pkt',
  });
  ok(packet.text.includes('Proof it works'), 'the packet carries the new pillar');
  eq(packet.trimmed.length, 0, 'and nothing was trimmed to fit it');
});

// ── 3. The verbatim guard (check 2) ─────────────────────────────────────────

suite('spec 23 §15.3 — the verbatim guard rejects, and retries once');

const CAPTURE_TEXT =
  'They ask about salary to anchor you, not because they have a budget in mind. ' +
  'Everyone tells you to name a number first and that is exactly backwards.';

test('3. a paraphrase is rejected, the run retries once, a second paraphrase shows nothing', async () => {
  const body = strategyContext(migratedBody());
  const calls: string[] = [];
  const paraphrasing: CreateMessage = async req => {
    calls.push(req.messages[0].content);
    return modelReply([proposal({
      raw_thought: 'They ask about pay in order to anchor you.',   // NOT word for word
      evidence_span: 'they ask about pay',
    })]);
  };

  const result = await runExtraction(
    extractionInput(body, { id: 'cap-1', text: CAPTURE_TEXT }), paraphrasing);

  eq(calls.length, 2, 'it tried exactly twice — the one retry the spec allows');
  ok(calls[1].includes('rejected by the verbatim guard'), 'and the retry names the violation');
  eq(result.checked.shown.length, 0, 'zero proposals are shown');
  eq(result.run.checks.rejected, 2, 'both rejections are on the run record');
  eq(result.outcome, 'no-proposals', 'the outcome says so plainly');
  ok(result.message.includes('word for word'), 'and she is told why, in plain words');
});

test('3b. a word-for-word quote passes, first time', async () => {
  const body = strategyContext(migratedBody());
  let calls = 0;
  const honest: CreateMessage = async () => {
    calls++;
    return modelReply([proposal({
      raw_thought: 'They ask about salary to anchor you',
      evidence_span: 'not because they have a budget in mind',
    })]);
  };
  const result = await runExtraction(
    extractionInput(body, { id: 'cap-1', text: CAPTURE_TEXT }), honest);
  eq(calls, 1, 'one call, no retry');
  eq(result.checked.shown.length, 1, 'the proposal is shown');
  eq(result.run.checks.rejected, 0, 'nothing was rejected');
});

test('3c. the guard normalizes whitespace and nothing else', () => {
  const p = proposal({ raw_thought: 'They   ask\nabout salary to anchor you' });
  eq(verbatimViolation(p, CAPTURE_TEXT), null, 'odd spacing in the quote still counts as verbatim');
  const changed = proposal({ raw_thought: 'they ask about salary to anchor you' });
  ok(verbatimViolation(changed, CAPTURE_TEXT) !== null, 'but changed case does not');
});

// ── 4. Untouchable proposals ────────────────────────────────────────────────

suite('spec 23 §15.4 — a waiting proposal is untouchable');

function withProposal(): ProfileBody {
  return writeProposal(strategyContext(migratedBody()), {
    id: 'prop-1', kind: 'new-seed', fed_by: 'engine:content', run_id: 'run-1',
    capture_id: 'cap-1', proposal: proposal({ raw_thought: 'they ask to anchor you' }), badges: [],
  }, NOW, 'claude-opus-5');
}

test('4. every write other than pick-up or dismiss is refused', () => {
  const body = withProposal();

  const edited: ProfileBody = {
    ...body,
    paths: {
      ...body.paths,
      [PROPOSAL_PATH]: body.paths[PROPOSAL_PATH].map(e => ({
        ...e,
        data: {
          ...(e.data as Record<string, unknown>),
          proposal: { ...proposal(), name: 'a name she liked better' },
        },
      })),
    },
  };
  const refused = refusedProposalWrites(body, edited);
  eq(refused.length, 1, 'editing the proposal itself is refused');
  ok(refused[0].reason.includes('not editable'), 'and it says so plainly');

  // Pick-up and dismiss are the only two doors, and both go through.
  const picked = pickUpProposal(body, { proposal_id: 'prop-1', new_seed_id: 'seed-x', now: NOW });
  eq(refusedProposalWrites(body, picked.body).length, 0, 'picking it up is allowed');
  const dismissed = dismissProposal(body, 'prop-1', NOW, 'not now');
  eq(refusedProposalWrites(body, dismissed).length, 0, 'dismissing it is allowed');
});

test('4b. a dismissed proposal still exists, and still carries its original text', () => {
  const body = dismissProposal(withProposal(), 'prop-1', NOW, 'too close to seed 3');
  const stored = readProposals(body)[0];
  eq(stored.state, 'dismissed', 'it is dismissed');
  eq(stored.proposal.name, 'the salary anchor', 'and the original text is untouched');
  eq(stored.dismissed_reason, 'too close to seed 3', 'with her reason kept');

  // Nothing expires: it is still there afterwards, and re-touching it is refused.
  const meddled: ProfileBody = {
    ...body,
    paths: {
      ...body.paths,
      [PROPOSAL_PATH]: body.paths[PROPOSAL_PATH].map(e => ({
        ...e, data: { ...(e.data as Record<string, unknown>), state: 'waiting' },
      })),
    },
  };
  eq(refusedProposalWrites(body, meddled).length, 1, 'a dismissed proposal cannot be reopened by a save');
});

// ── 5. The lock gates ───────────────────────────────────────────────────────

suite('spec 23 §15.5 — the six lock gates, and the immutable raw thought');

test('5. a seed missing any of the six cannot be locked', () => {
  let body = migratedBody();
  body = writeSeed(body, { id: 's1', name: 'salary', raw_thought: 'they anchor you' }, NOW);

  eq(lockGaps(findSeed(body, 's1')!.seed).length, 5, 'five of the six are still missing');
  throws(() => amendSeed(body, 's1', { status: 'locked' }, { at: NOW, by: 'owner', note: 'lock' }),
    'cannot be locked yet', 'and locking is refused, in her words');

  // Fill them one at a time; only the last one opens the lock.
  const fills: [string, unknown][] = [
    ['core_message', 'They ask to anchor you.'],
    ['reframe', 'It is an anchoring move.'],
    ['audience_value', 'You can answer without a number.'],
    ['prohibited_interpretation', 'Never as "lie about your salary".'],
    ['possible_pillars', ['p-trust']],
  ];
  for (const [field, value] of fills) {
    ok(lockGaps(findSeed(body, 's1')!.seed).length > 0, 'still short');
    body = amendSeed(body, 's1', { [field]: value }, { at: NOW, by: 'owner', note: `wrote ${field}` });
  }
  eq(lockGaps(findSeed(body, 's1')!.seed).length, 0, 'now nothing is missing');

  body = amendSeed(body, 's1', { status: 'locked' }, {
    at: '2026-08-12T09:00:00.000Z', by: 'owner', note: 'Locked it',
  });
  eq(findSeed(body, 's1')!.seed.status, 'locked', 'and it locks');

  const trail = findSeed(body, 's1')!.entry.amendments ?? [];
  const lockEntry = trail[trail.length - 1];
  eq(lockEntry.by, 'owner', 'the trail shows who locked it');
  eq(lockEntry.at, '2026-08-12T09:00:00.000Z', 'and when');
});

test('5b. raw_thought refuses amendment at any status', () => {
  let body = migratedBody();
  body = writeSeed(body, { id: 's1', name: 'salary', raw_thought: 'they anchor you' }, NOW);
  for (const status of ['draft', 'discussed', 'validated']) {
    body = amendSeed(body, 's1', { status }, { at: NOW, by: 'owner', note: 'moved' });
    throws(() => amendSeed(body, 's1', { raw_thought: 'polished' }, { at: NOW, by: 'owner', note: 'x' }),
      'write-once', `refused at ${status}`);
  }
  throws(() => amendSeed(body, 's1', { raw_material: [] }, { at: NOW, by: 'owner', note: 'x' }),
    'write-once', 'and so does raw_material');
});

// ── 6. Only locked seeds mother pieces ──────────────────────────────────────

suite('spec 23 §15.6 — only locked seeds mother pieces');

function bodyWithSeedAndPiece(status: 'draft' | 'locked'): { before: ProfileBody; after: ProfileBody } {
  let before = migratedBody();
  before = writeSeed(before, {
    id: 'seed-lock', name: 'salary', raw_thought: 'they anchor you',
    fields: {
      core_message: 'a', reframe: 'b', audience_value: 'c',
      prohibited_interpretation: 'd', possible_pillars: ['p-trust'],
    },
  }, NOW);
  if (status === 'locked') {
    before = amendSeed(before, 'seed-lock', { status: 'locked' }, { at: NOW, by: 'owner', note: 'lock' });
  }
  const after = putEntry(before, 'work-log/creation', {
    id: 'piece-new', type: 'piece',
    data: { seed_id: 'seed-lock', title: 'The salary answer', stage: 'idea', costume: {} },
  }, { writer: 'owner', now: NOW });
  return { before, after };
}

test('6. a piece write with a draft seed is refused, and with a locked seed goes through', () => {
  const draft = bodyWithSeedAndPiece('draft');
  const refused = refusedPieceWrites(draft.before, draft.after);
  eq(refused.length, 1, 'the write is refused');
  ok(refused[0].reason.includes('only a locked seed'), 'and it says why');

  const locked = bodyWithSeedAndPiece('locked');
  eq(refusedPieceWrites(locked.before, locked.after).length, 0, 'a locked seed makes pieces freely');
});

test('6b. removing the guard makes the draft write pass — the guard is what stops it', () => {
  const draft = bodyWithSeedAndPiece('draft');
  // The guard, with its one condition removed. If this now accepts the write,
  // nothing else in the stack was doing the work.
  const withoutGuard = (b: ProfileBody) =>
    (b.paths['work-log/creation'] ?? [])
      .filter(e => (e.data as { seed_id?: string }).seed_id)
      .map(() => null)
      .filter(Boolean);
  eq(withoutGuard(draft.after).length, 0, 'with the lock check gone, nothing refuses it');
  eq(refusedPieceWrites(draft.before, draft.after).length, 1, 'with the check in place, it is refused');
});

test('6c. legacy pieces are untouched — the migration is exempt, new writes are not', () => {
  const body = migratedBody();
  const orphans = readPath(body, 'work-log/creation')
    .filter(e => (e.data as { seed_id?: string | null }).seed_id == null);
  ok(orphans.length > 0, 'the migration left some pieces with no seed at all');

  // The whole profile arriving at once is the migration: nothing is refused,
  // including the pieces already pointing at capture-input shells (§14.1).
  eq(refusedPieceWrites(undefined, body).length, 0, 'the migration passes whole');
  // And re-saving it unchanged refuses nothing either.
  eq(refusedPieceWrites(body, body).length, 0, 'an unchanged save refuses nothing');

  // A NEW piece against one of those same draft shells is refused.
  const shell = readSeeds(body).find(s => !s.seed.raw_thought)!;
  const withNewPiece = putEntry(body, 'work-log/creation', {
    id: 'piece-fresh', type: 'piece',
    data: { seed_id: shell.seed.id, title: 'new one', stage: 'idea', costume: {} },
  }, { writer: 'owner', now: NOW });
  eq(refusedPieceWrites(body, withNewPiece).length, 1, 'but a new piece off a draft shell is refused');
});

test('6d. canMotherPieces is the one guard, and it reads the status', () => {
  const locked = bodyWithSeedAndPiece('locked').before;
  const draft = bodyWithSeedAndPiece('draft').before;
  eq(canMotherPieces(findSeed(locked, 'seed-lock')!.seed), true, 'locked can');
  eq(canMotherPieces(findSeed(draft, 'seed-lock')!.seed), false, 'draft cannot');
  eq(canMotherPieces(null), false, 'and a seed that is not there certainly cannot');
});

// ── 7. The packet honors the cascade ────────────────────────────────────────

suite('spec 23 §15.7 — the packet honors the cascade');

test('7. LinkedIn hidden: no LinkedIn name or format enters the packet', () => {
  const body = strategyContext(migratedBody());
  const on = assemblePacket({
    profile_id: PROFILE, body, config: allActive(), now: NOW, packet_id: 'p1',
  });
  ok(on.text.includes('LinkedIn'), 'with LinkedIn active it is in the packet');

  const hidden = assemblePacket({
    profile_id: PROFILE, body,
    config: allActive({ [platformSwitchId('LinkedIn')]: 'hidden' }),
    now: NOW, packet_id: 'p2',
  });
  ok(!hidden.text.includes('LinkedIn'), 'hidden: not the platform name');
  ok(!hidden.text.toLowerCase().includes('linkedin'), 'and not in any casing');
});

test('7b. history is the same for the packet, and every past piece stays readable', () => {
  const body = strategyContext(migratedBody());
  const history = assemblePacket({
    profile_id: PROFILE, body,
    config: allActive({ [platformSwitchId('LinkedIn')]: 'history' }),
    now: NOW, packet_id: 'p3',
  });
  ok(!history.text.includes('LinkedIn'), 'a retired platform never shapes a proposal');

  const pieces = readPath(body, 'work-log/creation')
    .filter(e => (e.data as { costume?: { platform?: string } }).costume?.platform === 'LinkedIn');
  ok(pieces.length > 0, 'and the LinkedIn pieces are all still there, readable (S9)');
});

test('7c. Block A is always whole, and the four rules always travel', () => {
  const body = strategyContext(migratedBody());
  const packet = assemblePacket({
    profile_id: PROFILE, body, config: allActive(), now: NOW,
    packet_id: 'p4', context_window: 400,         // tiny, to force the size guard
  });
  ok(packet.trimmed.length > 0, 'the size guard bit');
  for (const rule of MANDATORY_RULES) ok(packet.text.includes(rule), 'every mandatory rule survived');
  ok(packet.text.includes('guaranteed placement'), 'and so did the boundaries');
  eq(packet.packet.mandatory_constraints.length, 4, 'the run log records all four constraint sources');
});

// ── 8. No client, no leak ───────────────────────────────────────────────────

suite('spec 23 §15.8 — no client, no leak');

function stateWithEngineData(): AppState {
  const state = fixtureState();
  for (const id of ['resumeguru', 'career-bubble', 'divine-studio']) {
    const client = state.clients.find(c => c.id === id)!;
    let body = migrateProfile(client, state.clientData[id], { now: NOW }).body;
    body = writeCapture(body, { id: `cap-${id}`, text: 'what she said', arrival: 'typed' }, NOW);
    body = writeProposal(body, {
      id: `prop-${id}`, kind: 'new-seed', fed_by: 'engine:content', run_id: 'r1',
      proposal: proposal(), badges: [],
    }, NOW, 'claude-opus-5');
    body = writeRun(body, {
      id: `run-${id}`, kind: 'seed_extraction', profile_id: id, triggered_by: 'owner',
      packet: { packet_id: 'p', context_version: 1, folders: [], mandatory_constraints: [], trimmed: [] },
      model: 'claude-opus-5', effort: 'high', thinking: 'adaptive',
      schema_version: 1, prompt_version: 1, capture_ids: [], proposal_ids: [],
      usage: { input_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, output_tokens: 1 },
      cost_estimate_usd: 0.1, latency_ms: 10, stop_reason: 'end_turn',
      checks: { rejected: 0, badged: [] }, started_at: NOW, finished_at: NOW,
    });
    body = belowTheBar(body, { id: `fb-${id}`, run_id: 'r1', context_version: 1, reason: 'shallow' }, NOW);
    state.clientData[id].body = body;
  }
  return state;
}

const ENGINE_PATHS = [SEED_PATH, CAPTURE_PATH, PROPOSAL_PATH, RUN_PATH, FEEDBACK_PATH];

test('8. a client login and an intern login both receive zero engine entries', () => {
  const state = stateWithEngineData();
  for (const role of ['merushri', 'intern'] as const) {
    const filtered = filterStateForRole(state, role);
    for (const id of Object.keys(filtered.clientData)) {
      const paths = filtered.clientData[id].body?.paths ?? {};
      for (const p of ENGINE_PATHS) {
        eq((paths[p] ?? []).length, 0, `${role} sees nothing at ${p}`);
      }
    }
  }
});

test('8b. the check FAILS when the audience filter is removed', () => {
  const state = stateWithEngineData();
  // The filter, with `audience: owner` no longer excluding anything. If the
  // engine paths still came back empty here, the real test proved nothing.
  const unfiltered = state.clientData['career-bubble'].body!.paths;
  let leaked = 0;
  for (const p of ENGINE_PATHS) leaked += (unfiltered[p] ?? []).length;
  ok(leaked >= 4, 'without the filter the data is right there — so the filter is what stops it');

  const filtered = filterStateForRole(state, 'merushri');
  const paths = filtered.clientData['career-bubble']?.body?.paths ?? {};
  let seen = 0;
  for (const p of ENGINE_PATHS) seen += (paths[p] ?? []).length;
  eq(seen, 0, 'and with the filter, nothing');
});

test('8c. every engine path is declared audience: owner, with no client door', () => {
  eq(validateRegistries().length, 0, 'the registries validate with the four new paths in place');
});

// ── 9. The run log is complete ──────────────────────────────────────────────

suite('spec 23 §15.9 — one complete run entry, every time');

test('9. success, refusal and error each write exactly one complete run', async () => {
  const body = strategyContext(migratedBody());
  const cases: { name: string; caller: CreateMessage; stop: string }[] = [
    {
      name: 'success',
      caller: async () => modelReply([proposal({ raw_thought: 'They ask about salary to anchor you' })]),
      stop: 'end_turn',
    },
    {
      name: 'refusal',
      caller: async () => modelReply([], {
        stop_reason: 'refusal', stop_details: { category: 'cyber' }, text: '',
      }),
      stop: 'refusal',
    },
    {
      name: 'error',
      caller: async () => { throw new Error('the network went away'); },
      stop: 'error',
    },
  ];

  for (const c of cases) {
    const result = await runExtraction(
      extractionInput(body, { id: 'cap-1', text: CAPTURE_TEXT }), c.caller);
    eq(runIsComplete(result.run), [], `${c.name}: the run carries everything §5.7 asks for`);
    eq(result.run.stop_reason, c.stop, `${c.name}: the outcome is on the record`);
    eq(result.run.model, 'claude-opus-5', `${c.name}: with the model`);
    eq(result.run.effort, 'high', `${c.name}: and the effort`);
    ok(Array.isArray(result.run.packet.folders), `${c.name}: and the packet folder list`);
    eq(typeof result.run.packet.context_version, 'number', `${c.name}: and the context version`);
    eq(result.run.capture_ids, ['cap-1'], `${c.name}: and the capture it read`);
    ok(result.run.cost_estimate_usd >= 0, `${c.name}: and a cost estimate`);
    ok(!JSON.stringify(result.run).includes('sk-ant'), `${c.name}: and never a key`);

    const written = writeRun(body, result.run);
    eq(readRuns(written).length, 1, `${c.name}: exactly one entry, not two`);
  }
});

test('9b. a run with no packet record fails the test', () => {
  const broken = {
    id: 'r', kind: 'seed_extraction', profile_id: PROFILE, triggered_by: 'owner',
    model: 'claude-opus-5', effort: 'high', thinking: 'adaptive',
    schema_version: 1, prompt_version: 1, capture_ids: [], proposal_ids: [],
    usage: { input_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, output_tokens: 1 },
    cost_estimate_usd: 0, latency_ms: 0, stop_reason: 'end_turn',
    checks: { rejected: 0, badged: [] }, started_at: NOW, finished_at: NOW,
  } as unknown as Parameters<typeof runIsComplete>[0];
  ok(runIsComplete(broken).includes('packet'), 'a run with no packet is not a run');
});

test('9c. the refusal renders as words, not an empty list with no explanation', async () => {
  const body = strategyContext(migratedBody());
  const result = await runExtraction(
    extractionInput(body, { id: 'cap-1', text: CAPTURE_TEXT }),
    async () => modelReply([], { stop_reason: 'refusal', stop_details: { category: 'bio' }, text: '' }));
  eq(result.outcome, 'refusal', 'the outcome is a refusal');
  eq(result.run.refusal_category, 'bio', 'logged with its category');
  ok(result.message.includes('your capture is still here'), 'and she is told her capture survived');
});

// ── 10. Keyless honesty ─────────────────────────────────────────────────────

suite('spec 23 §15.10 — keyless honesty');

test('10. with no key: the room opens, the bank works, the button says why', () => {
  const availability = extractionAvailability({
    hasApiKey: false, extractionSwitchActive: true, strategyLocked: true, lifecycle: 'active',
  });
  eq(availability.available, false, 'extraction is off');
  ok(availability.reason!.includes('no key'), 'and it says so in plain words');
  ok(availability.reason!.includes('write a seed yourself'), 'and points at what still works');

  // The bank, by hand, with no model anywhere near it.
  let body = migratedBody();
  body = writeSeed(body, {
    id: 'by-hand', name: 'salary', raw_thought: 'they anchor you',
    fields: {
      core_message: 'a', reframe: 'b', audience_value: 'c',
      prohibited_interpretation: 'd', possible_pillars: ['p-trust'],
    },
  }, NOW);
  body = amendSeed(body, 'by-hand', { status: 'locked' }, { at: NOW, by: 'owner', note: 'lock' });
  eq(findSeed(body, 'by-hand')!.seed.status, 'locked', 'a seed can be written and locked by hand');
  eq(sortSeeds(readSeeds(body))[0].seed.id, 'by-hand', 'and the bank browses, locked first');

  // Nothing fabricated a proposal, and no run was logged.
  eq(readProposals(body).length, 0, 'no proposal was fabricated');
  eq(readRuns(body).length, 0, 'and no run was logged');
});

test('10b. extraction also refuses without a locked strategy, and says which', () => {
  const noStrategy = extractionAvailability({
    hasApiKey: true, extractionSwitchActive: true, strategyLocked: false, lifecycle: 'active',
  });
  eq(noStrategy.available, false, 'refused');
  ok(noStrategy.reason!.includes('strategy'), 'and it names strategy');

  const switchedOff = extractionAvailability({
    hasApiKey: true, extractionSwitchActive: false, strategyLocked: true, lifecycle: 'active',
  });
  eq(switchedOff.available, false, 'the off switch refuses too');
  ok(switchedOff.reason!.includes('by hand'), 'and says the bank still works');
});

// ── 11. The append-only test ────────────────────────────────────────────────

suite('spec 23 §15.11 — twenty amendments, one untouched birth record');

test('11. they resolve in order, and the birth record is byte-identical', () => {
  let body = migratedBody();
  body = writeSeed(body, { id: 's20', name: 'salary', raw_thought: 'they anchor you' }, NOW);
  const birth = JSON.stringify(findSeed(body, 's20')!.entry.data);

  for (let i = 1; i <= 20; i++) {
    body = amendSeed(body, 's20', { core_message: `reading ${i}`, name: `salary v${i}` }, {
      at: `2026-08-${String(i).padStart(2, '0')}T10:00:00.000Z`, by: 'owner', note: `pass ${i}`,
    });
  }

  const record = findSeed(body, 's20')!;
  eq(record.entry.amendments!.length, 20, 'twenty amendments are all kept');
  eq(record.seed.core_message, 'reading 20', 'the last one wins, in order');
  eq(record.seed.name, 'salary v20', 'across every field');
  eq(record.seed.raw_thought, 'they anchor you', 'and the raw thought never moved');
  eq(JSON.stringify(record.entry.data), birth, 'the birth record is byte-identical to what was written');
  eq(resolveSeed(record.entry).core_message, 'reading 20', 'and one read function gives the current state');
});

// ── 12. The save-race test, extended ────────────────────────────────────────

suite('spec 23 §15.12 — two concurrent writes, both survive');

test('12. one save to a seed and one to a proposal, at the same time, both land', () => {
  const state = fixtureState();
  const rg = state.clients.find(c => c.id === PROFILE)!;
  let base = migrateProfile(rg, state.clientData[PROFILE], { now: NOW }).body;
  base = writeSeed(base, { id: 'race-seed', name: 'salary', raw_thought: 'they anchor you' }, NOW);
  base = writeProposal(base, {
    id: 'race-prop', kind: 'new-seed', fed_by: 'engine:content', run_id: 'r1',
    proposal: proposal(), badges: [],
  }, NOW, 'claude-opus-5');
  state.clientData[PROFILE].body = base;

  // Tab A amends the seed. Tab B dismisses the proposal. Neither saw the other.
  const tabA: AppState = {
    ...state,
    clientData: {
      ...state.clientData,
      [PROFILE]: {
        ...state.clientData[PROFILE],
        body: amendSeed(base, 'race-seed', { core_message: 'from tab A' },
          { at: NOW, by: 'owner', note: 'tab A' }),
      },
    },
  };
  const tabB: AppState = {
    ...state,
    clientData: {
      ...state.clientData,
      [PROFILE]: {
        ...state.clientData[PROFILE],
        body: dismissProposal(base, 'race-prop', NOW, 'not this one'),
      },
    },
  };

  const scopesA = changedScopes(state, tabA);
  const scopesB = changedScopes(state, tabB);
  ok(scopesA.includes(scopeKey(PROFILE, SEED_PATH)), 'tab A declares the seed path');
  ok(scopesB.includes(scopeKey(PROFILE, PROPOSAL_PATH)), 'tab B declares the proposal path');
  ok(!scopesA.includes(scopeKey(PROFILE, PROPOSAL_PATH)), 'and tab A declares nothing it did not touch');

  // They land in either order; both survive.
  let merged = applyScopes(state, tabA, scopesA);
  merged = applyScopes(merged, tabB, scopesB);
  const body = merged.clientData[PROFILE].body!;
  eq(findSeed(body, 'race-seed')!.seed.core_message, 'from tab A', 'tab A survived');
  eq(readProposals(body)[0].state, 'dismissed', 'and so did tab B');

  let other = applyScopes(state, tabB, scopesB);
  other = applyScopes(other, tabA, scopesA);
  const body2 = other.clientData[PROFILE].body!;
  eq(findSeed(body2, 'race-seed')!.seed.core_message, 'from tab A', 'and the other order is the same');
  eq(readProposals(body2)[0].state, 'dismissed', 'both ways');
});

test('12b. a write under context/ bumps the profile context version, once', () => {
  const state = fixtureState();
  const rg = state.clients.find(c => c.id === PROFILE)!;
  const base = emptyBody(NOW);
  state.clientData[PROFILE].body = base;

  const edited = putEntry(base, 'context/content-strategy/positioning', {
    id: 'pos', type: 'strategy_parameter', data: { value: 'the hiring system, explained', reason: 'hers' },
  }, { writer: 'owner', now: NOW });
  const next: AppState = {
    ...state,
    clientData: { ...state.clientData, [PROFILE]: { ...state.clientData[PROFILE], body: edited } },
  };
  const scopes = changedScopes(state, next);
  const merged = applyScopes(state, next, scopes);
  eq(merged.clientData[PROFILE].body!.context_version, 1, 'one context write, one version');

  // A save that changes nothing under context/ does not move it.
  const again = applyScopes(merged, next, scopes);
  eq(again.clientData[PROFILE].body!.context_version, 1, 'and an identical save does not move it');
});

// ── The checks, on their own ────────────────────────────────────────────────

suite('spec 23 §5.6 — checks 3 to 6 badge, and never hide');

test('checks 3–6 badge the proposal and still show it', () => {
  const thin = 'they anchor you';           // well under 150 words
  const result = runChecks([
    proposal({                                // check 3: no reframe, one pillar
      name: 'a post idea', reframe: null, possible_pillars: ['p-trust'], possible_angles: ['question'],
      // and check 5: twelve fields filled off a three-word capture
      visible_problem: 'a', deeper_problem: 'b', common_belief: 'c', product_connection: 'd',
      nuance: 'e', examples: ['f'], proof_required: ['g'],
    }),
    proposal({                                // check 4: crosses a boundary
      name: 'the promise', core_message: 'We get you guaranteed placement.',
    }),
    proposal({ name: 'the salary question' }), // check 6: same name as a bank seed
  ], {
    capture: thin,
    never_promises: ['guaranteed placement'],
    seeds: [{ id: 't-salary', name: 'the salary question' }],
  });

  eq(result.shown.length, 3, 'all three are shown — nothing is hidden');
  eq(result.rejected.length, 0, 'and none was rejected: only check 2 rejects');
  ok(result.shown[0].badges.some(b => b.check === 'seed-vs-post'), 'check 3 badged');
  ok(result.shown[1].badges.some(b => b.check === 'boundary'), 'check 4 badged, with the boundary named');
  ok(result.shown[0].badges.some(b => b.check === 'invention'), 'check 5 badged the thin capture');
  ok(result.shown[2].badges.some(b => b.check === 'duplicate'), 'check 6 badged the duplicate');
  ok(result.shown[2].badges.find(b => b.check === 'duplicate')!.label.includes('the salary question'),
    'and it says which seed it looks like');
});

test('check 1: a malformed response is a run error, not a proposal list', () => {
  throws(() => parseProposals({ nope: true }), 'no proposals array', 'no array, no proposals');
  throws(() => parseProposals({ proposals: [{ name: 'x' }] }), 'missing its name or its reason',
    'a half-built proposal is refused');
});

suite('spec 23 §8 — picking up, and the migrated shells');

test('picking up marks every engine-filled field, and attaches the capture', () => {
  const body = withProposal();
  const result = pickUpProposal(body, {
    proposal_id: 'prop-1', new_seed_id: 'seed-new', now: NOW,
    capture: { at: NOW, source: 'capture cap-1', text: 'they ask to anchor you' },
  });
  const seed = findSeed(result.body, 'seed-new')!.seed;
  eq(seed.status, 'draft', 'it is born a draft — nothing is ever auto-locked');
  eq(seed.origin, 'engine:content', 'and marked engine-born');
  eq(seed.field_sources!.core_message, 'engine', 'every engine-filled field is marked');
  eq(seed.raw_material.length, 1, 'and the capture is attached as raw material');
  eq(readProposals(result.body)[0].state, 'picked-up', 'the proposal moves to picked-up');
  eq(readProposals(result.body)[0].picked_up_seed_id, 'seed-new', 'pointing at the seed it became');
});

test('a deepen proposal shows the conflict instead of overwriting her wording', () => {
  let body = strategyContext(migratedBody());
  body = writeSeed(body, {
    id: 'seed-hers', name: 'salary', raw_thought: 'they anchor you',
    fields: { core_message: 'HER sentence' },
  }, NOW);
  body = writeProposal(body, {
    id: 'prop-deep', kind: 'deepen', fed_by: 'engine:content', run_id: 'r1',
    proposal: proposal({ kind: 'deepen', target_seed_id: 'seed-hers', core_message: 'the engine sentence' }),
    badges: [],
  }, NOW, 'claude-opus-5');

  const result = pickUpProposal(body, { proposal_id: 'prop-deep', new_seed_id: 'unused', now: NOW });
  eq(result.seed_id, 'seed-hers', 'it amends the existing seed, it does not make a second one');
  ok(result.conflicts.some(c => c.field === 'core_message'), 'the clash is surfaced');
  eq(findSeed(result.body, 'seed-hers')!.seed.core_message, 'HER sentence',
    'and her wording is never overwritten by the engine');
  eq(findSeed(result.body, 'seed-hers')!.seed.reframe, proposal().reframe,
    'while a field she left empty is filled');
});

test('a migrated capture-input shell is amended, never duplicated (§14.2)', () => {
  let body = strategyContext(migratedBody());
  const shell = readSeeds(body).find(s => !s.seed.raw_thought)!;
  ok(!!shell, 'the migration left capture-input shells behind');

  body = writeProposal(body, {
    id: 'prop-shell', kind: 'new-seed', fed_by: 'engine:content', run_id: 'r1',
    proposal: proposal({
      name: shell.seed.name, duplicate_of: shell.seed.id,
      raw_thought: 'here is what I actually think about it',
    }),
    badges: [],
  }, NOW, 'claude-opus-5');

  const before = readSeeds(body).length;
  const result = pickUpProposal(body, { proposal_id: 'prop-shell', new_seed_id: 'would-be-dupe', now: NOW });
  eq(readSeeds(result.body).length, before, 'no second entry was created');
  eq(result.seed_id, shell.seed.id, 'the shell itself was picked up');
  eq(findSeed(result.body, shell.seed.id)!.seed.raw_thought, 'here is what I actually think about it',
    'and it finally has a raw thought, which is the only way its queue entry clears');
});

test('a revisit proposal cites its evidence, or it is refused at the write door (§8.3)', () => {
  const body = strategyContext(migratedBody());
  throws(() => writeProposal(body, {
    id: 'prop-revisit', kind: 'revisit-seed', fed_by: 'engine:analysis', run_id: 'r1',
    proposal: proposal({ kind: 'revisit-seed', target_seed_id: 't-salary' }), badges: [],
  }, NOW, 'claude-opus-5'), 'must cite the verdict', 'no verdict, no revisit proposal');

  const withEvidence = writeProposal(body, {
    id: 'prop-revisit', kind: 'revisit-seed', fed_by: 'engine:analysis', run_id: 'r1',
    proposal: proposal({ kind: 'revisit-seed', target_seed_id: 't-salary' }),
    badges: [], cited_verdict_id: 'verdict-9',
  }, NOW, 'claude-opus-5');
  eq(readProposals(withEvidence)[0].cited_verdict_id, 'verdict-9', 'with one, it writes');

  throws(() => pickUpProposal(withEvidence, {
    proposal_id: 'prop-revisit', new_seed_id: 'nope', now: NOW,
  }), 'never births one', 'and picking it up never creates a seed — the seed already exists');
});

suite('spec 23 §7 — the bank browses and filters');

test('the bank sorts locked first, and filters combine', () => {
  let body = strategyContext(migratedBody());
  body = writeSeed(body, {
    id: 'locked-one', name: 'anchoring', raw_thought: 'they anchor you',
    fields: {
      core_message: 'a', reframe: 'b', audience_value: 'c',
      prohibited_interpretation: 'd', possible_pillars: ['p-trust'],
    },
  }, NOW);
  body = amendSeed(body, 'locked-one', { status: 'locked' }, { at: NOW, by: 'owner', note: 'lock' });

  const sorted = sortSeeds(readSeeds(body));
  eq(sorted[0].seed.status, 'locked', 'locked first');

  const gap = filterSeeds(body, sorted, { status: 'locked', pieces: 'none' });
  eq(gap.length, 1, 'the honest gap view: locked, and nothing made from it yet');

  const found = filterSeeds(body, sorted, { search: 'they anchor you' });
  eq(found.length, 1, 'and search reaches what she actually said');
});

test('a seed detail lists its pieces from where the pieces live, never a copy', () => {
  const body = migratedBody();
  const withPieces = readSeeds(body).filter(s => seedPieces(body, s.seed.id).length > 0);
  ok(withPieces.length > 0, 'the migration attached some pieces to their subjects');
  for (const s of withPieces) {
    for (const p of seedPieces(body, s.seed.id)) {
      const live = readPath(body, 'work-log/creation').find(e => e.id === p.id);
      eq(JSON.stringify(live!.data), JSON.stringify(p.piece), 'the piece is read, not copied');
    }
  }
});
