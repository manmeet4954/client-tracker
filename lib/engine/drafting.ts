// The drafting call and the gate call — spec 25 §4 and §6.8.
//
// PLAN §5.1's law, quoted because it is the reason this file exists: "when she
// selects a seed and its doors, the recommendations and drafts that come out
// must MATCH the quality she gets from talking directly to a frontier LLM with
// full context. If that was not the case, why was I even building it."
//
// This follows spec 23 §5 and spec 24 §6 exactly, because that pattern is the
// family's house style and a second pattern would be a second thing to maintain.
// The call is INJECTED, never reached for: production passes the SDK-backed
// caller, the tests pass a stub, and every check beside it is a pure function.
//
// TWO calls, never one. The gates are judged by a SEPARATE call (§6.8): a model
// grading its own output in the same turn is not a check, and the intelligence
// bar is not served by a system that congratulates itself.

import type { SwitchConfig } from '../tree/contract.ts';
import type { ProfileBody } from '../tree/body.ts';
import type { Gate, GateSet, InternalBrief, Piece, ResolvedCostume, Seed } from '../tree/objects.ts';
import { assemblePacket, packetSystemBlocks, type AssembledPacket, type DraftPacketSubject } from './packet.ts';
import type { CreateMessage, ModelRequest } from './extraction.ts';
import { estimateCostUsd, EMPTY_USAGE, type EngineRun, type RunUsage } from './runs.ts';
import { FORMAT_RULES_VERSION, formatRulesResolution, type ResolvedFormatRule } from './formats.ts';
import {
  buildGateRun, draftText, hookViolation, hardFailures, machineContextFor, runMachineChecks,
  type GateRun, type GateSubject, type MachineCheck,
} from './gates.ts';
import {
  FORMAT_FAMILIES, type Claim, type DraftContent, type DraftPayload, type FormatFamily,
} from './drafts.ts';

export const DRAFT_MODEL = 'claude-opus-5';
export const DRAFT_EFFORT = 'high';
export const DRAFT_SCHEMA_VERSION = 1;
export const DRAFT_PROMPT_VERSION = 1;

/** §4.2: max_tokens caps thinking PLUS output, so a newsletter needs room or the
 *  last section truncates. */
export const DRAFT_MAX_TOKENS: Record<FormatFamily, number> = {
  carousel: 12000, reel: 12000, static: 12000, 'longform-text': 20000, newsletter: 20000,
};

/** §4.10: two automatic revise attempts, then it stops. Attempt three is not
 *  offered — a repeated gate failure means the brief is wrong, not the copy. */
export const REVISE_CEILING = 2;

export class DraftingRefused extends Error {}

// ── §4.6 DRAFT_SCHEMA — a schema that cannot express a paragraph slide ───────
//
// Her standing law, made STRUCTURAL rather than instructed. The families are a
// discriminated union on `format_family`, and none of them produces a block of
// post text with line breaks. A carousel comes back as an array of slides with
// typed fields, not as markdown somebody has to split. There is no regex
// anywhere in the drafting path.

export const SLIDE_HEADING_MAX = 60;
export const SLIDE_LINE_MAX = 120;
export const SPOKEN_LINE_MAX = 220;

const claimsSchema = {
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['text', 'kind', 'needs_proof', 'proof_id', 'within_boundaries'],
    properties: {
      text: { type: 'string' },
      kind: { type: 'string', enum: ['fact', 'result', 'opinion', 'promise'] },
      needs_proof: { type: 'boolean' },
      proof_id: { type: ['string', 'null'] },
      within_boundaries: { type: 'boolean' },
      primary: { type: 'boolean' },
    },
  },
} as const;

const commonProperties = {
  hook: { type: 'string', maxLength: 200 },
  caption: { type: ['string', 'null'] },
  cta_line: { type: 'string', maxLength: 200 },
  claims: claimsSchema,
  alt_text: { type: 'array', items: { type: 'string' } },
  leave_out_check: { type: 'array', items: { type: 'string' } },
  notes_for_her: { type: 'string', maxLength: 400 },
} as const;

const COMMON_REQUIRED = [
  'format_family', 'hook', 'caption', 'cta_line', 'claims', 'alt_text',
  'leave_out_check', 'notes_for_her',
];

export const DRAFT_SCHEMA = {
  oneOf: [
    {
      type: 'object',
      additionalProperties: false,
      required: [...COMMON_REQUIRED, 'slides'],
      properties: {
        ...commonProperties,
        format_family: { const: 'carousel' },
        slides: {
          type: 'array', minItems: 2, maxItems: 20,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['index', 'heading', 'lines', 'visual_note'],
            properties: {
              index: { type: 'integer' },
              // A heading is a few words. The cap is what stops a slide
              // becoming a paragraph, in the schema rather than in a prompt.
              heading: { type: 'string', maxLength: SLIDE_HEADING_MAX },
              lines: {
                type: 'array', maxItems: 3,
                items: { type: 'string', maxLength: SLIDE_LINE_MAX },
              },
              visual_note: { type: 'string', maxLength: 200 },
            },
          },
        },
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: [...COMMON_REQUIRED, 'script'],
      properties: {
        ...commonProperties,
        format_family: { const: 'reel' },
        script: {
          type: 'array', minItems: 2, maxItems: 8,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['beat', 'spoken', 'seconds_estimate'],
            properties: {
              beat: { type: 'string', enum: ['hook', 'recognition', 'reframe', 'payoff', 'action'] },
              spoken: { type: 'string', maxLength: SPOKEN_LINE_MAX },
              on_screen_text: { type: 'string', maxLength: 120 },
              seconds_estimate: { type: 'number' },
            },
          },
        },
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: [...COMMON_REQUIRED, 'visual_text'],
      properties: {
        ...commonProperties,
        format_family: { const: 'static' },
        visual_text: { type: 'string', maxLength: 400 },
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: [...COMMON_REQUIRED, 'opening_claim', 'body_blocks', 'closing'],
      properties: {
        ...commonProperties,
        format_family: { const: 'longform-text' },
        opening_claim: { type: 'string', maxLength: 300 },
        body_blocks: { type: 'array', items: { type: 'string' } },
        closing: { type: 'string' },
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: [...COMMON_REQUIRED, 'scene', 'sections', 'practice'],
      properties: {
        ...commonProperties,
        format_family: { const: 'newsletter' },
        scene: { type: 'string' },
        sections: { type: 'array', items: { type: 'string' } },
        practice: { type: 'string' },
      },
    },
  ],
} as const;

/** Shape-check a parsed response without trusting it. A malformed response is a
 *  RUN ERROR and no draft is shown (spec 24 §6.7 check 1, same rule). */
export function parseDraft(raw: unknown): DraftPayload {
  const d = (raw ?? {}) as Record<string, unknown>;
  const family = d.format_family as FormatFamily;
  if (!FORMAT_FAMILIES.includes(family)) {
    throw new Error(`the response came back as "${String(d.format_family)}", which is not a format family`);
  }
  if (typeof d.hook !== 'string' || !d.hook.trim()) throw new Error('the response is missing "hook"');
  if (typeof d.cta_line !== 'string') throw new Error('the response is missing "cta_line"');

  const claims: Claim[] = Array.isArray(d.claims) ? d.claims.map(item => {
    const c = item as Partial<Claim>;
    return {
      text: String(c.text ?? ''),
      kind: (['fact', 'result', 'opinion', 'promise'].includes(String(c.kind)) ? c.kind : 'fact') as Claim['kind'],
      needs_proof: c.needs_proof === true,
      proof_id: typeof c.proof_id === 'string' ? c.proof_id : null,
      within_boundaries: c.within_boundaries !== false,
      ...(c.primary === true ? { primary: true } : {}),
    };
  }) : [];

  const common = {
    hook: d.hook,
    caption: typeof d.caption === 'string' ? d.caption : null,
    cta_line: d.cta_line,
    alt_text: Array.isArray(d.alt_text) ? d.alt_text.map(String) : [],
    leave_out_check: Array.isArray(d.leave_out_check) ? d.leave_out_check.map(String) : [],
    notes_for_her: typeof d.notes_for_her === 'string' ? d.notes_for_her : '',
    claims,
  };

  switch (family) {
    case 'carousel': {
      if (!Array.isArray(d.slides)) throw new Error('a carousel came back with no slides');
      return {
        ...common, format_family: 'carousel',
        slides: d.slides.map((s, i) => {
          const slide = s as Record<string, unknown>;
          return {
            index: typeof slide.index === 'number' ? slide.index : i + 1,
            heading: String(slide.heading ?? ''),
            lines: Array.isArray(slide.lines) ? slide.lines.map(String) : [],
            visual_note: String(slide.visual_note ?? ''),
          };
        }),
      };
    }
    case 'reel': {
      if (!Array.isArray(d.script)) throw new Error('a reel came back with no script');
      return {
        ...common, format_family: 'reel',
        script: d.script.map(b => {
          const beat = b as Record<string, unknown>;
          return {
            beat: (['hook', 'recognition', 'reframe', 'payoff', 'action'].includes(String(beat.beat))
              ? beat.beat : 'hook') as 'hook' | 'recognition' | 'reframe' | 'payoff' | 'action',
            spoken: String(beat.spoken ?? ''),
            ...(typeof beat.on_screen_text === 'string' ? { on_screen_text: beat.on_screen_text } : {}),
            seconds_estimate: typeof beat.seconds_estimate === 'number' ? beat.seconds_estimate : 0,
          };
        }),
      };
    }
    case 'longform-text':
      return {
        ...common, format_family: 'longform-text',
        opening_claim: String(d.opening_claim ?? ''),
        body_blocks: Array.isArray(d.body_blocks) ? d.body_blocks.map(String) : [],
        closing: String(d.closing ?? ''),
      };
    case 'newsletter':
      return {
        ...common, format_family: 'newsletter',
        scene: String(d.scene ?? ''),
        sections: Array.isArray(d.sections) ? d.sections.map(String) : [],
        practice: String(d.practice ?? ''),
      };
    default:
      return { ...common, format_family: 'static', visual_text: String(d.visual_text ?? '') };
  }
}

// ── §4.2 The call ───────────────────────────────────────────────────────────

export interface DraftingInput {
  profile_id: string;
  body: ProfileBody;
  config: SwitchConfig;
  piece_id: string;
  seed: Seed;
  costume: ResolvedCostume;
  rule: ResolvedFormatRule;
  brief: DraftPacketSubject['brief'];
  family: FormatFamily;
  gates?: Gate[];
  posted?: { title: string; hook: string }[];
  taste_rules?: { rule: string; strength: 'law' | 'lean' }[];
  labels?: DraftPacketSubject['labels'];
  gate_set_version?: number;
  strategy_version?: number;
  run_id: string;
  packet_id: string;
  now: string;
  /** The failed verdicts, verbatim, on a revise (§4.10). */
  revise_notes?: string[];
  /** 1 on the first press; 2 or 3 on a revise. Never past REVISE_CEILING + 1. */
  attempt?: 1 | 2 | 3;
  clock?: () => number;
}

export function buildDraftUserTurn(input: DraftingInput, extra?: string): string {
  return [
    `Write this piece as a ${input.family}.`,
    'The brief, the seed, the resolved costume and the merged format rule are in the packet above. Do not restate them.',
    input.brief.hook
      ? `She wrote the hook herself. Use it verbatim, exactly as written: ${input.brief.hook}`
      : 'She wrote no hook. Write the strongest one you can, in her language.',
    'Return the piece, its claims, its alt text, and one line per item the brief said to leave out.',
    ...(input.revise_notes?.length
      ? ['', 'This is a revise. These gates failed. Fix exactly these and change nothing else:',
        ...input.revise_notes.map(n => `- ${n}`)]
      : []),
    extra ?? '',
  ].filter(Boolean).join('\n');
}

export function buildDraftRequest(
  input: DraftingInput, packet: AssembledPacket, extra?: string,
): ModelRequest {
  return {
    model: DRAFT_MODEL,
    max_tokens: DRAFT_MAX_TOKENS[input.family],
    output_config: { effort: DRAFT_EFFORT, format: { type: 'json_schema', schema: DRAFT_SCHEMA } },
    system: packetSystemBlocks(packet).map(b => ({
      type: 'text' as const,
      text: b.text,
      ...(b.cache ? { cache_control: { type: 'ephemeral' as const } } : {}),
    })),
    messages: [{ role: 'user', content: buildDraftUserTurn(input, extra) }],
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  };
}

function draftPacketFor(input: DraftingInput, profile: 'draft' | 'gate', extra: Partial<DraftPacketSubject> = {}) {
  return assemblePacket({
    profile_id: input.profile_id,
    body: input.body,
    config: input.config,
    now: input.now,
    packet_id: input.packet_id,
    content_profile: profile,
    subject: {
      seed: input.seed,
      costume: input.costume,
      rule: input.rule,
      labels: input.labels,
      brief: input.brief,
      gates: input.gates,
      posted: input.posted,
      taste_rules: input.taste_rules,
      ...extra,
    } as DraftPacketSubject,
  });
}

export type DraftOutcome = 'draft' | 'refusal' | 'error' | 'rejected';

export interface DraftResult {
  outcome: DraftOutcome;
  /** Every run produces exactly one of these, whatever happened (S12). */
  run: EngineRun;
  payload: DraftPayload | null;
  packet: AssembledPacket;
  /** Plain words for the screen. Never a stack trace. */
  message: string;
}

const REFUSAL_MESSAGE =
  'The model declined this one. Nothing was saved as a draft. Your brief is still here.';

function emptyRunFields(input: DraftingInput) {
  return {
    profile_id: input.profile_id,
    triggered_by: 'owner' as const,
    effort: DRAFT_EFFORT,
    thinking: 'adaptive',
    schema_version: DRAFT_SCHEMA_VERSION,
    prompt_version: DRAFT_PROMPT_VERSION,
    capture_ids: [] as string[],
    proposal_ids: [] as string[],
    piece_ids: [input.piece_id],
    brief_version: input.brief.brief_version,
    format_rules_version: FORMAT_RULES_VERSION,
    format_rules_resolution: formatRulesResolution(input.rule),
    gate_set_version: input.gate_set_version ?? 0,
    strategy_version: input.strategy_version ?? 0,
  };
}

function addUsage(a: RunUsage, b: RunUsage | undefined): RunUsage {
  return {
    input_tokens: a.input_tokens + (b?.input_tokens ?? 0),
    cache_read_input_tokens: a.cache_read_input_tokens + (b?.cache_read_input_tokens ?? 0),
    cache_creation_input_tokens: a.cache_creation_input_tokens + (b?.cache_creation_input_tokens ?? 0),
    output_tokens: a.output_tokens + (b?.output_tokens ?? 0),
  };
}

/**
 * One draft. Assembles the packet, makes the call, runs her two standing laws
 * over the answer, and returns exactly one run record whatever happened.
 *
 * `stop_reason` is checked BEFORE `content` is read, so a refusal never renders
 * as an empty draft with no explanation (§4.2).
 *
 * §4.7: a draft that improved her hook is REJECTED and retried once with the
 * violation named. A second rewording yields no draft and a logged violation.
 */
export async function runDraft(
  input: DraftingInput, createMessage: CreateMessage,
): Promise<DraftResult> {
  const clock = input.clock ?? (() => Date.now());
  const started = clock();
  const packet = draftPacketFor(input, 'draft');

  let usage: RunUsage = { ...EMPTY_USAGE };
  let stopReason = 'error';
  let refusalCategory: string | undefined;
  let error: string | undefined;
  let outcome: DraftOutcome = 'error';
  let payload: DraftPayload | null = null;
  let rejected = 0;
  const badged: { proposal_id: string; check: 'hook-verbatim' }[] = [];
  let message = '';

  try {
    let response = await createMessage(buildDraftRequest(input, packet));
    usage = addUsage(usage, response.usage);
    stopReason = response.stop_reason;

    if (response.stop_reason === 'refusal') {
      refusalCategory = response.stop_details?.category ?? 'unspecified';
      outcome = 'refusal';
      message = REFUSAL_MESSAGE;
    } else {
      let draft = parseDraft(JSON.parse(response.text));
      let violation = hookViolation(draft, input.brief.hook);

      if (violation) {
        rejected++;
        badged.push({ proposal_id: input.piece_id, check: 'hook-verbatim' });
        response = await createMessage(
          buildDraftRequest(input, packet, hookRetryInstruction(violation, input.brief.hook!)),
        );
        usage = addUsage(usage, response.usage);
        stopReason = response.stop_reason;
        if (response.stop_reason === 'refusal') {
          refusalCategory = response.stop_details?.category ?? 'unspecified';
          outcome = 'refusal';
          message = REFUSAL_MESSAGE;
        } else {
          draft = parseDraft(JSON.parse(response.text));
          violation = hookViolation(draft, input.brief.hook);
          if (violation) {
            rejected++;
            badged.push({ proposal_id: input.piece_id, check: 'hook-verbatim' });
          }
        }
      }

      if (outcome !== 'refusal') {
        if (violation) {
          outcome = 'rejected';
          payload = null;
          message = 'It rewrote your hook, twice. Nothing was saved as a draft. Your brief is still here.';
        } else {
          outcome = 'draft';
          payload = draft;
        }
      }
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    outcome = 'error';
    stopReason = 'error';
    message = 'That did not go through. Your brief is saved — you can try again.';
  }

  const finished = clock();
  const run: EngineRun = {
    id: input.run_id,
    kind: 'draft',
    ...emptyRunFields(input),
    packet: {
      packet_id: packet.packet.id,
      context_version: packet.packet.context_version,
      folders: packet.packet.folders,
      mandatory_constraints: packet.packet.mandatory_constraints,
      trimmed: packet.trimmed,
    },
    model: DRAFT_MODEL,
    draft_version_id: null,
    attempt: input.attempt ?? 1,
    usage,
    cost_estimate_usd: estimateCostUsd(usage),
    latency_ms: Math.max(0, finished - started),
    stop_reason: stopReason,
    refusal_category: refusalCategory,
    checks: { rejected, badged },
    started_at: input.now,
    finished_at: input.now,
    error,
  };

  return { outcome, run, payload, packet, message };
}

export function hookRetryInstruction(violation: string, hook: string): string {
  return [
    'Your previous answer was rejected before it reached her.',
    `- ${violation}`,
    `Her hook is: ${hook}`,
    'Copy it. Character for character. It is not yours to improve.',
  ].join('\n');
}

/** §4.10: the ceiling, and the honest read of what a repeated failure means. */
export function reviseState(failedRuns: number): {
  offered: boolean; attempt: 1 | 2 | 3; message: string;
} {
  if (failedRuns <= 0) return { offered: true, attempt: 1, message: '' };
  if (failedRuns > REVISE_CEILING) {
    return {
      offered: false, attempt: 3,
      message: 'Two tries and it is still not passing. That usually means the brief is wrong, not the copy.',
    };
  }
  return { offered: true, attempt: (failedRuns + 1) as 2 | 3, message: '' };
}

/** The failed verdicts, verbatim, for the revise call (§4.10). */
export function reviseNotesFrom(run: GateRun, herNote?: string): string[] {
  const failed = run.verdicts
    .filter(v => v.gate_kind !== 'rights' && (v.verdict === 'fail' || v.verdict === 'flagged'))
    .map(v => `${v.gate_id}: ${v.reason}${v.evidence_span ? ` (the part in question: "${v.evidence_span}")` : ''}`);
  return herNote?.trim() ? [...failed, `Her note: ${herNote.trim()}`] : failed;
}

// ── §6.8 The gate call — a SEPARATE call ────────────────────────────────────

export const GATE_MAX_TOKENS = 6000;

export const GATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdicts'],
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['gate_id', 'verdict', 'reason', 'evidence_span'],
        properties: {
          gate_id: { type: 'string' },
          verdict: { type: 'string', enum: ['pass', 'fail', 'flagged'] },
          reason: { type: 'string', maxLength: 300 },
          // Required by the schema AND checked afterwards: a reviewer that
          // cannot point at the thing it approved has not reviewed anything.
          evidence_span: { type: 'string' },
        },
      },
    },
  },
} as const;

export interface ModelVerdict {
  gate_id: string;
  verdict: 'pass' | 'fail' | 'flagged';
  reason: string;
  evidence_span?: string;
}

export function parseGateVerdicts(raw: unknown): ModelVerdict[] {
  const list = (raw as { verdicts?: unknown })?.verdicts;
  if (!Array.isArray(list)) throw new Error('the response carries no verdicts list');
  return list.map(item => {
    const v = item as Partial<ModelVerdict>;
    if (typeof v.gate_id !== 'string' || !v.gate_id) throw new Error('a verdict came back with no gate_id');
    const verdict = ['pass', 'fail', 'flagged'].includes(String(v.verdict)) ? v.verdict! : 'flagged';
    return {
      gate_id: v.gate_id,
      verdict: verdict as ModelVerdict['verdict'],
      reason: typeof v.reason === 'string' ? v.reason : '',
      ...(typeof v.evidence_span === 'string' && v.evidence_span.trim()
        ? { evidence_span: v.evidence_span } : {}),
    };
  });
}

/**
 * §6.8: a verdict of `pass` with no `evidence_span` is rejected and the gate is
 * re-run once. This is the same shape as spec 23's verbatim guard, applied to
 * judgment instead of quotation.
 */
export function evidencelessPasses(verdicts: ModelVerdict[]): string[] {
  return verdicts
    .filter(v => v.verdict === 'pass' && !v.evidence_span?.trim())
    .map(v => v.gate_id);
}

export function gateRetryInstruction(gateIds: string[]): string {
  return [
    'Your previous answer was rejected before it reached her.',
    ...gateIds.map(id => `- You passed "${id}" and pointed at nothing.`),
    'Every pass carries an evidence_span that is a verbatim substring of the draft.',
    'If you cannot point at it, the honest verdict is not a pass.',
  ].join('\n');
}

export interface GateCallInput extends DraftingInput {
  subject: GateSubject;
  gate_run_id: string;
  run_by: string;
  overrides?: Record<string, { by: string; at: string; reason: string }>;
  owner_verified?: { by: string; at: string; reason: string; claim: string }[];
  rights?: GateRun['verdicts'][number];
}

export interface GateCallResult {
  run: GateRun;
  /** One engine_run per gate call: success, refusal, short-circuit or error. */
  engine_run: EngineRun;
  checks: MachineCheck[];
  packet: AssembledPacket | null;
  message: string;
}

export function buildGateRequest(
  input: GateCallInput, packet: AssembledPacket, extra?: string,
): ModelRequest {
  return {
    model: DRAFT_MODEL,
    max_tokens: GATE_MAX_TOKENS,
    output_config: { effort: DRAFT_EFFORT, format: { type: 'json_schema', schema: GATE_SCHEMA } },
    system: packetSystemBlocks(packet).map(b => ({
      type: 'text' as const,
      text: b.text,
      ...(b.cache ? { cache_control: { type: 'ephemeral' as const } } : {}),
    })),
    messages: [{
      role: 'user',
      content: [
        'Judge this draft against each gate above.',
        'Return one verdict per gate, each with its reason and its evidence span.',
        extra ?? '',
      ].filter(Boolean).join('\n'),
    }],
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  };
}

function machineResultLines(checks: MachineCheck[]): string[] {
  if (!checks.length) return ['Every machine check passed.'];
  return checks.filter(c => !c.passed).map(c => `${c.gate_id} · ${c.check}: ${c.reason}`);
}

/**
 * One gate run. The machine checks run first, always, and if any HARD one fails
 * the model call is NOT MADE: the draft is going back regardless, and paying for
 * a judgment on copy that is already provably wrong is the kind of spend that
 * has no defence (§6.3). The run is still logged, with `model: null` and the
 * failing check named.
 *
 * `createMessage` may be null, which is the keyless case: machine checks run and
 * report, model-judged gates report `not-run`, the piece cannot leave build, and
 * nothing fabricates a verdict (§15 test 15).
 */
export async function runGateRun(
  input: GateCallInput, createMessage: CreateMessage | null,
): Promise<GateCallResult> {
  const clock = input.clock ?? (() => Date.now());
  const started = clock();
  const gateSet: GateSet = input.subject.gate_set;

  const checks = runMachineChecks(machineContextFor(input.body, input.subject, {
    owner_verified: (input.owner_verified ?? []).map(o => o.claim),
  }));
  const shortCircuit = hardFailures(checks).length > 0;

  let usage: RunUsage = { ...EMPTY_USAGE };
  let stopReason = shortCircuit ? 'short-circuit' : 'error';
  let refusalCategory: string | undefined;
  let error: string | undefined;
  let verdicts: ModelVerdict[] | undefined;
  let rejected = 0;
  let packet: AssembledPacket | null = null;
  let message = '';

  if (shortCircuit) {
    message = hardFailures(checks)[0].reason;
  } else if (!createMessage) {
    stopReason = 'not-run';
    message = 'The engine has no key set, so the judged gates were not run. Nothing was assumed to pass.';
  } else {
    packet = draftPacketFor(input, 'gate', {
      draft_text: draftText(input.subject.draft.content).split('\n'),
      machine_results: machineResultLines(checks),
    });
    try {
      let response = await createMessage(buildGateRequest(input, packet));
      usage = addUsage(usage, response.usage);
      stopReason = response.stop_reason;
      if (response.stop_reason === 'refusal') {
        refusalCategory = response.stop_details?.category ?? 'unspecified';
        message = 'The reviewer declined this one. Nothing was assumed to pass.';
      } else {
        let parsed = parseGateVerdicts(JSON.parse(response.text));
        const blind = evidencelessPasses(parsed);
        if (blind.length) {
          rejected += blind.length;
          response = await createMessage(buildGateRequest(input, packet, gateRetryInstruction(blind)));
          usage = addUsage(usage, response.usage);
          stopReason = response.stop_reason;
          if (response.stop_reason !== 'refusal') {
            parsed = parseGateVerdicts(JSON.parse(response.text));
            const stillBlind = evidencelessPasses(parsed);
            rejected += stillBlind.length;
            // A pass it still cannot point at is not a pass. It becomes a flag
            // for her, which is the honest downgrade.
            parsed = parsed.map(v => stillBlind.includes(v.gate_id)
              ? { ...v, verdict: 'flagged' as const, reason: `${v.reason} (It could not point at this one.)` }
              : v);
          } else {
            refusalCategory = response.stop_details?.category ?? 'unspecified';
          }
        }
        verdicts = parsed;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      stopReason = 'error';
      message = 'The gate run did not go through. Your draft is saved — you can run it again.';
    }
  }

  const finished = clock();
  const engine_run: EngineRun = {
    id: input.run_id,
    kind: 'gate_run',
    ...emptyRunFields(input),
    packet: packet
      ? {
        packet_id: packet.packet.id,
        context_version: packet.packet.context_version,
        folders: packet.packet.folders,
        mandatory_constraints: packet.packet.mandatory_constraints,
        trimmed: packet.trimmed,
      }
      : {
        packet_id: input.packet_id,
        context_version: input.body.context_version ?? 0,
        folders: [],
        mandatory_constraints: [],
        trimmed: [],
      },
    // Null when a hard machine check short-circuited, or when there is no key.
    model: verdicts || error ? DRAFT_MODEL : null,
    draft_version_id: input.subject.draft.id,
    gate_set_version: gateSet.version,
    attempt: input.attempt ?? 1,
    usage,
    cost_estimate_usd: estimateCostUsd(usage),
    latency_ms: Math.max(0, finished - started),
    stop_reason: stopReason,
    refusal_category: refusalCategory,
    checks: {
      rejected,
      badged: checks.filter(c => !c.passed).map(c => ({ proposal_id: input.piece_id, check: c.check })),
    },
    started_at: input.now,
    finished_at: input.now,
    error,
  };

  const run = buildGateRun({
    id: input.gate_run_id,
    piece_id: input.piece_id,
    draft_version_id: input.subject.draft.id,
    gate_set: gateSet,
    strategy_version: input.strategy_version ?? 0,
    rule: input.rule,
    checks,
    model_verdicts: verdicts,
    rights: input.rights,
    engine_run_id: verdicts ? input.run_id : null,
    run_at: input.now,
    run_by: input.run_by,
    overrides: input.overrides,
    owner_verified: input.owner_verified,
  });

  return { run, engine_run, checks, packet, message };
}

// ── §2.2 and §15 test 15: keyless honesty ───────────────────────────────────

export interface DraftingAvailability {
  available: boolean;
  reason?: string;
}

/**
 * With no key: build state opens, hand-written drafts work, machine gate checks
 * run and report, model-judged gates report `not-run`, the piece cannot leave
 * build, and the reason is stated plainly. Nothing fabricates a draft or a
 * verdict, and no run is logged.
 */
export function draftingAvailability(opts: {
  hasApiKey: boolean;
  draftingSwitchActive: boolean;
  strategyLocked: boolean;
  gateSetLocked: boolean;
  hasBrief: boolean;
  lifecycle: string;
}): DraftingAvailability {
  if (!opts.hasBrief) {
    return {
      available: false,
      reason: 'This piece has no brief yet, and the brief comes before the copy. Write the brief first.',
    };
  }
  if (!opts.hasApiKey) {
    return {
      available: false,
      reason: 'The engine has no key set, so it cannot write a draft yet. The gates still run their machine checks, and you can write the draft yourself.',
    };
  }
  if (!opts.draftingSwitchActive) {
    return {
      available: false,
      reason: 'Drafting is switched off for this profile. Everything else works, and you can write the draft yourself.',
    };
  }
  if (!opts.strategyLocked) {
    return {
      available: false,
      reason: 'This profile has no locked strategy yet, so the engine would be writing from nothing. Walk it through strategy first.',
    };
  }
  if (!opts.gateSetLocked) {
    return {
      available: false,
      reason: 'This profile has no locked gate set, so there is no standard to write toward. Lock the gates first.',
    };
  }
  if (opts.lifecycle !== 'active' && opts.lifecycle !== 'setup') {
    return { available: false, reason: 'This profile is not running, so nothing new is written here.' };
  }
  return { available: true };
}

// ── §4.3 The honest number ──────────────────────────────────────────────────

/** §4.3: about 20 to 35 cents for a piece that passes first time; about 60 with
 *  one revise; roughly 90 worst case, which is the two-revise ceiling. */
export function draftBatchEstimate(count: number, alreadyRunThisSession = false): {
  count: number; usd: number; words: string;
} {
  if (count <= 0) return { count: 0, usd: 0, words: 'Nothing is selected.' };
  const first = alreadyRunThisSession ? 0.22 : 0.35;
  const usd = Math.round((first + Math.max(0, count - 1) * 0.22) * 100) / 100;
  return {
    count, usd,
    words: `${count} ${count === 1 ? 'draft' : 'drafts'} and their gate runs, about $${usd.toFixed(2)}. Nothing runs until you say go.`,
  };
}

export type { DraftContent, Piece, InternalBrief };
