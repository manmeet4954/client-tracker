// The draft, as a kept object — spec 25 §3.
//
// Drafts live at `work-log/creation/making`, already declared by spec 21:
// `entry_type: 'draft_version'`, `history: 'append_only'`, `audience: 'owner'`.
// NO new path is needed for drafts, and none is created.
//
// Append-only is honoured the way spec 23 honours it for seeds: her edit does
// not overwrite version n, it creates version n+1 carrying an `edit_delta`
// recording exactly what moved. That delta is FREE — she was editing anyway —
// and it is the raw material the taste layer reads (§9). This is CLAUDE.md's
// byproduct law applied to the one stream that matters most.
//
// Nothing in this file calls a model. She can write every draft by hand, which
// is the correct behaviour whenever the API key is unset or dead (§13.4 step 2).

import type { ProfileBody } from '../tree/body.ts';
import { amendEntry, putEntry, readPath } from '../tree/body.ts';
import type { Amendment, BodyEntry, Piece } from '../tree/objects.ts';
import { PIECE_PATH } from './seeds.ts';
import { findPiece, resolvePiece } from './resolve.ts';
import { formatKey, formatRulesResolution, type ResolvedFormatRule } from './formats.ts';

export const MAKING_PATH = 'work-log/creation/making';

export class DraftRefused extends Error {}

// ── §4.6 The shapes a draft may take ─────────────────────────────────────────
//
// The families are exhaustive on purpose. §5's closing line is the point: "the
// thing neither of them is: a block of post text with line breaks. There is no
// format family in the schema that produces one, which is the structural version
// of her standing law."

export type FormatFamily = 'carousel' | 'reel' | 'static' | 'longform-text' | 'newsletter';

export const FORMAT_FAMILIES: FormatFamily[] = [
  'carousel', 'reel', 'static', 'longform-text', 'newsletter',
];

/**
 * The field that makes accuracy CHECKABLE rather than judged (§4.6). A draft
 * that states a result with `proof_id: null` has told on itself, in a field,
 * before any reviewer looks at it.
 */
export interface Claim {
  /** A verbatim substring of the draft. */
  text: string;
  kind: 'fact' | 'result' | 'opinion' | 'promise';
  needs_proof: boolean;
  proof_id: string | null;
  within_boundaries: boolean;
  /** §4.5, the static rule: one claim in `claims[]` marked primary. */
  primary?: boolean;
}

export interface CarouselSlide {
  index: number;
  heading: string;
  /** Short lines, not paragraphs. The schema cannot express a paragraph slide. */
  lines: string[];
  /** Direction for whoever designs it. Never a design. */
  visual_note: string;
}

export type ReelBeatName = 'hook' | 'recognition' | 'reframe' | 'payoff' | 'action';

export interface ReelBeat {
  beat: ReelBeatName;
  /** What a person says out loud. */
  spoken: string;
  on_screen_text?: string;
  seconds_estimate: number;
}

interface DraftCommon {
  /** The first thing a person meets. Equals `brief.hook` exactly when she wrote one. */
  hook: string;
  caption: string | null;
  cta_line: string;
  alt_text: string[];
  /** One line per item in `brief.leave_out[]` confirming it was kept out. */
  leave_out_check: string[];
  /** Anything the model wants to flag, plainly. One or two lines, not an essay. */
  notes_for_her: string;
}

export type DraftContent =
  | (DraftCommon & { format_family: 'carousel'; slides: CarouselSlide[] })
  | (DraftCommon & { format_family: 'reel'; script: ReelBeat[] })
  | (DraftCommon & { format_family: 'static'; visual_text: string })
  | (DraftCommon & { format_family: 'longform-text'; opening_claim: string; body_blocks: string[]; closing: string })
  | (DraftCommon & { format_family: 'newsletter'; scene: string; sections: string[]; practice: string });

/** What the model returns: the content plus the claims it enumerated (§4.6). */
export type DraftPayload = DraftContent & { claims: Claim[] };

// ── §8.6 Her edits are feedback nobody writes ────────────────────────────────

export interface EditChange {
  field: string;
  before: string;
  after: string;
  kind: 'shortened' | 'reworded' | 'removed' | 'added' | 'reordered';
}

export interface EditDelta {
  from_version: number;
  to_version: number;
  changes: EditChange[];
  /** A PROPOSAL only. It routes nowhere on its own (§8.6). */
  proposed_class?: 'voice' | 'format' | 'seed' | 'piece-only';
}

// ── §3.2 The draft version record ────────────────────────────────────────────

export interface DraftVersion {
  id: string;
  piece_id: string;
  version: number;
  origin: 'engine' | 'hers' | 'engine+her-edit';
  brief_version: number;
  /** The gate set version in force when this was drafted. */
  gate_set_version: number;
  strategy_version: number;
  /** The merged universal+override rule set, hashed and named (§4.5). */
  format_rules_resolution: string;
  format_rules_version: number;
  format_family: FormatFamily;
  content: DraftContent;
  claims: Claim[];
  proof_refs: string[];
  asset_refs: string[];
  /** Null when she wrote it herself. Nothing is attributed to the engine that
   *  the engine did not write. */
  engine_run_id: string | null;
  gate_run_id: string | null;
  /** Present on `engine+her-edit` versions (§8.6). */
  edit_delta?: EditDelta;
  created_at: string;
  created_by: string;
}

// ── Which family a resolved format belongs to ────────────────────────────────

const FAMILY_BY_FORMAT: Record<string, FormatFamily> = {
  carousel: 'carousel',
  reel: 'reel',
  reels: 'reel',
  video: 'reel',
  short: 'reel',
  static: 'static',
  'single-post': 'static',
  post: 'static',
  image: 'static',
  poster: 'static',
  story: 'static',
  'linkedin-post': 'longform-text',
  article: 'longform-text',
  thread: 'longform-text',
  newsletter: 'newsletter',
  email: 'newsletter',
};

/**
 * The family a format expresses itself in. A format nobody has mapped falls to
 * `static` — the plainest family — rather than inventing a sixth, and the
 * format gate reads the profile's own merged rule either way.
 */
export function formatFamilyOf(format: string, platform?: string): FormatFamily {
  const f = formatKey(format);
  const p = formatKey(platform ?? '');
  return FAMILY_BY_FORMAT[`${p}-${f}`] ?? FAMILY_BY_FORMAT[f] ?? 'static';
}

// ── Reading: one function, and nothing reads entry.data directly ─────────────

export function readDrafts(body: ProfileBody, piece_id?: string): DraftVersion[] {
  let entries: BodyEntry[];
  try {
    entries = readPath(body, MAKING_PATH);
  } catch {
    return [];
  }
  return entries
    .filter(e => e.type === 'draft_version')
    .map(e => ({ ...(e.data as unknown as DraftVersion), id: e.id }))
    .filter(d => !piece_id || d.piece_id === piece_id)
    .sort((a, b) => a.version - b.version);
}

/**
 * The current draft. The piece's `current_draft_version_id` is the pointer
 * everything else reads (§3.4); the highest version is the honest fallback for a
 * piece whose pointer was never set (a migrated card, or a draft written before
 * the pointer existed).
 */
export function resolveDraft(body: ProfileBody, piece_id: string): DraftVersion | null {
  const all = readDrafts(body, piece_id);
  if (!all.length) return null;
  const pointer = findPiece(body, piece_id)?.piece.current_draft_version_id;
  return (pointer && all.find(d => d.id === pointer)) || all[all.length - 1];
}

export function nextDraftVersion(body: ProfileBody, piece_id: string): number {
  return readDrafts(body, piece_id).length + 1;
}

export function findDraft(body: ProfileBody, draft_id: string): DraftVersion | null {
  return readDrafts(body).find(d => d.id === draft_id) ?? null;
}

// ── Writing ──────────────────────────────────────────────────────────────────

export interface WriteDraftInput {
  piece_id: string;
  origin: DraftVersion['origin'];
  payload: DraftPayload;
  brief_version: number;
  gate_set_version: number;
  strategy_version: number;
  rule: ResolvedFormatRule;
  proof_refs?: string[];
  asset_refs?: string[];
  engine_run_id?: string | null;
  edit_delta?: EditDelta;
  now: string;
  by: string;
}

/**
 * Version 1 is the first draft, whoever wrote it. Every later write is version
 * n+1; nothing about an existing version is ever rewritten, so a version that
 * failed its gates stays, with its verdicts, forever. That is what makes the
 * below-the-bar count in §4.9 mean something.
 */
export function writeDraft(body: ProfileBody, input: WriteDraftInput): {
  body: ProfileBody; draft: DraftVersion;
} {
  const version = nextDraftVersion(body, input.piece_id);
  const { claims, ...content } = input.payload;

  const draft: DraftVersion = {
    id: `${input.piece_id}-d${version}`,
    piece_id: input.piece_id,
    version,
    origin: input.origin,
    brief_version: input.brief_version,
    gate_set_version: input.gate_set_version,
    strategy_version: input.strategy_version,
    format_rules_resolution: formatRulesResolution(input.rule),
    format_rules_version: input.rule.rule?.version ?? 0,
    format_family: content.format_family,
    content: content as DraftContent,
    claims,
    proof_refs: input.proof_refs ?? claims.map(c => c.proof_id).filter((x): x is string => !!x),
    asset_refs: input.asset_refs ?? [],
    engine_run_id: input.engine_run_id ?? null,
    gate_run_id: null,
    ...(input.edit_delta ? { edit_delta: input.edit_delta } : {}),
    created_at: input.now,
    created_by: input.by,
  };

  const next = putEntry(body, MAKING_PATH, {
    id: draft.id, type: 'draft_version',
    data: draft as unknown as Record<string, unknown>,
  }, { writer: input.origin === 'engine' ? 'engine:content' : 'owner', now: input.now });

  return { body: setCurrentDraft(next, input.piece_id, draft.id, input.now, input.by), draft };
}

/** The piece points at one version, and everything else follows that pointer. */
export function setCurrentDraft(
  body: ProfileBody, piece_id: string, draft_version_id: string, now: string, by: string,
): ProfileBody {
  const amendment: Amendment = {
    at: now, by,
    note: `Current draft is now ${draft_version_id}.`,
    changed: { current_draft_version_id: draft_version_id },
  };
  return amendEntry(body, PIECE_PATH, piece_id, amendment);
}

/**
 * Her edit. It never overwrites version n — it creates n+1 with
 * `origin: 'engine+her-edit'` and the delta recording exactly what moved (§3.3).
 */
export function herDraftEdit(
  body: ProfileBody,
  input: { piece_id: string; payload: DraftPayload; now: string; by: string; rule: ResolvedFormatRule;
           proposed_class?: EditDelta['proposed_class'] },
): { body: ProfileBody; draft: DraftVersion; delta: EditDelta } {
  const previous = resolveDraft(body, input.piece_id);
  if (!previous) {
    throw new DraftRefused('There is no draft to edit yet on this piece.');
  }
  const delta: EditDelta = {
    from_version: previous.version,
    to_version: previous.version + 1,
    changes: computeEditDelta(previous, input.payload),
    ...(input.proposed_class ? { proposed_class: input.proposed_class } : {}),
  };
  const written = writeDraft(body, {
    piece_id: input.piece_id,
    origin: previous.origin === 'hers' ? 'hers' : 'engine+her-edit',
    payload: input.payload,
    brief_version: previous.brief_version,
    gate_set_version: previous.gate_set_version,
    strategy_version: previous.strategy_version,
    rule: input.rule,
    proof_refs: previous.proof_refs,
    asset_refs: previous.asset_refs,
    engine_run_id: null,
    edit_delta: delta,
    now: input.now,
    by: input.by,
  });
  return { ...written, delta };
}

// ── The edit delta, computed rather than reported ────────────────────────────

function textOfField(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(textOfField).join('\n');
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([k]) => k !== 'index')
      .map(([, v]) => textOfField(v))
      .join('\n');
  }
  return String(value);
}

function changeKind(before: string, after: string): EditChange['kind'] {
  if (!before.trim()) return 'added';
  if (!after.trim()) return 'removed';
  const b = before.trim().length;
  const a = after.trim().length;
  if (a < b * 0.8) return 'shortened';
  // Same words, different order: the cheapest honest test for a reorder.
  const sort = (s: string) => s.split(/\s+/).map(w => w.toLowerCase()).sort().join(' ');
  if (sort(before) === sort(after)) return 'reordered';
  return 'reworded';
}

/**
 * What actually moved between two drafts, field by field. It costs her nothing,
 * because she was editing anyway — which is the whole design (§8.6).
 */
export function computeEditDelta(previous: DraftVersion, next: DraftPayload): EditChange[] {
  const out: EditChange[] = [];
  const before = { ...previous.content, claims: previous.claims } as unknown as Record<string, unknown>;
  const after = next as unknown as Record<string, unknown>;
  const fields = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const field of fields) {
    if (field === 'format_family') continue;
    const b = textOfField(before[field]);
    const a = textOfField(after[field]);
    if (b === a) continue;
    out.push({ field, before: b, after: a, kind: changeKind(b, a) });
  }
  return out;
}

// ── §13.1 and the hand-written path ──────────────────────────────────────────

/** An empty draft of the right shape. No run, no cost, origin hers (§13.4 step 2). */
export function emptyDraftPayload(family: FormatFamily, hook = ''): DraftPayload {
  const common = {
    hook, caption: null, cta_line: '', alt_text: [], leave_out_check: [], notes_for_her: '',
    claims: [] as Claim[],
  };
  switch (family) {
    case 'carousel':
      return { ...common, format_family: 'carousel', slides: [] };
    case 'reel':
      return { ...common, format_family: 'reel', script: [] };
    case 'longform-text':
      return { ...common, format_family: 'longform-text', opening_claim: '', body_blocks: [], closing: '' };
    case 'newsletter':
      return { ...common, format_family: 'newsletter', scene: '', sections: [], practice: '' };
    default:
      return { ...common, format_family: 'static', visual_text: '' };
  }
}

/**
 * §13.1: whatever draft text a legacy content card carries migrates as draft
 * version 1 with `origin: 'hers'` and `engine_run_id: null`. Nothing is
 * attributed to the engine that the engine did not write.
 */
export function legacyDraftPayload(opts: {
  family: FormatFamily; hook?: string; text?: string; caption?: string | null;
}): DraftPayload {
  const payload = emptyDraftPayload(opts.family, opts.hook ?? '');
  payload.caption = opts.caption ?? null;
  const text = (opts.text ?? '').trim();
  if (!text) return payload;
  if (payload.format_family === 'static') payload.visual_text = text;
  else if (payload.format_family === 'longform-text') payload.body_blocks = [text];
  else if (payload.format_family === 'newsletter') payload.sections = [text];
  else if (payload.format_family === 'carousel') {
    payload.slides = [{ index: 1, heading: opts.hook ?? '', lines: [text], visual_note: '' }];
  } else if (payload.format_family === 'reel') {
    payload.script = [{ beat: 'hook', spoken: text, seconds_estimate: 0 }];
  }
  return payload;
}

// ── §12.2 The one thing a client sees ────────────────────────────────────────
//
// A WHITELIST, not a blacklist, and acceptance test 14 proves that adding a new
// field to the draft object does not automatically expose it. That distinction
// is the whole guarantee: a blacklist leaks the day someone adds a field and
// forgets.

export interface ClientPreview {
  format_family: FormatFamily;
  hook: string;
  caption: string | null;
  cta_line: string;
  slides?: { heading: string; lines: string[] }[];
  script?: { spoken: string; on_screen_text?: string }[];
  visual_text?: string;
  opening_claim?: string;
  body_blocks?: string[];
  closing?: string;
  scene?: string;
  sections?: string[];
  practice?: string;
}

export function clientPreviewOf(draft: DraftVersion | null): ClientPreview | null {
  if (!draft) return null;
  const c = draft.content;
  const base: ClientPreview = {
    format_family: c.format_family,
    hook: c.hook,
    caption: c.caption ?? null,
    cta_line: c.cta_line,
  };
  switch (c.format_family) {
    case 'carousel':
      return { ...base, slides: c.slides.map(s => ({ heading: s.heading, lines: [...s.lines] })) };
    case 'reel':
      return {
        ...base,
        script: c.script.map(s => ({
          spoken: s.spoken,
          ...(s.on_screen_text ? { on_screen_text: s.on_screen_text } : {}),
        })),
      };
    case 'static':
      return { ...base, visual_text: c.visual_text };
    case 'longform-text':
      return { ...base, opening_claim: c.opening_claim, body_blocks: [...c.body_blocks], closing: c.closing };
    case 'newsletter':
      return { ...base, scene: c.scene, sections: [...c.sections], practice: c.practice };
  }
}

// ── The write door (§3.3, acceptance test 18) ────────────────────────────────

export interface DraftRefusal {
  draft_id: string;
  reason: string;
}

/**
 * Append-only, enforced where a whole-body save could otherwise route around
 * `putEntry`. A write that edits an existing draft version is refused, from
 * anyone, including the engine. A correction is a NEW version.
 */
export function refusedDraftWrites(
  current: ProfileBody | undefined, incoming: ProfileBody | undefined,
): DraftRefusal[] {
  if (!incoming || !current) return [];
  const out: DraftRefusal[] = [];
  const before = new Map(
    (current.paths?.[MAKING_PATH] ?? [])
      .filter(e => e.type === 'draft_version')
      .map(e => [e.id, JSON.stringify(e)]),
  );
  for (const entry of incoming.paths?.[MAKING_PATH] ?? []) {
    if (entry.type !== 'draft_version') continue;
    const prev = before.get(entry.id);
    if (prev === undefined) continue;                       // a new version, which is the point
    if (prev === JSON.stringify(entry)) continue;           // untouched
    out.push({
      draft_id: entry.id,
      reason: 'a draft version is never rewritten — her edit creates the next version, with the delta (§3.3)',
    });
  }
  return out;
}

/** The pieces on this profile that carry at least one draft. */
export function piecesWithDrafts(body: ProfileBody): Piece[] {
  const ids = new Set(readDrafts(body).map(d => d.piece_id));
  return (body.paths?.[PIECE_PATH] ?? [])
    .filter(e => ids.has(e.id))
    .map(e => resolvePiece(e));
}
