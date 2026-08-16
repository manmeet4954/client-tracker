// Creation → Assets and Creation → References — the pure logic under test.
//
// Two rules drive most of what is checked here:
//
//   README, "State": every count shown in copy is derived at render time from
//   the array it describes. So every line-producing function is fed an array
//   and its English is asserted against that array, plurals included.
//
//   Spec 21 §8.7: a reference is NEVER attributed to the client without
//   evidence. So the default for an unmarked row is asserted to be `unknown`
//   and to sit under "What we want for them", not under "What they shared".
//
// Plain Node, no dependencies. Not registered in tests/run.ts (shared file);
// run it with:
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
//     -e "import('./tests/creation.assets.test.ts').then(async m => process.exit(await (await import('./tests/harness.ts')).run()))"

import { suite, test, ok, eq } from './harness.ts';
import type { AssetItem, AssetSet, Reference } from '../types/index.ts';
import {
  assetModes, assetTiles, assetsLine, driveTile, fileSize, flipProvenance, groupOf,
  groupReferences, hasCatalogue, hostOf, itemsInSet, moveLabel, provenanceOf, refRow,
  refSourceLabel, refTitle, referencesLine, resolveMode, setKind, setLine, setMeta,
  setSource, shortDate, unknownNote,
} from '../lib/creation/assets.ts';
import type { SortedReference } from '../lib/creation/assets.ts';

// ── Fixtures ─────────────────────────────────────────────────────────────────

function set(id: string, name: string, createdAt = '2026-07-01T00:00:00.000Z'): AssetSet {
  return { id, name, createdAt };
}

function item(id: string, setId: string, uploadedBy = 'owner', thumbUrl = ''): AssetItem {
  return {
    id,
    setId,
    url: `https://cdn.example.com/${id}.jpg`,
    thumbUrl,
    fileName: `${id}.jpg`,
    size: 2_400_000,
    uploadedBy,
    createdAt: '2026-07-02T00:00:00.000Z',
  };
}

function ref(over: Partial<SortedReference> = {}): SortedReference {
  return {
    id: over.id ?? 'r1',
    type: over.type ?? 'link',
    content: over.content ?? 'https://www.instagram.com/p/abc',
    title: over.title ?? 'A competitor carousel they liked',
    pinned: false,
    createdAt: over.createdAt ?? '2026-07-28T09:00:00.000Z',
    ...(over.source ? { source: over.source } : {}),
  };
}

// ── Small helpers ────────────────────────────────────────────────────────────

suite('creation/assets — helpers');

test('shortDate gives the prototype "28 Jul" shape and nothing for a non-date', () => {
  eq(shortDate('2026-07-28T09:00:00.000Z'), '28 Jul', 'the date column');
  eq(shortDate('2026-01-01T00:00:00.000Z'), '1 Jan', 'no leading zero');
  eq(shortDate(''), '', 'no date is empty, not "Invalid Date"');
  eq(shortDate('not a date'), '', 'garbage in is empty out');
});

test('hostOf strips www and the scheme, and refuses non-URLs', () => {
  eq(hostOf('https://www.instagram.com/p/abc'), 'instagram.com', 'www stripped');
  eq(hostOf('http://Basecamp.com/pricing'), 'basecamp.com', 'lowercased');
  eq(hostOf('just some words'), '', 'prose is not a host');
  eq(hostOf(undefined), '', 'undefined is not a host');
});

test('fileSize shows nothing for zero rather than "0 KB"', () => {
  eq(fileSize(0), '', 'zero is not a size');
  eq(fileSize(undefined), '', 'missing is not a size');
  eq(fileSize(512 * 1024), '512 KB', 'kilobytes');
  eq(fileSize(2 * 1024 * 1024), '2.0 MB', 'megabytes');
});

// ── Assets: the kind label is derived, never typed ───────────────────────────

suite('creation/assets — sets');

test('a set kind comes from who uploaded, so nobody is asked to tag it', () => {
  eq(setSource([]), 'none', 'an empty set has no source');
  eq(setSource([item('a', 's1', 'owner')]), 'hers', 'the owner is her side');
  eq(setSource([item('a', 's1', 'intern')]), 'hers', 'the intern is her side too');
  eq(setSource([item('a', 's1', 'shiva')]), 'client', 'a client role is the client');
  eq(setSource([item('a', 's1', 'owner'), item('b', 's1', 'merushri')]), 'both', 'mixed is both');

  eq(setKind([]), 'New set', 'the empty label');
  eq(setKind([item('a', 's1', 'owner')]), '', 'her own uploads carry no label, her request 2026-08-11');
  eq(setKind([item('a', 's1', 'shiva')]), 'From the client', 'theirs');
  eq(setKind([item('a', 's1', 'owner'), item('b', 's1', 'shiva')]), 'From the client and you', 'both');
});

test('setMeta counts the array it describes, singular and plural', () => {
  eq(setMeta([]), 'nothing in here yet', 'empty says empty, not "0 originals"');
  eq(setMeta([1]), '1 original kept', 'singular');
  eq(setMeta([1, 2, 34]), '3 originals kept', 'plural');
});

test('a tile carries the count of ITS OWN items and nothing else', () => {
  const sets = [set('s1', 'August shoot'), set('s2', 'Product flatlays')];
  const items = [
    item('a', 's1', 'owner', 'https://cdn.example.com/a-thumb.webp'),
    item('b', 's1', 'owner'),
    item('c', 's2', 'shiva'),
    item('d', 'gone'), // orphan: belongs to a set that no longer exists
  ];
  const tiles = assetTiles(sets, items);
  eq(tiles.length, 2, 'one tile per set, and orphans invent no tile');
  eq(tiles[0].count, 2, 'August shoot counted its own two');
  eq(tiles[0].meta, '2 originals kept', 'the meta line agrees with the count');
  eq(tiles[0].kind, '', 'kind derived from the uploads');
  eq(tiles[0].previewUrl, 'https://cdn.example.com/a-thumb.webp', 'the first thumb previews');
  eq(tiles[1].count, 1, 'flatlays counted one');
  eq(tiles[1].kind, 'From the client', 'the client uploaded it');
  eq(tiles[1].previewUrl, 'https://cdn.example.com/c.jpg', 'falls back to the original when no thumb');
});

test('assetsLine states no number it did not count, and orphans do not inflate it', () => {
  const sets = [set('s1', 'August shoot'), set('s2', 'Flatlays')];
  const items = [item('a', 's1'), item('b', 's1'), item('c', 's2'), item('d', 'gone')];
  eq(assetsLine(sets, items, ''), '2 sets, 3 originals kept.', 'three, not four');
  eq(assetsLine([set('s1', 'One')], [item('a', 's1')], ''), '1 set, 1 original kept.', 'both singular');
  eq(assetsLine([], [], ''), 'No sets yet.', 'empty says empty');
  eq(
    assetsLine([], [], 'https://drive.google.com/x'),
    'No sets yet. Videos live in Drive.',
    'the Drive sentence only where a folder is linked',
  );
});

test('the Drive tile is absent when no folder is linked', () => {
  eq(driveTile(undefined), null, 'no url, no tile');
  eq(driveTile('   '), null, 'whitespace is not a url');
  const t = driveTile('https://drive.google.com/drive/folders/x');
  ok(t !== null, 'a linked folder makes a tile');
  eq(t!.kind, 'Video', 'the uppercase kind label');
  eq(t!.meta, 'opens in Drive', 'the prototype meta, word for word');
  eq(t!.externalUrl, 'https://drive.google.com/drive/folders/x', 'it is a door, not a set');
});

test('itemsInSet and setLine agree with each other', () => {
  const items = [item('a', 's1'), item('b', 's2'), item('c', 's1')];
  eq(itemsInSet(items, 's1').map(i => i.id), ['a', 'c'], 'only this set');
  eq(setLine(itemsInSet(items, 's1')), '2 photos, originals kept at full quality.', 'counted');
  eq(setLine(itemsInSet(items, 's2')), '1 photo, originals kept at full quality.', 'singular');
  eq(setLine(itemsInSet(items, 'none')), 'Nothing in here yet.', 'empty');
});

// ── Assets: the catalogue is a mode, and off means absent ────────────────────

suite('creation/assets — catalogue mode');

test('a profile with no catalogue gets NO toggle, not a disabled one', () => {
  eq(hasCatalogue([], []), false, 'no rows, no catalogue');
  eq(hasCatalogue(undefined, undefined), false, 'missing slices are not a catalogue');
  eq(assetModes(false), [], 'off means absent');
  eq(assetModes(true).length, 2, 'sets and catalogue');
  eq(assetModes(true)[0].id, 'sets', 'sets is first, and is the landing');
});

test('a catalogue exists as soon as either catalogue array has anything', () => {
  eq(hasCatalogue([{ id: 'c', name: 'Cardigans', createdAt: '' }], []), true, 'a category alone counts');
  eq(
    hasCatalogue([], [{ id: 'i', categoryId: 'c', imageUrl: 'x', createdAt: '' }]),
    true,
    'an item alone counts',
  );
});

test('a stale catalogue mode cannot survive the switch going off', () => {
  eq(resolveMode(true, 'catalogue'), 'catalogue', 'on, and asked for');
  eq(resolveMode(false, 'catalogue'), 'sets', 'off, so it falls back rather than rendering nothing');
  eq(resolveMode(true, 'sets'), 'sets', 'the default');
});

// ── References: never attributed without evidence ────────────────────────────

suite('creation/references');

test('an unmarked legacy row is UNKNOWN and sits with ours, never with theirs', () => {
  const legacy = ref({ source: undefined });
  eq(provenanceOf(legacy), 'unknown', 'no signal means unknown, not "us"');
  eq(groupOf(legacy), 'our-vision', 'spec 21 §8.7: it migrates to our-vision');
  eq(groupOf(ref({ source: 'client' })), 'from-client', 'evidence puts it with theirs');
  eq(groupOf(ref({ source: 'us' })), 'our-vision', 'ours stays ours');
});

test('a junk source value is not believed', () => {
  const bad = { ...ref(), source: 'client-ish' } as unknown as Reference;
  eq(provenanceOf(bad), 'unknown', 'only the two known values count as evidence');
});

test('a row title is never blank', () => {
  eq(refTitle(ref({ title: 'Their old deck' })), 'Their old deck', 'the title wins');
  eq(refTitle(ref({ title: '', content: 'https://basecamp.com/pricing' })), 'basecamp.com', 'then the host');
  eq(
    refTitle(ref({ title: '', type: 'text', content: 'She opens with a wrong belief\nthen corrects it' })),
    'She opens with a wrong belief',
    'then the first line',
  );
  eq(refTitle(ref({ title: '', type: 'text', content: '   ' })), 'Untitled', 'and finally a word, not a blank');
});

test('the source column says where it came from, not who sent it', () => {
  eq(refSourceLabel(ref({ content: 'https://www.instagram.com/p/x' })), 'instagram.com', 'the host');
  eq(refSourceLabel(ref({ type: 'text', content: 'a thought' })), 'a note', 'a note');
  eq(refSourceLabel(ref({ type: 'image', content: 'data-less' })), 'an image', 'an image');
});

test('a row only links out when the content really is a URL', () => {
  eq(refRow(ref({ content: 'https://instagram.com/p/x' })).href, 'https://instagram.com/p/x', 'a link links');
  eq(refRow(ref({ type: 'text', content: 'javascript:alert(1)' })).href, '', 'only http and https');
  eq(refRow(ref({ type: 'text', content: 'a thought' })).href, '', 'prose does not link');
});

test('the groups drop the empty one and sort newest first', () => {
  const refs: Reference[] = [
    ref({ id: 'a', createdAt: '2026-06-04T00:00:00.000Z' }),
    ref({ id: 'b', createdAt: '2026-08-02T00:00:00.000Z' }),
    ref({ id: 'c', createdAt: '2026-07-28T00:00:00.000Z' }),
  ];
  const groups = groupReferences(refs);
  eq(groups.length, 1, 'nothing is marked theirs, so that card is not drawn at all');
  eq(groups[0].key, 'our-vision', 'they all sit with ours');
  eq(groups[0].label, 'What we want for them', 'the header, word for word');
  eq(groups[0].rows.map(r => r.id), ['b', 'c', 'a'], 'newest first');
});

test('both groups appear once one row has evidence', () => {
  const groups = groupReferences([ref({ id: 'a', source: 'client' }), ref({ id: 'b', source: 'us' })]);
  eq(groups.map(g => g.key), ['from-client', 'our-vision'], 'theirs first, as in the design');
  eq(groups[0].label, 'What they shared', 'the header, word for word');
  eq(groups[0].note, '', 'a sorted group carries no unknown note');
});

test('groupReferences survives an empty and an absent list', () => {
  eq(groupReferences([]), [], 'nothing in, nothing out');
  eq(groupReferences(undefined as unknown as Reference[]), [], 'and no throw on undefined');
});

test('the unknown note counts the rows it sits above', () => {
  eq(unknownNote([]), '', 'no rows, no note');
  eq(unknownNote(groupReferences([ref({ source: 'us' })])[0].rows), '', 'nothing unknown, no note');

  const one = groupReferences([ref({ id: 'a' }), ref({ id: 'b', source: 'us' })]);
  eq(
    one[0].note,
    'One of these came in before we kept who shared it. Move it across if they did.',
    'singular, and it counted the one unknown among two rows',
  );

  const many = groupReferences([ref({ id: 'a' }), ref({ id: 'b' }), ref({ id: 'c', source: 'us' })]);
  ok(many[0].note.startsWith('2 of these'), `two unknowns counted, got: ${many[0].note}`);
});

test('referencesLine states no number it did not count', () => {
  eq(referencesLine([]), 'Nothing kept here yet.', 'empty');
  eq(
    referencesLine([ref({ id: 'a' }), ref({ id: 'b' })]),
    '2 kept. None of them marked as theirs yet.',
    'unknown rows are not counted as theirs',
  );
  eq(
    referencesLine([ref({ id: 'a', source: 'client' }), ref({ id: 'b' })]),
    '2 kept. One of them came from them.',
    'singular',
  );
  eq(
    referencesLine([ref({ id: 'a', source: 'client' }), ref({ id: 'b', source: 'client' })]),
    '2 kept. 2 of them came from them.',
    'plural',
  );
});

test('the move goes both ways, and an unknown row moves TO the client', () => {
  eq(flipProvenance('unknown'), 'client', 'one tap says they shared it');
  eq(flipProvenance('us'), 'client', 'and from ours as well');
  eq(flipProvenance('client'), 'us', 'and back again, so a mistake costs one tap');
  eq(moveLabel('unknown'), 'They shared this', 'the words on the unsorted row');
  eq(moveLabel('us'), 'They shared this', 'same words on ours');
  eq(moveLabel('client'), 'Move to what we want for them', 'the way back');
});
