// The internal brief — spec 24 §6. A real model call, before any copy.
//
// PLAN §5.1's flow puts it between the costume and creation: "the engine writes
// a small brief BEFORE copy: the one point, the tension, the realization, the
// takeaway, product's role, tone, ending, what to leave out."
//
// This is where the intelligence bar is won or lost. A piece with a sharp brief
// and average copy is a good piece; a piece with beautiful copy and no point is
// the thing she has been getting from generic tools. So this call gets exactly
// the treatment spec 23 gave extraction, for the same reason: claude-opus-5 at
// effort high, grounded on a versioned packet, logged per output.
//
// The call is INJECTED, never reached for. Every check and the packet assembler
// beside it are pure functions, so the whole layer is testable with no network.

import type { SwitchConfig } from '../tree/contract.ts';
import type { ProfileBody } from '../tree/body.ts';
import { putEntry, readPath } from '../tree/body.ts';
import type { BodyEntry, InternalBrief, Piece, ResolvedCostume, Seed } from '../tree/objects.ts';
import { assemblePacket, packetSystemBlocks, type AssembledPacket, type BriefPacketSubject } from './packet.ts';
import { estimateCostUsd, EMPTY_USAGE, type EngineRun, type RunUsage } from './runs.ts';
import type { CreateMessage, ModelRequest } from './extraction.ts';
import { resolveFormatRule, type ResolvedFormatRule } from './formats.ts';
import { findPiece } from './resolve.ts';
import { resolveSeed, SEED_PATH } from './seeds.ts';

export const BRIEF_PATH = 'work-log/creation/making/briefs';

export const BRIEF_MODEL = 'claude-opus-5';
export const BRIEF_EFFORT = 'high';
/** Non-streaming; thinking and output share this (§6.3). */
export const BRIEF_MAX_TOKENS = 12000;
export const BRIEF_SCHEMA_VERSION = 1;
export const BRIEF_PROMPT_VERSION = 1;

export class BriefRefused extends Error {}

// ── §6.6 The mechanism that stops the brief becoming copy ───────────────────
//
// EVERY prose field carries a hard `maxLength` in the schema. The model cannot
// smuggle a draft into `one_point`, because the schema will not let a paragraph
// through, and structured outputs make that a CONSTRAINT rather than an
// instruction. This is the whole guard, and it is a good one: it is mechanical,
// it is not a matter of the model behaving, and it means the brief stays the
// thing you can read in twenty seconds and argue with.

export const BRIEF_FIELD_CAPS: Record<string, number> = {
  one_point: 200,
  tension: 240,
  realization: 240,
  takeaway: 240,
  product_role: 240,
  tone: 200,
  ending: 240,
  leave_out: 200,          // per item
};

/** How many `leave_out` items a brief may carry. A list is not a draft either. */
export const LEAVE_OUT_MAX_ITEMS = 6;

const capped = (field: string, nullable = false) => ({
  type: nullable ? ['string', 'null'] : 'string',
  maxLength: BRIEF_FIELD_CAPS[field],
});

export const BRIEF_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'one_point', 'tension', 'realization', 'takeaway', 'product_role', 'tone',
    'ending', 'leave_out', 'cta_id', 'proof_used', 'derived_from',
  ],
  properties: {
    one_point: capped('one_point'),
    tension: capped('tension'),
    realization: capped('realization'),
    takeaway: capped('takeaway'),
    // Null at product intensity `none`, and null is the honest answer there.
    product_role: capped('product_role', true),
    tone: capped('tone'),
    ending: capped('ending'),
    leave_out: {
      type: 'array', maxItems: LEAVE_OUT_MAX_ITEMS,
      items: { type: 'string', maxLength: BRIEF_FIELD_CAPS.leave_out },
    },
    cta_id: { type: 'string' },
    proof_used: { type: 'array', items: { type: 'string' } },
    derived_from: { type: 'array', items: { type: 'string' } },
  },
} as const;

/** The eight fields plus the three machine ones, exactly as the model returns them. */
export interface BriefDraft {
  one_point: string;
  tension: string;
  realization: string;
  takeaway: string;
  product_role: string | null;
  tone: string;
  ending: string;
  leave_out: string[];
  cta_id: string;
  proof_used: string[];
  derived_from: string[];
}

export const BRIEF_PROSE_FIELDS: (keyof BriefDraft)[] = [
  'one_point', 'tension', 'realization', 'takeaway', 'product_role', 'tone', 'ending',
];

/** Shape-check a parsed response without trusting it. Check 1: a malformed
 *  response is a RUN ERROR and no brief is shown. */
export function parseBrief(raw: unknown): BriefDraft {
  const b = (raw ?? {}) as Partial<BriefDraft>;
  for (const f of ['one_point', 'tension', 'realization', 'takeaway', 'tone', 'ending'] as const) {
    if (typeof b[f] !== 'string' || !b[f]!.trim()) {
      throw new Error(`the response is missing "${f}"`);
    }
  }
  if (typeof b.cta_id !== 'string') throw new Error('the response carries no cta_id');
  return {
    one_point: b.one_point!, tension: b.tension!, realization: b.realization!,
    takeaway: b.takeaway!, product_role: b.product_role ?? null, tone: b.tone!,
    ending: b.ending!,
    leave_out: Array.isArray(b.leave_out) ? b.leave_out.map(String) : [],
    cta_id: b.cta_id,
    proof_used: Array.isArray(b.proof_used) ? b.proof_used.map(String) : [],
    derived_from: Array.isArray(b.derived_from) ? b.derived_from.map(String) : [],
  };
}

// ── §6.7 The five checks that run before she sees it ────────────────────────
//
// They do not judge taste. She does. They catch the failures that would make the
// bar unmeasurable. Checks 2 and 3 REJECT and the run retries once; checks 4 and
// 5 badge and never hide — hiding a flawed brief would teach her the engine is
// smarter than it is (spec 23 §5.6's rule, and it holds for the same reason).

export type BriefCheckId = 'schema' | 'cta-fidelity' | 'proof-resolves' | 'boundary' | 'seed-fidelity';

export interface BriefBadge {
  check: BriefCheckId;
  label: string;
  detail?: string;
}

export interface BriefCheckContext {
  costume: ResolvedCostume;
  seed: Seed;
  /** Proof ids in the library, with the platforms each is permitted on. */
  proof_library: { id: string; permitted_platforms: string[] }[];
  never_promises: string[];
  never_words: string[];
}

export interface BriefCheckResult {
  badges: BriefBadge[];
  /** Non-empty means REJECTED: checks 2 and 3. Never shown, and named for the retry. */
  rejections: string[];
  /** Fields that broke their schema cap. Structured outputs make this empty in
   *  production; it is checked anyway so a stubbed or degraded call cannot slip
   *  a draft through (§6.6). */
  over_cap: string[];
}

function textOfBrief(b: BriefDraft): string {
  return [...BRIEF_PROSE_FIELDS.map(f => String(b[f] ?? '')), ...b.leave_out].join('\n').toLowerCase();
}

export function overCapFields(b: BriefDraft): string[] {
  const out: string[] = [];
  for (const f of BRIEF_PROSE_FIELDS) {
    const v = b[f];
    if (typeof v === 'string' && v.length > BRIEF_FIELD_CAPS[f as string]) out.push(f as string);
  }
  if (b.leave_out.length > LEAVE_OUT_MAX_ITEMS) out.push('leave_out');
  for (const item of b.leave_out) {
    if (item.length > BRIEF_FIELD_CAPS.leave_out) { out.push('leave_out'); break; }
  }
  return [...new Set(out)];
}

export function checkBrief(brief: BriefDraft, ctx: BriefCheckContext): BriefCheckResult {
  const badges: BriefBadge[] = [];
  const rejections: string[] = [];

  // 2. CTA fidelity. The costume is the request; a brief that answers a
  //    different request is not a brief.
  if (brief.cta_id !== ctx.costume.cta) {
    rejections.push(
      `cta_id came back as "${brief.cta_id}" and the resolved CTA is "${ctx.costume.cta}". ` +
      'The ending IS the resolved CTA.',
    );
  }

  // 3. Proof resolves, and is permitted for the resolved platform. Inventing
  //    evidence is the one failure that must never reach a draft.
  for (const id of brief.proof_used) {
    const item = ctx.proof_library.find(p => p.id === id);
    if (!item) {
      rejections.push(`proof "${id}" is not in the proof library. Never cite proof that does not exist.`);
      continue;
    }
    if (item.permitted_platforms.length && !item.permitted_platforms.includes(ctx.costume.platform)) {
      rejections.push(
        `proof "${id}" is permitted on ${item.permitted_platforms.join(', ')} and this piece is for ${ctx.costume.platform}.`,
      );
    }
  }

  // 4. Boundary check. Shown, badged, never hidden.
  const text = textOfBrief(brief);
  const crossedPromises = ctx.never_promises.filter(p => p.trim() && text.includes(p.toLowerCase().trim()));
  const crossedWords = ctx.never_words.filter(w => w.trim() && text.includes(w.toLowerCase().trim()));
  if (crossedPromises.length || crossedWords.length) {
    badges.push({
      check: 'boundary',
      label: 'crosses a boundary',
      detail: [
        crossedPromises.length ? `This brand never promises: ${crossedPromises.join(', ')}` : '',
        crossedWords.length ? `This voice never says: ${crossedWords.join(', ')}` : '',
      ].filter(Boolean).join(' '),
    });
  }

  // 5. Seed fidelity: derived_from names at least one seed field that is
  //    actually non-empty on the seed.
  const named = brief.derived_from.filter(f => {
    const v = (ctx.seed as unknown as Record<string, unknown>)[f];
    return Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.trim().length > 0 : false;
  });
  if (!named.length) {
    badges.push({
      check: 'seed-fidelity',
      label: 'check this against the seed',
      detail: 'It did not name a single seed field it actually drew on.',
    });
  }

  return { badges, rejections, over_cap: overCapFields(brief) };
}

/** The line handed back to the model on the one retry checks 2 and 3 allow. */
export function briefRetryInstruction(reasons: string[]): string {
  return [
    'Your previous answer was rejected before it reached her.',
    ...reasons.map(r => `- ${r}`),
    'The costume you were given is the request. Answer THAT request.',
  ].join('\n');
}

// ── §6.3 The call ───────────────────────────────────────────────────────────

export interface BriefInput {
  profile_id: string;
  body: ProfileBody;
  config: SwitchConfig;
  piece_id: string;
  seed: Seed;
  costume: ResolvedCostume;
  rule: ResolvedFormatRule;
  labels?: BriefPacketSubject['labels'];
  run_id: string;
  packet_id: string;
  now: string;
  clock?: () => number;
}

export function buildBriefUserTurn(input: BriefInput, extra?: string): string {
  return [
    'Write the internal brief for this one piece.',
    'The seed, the resolved costume and the merged format rule are in the packet above. Do not restate them.',
    'Return the eight fields, plus cta_id, proof_used and derived_from.',
    'This is a brief. If you catch yourself writing the post, stop and write the point instead.',
    extra ?? '',
  ].filter(Boolean).join('\n');
}

export function buildBriefRequest(
  input: BriefInput, packet: AssembledPacket, extra?: string,
): ModelRequest {
  return {
    model: BRIEF_MODEL,
    max_tokens: BRIEF_MAX_TOKENS,
    output_config: { effort: BRIEF_EFFORT, format: { type: 'json_schema', schema: BRIEF_SCHEMA } },
    system: packetSystemBlocks(packet).map(b => ({
      type: 'text' as const,
      text: b.text,
      ...(b.cache ? { cache_control: { type: 'ephemeral' as const } } : {}),
    })),
    messages: [{ role: 'user', content: buildBriefUserTurn(input, extra) }],
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  };
}

export type BriefOutcome = 'brief' | 'refusal' | 'error' | 'rejected';

export interface BriefResult {
  outcome: BriefOutcome;
  /** Every run produces exactly one of these, whatever happened (S12). */
  run: EngineRun;
  brief: BriefDraft | null;
  badges: BriefBadge[];
  packet: AssembledPacket;
  /** Plain words for the screen. Never a stack trace. */
  message: string;
}

const REFUSAL_MESSAGE =
  'The model declined this one. Nothing was saved — your costume is still here.';

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

function neverWordsOf(body: ProfileBody): string[] {
  const out: string[] = [];
  for (const e of readPath(body, 'context/content-strategy/voice')) {
    if (e.state !== 'active') continue;
    const d = e.data as Record<string, unknown>;
    const never = d.never_words ?? d.never ?? d.words_they_hate;
    if (Array.isArray(never)) out.push(...never.map(String));
    else if (typeof never === 'string' && never.trim()) out.push(never.trim());
  }
  return out;
}

export function proofLibraryFor(body: ProfileBody): { id: string; permitted_platforms: string[] }[] {
  let entries;
  try {
    entries = readPath(body, 'context/content-strategy/proof-library');
  } catch {
    return [];
  }
  return entries.filter(e => e.state === 'active').map(e => {
    const d = e.data as Record<string, unknown>;
    const rights = (d.rights ?? {}) as { permitted_platforms?: string[] };
    return { id: e.id, permitted_platforms: rights.permitted_platforms ?? [] };
  });
}

/**
 * One brief. Assembles the packet, makes the call, checks the output, and
 * returns exactly one run record whatever happened.
 *
 * `stop_reason` is checked BEFORE `content` is read, so a refusal never renders
 * as an empty brief with no explanation.
 */
export async function runBrief(input: BriefInput, createMessage: CreateMessage): Promise<BriefResult> {
  const clock = input.clock ?? (() => Date.now());
  const started = clock();

  const packet = assemblePacket({
    profile_id: input.profile_id,
    body: input.body,
    config: input.config,
    now: input.now,
    packet_id: input.packet_id,
    content_profile: 'brief',
    subject: { seed: input.seed, costume: input.costume, rule: input.rule, labels: input.labels },
  });

  const ctx: BriefCheckContext = {
    costume: input.costume,
    seed: input.seed,
    proof_library: proofLibraryFor(input.body),
    never_promises: neverPromises(input.body),
    never_words: neverWordsOf(input.body),
  };

  let usage: RunUsage = { ...EMPTY_USAGE };
  let stopReason = 'error';
  let refusalCategory: string | undefined;
  let error: string | undefined;
  let outcome: BriefOutcome = 'error';
  let brief: BriefDraft | null = null;
  let badges: BriefBadge[] = [];
  let rejectedCount = 0;
  let message = '';

  const addUsage = (u: RunUsage) => {
    usage = {
      input_tokens: usage.input_tokens + (u?.input_tokens ?? 0),
      cache_read_input_tokens: usage.cache_read_input_tokens + (u?.cache_read_input_tokens ?? 0),
      cache_creation_input_tokens: usage.cache_creation_input_tokens + (u?.cache_creation_input_tokens ?? 0),
      output_tokens: usage.output_tokens + (u?.output_tokens ?? 0),
    };
  };

  try {
    let response = await createMessage(buildBriefRequest(input, packet));
    addUsage(response.usage ?? EMPTY_USAGE);
    stopReason = response.stop_reason;

    if (response.stop_reason === 'refusal') {
      refusalCategory = response.stop_details?.category ?? 'unspecified';
      outcome = 'refusal';
      message = REFUSAL_MESSAGE;
    } else {
      let draft = parseBrief(JSON.parse(response.text));
      let checked = checkBrief(draft, ctx);

      // Checks 2 and 3 reject, and the run retries ONCE with the violation named.
      if (checked.rejections.length) {
        rejectedCount += checked.rejections.length;
        response = await createMessage(
          buildBriefRequest(input, packet, briefRetryInstruction(checked.rejections)),
        );
        addUsage(response.usage ?? EMPTY_USAGE);
        stopReason = response.stop_reason;
        if (response.stop_reason === 'refusal') {
          refusalCategory = response.stop_details?.category ?? 'unspecified';
          outcome = 'refusal';
          message = REFUSAL_MESSAGE;
        } else {
          draft = parseBrief(JSON.parse(response.text));
          checked = checkBrief(draft, ctx);
          rejectedCount += checked.rejections.length;
        }
      }

      if (outcome !== 'refusal') {
        if (checked.rejections.length || checked.over_cap.length) {
          outcome = 'rejected';
          brief = null;
          badges = checked.badges;
          message = checked.over_cap.length
            ? 'It wrote a draft instead of a brief. Nothing was saved — your costume is still here.'
            : 'It answered a different request, twice. Nothing was saved — your costume is still here.';
        } else {
          outcome = 'brief';
          brief = draft;
          badges = checked.badges;
        }
      }
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    outcome = 'error';
    stopReason = 'error';
    message = 'That did not go through. Your costume is saved — you can try again.';
  }

  const finished = clock();
  const run: EngineRun = {
    id: input.run_id,
    kind: 'internal_brief',
    profile_id: input.profile_id,
    triggered_by: 'owner',
    packet: {
      packet_id: packet.packet.id,
      context_version: packet.packet.context_version,
      folders: packet.packet.folders,
      mandatory_constraints: packet.packet.mandatory_constraints,
      trimmed: packet.trimmed,
    },
    model: BRIEF_MODEL,
    effort: BRIEF_EFFORT,
    thinking: 'adaptive',
    schema_version: BRIEF_SCHEMA_VERSION,
    prompt_version: BRIEF_PROMPT_VERSION,
    capture_ids: [],
    proposal_ids: [],
    piece_ids: [input.piece_id],
    usage,
    cost_estimate_usd: estimateCostUsd(usage),
    latency_ms: Math.max(0, finished - started),
    stop_reason: stopReason,
    refusal_category: refusalCategory,
    checks: {
      rejected: rejectedCount,
      badged: badges.map(b => ({ proposal_id: input.piece_id, check: b.check })),
    },
    started_at: input.now,
    finished_at: input.now,
    error,
  };

  return { outcome, run, brief, badges, packet, message };
}

// ── §6.9 Versions, and who wins ─────────────────────────────────────────────

export interface StoredBrief extends InternalBrief {
  badges?: BriefBadge[];
}

export function readBriefs(body: ProfileBody, piece_id?: string): StoredBrief[] {
  let entries: BodyEntry[];
  try {
    entries = readPath(body, BRIEF_PATH);
  } catch {
    return [];
  }
  return entries
    .map(e => ({ ...(e.data as unknown as StoredBrief), id: e.id }))
    .filter(b => !piece_id || b.piece_id === piece_id)
    .sort((a, b) => a.brief_version - b.brief_version);
}

/**
 * The seam spec 25 §2.3 names: one function every other line reads the eight
 * fields through. The CURRENT brief is the highest version, and older versions
 * stay readable forever because the path is versioned and nothing is rewritten.
 */
export function resolveBrief(body: ProfileBody, piece_id: string): StoredBrief | null {
  const all = readBriefs(body, piece_id);
  return all.length ? all[all.length - 1] : null;
}

export function nextBriefVersion(body: ProfileBody, piece_id: string): number {
  return readBriefs(body, piece_id).length + 1;
}

export interface WriteBriefInput {
  piece_id: string;
  draft: BriefDraft;
  origin: 'engine' | 'hers';
  now: string;
  by: string;
  rule: ResolvedFormatRule;
  hook?: string;
  badges?: BriefBadge[];
  run_id?: string;
  packet_id?: string;
  context_version?: number;
  /** Carried forward from the version she is editing, so her fields stay hers. */
  field_sources?: Record<string, 'engine' | 'her'>;
}

/**
 * The first accepted brief is version 1. Her edit creates version 2. A re-run
 * creates version 2. Either way the old version stays readable and is never
 * rewritten — the path is `versioned`, handled exactly as spec 22 handles gate
 * sets: one entry per version, keyed by it.
 */
export function writeBrief(body: ProfileBody, input: WriteBriefInput): ProfileBody {
  const version = nextBriefVersion(body, input.piece_id);
  const sources: Record<string, 'engine' | 'her'> = { ...(input.field_sources ?? {}) };
  for (const f of [...BRIEF_PROSE_FIELDS, 'leave_out'] as string[]) {
    if (!sources[f]) sources[f] = input.origin === 'engine' ? 'engine' : 'her';
  }

  const brief: StoredBrief = {
    id: `${input.piece_id}-v${version}`,
    piece_id: input.piece_id,
    brief_version: version,
    one_point: input.draft.one_point,
    tension: input.draft.tension,
    realization: input.draft.realization,
    takeaway: input.draft.takeaway,
    product_role: input.draft.product_role,
    tone: input.draft.tone,
    ending: input.draft.ending,
    leave_out: input.draft.leave_out,
    cta_id: input.draft.cta_id,
    proof_used: input.draft.proof_used,
    derived_from: input.draft.derived_from,
    format_rule: {
      rule_id: input.rule.rule?.id ?? null,
      version: input.rule.rule?.version ?? 0,
      overridden_fields: [...input.rule.overridden_fields],
    },
    origin: input.origin,
    field_sources: sources,
    hook: input.hook,
    run_id: input.run_id,
    packet_id: input.packet_id,
    context_version: input.context_version,
    written_at: input.now,
    by: input.by,
    badges: input.badges,
  };

  return putEntry(body, BRIEF_PATH, {
    id: brief.id, type: 'internal_brief', data: brief as unknown as Record<string, unknown>,
  }, { writer: input.origin === 'engine' ? 'engine:content' : 'owner', now: input.now });
}

/**
 * §6.9: where SHE has written a field, a re-run never overwrites it. The re-run
 * shows both, side by side, and she chooses. This is spec 23 §4.2's deepen rule
 * applied to briefs for the same reason.
 */
export interface BriefConflict {
  field: string;
  hers: string;
  engine: string;
}

export function briefConflicts(previous: StoredBrief | null, draft: BriefDraft): BriefConflict[] {
  if (!previous) return [];
  const out: BriefConflict[] = [];
  for (const f of BRIEF_PROSE_FIELDS) {
    if (previous.field_sources?.[f as string] !== 'her') continue;
    const hers = String((previous as unknown as Record<string, unknown>)[f as string] ?? '');
    const engine = String(draft[f] ?? '');
    if (hers.trim() && engine.trim() && hers !== engine) {
      out.push({ field: f as string, hers, engine });
    }
  }
  return out;
}

/** Her fields survive a re-run untouched; the rest take the new answer. */
export function mergeKeepingHers(previous: StoredBrief | null, draft: BriefDraft): {
  draft: BriefDraft; field_sources: Record<string, 'engine' | 'her'>;
} {
  const merged: BriefDraft = { ...draft };
  const sources: Record<string, 'engine' | 'her'> = {};
  for (const f of BRIEF_PROSE_FIELDS) {
    const key = f as string;
    if (previous?.field_sources?.[key] === 'her') {
      (merged as unknown as Record<string, unknown>)[key] =
        (previous as unknown as Record<string, unknown>)[key];
      sources[key] = 'her';
    } else {
      sources[key] = 'engine';
    }
  }
  if (previous?.field_sources?.leave_out === 'her') {
    merged.leave_out = previous.leave_out;
    sources.leave_out = 'her';
  } else {
    sources.leave_out = 'engine';
  }
  return { draft: merged, field_sources: sources };
}

/**
 * Her edit of an existing brief. Only the fields she actually changed become
 * hers; everything she left alone keeps whatever marker it had. That is spec 23
 * §6.4's "clearly marked" law applied at field level, and it is what makes a
 * later re-run able to tell whose sentence it is looking at.
 */
export function herEdit(previous: StoredBrief, changes: Partial<BriefDraft>): {
  draft: BriefDraft; field_sources: Record<string, 'engine' | 'her'>;
} {
  const draft: BriefDraft = {
    one_point: previous.one_point, tension: previous.tension, realization: previous.realization,
    takeaway: previous.takeaway, product_role: previous.product_role, tone: previous.tone,
    ending: previous.ending, leave_out: previous.leave_out, cta_id: previous.cta_id,
    proof_used: previous.proof_used, derived_from: previous.derived_from,
    ...changes,
  };
  const sources: Record<string, 'engine' | 'her'> = { ...(previous.field_sources ?? {}) };
  for (const key of Object.keys(changes)) {
    const before = (previous as unknown as Record<string, unknown>)[key];
    const after = (changes as Record<string, unknown>)[key];
    if (JSON.stringify(before) !== JSON.stringify(after)) sources[key] = 'her';
  }
  return { draft, field_sources: sources };
}

/** An empty sheet, for "Write it myself": no run, no cost, origin hers (§6.8). */
export function emptyBriefDraft(costume: ResolvedCostume): BriefDraft {
  return {
    one_point: '', tension: '', realization: '', takeaway: '',
    product_role: costume.product_intensity === 'none' ? null : '',
    tone: '', ending: '', leave_out: [],
    cta_id: costume.cta ?? '', proof_used: [...(costume.proof ?? [])], derived_from: [],
  };
}

// ── §6.8 Nothing spends money without a press ───────────────────────────────

/** Published Opus 5 rates (§6.8): input $5/M, output $25/M, cache reads a tenth. */
const FIRST_BRIEF_USD = 0.12;
const LATER_BRIEF_USD = 0.06;

/**
 * "Brief them all" states the COUNT and the estimated cost in dollars before it
 * runs, and runs nothing until she confirms. The first brief of a session pays
 * for the packet; every one after it reads the same packet from cache at about a
 * tenth of the price.
 */
export function briefBatchEstimate(count: number, alreadyRunThisSession = false): {
  count: number; usd: number; words: string;
} {
  if (count <= 0) return { count: 0, usd: 0, words: 'Nothing is selected.' };
  const first = alreadyRunThisSession ? LATER_BRIEF_USD : FIRST_BRIEF_USD;
  const usd = Math.round((first + Math.max(0, count - 1) * LATER_BRIEF_USD) * 100) / 100;
  return {
    count, usd,
    words: `${count} ${count === 1 ? 'brief' : 'briefs'}, about $${usd.toFixed(2)}. Nothing runs until you say go.`,
  };
}

// ── §2.2 and §15 test 11: keyless honesty ───────────────────────────────────

export interface BriefAvailability {
  available: boolean;
  reason?: string;
}

/**
 * With no key: the costume surface resolves pieces, "Write it myself" works, and
 * the brief button is disabled with a plain reason. Nothing fabricates a brief
 * and no run is logged.
 */
export function briefAvailability(opts: {
  hasApiKey: boolean;
  briefSwitchActive: boolean;
  strategyLocked: boolean;
  gateSetLocked: boolean;
  lifecycle: string;
}): BriefAvailability {
  if (!opts.hasApiKey) {
    return {
      available: false,
      reason: 'The engine has no key set, so it cannot write a brief yet. Everything else works, and you can write the brief yourself.',
    };
  }
  if (!opts.briefSwitchActive) {
    return {
      available: false,
      reason: 'Briefs are switched off for this profile. The costume surface still works, and you can write the brief yourself.',
    };
  }
  if (!opts.strategyLocked) {
    return {
      available: false,
      reason: 'This profile has no locked strategy yet, so the engine would be reading from nothing. Walk it through strategy first.',
    };
  }
  if (!opts.gateSetLocked) {
    return {
      available: false,
      reason: 'This profile has no locked gate set, so a brief would be written toward nothing. Lock the gates first.',
    };
  }
  if (opts.lifecycle !== 'active' && opts.lifecycle !== 'setup') {
    return { available: false, reason: 'This profile is not running, so nothing new is written here.' };
  }
  return { available: true };
}

// ── Reading the request off a piece, for the surface and the API route ──────

export interface BriefSubject {
  piece: Piece;
  seed: Seed;
  costume: ResolvedCostume;
  rule: ResolvedFormatRule;
}

export function briefSubject(body: ProfileBody, piece_id: string): BriefSubject {
  const record = findPiece(body, piece_id);
  if (!record) throw new BriefRefused(`No piece ${piece_id} on this profile.`);
  const costume = record.piece.costume as ResolvedCostume;
  if (!costume?.platform || !costume?.format) {
    throw new BriefRefused('This piece has no resolved costume, so there is no request to brief.');
  }
  const seedEntry = record.piece.seed_id
    ? readPath(body, SEED_PATH).find(e => e.id === record.piece.seed_id)
    : undefined;
  if (!seedEntry) {
    throw new BriefRefused('This piece has no seed, and a brief is written from an understood idea.');
  }
  return {
    piece: record.piece,
    seed: resolveSeed(seedEntry),
    costume,
    rule: resolveFormatRule(body, costume.platform, costume.format),
  };
}
