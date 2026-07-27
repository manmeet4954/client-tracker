// The model layer — spec 23 §5.
//
// PLAN §5.1's INTELLIGENCE BAR, a law: "when she selects a seed and its doors,
// the recommendations and drafts that come out must MATCH the quality she gets
// from talking directly to a frontier LLM with full context." A cheap model that
// saves money but misses the bar fails the spec. So: claude-opus-5, effort high,
// grounded on the packet.
//
// The call is injected, never reached for. `runExtraction` takes a `createMessage`
// function; production passes the SDK-backed one from `sdkCaller()`, and the
// tests pass a stub. Every check and the packet assembler are pure functions
// beside it, so the whole layer is testable with no network.

import type { SwitchConfig } from '../tree/contract.ts';
import type { ProfileBody } from '../tree/body.ts';
import { readPath } from '../tree/body.ts';
import { assemblePacket, packetSystemBlocks, type AssembledPacket } from './packet.ts';
import { PROPOSAL_SCHEMA, PROMPT_VERSION, SCHEMA_VERSION, parseProposals, type SeedProposal } from './schema.ts';
import { runChecks, retryInstruction, type CheckResult, type CheckContext } from './checks.ts';
import { estimateCostUsd, EMPTY_USAGE, type EngineRun, type RunUsage } from './runs.ts';
import { resolveSeed } from './seeds.ts';

export const MODEL = 'claude-opus-5';
export const EFFORT = 'high';
export const MAX_TOKENS = 16000;

// ── The call, as a shape the caller supplies ────────────────────────────────

export interface ModelRequest {
  model: string;
  max_tokens: number;
  output_config: { effort: string; format: { type: 'json_schema'; schema: unknown } };
  system: { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }[];
  messages: { role: 'user'; content: string }[];
  betas: string[];
  fallbacks: 'default';
}

export interface ModelResponse {
  stop_reason: string;
  stop_details?: { category?: string | null; explanation?: string | null } | null;
  /** The first text block. Structured outputs guarantee it parses as JSON. */
  text: string;
  usage: RunUsage;
}

export type CreateMessage = (req: ModelRequest) => Promise<ModelResponse>;

// ── What a run comes back with ──────────────────────────────────────────────

export type ExtractionOutcome = 'proposals' | 'refusal' | 'error' | 'no-proposals';

export interface ExtractionResult {
  outcome: ExtractionOutcome;
  /** Every run produces exactly one of these, whatever happened (§5.7). */
  run: EngineRun;
  checked: CheckResult;
  packet: AssembledPacket;
  /** Plain words for the screen. Never a stack trace. */
  message: string;
}

export interface ExtractionInput {
  profile_id: string;
  body: ProfileBody;
  config: SwitchConfig;
  /** The capture, verbatim, and the id it was written under. */
  capture: { id: string; text: string; seed_id?: string };
  run_id: string;
  packet_id: string;
  now: string;
  /** A clock for the latency number, injectable for the tests. */
  clock?: () => number;
}

function neverPromises(body: ProfileBody): string[] {
  const out: string[] = [];
  for (const e of readPath(body, 'context/content-strategy/boundaries')) {
    if (e.state !== 'active') continue;
    const d = e.data as Record<string, unknown>;
    const list = d.never_promises ?? d.never_promise ?? d.prohibited_claims;
    if (Array.isArray(list)) out.push(...list.map(String));
    else if (typeof list === 'string' && list.trim()) out.push(list.trim());
  }
  return out;
}

function seedNames(body: ProfileBody): { id: string; name: string }[] {
  return readPath(body, 'work-log/creation/topics').map(e => {
    const s = resolveSeed(e);
    return { id: s.id, name: s.name };
  });
}

/** The user turn: the capture verbatim, then the ask. The volatile part sits
 *  after the last cache breakpoint, which is exactly where it pays (§5.2). */
export function buildUserTurn(input: ExtractionInput, extra?: string): string {
  const target = input.capture.seed_id
    ? `\n\nThis capture is about seed ${input.capture.seed_id}. Deepen it, or tell me it is actually a different seed. ` +
      'Use kind "deepen" with target_seed_id set for the first, kind "new-seed" for the second.'
    : '';
  return [
    'Here is the capture, exactly as she gave it. Everything between the markers is hers.',
    '<<<CAPTURE',
    input.capture.text,
    'CAPTURE>>>',
    `Find the seeds in this.${target}`,
    extra ?? '',
  ].filter(Boolean).join('\n');
}

export function buildRequest(
  input: ExtractionInput, packet: AssembledPacket, extra?: string,
): ModelRequest {
  return {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    output_config: { effort: EFFORT, format: { type: 'json_schema', schema: PROPOSAL_SCHEMA } },
    system: packetSystemBlocks(packet).map(b => ({
      type: 'text' as const,
      text: b.text,
      ...(b.cache ? { cache_control: { type: 'ephemeral' as const } } : {}),
    })),
    messages: [{ role: 'user', content: buildUserTurn(input, extra) }],
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  };
}

const REFUSAL_MESSAGE =
  'The model declined this one. Nothing was saved as a proposal — your capture is still here.';

/**
 * One extraction. Assembles the packet, makes the call, checks the output, and
 * returns exactly one run record whatever happens.
 *
 * `stop_reason` is checked BEFORE `content` is read, so a refusal never renders
 * as an empty proposal list with no explanation (§5.2).
 */
export async function runExtraction(
  input: ExtractionInput, createMessage: CreateMessage,
): Promise<ExtractionResult> {
  const clock = input.clock ?? (() => Date.now());
  const started = clock();
  const packet = assemblePacket({
    profile_id: input.profile_id,
    body: input.body,
    config: input.config,
    now: input.now,
    packet_id: input.packet_id,
  });

  const checkContext: CheckContext = {
    capture: input.capture.text,
    never_promises: neverPromises(input.body),
    seeds: seedNames(input.body),
  };

  let usage: RunUsage = { ...EMPTY_USAGE };
  let stopReason = 'error';
  let refusalCategory: string | undefined;
  let error: string | undefined;
  let checked: CheckResult = { shown: [], rejected: [] };
  let outcome: ExtractionOutcome = 'error';
  let message = '';

  const addUsage = (u: RunUsage) => {
    usage = {
      input_tokens: usage.input_tokens + (u.input_tokens ?? 0),
      cache_read_input_tokens: usage.cache_read_input_tokens + (u.cache_read_input_tokens ?? 0),
      cache_creation_input_tokens: usage.cache_creation_input_tokens + (u.cache_creation_input_tokens ?? 0),
      output_tokens: usage.output_tokens + (u.output_tokens ?? 0),
    };
  };

  try {
    let response = await createMessage(buildRequest(input, packet));
    addUsage(response.usage ?? EMPTY_USAGE);
    stopReason = response.stop_reason;

    if (response.stop_reason === 'refusal') {
      refusalCategory = response.stop_details?.category ?? 'unspecified';
      outcome = 'refusal';
      message = REFUSAL_MESSAGE;
    } else {
      let proposals: SeedProposal[] = parseProposals(JSON.parse(response.text));
      checked = runChecks(proposals, checkContext);

      // Check 2 rejects, and the run retries ONCE with the violation named.
      if (checked.rejected.length > 0) {
        const retryUsage = { ...usage };
        response = await createMessage(
          buildRequest(input, packet, retryInstruction(checked.rejected.map(r => r.reason))),
        );
        addUsage(response.usage ?? EMPTY_USAGE);
        stopReason = response.stop_reason;
        if (response.stop_reason === 'refusal') {
          refusalCategory = response.stop_details?.category ?? 'unspecified';
          outcome = 'refusal';
          message = REFUSAL_MESSAGE;
        } else {
          proposals = parseProposals(JSON.parse(response.text));
          const second = runChecks(proposals, checkContext);
          // The first pass's rejections stay on the record: they are what the
          // retry was for, and the run log has to show they happened.
          checked = { shown: second.shown, rejected: [...checked.rejected, ...second.rejected] };
          void retryUsage;
        }
      }

      if (outcome !== 'refusal') {
        outcome = checked.shown.length > 0 ? 'proposals' : 'no-proposals';
        message = checked.shown.length > 0
          ? ''
          : checked.rejected.length > 0
            ? 'It could not quote you word for word, twice. Nothing was saved. Your capture is still here.'
            : 'It did not find a seed in this one. Talk it out a bit more and try again.';
      }
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    outcome = 'error';
    stopReason = 'error';
    message = 'That did not go through. Your capture is saved — you can try again.';
  }

  const finished = clock();
  const run: EngineRun = {
    id: input.run_id,
    kind: 'seed_extraction',
    profile_id: input.profile_id,
    triggered_by: 'owner',
    packet: {
      packet_id: packet.packet.id,
      context_version: packet.packet.context_version,
      folders: packet.packet.folders,
      mandatory_constraints: packet.packet.mandatory_constraints,
      trimmed: packet.trimmed,
    },
    model: MODEL,
    effort: EFFORT,
    thinking: 'adaptive',
    schema_version: SCHEMA_VERSION,
    prompt_version: PROMPT_VERSION,
    capture_ids: [input.capture.id],
    proposal_ids: [],           // filled in by the caller once they are written
    usage,
    cost_estimate_usd: estimateCostUsd(usage),
    latency_ms: Math.max(0, finished - started),
    stop_reason: stopReason,
    refusal_category: refusalCategory,
    checks: {
      rejected: checked.rejected.length,
      badged: checked.shown.flatMap(c =>
        c.badges.map(b => ({ proposal_id: c.proposal.name, check: b.check }))),
    },
    started_at: input.now,
    finished_at: input.now,
    error,
  };

  return { outcome, run, checked, packet, message };
}

// The live caller lives in `sdkCaller.ts`, which the API route imports and
// nothing else does. Keeping the SDK out of this file is what lets the room
// import `extractionAvailability` without dragging a Node-only package into the
// browser bundle.

/** §2.2 and acceptance test 10: with no key, the room opens, the bank works,
 *  writing a seed by hand works, and the extraction button is disabled with a
 *  plain reason. Nothing fabricates a proposal, and no run is logged. */
export interface ExtractionAvailability {
  available: boolean;
  reason?: string;
}

export function extractionAvailability(opts: {
  hasApiKey: boolean;
  extractionSwitchActive: boolean;
  strategyLocked: boolean;
  lifecycle: string;
}): ExtractionAvailability {
  if (!opts.hasApiKey) {
    return { available: false, reason: 'The engine has no key set, so it cannot read anything yet. The bank still works, and you can write a seed yourself.' };
  }
  if (!opts.extractionSwitchActive) {
    return { available: false, reason: 'Extraction is switched off for this profile. The bank still works by hand.' };
  }
  if (!opts.strategyLocked) {
    return { available: false, reason: 'This profile has no locked strategy yet, so the engine would be reading from nothing. Walk it through strategy first.' };
  }
  if (opts.lifecycle !== 'active' && opts.lifecycle !== 'setup') {
    return { available: false, reason: 'This profile is not running, so nothing new is written here.' };
  }
  return { available: true };
}
