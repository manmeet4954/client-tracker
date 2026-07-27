// The route map — spec 28 §11, made machine-readable.
//
// Every route alive in the app appears here exactly once, with its fate. A route
// with no fate fails the build (§17.13 — the orphan check, applied to routes).
//
// Fate vocabulary is spec 21 §8's:
//   active    kept, re-addressed
//   moved     the screen moves; the old address redirects once the profile cuts over
//   redirect  the address itself becomes a redirect
//   removed   the address goes; its data does not (S9)
//   split     one screen becomes two or three
//   frozen    retained, read-only, not re-pointed
//   leaves    PLAN §7 — exits the dashboard, exported to the vault first
//   untouched not this spec's business

export type RouteFate =
  | 'active' | 'moved' | 'redirect' | 'removed' | 'split' | 'frozen' | 'leaves' | 'untouched';

export interface RouteRecord {
  /** The file, relative to `dashboard/`. One record per file. */
  file: string;
  fate: RouteFate;
  /** Where it goes. `<id>` stands for the profile id. */
  to?: string;
  note?: string;
}

export const ROUTE_MAP: RouteRecord[] = [
  // ── 11.1 Entry and the shelf ───────────────────────────────────────────────
  { file: 'app/layout.tsx', fate: 'active', note: 'The root layout. The chat stays mounted here, above every route, exactly as today (§9).' },
  { file: 'app/page.tsx', fate: 'active', to: '/shelf', note: 'After auth: owner to the shelf; a client with one live binding into their profile; two or more to the mini-shelf.' },
  { file: 'app/shelf/page.tsx', fate: 'active', note: 'The shelf (§4). Her login lands here.' },
  { file: 'app/clients/page.tsx', fate: 'redirect', to: '/shelf', note: 'Becomes the shelf. Permanently redirects.' },
  { file: 'app/me/page.tsx', fate: 'split', to: '/shelf', note: 'The client-task and content-task halves move to the today strip (§4.3). The personal half LEAVES (PLAN §7) — exported first, removed only on her word, and not before (§16.6). It keeps rendering until then.' },
  { file: 'app/share-target/page.tsx', fate: 'active', note: 'Android share-to-save, unchanged. After cutover it writes into the chosen profile’s assets/sets.' },

  // ── 11.2 Inside a profile — the new addresses ──────────────────────────────
  { file: 'app/profile/[id]/layout.tsx', fate: 'active', note: 'The three-app frame (§5.1). Replaces the nine-tab bar.' },
  { file: 'app/profile/[id]/page.tsx', fate: 'active', note: 'Redirects to the first rendering app (§5.1).' },
  { file: 'app/profile/[id]/intake/page.tsx', fate: 'active' },
  { file: 'app/profile/[id]/creation/page.tsx', fate: 'active', note: 'Redirects to the first rendering sub-tab.' },
  { file: 'app/profile/[id]/creation/[tab]/page.tsx', fate: 'active', note: 'Engine · Board · Assets · References · Logs.' },
  { file: 'app/profile/[id]/analysis/page.tsx', fate: 'active', note: 'Redirects to Now.' },
  { file: 'app/profile/[id]/analysis/[tab]/page.tsx', fate: 'active', note: 'Spec 27’s eight tabs.' },
  { file: 'app/profile/[id]/strategy/page.tsx', fate: 'active', note: 'The owner corner.' },
  { file: 'app/profile/[id]/strategy/[panel]/page.tsx', fate: 'active', note: 'Derivation · gates · switches · channels · brand · intake history · lifecycle.' },

  // ── 11.2 Inside a profile — the legacy addresses ───────────────────────────
  // Every one keeps rendering, unchanged, until THAT profile cuts over (§16.1).
  { file: 'app/client/[id]/layout.tsx', fate: 'removed', to: '/profile/<id>', note: 'The nine-tab bar, replaced by the three-app frame. It also carries the per-profile cutover redirect while both shells coexist.' },
  { file: 'app/client/[id]/page.tsx', fate: 'moved', to: '/profile/<id>/creation/logs' },
  { file: 'app/client/[id]/content/page.tsx', fate: 'moved', to: '/profile/<id>/creation/board' },
  { file: 'app/client/[id]/kanban/page.tsx', fate: 'removed', to: '/profile/<id>/creation/board', note: 'Already a legacy redirect into content; content redirects onward after cutover.' },
  { file: 'app/client/[id]/pillars/page.tsx', fate: 'removed', to: '/profile/<id>/creation/board', note: 'Same.' },
  { file: 'app/client/[id]/evergreen/page.tsx', fate: 'removed', to: '/profile/<id>/creation/engine', note: 'Its entries migrated as seed-capture input (spec 23 §4.3).' },
  { file: 'app/client/[id]/studio/page.tsx', fate: 'removed', to: '/profile/<id>/creation/assets', note: 'Tab already retired; the frozen data stays and no route survives.' },
  { file: 'app/client/[id]/journey/page.tsx', fate: 'split', to: '/profile/<id>/analysis/goals', note: 'Goals to Analysis, mix bars to the Scorecard, momentum and money to Creation → Logs (her profiles only).' },
  { file: 'app/client/[id]/analytics/page.tsx', fate: 'moved', to: '/profile/<id>/analysis' },
  { file: 'app/client/[id]/lists/page.tsx', fate: 'moved', to: '/profile/<id>/creation/logs' },
  { file: 'app/client/[id]/coldcalls/page.tsx', fate: 'moved', to: '/profile/<id>/creation/logs' },
  { file: 'app/client/[id]/orders/page.tsx', fate: 'moved', to: '/profile/<id>/creation/logs' },
  { file: 'app/client/[id]/catalogue/page.tsx', fate: 'moved', to: '/profile/<id>/creation/assets' },
  { file: 'app/client/[id]/assets/page.tsx', fate: 'moved', to: '/profile/<id>/creation/assets' },
  { file: 'app/client/[id]/references/page.tsx', fate: 'moved', to: '/profile/<id>/creation/references' },
  { file: 'app/client/[id]/brand/page.tsx', fate: 'moved', to: '/profile/<id>/strategy/brand' },
  { file: 'app/client/[id]/previews/page.tsx', fate: 'moved', to: '/profile/<id>/creation/board' },
  { file: 'app/client/[id]/onboarding/page.tsx', fate: 'moved', to: '/profile/<id>/intake' },
  { file: 'app/client/[id]/answers/page.tsx', fate: 'moved', to: '/profile/<id>/creation/board' },
  { file: 'app/client/[id]/intake/page.tsx', fate: 'moved', to: '/profile/<id>/intake' },
  { file: 'app/client/[id]/curation/page.tsx', fate: 'moved', to: '/profile/<id>/intake' },
  { file: 'app/client/[id]/strategy/page.tsx', fate: 'moved', to: '/profile/<id>/strategy' },
  { file: 'app/client/[id]/engine/page.tsx', fate: 'moved', to: '/profile/<id>/creation/engine' },
  { file: 'app/client/[id]/engine/costume/[seedId]/page.tsx', fate: 'moved', to: '/profile/<id>/creation/engine' },

  // ── 11.3 Owner-level and public routes ─────────────────────────────────────
  { file: 'app/p/[shareId]/page.tsx', fate: 'active', note: 'Enhanced by §10’s five-branch resolution. The public page itself is unchanged.' },
  { file: 'app/connections/page.tsx', fate: 'moved', to: '/profile/<id>/strategy/channels', note: 'A channel belongs to a profile (S17). It keeps rendering while any profile is pre-cutover — it is the only place a token can be entered for one — and its redirect to /shelf lands with the last cutover (§16.5).' },
  { file: 'app/observations/page.tsx', fate: 'frozen', note: 'Unchanged while any profile is pre-cutover; narrowed to the untagged inbox afterwards (§9, §16.5).' },
  { file: 'app/brain/page.tsx', fate: 'leaves', note: 'PLAN §7. Exported to the vault, then removed only on her word — §16.6 runs once, at the end, and has not run.' },
  { file: 'app/map/page.tsx', fate: 'leaves', note: 'Same.' },
];

const BY_FILE = new Map(ROUTE_MAP.map(r => [r.file, r]));

export function routeFate(file: string): RouteRecord | null {
  return BY_FILE.get(file) ?? null;
}

/**
 * §11.2 — where a legacy address goes once ITS profile has cut over. Returns
 * null when the address has no new home, in which case nothing redirects.
 */
export function legacyDestination(pathname: string, profileId: string): string | null {
  const m = pathname.match(/^\/client\/[^/]+(\/.*)?$/);
  if (!m) return null;
  const tail = (m[1] ?? '').replace(/\/$/, '');
  const file = tail
    ? `app/client/[id]${tail.replace(/^\/engine\/costume\/[^/]+$/, '/engine/costume/[seedId]')}/page.tsx`
    : 'app/client/[id]/page.tsx';
  const rec = BY_FILE.get(file);
  if (!rec?.to) return null;
  return rec.to.replace('<id>', profileId);
}
