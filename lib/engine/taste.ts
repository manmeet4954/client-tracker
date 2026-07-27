// The taste layer — spec 25 §9. Spec 10 re-cut against the locked plan.
//
// Spec 10 was written before the plan existed. PLAN §8 step 6 says pending work
// is re-judged against the locked tree — absorbed where it fits, not deployed on
// momentum. What survives is half B: her accepts, edits and dismissals distilled
// into explicit, INSPECTABLE rules the next draft is generated with. Rules are
// text the engine reads openly, never weights, and nothing trains.
//
// What does NOT survive is half A, the cross-brand playbook: cross-profile
// NUMBERS have no address under the plan (§9.6, and PLAN §5.3). This file builds
// none of it.
//
// §9.3 is the part that matters. The risk is exact and not hypothetical: a rule
// distilled from one client's rejections reaching another client's packet,
// carrying that client's words with it. What may cross is HER INSTRUCTION; a
// client's data never crosses at all, and the line is drawn mechanically rather
// than by good intentions.

import type { AppState, ClientData } from '../../types/index.ts';
import type { ProfileBody } from '../tree/body.ts';
import { readPath } from '../tree/body.ts';
import type { TasteRule } from '../tree/objects.ts';
import { resolveSeed, SEED_PATH, PIECE_PATH } from './seeds.ts';
import { resolvePiece } from './resolve.ts';
import { slideRange } from './gates.ts';
import type { ResolvedFormatRule } from './formats.ts';
import { normalizeWhitespace } from './checks.ts';
import type { CreateMessage, ModelRequest } from './extraction.ts';
import { EMPTY_USAGE, estimateCostUsd, type EngineRun, type RunUsage } from './runs.ts';

export const TASTE_PATH = 'owner/taste-rules';

/** §9.3 rule 6: at most 25 active rules enter a packet. */
export const TASTE_PACKET_CAP = 25;

/** Spec 10's threshold, kept: a rule needs repetition — three of a kind. */
export const TASTE_REPETITION_THRESHOLD = 3;

/** The one line the block sits under (§9.3 rule 6). */
export const TASTE_BLOCK_LABEL =
  'These are Manmeet\'s standing habits across her own work. Where they disagree with anything above, what is above wins.';

export class TasteRefused extends Error {}

// ── Reading and writing the store ────────────────────────────────────────────
//
// The path is `append_only`: a rule is never removed from the list. Its life is
// recorded on the record itself — proposed, accepted, confirmed, retired — each
// with its date, which is what "visible, hers, editable, deletable" means here
// without losing the trail (§9.2).

export function readTasteRules(state: Pick<AppState, 'tasteRules'>): TasteRule[] {
  return state.tasteRules ?? [];
}

export function activeTasteRules(state: Pick<AppState, 'tasteRules'>): TasteRule[] {
  return readTasteRules(state).filter(r => r.state === 'active' && r.de_identified);
}

export interface ProposeTasteRuleInput {
  id: string;
  rule: string;
  strength: TasteRule['strength'];
  evidence_refs: string[];
  now: string;
}

/** A proposal. It never leaves her screen until she moves it to `active`. */
export function proposeTasteRule(
  state: Pick<AppState, 'tasteRules'>, input: ProposeTasteRuleInput,
): TasteRule[] {
  const rule: TasteRule = {
    id: input.id,
    rule: input.rule.trim(),
    strength: input.strength,
    state: 'proposed',
    evidence_refs: [...input.evidence_refs],
    de_identified: false,
    proposed_at: input.now,
  };
  return [...readTasteRules(state), rule];
}

// ── §9.3 The leak guard ──────────────────────────────────────────────────────

export interface LeakViolation {
  kind: 'identifier' | 'number';
  token: string;
  reason: string;
}

/**
 * Every name in the system a rule may not carry: profile names and ids, channel
 * account handles, seed names and core messages, piece titles, and the people
 * bound to a profile.
 *
 * Short tokens are deliberately excluded. A three-letter profile id would match
 * inside ordinary English and would refuse every rule she ever wrote, which is
 * a guard nobody could use.
 */
export const MIN_IDENTIFIER_LENGTH = 4;

export function deIdentificationCorpus(state: AppState): string[] {
  const tokens = new Set<string>();
  const add = (v: unknown) => {
    const s = typeof v === 'string' ? v.trim() : '';
    if (s.length >= MIN_IDENTIFIER_LENGTH) tokens.add(s);
  };

  for (const c of state.clients ?? []) { add(c.id); add(c.name); }
  for (const b of state.bindings ?? []) add(b.role);

  for (const id of Object.keys(state.clientData ?? {})) {
    const data: ClientData = state.clientData[id];
    const body = data.body;
    add(data.instagram?.handle);
    if (!body) continue;
    try {
      for (const e of readPath(body, SEED_PATH)) {
        const seed = resolveSeed(e);
        add(seed.name);
        add(seed.core_message);
      }
    } catch { /* a profile with no seed bank yet */ }
    try {
      for (const e of readPath(body, PIECE_PATH)) add(resolvePiece(e).title);
    } catch { /* no pieces yet */ }
    try {
      for (const e of readPath(body, 'work-log/creation/channels')) {
        add((e.data as { account_handle?: string }).account_handle);
      }
    } catch { /* no channels yet */ }
  }
  return [...tokens];
}

/**
 * §9.3 rule 2: numbers do not cross. Spec 10's own rule 4, enforced instead of
 * stated. Single digits are excluded — "one point per slide" is a method, not a
 * client's result, and refusing it would make the guard unusable.
 */
export function metricFigures(state: AppState): string[] {
  const out = new Set<string>();
  for (const id of Object.keys(state.clientData ?? {})) {
    const body = state.clientData[id]?.body;
    if (!body) continue;
    let entries;
    try {
      entries = readPath(body, 'work-log/analysis/study-own-data');
    } catch {
      continue;
    }
    for (const e of entries) {
      const metrics = (e.data as { metrics?: Record<string, number> }).metrics ?? {};
      for (const v of Object.values(metrics)) {
        const s = String(v);
        if (/^\d{2,}$/.test(s)) out.add(s);
      }
    }
  }
  return [...out];
}

/**
 * The gate a proposed rule passes before it may become `active`. A hit REFUSES
 * activation and names the offending token, so she can rewrite the rule
 * generically and re-submit.
 *
 * The distinction the whole thing rests on: "she cuts a carousel's slide count
 * when the pillar's job is convert" is a fact about how Manmeet decides, and is
 * the same category as something she typed into the box herself. "CareerBubble
 * hated the word unlock" is a client's data wearing a rule's clothes.
 */
export function leakViolations(ruleText: string, state: AppState): LeakViolation[] {
  const out: LeakViolation[] = [];
  const text = normalizeWhitespace(ruleText).toLowerCase();

  for (const token of deIdentificationCorpus(state)) {
    if (text.includes(normalizeWhitespace(token).toLowerCase())) {
      out.push({
        kind: 'identifier', token,
        reason: `"${token}" names something inside a profile. A rule that crosses profiles carries her instruction, never a client's data.`,
      });
    }
  }

  const figures = new Set(metricFigures(state));
  for (const figure of (ruleText.match(/\d{2,}/g) ?? [])) {
    if (figures.has(figure)) {
      out.push({
        kind: 'number', token: figure,
        reason: `${figure} is a number out of one profile's own results. Numbers do not cross.`,
      });
    }
  }

  return out;
}

/**
 * §9.3 rule 4: no rule enters any packet before SHE moved it from `proposed` to
 * `active`. A proposal that never got her yes never leaves her screen.
 */
export function activateTasteRule(
  state: AppState, id: string, now: string,
): { tasteRules: TasteRule[]; violations: LeakViolation[] } {
  const rules = readTasteRules(state);
  const rule = rules.find(r => r.id === id);
  if (!rule) throw new TasteRefused(`No taste rule ${id}.`);
  const violations = leakViolations(rule.rule, state);
  if (violations.length) return { tasteRules: rules, violations };
  return {
    tasteRules: rules.map(r => r.id === id
      ? { ...r, state: 'active' as const, de_identified: true, accepted_at: now, last_confirmed: now }
      : r),
    violations: [],
  };
}

export function retireTasteRule(state: AppState, id: string, now: string): TasteRule[] {
  return readTasteRules(state).map(r =>
    r.id === id ? { ...r, state: 'retired' as const, retired_at: now } : r);
}

// ── §9.3 rules 3 and 6: what actually enters a packet ────────────────────────

const STRENGTH_ORDER: Record<TasteRule['strength'], number> = { law: 0, lean: 1 };

/**
 * The rules a drafting packet may carry, in the order §9.3 rule 6 sets: by
 * strength, then recency, capped at 25.
 *
 * `rule` and `strength` are the ONLY fields serialized. Evidence refs are
 * profile-scoped ids and never travel — acceptance test 12 asserts that no
 * evidence ref, no profile id and no profile name appears anywhere in an
 * assembled drafting packet, and it FAILS when this narrowing is removed.
 */
export function tasteRulesForPacket(
  state: Pick<AppState, 'tasteRules'>, opts: { consent: boolean },
): { rule: string; strength: TasteRule['strength'] }[] {
  if (!opts.consent) return [];
  return activeTasteRules(state)
    .slice()
    .sort((a, b) => {
      const s = STRENGTH_ORDER[a.strength] - STRENGTH_ORDER[b.strength];
      if (s !== 0) return s;
      return (b.accepted_at ?? b.proposed_at).localeCompare(a.accepted_at ?? a.proposed_at);
    })
    .slice(0, TASTE_PACKET_CAP)
    .map(r => ({ rule: r.rule, strength: r.strength }));
}

export function tasteBlockLines(
  rules: { rule: string; strength: TasteRule['strength'] }[],
): string[] {
  if (!rules.length) return [];
  return [TASTE_BLOCK_LABEL, ...rules.map(r => `${r.strength === 'law' ? 'Always' : 'Usually'}: ${r.rule}`)];
}

// ── §9.4 The conflict this will actually produce ─────────────────────────────

/**
 * Her standing habit, on record across sessions: carousels are short, five or
 * six pages, short lines. ResumeGuru's own rules say eight to ten slides.
 *
 * The profile wins (§9.3 rule 6). But the disagreement is not swallowed: the
 * drafting screen shows it once, plainly, and that collision answer is the
 * highest-value taste data there is. It is captured because it was shown.
 */
export function tasteConflictLine(
  rules: { rule: string; strength: TasteRule['strength'] }[],
  resolved: ResolvedFormatRule,
): string | null {
  const range = slideRange(resolved);
  if (!range) return null;
  for (const r of rules) {
    if (!/slide|page/i.test(r.rule)) continue;
    const nums = (r.rule.match(/\d+/g) ?? []).map(Number);
    if (!nums.length) continue;
    const mine = { min: Math.min(...nums), max: Math.max(...nums) };
    if (mine.min === range.min && mine.max === range.max) continue;
    const usual = mine.min === mine.max ? `${mine.min}` : `${mine.min} to ${mine.max}`;
    const theirs = range.min === range.max ? `${range.min}` : `${range.min} to ${range.max}`;
    return `Your usual is ${usual} slides. This profile's rules say ${theirs}. Drafted at ${theirs}.`;
  }
  return null;
}

// ── §9.2 Distillation, triggered by her, never on a schedule ─────────────────

export interface TasteCandidate {
  rule: string;
  strength: TasteRule['strength'];
  evidence_refs: string[];
  why: string;
}

export const TASTE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['candidates'],
  properties: {
    candidates: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['rule', 'strength', 'evidence_refs', 'why'],
        properties: {
          rule: { type: 'string', maxLength: 200 },
          strength: { type: 'string', enum: ['law', 'lean'] },
          evidence_refs: { type: 'array', items: { type: 'string' } },
          why: { type: 'string', maxLength: 240 },
        },
      },
    },
  },
} as const;

export const TASTE_DISTILLATION_BLOCK = `You are reading Manmeet's own edits and decisions, to name the habits behind them.

You are given a list of changes she made to drafts, and the diffs she accepted or rejected. Your job is to propose STANDING HABITS: short, plain rules about how she works, in her language.

How to hold this:
- A habit needs REPETITION. Three of a kind or it is not a habit, it is one edit. Say so rather than inventing one.
- A habit is about HER METHOD, never about a client. "She cuts the slide count when the pillar's job is convert" is a habit. "This client hated the word unlock" is that client's data, and it is not yours to carry.
- Never name a client, an account, a seed, a post, or a person. Never quote a number out of anyone's results.
- strength "law" means she does it every time; "lean" means usually.
- evidence_refs lists the change ids you actually drew on.
- why is one plain line.

If there is not enough here to say anything honest, return an empty list. An empty list is a real and useful answer.`;

/** Spec 10's threshold, at the door: a candidate with fewer than three pieces of
 *  evidence is not proposed at all. */
export function meetsRepetitionThreshold(candidate: TasteCandidate): boolean {
  return candidate.evidence_refs.length >= TASTE_REPETITION_THRESHOLD;
}

export function parseTasteCandidates(raw: unknown): TasteCandidate[] {
  const list = (raw as { candidates?: unknown })?.candidates;
  if (!Array.isArray(list)) throw new Error('the response carries no candidates list');
  return list.map(item => {
    const c = item as Partial<TasteCandidate>;
    if (typeof c.rule !== 'string' || !c.rule.trim()) throw new Error('a candidate came back with no rule');
    return {
      rule: c.rule.trim(),
      strength: c.strength === 'law' ? 'law' : 'lean',
      evidence_refs: Array.isArray(c.evidence_refs) ? c.evidence_refs.map(String) : [],
      why: typeof c.why === 'string' ? c.why : '',
    };
  });
}

/**
 * The distillation call. HER TRIGGER, never a schedule (§9.2).
 *
 * One profile at a time, because a packet is built from exactly one profile
 * (PLAN §5.3) and the run log is per profile. The candidates it proposes land in
 * the OWNER store as `proposed`, and none of them can activate without passing
 * the de-identification guard against the whole system — which is what keeps a
 * per-profile read from becoming a cross-profile leak.
 */
export interface DistillationInput {
  profile_id: string;
  body: ProfileBody;
  /** Her accepted and rejected diffs, in one line each. */
  decisions: string[];
  run_id: string;
  now: string;
  clock?: () => number;
}

export function buildDistillationRequest(input: DistillationInput): ModelRequest {
  const deltas = editDeltaStream(input.body);
  return {
    model: 'claude-opus-5',
    max_tokens: 8000,
    output_config: { effort: 'high', format: { type: 'json_schema', schema: TASTE_SCHEMA } },
    system: [{
      type: 'text', text: TASTE_DISTILLATION_BLOCK, cache_control: { type: 'ephemeral' },
    }],
    messages: [{
      role: 'user',
      content: [
        'Here is what she actually changed.',
        ...deltas.map(d => `- ${d}`),
        '',
        'And here is what she accepted or rejected.',
        ...input.decisions.map(d => `- ${d}`),
        '',
        'Name the standing habits behind these. Three of a kind or nothing.',
      ].join('\n'),
    }],
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  };
}

export interface DistillationResult {
  candidates: TasteCandidate[];
  /** One run entry, whatever happened. The same log, the same shape (§9.2). */
  run: EngineRun;
  message: string;
}

export async function runDistillation(
  input: DistillationInput, createMessage: CreateMessage,
): Promise<DistillationResult> {
  const clock = input.clock ?? (() => Date.now());
  const started = clock();
  let usage: RunUsage = { ...EMPTY_USAGE };
  let stopReason = 'error';
  let error: string | undefined;
  let candidates: TasteCandidate[] = [];
  let thin = 0;
  let message = '';

  try {
    const response = await createMessage(buildDistillationRequest(input));
    usage = { ...response.usage };
    stopReason = response.stop_reason;
    if (response.stop_reason === 'refusal') {
      message = 'The model declined this one. Nothing was proposed.';
    } else {
      const parsed = parseTasteCandidates(JSON.parse(response.text));
      candidates = parsed.filter(meetsRepetitionThreshold);
      thin = parsed.length - candidates.length;
      if (!candidates.length) {
        message = thin > 0
          ? 'Nothing here has happened three times yet. That is an honest answer, not an empty one.'
          : 'It did not find a habit in this. Keep working and try again in a while.';
      }
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    stopReason = 'error';
    message = 'That did not go through. Nothing was proposed.';
  }

  const finished = clock();
  const run: EngineRun = {
    id: input.run_id,
    kind: 'taste_distillation',
    profile_id: input.profile_id,
    triggered_by: 'owner',
    packet: {
      packet_id: `${input.run_id}-deltas`,
      context_version: input.body.context_version ?? 0,
      // The deltas are the material; no profile CONTEXT enters this call at all,
      // which is why the folder list is deliberately empty.
      folders: [],
      mandatory_constraints: ['owner/taste-rules'],
      trimmed: [],
    },
    model: 'claude-opus-5',
    effort: 'high',
    thinking: 'adaptive',
    schema_version: 1,
    prompt_version: 1,
    capture_ids: [],
    proposal_ids: candidates.map((_, i) => `${input.run_id}-c${i + 1}`),
    usage,
    cost_estimate_usd: estimateCostUsd(usage),
    latency_ms: Math.max(0, finished - started),
    stop_reason: stopReason,
    checks: { rejected: thin, badged: [] },
    started_at: input.now,
    finished_at: input.now,
    error,
  };

  return { candidates, run, message };
}

/**
 * The observation stream she never has to write: every edit delta on this
 * profile, flattened into the lines the distillation call reads.
 */
export function editDeltaStream(body: ProfileBody): string[] {
  const out: string[] = [];
  let entries;
  try {
    entries = readPath(body, 'work-log/creation/making');
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.type !== 'draft_version') continue;
    const d = e.data as { edit_delta?: { changes?: { field: string; kind: string; before: string; after: string }[] } };
    for (const [i, change] of (d.edit_delta?.changes ?? []).entries()) {
      out.push(`${e.id}#${i} · ${change.field} · ${change.kind}: "${change.before}" became "${change.after}"`);
    }
  }
  return out;
}
