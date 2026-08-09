// make_preview — spec 30 §3.3, the flow she described.
//
// "If I say I posted something today, it should be reflected. If I paste a
// link, it should create a preview and give me back a link I can share with the
// client." And she should not be assembling that by hand every time.
//
// Five decisions the harness makes instead of her:
//   1. Which profile.
//   2. Which piece — one on the board, or a new one if she is describing
//      something that is not there yet.
//   3. The preview is created with `cardId` SET AT BIRTH. A preview is the
//      review state of that piece, never a second copy of it (S2). If the piece
//      already has a preview, this one grows; a second copy is never made, and
//      the share link she already sent stays the same link.
//   4. The images go on it, from the link.
//   5. `/p/<shareId>` comes back.
//
// STEP 4, HONESTLY, and this is the part that must not pretend:
//   - a direct image or video link: attached.
//   - a Canva design link: resolved to image links BEFORE this module sees it,
//     by the loop, using the same import the preview editor runs. When Canva is
//     not connected the link arrives here untouched and is refused. That is
//     said plainly and
//     nothing is written.
//   - anything else: refused, with the reason. No scraping. No screenshotting.
//
// Pure. No fetch, no clock, no randomness: `now`, the id makers and whether
// Canva is configured all arrive from the caller.

import type { ClientData, ContentCard, PreviewPost } from '@/types';
import { MAX_CAROUSEL_SLIDES } from '../../types/index.ts';
import { PIECE_PATH } from '../engine/seeds.ts';
import { resolvePiece } from '../engine/resolve.ts';
import { putEntry } from '../tree/body.ts';
import type { Piece } from '../tree/objects.ts';
import { previewFor } from '../creation/board.ts';
import { newPreviewFor, sharePath } from '../creation/piece.ts';
import type { ResolvedProfile, WriteContext } from './write.ts';
import { PREVIEWS_PATH, commitData, guardPath, resolveProfile, writerFor } from './write.ts';

// ── What a pasted link actually is ───────────────────────────────────────────

export type LinkKind = 'media' | 'canva' | 'other';

const MEDIA = /\.(jpe?g|png|gif|webp|avif|heic|mp4|mov|webm|m4v)(\?|#|$)/i;
const CANVA = /(^|\.)canva\.(com|link|site)$/i;

/**
 * What kind of link this is, by looking at the link and nothing else.
 *
 * Nothing is fetched to find out. A link that cannot be read as an image from
 * its own address is not treated as one, because the alternative is a preview
 * with a broken slide in it going to a client.
 */
export function classifyLink(raw: string): LinkKind {
  const value = (raw ?? '').trim();
  let host = '';
  let path = value;
  try {
    const url = new URL(value);
    host = url.hostname;
    path = url.pathname;
  } catch {
    host = '';
  }
  if (host && CANVA.test(host)) return 'canva';
  if (MEDIA.test(path)) return 'media';
  return 'other';
}

// ── The intent ───────────────────────────────────────────────────────────────

export interface MakePreviewIntent {
  profile: string;
  /** The piece this is a preview of, when it is already on the board. */
  pieceId?: string;
  /** Used only when no `pieceId` is given: she is describing a new piece. */
  newPiece?: {
    title: string;
    hook?: string;
    pillarId?: string;
    platform?: string;
    format?: string;
  };
  /** The links she pasted, in the order she pasted them. */
  links: string[];
  /** The internal label. Never shown to a client. Defaults to the piece title. */
  name?: string;
  /** The caption to show under the slides. Left alone when she gives none. */
  caption?: string;
  /**
   * `canvaConfigured()` from `lib/canva.ts`, read at the route. Injected so
   * this module never touches an environment variable.
   */
  canvaConfigured: boolean;
}

export type MakePreviewResult =
  | {
      ok: true;
      state: import('@/types').AppState;
      paths: string[];
      summary: string;
      /** What she sends the client: `/p/<shareId>`. */
      sharePath: string;
      shareId: string;
      previewId: string;
      /** The piece this preview belongs to. Always set. */
      pieceId: string;
      /** True when the piece was born in this call. */
      pieceCreated: boolean;
    }
  | { ok: false; refusal: string };

export const CANVA_NOT_CONNECTED =
  'That is a Canva link, and I cannot pull a Canva design in yet. '
  + 'The import is built and waiting, but it needs a Canva app registered on your Canva account first, '
  + 'and that is a one-time setup only you can do. '
  + 'Until then, export the slides from Canva and paste the image links, or send me the files. '
  + 'Nothing was written.';

export const CANVA_CONNECT_FIRST =
  'That is a Canva link. The Canva app is registered, but this chat cannot run the import itself. '
  + 'Pull the design in from the preview editor and I will do the rest. Nothing was written.';

// ── The flow ─────────────────────────────────────────────────────────────────

/**
 * She pastes a link, she gets a shareable client link back.
 *
 * Every refusal below happens BEFORE anything is written, so a refused preview
 * leaves no half-made piece and no empty preview behind.
 */
export function makePreview(ctx: WriteContext, intent: MakePreviewIntent): MakePreviewResult {
  // 1 — which profile.
  const found = resolveProfile(ctx.state, intent.profile);
  if (!found.ok) return found;
  const profile = found.profile;

  // The preview lives at `work-log/creation/review`; the piece, if one has to be
  // born, at `work-log/creation`. Both doors are checked before either is used.
  const onReview = guardPath(ctx.state, profile, PREVIEWS_PATH);
  if (onReview) return { ok: false, refusal: onReview };

  // 2 — which piece.
  const located = locate(profile, intent);
  if (!located.ok) return located;
  // A piece born here gets its id from the same maker every other id comes from.
  const piece = located.create ? { ...located, id: ctx.ids.id() } : located;

  if (piece.create) {
    const onBoard = guardPath(ctx.state, profile, PIECE_PATH);
    if (onBoard) return { ok: false, refusal: onBoard };
  }

  // 4 (checked before 3, so a bad link never leaves a piece behind) — the links.
  const images = readLinks(intent);
  if (!images.ok) return images;

  const existing = previewFor(profile.data.previewPosts ?? [], piece.id);
  const slides = [...(existing?.images ?? []), ...images.urls];
  if (slides.length > MAX_CAROUSEL_SLIDES) {
    return {
      ok: false,
      refusal: `That comes to ${slides.length} slides and a carousel holds at most `
        + `${MAX_CAROUSEL_SLIDES}. Nothing was written.`,
    };
  }

  // 3 — the piece, then the preview attached to it.
  let data: ClientData = profile.data;
  const paths: string[] = [PREVIEWS_PATH];

  if (piece.create) {
    const born: Piece = {
      id: piece.id,
      seed_id: null,
      title: piece.title,
      ...(piece.hook ? { hook: piece.hook } : {}),
      stage: 'review',
      costume: piece.costume,
      birth: null,
      created_month: ctx.now.slice(0, 7),
    };
    data = {
      ...data,
      body: putEntry(profile.body, PIECE_PATH, {
        id: piece.id, type: 'piece', data: born as unknown as Record<string, unknown>,
      }, { writer: writerFor(PIECE_PATH), now: ctx.now }),
    };
    paths.push(PIECE_PATH);
  }

  const preview: PreviewPost = existing
    ? {
        ...existing,
        images: slides,
        name: intent.name?.trim() || existing.name,
        caption: intent.caption ?? existing.caption,
        postType: slides.length > 1 ? 'carousel' : 'static',
        updatedAt: ctx.now,
      }
    : {
        // `newPreviewFor` is the one place a preview is born, and it sets
        // `cardId` at birth. It is written against the board's card shape, so a
        // tree piece is handed to it as the same three fields it reads.
        ...newPreviewFor({
          card: {
            id: piece.id,
            title: intent.name?.trim() || piece.title,
            content: intent.caption ?? '',
          } as ContentCard,
          id: ctx.ids.id(),
          shareId: ctx.ids.shareId(),
          now: ctx.now,
        }),
        images: slides,
        postType: slides.length > 1 ? 'carousel' : 'static',
      };

  data = {
    ...data,
    previewPosts: [
      ...(data.previewPosts ?? []).filter(p => p.id !== preview.id),
      preview,
    ],
  };

  const committed = commitData(
    ctx, profile, data, paths,
    `${slides.length === 1 ? '1 slide' : `${slides.length} slides`} on "${piece.title}" for `
    + `${profile.name}. The client link is ${sharePath(preview.shareId)}.`,
  );
  if (!committed.ok) return committed;

  return {
    ok: true,
    state: committed.state,
    paths: committed.paths,
    summary: committed.summary,
    sharePath: sharePath(preview.shareId),
    shareId: preview.shareId,
    previewId: preview.id,
    pieceId: piece.id,
    pieceCreated: piece.create,
  };
}

// ── Which piece ──────────────────────────────────────────────────────────────

type Located =
  | {
      ok: true; id: string; title: string; hook?: string;
      costume: Piece['costume']; create: boolean;
    }
  | { ok: false; refusal: string };

/**
 * The piece behind the preview: one already on the board, or one born here.
 *
 * A named piece is looked for in the tree first and then in the legacy board,
 * because both are real on a profile mid-cutover and a preview may be made
 * against either. Only the tree is ever WRITTEN to.
 */
function locate(profile: ResolvedProfile, intent: MakePreviewIntent): Located {
  if (intent.pieceId) {
    const entry = (profile.body.paths?.[PIECE_PATH] ?? []).find(e => e.id === intent.pieceId);
    if (entry) {
      const piece = resolvePiece(entry);
      return {
        ok: true, id: entry.id, title: piece.title || 'Untitled piece',
        costume: piece.costume ?? {}, create: false,
      };
    }
    const card = (profile.data.contentCards ?? []).find(c => c.id === intent.pieceId);
    if (card) {
      return {
        ok: true, id: card.id, title: card.title || 'Untitled piece',
        costume: {}, create: false,
      };
    }
    return {
      ok: false,
      refusal: `There is no piece with that id on ${profile.name}. Nothing was written.`,
    };
  }

  const title = intent.newPiece?.title?.trim();
  if (!title) {
    return {
      ok: false,
      refusal: 'Which piece is this a preview of? Name it, or tell me what it is and '
        + 'I will put it on the board first. Nothing was written.',
    };
  }

  const costume: Piece['costume'] = {};
  if (intent.newPiece?.pillarId) costume.pillar_id = intent.newPiece.pillarId;
  if (intent.newPiece?.platform) costume.platform = intent.newPiece.platform;
  if (intent.newPiece?.format) costume.format = intent.newPiece.format;

  return {
    ok: true,
    // Replaced by the caller with a real id from the injected maker. `locate`
    // stays pure and id-free so it can be read as one question: which piece?
    id: '',
    title,
    hook: intent.newPiece?.hook?.trim() || undefined,
    costume,
    create: true,
  };
}

// ── Which links ──────────────────────────────────────────────────────────────

type ReadLinks = { ok: true; urls: string[] } | { ok: false; refusal: string };

/**
 * The links, or the reason there is no preview.
 *
 * One bad link refuses the whole thing. Attaching two of three slides and
 * calling it done is exactly the half-done write this spec exists to stop.
 */
function readLinks(intent: MakePreviewIntent): ReadLinks {
  const links = (intent.links ?? []).map(l => (l ?? '').trim()).filter(Boolean);
  if (links.length === 0) {
    return {
      ok: false,
      refusal: 'There is no link here to make a preview from. Nothing was written.',
    };
  }

  for (const link of links) {
    const kind = classifyLink(link);
    if (kind === 'canva') {
      return {
        ok: false,
        refusal: intent.canvaConfigured ? CANVA_CONNECT_FIRST : CANVA_NOT_CONNECTED,
      };
    }
    if (kind === 'other') {
      return {
        ok: false,
        refusal: `I cannot make slides out of ${link}. `
          + 'I can use a direct image or video link, or files you have already uploaded. '
          + 'I do not read pages or take screenshots of them. Nothing was written.',
      };
    }
  }

  return { ok: true, urls: links };
}
