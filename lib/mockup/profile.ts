// Spec 35 — the profile mockup's record and all of its logic.
//
// No React in this file, no fetch, no clock of its own. Every rule the screen
// obeys lives here so it can be tested without a browser
// (tests/mockup.test.ts), and so no second copy of a rule can drift.
//
// Three things this file is careful about:
//
// 1. THE ADDRESS IS THE ONE ALREADY DECLARED. `context/content-strategy/
//    profile-mockup`, entry type `profile_mockup`, fed by `owner`, history
//    `versioned`. Nothing here declares a path, a switch or a state slice.
// 2. WHAT IS FURNITURE STAYS FURNITURE. The counts, the "followed by" line, the
//    four controls, the tabs and the top icons are constants in this file. They
//    have no setter, so no screen can accidentally make one editable.
// 3. THE STORY RING IS NOT A FIELD. It is not in the record at all, which is
//    the strongest form of "it never changes and can never be removed".

import { putEntry, readPath } from '../tree/body.ts';
import type { ProfileBody } from '../tree/body.ts';

export const MOCKUP_PATH = 'context/content-strategy/profile-mockup';
export const MOCKUP_ENTRY_TYPE = 'profile_mockup';

/** Six tiles, three across, exactly as the screenshot (§4). */
export const TILE_COUNT = 6;
/** Five highlight covers, exactly as the screenshot (§3). */
export const HIGHLIGHT_COUNT = 5;
/** Up to three pins, and the fourth is refused (§4). */
export const MAX_PINS = 3;
/** Width over height. Instagram's profile grid, and the screenshot's. */
export const TILE_RATIO = 4 / 5;

export const TOO_MANY_PINS = 'You can pin three posts. Unpin one first.';

// ── The record ───────────────────────────────────────────────────────────────

export type MockupTheme = 'dark' | 'light';

export interface MockupHighlight {
  id: string;
  label: string;
  imageUrl: string;
}

export interface MockupTile {
  id: string;
  imageUrl: string;
  pinned: boolean;
}

/**
 * One mockup. §5: each carries a name and a date, because she builds one at
 * onboarding and another later, and comparing the two is the point.
 */
export interface ProfileMockupRecord {
  id: string;
  /** Her name for this one. Only she sees it; it is not drawn on the phone. */
  name: string;
  /** The date this mockup is for, `YYYY-MM-DD`. Also only hers. */
  date: string;
  /** The public link's secret, reusing the `/p/[shareId]` machinery. */
  shareId: string;

  // Everything below is drawn on the phone, and every one of them edits.
  /**
   * Which Instagram she is showing them. Both are real: plenty of people run
   * their phone in light mode, and a mockup in the wrong one does not look
   * like their phone. It belongs to the MOCKUP rather than to the app's own
   * theme, because it is a property of the thing she is presenting.
   */
  theme: MockupTheme;

  username: string;
  fullName: string;
  bio: string;
  link: string;
  avatarUrl: string;
  highlights: MockupHighlight[];
  tiles: MockupTile[];

  createdAt: string;
  updatedAt: string;
}

// ── Furniture (§3, §6) ───────────────────────────────────────────────────────
//
// Drawn, never claimed, never editable, never read by anything downstream. It
// exists so the mockup reads as Instagram rather than as a diagram of
// Instagram. Every value is in this one object: if she ever wants the counts to
// read differently, it is one edit here and nowhere else.

export const FURNITURE = {
  /** §3: the format stays, the numbers are furniture. There is no setter. */
  stats: [
    { value: '154', label: 'posts' },
    { value: '1,492', label: 'followers' },
    { value: '145', label: 'following' },
  ],
  /** §3: kept as drawn. Removing it makes the mockup less convincing. */
  followedBy: {
    names: ['rohit3a', 'merushribaboota'],
    others: 2,
  },
  /** §3: chrome, exactly as drawn. */
  controls: ['Following', 'Message', 'Contact'],
} as const;

// ── Making one ───────────────────────────────────────────────────────────────

/** Child ids are positional and stable, so a copy keeps its own shape. */
export function highlightId(index: number): string {
  return `h${index + 1}`;
}

export function tileId(index: number): string {
  return `t${index + 1}`;
}

export interface NewMockupInput {
  /** Dark unless she says otherwise, which is what her own phone shows. */
  theme?: MockupTheme;
  id: string;
  shareId: string;
  name: string;
  /** `YYYY-MM-DD`. Passed in, never read off a clock in here. */
  date: string;
  now: string;
}

/**
 * A blank mockup: every slot present, every slot empty. It starts empty on
 * purpose. Placeholder prose in a client deliverable is worse than a blank she
 * has to fill, and §2 forbids guidance copy drawn on top of the phone.
 */
export function newMockup(input: NewMockupInput): ProfileMockupRecord {
  return {
    id: input.id,
    name: input.name,
    date: input.date,
    shareId: input.shareId,
    theme: input.theme ?? 'dark',
    username: '',
    fullName: '',
    bio: '',
    link: '',
    avatarUrl: '',
    highlights: Array.from({ length: HIGHLIGHT_COUNT }, (_, i) => ({
      id: highlightId(i), label: '', imageUrl: '',
    })),
    tiles: Array.from({ length: TILE_COUNT }, (_, i) => ({
      id: tileId(i), imageUrl: '', pinned: false,
    })),
    createdAt: input.now,
    updatedAt: input.now,
  };
}

/**
 * What comes back out of storage, made safe to render: exactly six tiles and
 * exactly five highlights, no more pins than the cap allows, every string a
 * string. An older or hand-edited record can never crash the screen.
 */
export function normalizeMockup(raw: Partial<ProfileMockupRecord> | null | undefined): ProfileMockupRecord {
  const r = raw ?? {};
  const highlights: MockupHighlight[] = Array.from({ length: HIGHLIGHT_COUNT }, (_, i) => {
    const h = r.highlights?.[i];
    return { id: h?.id || highlightId(i), label: str(h?.label), imageUrl: str(h?.imageUrl) };
  });

  let pins = 0;
  const tiles: MockupTile[] = Array.from({ length: TILE_COUNT }, (_, i) => {
    const t = r.tiles?.[i];
    const wants = t?.pinned === true;
    const pinned = wants && pins < MAX_PINS;
    if (pinned) pins++;
    return { id: t?.id || tileId(i), imageUrl: str(t?.imageUrl), pinned };
  });

  return {
    id: str(r.id),
    name: str(r.name),
    // Dark is the default because it is what her own screenshot shows, and
    // because a mockup made before this existed was drawn dark.
    theme: r.theme === 'light' ? 'light' : 'dark',
    date: str(r.date),
    shareId: str(r.shareId),
    username: str(r.username),
    fullName: str(r.fullName),
    bio: str(r.bio),
    link: str(r.link),
    avatarUrl: str(r.avatarUrl),
    highlights,
    tiles,
    createdAt: str(r.createdAt),
    updatedAt: str(r.updatedAt),
  };
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

// ── Editing (§3's Yes column, and only that column) ──────────────────────────

/** The fields a person may type into. Nothing outside this list has a setter. */
export type EditableField = 'username' | 'fullName' | 'bio' | 'link';

export function setField(
  m: ProfileMockupRecord, field: EditableField, value: string, now: string,
): ProfileMockupRecord {
  return { ...m, [field]: value, updatedAt: now };
}

export function setAvatar(m: ProfileMockupRecord, url: string, now: string): ProfileMockupRecord {
  return { ...m, avatarUrl: url, updatedAt: now };
}

/** Dark or light. Nothing else about the mockup changes with it. */
export function setTheme(m: ProfileMockupRecord, theme: MockupTheme, now: string): ProfileMockupRecord {
  return { ...m, theme, updatedAt: now };
}

/**
 * The two palettes, taken from Instagram itself rather than invented.
 *
 * One object, so a colour can never be half-changed: every value the phone
 * draws with comes from here, and adding a third theme would be adding a third
 * entry and nothing else.
 */
export const THEMES: Record<MockupTheme, {
  bg: string; text: string; muted: string; faint: string; link: string;
  button: string; buttonText: string; border: string; empty: string; tabIdle: string;
}> = {
  dark: {
    bg: '#000', text: '#fff', muted: 'rgba(255,255,255,.9)', faint: 'rgba(255,255,255,.7)',
    link: '#a8b3cf', button: '#262626', buttonText: '#fff', border: '#262626',
    empty: '#262626', tabIdle: '#8e8e8e',
  },
  light: {
    bg: '#fff', text: '#000', muted: '#000', faint: '#737373',
    link: '#00376b', button: '#efefef', buttonText: '#000', border: '#dbdbdb',
    empty: '#efefef', tabIdle: '#8e8e8e',
  },
};

export function setHighlightLabel(
  m: ProfileMockupRecord, id: string, label: string, now: string,
): ProfileMockupRecord {
  return {
    ...m,
    highlights: m.highlights.map(h => (h.id === id ? { ...h, label } : h)),
    updatedAt: now,
  };
}

export function setHighlightImage(
  m: ProfileMockupRecord, id: string, url: string, now: string,
): ProfileMockupRecord {
  return {
    ...m,
    highlights: m.highlights.map(h => (h.id === id ? { ...h, imageUrl: url } : h)),
    updatedAt: now,
  };
}

export function setTileImage(
  m: ProfileMockupRecord, id: string, url: string, now: string,
): ProfileMockupRecord {
  return {
    ...m,
    tiles: m.tiles.map(t => (t.id === id ? { ...t, imageUrl: url } : t)),
    updatedAt: now,
  };
}

/** The mockup's own name and date. Hers, not drawn on the phone. */
export function rename(
  m: ProfileMockupRecord, name: string, date: string, now: string,
): ProfileMockupRecord {
  return { ...m, name, date, updatedAt: now };
}

// ── Pins (§4) ────────────────────────────────────────────────────────────────

export function pinnedCount(m: ProfileMockupRecord): number {
  return m.tiles.filter(t => t.pinned).length;
}

export function isPinned(m: ProfileMockupRecord, id: string): boolean {
  return m.tiles.some(t => t.id === id && t.pinned);
}

export interface PinResult {
  mockup: ProfileMockupRecord;
  /** One plain line when the fourth pin is refused. Null when it worked. */
  error: string | null;
}

/**
 * Pin, unpin, or refuse. The fourth pin is refused with one plain line and the
 * record comes back untouched, so nothing half-happens.
 */
export function togglePin(m: ProfileMockupRecord, id: string, now: string): PinResult {
  const tile = m.tiles.find(t => t.id === id);
  if (!tile) return { mockup: m, error: null };
  if (!tile.pinned && pinnedCount(m) >= MAX_PINS) {
    return { mockup: m, error: TOO_MANY_PINS };
  }
  return {
    mockup: {
      ...m,
      tiles: m.tiles.map(t => (t.id === id ? { ...t, pinned: !t.pinned } : t)),
      updatedAt: now,
    },
    error: null,
  };
}

/**
 * The order the grid actually draws in: pinned first, in the order they sit in
 * the record, then everything else. This is what Instagram does, and it is why
 * the screenshot's pins are the first three tiles.
 */
export function orderedTiles(m: ProfileMockupRecord): MockupTile[] {
  return [...m.tiles.filter(t => t.pinned), ...m.tiles.filter(t => !t.pinned)];
}

// ── Copying (§5) ─────────────────────────────────────────────────────────────

export interface CopyInput {
  id: string;
  shareId: string;
  name: string;
  date: string;
  now: string;
}

/**
 * A duplicate she can edit, leaving the original completely alone. Every array
 * and every object inside is rebuilt, so editing the copy can never reach back
 * into the one it came from. That is what makes before-and-after possible.
 */
export function copyMockup(m: ProfileMockupRecord, input: CopyInput): ProfileMockupRecord {
  return {
    ...m,
    id: input.id,
    shareId: input.shareId,
    name: input.name,
    date: input.date,
    highlights: m.highlights.map(h => ({ ...h })),
    tiles: m.tiles.map(t => ({ ...t })),
    createdAt: input.now,
    updatedAt: input.now,
  };
}

/** The default name for a copy, so she is never handed two identical rows. */
export function copyName(name: string): string {
  const base = name.trim() || 'Profile mockup';
  return `${base} copy`;
}

// ── The crop maths (§4) ──────────────────────────────────────────────────────

export interface CropRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/**
 * The part of a source image a 4:5 tile shows: the largest centred rectangle of
 * the target ratio that fits inside it. A landscape photo loses its sides, a
 * tall photo loses its top and bottom, and nothing is ever stretched.
 */
export function centreCropRect(width: number, height: number, ratio = TILE_RATIO): CropRect {
  if (!(width > 0) || !(height > 0)) return { sx: 0, sy: 0, sw: 0, sh: 0 };
  const source = width / height;
  if (source > ratio) {
    const sw = height * ratio;
    return { sx: (width - sw) / 2, sy: 0, sw, sh: height };
  }
  const sh = width / ratio;
  return { sx: 0, sy: (height - sh) / 2, sw: width, sh };
}

export interface CoverBox {
  /** Percentages of the tile box. Never below 100, which is the no-stretch rule. */
  width: number;
  height: number;
  left: number;
  top: number;
}

/**
 * The same crop, expressed as the box the image is drawn in: a percentage size
 * and a percentage offset inside a tile of the target ratio. This is what the
 * grid actually applies, so the maths that is tested is the maths that runs.
 */
export function coverBox(width: number, height: number, ratio = TILE_RATIO): CoverBox {
  if (!(width > 0) || !(height > 0)) return { width: 100, height: 100, left: 0, top: 0 };
  const source = width / height;
  if (source > ratio) {
    const w = (source / ratio) * 100;
    return { width: w, height: 100, left: (100 - w) / 2, top: 0 };
  }
  const h = (ratio / source) * 100;
  return { width: 100, height: h, left: 0, top: (100 - h) / 2 };
}

// ── Reading and writing the body ─────────────────────────────────────────────

/** Every mockup on this profile, newest first. History is left out by default. */
export function readMockups(
  body: ProfileBody, opts: { includeHistory?: boolean } = {},
): ProfileMockupRecord[] {
  return readPath<Partial<ProfileMockupRecord>>(body, MOCKUP_PATH)
    .filter(e => (opts.includeHistory ? true : e.state !== 'history'))
    .map(e => normalizeMockup({ ...e.data, id: e.data?.id || e.id }))
    .sort((a, b) => (b.date || b.createdAt).localeCompare(a.date || a.createdAt));
}

export function findMockup(body: ProfileBody, id: string): ProfileMockupRecord | null {
  return readMockups(body, { includeHistory: true }).find(m => m.id === id) ?? null;
}

/** The mockup a public link resolves to, or null. Nothing at history resolves. */
export function findMockupByShareId(body: ProfileBody, shareId: string): ProfileMockupRecord | null {
  if (!shareId) return null;
  return readMockups(body).find(m => m.shareId === shareId) ?? null;
}

/** Put one at its declared address. `owner` is the only declared writer. */
export function writeMockup(
  body: ProfileBody, m: ProfileMockupRecord, now: string,
): ProfileBody {
  return putEntry(body, MOCKUP_PATH, {
    id: m.id,
    type: MOCKUP_ENTRY_TYPE,
    data: { ...m, updatedAt: now } as unknown as Record<string, unknown>,
  }, { writer: 'owner', now });
}

/**
 * S9: turning one off never deletes it. It moves to `history`, where it stops
 * resolving for a share link and stops appearing in her list, and stays
 * readable forever.
 */
export function archiveMockup(body: ProfileBody, id: string, now: string): ProfileBody {
  const m = findMockup(body, id);
  if (!m) return body;
  return putEntry(body, MOCKUP_PATH, {
    id: m.id,
    type: MOCKUP_ENTRY_TYPE,
    data: m as unknown as Record<string, unknown>,
    state: 'history',
  }, { writer: 'owner', now });
}

// ── Small readable lines for her list ────────────────────────────────────────

/** "Onboarding · 8 Aug 2026". Never drawn on the phone itself. */
export function mockupLine(m: ProfileMockupRecord): string {
  const name = m.name.trim() || 'Untitled mockup';
  const date = prettyDate(m.date || m.createdAt.slice(0, 10));
  return date ? `${name} · ${date}` : name;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function prettyDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return '';
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return '';
  return `${Number(m[3])} ${month} ${m[1]}`;
}

/** What the link row shows: Instagram drops the scheme and any trailing slash. */
export function displayLink(link: string): string {
  return link.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}
