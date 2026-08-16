// Giving someone access without a deploy — 2026-08-11.
//
// HER QUESTION: "How can I not go through the route where I have to add
// passcodes for them every time, but still want to make sure that they get
// access to their own profiles with the selected settings and things I want
// them to see? I cannot register everyone's password every time."
//
// She could not, and the reason was structural rather than an oversight:
// `lib/auth.ts` maps five ROLES to five ENVIRONMENT VARIABLES. A person is a
// line of code and a server setting, so every new client cost a code change and
// a deploy. That ceiling had to go before the dashboard could hold her actual
// client list.
//
// So a person becomes DATA. She makes an invite, the app makes the code, and
// the invite carries which profiles it opens. Nothing else about access
// changes: an invite grants through the same BINDINGS every other login uses,
// and `windowsForBinding` in lib/access.ts remains the only authority on what a
// bound person actually sees. An invite decides WHO and WHICH PROFILES. The
// switches still decide WHAT.
//
// WHAT THIS FILE DELIBERATELY DOES NOT DO:
//   - It does not weaken the owner. Her passcode stays in the environment,
//     where a database read cannot reach it. An invite can never mint 'owner';
//     a test pins that.
//   - It does not store a password. A code is compared, never displayed as
//     something recoverable later; she can always issue a new one.
//
// Pure: ids, codes and `now` are injected. No clock, no crypto import, no React.

/** The role string an invite logs in as. Namespaced so it can never collide
 *  with the five environment roles, and so it is obvious in any record. */
export const GUEST_PREFIX = 'guest:';

export interface Invite {
  id: string;
  /** Who it is for, in her words. Shown on the settings screen. */
  name: string;
  /** What they type to get in. Compared, never hashed-and-forgotten, because
   *  she has to be able to read it back to send it to them again. */
  code: string;
  /** Which profiles this opens. Empty means it opens nothing, which is a valid
   *  state: an invite made before she has decided grants no access at all. */
  profileIds: string[];
  createdAt: string;
  /** Set when she takes it back. Kept, never deleted, so the record of who once
   *  had access survives (S9). */
  revokedAt?: string;
  lastUsedAt?: string;
}

export function roleForInvite(invite: Invite): string {
  return `${GUEST_PREFIX}${invite.id}`;
}

export function isGuestRole(role: string): boolean {
  return role.startsWith(GUEST_PREFIX);
}

export function inviteIdOf(role: string): string | null {
  return isGuestRole(role) ? role.slice(GUEST_PREFIX.length) : null;
}

/** Live means: issued, and not taken back. */
export function isLive(invite: Invite): boolean {
  return !invite.revokedAt;
}

/**
 * The code, built from injected randomness so this file stays pure.
 *
 * Deliberately readable over a phone call: no O/0, no I/1/l, and grouped in
 * fours. She will be reading these out to clients, and a code nobody can dictate
 * is a code she will paste into WhatsApp in plain text instead.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function codeFrom(randomBytes: number[], groups = 3): string {
  const chars = randomBytes.map(b => ALPHABET[b % ALPHABET.length]);
  const out: string[] = [];
  for (let g = 0; g < groups; g++) out.push(chars.slice(g * 4, g * 4 + 4).join(''));
  return out.join('-');
}

export interface NewInviteInput {
  id: string;
  name: string;
  code: string;
  profileIds: string[];
  now: string;
}

export function makeInvite(input: NewInviteInput): Invite {
  const name = input.name.trim();
  if (!name) throw new Error('[invite] an invite needs a name, so she knows who it is for');
  if (!input.code.trim()) throw new Error('[invite] an invite needs a code');
  return {
    id: input.id,
    name,
    code: input.code.trim(),
    profileIds: [...new Set(input.profileIds)],
    createdAt: input.now,
  };
}

/**
 * Match a typed code to a live invite.
 *
 * Case and stray spaces are forgiven because a person is typing this off a
 * message on a phone. The dashes are optional for the same reason.
 */
export function findByCode(invites: Invite[], typed: string): Invite | null {
  const want = normalize(typed);
  if (!want) return null;
  for (const invite of invites) {
    if (!isLive(invite)) continue;
    if (normalize(invite.code) === want) return invite;
  }
  return null;
}

function normalize(code: string): string {
  return code.replace(/[\s-]/g, '').toUpperCase();
}

export function revoke(invites: Invite[], id: string, now: string): Invite[] {
  return invites.map(i => (i.id === id && !i.revokedAt ? { ...i, revokedAt: now } : i));
}

export function markUsed(invites: Invite[], id: string, now: string): Invite[] {
  return invites.map(i => (i.id === id ? { ...i, lastUsedAt: now } : i));
}

/**
 * The bindings an invite implies, which is how it actually grants anything.
 *
 * `kind: 'client'` is the important part: it is what makes lifecycle and the
 * client-door rules apply. An invite is never staff and never delegated, so it
 * can never reach a screen a client cannot reach.
 */
export function bindingsFor(invite: Invite): { role: string; profileId: string; kind: 'client'; createdAt: string }[] {
  return invite.profileIds.map(profileId => ({
    role: roleForInvite(invite),
    profileId,
    kind: 'client' as const,
    createdAt: invite.createdAt,
  }));
}

/** The line under an invite on the settings screen. */
export function inviteLine(invite: Invite, nameOf: (id: string) => string): string {
  if (invite.revokedAt) return 'Taken back. They can no longer get in.';
  if (invite.profileIds.length === 0) return 'Opens nothing yet. Pick a profile below.';
  const names = invite.profileIds.map(nameOf).filter(Boolean);
  const opens = names.length === 1
    ? names[0]
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return invite.lastUsedAt ? `Opens ${opens}. Has logged in.` : `Opens ${opens}. Not used yet.`;
}
