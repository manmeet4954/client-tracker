// The piece panel's arithmetic — the restructure handoff, "CREATION → Board":
// "Review and scheduling are states of a piece, not screens."
//
// Everything the panel decides is decided HERE, so it can be checked without a
// browser: which profile a piece belongs to, whether a stage move is allowed,
// what each field says when the data is missing, what the review link is, what
// a new preview looks like at birth, and which gates a piece is judged against.
//
// Pure. No React, no runtime `@/` imports — only type imports, which are erased.
// It runs under plain Node in the acceptance tests.

import type { ClientData, ContentCard, ContentStage, PreviewPost } from '@/types';
import type { Gate, GateSet } from '@/lib/tree/objects';

// ── Where the piece lives ────────────────────────────────────────────────────
//
// The panel is handed a card id and nothing else. One id, one home: the id
// resolves to exactly one profile, so the panel never has to be told twice
// which profile it is inside.

export type PieceLocation =
  | { kind: 'card'; profileId: string; card: ContentCard }
  | { kind: 'tree'; profileId: string; title: string; stage: string }
  | { kind: 'missing' };

/** The one path the tree keeps pieces at. */
const PIECES_PATH = 'work-log/creation';

/**
 * Find the piece behind an id, across every profile the caller may see.
 *
 * `clientData` is already role-filtered by the server, so a search across it
 * can only ever find something this role is allowed to open.
 *
 * A deep link can also carry a TREE piece id, which is not a content-card id.
 * That is found too and reported as what it is, rather than as a dead panel.
 */
export function locatePiece(
  clientData: Record<string, ClientData>,
  cardId: string,
): PieceLocation {
  if (!cardId) return { kind: 'missing' };

  for (const [profileId, data] of Object.entries(clientData)) {
    const card = (data.contentCards ?? []).find(c => c.id === cardId);
    if (card) return { kind: 'card', profileId, card };
  }

  for (const [profileId, data] of Object.entries(clientData)) {
    const entry = (data.body?.paths?.[PIECES_PATH] ?? []).find(e => e.id === cardId);
    if (!entry) continue;
    const d = entry.data as { title?: string; stage?: string };
    return {
      kind: 'tree',
      profileId,
      title: d.title?.trim() || 'Untitled piece',
      stage: d.stage?.trim() || 'no stage recorded',
    };
  }

  return { kind: 'missing' };
}

// ── Moving stage ─────────────────────────────────────────────────────────────

export interface MoveVerdict {
  allowed: boolean;
  /** One plain line, already written. Empty when the move simply happens. */
  reason: string;
}

/**
 * The lock gates writing (handoff rule 9). Moving a piece from this panel is
 * allowed once Strategy is locked and refused before it, which is the same rule
 * the board itself obeys — the panel is not a side door around it.
 */
export function canMove(input: {
  locked: boolean;
  from: ContentStage;
  to: ContentStage;
}): MoveVerdict {
  if (!input.locked) {
    return { allowed: false, reason: 'Strategy is not locked yet, so nothing moves here.' };
  }
  if (input.from === input.to) return { allowed: false, reason: '' };
  return { allowed: true, reason: '' };
}

// ── The fields ───────────────────────────────────────────────────────────────

export interface FieldRow {
  label: string;
  value: string;
  /** Set only when the value is a real link to follow. */
  href?: string;
  /** True when there is nothing recorded. The panel says so, never a blank. */
  missing: boolean;
}

/**
 * Pillar, format, the seed it was born from, the date, the live link.
 *
 * Missing is said out loud (handoff rule 7). Nothing here is asked for again:
 * every value is read off the piece the system already has.
 */
export function pieceFields(input: {
  card: ContentCard;
  pillarName?: string;
  seedName?: string;
}): FieldRow[] {
  const { card, pillarName, seedName } = input;
  const link = (card.postUrl ?? '').trim();
  const date = (card.scheduledDate ?? '').slice(0, 10);

  return [
    row('Pillar', pillarName?.trim(), 'No pillar yet'),
    row('Format', card.contentType?.trim(), 'No format yet'),
    row('Born from', seedName?.trim(), 'Not born from a seed'),
    row('Goes live', date, 'No date yet'),
    { ...row('Live link', link, 'Not posted yet'), href: link || undefined },
  ];
}

function row(label: string, value: string | undefined, absent: string): FieldRow {
  const v = (value ?? '').trim();
  return { label, value: v || absent, missing: v === '' };
}

// ── The review link ──────────────────────────────────────────────────────────

/** The one public address a piece has. `/p/<shareId>`, and nothing else. */
export function sharePath(shareId: string): string {
  return `/p/${shareId}`;
}

/** The whole link, when the panel knows what origin it is being read at. */
export function shareUrl(origin: string, shareId: string): string {
  return `${origin.replace(/\/+$/, '')}${sharePath(shareId)}`;
}

/**
 * WhatsApp, opened in a new tab with the link already written. She uses
 * WhatsApp and never Telegram, and nothing is ever sent on her behalf: this
 * only opens the app with the message ready.
 */
export function whatsappHref(url: string, note?: string): string {
  const text = note?.trim() ? `${note.trim()} ${url}` : url;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/**
 * What is known about sending and opening.
 *
 * Nothing in this product records when a link was sent or when it was opened,
 * so the panel says that rather than drawing a state it does not have. The day
 * the record exists, `known` turns true here and the panel needs no change.
 */
export function deliveryState(preview: PreviewPost | undefined): { known: boolean; line: string } {
  if (!preview) return { known: false, line: '' };
  return {
    known: false,
    line: 'The link is live from the moment it is made. Nothing records when it was sent or opened, '
      + 'so the answer comes back as a move off Review.',
  };
}

// ── Previews: attach one, or make one ────────────────────────────────────────

/**
 * Attaching. She picks; the system never guesses which preview belongs to which
 * piece, because a wrong guess sends the wrong post to a client.
 */
export function attachPreview(preview: PreviewPost, cardId: string, now: string): PreviewPost {
  return { ...preview, cardId, updatedAt: now };
}

/**
 * A preview made from a piece in Review, carrying `cardId` FROM BIRTH.
 *
 * Its name and caption come off the piece, so nothing is asked twice. Slides
 * are the only thing it does not have yet.
 */
export function newPreviewFor(input: {
  card: ContentCard;
  id: string;
  shareId: string;
  now: string;
}): PreviewPost {
  const { card, id, shareId, now } = input;
  return {
    id,
    shareId,
    cardId: card.id,
    name: card.title?.trim() || 'Untitled post',
    postType: 'static',
    images: [],
    caption: (card.content ?? '').trim(),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * True when the piece's words and the preview's caption have parted.
 *
 * One thing, one home: the caption IS the piece's words. When the piece is
 * edited after the preview was made they drift, and the panel offers to take
 * the piece's words again rather than leaving two versions of one caption.
 */
export function captionDrift(card: ContentCard, preview: PreviewPost | undefined): boolean {
  if (!preview) return false;
  const words = (card.content ?? '').trim();
  if (!words) return false;
  return words !== (preview.caption ?? '').trim();
}

/** The slide count, said in English, counted from the array it describes. */
export function slideLine(preview: PreviewPost): string {
  const n = preview.images.length;
  if (n === 0) return 'No slides yet';
  return n === 1 ? '1 slide' : `${n} slides`;
}

// ── The gates ────────────────────────────────────────────────────────────────

export interface GateRow {
  id: string;
  name: string;
  question: string;
  kind: 'brand' | 'operational';
  /** Marked when the piece has come out of review. Never ticked by hand. */
  passed: boolean;
}

export interface GateReading {
  /** False when no gate set has been written for this profile. */
  known: boolean;
  rows: GateRow[];
  /** The headline, counted from `rows`. Empty when there is nothing to count. */
  headline: string;
  /** What to say when there are no gates to show. Empty when there are. */
  line: string;
}

/** The stages at which a piece has been through review and come out the far side. */
export const PAST_REVIEW: ContentStage[] = ['ready', 'scheduled', 'posted'];

/**
 * The gates this piece is judged against.
 *
 * The brand gates come out of the profile's own strategy. If no gate set has
 * been written, that is said plainly — passes are never invented for a profile
 * that has not decided its gates.
 */
export function gateReading(input: {
  gateSet: GateSet | null | undefined;
  operational: Gate[];
  stage: ContentStage;
}): GateReading {
  const { gateSet, operational, stage } = input;

  if (!gateSet) {
    return {
      known: false,
      rows: [],
      headline: '',
      line: 'No gates are written for this profile yet. Write them in Strategy and they show here.',
    };
  }

  const passed = PAST_REVIEW.includes(stage);
  const brand = gateSet.gates.filter(g => g.kind === 'brand');
  const rows: GateRow[] = [...brand, ...operational].map(g => ({
    id: g.id,
    name: g.name,
    question: g.question,
    kind: g.kind,
    passed,
  }));

  if (rows.length === 0) {
    return {
      known: false,
      rows,
      headline: '',
      line: 'The gate set for this profile is empty. Write the gates in Strategy and they show here.',
    };
  }

  return {
    known: true,
    rows,
    headline: rows.length === 1 ? '1 gate every piece clears' : `${rows.length} gates every piece clears`,
    line: '',
  };
}
