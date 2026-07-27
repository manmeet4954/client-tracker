// PROPOSAL_SCHEMA — spec 23 §5.5.
//
// Structured output, not prose parsing. The schema forces valid JSON with every
// seed-template field present and nullable, so there is no regex, no "parse the
// model's markdown", and no silent field loss.

import type { Seed } from '../tree/objects.ts';

export const SCHEMA_VERSION = 1;
export const PROMPT_VERSION = 1;

export type ProposalKind = 'new-seed' | 'deepen' | 'revisit-seed';
export type ProposalConfidence = 'clear' | 'thin';

/** One proposal, exactly as the model returns it. */
export interface SeedProposal {
  kind: ProposalKind;
  /** A short handle, her language not marketing language. */
  name: string;
  raw_thought: string | null;
  core_message: string | null;
  visible_problem: string | null;
  deeper_problem: string | null;
  common_belief: string | null;
  reframe: string | null;
  audience_value: string | null;
  product_connection: string | null;
  examples: string[] | null;
  nuance: string | null;
  prohibited_interpretation: string | null;
  proof_required: string[] | null;
  possible_pillars: string[] | null;
  possible_angles: string[] | null;
  /** A verbatim substring of the capture this proposal came from. */
  evidence_span: string | null;
  /** One plain line: why this is a seed and not a post idea. */
  why: string;
  /** The id of an existing seed if this is the same idea, else null. */
  duplicate_of: string | null;
  /** For `deepen` and `revisit-seed` proposals. */
  target_seed_id: string | null;
  /** `thin` means the capture did not really carry this and she should talk more. */
  confidence: ProposalConfidence;
}

/** The template fields a proposal may carry onto a seed. `raw_thought` and
 *  `raw_material` are handled separately — they are write-once (§6.2). */
export const PROPOSAL_SEED_FIELDS: (keyof Seed)[] = [
  'core_message', 'visible_problem', 'deeper_problem', 'common_belief', 'reframe',
  'audience_value', 'product_connection', 'examples', 'nuance',
  'prohibited_interpretation', 'proof_required', 'possible_pillars', 'possible_angles',
];

const str = { type: ['string', 'null'] };
const strList = { type: ['array', 'null'], items: { type: 'string' } };

export const PROPOSAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['proposals'],
  properties: {
    proposals: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'kind', 'name', 'raw_thought', 'core_message', 'visible_problem', 'deeper_problem',
          'common_belief', 'reframe', 'audience_value', 'product_connection', 'examples',
          'nuance', 'prohibited_interpretation', 'proof_required', 'possible_pillars',
          'possible_angles', 'evidence_span', 'why', 'duplicate_of', 'target_seed_id',
          'confidence',
        ],
        properties: {
          kind: { type: 'string', enum: ['new-seed', 'deepen'] },
          name: { type: 'string' },
          raw_thought: str,
          core_message: str,
          visible_problem: str,
          deeper_problem: str,
          common_belief: str,
          reframe: str,
          audience_value: str,
          product_connection: str,
          examples: strList,
          nuance: str,
          prohibited_interpretation: str,
          proof_required: strList,
          possible_pillars: strList,
          possible_angles: strList,
          evidence_span: str,
          why: { type: 'string' },
          duplicate_of: str,
          target_seed_id: str,
          confidence: { type: 'string', enum: ['clear', 'thin'] },
        },
      },
    },
  },
} as const;

/** How many template fields a proposal actually filled — check 5's input. */
export function filledFieldCount(p: SeedProposal): number {
  return PROPOSAL_SEED_FIELDS.filter(f => {
    const v = (p as unknown as Record<string, unknown>)[f as string];
    if (Array.isArray(v)) return v.length > 0;
    return typeof v === 'string' ? v.trim().length > 0 : false;
  }).length;
}

/** Shape-check a parsed response without trusting it. Structured outputs make a
 *  malformed response a run error rather than a proposal list (check 1). */
export function parseProposals(raw: unknown): SeedProposal[] {
  const list = (raw as { proposals?: unknown } | null)?.proposals;
  if (!Array.isArray(list)) throw new Error('the response carried no proposals array');
  return list.map((item, i) => {
    const p = item as Partial<SeedProposal>;
    if (typeof p.name !== 'string' || typeof p.why !== 'string') {
      throw new Error(`proposal ${i} is missing its name or its reason`);
    }
    if (p.kind !== 'new-seed' && p.kind !== 'deepen') {
      throw new Error(`proposal ${i} carries an unknown kind`);
    }
    return {
      kind: p.kind,
      name: p.name,
      raw_thought: p.raw_thought ?? null,
      core_message: p.core_message ?? null,
      visible_problem: p.visible_problem ?? null,
      deeper_problem: p.deeper_problem ?? null,
      common_belief: p.common_belief ?? null,
      reframe: p.reframe ?? null,
      audience_value: p.audience_value ?? null,
      product_connection: p.product_connection ?? null,
      examples: p.examples ?? null,
      nuance: p.nuance ?? null,
      prohibited_interpretation: p.prohibited_interpretation ?? null,
      proof_required: p.proof_required ?? null,
      possible_pillars: p.possible_pillars ?? null,
      possible_angles: p.possible_angles ?? null,
      evidence_span: p.evidence_span ?? null,
      why: p.why,
      duplicate_of: p.duplicate_of ?? null,
      target_seed_id: p.target_seed_id ?? null,
      confidence: p.confidence === 'thin' ? 'thin' : 'clear',
    };
  });
}
