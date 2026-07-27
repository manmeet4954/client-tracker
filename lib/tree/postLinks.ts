// The link join — spec 26 §8, spec 03's mechanism generalized and re-addressed.
//
// Spec 03's rule is right and stays: SHE PASTES THE LIVE LINK, AND THAT PASTE IS
// THE TRIGGER. Nothing new to type, ever. Three things change here:
//
//  1. The key generalizes. `extractPostRef` comes from the connector, so
//     Instagram keeps its shortcode regex and a future platform brings its own.
//     No per-platform regex is ever written outside a connector.
//  2. The target is the PIECE, not the card (S2). A profile that has not
//     migrated keeps `id_kind: 'legacy-card'`, and neither kind is ever guessed
//     into the other.
//  3. Match methods are explicit. `url-ref` and `owner-confirmed` attach.
//     `time-window-suggested` is a SUGGESTION and never attaches on its own —
//     guessing which post a piece is would poison every downstream number with
//     no visible trace.
//
// Kept pure so the join can be proven without a database.

import { connectorFor } from '../platforms/index.ts';
import type { PostLink } from './objects.ts';

export interface JoinablePost {
  platform_post_id: string;
  platform: string;
  post_ref: string | null;
  channel_id: string;
  published_at?: string;
}

export interface JoinablePiece {
  id: string;
  id_kind: 'piece' | 'legacy-card';
  profile_id: string;
  /** The link she pasted. No link, no claim — and that is not an error. */
  live_link?: string | null;
  platform: string;
  posted_at?: string;
}

export interface JoinResult {
  attach: PostLink[];
  /** Two pieces claiming one post: neither attaches, and it goes to her (§8). */
  conflicts: { platform_post_id: string; claimants: string[]; question: string }[];
  /** A pasted link that resolves to nothing yet. Retried on every run. */
  unmatched: { piece_id: string; live_link: string; why: string }[];
  /** A fetched post with no piece. Kept forever, never judged by pillar. */
  unplanned: string[];
  /** Suggestions only. Nothing here is written anywhere (§8). */
  suggestions: { piece_id: string; platform_post_id: string; why: string }[];
}

export interface JoinInput {
  posts: JoinablePost[];
  pieces: JoinablePiece[];
  /** `${id_kind}:${piece_id}` → platform_post_id, so a re-run writes nothing new. */
  existing?: Record<string, string>;
  now?: string;
  /** Offer a time-window suggestion when a posted piece and an unlinked post sit
   *  within this many hours of each other. A suggestion, never an attachment. */
  suggestWithinHours?: number;
}

export function resolvePostLinks(input: JoinInput): JoinResult {
  const now = input.now ?? new Date().toISOString();
  const out: JoinResult = { attach: [], conflicts: [], unmatched: [], unplanned: [], suggestions: [] };

  const byRef = new Map<string, JoinablePost>();
  for (const p of input.posts) {
    if (p.post_ref) byRef.set(`${p.platform.toLowerCase()}|${p.post_ref}`, p);
  }

  type Claim = { piece: JoinablePiece; post: JoinablePost; ref: string };
  const claims: Claim[] = [];

  for (const piece of input.pieces) {
    if (!piece.live_link) continue;
    const connector = connectorFor(piece.platform);
    const ref = connector?.extractPostRef(piece.live_link) ?? null;
    if (!ref) {
      out.unmatched.push({
        piece_id: piece.id, live_link: piece.live_link,
        why: connector
          ? 'the link does not resolve to a post reference on this platform'
          : `no connector for ${piece.platform} yet, so its links cannot be read`,
      });
      continue;
    }
    const post = byRef.get(`${piece.platform.toLowerCase()}|${ref}`);
    if (!post) {
      // Spec 03's case, kept: the link was pasted before the pipe fetched the
      // post. It stays unmatched and is retried on every run.
      out.unmatched.push({
        piece_id: piece.id, live_link: piece.live_link,
        why: 'the pipe has not fetched this post yet — retried on every run',
      });
      continue;
    }
    claims.push({ piece, post, ref });
  }

  const perPost = new Map<string, Claim[]>();
  for (const c of claims) {
    const list = perPost.get(c.post.platform_post_id) ?? [];
    list.push(c);
    perPost.set(c.post.platform_post_id, list);
  }

  for (const [postId, list] of perPost) {
    const distinct = [...new Set(list.map(c => `${c.piece.id_kind}:${c.piece.id}`))];
    if (distinct.length > 1) {
      out.conflicts.push({
        platform_post_id: postId, claimants: distinct,
        question: `Two pieces claim the same post (${distinct.join(' and ')}). ` +
          'Neither is attached until you say which one it is.',
      });
      continue;
    }
    const c = list[0];
    const key = `${c.piece.id_kind}:${c.piece.id}`;
    if (input.existing?.[key] === postId) continue;         // already joined
    out.attach.push({
      piece_id: c.piece.id, id_kind: c.piece.id_kind, profile_id: c.piece.profile_id,
      channel_id: c.post.channel_id, platform_post_id: postId, post_ref: c.ref,
      matched_at: now, match_method: 'url-ref', confirmed_by: null,
    });
  }

  const claimed = new Set([
    ...claims.map(c => c.post.platform_post_id),
    ...Object.values(input.existing ?? {}),
  ]);
  out.unplanned = input.posts.filter(p => !claimed.has(p.platform_post_id)).map(p => p.platform_post_id);

  // A posted piece with no link, beside an unclaimed post on the same channel
  // within a few hours. Offered, never attached, and never written.
  const within = input.suggestWithinHours ?? 0;
  if (within > 0) {
    for (const piece of input.pieces) {
      if (piece.live_link || !piece.posted_at) continue;
      for (const post of input.posts) {
        if (claimed.has(post.platform_post_id) || !post.published_at) continue;
        const hours = Math.abs(new Date(post.published_at).getTime() - new Date(piece.posted_at).getTime()) / 3600000;
        if (hours <= within) {
          out.suggestions.push({
            piece_id: piece.id, platform_post_id: post.platform_post_id,
            why: `posted within ${Math.round(hours)}h of each other — a suggestion only. ` +
              'Nothing attaches until you confirm it.',
          });
        }
      }
    }
  }

  return out;
}
