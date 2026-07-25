// The client-NAME regexes, kept in exactly ONE place and used for exactly ONE
// purpose: seeding profile bindings the first time a saved state is normalized.
//
// Spec 21 §6 deletes name matching from access. Renaming a profile used to
// silently open or cut off a login; from now on a login carries explicit
// profile IDs. But nobody may lose access on the day this ships, so the old
// rules run once to write the bindings that already existed in practice — and
// after that, names never decide anything again.
//
// Nothing else in the app may import this file.

import type { Client, ProfileBinding } from '../../types/index.ts';

const LEGACY_MATCHERS: Record<string, (name: string) => boolean> = {
  intern: (n) => /divine/i.test(n) || /resume/i.test(n),
  sonia: (n) => /sonia/i.test(n) || /crochet/i.test(n),
  shiva: (n) => /shiva/i.test(n),
  merushri: (n) => /career|bubble/i.test(n),
};

export const LEGACY_BOUND_ROLES = Object.keys(LEGACY_MATCHERS);

/** One-time: the bindings that the name rules were granting the day this shipped. */
export function deriveLegacyBindings(clients: Client[], now = new Date().toISOString()): ProfileBinding[] {
  const out: ProfileBinding[] = [];
  for (const role of LEGACY_BOUND_ROLES) {
    for (const c of clients) {
      if (LEGACY_MATCHERS[role](c.name ?? '')) {
        out.push({ role, profileId: c.id, kind: role === 'intern' ? 'staff' : 'client', createdAt: now });
      }
    }
  }
  return out;
}
