// The public preview deep link — spec 28 §10, building PLAN §11 Q2's answer:
//
//   "when she shares a link (e.g. on WhatsApp) with a client who HAS a binding,
//    the link should land them INSIDE the platform — their profile's review
//    window, from which they can browse their other windows — with the plain
//    public page as the no-login fallback."
//
// Five branches, resolved SERVER SIDE, in this order. The one rule underneath
// all of them: a response never reveals the binding state to anyone but the
// session holder. A session with no binding to that profile gets the plain
// public page — never an error, never a message that names the profile.

import type { AppState } from '@/types';
import type { Role } from '../access.ts';
import { allowedClientIds } from '../access.ts';
import { doorsOpenAt } from '../tree/objects.ts';
import { renderState } from '../tree/render.ts';
import { renderProfile, staysOnLegacy } from './profile.ts';

const REVIEW = 'work-log/creation/review';
const TOOLSET = 'context/content-strategy/toolset';

export type DeepLinkBranch =
  /** No preview with this share id. Today's not-found page, unchanged. */
  | { branch: 'not-found' }
  /** The plain public page, exactly as today. The fallback, and the common case. */
  | { branch: 'public' }
  /** `creation.review_public_link` is hidden: the URL serves NOTHING. */
  | { branch: 'revoked' }
  /** Into the profile at the piece. */
  | { branch: 'inside'; to: string };

/** Which profile a share id belongs to, and which piece — if either is knowable. */
export function resolveShare(
  state: AppState, shareId: string,
): { profileId: string; pieceId: string | null } | null {
  for (const [profileId, data] of Object.entries(state.clientData ?? {})) {
    for (const e of data.body?.paths?.[REVIEW] ?? []) {
      const d = (e.data ?? {}) as { share_id?: string; piece_id?: string | null };
      if (d.share_id === shareId) {
        return { profileId, pieceId: d.piece_id ?? null };
      }
    }
  }
  // A profile that has not migrated still owns its previews in the legacy slice.
  for (const [profileId, data] of Object.entries(state.clientData ?? {})) {
    if ((data.previewPosts ?? []).some(p => p.shareId === shareId)) {
      return { profileId, pieceId: null };
    }
  }
  return null;
}

/** Has she actually PICKED a position for this switch on this profile, and is
 *  it the one asked about? A `suggested` entry, or no entry at all, is not a
 *  decision — spec 22 §8.5, "a suggestion is not a setting", read here the way
 *  spec 26 §6.2 reads it for collection. */
function positionSetTo(
  state: AppState, profileId: string, switchId: string, want: 'on' | 'off',
): boolean {
  const entries = state.clientData?.[profileId]?.body?.paths?.[TOOLSET] ?? [];
  const entry = entries.find(e => e.id === switchId);
  if (!entry) return false;
  const d = (entry.data ?? {}) as { state?: string; suggested?: boolean };
  if (d.suggested === true) return false;
  return want === 'on' ? d.state === 'active' : d.state !== 'active';
}

export interface DeepLinkInput {
  state: AppState | null;
  shareId: string;
  /** Null when there is no session cookie at all. */
  role: Role | null;
  /** True when the share id resolves to a preview at all (branch 2). */
  previewExists: boolean;
}

export function resolveDeepLink(input: DeepLinkInput): DeepLinkBranch {
  const { state, shareId, role, previewExists } = input;

  // 2 — no preview found. Today's not-found page, unchanged.
  if (!previewExists) return { branch: 'not-found' };
  if (!state) return { branch: 'public' };

  const found = resolveShare(state, shareId);

  // The public-link switch, read on the profile the preview belongs to. At
  // `hidden` the URL serves nothing to an unauthenticated viewer: the link is
  // revoked, and revoked means gone. A bound client hitting the same URL still
  // deep-links below, because their access comes from their door, not the link.
  //
  // REVOKED MEANS SHE REVOKED IT. Spec 21 §9.6 and spec 26 §6.2's precedent: a
  // profile whose switchboard she has never walked behaves exactly as it did
  // before, because a suggestion is not a setting. Reading an UNSET switch as
  // "off" took every live preview link dark the day the shell shipped — hers
  // and every client's — which is the opposite of what the switch is for.
  const publicLinkOff = !!found
    && positionSetTo(state, found.profileId, 'creation.review_public_link', 'off')
    && renderState(renderProfile(state, found.profileId, 'owner'), 'creation.review_public_link', 'owner') !== 'active';

  // The fallback, once. Revoked means gone for everyone the link was the access
  // route FOR; it was never her access route, so it never takes the page from her.
  const fallback: DeepLinkBranch = publicLinkOff && role !== 'owner'
    ? { branch: 'revoked' }
    : { branch: 'public' };

  // 3 — no session cookie. The plain public page, exactly as today.
  if (!role) return fallback;

  // 5 — the preview has no resolvable piece. The plain public page, for everyone
  // including her. Legacy previews are exactly this case: which piece an old
  // preview belongs to is one of the questions spec 21's migration left for her,
  // and an unresolvable link degrades to what it already was.
  if (!found || !found.pieceId) return fallback;

  const profile = renderProfile(state, found.profileId, role);
  const to = `/profile/${found.profileId}/creation/board?piece=${encodeURIComponent(found.pieceId)}`;

  // 4a — the owner, into the profile at the piece.
  if (role === 'owner') return { branch: 'inside', to };

  // The honest off-switch: no redirect for anyone, the public page for everyone.
  // Checked after the owner branch because it governs the CLIENT's landing.
  // Unset stays unset here too: on a profile she has not walked, the client
  // simply gets the page they always got, which is the safe direction.
  if (!positionSetTo(state, found.profileId, 'creation.review_deeplink', 'on')
    || renderState(profile, 'creation.review_deeplink', 'client') !== 'active') {
    return fallback;
  }

  // 4b — a binding to that profile, with give:review granted by the lifecycle and
  // creation.review resolving active.
  const bound = allowedClientIds(state, role).includes(found.profileId);
  const kind = (state.bindings ?? []).find(b => b.role === role && b.profileId === found.profileId)?.kind;
  const hasDoor = doorsOpenAt(state.clients?.find(c => c.id === found.profileId)?.lifecycle)
    .includes('give:review');
  const reviewOn = renderState(profile, 'creation.review', 'client') === 'active';
  if (bound && hasDoor && reviewOn && !staysOnLegacy(role, kind)) return { branch: 'inside', to };

  // 4c — a session with no binding to that profile. The plain public page, with
  // no response difference that names the profile.
  return fallback;
}
