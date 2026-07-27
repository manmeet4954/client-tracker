// The run log (S12) — spec 23 §5.7.
//
// EVERY extraction writes exactly one `engine_run` entry: success, refusal or
// error. Append-only, retained forever (PLAN §11 Q5). The run log never stores
// the API key, never stores another profile's data, and is `audience: owner`.
//
// `cost_estimate_usd` is written from run one regardless of her answer on the
// ceiling question (§16) — so whichever shape she picks has real numbers to work
// from. Nothing in this file spends money past her answer, because nothing here
// blocks or throttles anything.

import type { ProfileBody } from '../tree/body.ts';
import { putEntry, readPath } from '../tree/body.ts';
import type { BodyEntry } from '../tree/objects.ts';
import type { CheckId } from './checks.ts';

export const RUN_PATH = 'work-log/logs/engine-runs';

export interface RunUsage {
  input_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
  output_tokens: number;
}

/**
 * Every check id that can land on a run. Spec 23's six, plus spec 24's brief
 * checks. Declared here rather than imported from both check modules, so the run
 * log does not have to know which engine wrote it.
 */
export type RunCheckId =
  | CheckId
  | 'cta-fidelity' | 'proof-resolves' | 'seed-fidelity'
  // Spec 25's machine checks, so the run log does not have to know which engine
  // wrote it — the same reason spec 24's three are listed here.
  | 'hook-verbatim' | 'never-words' | 'boundaries' | 'proof-presence' | 'promise-claims'
  | 'format-rules' | 'convert-carousel' | 'evidence-span';

export interface EngineRun {
  id: string;
  /** Spec 24 adds the second kind, spec 25 the next three, spec 27 the last two.
   *  The shape is deliberately identical: no second run-log format exists (§4.8),
   *  and the Analysis Engine logs its runs the same way the Content Engine does
   *  (spec 27 §11.4). */
  kind: 'seed_extraction' | 'internal_brief' | 'draft' | 'gate_run' | 'taste_distillation'
    | 'analysis_verdict' | 'analysis_digest';
  profile_id: string;
  triggered_by: 'owner';
  packet: {
    packet_id: string;
    context_version: number;
    folders: string[];
    mandatory_constraints: string[];
    trimmed: string[];
  };
  /**
   * Null on a gate run that short-circuited: a hard machine check failed, the
   * draft is going back regardless, and no model call was made (§6.3). The run
   * is still logged, which is what makes acceptance test 16 answerable.
   */
  model: string | null;
  effort: string;
  thinking: string;
  schema_version: number;
  prompt_version: number;
  capture_ids: string[];
  proposal_ids: string[];
  /** The pieces this run was about. Spec 24's briefs; empty for extraction. */
  piece_ids?: string[];
  // ── Spec 25 §4.8: what a draft or a gate run has to be traceable to.
  draft_version_id?: string | null;
  brief_version?: number;
  format_rules_version?: number;
  format_rules_resolution?: string;
  gate_set_version?: number;
  strategy_version?: number;
  /** 1, 2 or 3. The revise ceiling is two automatic attempts (§4.10). */
  attempt?: 1 | 2 | 3;
  usage: RunUsage;
  cost_estimate_usd: number;
  latency_ms: number;
  stop_reason: string;
  refusal_category?: string;
  checks: { rejected: number; badged: { proposal_id: string; check: RunCheckId }[] };
  started_at: string;
  finished_at: string;
  error?: string;
}

// Claude Opus 5, per million tokens (§5.3). Cache reads are about a tenth of
// input. These are the published rates at build time; if they move, this
// constant is the one place to change.
const INPUT_PER_M = 5;
const OUTPUT_PER_M = 25;
const CACHE_READ_PER_M = 0.5;
const CACHE_WRITE_PER_M = 6.25;

export function estimateCostUsd(usage: RunUsage): number {
  const dollars =
    (usage.input_tokens * INPUT_PER_M +
      usage.output_tokens * OUTPUT_PER_M +
      usage.cache_read_input_tokens * CACHE_READ_PER_M +
      usage.cache_creation_input_tokens * CACHE_WRITE_PER_M) / 1_000_000;
  return Math.round(dollars * 10_000) / 10_000;
}

export const EMPTY_USAGE: RunUsage = {
  input_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, output_tokens: 0,
};

export function writeRun(
  body: ProfileBody, run: EngineRun,
  writer: 'engine:content' | 'engine:analysis' = 'engine:content',
): ProfileBody {
  return putEntry(body, RUN_PATH, {
    id: run.id, type: 'engine_run', data: run as unknown as Record<string, unknown>,
  }, { writer, now: run.finished_at });
}

export function readRuns(body: ProfileBody): EngineRun[] {
  return readPath(body, RUN_PATH)
    .map((e: BodyEntry) => ({ ...(e.data as unknown as EngineRun), id: e.id }))
    .sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
}

/** What every run of this profile has cost so far. Visible after the fact, which
 *  is what makes the ceiling question answerable with real numbers (§16). */
export function spendSoFar(body: ProfileBody): { runs: number; usd: number } {
  const runs = readRuns(body);
  const usd = runs.reduce((n, r) => n + (r.cost_estimate_usd ?? 0), 0);
  return { runs: runs.length, usd: Math.round(usd * 100) / 100 };
}

/**
 * Acceptance test 9's shape check: a run with no packet record is not a run.
 * Kept as a function so the test asks the same question the write door does.
 */
export function runIsComplete(run: EngineRun): string[] {
  const missing: string[] = [];
  // The FIELD must be present. `null` is a real, honest value on a
  // short-circuited gate run (spec 25 §6.3); absent is not.
  if (run.model === undefined) missing.push('model');
  if (!run.effort) missing.push('effort');
  if (!run.packet) missing.push('packet');
  else {
    if (!Array.isArray(run.packet.folders)) missing.push('packet.folders');
    if (typeof run.packet.context_version !== 'number') missing.push('packet.context_version');
  }
  if (!run.usage) missing.push('usage');
  else {
    for (const k of ['input_tokens', 'output_tokens', 'cache_read_input_tokens'] as const) {
      if (typeof run.usage[k] !== 'number') missing.push(`usage.${k}`);
    }
  }
  if (!run.stop_reason) missing.push('stop_reason');
  if (typeof run.cost_estimate_usd !== 'number') missing.push('cost_estimate_usd');
  return missing;
}
