// Creation → Assets and Creation → References — the pure logic.
//
// Both screens live in this one file because they share the same two problems:
// turning a raw array into rows, and writing the line above those rows. The
// handoff calls the second one out as a rule, not a preference:
//
//   "Every count shown in copy is derived from the array it describes. No
//    headline states a number that is not counted from the same data at render
//    time — this was a recurring bug and should be treated as a rule."
//
// So nothing here takes a count as an argument. Every function that returns
// English counts the array it was handed. The screens hold no numbers of their
// own.
//
// Relative, extensioned imports and TYPE-ONLY imports of `@/types`: this module
// runs under plain Node in `tests/creation.assets.test.ts`, where the `@/` alias
// does not exist. A type-only import is stripped before Node ever sees it.

import type { AssetItem, AssetSet, CatalogueCategory, CatalogueItem, Reference } from '@/types';

// ── Small shared helpers ─────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "28 Jul", the prototype's date column. Empty string when there is no date. */
export function shortDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** The host of a URL, without www. Empty string when the text is not a URL. */
export function hostOf(text: string | undefined): string {
  const m = /^https?:\/\/([^/?#\s]+)/i.exec((text ?? '').trim());
  if (!m) return '';
  return m[1].replace(/^www\./i, '').toLowerCase();
}

/** Bytes as she would read them. Empty string for zero, because zero is a lie. */
export function fileSize(bytes: number | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Assets ───────────────────────────────────────────────────────────────────
//
// A set's KIND label is derived from who put the photos in it, never typed by
// anyone. `uploadedBy` carries the role that uploaded the item, so the label is
// a fact the system already holds — asking her to tag a set "from the client"
// would be asking twice.

/** The roles that are her side of the work. Everything else is the client. */
export const OUR_SIDE = ['owner', 'intern'];

export type SetSource = 'none' | 'hers' | 'client' | 'both';

export function setSource(items: { uploadedBy?: string }[]): SetSource {
  let hers = false;
  let client = false;
  for (const item of items) {
    if (OUR_SIDE.includes(item.uploadedBy ?? 'owner')) hers = true;
    else client = true;
  }
  if (hers && client) return 'both';
  if (hers) return 'hers';
  if (client) return 'client';
  return 'none';
}

/** The uppercase label on the 4:3 tile.
 *
 *  'From her' came OFF on 2026-08-11, at her request. Her own uploads are the
 *  default case and labelling the default is noise; provenance only earns the
 *  pixels when the material came from the client, which is the fact she has to
 *  respect when using it. An empty label renders nothing. */
export function setKind(items: { uploadedBy?: string }[]): string {
  switch (setSource(items)) {
    case 'hers': return '';
    case 'client': return 'From the client';
    case 'both': return 'From the client and you';
    default: return 'New set';
  }
}

/** The 12px meta line. Originals are always kept, so that is what it counts. */
export function setMeta(items: unknown[]): string {
  const n = items.length;
  if (n === 0) return 'nothing in here yet';
  return `${n} original${n === 1 ? '' : 's'} kept`;
}

export interface AssetTile {
  id: string;
  name: string;
  /** Uppercased by the screen. Held here in sentence case so it reads in tests. */
  kind: string;
  meta: string;
  count: number;
  /** The first item's thumbnail, or '' when the set is empty. */
  previewUrl: string;
  /** Set only on the Drive tile: the videos never live in the dashboard. */
  externalUrl?: string;
}

/** One tile per set, in the order the sets are held. */
export function assetTiles(sets: AssetSet[], items: AssetItem[]): AssetTile[] {
  return (sets ?? []).map(set => {
    const mine = (items ?? []).filter(i => i.setId === set.id);
    return {
      id: set.id,
      name: set.name,
      kind: setKind(mine),
      meta: setMeta(mine),
      count: mine.length,
      previewUrl: mine[0]?.thumbUrl || mine[0]?.url || '',
    };
  });
}

/**
 * The Videos tile, which is a door and not a set. Null when no Drive folder is
 * linked: off means absent, so there is no "no video folder linked yet" tile
 * sitting in the grid saying nothing.
 */
export function driveTile(url: string | undefined): AssetTile | null {
  const href = (url ?? '').trim();
  if (!href) return null;
  return {
    id: 'drive',
    name: 'Videos',
    kind: 'Video',
    meta: 'opens in Drive',
    count: 0,
    previewUrl: '',
    externalUrl: href,
  };
}

/** The line under the title. Both numbers counted here, from these arrays. */
export function assetsLine(
  sets: AssetSet[], items: AssetItem[], driveUrl: string | undefined,
): string {
  const ids = new Set((sets ?? []).map(s => s.id));
  const kept = (items ?? []).filter(i => ids.has(i.setId)).length;
  const s = (sets ?? []).length;
  const parts: string[] = [];
  parts.push(
    s === 0
      ? 'No sets yet.'
      : `${s} set${s === 1 ? '' : 's'}, ${kept} original${kept === 1 ? '' : 's'} kept.`,
  );
  if ((driveUrl ?? '').trim()) parts.push('Videos live in Drive.');
  return parts.join(' ');
}

/** How many photos are in one set. Counted, never stored. */
export function itemsInSet(items: AssetItem[], setId: string): AssetItem[] {
  return (items ?? []).filter(i => i.setId === setId);
}

/** The line inside an opened set. */
export function setLine(items: unknown[]): string {
  const n = items.length;
  if (n === 0) return 'Nothing in here yet.';
  return `${n} photo${n === 1 ? '' : 's'}, originals kept at full quality.`;
}

/**
 * Does the catalogue mode exist for this profile?
 *
 * The catalogue is a MODE of Assets, not a screen, and a profile that does not
 * sell products never sees the toggle at all. Derived from the data rather than
 * from a name: a profile with a catalogue has catalogue rows.
 */
export function hasCatalogue(
  categories: CatalogueCategory[] | undefined, items: CatalogueItem[] | undefined,
): boolean {
  return (categories?.length ?? 0) > 0 || (items?.length ?? 0) > 0;
}

export interface AssetMode { id: 'sets' | 'catalogue'; label: string }

/** No catalogue means no toggle. Not a disabled pill — no pill. */
export function assetModes(catalogue: boolean): AssetMode[] {
  if (!catalogue) return [];
  return [{ id: 'sets', label: 'Sets' }, { id: 'catalogue', label: 'Catalogue' }];
}

/** The mode actually shown, so a stale 'catalogue' cannot survive the switch. */
export function resolveMode(catalogue: boolean, wanted: string): 'sets' | 'catalogue' {
  return catalogue && wanted === 'catalogue' ? 'catalogue' : 'sets';
}

// ── References ───────────────────────────────────────────────────────────────
//
// Spec 21 §8.7: legacy rows carry no source signal, so they migrate to
// `our-vision/` marked `source: unknown` and are NEVER attributed to the client
// without evidence. She is the evidence, which is why every unknown row carries
// a one-tap way across and nothing guesses on her behalf.

export type Provenance = 'client' | 'us' | 'unknown';

/** A Reference that has been sorted. The field is optional on purpose: a row
 *  that predates the sort has no opinion, and no opinion is not "ours". */
export type SortedReference = Reference & { source?: Provenance };

export function provenanceOf(ref: Reference): Provenance {
  const s = (ref as SortedReference).source;
  return s === 'client' || s === 'us' ? s : 'unknown';
}

/** Where a row is drawn. Unknown sits with ours, and says so. */
export function groupOf(ref: Reference): 'from-client' | 'our-vision' {
  return provenanceOf(ref) === 'client' ? 'from-client' : 'our-vision';
}

/** Never blank. Falls back to the host, then the first line, then Untitled. */
export function refTitle(ref: Reference): string {
  const t = (ref.title ?? '').trim();
  if (t) return t;
  const host = hostOf(ref.content);
  if (host) return host;
  const line = (ref.content ?? '').trim().split('\n')[0].trim();
  if (line) return line.length > 60 ? `${line.slice(0, 60).trimEnd()}...` : line;
  return 'Untitled';
}

/** The 12.5px source column: where it came from, not who sent it. */
export function refSourceLabel(ref: Reference): string {
  const host = hostOf(ref.content);
  if (host) return host;
  if (ref.type === 'text') return 'a note';
  if (ref.type === 'image') return 'an image';
  return '';
}

export interface RefRow {
  id: string;
  title: string;
  source: string;
  date: string;
  provenance: Provenance;
  /** Present only for a link or an image with a real URL. */
  href: string;
  ref: Reference;
}

export function refRow(ref: Reference): RefRow {
  const href = /^https?:\/\//i.test((ref.content ?? '').trim()) ? ref.content.trim() : '';
  return {
    id: ref.id,
    title: refTitle(ref),
    source: refSourceLabel(ref),
    date: shortDate(ref.createdAt),
    provenance: provenanceOf(ref),
    href,
    ref,
  };
}

export interface RefGroup {
  key: 'from-client' | 'our-vision';
  label: string;
  rows: RefRow[];
  /** The unknown-source note, counted from `rows`. Empty when nothing is unknown. */
  note: string;
}

const GROUP_LABELS: Record<RefGroup['key'], string> = {
  'from-client': 'What they shared',
  'our-vision': 'What we want for them',
};

/**
 * The unknown note. Counted from the rows it sits above, and it never appears
 * where there is nothing unknown.
 */
export function unknownNote(rows: RefRow[]): string {
  const n = rows.filter(r => r.provenance === 'unknown').length;
  if (n === 0) return '';
  if (n === 1) return 'One of these came in before we kept who shared it. Move it across if they did.';
  return `${n} of these came in before we kept who shared them. Move any across if they did.`;
}

/**
 * The two groups, newest first inside each, EMPTY GROUPS DROPPED. A group with
 * nothing in it is not rendered as an empty card saying "nothing here" — off
 * means absent.
 */
export function groupReferences(refs: Reference[]): RefGroup[] {
  const rows = (refs ?? []).map(refRow);
  const byDate = (a: RefRow, b: RefRow) =>
    (b.ref.createdAt ?? '').localeCompare(a.ref.createdAt ?? '');
  const keys: RefGroup['key'][] = ['from-client', 'our-vision'];
  return keys
    .map(key => {
      const mine = rows.filter(r => groupOf(r.ref) === key).sort(byDate);
      return { key, label: GROUP_LABELS[key], rows: mine, note: key === 'our-vision' ? unknownNote(mine) : '' };
    })
    .filter(g => g.rows.length > 0);
}

/** The line under the References title. Every number counted from `refs`. */
export function referencesLine(refs: Reference[]): string {
  const all = refs ?? [];
  if (all.length === 0) return 'Nothing kept here yet.';
  const theirs = all.filter(r => provenanceOf(r) === 'client').length;
  const kept = `${all.length} kept.`;
  if (theirs === 0) return `${kept} None of them marked as theirs yet.`;
  if (theirs === 1) return `${kept} One of them came from them.`;
  return `${kept} ${theirs} of them came from them.`;
}

/** Flipping a row. The only way a row is attributed to the client. */
export function flipProvenance(current: Provenance): Provenance {
  return current === 'client' ? 'us' : 'client';
}

/** The button's words, so the screen states no direction of its own. */
export function moveLabel(current: Provenance): string {
  return current === 'client' ? 'Move to what we want for them' : 'They shared this';
}
