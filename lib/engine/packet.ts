// The context packet (S12) — spec 23 §5.4.
//
// PLAN §5.3, "Grounding": nothing is trained, nothing is remembered between
// calls. The packet is assembled fresh from the body on every run, versioned,
// and logged, so the model reads structured truth each time.
//
// This file is a pure function of the body plus the switch config. It makes no
// network call and has no side effects, which is what makes it testable without
// a model (§14.3 step 4).

import type { SwitchConfig } from '../tree/contract.ts';
import type { ProfileBody } from '../tree/body.ts';
import { readPath, readUnder } from '../tree/body.ts';
import { findDeclaration } from '../tree/declarations.ts';
import { pathState } from '../tree/switches.ts';
import { resolveSeed } from './seeds.ts';
import type { ContextPacket, ResolvedCostume, Seed } from '../tree/objects.ts';
import { describeMergedRule, type ResolvedFormatRule } from './formats.ts';
import { tasteBlockLines } from './taste.ts';

/**
 * ONE assembler, TWO content profiles (spec 24 §6.4).
 *
 * Extraction and the brief are given different folders for a real reason —
 * spec 23 deliberately withheld format RULES from extraction, because they
 * belong to drafting rather than to understanding an idea — but they share the
 * cascade rule, the never-trimmed Block A, the size guard, the trim record and
 * the packet identity. A second assembler would be a second place for those to
 * drift, so there is not one.
 */
export type ContentProfile = 'extraction' | 'brief' | 'draft' | 'gate';

/** The four fixed operational rules. Always sent, never trimmed (§5.4). */
export const MANDATORY_RULES: string[] = [
  'The founder\'s raw thought is quoted verbatim. Never paraphrase it, never tidy it, never translate it into marketing language.',
  'Any field the capture does not support comes back null. Never invent one.',
  'A proposal must be able to produce more than one post. If it can only produce one, it is a post idea, not a seed — say so.',
  'Claim nothing the proof library cannot back. Where proof is needed and missing, name the proof required instead of claiming it.',
];

/** Block A — mandatory constraints. Always first, always whole (§5.4). */
export const BLOCK_A_PATHS = [
  'context/content-strategy/boundaries',
  'context/content-strategy/voice',
  'context/content-strategy/positioning',
];

/**
 * Block B, in the order the size guard trims from the BOTTOM upward. The order
 * is the spec's table read downward: the last row is dropped first.
 */
export const BLOCK_B_PATHS = [
  'context/personal-details/identity',
  'context/personal-details/journey',
  'context/personal-details/voice-of-the-person',
  'context/personal-details/ambitions',
  'context/personal-details/history',
  'context/business-details/offers',
  'context/business-details/buying-route',
  'context/business-details/market',
  'context/business-details/pains',
  'context/business-details/audience-raw',
  'context/content-strategy/audience-decided',
  'work-log/creation/topics',                 // the seed INDEX, never the full seeds
  'context/content-strategy/pillars',
  'context/content-strategy/platforms',
  'context/content-strategy/proof-library',   // titles and kinds only
  'context/content-strategy/ctas',            // labels only
  'context/content-strategy/goals',           // labels only
];

export interface PacketBlock {
  path: string;
  label: string;
  /** What actually goes to the model, already narrowed to what the spec allows. */
  lines: string[];
}

export interface AssembledPacket {
  packet: ContextPacket;
  block_a: PacketBlock[];
  block_b: PacketBlock[];
  /** Paths dropped by the size guard, in drop order. Shown to her, never silent. */
  trimmed: string[];
  /** The whole packet as the two cached system blocks would carry it. */
  text: string;
  /** Rough token estimate, on the usual ~4-characters-a-token rule. */
  estimated_tokens: number;
  /** Which universal-engine method block belongs in front of this packet. */
  universal_block: string;
  content_profile: ContentProfile;
}

/** What the brief profile needs beyond the body: the request itself. */
export interface BriefPacketSubject {
  seed: Seed;
  costume: ResolvedCostume;
  rule: ResolvedFormatRule;
  /** Human labels for the resolved CTA, voice, pillar and proof items. */
  labels?: Partial<Record<'cta' | 'voice' | 'pillar', string>>;
}

/** What the DRAFT and GATE profiles need beyond the brief's subject (spec 25). */
export interface DraftPacketSubject extends BriefPacketSubject {
  /** The eight fields, read through spec 24's `resolveBrief` (spec 25 §2.3). */
  brief: {
    brief_version: number;
    one_point: string;
    tension: string;
    realization: string;
    takeaway: string;
    product_role: string | null;
    tone: string;
    ending: string;
    leave_out: string[];
    hook?: string;
  };
  /** The locked gate set, in her own question wording. */
  gates?: { id: string; name: string; question: string; kind: string }[];
  /** Title and hook only, capped at 20, so a hook is not used twice (§4.4). */
  posted?: { title: string; hook: string }[];
  /** §9.3: rule and strength ONLY. Nothing else about a taste rule travels. */
  taste_rules?: { rule: string; strength: 'law' | 'lean' }[];
  /** The gate profile only: the draft under review, and the machine results. */
  draft_text?: string[];
  machine_results?: string[];
}

export interface PacketInput {
  profile_id: string;
  body: ProfileBody;
  config: SwitchConfig;
  now: string;
  packet_id: string;
  /** Claude Opus 5's window. Block A + B may not exceed 60% of it (§5.4). */
  context_window?: number;
  /** Defaults to extraction, so spec 23's calls are unchanged. */
  content_profile?: ContentProfile;
  /** Required by the brief, draft and gate profiles; ignored by extraction. */
  subject?: BriefPacketSubject | DraftPacketSubject;
}

const CONTEXT_WINDOW = 1_000_000;
const SIZE_GUARD_FRACTION = 0.6;
const CHARS_PER_TOKEN = 4;

function label(path: string): string {
  return path.replace(/^context\//, '').replace(/^work-log\//, '').replace(/[/-]/g, ' ');
}

function textOf(data: Record<string, unknown>): string {
  const preferred = ['value', 'text', 'label', 'name', 'title', 'decision'];
  for (const key of preferred) {
    const v = data[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (Array.isArray(v) && v.length) return v.map(String).join(', ');
  }
  const reason = typeof data.reason === 'string' ? data.reason : '';
  const rest = Object.entries(data)
    .filter(([k, v]) => k !== 'reason' && (typeof v === 'string' || typeof v === 'number'))
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ');
  return [rest, reason && `(${reason})`].filter(Boolean).join(' ');
}

/**
 * ONLY `active` paths enter the packet. A path at `history` or `hidden` is
 * excluded — a retired platform never shapes a proposal (S9 + the cascade,
 * acceptance test 7).
 */
export function pathIsActive(path: string, config: SwitchConfig): boolean {
  if (!findDeclaration(path)) return false;
  try {
    return pathState(path, config) === 'active';
  } catch {
    return false;
  }
}

/** The seed bank as an INDEX — id, name, core message, status. This is what
 *  lets the engine say "this is seed 3 again" instead of proposing a duplicate. */
export function seedIndex(body: ProfileBody): string[] {
  return readPath(body, 'work-log/creation/topics').map(e => {
    const s: Seed = resolveSeed(e);
    return `${s.id} · ${s.name} · ${s.core_message ?? 'no core message yet'} · ${s.status}`;
  });
}

function pillarLines(body: ProfileBody, config: SwitchConfig): string[] {
  const out: string[] = [];
  for (const entry of readUnder(body, 'context/content-strategy/pillars')) {
    if (entry.state !== 'active') continue;
    if (!pathIsActive(entry.path, config)) continue;
    const d = entry.data as Record<string, unknown>;
    if (entry.type === 'pillar') out.push(`Pillar "${d.name ?? entry.id}" (${entry.id})`);
    else out.push(`  ${label(entry.path).split(' ').pop()}: ${textOf(d)}`);
  }
  return out;
}

/**
 * Platform NAMES and their format NAMES only. Format RULES belong to drafting
 * (Content Engine II), not to understanding an idea (§5.4).
 */
function platformLines(body: ProfileBody, config: SwitchConfig): string[] {
  const out: string[] = [];
  for (const entry of readUnder(body, 'context/content-strategy/platforms')) {
    if (entry.state !== 'active') continue;
    if (!pathIsActive(entry.path, config)) continue;
    const d = entry.data as Record<string, unknown>;
    if (entry.type === 'platform') out.push(`Platform: ${d.name ?? entry.id}`);
    else if (entry.type === 'format') out.push(`  format: ${d.name ?? d.format ?? entry.id}`);
  }
  return out;
}

/** Titles and kinds only, never the assets themselves. Rights (S21) are a
 *  publication gate, not an extraction input (§5.4). */
function proofLines(body: ProfileBody, config: SwitchConfig): string[] {
  if (!pathIsActive('context/content-strategy/proof-library', config)) return [];
  return readPath(body, 'context/content-strategy/proof-library')
    .filter(e => e.state === 'active')
    .map(e => {
      const d = e.data as Record<string, unknown>;
      return `${d.title ?? d.name ?? e.id}${d.kind ? ` (${d.kind})` : ''}`;
    });
}

function labelsOnly(body: ProfileBody, path: string, config: SwitchConfig): string[] {
  if (!pathIsActive(path, config)) return [];
  return readPath(body, path)
    .filter(e => e.state === 'active')
    .map(e => {
      const d = e.data as Record<string, unknown>;
      return String(d.label ?? d.name ?? d.value ?? e.id);
    });
}

function fullFolder(body: ProfileBody, path: string, config: SwitchConfig): string[] {
  if (!pathIsActive(path, config)) return [];
  return readPath(body, path)
    .filter(e => e.state === 'active')
    .map(e => textOf(e.data as Record<string, unknown>))
    .filter(Boolean);
}

function neverWords(body: ProfileBody, config: SwitchConfig): string[] {
  if (!pathIsActive('context/content-strategy/voice', config)) return [];
  const out: string[] = [];
  for (const e of readPath(body, 'context/content-strategy/voice')) {
    if (e.state !== 'active') continue;
    const d = e.data as Record<string, unknown>;
    const never = d.never_words ?? d.never ?? d.words_they_hate;
    if (Array.isArray(never) && never.length) out.push(`never says: ${never.map(String).join(', ')}`);
    else if (typeof never === 'string' && never.trim()) out.push(`never says: ${never.trim()}`);
  }
  return out;
}

function blockText(title: string, blocks: PacketBlock[]): string {
  const body = blocks
    .filter(b => b.lines.length > 0)
    .map(b => `## ${b.label}\n${b.lines.join('\n')}`)
    .join('\n\n');
  return `# ${title}\n${body}`;
}

// ── The brief profile (spec 24 §6.4) ────────────────────────────────────────

/** The four fixed operational rules for the BRIEF. Different from extraction's,
 *  and mandatory for the same reason: they are what the answer has to obey. */
export const BRIEF_RULES: string[] = [
  'This is a BRIEF, not copy. No headlines, no slide text, no script, no captions. If you find yourself writing the post, stop.',
  'Any field the material does not support comes back null. Never invent one.',
  'Claim nothing the named proof can back up. If the proof is not there, do not make the claim.',
  'The ending IS the resolved CTA you were given. Never a new one, never a softer one.',
];

/** The seven gate questions. The brief is written TOWARD them; none is run here. */
function gateLines(body: ProfileBody, config: SwitchConfig): string[] {
  if (!pathIsActive('context/content-strategy/gates', config)) return [];
  const entries = readPath(body, 'context/content-strategy/gates').filter(e => e.state === 'active');
  const latest = entries[entries.length - 1];
  if (!latest) return [];
  const set = latest.data as { gates?: { name?: string; question?: string }[]; version?: number };
  return (set.gates ?? []).map(g => `${g.name}: ${g.question}`);
}

function seedInFull(seed: Seed): string[] {
  const out: string[] = [`Seed "${seed.name}" (${seed.id}), status ${seed.status}`];
  out.push(`What she actually said, verbatim: ${seed.raw_thought}`);
  const fields: (keyof Seed)[] = [
    'core_message', 'visible_problem', 'deeper_problem', 'common_belief', 'reframe',
    'audience_value', 'product_connection', 'examples', 'nuance',
    'prohibited_interpretation', 'proof_required', 'possible_pillars', 'possible_angles',
  ];
  for (const f of fields) {
    const v = seed[f];
    if (Array.isArray(v) ? v.length : typeof v === 'string' ? v.trim() : false) {
      out.push(`${String(f).replace(/_/g, ' ')}: ${Array.isArray(v) ? v.join(', ') : String(v)}`);
    }
  }
  for (const m of seed.raw_material ?? []) out.push(`raw material (${m.source}): ${m.text}`);
  return out;
}

function costumeInWords(subject: BriefPacketSubject): string[] {
  const c = subject.costume;
  const l = subject.labels ?? {};
  return [
    `Pillar: ${l.pillar ?? c.pillar_id}`,
    `Objective: ${c.objective}`,
    `Audience stage: ${c.audience_stage}`,
    `Angle: ${c.angle}`,
    `Hook type: ${c.hook_type}`,
    `Platform: ${c.platform}`,
    `Format: ${c.format}`,
    `Length: ${c.length}`,
    `Product intensity: ${c.product_intensity}`,
    `CTA (this is the ending): ${l.cta ?? c.cta}`,
    `Voice: ${l.voice ?? c.voice}`,
    `Proof selected: ${(c.proof ?? []).join(', ') || 'none'}`,
  ];
}

function proofDetail(body: ProfileBody, ids: string[], config: SwitchConfig): string[] {
  if (!ids.length || !pathIsActive('context/content-strategy/proof-library', config)) return [];
  const entries = readPath(body, 'context/content-strategy/proof-library');
  return ids.map(id => {
    const hit = entries.find(e => e.id === id);
    if (!hit) return `${id}: NOT IN THE LIBRARY — do not lean on it`;
    const d = hit.data as Record<string, unknown>;
    // Titles and what each one evidences. Never the binaries.
    return `${id} · ${d.title ?? d.name ?? id}${d.kind ? ` (${d.kind})` : ''}: ${d.evidences ?? 'what this evidences is not written down yet'}`;
  });
}

function platformHowItWorks(body: ProfileBody, platform: string, config: SwitchConfig): string[] {
  const path = `context/content-strategy/platforms/${platform.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/how-it-works`;
  return fullFolder(body, path, config);
}

function pillarDetail(body: ProfileBody, pillarId: string, config: SwitchConfig): string[] {
  const out: string[] = [];
  for (const entry of readUnder(body, 'context/content-strategy/pillars')) {
    if (entry.state !== 'active' || !pathIsActive(entry.path, config)) continue;
    const isThePillar = entry.type === 'pillar' && entry.id === pillarId;
    const belongsToIt = entry.type !== 'pillar'
      && readUnder(body, 'context/content-strategy/pillars')
        .some(p => p.type === 'pillar' && p.id === pillarId && entry.path.startsWith(p.path + '/'));
    if (!isThePillar && !belongsToIt) continue;
    const d = entry.data as Record<string, unknown>;
    out.push(isThePillar
      ? `Pillar "${d.name ?? entry.id}"`
      : `  ${label(entry.path).split(' ').pop()}: ${textOf(d)}`);
  }
  return out;
}

function ctaWords(body: ProfileBody, ctaId: string, config: SwitchConfig): string[] {
  if (!pathIsActive('context/content-strategy/ctas', config)) return [];
  const hit = readPath(body, 'context/content-strategy/ctas').find(e => e.id === ctaId);
  if (!hit) return [`${ctaId}: this CTA is not in the folder`];
  return [textOf(hit.data as Record<string, unknown>)];
}

/**
 * Assemble the packet. Block A is never trimmed; Block B is trimmed from the
 * bottom of the table upward and every drop is recorded and shown to her.
 * There is no silent truncation. Ever.
 */
export function assemblePacket(input: PacketInput): AssembledPacket {
  switch (input.content_profile ?? 'extraction') {
    case 'brief': return assemble(input, briefBlocks(input));
    case 'draft': return assemble(input, draftBlocks(input));
    case 'gate': return assemble(input, gateBlocks(input));
    default: return assemble(input, extractionBlocks(input));
  }
}

// ── The draft profile (spec 25 §4.4) ────────────────────────────────────────

/** The five fixed operational rules. Always sent, never trimmed (§4.4). */
export const DRAFT_RULES: string[] = [
  'Her hook, when you are given one, is used VERBATIM. Copy it exactly. Never improve it, never tighten it, never fix its grammar.',
  'Every factual claim is enumerated in claims[], with the proof it needs. A claim you did not enumerate is a claim you hid.',
  'Claim nothing the proof library cannot back. Where proof is needed and missing, name the proof required instead of asserting it.',
  'A carousel is SLIDES. It is not an essay cut into pieces. One point per slide, short lines, and the depth goes in the caption.',
  'A reel script is spoken language a person can say out loud. No bullets, no headings, no slide markers, no "firstly".',
];

function draftSubject(input: PacketInput): DraftPacketSubject {
  const subject = input.subject as DraftPacketSubject | undefined;
  if (!subject?.brief) {
    throw new Error('[engine] the draft packet needs its brief, seed, costume and format rule');
  }
  return subject;
}

function briefInWords(subject: DraftPacketSubject): string[] {
  const b = subject.brief;
  return [
    `The one point: ${b.one_point}`,
    `The tension: ${b.tension}`,
    `The realization: ${b.realization}`,
    `The takeaway: ${b.takeaway}`,
    `The product's role: ${b.product_role ?? 'none'}`,
    `Tone: ${b.tone}`,
    `How it ends: ${b.ending}`,
    ...(b.hook ? [`HER HOOK, verbatim, use exactly this: ${b.hook}`] : []),
  ];
}

/**
 * Proof titles, kinds and RIGHTS STATUS for every item, so the drafter does not
 * build a piece around proof that cannot be published (§4.4, §7).
 */
function proofWithRights(body: ProfileBody, config: SwitchConfig, platform: string): string[] {
  if (!pathIsActive('context/content-strategy/proof-library', config)) return [];
  return readPath(body, 'context/content-strategy/proof-library')
    .filter(e => e.state === 'active')
    .map(e => {
      const d = e.data as Record<string, unknown>;
      const rights = (d.rights ?? {}) as { permitted_platforms?: string[]; consent?: string };
      const permitted = rights.permitted_platforms ?? [];
      const usable = !permitted.length || permitted.includes(platform);
      const status = rights.consent === 'given'
        ? (usable ? 'cleared here' : `permitted on ${permitted.join(', ')} only`)
        : 'rights not recorded';
      return `${e.id} · ${d.title ?? d.name ?? e.id}${d.kind ? ` (${d.kind})` : ''}: ${d.evidences ?? d.summary ?? 'what this evidences is not written down yet'} — ${status}`;
    });
}

function draftBlocks(input: PacketInput): { block_a: PacketBlock[]; block_b: PacketBlock[]; universal: string } {
  const { body, config } = input;
  const subject = draftSubject(input);
  const seed = subject.seed;

  const block_a: PacketBlock[] = [
    {
      path: 'context/content-strategy/boundaries',
      label: 'What this brand never claims',
      lines: fullFolder(body, 'context/content-strategy/boundaries', config),
    },
    {
      path: 'context/content-strategy/voice',
      label: 'The voice, in full',
      lines: [
        ...fullFolder(body, 'context/content-strategy/voice', config),
        ...neverWords(body, config),
      ],
    },
    {
      path: 'context/content-strategy/positioning',
      label: 'What this brand actually is',
      lines: fullFolder(body, 'context/content-strategy/positioning', config),
    },
    {
      path: 'context/content-strategy/gates',
      label: 'The seven gates this piece will be judged by. Write toward them. Do NOT claim to have passed them',
      lines: (subject.gates ?? []).map(g => `${g.name}: ${g.question}`),
    },
    {
      path: 'work-log/creation/topics',
      label: 'The two lines that stop a good idea being flattened',
      lines: [
        seed.prohibited_interpretation ? `This must never be read as: ${seed.prohibited_interpretation}` : '',
        seed.nuance ? `The nuance that must survive: ${seed.nuance}` : '',
      ].filter(Boolean),
    },
    {
      path: 'work-log/creation/making/briefs',
      label: 'What must NOT be in this piece',
      lines: subject.brief.leave_out.map(x => `Leave out: ${x}`),
    },
    { path: 'engine/rules', label: 'How you work', lines: DRAFT_RULES },
  ];

  const block_b: PacketBlock[] = [
    { path: 'work-log/creation/making/briefs', label: 'The brief. Write THIS piece', lines: briefInWords(subject) },
    { path: 'work-log/creation/topics', label: 'The seed, in full', lines: seedInFull(seed) },
    { path: 'engine/costume', label: 'The costume she resolved', lines: costumeInWords(subject) },
    { path: 'engine/format-rule', label: 'The format rule, merged. Override beats universal', lines: describeMergedRule(subject.rule) },
    {
      path: `context/content-strategy/platforms/${subject.costume.platform}/how-it-works`,
      label: 'How this platform works',
      lines: platformHowItWorks(body, subject.costume.platform, config),
    },
    {
      path: 'context/content-strategy/pillars',
      label: 'The pillar this serves',
      lines: pillarDetail(body, subject.costume.pillar_id, config),
    },
    {
      path: 'context/content-strategy/ctas',
      label: 'The CTA, in its actual words. The ending is this and nothing else',
      lines: ctaWords(body, subject.costume.cta ?? '', config),
    },
    {
      path: 'context/content-strategy/proof-library',
      label: 'The proof available, what each evidences, and whether it can be published here',
      lines: proofWithRights(body, config, subject.costume.platform),
    },
    {
      path: 'context/content-strategy/audience-decided',
      label: 'The audience, decided, and the stage lens',
      lines: fullFolder(body, 'context/content-strategy/audience-decided', config),
    },
    {
      path: 'context/content-strategy/visual-branding',
      label: 'The look, as notes. Never a binary, never a file',
      lines: fullFolder(body, 'context/content-strategy/visual-branding', config),
    },
    {
      path: 'context/personal-details/voice-of-the-person',
      label: 'How she actually talks',
      lines: fullFolder(body, 'context/personal-details/voice-of-the-person', config),
    },
    {
      path: 'work-log/creation',
      label: 'Hooks this account already used on this seed. Do not repeat one',
      lines: (subject.posted ?? []).slice(0, 20).map(p => `${p.title}: ${p.hook}`),
    },
    // Last, and trimmed first. Her standing habits, and the profile wins where
    // they disagree (§9.3 rule 6).
    {
      path: 'owner/taste-rules',
      label: 'Her standing habits',
      lines: tasteBlockLines(subject.taste_rules ?? []),
    },
  ];

  return { block_a, block_b, universal: UNIVERSAL_DRAFT_BLOCK };
}

// ── The gate profile (spec 25 §6.8) ─────────────────────────────────────────
//
// A SEPARATE call, with a separate packet. It does not carry the drafting call's
// reasoning, the drafting system prompt, or any encouragement to pass.

function gateBlocks(input: PacketInput): { block_a: PacketBlock[]; block_b: PacketBlock[]; universal: string } {
  const { body, config } = input;
  const subject = draftSubject(input);

  const block_a: PacketBlock[] = [
    {
      path: 'context/content-strategy/gates',
      label: 'The gates, in her words. Answer each one',
      lines: (subject.gates ?? []).map(g => `${g.id} — ${g.name}: ${g.question}`),
    },
    {
      path: 'context/content-strategy/boundaries',
      label: 'What this brand never claims',
      lines: fullFolder(body, 'context/content-strategy/boundaries', config),
    },
    {
      path: 'context/content-strategy/voice',
      label: 'Language this brand does not use',
      lines: neverWords(body, config),
    },
    {
      path: 'engine/format-rule',
      label: 'The format rule this piece is judged against',
      lines: describeMergedRule(subject.rule),
    },
    {
      path: 'work-log/creation/topics',
      label: 'The two lines that stop a good idea being flattened',
      lines: [
        subject.seed.prohibited_interpretation
          ? `This must never be read as: ${subject.seed.prohibited_interpretation}` : '',
        subject.seed.nuance ? `The nuance that must survive: ${subject.seed.nuance}` : '',
      ].filter(Boolean),
    },
    { path: 'engine/rules', label: 'How you work', lines: REVIEWER_RULES },
  ];

  const block_b: PacketBlock[] = [
    { path: 'work-log/creation/making', label: 'The draft', lines: subject.draft_text ?? [] },
    { path: 'engine/costume', label: 'The costume it was written for', lines: costumeInWords(subject) },
    {
      path: 'work-log/creation/making/briefs',
      label: 'What the brief said to leave out',
      lines: subject.brief.leave_out.map(x => `Leave out: ${x}`),
    },
    { path: 'engine/machine-checks', label: 'What the machine checks already found', lines: subject.machine_results ?? [] },
    {
      path: 'context/content-strategy/proof-library',
      label: 'The proof library, and whether each item can be published here',
      lines: proofWithRights(body, config, subject.costume.platform),
    },
  ];

  return { block_a, block_b, universal: UNIVERSAL_REVIEWER_BLOCK };
}

export const REVIEWER_RULES: string[] = [
  'You are checking, not writing. Never rewrite the piece, never suggest copy.',
  'Every verdict carries an evidence_span: a VERBATIM substring of the draft. A pass with no span is not a review, and it will be rejected.',
  'Answer each gate on its own question, in her wording. Do not average them.',
  'A reason is one plain line. Never a score, never a rubric, never a red form.',
];

function briefBlocks(input: PacketInput): { block_a: PacketBlock[]; block_b: PacketBlock[]; universal: string } {
  const { body, config } = input;
  const subject = input.subject;
  if (!subject) throw new Error('[engine] the brief packet needs its seed, costume and format rule');
  const seed = subject.seed;

  const block_a: PacketBlock[] = [
    {
      path: 'context/content-strategy/boundaries',
      label: 'What this brand never claims',
      lines: fullFolder(body, 'context/content-strategy/boundaries', config),
    },
    {
      path: 'context/content-strategy/voice',
      label: 'The voice, in full',
      lines: [
        ...fullFolder(body, 'context/content-strategy/voice', config),
        ...neverWords(body, config),
      ],
    },
    {
      path: 'context/content-strategy/positioning',
      label: 'What this brand actually is',
      lines: fullFolder(body, 'context/content-strategy/positioning', config),
    },
    {
      path: 'context/content-strategy/gates',
      label: 'The gates this piece will be judged by. Write toward them. Do not run them',
      lines: gateLines(body, config),
    },
    {
      path: 'work-log/creation/topics',
      label: 'The two lines that stop a good idea being flattened',
      lines: [
        seed.prohibited_interpretation ? `This must never be read as: ${seed.prohibited_interpretation}` : '',
        seed.nuance ? `The nuance that must survive: ${seed.nuance}` : '',
      ].filter(Boolean),
    },
    { path: 'engine/rules', label: 'How you work', lines: BRIEF_RULES },
  ];

  // Block B, in the order the size guard trims from the BOTTOM upward. The seed,
  // the costume and the merged rule sit at the top because a brief without them
  // is not a brief.
  const block_b: PacketBlock[] = [
    { path: 'work-log/creation/topics', label: 'The seed, in full', lines: seedInFull(seed) },
    { path: 'engine/costume', label: 'The costume she resolved', lines: costumeInWords(subject) },
    { path: 'engine/format-rule', label: 'The format rule, merged', lines: describeMergedRule(subject.rule) },
    {
      path: `context/content-strategy/platforms/${subject.costume.platform}/how-it-works`,
      label: 'How this platform works',
      lines: platformHowItWorks(body, subject.costume.platform, config),
    },
    {
      path: 'context/content-strategy/pillars',
      label: 'The pillar this serves',
      lines: pillarDetail(body, subject.costume.pillar_id, config),
    },
    {
      path: 'context/content-strategy/ctas',
      label: 'The CTA, in its actual words. The ending is this and nothing else',
      lines: ctaWords(body, subject.costume.cta ?? '', config),
    },
    {
      path: 'context/content-strategy/proof-library',
      label: 'The proof selected, and what each piece of it evidences',
      lines: proofDetail(body, subject.costume.proof ?? [], config),
    },
    {
      path: 'context/content-strategy/audience-decided',
      label: 'The audience, decided, and the stage lens',
      lines: fullFolder(body, 'context/content-strategy/audience-decided', config),
    },
    {
      path: 'context/personal-details/voice-of-the-person',
      label: 'How she actually talks',
      lines: fullFolder(body, 'context/personal-details/voice-of-the-person', config),
    },
    {
      path: 'context/business-details/offers',
      label: 'What is sold',
      lines: fullFolder(body, 'context/business-details/offers', config),
    },
    {
      path: 'context/business-details/buying-route',
      label: 'How people buy',
      lines: fullFolder(body, 'context/business-details/buying-route', config),
    },
    {
      path: 'context/business-details/pains',
      label: 'What hurts',
      lines: fullFolder(body, 'context/business-details/pains', config),
    },
    {
      path: 'context/personal-details/journey',
      label: 'The story underneath',
      lines: fullFolder(body, 'context/personal-details/journey', config),
    },
  ];

  return { block_a, block_b, universal: UNIVERSAL_BRIEF_BLOCK };
}

function extractionBlocks(input: PacketInput): { block_a: PacketBlock[]; block_b: PacketBlock[]; universal: string } {
  const { body, config } = input;

  const block_a: PacketBlock[] = [
    {
      path: 'context/content-strategy/boundaries',
      label: 'What this brand never claims',
      lines: fullFolder(body, 'context/content-strategy/boundaries', config),
    },
    {
      path: 'context/content-strategy/voice',
      label: 'Language this brand does not use',
      lines: neverWords(body, config),
    },
    {
      path: 'context/content-strategy/positioning',
      label: 'What this brand actually is',
      lines: fullFolder(body, 'context/content-strategy/positioning', config),
    },
    { path: 'engine/rules', label: 'How you work', lines: MANDATORY_RULES },
  ];

  const b = (path: string, lab: string, lines: string[]): PacketBlock => ({ path, label: lab, lines });
  const full = (path: string, lab: string) => b(path, lab, fullFolder(body, path, config));

  const block_b: PacketBlock[] = [
    full('context/personal-details/identity', 'Who she is'),
    full('context/personal-details/journey', 'How she got here'),
    full('context/personal-details/voice-of-the-person', 'How she actually talks'),
    full('context/personal-details/ambitions', 'What she is going for'),
    full('context/personal-details/history', 'What has happened so far'),
    full('context/business-details/offers', 'What is sold'),
    full('context/business-details/buying-route', 'How people buy'),
    full('context/business-details/market', 'The market'),
    full('context/business-details/pains', 'What hurts'),
    full('context/business-details/audience-raw', 'Who they said they are for'),
    full('context/content-strategy/audience-decided', 'The audience, decided'),
    b('work-log/creation/topics', 'Seeds already in the bank',
      pathIsActive('work-log/creation/topics', config) ? seedIndex(body) : []),
    b('context/content-strategy/pillars', 'Pillars', pillarLines(body, config)),
    b('context/content-strategy/platforms', 'Platforms and their formats', platformLines(body, config)),
    b('context/content-strategy/proof-library', 'Proof available', proofLines(body, config)),
    b('context/content-strategy/ctas', 'CTAs', labelsOnly(body, 'context/content-strategy/ctas', config)),
    b('context/content-strategy/goals', 'Goals', labelsOnly(body, 'context/content-strategy/goals', config)),
  ];

  return { block_a, block_b, universal: UNIVERSAL_ENGINE_BLOCK };
}

/**
 * The shared half: the size guard, the trim record, the packet identity and the
 * text. Both content profiles run through it, which is what stops them drifting.
 */
function assemble(
  input: PacketInput,
  blocks: { block_a: PacketBlock[]; block_b: PacketBlock[]; universal: string },
): AssembledPacket {
  const { body } = input;
  const window = input.context_window ?? CONTEXT_WINDOW;
  const { block_a, block_b } = blocks;

  // The size guard: Block A plus Block B may not exceed 60% of the window.
  const ceiling = Math.floor(window * SIZE_GUARD_FRACTION);
  const trimmed: string[] = [];
  let kept = block_b.filter(x => x.lines.length > 0);
  const sizeOf = () =>
    Math.ceil((blockText('Constraints', block_a).length + blockText('Context', kept).length) / CHARS_PER_TOKEN);

  while (sizeOf() > ceiling && kept.length > 0) {
    const dropped = kept[kept.length - 1];
    kept = kept.slice(0, -1);
    trimmed.push(dropped.path);
  }

  const text = `${blockText('Constraints — these hold no matter what', block_a)}\n\n${blockText('This profile', kept)}`;

  const packet: ContextPacket = {
    id: input.packet_id,
    profile_id: input.profile_id,
    context_version: body.context_version ?? 0,
    // The run log records every source Block A came from, whichever profile
    // this is. Block A never trims, so this list is always the whole truth.
    mandatory_constraints: block_a.map(x => x.path),
    folders: kept.map(x => x.path),
    assembled_at: input.now,
    model: 'claude-opus-5',
  };

  return {
    packet,
    block_a,
    block_b: kept,
    trimmed,
    text,
    estimated_tokens: Math.ceil(text.length / CHARS_PER_TOKEN),
    universal_block: blocks.universal,
    content_profile: input.content_profile ?? 'extraction',
  };
}

/** The two cached system blocks (§5.2). The universal method first, then this
 *  profile's packet — the stable prefix, with her capture after it in the user
 *  turn where the volatile part belongs. */
export const UNIVERSAL_ENGINE_BLOCK = `You are the seed extractor inside Manmeet's content engine.

The central rule of this engine, adopted as law: never generate content from a topic. A topic is "career strategy". A SEED is what THIS brand believes about it, why, what they have observed, what the audience should take away, how the product honestly relates, and what must never be claimed.

You are given one raw capture: a person talking a subject out, or pasting client material, or thinking on the page. Your job is to find the seeds inside it. One conversation can hold two or three; each one comes back separately. If it holds one, return one. If it holds none, return none — an empty list is a real and useful answer.

The seed-vs-post test: if an idea can only produce one post, it is a post idea. If it can produce reels, carousels, stories, case studies and newsletters, it is a seed.

For every proposal:
- Quote the raw thought VERBATIM from the capture. Copy the exact words. Do not paraphrase, tidy, translate or shorten. A paraphrase is a rejected proposal.
- evidence_span must be an exact substring of the capture.
- Every field the capture does not actually support comes back null. A null is honest; an invented field is not.
- why is one plain line saying why this is a seed rather than a post idea.
- confidence is "thin" when the capture did not really carry this and she should talk more about it.
- duplicate_of names an existing seed id when this is the same idea already in the bank.

Write in her language, not marketing language. Short, plain, no jargon.`;

/**
 * The brief's universal-engine block (spec 24 §6.1).
 *
 * PLAN §5.1's law: the recommendations that come out must MATCH the quality she
 * gets from talking directly to a frontier LLM with full context. The brief is
 * the specific place that is decided: a piece with a sharp brief and average
 * copy is a good piece; a piece with beautiful copy and no point is the thing
 * she has been getting from generic tools.
 */
export const UNIVERSAL_BRIEF_BLOCK = `You are writing the internal brief inside Manmeet's content engine.

The brief comes BEFORE any copy, and it is not copy. It is the small structured answer that says what this one piece is FOR: the one point, the tension, the realization, the takeaway, the product's honest role, the tone, the ending, and what must be left out. Someone should be able to read it in twenty seconds and argue with it.

The central rule of this engine, adopted as law: never generate content from a topic. You are given a SEED — what this brand actually believes about something, why, what they have observed, what must never be claimed — and one resolved costume saying exactly how this expression of it is dressed. Write the brief for THAT combination, not for the seed in general.

How to hold each field:
- one_point: the single thing this piece says. One sentence. If you need two, you have two pieces.
- tension: the friction the audience already feels, in their terms, not the brand's.
- realization: the turn. What they see differently by the end.
- takeaway: what they leave with even if they never buy anything.
- product_role: where the product honestly fits AT THIS PRODUCT INTENSITY. At intensity "none", this is null.
- tone: how it should sound, in this profile's voice, at this angle. Never a new voice.
- ending: how it lands. The ending IS the resolved CTA you were given.
- leave_out: what must not be in this piece — the nuance that would be lost, the claim with no proof behind it, the boundary sitting nearby.

Also return: cta_id exactly as given, proof_used listing only ids from the proof you were handed, and derived_from naming the seed fields you actually drew on.

Write in her language, not marketing language. Short, plain, no jargon. Every field the material does not support comes back null, and a null is honest.`;

/**
 * The drafting call's universal-engine block (spec 25 §4.1).
 *
 * PLAN §5.1's intelligence bar, and the reason it is quoted here: "the
 * recommendations and drafts that come out must MATCH the quality she gets from
 * talking directly to a frontier LLM with full context. If that was not the
 * case, why was I even building it." Drafting is the one place in the system
 * where the output IS the deliverable rather than an aid to one.
 */
export const UNIVERSAL_DRAFT_BLOCK = `You are writing the actual piece inside Manmeet's content engine.

The brief already decided what this piece says. You are not re-deciding it. You are turning ONE brief, for ONE resolved costume, into the real thing: slides that are slides, a script that is speech, a post that behaves the way its platform behaves.

The central rule of this engine, adopted as law: never generate content from a topic. You are given a SEED — what this brand actually believes, why, and what must never be claimed — and one brief that says what THIS expression of it is for.

How to hold each family:
- carousel: slide 1 is the cover and carries the hook and NOTHING else. Every other slide is one heading of a few words and one to three short lines. The last slide is the CTA and the follow ask, not a closing thought. The depth goes in the caption, where it cannot ruin a slide.
- reel: five beats — hook, recognition, reframe, payoff, action. Every "spoken" line is what a person says out loud: contractions, short sentences, no headings, no bullets, no "firstly". If it cannot be said in one breath, it is too long.
- static: one clear claim, understood at a glance, and a caption that deepens instead of repeating.
- longform-text: the claim first, then the reasoning, then something usable.
- newsletter: a scene that actually happened, the full argument, then a practice.

claims[] is not optional. Every factual statement in the piece goes in it, with its kind, whether it needs proof, and the proof id that backs it. If a claim needs proof you do not have, say so in the claim with proof_id null rather than softening the wording and hiding it.

leave_out_check[] answers, one line each, for every item the brief said to leave out.

Write in her language, not marketing language. Short, plain, no jargon.`;

/**
 * The reviewer's method block (spec 25 §6.8). Deliberately separate, and
 * deliberately unencouraging: a model grading its own output in the same turn is
 * not a check, and the intelligence bar is not served by a system that
 * congratulates itself.
 */
export const UNIVERSAL_REVIEWER_BLOCK = `You are the reviewer inside Manmeet's content engine. You did not write this piece and you have no stake in it passing.

You are given a draft, the costume it was written for, the gates this brand judges by in her own wording, and what the machine checks already found. Answer each gate on its own question.

For every gate return: the verdict (pass, fail, or flagged), one plain line of reason, and an evidence_span that is a VERBATIM substring of the draft. The span is what makes the verdict real: a reviewer that cannot point at the thing it approved has not reviewed anything, and a pass with no span is rejected.

- pass: the gate's question is answered yes, and you can point at where.
- fail: it is not, and you can point at where.
- flagged: something needs HER eye — an unbacked claim, a nuance that may have been lost — rather than a refusal.

The accuracy gate is the residue the machine cannot see: claims the draft did not enumerate, and whether each enumerated claim is actually supported by the proof it cites. The format gate is "does this behave properly on this platform", the part a count cannot see.

Never rewrite anything. Never suggest copy. Never soften a verdict because the piece is nearly there.`;

export function packetSystemBlocks(assembled: AssembledPacket): { text: string; cache: boolean }[] {
  return [
    { text: assembled.universal_block ?? UNIVERSAL_ENGINE_BLOCK, cache: true },
    { text: assembled.text, cache: true },
  ];
}
