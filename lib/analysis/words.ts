// The model layer — spec 27 §12. Words only, and the guards that keep it that way.
//
// The intelligence bar and the trust rule pull in opposite directions unless the
// second is MECHANICAL. This file is what makes it mechanical: four guards run
// before she sees a word, and guards 2 to 4 REJECT rather than badge — a badged
// proposal is still hers to judge, while a badged verdict has already made a claim.
//
// The pattern is spec 23 §5's, followed deliberately so there is one model-layer
// shape across both engines: the call is injected, the packet is assembled by a
// pure function, and everything except the network is testable without one.

import type { Verdict } from '../tree/objects.ts';
import type { ProfileBody } from '../tree/body.ts';
import { belowTheBar } from '../engine/feedback.ts';
import type { CreateMessage, ModelRequest } from '../engine/extraction.ts';
import { EMPTY_USAGE, estimateCostUsd, type RunUsage } from '../engine/runs.ts';
import type { AnalysisContext } from './read.ts';
import type { VerdictInput } from './verdict.ts';
import { computeCall } from './verdict.ts';

export const MODEL = 'claude-opus-5';
export const EFFORT = 'high';
/** §12.1. max_tokens caps thinking PLUS output, which is why it is not smaller. */
export const MAX_TOKENS = 8000;
export const PACKET_VERSION = 1;

// ── §12.3 What comes back ────────────────────────────────────────────────────

export interface VerdictWords {
  headline: string;
  coverage_note: string;
  patterns: { pattern_ref: string; words: string }[];
  call: { pattern_ref: string; right_call: 'yes' | 'no' | 'cannot say yet'; words: string };
  cannot_say_note: string;
  one_suggestion: string;
}

export const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'coverage_note', 'patterns', 'call', 'cannot_say_note', 'one_suggestion'],
  properties: {
    headline: { type: 'string' },
    coverage_note: { type: 'string' },
    patterns: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['pattern_ref', 'words'],
        properties: {
          // A pattern id the code computed. The model chooses which matter and
          // how to say it; it cannot invent one that has no id (§12.3).
          pattern_ref: { type: 'string' },
          words: { type: 'string' },
        },
      },
    },
    call: {
      type: 'object',
      additionalProperties: false,
      required: ['pattern_ref', 'right_call', 'words'],
      properties: {
        pattern_ref: { type: 'string' },
        right_call: { type: 'string', enum: ['yes', 'no', 'cannot say yet'] },
        words: { type: 'string' },
      },
    },
    cannot_say_note: { type: 'string' },
    one_suggestion: { type: 'string' },
  },
} as const;

/** Guard 1: structured output guarantees this parses; malformed is a run error
 *  and no verdict is shown. */
export function parseVerdictWords(raw: unknown): VerdictWords {
  const r = raw as Partial<VerdictWords> | null;
  if (!r || typeof r.headline !== 'string' || typeof r.coverage_note !== 'string') {
    throw new Error('the response carried no headline or coverage note');
  }
  if (!Array.isArray(r.patterns)) throw new Error('the response carried no patterns array');
  const call = r.call as VerdictWords['call'] | undefined;
  if (!call || typeof call.pattern_ref !== 'string' || typeof call.words !== 'string') {
    throw new Error('the response carried no call');
  }
  return {
    headline: r.headline,
    coverage_note: r.coverage_note,
    patterns: r.patterns.map(p => ({ pattern_ref: String(p.pattern_ref), words: String(p.words) })),
    call: {
      pattern_ref: call.pattern_ref,
      right_call: call.right_call === 'yes' || call.right_call === 'no' ? call.right_call : 'cannot say yet',
      words: call.words,
    },
    cannot_say_note: String(r.cannot_say_note ?? ''),
    one_suggestion: String(r.one_suggestion ?? ''),
  };
}

// ── §12.2 The packet — deliberately narrow ───────────────────────────────────

/** Block A: the method, always whole, never trimmed. */
export const VERDICT_METHOD_BLOCK = [
  'You are wording a verdict inside Manmeet\'s analysis engine. Every number in front of you was computed by code before you were called. You word it; you never compute anything.',
  '',
  'The verdict has three parts, in this order:',
  '1. Coverage. What was collected and what was not, before anything else.',
  '2. What outperformed. The sufficient patterns, each with its numbers and its n.',
  '3. The call. For the leading pattern: is doing more of this the right call — yes, no, or cannot say yet — with the reason in one plain paragraph.',
  '',
  'Four rules, fixed:',
  '1. Every number in your words must appear in the input, exactly as given. Never round it, never scale it, never add one.',
  '2. Never claim causation. This is evidence, not proof. No "proves", no "caused", no "because of", no "guarantees", no "will".',
  '3. Anything in cannot_say may only be described as not enough data yet. It is never a result.',
  '4. Speak in this profile\'s own terms: its pillar names, its jobs, its formats, its goal names.',
  '',
  '"Cannot say yet" is a real answer and is often the honest one. A call of "no" is also real: a pattern that outperforms on reach while the convert lane is starving is not a reason to make more of it.',
  'Write like a sharp strategist talking to the person who made the work. Short lines. No metrics dump, no headings, no em dashes.',
].join('\n');

export interface Vocabulary {
  pillars: { name: string; job: string | null }[];
  platforms: string[];
  formats: string[];
  costume_values: string[];
  goals: string[];
  ctas: string[];
}

/**
 * Block B: LABELS ONLY, from `content-strategy/`. Only `active` paths contribute,
 * so a switched-off platform's name never reaches the model and the cascade holds
 * here exactly as it does in spec 23 (§12.2, acceptance test 6).
 */
export function vocabularyBlock(vocab: Vocabulary): string {
  const lines = ['This profile speaks like this. Use these words and no others for the same things.'];
  if (vocab.pillars.length) {
    lines.push('Pillars: ' + vocab.pillars.map(p => `${p.name}${p.job ? ` (job: ${p.job})` : ''}`).join('; '));
  }
  if (vocab.platforms.length) lines.push('Platforms: ' + vocab.platforms.join(', '));
  if (vocab.formats.length) lines.push('Formats: ' + vocab.formats.join(', '));
  if (vocab.costume_values.length) lines.push('Costume vocabulary: ' + vocab.costume_values.join(', '));
  if (vocab.goals.length) lines.push('Goals: ' + vocab.goals.join(', '));
  if (vocab.ctas.length) lines.push('CTAs: ' + vocab.ctas.join(', '));
  return lines.join('\n');
}

/**
 * The vocabulary block, built from the profile's ACTIVE folders only. A
 * switched-off platform's name never reaches the model, and neither does a
 * costume value that only ever appeared on one — the cascade holds at the packet,
 * exactly as it does in spec 23 §5.4 (acceptance test 6).
 */
export function vocabularyFor(ctx: AnalysisContext): Vocabulary {
  const live = new Set(ctx.facts.platforms);
  const costume = new Set<string>();
  for (const j of ctx.joined) {
    const c = j.piece.birth?.costume;
    if (!c || (c.platform && !live.has(c.platform))) continue;
    for (const [key, value] of Object.entries(c)) {
      if (key === 'platform' || key === 'pillar_id' || key === 'proof') continue;
      if (typeof value === 'string' && value) costume.add(value);
    }
  }
  return {
    pillars: ctx.facts.pillars.map(p => ({ name: p.name, job: p.job })),
    platforms: [...live],
    formats: Object.entries(ctx.facts.formats)
      .filter(([platform]) => live.has(platform))
      .flatMap(([, formats]) => formats),
    costume_values: [...costume].sort(),
    goals: ctx.facts.goals.map(g => g.name),
    ctas: ctx.facts.ctas,
  };
}

export function buildRequest(
  input: VerdictInput, vocab: Vocabulary, retryNote?: string,
): ModelRequest {
  return {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    output_config: { effort: EFFORT, format: { type: 'json_schema', schema: VERDICT_SCHEMA } },
    system: [
      { type: 'text', text: VERDICT_METHOD_BLOCK, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: vocabularyBlock(vocab), cache_control: { type: 'ephemeral' } },
    ],
    messages: [{
      role: 'user',
      content: [
        retryNote ? `Your last answer was rejected. ${retryNote}\n` : '',
        'Here is the computed verdict input, whole:',
        JSON.stringify(input),
      ].filter(Boolean).join('\n'),
    }],
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  };
}

// ── §12.4 The four guards, run before she sees a word ────────────────────────

export interface GuardViolation {
  guard: 'schema' | 'number' | 'causation' | 'sufficiency';
  reason: string;
}

const NUMERAL = /\d+(?:\.\d+)?/g;

function normalize(n: number): string {
  return String(Number(n.toFixed(4)));
}

/**
 * Every quantity the input actually carries, in every formatting the words may
 * legitimately use: `3.1%`, `3.1 percent` and `0.031` are the same number, so a
 * lift of 0.031 permits the numeral 3.1 and vice versa (§12.4 guard 2).
 */
export function allowedNumbers(input: VerdictInput): Set<string> {
  const out = new Set<string>();
  const add = (n: number) => {
    if (!Number.isFinite(n)) return;
    out.add(normalize(n));
    out.add(normalize(Math.abs(n)));
    out.add(normalize(Math.round(n)));
    out.add(normalize(Math.abs(Math.round(n))));
    out.add(normalize(Number(n.toFixed(1))));
    out.add(normalize(Math.abs(Number(n.toFixed(1)))));
    out.add(normalize(Number(n.toFixed(2))));
  };
  const raw = JSON.stringify(input) ?? '';
  for (const token of raw.match(NUMERAL) ?? []) {
    const n = Number(token);
    add(n);
    add(n * 100);       // 0.031 → 3.1
    add(n / 100);       // 3.1 → 0.031
  }
  return out;
}

/** Guard 2 — the number guard. This is what makes "AI can never invent a metric"
 *  mechanical rather than a promise. */
export function numberGuard(words: VerdictWords, input: VerdictInput): GuardViolation[] {
  const allowed = allowedNumbers(input);
  const out: GuardViolation[] = [];
  for (const [where, text] of stringsOf(words)) {
    for (const token of (text.replace(/,/g, '').match(NUMERAL) ?? [])) {
      if (allowed.has(normalize(Number(token)))) continue;
      out.push({
        guard: 'number',
        reason: `"${token}" in ${where} is not a number the engine computed. Every number in your words must appear in the input.`,
      });
    }
  }
  return out;
}

const BANNED = [
  /\bproves?\b/i, /\bproven\b/i, /\bcaused?\b/i, /\bbecause of\b/i,
  /\bguarantees?\b/i, /\bguaranteed\b/i, /\bwill\b/i,
];

/** Guard 3 — the causation guard (S5). Directional evidence, never causation. */
export function causationGuard(words: VerdictWords): GuardViolation[] {
  const out: GuardViolation[] = [];
  for (const [where, text] of stringsOf(words)) {
    for (const rx of BANNED) {
      const hit = text.match(rx);
      if (hit) {
        out.push({
          guard: 'causation',
          reason: `"${hit[0]}" in ${where} claims more than a comparison can carry. This is evidence, not proof.`,
        });
      }
    }
  }
  return out;
}

/** Guard 4 — the sufficiency guard. Nothing in `cannot_say` may be spoken of as
 *  a result, and no pattern_ref may point at something that does not exist. */
export function sufficiencyGuard(words: VerdictWords, input: VerdictInput): GuardViolation[] {
  const known = new Set(input.patterns.filter(p => p.sufficient).map(p => p.id));
  const forbidden = new Set(input.cannot_say.map(c => c.pattern_id));
  const out: GuardViolation[] = [];
  const refs = [...words.patterns.map(p => p.pattern_ref), words.call.pattern_ref];
  for (const ref of refs) {
    if (!ref) continue;
    if (forbidden.has(ref)) {
      out.push({
        guard: 'sufficiency',
        reason: `"${ref}" sits in cannot_say. It may only be described as not enough data yet, never as a result.`,
      });
    } else if (!known.has(ref)) {
      out.push({
        guard: 'sufficiency',
        reason: `"${ref}" is not a pattern the engine computed.`,
      });
    }
  }
  return out;
}

export function runGuards(words: VerdictWords, input: VerdictInput): GuardViolation[] {
  return [
    ...numberGuard(words, input),
    ...causationGuard(words),
    ...sufficiencyGuard(words, input),
  ];
}

function stringsOf(words: VerdictWords): [string, string][] {
  const out: [string, string][] = [
    ['the headline', words.headline],
    ['the coverage note', words.coverage_note],
    ['the cannot-say note', words.cannot_say_note],
    ['the suggestion', words.one_suggestion],
    ['the call', words.call.words],
  ];
  words.patterns.forEach((p, i) => out.push([`pattern ${i + 1}`, p.words]));
  return out;
}

// ── The run ──────────────────────────────────────────────────────────────────

export const WORDS_WITHHELD_LINE =
  'The engine’s numbers are here; its wording did not pass the check.';

export const NO_KEY_LINE =
  'The engine’s numbers are here. The written summary needs an API key, and there is none set.';

export const WORDS_OFF_LINE =
  'The engine’s numbers are here. The written summary is switched off for this profile.';

export interface WordingResult {
  verdict: Verdict;
  words?: VerdictWords;
  violations: GuardViolation[];
  /** Plain words for the screen. Never a stack trace. */
  message: string;
  usage: RunUsage;
  cost_estimate_usd: number;
  stop_reason: string;
  error?: string;
}

export interface WordingInput {
  verdict: Verdict;
  vocabulary: Vocabulary;
  /** Off means every number still computes; only the paragraph goes away (§18.2). */
  words_switch_active: boolean;
  has_api_key: boolean;
}

/**
 * One wording call, with one retry. On a second failure the verdict renders in
 * its CODE-COMPUTED form with a plain line — never a fabricated sentence, and
 * never a silent absence.
 */
export async function wordVerdict(
  input: WordingInput, createMessage: CreateMessage | null,
): Promise<WordingResult> {
  const computed = input.verdict.input as unknown as VerdictInput;
  const withheld = (message: string, violations: GuardViolation[] = [], error?: string): WordingResult => ({
    verdict: {
      ...input.verdict,
      state: violations.length ? 'words-withheld' : input.verdict.state,
      guards: { rejected: violations.length, reasons: violations.map(v => v.reason) },
    },
    violations,
    message,
    usage: { ...EMPTY_USAGE },
    cost_estimate_usd: 0,
    stop_reason: error ? 'error' : 'not-called',
    error,
  });

  if (!input.words_switch_active) return withheld(WORDS_OFF_LINE);
  if (!input.has_api_key || !createMessage) return withheld(NO_KEY_LINE);

  let usage: RunUsage = { ...EMPTY_USAGE };
  const addUsage = (u: RunUsage | undefined) => {
    usage = {
      input_tokens: usage.input_tokens + (u?.input_tokens ?? 0),
      cache_read_input_tokens: usage.cache_read_input_tokens + (u?.cache_read_input_tokens ?? 0),
      cache_creation_input_tokens: usage.cache_creation_input_tokens + (u?.cache_creation_input_tokens ?? 0),
      output_tokens: usage.output_tokens + (u?.output_tokens ?? 0),
    };
  };

  const violations: GuardViolation[] = [];
  let stopReason = 'error';

  try {
    let response = await createMessage(buildRequest(computed, input.vocabulary));
    addUsage(response.usage);
    stopReason = response.stop_reason;

    // stop_reason is read BEFORE the content is trusted (§12.1).
    if (response.stop_reason === 'refusal') {
      return {
        ...withheld('The model declined this one. The numbers are here; the wording is not.'),
        stop_reason: 'refusal', usage, cost_estimate_usd: estimateCostUsd(usage),
      };
    }

    let words = parseVerdictWords(JSON.parse(response.text));
    let bad = runGuards(words, computed);

    if (bad.length) {
      violations.push(...bad);
      response = await createMessage(
        buildRequest(computed, input.vocabulary, bad.map(v => v.reason).join(' ')));
      addUsage(response.usage);
      stopReason = response.stop_reason;
      if (response.stop_reason === 'refusal') {
        return {
          ...withheld(WORDS_WITHHELD_LINE, violations),
          stop_reason: 'refusal', usage, cost_estimate_usd: estimateCostUsd(usage),
        };
      }
      words = parseVerdictWords(JSON.parse(response.text));
      bad = runGuards(words, computed);
      if (bad.length) {
        violations.push(...bad);
        return {
          ...withheld(WORDS_WITHHELD_LINE, violations),
          stop_reason: stopReason, usage, cost_estimate_usd: estimateCostUsd(usage),
        };
      }
    }

    return {
      verdict: {
        ...input.verdict,
        words,
        state: 'worded',
        model: MODEL,
        effort: EFFORT,
        packet_version: PACKET_VERSION,
        guards: { rejected: violations.length, reasons: violations.map(v => v.reason) },
      },
      words,
      violations,
      message: '',
      usage,
      cost_estimate_usd: estimateCostUsd(usage),
      stop_reason: stopReason,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return {
      ...withheld('That did not go through. The numbers are here and nothing was lost.', violations, error),
      usage, cost_estimate_usd: estimateCostUsd(usage), stop_reason: 'error',
    };
  }
}

/**
 * The computed verdict rendered in words the CODE wrote — no model involved.
 * This is what the screen shows when the wording is off, keyless or withheld,
 * and it is why acceptance test 12 can say "nothing fabricates a sentence".
 */
export function computedWords(verdict: Verdict): VerdictWords {
  const input = verdict.input as unknown as VerdictInput;
  const call = computeCall(input);
  const sufficient = input.patterns.filter(p => p.sufficient);
  return {
    headline: `${input.cycle} verdict, ${input.period_start} to ${input.period_end}.`,
    coverage_note: input.coverage.gaps.length
      ? `Collected ${input.coverage.days_covered} of ${input.coverage.days_expected} days. The rest is a gap, not a dip.`
      : `Collected all ${input.coverage.days_expected} days of this period.`,
    patterns: sufficient.map(p => ({
      pattern_ref: p.id,
      words: `${p.dimension} "${p.value}": ${p.n} pieces at the ${p.window} window.`,
    })),
    call: {
      pattern_ref: call.pattern_ref ?? '',
      right_call: call.right_call,
      words: call.reason,
    },
    cannot_say_note: input.cannot_say.length
      ? `${input.cannot_say.length} patterns are not there yet. ${input.cannot_say.slice(0, 3).map(c => `${c.dimension} "${c.value}" needs ${c.owed}`).join('; ')}.`
      : 'Nothing was held back for want of data.',
    one_suggestion: call.right_call === 'yes'
      ? 'Keep the leading pattern going and let the next cycle confirm it.'
      : 'Nothing to change on the numbers alone this cycle.',
  };
}

/**
 * §12.4, "Then the real bar." Every verdict carries Below the bar, exactly as
 * spec 23 §5.6 defines it. The count of these over time is the honest measure of
 * whether the verdicts read like a strategist — if it is not falling, the loop is
 * broken and we fix the loop.
 */
export function belowTheBarOnVerdict(
  body: ProfileBody, input: { id: string; verdict: Verdict; reason: string }, now: string,
): ProfileBody {
  return belowTheBar(body, {
    id: input.id,
    run_id: input.verdict.run_id,
    context_version: input.verdict.context_version,
    reason: input.reason,
    target_id: input.verdict.id,
  }, now);
}
