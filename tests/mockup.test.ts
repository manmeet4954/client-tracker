// Spec 35 — the profile mockup. The acceptance list in §7, plus the rules the
// screen depends on being true.
//
// Plain Node, no dependencies, no build step, in the style of the rest of
// tests/. Nothing here renders React: everything the screen does that could be
// wrong is in lib/mockup/profile.ts, which is the point of that file.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { suite, test, ok, eq, throws } from './harness.ts';
import { emptyBody, putEntry, readPath } from '../lib/tree/body.ts';
import { findDeclaration } from '../lib/tree/declarations.ts';
import { findSwitch } from '../lib/tree/switches.ts';
import {
  setBeforeImage,
  FURNITURE, HIGHLIGHT_COUNT, MAX_PINS, MOCKUP_ENTRY_TYPE, MOCKUP_PATH, TILE_COUNT,
  TILE_RATIO, TOO_MANY_PINS,
  archiveMockup, centreCropRect, copyMockup, copyName, coverBox, displayLink, findMockup,
  findMockupByShareId, isPinned, mockupLine, newMockup, normalizeMockup, orderedTiles,
  pinnedCount, prettyDate, readMockups, rename, setAvatar, setField, setHighlightImage,
  setHighlightLabel, setTileImage, togglePin, writeMockup,
  type ProfileMockupRecord,
} from '../lib/mockup/profile.ts';

const NOW = '2026-08-08T09:00:00.000Z';
const LATER = '2026-08-09T09:00:00.000Z';

function fresh(over: Partial<ProfileMockupRecord> = {}): ProfileMockupRecord {
  return {
    ...newMockup({ id: 'm1', shareId: 'share-1', name: 'Onboarding', date: '2026-08-08', now: NOW }),
    ...over,
  };
}

/** A mockup with something in every slot, which is what she actually shows. */
function filled(): ProfileMockupRecord {
  let m = fresh();
  m = setField(m, 'username', 'yourcareerbubble', NOW);
  m = setField(m, 'fullName', 'Merushri Baboota | Career Counsellor', NOW);
  m = setField(m, 'bio', 'Line one\nLine two\nLine three', NOW);
  m = setField(m, 'link', 'https://linktr.ee/careerbubble/', NOW);
  m = setAvatar(m, 'https://example.test/avatar.jpg', NOW);
  m.highlights.forEach((h, i) => {
    m = setHighlightLabel(m, h.id, `Highlight ${i + 1}`, NOW);
    m = setHighlightImage(m, h.id, `https://example.test/h${i}.jpg`, NOW);
  });
  m.tiles.forEach((t, i) => {
    m = setTileImage(m, t.id, `https://example.test/t${i}.jpg`, NOW);
  });
  return m;
}

// ── The address it was given, not one this spec invented ─────────────────────

suite('spec 35 — the address');

test('1. the mockup writes to the declared path, with the declared entry type', () => {
  const dec = findDeclaration(MOCKUP_PATH);
  ok(dec, 'the path is declared, and an undeclared path is refused at the door');
  eq(dec!.entry_type, MOCKUP_ENTRY_TYPE, 'the entry type the record writes is the declared one');
  eq(dec!.fed_by, ['owner'], 'fed by her, only her: a mockup is work she does FOR the client');
  eq(dec!.history, 'versioned', 'versioned, which is what makes copy and before-and-after work');
  eq(dec!.client_door, 'see:strategy', 'the client reads it through the strategy door, not a fifth give-point');
});

test('2. the switch that governs it exists and owns exactly this path', () => {
  const sw = findSwitch('strategy.profile_mockup');
  ok(sw, 'the switch is registered');
  ok(sw!.owns.includes(MOCKUP_PATH), 'and it owns the mockup path');
  eq(sw!.audience, 'both', 'she sees it, and so does the client when it is on');
});

test('3. a write lands at the path and reads back', () => {
  const body = writeMockup(emptyBody(NOW), filled(), NOW);
  eq(readPath(body, MOCKUP_PATH).length, 1, 'one entry at the path');
  eq(readPath(body, MOCKUP_PATH)[0].type, MOCKUP_ENTRY_TYPE, 'carrying the declared type');
  eq(readMockups(body).length, 1, 'and it reads back as one mockup');
  eq(readMockups(body)[0].username, 'yourcareerbubble', 'with what she typed');
});

test('4. a writer the path never declared is refused by the tree, not by this file', () => {
  // The guard lives in the TREE, not in lib/mockup: `fed_by` is ['owner'], so a
  // client write at this path is refused before any of our code is consulted.
  // Written with a plain import rather than require(), which does not exist in
  // these modules and was throwing a module-not-found instead of the refusal.
  throws(
    () => putEntry(emptyBody(NOW), MOCKUP_PATH, {
      id: 'x', type: MOCKUP_ENTRY_TYPE, data: {},
    }, { writer: 'client', now: NOW }),
    'writer',
    'a client cannot write a mockup',
  );
});

// ── §3: what edits, and what does not ────────────────────────────────────────

suite('spec 35 §3 — the Yes column, and only the Yes column');

test('5. every field in the Yes column edits, and the edit sticks', () => {
  let m = fresh();
  m = setField(m, 'username', 'krnl.studio', LATER);
  m = setField(m, 'fullName', 'Manmeet Kaur | Designer', LATER);
  m = setField(m, 'bio', 'one\ntwo', LATER);
  m = setField(m, 'link', 'krnl.studio', LATER);
  m = setAvatar(m, 'https://example.test/a.png', LATER);
  eq(m.username, 'krnl.studio', 'username');
  eq(m.fullName, 'Manmeet Kaur | Designer', 'name line');
  eq(m.bio, 'one\ntwo', 'bio, multi-line');
  eq(m.link, 'krnl.studio', 'link');
  eq(m.avatarUrl, 'https://example.test/a.png', 'profile picture');
  eq(m.updatedAt, LATER, 'and each edit stamps the record');
});

test('6. five highlights, both the picture and the word under it', () => {
  const m = fresh();
  eq(m.highlights.length, HIGHLIGHT_COUNT, 'five, as the screenshot has');
  const one = setHighlightLabel(setHighlightImage(m, 'h3', 'u', NOW), 'h3', 'Services', LATER);
  eq(one.highlights[2].label, 'Services', 'the label edits');
  eq(one.highlights[2].imageUrl, 'u', 'the cover edits');
  eq(one.highlights[0].label, '', 'and its neighbours are untouched');
});

test('7. the story ring is not a field, so it cannot be changed or removed', () => {
  const keys = Object.keys(fresh());
  ok(!keys.some(k => /ring/i.test(k)), 'nothing in the record names the ring: it is always drawn');
  ok(keys.includes('avatarUrl'), 'the photo inside it is the only part that changes');
});

test('8. the counts and the followed-by line are furniture with no setter', () => {
  const keys = Object.keys(fresh());
  for (const banned of ['posts', 'followers', 'following', 'followedBy', 'stats', 'verified']) {
    ok(!keys.includes(banned), `"${banned}" is not on the record, so nothing can edit it`);
  }
  eq(FURNITURE.stats.map(s => s.label), ['posts', 'followers', 'following'], 'the format stays');
  eq(FURNITURE.controls, ['Following', 'Message', 'Contact'], 'the controls are drawn, never chosen');
  eq(FURNITURE.followedBy.others, 2, 'and the followed-by line is kept as drawn');
});

// ── §4: the grid ─────────────────────────────────────────────────────────────

suite('spec 35 §4 — the grid');

test('9. six tiles, three across, 4:5 portrait', () => {
  eq(fresh().tiles.length, TILE_COUNT, 'six');
  eq(TILE_RATIO, 0.8, '4:5 portrait, width over height');
});

test('10. a landscape photo is centre-cropped to 4:5 and never stretched', () => {
  const box = coverBox(1920, 1080);
  eq(Math.round(box.height), 100, 'the height fills the tile');
  eq(Math.round(box.width), 222, 'and the width overflows, so the sides are cropped');
  eq(Math.round(box.left), -61, 'centred, so equal amounts come off each side');
  ok(box.width >= 100 && box.height >= 100, 'neither dimension is ever squeezed below the tile');

  const rect = centreCropRect(1920, 1080);
  eq(rect.sw / rect.sh, TILE_RATIO, 'the crop rectangle is exactly 4:5');
  eq(rect.sh, 1080, 'full height of the source');
  eq(rect.sx, (1920 - 1080 * 0.8) / 2, 'and it is taken from the middle');
});

test('11. a tall photo crops top and bottom, a square crops the sides', () => {
  const tall = coverBox(1080, 1920);
  eq(Math.round(tall.width), 100, 'a 9:16 photo fills the width');
  eq(Math.round(tall.height), 142, 'and overflows in height');
  eq(Math.round(tall.top), -21, 'centred vertically');

  const square = coverBox(1000, 1000);
  eq(square.width, 125, 'a square overflows sideways by a quarter');
  eq(square.left, -12.5, 'half off each edge');

  const exact = coverBox(800, 1000);
  eq(exact, { width: 100, height: 100, left: 0, top: 0 }, 'an image already 4:5 is not moved at all');
});

test('12. a picture with no measurable size fills the tile rather than breaking it', () => {
  eq(coverBox(0, 0), { width: 100, height: 100, left: 0, top: 0 }, 'no size, no maths');
  eq(centreCropRect(0, 500), { sx: 0, sy: 0, sw: 0, sh: 0 }, 'and the rectangle is empty, not negative');
});

test('13. up to three pins, and the fourth is refused with one plain line', () => {
  let m = fresh();
  for (const id of ['t1', 't2', 't3']) {
    const r = togglePin(m, id, NOW);
    eq(r.error, null, `${id} pins`);
    m = r.mockup;
  }
  eq(pinnedCount(m), MAX_PINS, 'three pinned');

  const fourth = togglePin(m, 't4', NOW);
  eq(fourth.error, TOO_MANY_PINS, 'the fourth is refused, in one plain line');
  eq(fourth.mockup, m, 'and the record comes back untouched, so nothing half-happens');
  ok(!TOO_MANY_PINS.includes('—'), 'no em dash in anything a person reads');
});

test('14. unpinning works, and frees a slot', () => {
  let m = fresh();
  m = togglePin(m, 't1', NOW).mockup;
  m = togglePin(m, 't2', NOW).mockup;
  m = togglePin(m, 't3', NOW).mockup;
  m = togglePin(m, 't2', NOW).mockup;
  ok(!isPinned(m, 't2'), 't2 unpinned');
  eq(pinnedCount(m), 2, 'two left');
  const again = togglePin(m, 't5', NOW);
  eq(again.error, null, 'and the freed slot takes a new pin');
  eq(pinnedCount(again.mockup), 3, 'back to three');
});

test('15. pinned tiles draw first, which is why the screenshot pins the first three', () => {
  let m = fresh();
  m = setTileImage(m, 't5', 'five', NOW);
  m = togglePin(m, 't5', NOW).mockup;
  m = togglePin(m, 't6', NOW).mockup;
  eq(orderedTiles(m).map(t => t.id), ['t5', 't6', 't1', 't2', 't3', 't4'], 'pins to the front, order kept');
  eq(m.tiles.map(t => t.id), ['t1', 't2', 't3', 't4', 't5', 't6'], 'and the record itself never reorders');
});

test('16. pinning a tile that does not exist changes nothing and reports nothing', () => {
  const m = fresh();
  const r = togglePin(m, 'nope', NOW);
  eq(r.error, null, 'no error');
  eq(r.mockup, m, 'no change');
});

// ── §5: more than one, and copying ───────────────────────────────────────────

suite('spec 35 §5 — more than one, and the copy');

test('17. each mockup carries a name and a date', () => {
  const m = rename(fresh(), 'Three months in', '2026-11-01', LATER);
  eq(m.name, 'Three months in', 'named');
  eq(m.date, '2026-11-01', 'dated');
  eq(mockupLine(m), 'Three months in · 1 Nov 2026', 'and the line she reads says both');
  ok(!mockupLine(m).includes('—'), 'no em dash');
});

test('18. copying leaves the original completely untouched', () => {
  const original = filled();
  const before = JSON.parse(JSON.stringify(original));
  const copy = copyMockup(original, {
    id: 'm2', shareId: 'share-2', name: copyName(original.name), date: '2026-11-01', now: LATER,
  });

  eq(original, before, 'the original is byte-for-byte what it was');
  eq(copy.id, 'm2', 'the copy is its own record');
  eq(copy.shareId, 'share-2', 'with its own link, so sharing one never exposes the other');
  eq(copy.name, 'Onboarding copy', 'and a name she will not confuse');
  eq(copy.username, original.username, 'everything drawn came across');
});

test('19. editing the copy cannot reach back into the original', () => {
  const original = filled();
  let copy = copyMockup(original, { id: 'm2', shareId: 's2', name: 'after', date: '2026-11-01', now: LATER });
  copy = setTileImage(copy, 't1', 'CHANGED', LATER);
  copy = setHighlightLabel(copy, 'h1', 'CHANGED', LATER);
  copy = togglePin(copy, 't1', LATER).mockup;

  eq(original.tiles[0].imageUrl, 'https://example.test/t0.jpg', 'the original tile is unchanged');
  eq(original.highlights[0].label, 'Highlight 1', 'the original highlight is unchanged');
  eq(pinnedCount(original), 0, 'and the original has no pin');
});

test('20. two mockups live side by side on the same profile, newest first', () => {
  let body = emptyBody(NOW);
  body = writeMockup(body, rename(fresh(), 'Onboarding', '2026-08-08', NOW), NOW);
  body = writeMockup(body, {
    ...fresh({ id: 'm2', shareId: 's2' }), name: 'Three months in', date: '2026-11-01',
  }, LATER);
  eq(readMockups(body).map(m => m.name), ['Three months in', 'Onboarding'], 'newest first');
  eq(readMockups(body).length, 2, 'both survive, which is what before-and-after needs');
});

test('21. an edit overwrites in place rather than growing a second row', () => {
  let body = writeMockup(emptyBody(NOW), filled(), NOW);
  body = writeMockup(body, setField(filled(), 'bio', 'new bio', LATER), LATER);
  eq(readMockups(body).length, 1, 'still one mockup');
  eq(readMockups(body)[0].bio, 'new bio', 'holding the new value');
});

// ── §5: the share link, and §7.7 ─────────────────────────────────────────────

suite('spec 35 §5 — sharing');

test('22. a share id resolves to exactly its own mockup', () => {
  let body = writeMockup(emptyBody(NOW), filled(), NOW);
  body = writeMockup(body, { ...filled(), id: 'm2', shareId: 'share-2', username: 'other' }, NOW);
  eq(findMockupByShareId(body, 'share-1')!.username, 'yourcareerbubble', 'the first link');
  eq(findMockupByShareId(body, 'share-2')!.username, 'other', 'the second link');
  eq(findMockupByShareId(body, 'nope'), null, 'an unknown link resolves to nothing');
  eq(findMockupByShareId(body, ''), null, 'and an empty one never matches a record with no share id');
});

test('23. an archived mockup stops resolving, and is never deleted', () => {
  let body = writeMockup(emptyBody(NOW), filled(), NOW);
  body = archiveMockup(body, 'm1', LATER);
  eq(readMockups(body).length, 0, 'gone from her list');
  eq(findMockupByShareId(body, 'share-1'), null, 'and the public link stops working');
  eq(readPath(body, MOCKUP_PATH).length, 1, 'but the entry is still there');
  eq(readPath(body, MOCKUP_PATH)[0].state, 'history', 'at history, which is where turning things off goes');
  ok(findMockup(body, 'm1'), 'and she can still read it');
});

// ── Reading what came out of storage ─────────────────────────────────────────

suite('spec 35 — a record from storage can never break the screen');

test('24. six tiles and five highlights, whatever storage held', () => {
  const short = normalizeMockup({ id: 'x', tiles: [{ id: 'a', imageUrl: 'one', pinned: false }] });
  eq(short.tiles.length, TILE_COUNT, 'padded to six');
  eq(short.tiles[0].imageUrl, 'one', 'keeping what was there');
  eq(short.highlights.length, HIGHLIGHT_COUNT, 'and five highlights');

  const long = normalizeMockup({
    tiles: Array.from({ length: 12 }, (_, i) => ({ id: `z${i}`, imageUrl: '', pinned: false })),
  });
  eq(long.tiles.length, TILE_COUNT, 'and never more than six');
});

test('25. a record claiming five pins comes back with three', () => {
  const m = normalizeMockup({
    tiles: Array.from({ length: 6 }, (_, i) => ({ id: `t${i + 1}`, imageUrl: '', pinned: true })),
  });
  eq(pinnedCount(m), MAX_PINS, 'the cap holds on the way in as well as on the way out');
  eq(m.tiles.filter(t => t.pinned).map(t => t.id), ['t1', 't2', 't3'], 'the first three keep theirs');
});

test('26. junk in a string slot reads as empty rather than rendering as junk', () => {
  const m = normalizeMockup({ username: 42 as unknown as string, bio: null as unknown as string });
  eq(m.username, '', 'a number is not a username');
  eq(m.bio, '', 'and null is not a bio');
  eq(normalizeMockup(null).tiles.length, TILE_COUNT, 'nothing at all still gives a drawable mockup');
});

// ── The small readable lines ─────────────────────────────────────────────────

suite('spec 35 — the lines a person reads');

test('27. the link row drops the scheme and the trailing slash, as Instagram does', () => {
  eq(displayLink('https://linktr.ee/careerbubble/'), 'linktr.ee/careerbubble', 'https and slash gone');
  eq(displayLink('http://krnl.studio'), 'krnl.studio', 'http too');
  eq(displayLink('  linktr.ee/x  '), 'linktr.ee/x', 'and it is trimmed');
  eq(displayLink(''), '', 'empty stays empty, so no chain icon is drawn over nothing');
});

test('28. a mockup with no name still reads as something', () => {
  eq(mockupLine(fresh({ name: '', date: '' })), 'Untitled mockup · 8 Aug 2026', 'falls back to the created date');
  eq(prettyDate('not-a-date'), '', 'and a date it cannot read is left out rather than guessed');
});

test('29. no em dash anywhere a person reads', () => {
  const lines = [
    TOO_MANY_PINS, copyName('Onboarding'), mockupLine(filled()),
    ...FURNITURE.controls, ...FURNITURE.stats.map(s => `${s.value} ${s.label}`),
  ];
  for (const line of lines) ok(!line.includes('—'), `"${line}" has an em dash`);
});

suite('the grid says it can be filled — 2026-08-17');

test('an empty slot shows an affordance while editing, and a filled one never does', () => {
  // Her question: "in the mockup can i not add the image in this grid to view
  // the post". She could. Every slot has opened a file picker since it was
  // built. But an EMPTY slot was drawn as flat grey with nothing to say so,
  // and a control nobody can see is a control nobody has.
  const phone = readFileSync(join(process.cwd(), 'components/mockup/Phone.tsx'), 'utf8');

  ok(/\{!url && \(/.test(phone), 'the hint is drawn only when the slot is empty');
  ok(/pointer-events-none/.test(phone), 'and never eats the click meant for the slot');

  // The whole tile must be the target. It was `className="block"` on the
  // button, so the control was only as tall as its content.
  ok(/className="relative block h-full w-full cursor-pointer"/.test(phone),
    'the button fills the slot it sits in');

  // A filled slot stays exactly the picture: this screen exists to show the
  // grid as it will really look, and furniture over her photos would break it.
  const slot = phone.slice(phone.indexOf('function ImageSlot'));
  const guards = [...slot.matchAll(/\{(!?)url &&/g)].map(m => m[1]);
  ok(guards.length > 0, 'the hint is guarded on whether the slot is filled');
  ok(guards.every(g => g === '!'), 'and every guard is the EMPTY one: no icon over a photo');
});

suite('before and after, and a client can see both — 2026-08-17');

test('the before is a screenshot on the record, and empty until she adds one', () => {
  // Her choice when asked how a "before" should be made: a screenshot of their
  // real profile. A rebuilt before invites the one answer that ruins the
  // point - "you made that look bad on purpose".
  const m = newMockup({ id: 'm1', shareId: 's1', name: 'Onboarding', date: '2026-08-17', now: NOW });
  eq(m.beforeImageUrl, '', 'a new mockup has no before');

  const withBefore = setBeforeImage(m, 'https://img/before.png', NOW);
  eq(withBefore.beforeImageUrl, 'https://img/before.png', 'she adds one');
  eq(setBeforeImage(withBefore, '', NOW).beforeImageUrl, '', 'and can take it back out');

  // It survives a round trip through the body, like every other field.
  const back = normalizeMockup(JSON.parse(JSON.stringify(withBefore)));
  eq(back.beforeImageUrl, 'https://img/before.png', 'it is stored, not derived');

  // A mockup made before this field existed is still a valid mockup.
  const legacy = normalizeMockup({ id: 'old', username: 'riti' });
  eq(legacy.beforeImageUrl, '', 'an older record reads as having no before');
});

test('ONE compare view, and a client gets it with the upload absent', () => {
  // Rule 0: a client sees HER component. The upload is a prop, so its absence
  // is what makes their copy read-only - not a second component drawn for them.
  const compare = readFileSync(join(process.cwd(), 'components/mockup/Compare.tsx'), 'utf8');
  ok(/onBefore\?:/.test(compare), 'the upload is optional');
  ok(/const mine = !!onBefore/.test(compare), 'and its absence is what makes it read-only');
  ok(/import Phone,? .*from '@\/components\/mockup\/Phone'/.test(compare),
    'the after is HER phone, not a picture of one');

  const client = readFileSync(join(process.cwd(), 'components/shell/ClientWindows.tsx'), 'utf8');
  const brand = client.slice(client.indexOf('export function BrandWindow'), client.indexOf('function labelOf'));
  ok(/<Compare mockup=\{mockup\} \/>/.test(brand), "the client's Brand window mounts it");
  ok(!/onBefore/.test(brand), 'and never passes an upload');
  ok(/renderState\(rp, 'strategy\.profile_mockup', 'client'\)/.test(brand),
    'it rides the same plug her own Profile mockup panel rides');
});

test('the phone is laid out at one true width and SCALED, never reflowed', () => {
  // Her correction, and it was the second wrong fix in a row from me: "It's not
  // the zoom I asked for. I want this to be a responsive thing, like it happens
  // in frameworks... it's not like a PNG or something."
  //
  // The phone was `w-full max-w-[392px]`, so a narrower column made it NARROWER
  // while its text stayed 15px. The name broke onto two lines, the bio onto
  // two, "Followed by" onto two. A phone does not do that: it keeps its
  // proportions and gets smaller. And 392 was too narrow anyway — her own
  // screenshots come from a 430pt phone, which is why HER lines fit and the
  // mockup's did not.
  const phone = readFileSync(join(process.cwd(), 'components/mockup/Phone.tsx'), 'utf8');
  ok(/export const PHONE_WIDTH = 430;/.test(phone), 'one true width, and it is a real phone’s');
  ok(/style=\{\{\s*width: PHONE_WIDTH,/.test(phone), 'the phone is laid out AT it');
  ok(!/max-w-\[392px\]/.test(phone), 'the old squashing width is gone');

  const scaled = readFileSync(join(process.cwd(), 'components/mockup/Scaled.tsx'), 'utf8');
  ok(/transform: `scale\(/.test(scaled), 'and resized by transform, so nothing reflows');
  ok(/ResizeObserver/.test(scaled), 'measured against its container, so it is responsive');
  ok(/offsetHeight \* s/.test(scaled), 'and reports its real height, so nothing overlaps below');

  const c = readFileSync(join(process.cwd(), 'components/mockup/Compare.tsx'), 'utf8');
  ok(/<Scaled width=\{PHONE_WIDTH\}>/.test(c), 'the compare view draws it that way too');
  ok(!/object-cover/.test(c), 'nothing crops on its own');
  ok(/min=\{40\} max=\{100\}/.test(c), 'one SIZE control, not a zoom');
  // Two columns sized separately could not be compared. One number, one style.
  ok(/style=\{\{ width: `\$\{size\}%`/.test(c), 'and it drives BOTH columns together');
});

test('the header is in Instagram’s order: name above the numbers', () => {
  // 2026-08-17, her correction against a real screenshot: "the name we are
  // seeing is above Riti Nauharia. In the mockup that we built, the name is
  // coming below, which I guess is not correct."
  //
  // She is right, and it matters more than it sounds. This screen exists to
  // look exactly like their phone, so a header in the wrong order is the one
  // flaw a client notices immediately and the whole mockup loses its authority.
  const phone = readFileSync(join(process.cwd(), 'components/mockup/Phone.tsx'), 'utf8');

  const name = phone.indexOf("placeholder=\"Name | what they do\"");
  const stats = phone.indexOf('FURNITURE.stats.map');
  const bio = phone.indexOf('placeholder="Bio"');
  ok(name > 0 && stats > 0 && bio > 0, 'all three parts are on the phone');
  ok(name < stats, 'the name is drawn ABOVE posts / followers / following');
  ok(stats < bio, 'and the bio comes after them, at full width');

  // The name must be inside the avatar row, not in the block below it.
  const row = phone.slice(phone.indexOf('Avatar, and the numbers'), bio);
  ok(row.includes('placeholder="Name | what they do"'),
    'the name sits in the column beside the avatar');
});

test('ONE link, both versions, and the person opening it chooses', () => {
  // Her request first: "it should also show comparison version, like make 2
  // versions." Then her correction, which was the better shape: "can we not
  // have 1 link showing both the versions."
  //
  // Two links was worse for a reason worth keeping: a link is a thing she
  // pastes into a message, and the moment there are two she has to remember
  // which is which, every time, forever. One link. The page carries the switch.
  const screen = readFileSync(join(process.cwd(), 'components/mockup/MockupScreen.tsx'), 'utf8');
  const links = [...screen.matchAll(/label="Copy the[^"]*"/g)].map(m => m[0]);
  eq(links.length, 1, 'she has exactly one link to copy');
  ok(!/\?view=compare/.test(screen), 'and never has to know a second address exists');

  const pub = readFileSync(join(process.cwd(), 'components/mockup/PublicMockup.tsx'), 'utf8');
  ok(/Before and after/.test(pub) && /Just the new profile/.test(pub), 'both views are offered');
  ok(/canCompare && initial !== 'solo' \? 'compare' : 'solo'/.test(pub),
    'the comparison leads, because the difference is the point');
  ok(/if \(!canCompare\)/.test(pub),
    'with no screenshot there is nothing to switch between, so no switch is drawn');
  ok(!/onBefore|onSize|onFraming/.test(pub), 'read-only: no editing affordance, in any state');
});

test('on a phone the pair stays side by side', () => {
  // Her note, opening the link on her phone: "it doesn't look that good. From
  // the edges, it's not cutting, but it's not optimized."
  //
  // It was `md:grid-cols-2`, so on a narrow screen the two STACKED and she had
  // to scroll between them. Two things you cannot see at once are not a
  // comparison — the one job this view has.
  const c = readFileSync(join(process.cwd(), 'components/mockup/Compare.tsx'), 'utf8');
  // Assert on the MARKUP, not the file: the comment above it quotes the old
  // class name on purpose, so a naive search finds itself.
  const markup = c.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  ok(/className="mx-auto grid grid-cols-2/.test(markup), 'two columns');
  ok(!/md:grid-cols-2/.test(markup), 'at EVERY width, not only on a desktop');

  // Padding is width taken away from the profiles, so a phone gets less of it.
  const pub = readFileSync(join(process.cwd(), 'components/mockup/PublicMockup.tsx'), 'utf8');
  ok(/px-2 py-4 sm:px-4/.test(pub), 'the pair gets the edges back on a small screen');
});

test('the PNG is captured at true size, not at whatever the window was', () => {
  // Her request: "also incorporate the version of downloading the mockup as a
  // png."
  //
  // The catch, and the reason this test exists: what is ON SCREEN lives inside
  // a `transform: scale()` — that is what makes it responsive — so capturing
  // the visible node would bake in whatever size the window happened to be and
  // hand her a small, soft file. The capture points at an offscreen copy drawn
  // at the phone's true width instead.
  const c = readFileSync(join(process.cwd(), 'components/mockup/Compare.tsx'), 'utf8');
  ok(/fixed left-\[-99999px\]/.test(c), 'there is an offscreen copy');
  ok(/<div ref=\{shot\}/.test(c), 'and the capture points at THAT');
  ok(/width: PHONE_WIDTH/.test(c), 'drawn at the phone’s true width');
  ok(/downloadPng\(shot\.current/.test(c), 'never at the scaled, visible one');

  // One helper, not a third copy of the pattern.
  const helper = readFileSync(join(process.cwd(), 'lib/exportPng.ts'), 'utf8');
  ok(/fonts\?\.ready/.test(helper),
    'fonts are awaited: capturing early renders the fallback face, and on a mockup the type IS the design');
  ok(/pixelRatio: opts\?\.pixelRatio \?\? 2/.test(helper), 'retina by default');
});
