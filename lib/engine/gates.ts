// The seven gates — spec 25 §6, plus the rights gate of §7.
//
// PLAN §5.1: "five brand gates, customizable per client + two operational gates
// that never vary (accuracy, format). Nothing reaches review until all seven
// pass."
//
// This spec DERIVES NOTHING. Spec 22 §8.4 derived and locked the gate set with
// strategy; this file reads five `kind: 'brand'` gates plus spec 21's shipped
// `OPERATIONAL_GATES` and runs them.
//
// Every gate is scored as the AND of its machine checks and its model verdict.
// If any HARD machine check fails, the gate run short-circuits and the model
// call is never made: the draft is going back regardless, and paying for a
// judgment on copy that is already provably wrong is the kind of spend that has
// no defence (§6.3).
//
// Nothing in this file calls a model. The reviewer call lives in `drafting.ts`,
// beside the drafting call, and is injected there.

import type { ProfileBody } from '../tree/body.ts';
import { putEntry, readPath } from '../tree/body.ts';
import type {
  BodyEntry, Gate, GateSet, MaterialRef, Piece, ResolvedCostume, RightsRecord, Seed,
} from '../tree/objects.ts';
import { OPERATIONAL_GATES, rightsClearedAt } from '../tree/objects.ts';
import { readGateSet } from '../strategy/derivation.ts';
import { PIECE_PATH } from './seeds.ts';
import { findPiece, resolvePiece } from './resolve.ts';
import { rightsFor } from './materials.ts';
import {
  FORMAT_RULES_VERSION, forbiddenBy, formatRulesResolution, neverText,
  type ResolvedFormatRule,
} from './formats.ts';
import { normalizeWhitespace } from './checks.ts';
import {
  MAKING_PATH, readDrafts, resolveDraft, type Claim, type DraftContent, type DraftPayload,
  type DraftVersion, type FormatFamily,
} from './drafts.ts';

export const GATE_RUN_PATH = 'work-log/creation/making/gate-runs';

export class GateRefused extends Error {}

// ── §6.6 The record ──────────────────────────────────────────────────────────

export type VerdictValue = 'pass' | 'fail' | 'flagged' | 'not-applicable' | 'not-run';

export interface GateVerdict {
  gate_id: string;
  gate_kind: 'brand' | 'operational' | 'rights';
  /** Stamped PER VERDICT, per S14. That is the amendment made mechanical. */
  gate_version: number;
  source: 'machine' | 'model' | 'machine+model';
  verdict: VerdictValue;
  /** One plain line. */
  reason: string;
  /** A verbatim substring of the draft. */
  evidence_span?: string;
  /** Never present on rights, and never on a boundaries failure (§6.9). */
  override?: { by: string; at: string; reason: string };
  /** Accuracy only: her "I know my business" mark, with her words (§6.4). */
  owner_verified?: { by: string; at: string; reason: string; claim: string }[];
}

export interface GateRun {
  id: string;
  piece_id: string;
  draft_version_id: string;
  gate_set_version: number;
  strategy_version: number;
  format_rules_version: number;
  format_rules_resolution: string;
  verdicts: GateVerdict[];
  overall: 'passed' | 'failed' | 'passed-with-override';
  /** Null when a hard machine check short-circuited the model call (§6.3). */
  engine_run_id: string | null;
  run_at: string;
  run_by: string;
}

// ── §6.3 The machine half ────────────────────────────────────────────────────

export type MachineCheckId =
  | 'hook-verbatim' | 'never-words' | 'boundaries' | 'proof-presence' | 'promise-claims'
  | 'format-rules' | 'convert-carousel';

export interface MachineCheck {
  check: MachineCheckId;
  gate_id: string;
  passed: boolean;
  /**
   * A HARD failure short-circuits the whole run: no model call is made. A soft
   * failure is a flag she resolves (an unbacked claim), which is §6.4 item 2.
   */
  hard: boolean;
  reason: string;
  evidence_span?: string;
}

/** The caps the universal library asserts where a rule states a shape but no
 *  number. A profile's `rules/` override supplies its own numbers, and override
 *  beats universal, always (§4.5). */
export const CAROUSEL_HEADING_WORD_CAP = 8;
export const CAROUSEL_BODY_LINE_CAP = 3;
export const CAROUSEL_SLIDE_WORD_CAP = 40;
export const REEL_LINE_WORD_CAP = 25;

const BULLETS = /[•·▪◦‣]|^\s*[-*]\s+|^\s*\d+[.)]\s+/m;
const SLIDE_MARKER = /\b(slide\s*\d+|step\s*\d+\s*[:.]|^#{1,6}\s)/im;

function words(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/** `8 to 10 slides` → {min:8,max:10}; `6 slides` → {min:6,max:6}. A band with
 *  no number in it binds nothing, which is honest rather than a guess. */
export function parseBand(band: string): { min: number; max: number } | null {
  const nums = (band.match(/\d+/g) ?? []).map(Number);
  if (!nums.length) return null;
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

export function slideRange(rule: ResolvedFormatRule): { min: number; max: number } | null {
  const bands = (rule.rule?.length_bands ?? []).map(parseBand).filter(Boolean) as
    { min: number; max: number }[];
  if (!bands.length) return null;
  return {
    min: Math.min(...bands.map(b => b.min)),
    max: Math.max(...bands.map(b => b.max)),
  };
}

/** Every string in a draft, for the blunt scans. */
export function draftText(content: DraftContent): string {
  const parts: string[] = [content.hook, content.caption ?? '', content.cta_line];
  switch (content.format_family) {
    case 'carousel':
      for (const s of content.slides) parts.push(s.heading, ...s.lines);
      break;
    case 'reel':
      for (const b of content.script) parts.push(b.spoken, b.on_screen_text ?? '');
      break;
    case 'static':
      parts.push(content.visual_text);
      break;
    case 'longform-text':
      parts.push(content.opening_claim, ...content.body_blocks, content.closing);
      break;
    case 'newsletter':
      parts.push(content.scene, ...content.sections, content.practice);
      break;
  }
  return parts.filter(Boolean).join('\n');
}

/** Where her hook has to appear, per family (§4.7). */
export function hookPositionOf(content: DraftContent): string {
  switch (content.format_family) {
    case 'carousel':
      return content.slides[0] ? [content.slides[0].heading, ...content.slides[0].lines].join(' ') : '';
    case 'reel':
      return content.script[0]?.spoken ?? '';
    case 'longform-text':
      return content.opening_claim;
    case 'newsletter':
      return content.scene;
    default:
      return content.visual_text;
  }
}

/**
 * §4.7's verbatim guard. Whitespace normalized, nothing else: case and
 * punctuation still matter, because "used verbatim and never improved" would
 * mean nothing otherwise. Exactly spec 23's guard, applied to her hook.
 */
export function hookViolation(content: DraftContent, herHook?: string): string | null {
  if (!herHook || !herHook.trim()) return null;
  const wanted = normalizeWhitespace(herHook);
  if (normalizeWhitespace(content.hook) !== wanted) {
    return `Her hook was "${herHook}" and the draft came back with "${content.hook}". It is used verbatim and never improved.`;
  }
  if (!normalizeWhitespace(hookPositionOf(content)).includes(wanted)) {
    return `Her hook is not where this format puts it (${content.format_family}). It is used verbatim, in place.`;
  }
  return null;
}

export interface MachineCheckContext {
  content: DraftContent;
  claims: Claim[];
  costume: ResolvedCostume;
  rule: ResolvedFormatRule;
  /** Her hook, from the brief, when she wrote one. */
  her_hook?: string;
  never_promises: string[];
  never_words: string[];
  /** Proof ids that actually exist in this profile's library. */
  proof_ids: string[];
  /** Whether boundaries forbid a `promise`-kind claim outright. */
  promises_forbidden?: boolean;
  /** Claims she has marked owner-verified, by claim text (§6.4 item 2). */
  owner_verified?: string[];
  brand_gate_ids: string[];
}

// ── The format rule set, run as checks (§4.5, §6.5) ──────────────────────────

function formatChecks(ctx: MachineCheckContext): MachineCheck[] {
  const out: MachineCheck[] = [];
  const c = ctx.content;
  const fail = (reason: string, evidence?: string, hard = true) =>
    out.push({ check: 'format-rules', gate_id: 'format', passed: false, hard, reason, evidence_span: evidence });

  const ruleName = ctx.rule.rule?.label ?? 'this format';

  if (c.format_family === 'carousel') {
    const range = slideRange(ctx.rule);
    if (range && c.slides.length && (c.slides.length < range.min || c.slides.length > range.max)) {
      fail(
        `This draft is ${c.slides.length} slides. ${ruleName}'s rule here says ${range.min} to ${range.max}.`,
        c.slides[0] ? c.slides[0].heading : undefined,
      );
    }
    for (const s of c.slides) {
      const body = s.lines.join(' ');
      const slideWords = words(s.heading) + words(body);
      if (slideWords > CAROUSEL_SLIDE_WORD_CAP) {
        fail(
          `Slide ${s.index} is ${slideWords} words. This profile's rule says a heading plus 1 to ${CAROUSEL_BODY_LINE_CAP} short sentences.`,
          [s.heading, ...s.lines].filter(Boolean)[0],
        );
      }
      if (words(s.heading) > CAROUSEL_HEADING_WORD_CAP) {
        fail(`Slide ${s.index}'s heading is ${words(s.heading)} words. A heading is a few words.`, s.heading);
      }
      if (s.lines.length > CAROUSEL_BODY_LINE_CAP) {
        fail(`Slide ${s.index} carries ${s.lines.length} lines. The rule says 1 to ${CAROUSEL_BODY_LINE_CAP}.`, s.lines[0]);
      }
    }
    const cover = c.slides[0];
    if (cover && cover.lines.filter(l => l.trim()).length > 0) {
      fail('The cover carries more than the hook. The cover is one simple hook and nothing else.', cover.lines[0]);
    }
    const last = c.slides[c.slides.length - 1];
    if (last && c.cta_line.trim()) {
      const lastText = normalizeWhitespace([last.heading, ...last.lines].join(' ')).toLowerCase();
      if (!lastText.includes(normalizeWhitespace(c.cta_line).toLowerCase())) {
        fail('The last slide is not the CTA. It is the follow and the ask, not a philosophical close.', last.heading);
      }
    }
    const longestSlide = Math.max(0, ...c.slides.map(s => words([s.heading, ...s.lines].join(' '))));
    if (c.caption !== null && c.slides.length && words(c.caption) <= longestSlide) {
      fail('The caption is not carrying the depth. On this format the depth lives in the caption.', c.caption ?? undefined);
    }
  }

  if (c.format_family === 'reel') {
    for (const beat of c.script) {
      if (BULLETS.test(beat.spoken) || SLIDE_MARKER.test(beat.spoken)) {
        fail('A reel script is spoken language. This one carries bullets or headings.', beat.spoken);
      }
      for (const sentence of beat.spoken.split(/(?<=[.!?])\s+/)) {
        if (words(sentence) > REEL_LINE_WORD_CAP) {
          fail(
            `One line runs to ${words(sentence)} words. It has to be sayable out loud in one breath.`,
            sentence,
          );
        }
      }
    }
    if (c.script.length && c.script[0].beat !== 'hook') {
      fail('The first beat is not the hook. The hook is the first thing said.', c.script[0].spoken);
    }
    if (c.script.length && !c.script.some(b => b.beat === 'action')) {
      fail('There is no named action. A reel names one action.');
    }
  }

  if (c.format_family === 'static') {
    if (ctx.claims.length && !ctx.claims.some(cl => cl.primary)) {
      fail('Nothing is marked as the one claim. A static piece makes one clear claim.');
    }
    if (c.caption && c.visual_text && normalizeWhitespace(c.visual_text).includes(normalizeWhitespace(c.caption))) {
      fail('The caption repeats the visual instead of deepening it.', c.caption);
    }
  }

  if (c.format_family === 'longform-text') {
    if (c.opening_claim.trim().endsWith('?')) {
      fail('This platform reads the argument. The first line is a claim, not a question.', c.opening_claim);
    }
    if (!c.body_blocks.filter(b => b.trim()).length) {
      fail('There is a claim and no reasoning behind it.', c.opening_claim);
    }
  }

  if (c.format_family === 'newsletter') {
    for (const [field, value] of [['scene', c.scene], ['sections', c.sections.join('')], ['practice', c.practice]] as const) {
      if (!String(value).trim()) {
        fail(`The ${field} is missing. A newsletter opens on a scene, argues, and ends on something usable.`);
      }
    }
  }

  return out;
}

/**
 * §4.5: "Never use carousel as the convert format" is a MACHINE CHECK, not a
 * hope. It reads the merged rule's machine clauses, so any profile's own
 * prohibition works the same way with no code change.
 */
function convertCarouselCheck(ctx: MachineCheckContext): MachineCheck[] {
  return forbiddenBy(ctx.rule, ctx.costume as unknown as Record<string, unknown>).map(f => ({
    check: 'convert-carousel' as const,
    gate_id: 'format',
    passed: false,
    hard: true,
    reason: `${f.says} This costume is ${Object.entries(f.when).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
  }));
}

/**
 * Every machine check, in one pass. Pure: no body, no network, no clock.
 */
export function runMachineChecks(ctx: MachineCheckContext): MachineCheck[] {
  const out: MachineCheck[] = [];
  const text = draftText(ctx.content).toLowerCase();

  // Her hook, verbatim. It attaches to every brand gate, because a draft that
  // improved her hook is not this brand's piece (§4.7, §6.3).
  const hook = hookViolation(ctx.content, ctx.her_hook);
  if (hook) {
    for (const id of ctx.brand_gate_ids) {
      out.push({ check: 'hook-verbatim', gate_id: id, passed: false, hard: true, reason: hook, evidence_span: ctx.content.hook });
    }
  }

  // Never-words from voice/, on every brand gate.
  const said = ctx.never_words.filter(w => w.trim() && text.includes(w.toLowerCase().trim()));
  if (said.length) {
    for (const id of ctx.brand_gate_ids) {
      out.push({
        check: 'never-words', gate_id: id, passed: false, hard: true,
        reason: `This voice never says: ${said.join(', ')}.`,
        evidence_span: said[0],
      });
    }
  }

  // Accuracy 1: within boundaries. A substring scan, deliberately blunt (§6.4).
  const crossed = ctx.never_promises.filter(p => p.trim() && text.includes(p.toLowerCase().trim()));
  for (const phrase of crossed) {
    out.push({
      check: 'boundaries', gate_id: 'accuracy', passed: false, hard: true,
      reason: `This brand never promises: ${phrase}. Boundaries are the brand's own declared law, so this one is not overridable here.`,
      evidence_span: phrase,
    });
  }

  // Accuracy 2: backed by proof, or FLAGGED — shown to her, named, with the
  // proof it would need. Soft, because she can attach proof, edit the claim, or
  // mark it owner-verified with a reason (§6.4 item 2).
  const verified = new Set((ctx.owner_verified ?? []).map(normalizeWhitespace));
  for (const claim of ctx.claims) {
    if (!claim.needs_proof) continue;
    if (verified.has(normalizeWhitespace(claim.text))) continue;
    if (!claim.proof_id) {
      out.push({
        check: 'proof-presence', gate_id: 'accuracy', passed: false, hard: false,
        reason: `"${claim.text}" states a ${claim.kind} and cites no proof. Attach proof, soften the claim, or mark it verified with a reason.`,
        evidence_span: claim.text,
      });
      continue;
    }
    if (!ctx.proof_ids.includes(claim.proof_id)) {
      out.push({
        check: 'proof-presence', gate_id: 'accuracy', passed: false, hard: true,
        reason: `"${claim.text}" cites proof "${claim.proof_id}", which is not in the proof library.`,
        evidence_span: claim.text,
      });
    }
  }

  // Accuracy 3: no `promise` claim at all where boundaries forbid promises.
  if (ctx.promises_forbidden) {
    for (const claim of ctx.claims.filter(c => c.kind === 'promise')) {
      out.push({
        check: 'promise-claims', gate_id: 'accuracy', passed: false, hard: true,
        reason: `"${claim.text}" is a promise, and this brand's boundaries forbid promises.`,
        evidence_span: claim.text,
      });
    }
  }

  out.push(...formatChecks(ctx));
  out.push(...convertCarouselCheck(ctx));
  return out;
}

export function hardFailures(checks: MachineCheck[]): MachineCheck[] {
  return checks.filter(c => !c.passed && c.hard);
}

// ── Reading the context the checks need, off the body ────────────────────────

function listFrom(body: ProfileBody, path: string, keys: string[]): string[] {
  const out: string[] = [];
  let entries: BodyEntry[];
  try {
    entries = readPath(body, path);
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.state !== 'active') continue;
    const d = e.data as Record<string, unknown>;
    for (const key of keys) {
      const v = d[key];
      if (Array.isArray(v)) out.push(...v.map(String));
      else if (typeof v === 'string' && v.trim()) out.push(v.trim());
    }
  }
  return out;
}

export function neverPromisesOf(body: ProfileBody): string[] {
  return listFrom(body, 'context/content-strategy/boundaries',
    ['never_promises', 'never_promise', 'prohibited_claims']);
}

export function neverWordsOf(body: ProfileBody): string[] {
  return listFrom(body, 'context/content-strategy/voice', ['never_words', 'never', 'words_they_hate']);
}

export function proofIdsOf(body: ProfileBody): string[] {
  try {
    return readPath(body, 'context/content-strategy/proof-library')
      .filter(e => e.state === 'active').map(e => e.id);
  } catch {
    return [];
  }
}

export function promisesForbidden(body: ProfileBody): boolean {
  try {
    return readPath(body, 'context/content-strategy/boundaries').some(e => {
      const d = e.data as Record<string, unknown>;
      return d.promises_forbidden === true || d.no_promises === true;
    });
  } catch {
    return false;
  }
}

/** The five brand gates plus the two operational ones, in that order. */
export function gatesOf(body: ProfileBody): { set: GateSet | null; gates: Gate[] } {
  const set = readGateSet(body);
  if (!set) return { set: null, gates: [] };
  const brand = set.gates.filter(g => g.kind === 'brand');
  const operational = set.gates.filter(g => g.kind === 'operational');
  return { set, gates: [...brand, ...(operational.length ? operational : OPERATIONAL_GATES)] };
}

// ── §7 The rights gate (S21) ─────────────────────────────────────────────────

/**
 * §7.4's honest line, made mechanical. Migration wrote a placeholder record on
 * every legacy asset — all `unknown`, nothing stated — and that is an ABSENCE
 * written down, not a recorded refusal. `consent: 'not-given'`, a restriction,
 * a passed expiry or a platform list that excludes this one are all somebody
 * actually saying something, and grace never forgives those.
 */
export function rightsAbsent(r: RightsRecord | undefined): boolean {
  if (!r) return true;
  return r.ownership === 'unknown'
    && r.consent === 'unknown'
    && !r.expiry
    && r.restriction === 'none'
    && r.permitted_platforms.length === 0;
}

export interface RightsFinding {
  ref: MaterialRef;
  state: 'cleared' | 'ungraded' | 'blocked';
  reason: string;
}

export function rightsBaselineOf(body: ProfileBody): 'legacy-grace' | 'enforced' {
  return body.rights_baseline === 'enforced' ? 'enforced' : 'legacy-grace';
}

/**
 * Every asset in `asset_refs[]` and every proof item in `proof_refs[]` on the
 * current draft version, against this piece's platform and its SCHEDULED date
 * (or today when nothing is scheduled yet). This spec defines no second rights
 * object and writes no second checker.
 */
export function rightsFindings(
  body: ProfileBody, piece: Piece, at: string,
): RightsFinding[] {
  const platform = piece.costume?.platform ?? '';
  const baseline = rightsBaselineOf(body);
  const out: RightsFinding[] = [];
  for (const ref of piece.materials ?? []) {
    const found = rightsFor(body, ref.kind, ref.id, ref.path);
    const rights = found?.rights;
    if (rightsClearedAt(rights, platform, at)) {
      out.push({ ref, state: 'cleared', reason: '' });
      continue;
    }
    if (rightsAbsent(rights)) {
      out.push({
        ref,
        state: baseline === 'enforced' ? 'blocked' : 'ungraded',
        reason: baseline === 'enforced'
          ? `Nothing is recorded about the rights on ${ref.kind} "${ref.id}", and this profile is enforcing.`
          : `Nothing is recorded about the rights on ${ref.kind} "${ref.id}". It will not stop this piece yet.`,
      });
      continue;
    }
    out.push({
      ref, state: 'blocked',
      reason: rightsBlockReason(rights, platform, at, ref),
    });
  }
  return out;
}

function rightsBlockReason(
  r: RightsRecord | undefined, platform: string, at: string, ref: MaterialRef,
): string {
  const what = `${ref.kind} "${ref.id}"`;
  if (!r) return `There is no rights record on ${what} at all.`;
  if (r.restriction === 'blocked') return `${what} is marked blocked. Someone already said no.`;
  if (r.consent !== 'given') return `No consent is recorded for ${what}.`;
  if (r.permitted_platforms.length && !r.permitted_platforms.includes(platform)) {
    return `${what} is permitted on ${r.permitted_platforms.join(', ')}, and this piece is for ${platform}.`;
  }
  if (r.expiry && new Date(r.expiry).getTime() < new Date(at).getTime()) {
    return `The permission on ${what} runs out on ${r.expiry.slice(0, 10)}, before this piece goes out.`;
  }
  return `Something in the rights record on ${what} does not cover this use.`;
}

/** The scheduled date this piece will actually post on, or today. */
export function publicationDate(body: ProfileBody, piece: Piece, now: string): string {
  if (piece.scheduled_date) return piece.scheduled_date;
  try {
    const record = readPath(body, 'work-log/creation/scheduling')
      .filter(e => e.state === 'active')
      .find(e => (e.data as { piece_id?: string }).piece_id === piece.id);
    const at = (record?.data as { scheduled_at?: string; date?: string } | undefined);
    if (at?.scheduled_at) return at.scheduled_at;
    if (at?.date) return at.date;
  } catch {
    // scheduling may not exist on this profile yet, which is not an error
  }
  return now;
}

export function rightsVerdict(
  body: ProfileBody, piece: Piece, at: string, gateVersion: number,
): GateVerdict {
  const findings = rightsFindings(body, piece, at);
  const blocked = findings.filter(f => f.state === 'blocked');
  const ungraded = findings.filter(f => f.state === 'ungraded');
  if (blocked.length) {
    return {
      gate_id: 'rights', gate_kind: 'rights', gate_version: gateVersion, source: 'machine',
      verdict: 'fail', reason: blocked.map(b => b.reason).join(' '),
    };
  }
  if (ungraded.length) {
    return {
      gate_id: 'rights', gate_kind: 'rights', gate_version: gateVersion, source: 'machine',
      verdict: 'flagged',
      reason: `${ungraded.length} attached ${ungraded.length === 1 ? 'item has' : 'items have'} no rights recorded. ${ungraded.map(u => u.reason).join(' ')}`,
    };
  }
  if (!findings.length) {
    return {
      gate_id: 'rights', gate_kind: 'rights', gate_version: gateVersion, source: 'machine',
      verdict: 'not-applicable', reason: 'Nothing rights-bearing is attached to this piece.',
    };
  }
  return {
    gate_id: 'rights', gate_kind: 'rights', gate_version: gateVersion, source: 'machine',
    verdict: 'pass', reason: 'Every attached item is cleared for this platform on this date.',
  };
}

/** §7.4: `enforced` can never flip back. Forward only, same shape as gate versions. */
export function flipToEnforced(body: ProfileBody): ProfileBody {
  return { ...body, rights_baseline: 'enforced' };
}

export function ungradedAssetCount(body: ProfileBody): number {
  let n = 0;
  for (const path of Object.keys(body.paths ?? {})) {
    if (!path.startsWith('work-log/assets/sets')) continue;
    for (const e of body.paths[path]) {
      const d = e.data as { rights?: RightsRecord };
      if (e.type === 'asset' && rightsAbsent(d.rights)) n++;
    }
  }
  return n;
}

// ── §6.6 Writing and reading the run ─────────────────────────────────────────

export function writeGateRun(body: ProfileBody, run: GateRun): ProfileBody {
  return putEntry(body, GATE_RUN_PATH, {
    id: run.id, type: 'gate_run', data: run as unknown as Record<string, unknown>,
  }, { writer: run.run_by === 'owner' ? 'owner' : 'engine:content', now: run.run_at });
}

export function readGateRuns(body: ProfileBody, piece_id?: string): GateRun[] {
  let entries: BodyEntry[];
  try {
    entries = readPath(body, GATE_RUN_PATH);
  } catch {
    return [];
  }
  return entries
    .map(e => ({ ...(e.data as unknown as GateRun), id: e.id }))
    .filter(r => !piece_id || r.piece_id === piece_id)
    .sort((a, b) => (a.run_at < b.run_at ? -1 : 1));
}

/** How many automatic revise attempts this piece has already used (§4.10). */
export function failedGateRunCount(body: ProfileBody, piece_id: string): number {
  return readGateRuns(body, piece_id).filter(r => r.overall === 'failed').length;
}

// ── Assembling a run out of the machine half and the model half ──────────────

export interface BuildGateRunInput {
  id: string;
  piece_id: string;
  draft_version_id: string;
  gate_set: GateSet;
  strategy_version: number;
  rule: ResolvedFormatRule;
  checks: MachineCheck[];
  /** Absent when a hard machine check short-circuited the model call. */
  model_verdicts?: { gate_id: string; verdict: 'pass' | 'fail' | 'flagged'; reason: string; evidence_span?: string }[];
  rights?: GateVerdict;
  engine_run_id: string | null;
  run_at: string;
  run_by: string;
  /** Her overrides, by gate id. Refused on rights and on a boundaries failure. */
  overrides?: Record<string, { by: string; at: string; reason: string }>;
  owner_verified?: { by: string; at: string; reason: string; claim: string }[];
}

const WORST: Record<VerdictValue, number> = {
  fail: 0, flagged: 1, 'not-run': 2, pass: 3, 'not-applicable': 4,
};

function worse(a: VerdictValue, b: VerdictValue): VerdictValue {
  return WORST[a] <= WORST[b] ? a : b;
}

/**
 * The AND of the machine checks and the model verdict, per gate. A gate with no
 * machine check is model-only; a gate with no judgment component is machine-only.
 * When the model half is absent (short-circuit, or no key), the gate reports
 * `not-run` rather than passing — nothing fabricates a verdict (§15 test 15).
 */
export function buildGateRun(input: BuildGateRunInput): GateRun {
  const version = input.gate_set.version;
  const brand = input.gate_set.gates.filter(g => g.kind === 'brand');
  const operational = input.gate_set.gates.filter(g => g.kind === 'operational');
  const gates = [...brand, ...(operational.length ? operational : OPERATIONAL_GATES)];
  const shortCircuited = hardFailures(input.checks).length > 0;

  const verdicts: GateVerdict[] = gates.map(gate => {
    const mine = input.checks.filter(c => c.gate_id === gate.id);
    const model = input.model_verdicts?.find(m => m.gate_id === gate.id);
    const machineFailed = mine.filter(c => !c.passed);

    let verdict: VerdictValue;
    let reason: string;
    let evidence: string | undefined;
    let source: GateVerdict['source'];

    if (machineFailed.length) {
      const hard = machineFailed.find(c => c.hard);
      verdict = hard ? 'fail' : 'flagged';
      reason = machineFailed.map(c => c.reason).join(' ');
      evidence = machineFailed[0].evidence_span;
      source = model ? 'machine+model' : 'machine';
      // A model verdict still counts against a gate the machine only flagged.
      if (!hard && model && model.verdict === 'fail') verdict = 'fail';
    } else if (model) {
      verdict = model.verdict;
      reason = model.reason;
      evidence = model.evidence_span;
      source = mine.length ? 'machine+model' : 'model';
    } else {
      verdict = 'not-run';
      source = mine.length ? 'machine' : 'model';
      reason = shortCircuited
        ? 'Not run: a machine check already failed, so the draft is going back regardless.'
        : 'Not run: the reviewer did not answer for this gate.';
    }

    const override = input.overrides?.[gate.id];
    // §6.9: a boundaries violation is NOT overridable at the piece. It is fixed
    // by editing the draft, or by amending boundaries/ in strategy — which is a
    // dated strategy version, and that is the honest route.
    const boundaryFailure = mine.some(c => c.check === 'boundaries' && !c.passed);
    const mayOverride = !!override && verdict !== 'pass' && !boundaryFailure;

    return {
      gate_id: gate.id,
      gate_kind: gate.kind,
      gate_version: version,
      source,
      verdict: mayOverride ? 'pass' : verdict,
      reason: mayOverride ? `${reason} Passed by her, with a reason on the record.` : reason,
      ...(evidence ? { evidence_span: evidence } : {}),
      ...(mayOverride ? { override } : {}),
      ...(gate.id === 'accuracy' && input.owner_verified?.length
        ? { owner_verified: input.owner_verified }
        : {}),
    };
  });

  if (input.rights) verdicts.push(input.rights);

  // The rights verdict never decides build → review (§7.3), so `overall` is read
  // off the seven gates; the rights verdict rides along and blocks scheduling.
  const seven = verdicts.filter(v => v.gate_kind !== 'rights');
  let overall: GateRun['overall'] = 'passed';
  for (const v of seven) {
    if (v.verdict === 'pass' || v.verdict === 'not-applicable') continue;
    overall = 'failed';
  }
  if (overall === 'passed' && seven.some(v => v.override)) overall = 'passed-with-override';

  return {
    id: input.id,
    piece_id: input.piece_id,
    draft_version_id: input.draft_version_id,
    gate_set_version: version,
    strategy_version: input.strategy_version,
    format_rules_version: FORMAT_RULES_VERSION,
    format_rules_resolution: formatRulesResolution(input.rule),
    verdicts,
    overall,
    engine_run_id: input.engine_run_id,
    run_at: input.run_at,
    run_by: input.run_by,
  };
}

/** The seven, all passing (or explicitly not applicable). */
export function allSevenPassed(run: GateRun): boolean {
  const seven = run.verdicts.filter(v => v.gate_kind !== 'rights');
  if (seven.length < 7) return false;
  return seven.every(v => v.verdict === 'pass' || v.verdict === 'not-applicable');
}

/**
 * §6.2, at the write door: a piece may not leave build until all seven pass, at
 * the CURRENT gate set version, on the draft it is actually carrying.
 */
export function passingGateRunFor(
  body: ProfileBody, piece: Piece, gateSetVersion: number,
): GateRun | null {
  const draft = resolveDraft(body, piece.id);
  const runs = readGateRuns(body, piece.id).filter(r =>
    r.gate_set_version === gateSetVersion
    && (!draft || r.draft_version_id === draft.id)
    && allSevenPassed(r));
  return runs.length ? runs[runs.length - 1] : null;
}

// ── §6.2 and §7.3 The two stage boundaries, guarded at the write door ────────

const STAGE_ORDER = ['idea', 'build', 'review', 'approved', 'scheduled', 'posted'];

export interface StageRefusal {
  piece_id: string;
  reason: string;
}

/**
 * The two boundaries this spec guards, and nothing else about what happens after
 * them (§1, "It is not"):
 *
 *  1. **build → review.** No passing gate run at the current gate set version,
 *     no move. Acceptance test 6 removes this guard and proves the write is
 *     then accepted — the same way spec 21 and spec 23 prove theirs.
 *  2. **approved → scheduled or posted.** Any rights verdict at `fail`, no move.
 *     That is what "gates block publication" means (S21), and it is the correct
 *     boundary: a draft may be shown to the client who owns the photo; it may
 *     not go out to the world on an expired release.
 */
export function refusedStageWrites(
  current: ProfileBody | undefined, incoming: ProfileBody | undefined, now: string,
): StageRefusal[] {
  if (!incoming || !current) return [];
  const out: StageRefusal[] = [];
  const before = new Map((current.paths?.[PIECE_PATH] ?? []).map(e => [e.id, resolvePiece(e)]));
  const set = readGateSet(incoming) ?? readGateSet(current);

  for (const entry of incoming.paths?.[PIECE_PATH] ?? []) {
    const was = before.get(entry.id);
    if (!was) continue;                                // born in this save, at build
    const piece = resolvePiece(entry);
    if (piece.stage === was.stage) continue;
    if (STAGE_ORDER.indexOf(piece.stage) <= STAGE_ORDER.indexOf(was.stage)) continue;  // pulled back

    if (was.stage === 'build') {
      if (!set) {
        out.push({
          piece_id: entry.id,
          reason: 'this profile has no locked gate set, so nothing can pass seven gates yet (S14)',
        });
      } else {
        const passing = passingGateRunFor(incoming, piece, set.version);
        if (!passing) {
          const latest = readGateRuns(incoming, entry.id).slice(-1)[0];
          const named = latest
            ? latest.verdicts.filter(v => v.gate_kind !== 'rights' && v.verdict !== 'pass' && v.verdict !== 'not-applicable')
              .map(v => v.gate_id)
            : [];
          out.push({
            piece_id: entry.id,
            reason: named.length
              ? `nothing leaves build until all seven gates pass, and ${named.join(', ')} ${named.length === 1 ? 'has' : 'have'} not (PLAN §5.1)`
              : `nothing leaves build until all seven gates pass at gate set version ${set.version}, and there is no passing run for this draft (PLAN §5.1)`,
          });
        }
      }
    }

    if (piece.stage === 'scheduled' || piece.stage === 'posted') {
      const at = publicationDate(incoming, piece, now);
      const blocked = rightsFindings(incoming, piece, at).filter(f => f.state === 'blocked');
      if (blocked.length) {
        out.push({
          piece_id: entry.id,
          reason: `publication is blocked while a required right is missing (S21). ${blocked.map(b => b.reason).join(' ')}`,
        });
      }
    }
  }
  return out;
}

/**
 * §6.7 and §7.4, both forward only: a gate run is never rewritten, and a profile
 * that has flipped to `enforced` can never flip back. A pass record from
 * version N stays byte-identical forever, whatever version is in force today.
 */
export function refusedGateRunWrites(
  current: ProfileBody | undefined, incoming: ProfileBody | undefined,
): StageRefusal[] {
  if (!incoming || !current) return [];
  const out: StageRefusal[] = [];
  const before = new Map(
    (current.paths?.[GATE_RUN_PATH] ?? []).map(e => [e.id, JSON.stringify(e)]),
  );
  for (const entry of incoming.paths?.[GATE_RUN_PATH] ?? []) {
    const prev = before.get(entry.id);
    if (prev === undefined || prev === JSON.stringify(entry)) continue;
    out.push({
      piece_id: (entry.data as { piece_id?: string }).piece_id ?? entry.id,
      reason: 'a gate run is never rewritten, recomputed or re-rendered (S14) — a new judgment is a new run',
    });
  }
  if (current.rights_baseline === 'enforced' && incoming.rights_baseline !== 'enforced') {
    out.push({
      piece_id: '(profile)',
      reason: 'the rights baseline is forward only: enforced can never flip back to legacy grace (§7.4)',
    });
  }
  return out;
}

// ── Reading the whole context for one gate run ───────────────────────────────

export interface GateSubject {
  piece: Piece;
  draft: DraftVersion;
  costume: ResolvedCostume;
  rule: ResolvedFormatRule;
  gate_set: GateSet;
  seed: Seed | null;
  her_hook?: string;
}

export function machineContextFor(
  body: ProfileBody, subject: GateSubject, opts: { owner_verified?: string[] } = {},
): MachineCheckContext {
  return {
    content: subject.draft.content,
    claims: subject.draft.claims,
    costume: subject.costume,
    rule: subject.rule,
    her_hook: subject.her_hook,
    never_promises: neverPromisesOf(body),
    never_words: neverWordsOf(body),
    proof_ids: proofIdsOf(body),
    promises_forbidden: promisesForbidden(body),
    owner_verified: opts.owner_verified,
    brand_gate_ids: subject.gate_set.gates.filter(g => g.kind === 'brand').map(g => g.id),
  };
}

export { readDrafts, resolveDraft, MAKING_PATH };
export type { DraftPayload, FormatFamily };
export function pieceOf(body: ProfileBody, id: string): Piece | null {
  return findPiece(body, id)?.piece ?? null;
}
