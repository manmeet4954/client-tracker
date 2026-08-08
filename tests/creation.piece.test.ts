// The restructure, phase 2 — the piece panel.
//
// Review is a STATE of a piece, not a screen. Four things are held here, all of
// them the kind a later tidy-up would quietly undo:
//
//   1. A piece id resolves to exactly one profile. The panel is never told.
//   2. The lock gates the panel the same way it gates the board: a stage moves
//      when Strategy is locked and refuses when it is not.
//   3. A preview belongs to a piece from birth, and an old one is ATTACHED by
//      her, never guessed.
//   4. Nothing is claimed that the data does not hold: missing fields say they
//      are missing, gates are not invented for a profile that has none, and
//      every count in copy is counted from the array it describes.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq, ok, suite, test } from './harness.ts';
import { CONTENT_STAGES } from '../types/index.ts';
import { OPERATIONAL_GATES } from '../lib/tree/objects.ts';
import { previewFor, unattachedPreviews } from '../lib/creation/board.ts';
import {
  attachPreview, canMove, captionDrift, deliveryState, gateReading, locatePiece,
  newPreviewFor, pieceFields, sharePath, shareUrl, slideLine, whatsappHref,
} from '../lib/creation/piece.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

type Card = Parameters<typeof pieceFields>[0]['card'];
type Preview = Parameters<typeof attachPreview>[0];
type Clients = Parameters<typeof locatePiece>[0];

const card = (over: Partial<Card>): Card => ({
  id: 'c1', pillarId: '', title: 'A piece', hook: '', content: '',
  stage: 'idea', contentType: '', scheduledDate: '', postUrl: '', notes: '',
  customValues: {}, createdMonth: '2026-08',
  createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
  ...over,
});

const preview = (over: Partial<Preview>): Preview => ({
  id: 'p1', shareId: 'abc123', name: 'A preview', postType: 'static',
  images: ['one.jpg'], caption: '',
  createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
  ...over,
});

/** Only the two slices these functions read; the rest of ClientData is not theirs. */
const clients = (shape: Record<string, unknown>) => shape as unknown as Clients;

suite('creation · the piece panel');

// ── 1. One id, one home ──────────────────────────────────────────────────────

test('a piece id resolves to the one profile that holds it', () => {
  const found = locatePiece(clients({
    'prof-a': { contentCards: [card({ id: 'c1' })] },
    'prof-b': { contentCards: [card({ id: 'c2', title: 'Theirs' })] },
  }), 'c2');
  eq(found.kind, 'card', 'it found a card');
  if (found.kind !== 'card') return;
  eq(found.profileId, 'prof-b', 'it found the profile that holds it');
  eq(found.card.title, 'Theirs', 'it found the right piece');
});

test('an id nothing holds is missing, not a dead panel', () => {
  eq(locatePiece(clients({ a: { contentCards: [card({})] } }), 'nope').kind, 'missing',
    'an unknown id is missing');
  eq(locatePiece(clients({ a: { contentCards: [card({})] } }), '').kind, 'missing',
    'an empty id is missing');
});

test('a deep link carrying a tree piece id is shown for what it is', () => {
  const found = locatePiece(clients({
    'prof-a': { contentCards: [] },
    'prof-b': {
      contentCards: [],
      body: { paths: { 'work-log/creation': [{ id: 't9', data: { title: 'From the record', stage: 'review' } }] } },
    },
  }), 't9');
  eq(found.kind, 'tree', 'the tree piece was found');
  if (found.kind !== 'tree') return;
  eq(found.profileId, 'prof-b', 'with its profile');
  eq(found.title, 'From the record', 'and its title');
});

test('a tree piece with nothing written still reads honestly', () => {
  const found = locatePiece(clients({
    a: { contentCards: [], body: { paths: { 'work-log/creation': [{ id: 't1', data: {} }] } } },
  }), 't1');
  if (found.kind !== 'tree') throw new Error('expected the tree piece');
  eq(found.title, 'Untitled piece', 'no invented title');
  eq(found.stage, 'no stage recorded', 'no invented stage');
});

// ── 2. The lock gates the panel ──────────────────────────────────────────────

test('a stage moves when Strategy is locked', () => {
  const v = canMove({ locked: true, from: 'idea', to: 'review' });
  ok(v.allowed, 'a locked profile lets the piece move');
  eq(v.reason, '', 'and says nothing about it');
});

test('a stage refuses when Strategy is not locked, and says why once', () => {
  const v = canMove({ locked: false, from: 'idea', to: 'review' });
  ok(!v.allowed, 'an unlocked profile refuses the move');
  ok(v.reason.includes('not locked'), 'the line names the lock');
  ok(!v.reason.includes('--') && !v.reason.includes('—'), 'no em dashes in her copy');
});

test('moving a piece to the stage it is already at is not a move', () => {
  const v = canMove({ locked: true, from: 'review', to: 'review' });
  ok(!v.allowed, 'nothing happens');
  eq(v.reason, '', 'and nothing is said');
});

test('the panel has the same six stages as the board', () => {
  eq(CONTENT_STAGES.map(s => s.id),
    ['idea', 'writing', 'review', 'ready', 'scheduled', 'posted'],
    'six stages, in order, ids unchanged');
});

// ── 3. The fields ────────────────────────────────────────────────────────────

test('the five fields are pillar, format, seed, date, live link', () => {
  eq(pieceFields({ card: card({}) }).map(f => f.label),
    ['Pillar', 'Format', 'Born from', 'Goes live', 'Live link'],
    'the five, in the design order');
});

test('missing data is shown as missing, never as a blank or a zero', () => {
  const rows = pieceFields({ card: card({}) });
  ok(rows.every(r => r.missing), 'an empty piece has nothing recorded');
  eq(rows.map(r => r.value),
    ['No pillar yet', 'No format yet', 'Not born from a seed', 'No date yet', 'Not posted yet'],
    'each absence says what it is');
  ok(rows.every(r => !r.href), 'nothing links anywhere');
});

test('a filled piece reads its own values, and only a real link is a link', () => {
  const rows = pieceFields({
    card: card({
      contentType: 'Carousel',
      scheduledDate: '2026-08-11',
      postUrl: 'https://instagram.com/p/xyz',
      stage: 'posted',
    }),
    pillarName: 'Proof',
    seedName: 'the career has no home',
  });
  eq(rows.map(r => r.value),
    ['Proof', 'Carousel', 'the career has no home', '2026-08-11', 'https://instagram.com/p/xyz'],
    'every value comes off the piece');
  ok(rows.every(r => !r.missing), 'nothing is missing');
  eq(rows[4].href, 'https://instagram.com/p/xyz', 'the live link is followable');
});

test('whitespace is not data', () => {
  const rows = pieceFields({ card: card({ contentType: '   ', postUrl: '  ' }), pillarName: ' ' });
  ok(rows[0].missing && rows[1].missing && rows[4].missing, 'blanks are still missing');
  ok(!rows[4].href, 'a blank link is not a link');
});

// ── 4. The preview: born attached, or attached by her ────────────────────────

test('a preview made from a piece carries its cardId at birth', () => {
  const p = newPreviewFor({
    card: card({ id: 'c7', title: 'The one about resumes', content: 'Her words, once.' }),
    id: 'new-1', shareId: 'share-1', now: '2026-08-05T09:00:00.000Z',
  });
  eq(p.cardId, 'c7', 'it points at the piece from the first moment');
  eq(p.name, 'The one about resumes', 'the name is the piece, not a second question');
  eq(p.caption, 'Her words, once.', 'the caption is the piece, not a second copy');
  eq(p.images, [], 'no slides are invented');
  eq(p.postType, 'static', 'a preview with no slides is not a carousel');
  eq(p.createdAt, '2026-08-05T09:00:00.000Z', 'born now');
});

test('a piece with no title still makes a preview that says so', () => {
  const p = newPreviewFor({ card: card({ title: '' }), id: 'i', shareId: 's', now: 'n' });
  eq(p.name, 'Untitled post', 'no invented name');
});

test('previewFor finds the piece its preview belongs to', () => {
  const list = [preview({ id: 'p1', cardId: 'c1' }), preview({ id: 'p2', cardId: 'c2' })];
  eq(previewFor(list, 'c2')?.id, 'p2', 'the preview that claimed the piece');
  eq(previewFor(list, 'c9'), undefined, 'and nothing when none has');
});

test('an old preview is attached by her, and nothing else about it changes', () => {
  const old = preview({ id: 'p9', name: 'July launch', images: ['a.jpg', 'b.jpg'], caption: 'kept' });
  const attached = attachPreview(old, 'c1', '2026-08-05T10:00:00.000Z');
  eq(attached.cardId, 'c1', 'it now points at the piece');
  eq(attached.name, 'July launch', 'her label is kept');
  eq(attached.images, ['a.jpg', 'b.jpg'], 'the slides are kept');
  eq(attached.caption, 'kept', 'the caption is kept');
  eq(attached.shareId, old.shareId, 'the public link does not move');
  eq(attached.updatedAt, '2026-08-05T10:00:00.000Z', 'the change is dated');
  eq(old.cardId, undefined, 'and the original is not mutated');
});

test('only the previews nothing points at are offered for attaching', () => {
  const cards = [card({ id: 'c1' })];
  const list = [
    preview({ id: 'p1', cardId: 'c1' }),
    preview({ id: 'p2' }),
    preview({ id: 'p3', cardId: 'deleted-card' }),
  ];
  eq(unattachedPreviews(list, cards).map(p => p.id), ['p2', 'p3'],
    'the never-attached one and the orphan, and never the one already claimed');
});

test('the caption drifts only when the piece has really been rewritten', () => {
  const c = card({ content: 'Her words.' });
  ok(!captionDrift(c, preview({ caption: 'Her words.' })), 'the same words do not drift');
  ok(!captionDrift(c, preview({ caption: ' Her words. ' })), 'nor does whitespace');
  ok(captionDrift(c, preview({ caption: 'Older words.' })), 'a rewrite drifts');
  ok(!captionDrift(card({ content: '' }), preview({ caption: 'x' })),
    'a piece with no words does not overwrite a caption');
  ok(!captionDrift(c, undefined), 'no preview, no drift');
});

test('the slide count is counted from the slides', () => {
  eq(slideLine(preview({ images: [] })), 'No slides yet', 'none is said, not shown as 0');
  eq(slideLine(preview({ images: ['a'] })), '1 slide', 'one');
  eq(slideLine(preview({ images: ['a', 'b', 'c'] })), '3 slides', 'and three');
});

// ── 5. The public link and WhatsApp ──────────────────────────────────────────

test('the public address is /p/<shareId> and nothing else', () => {
  eq(sharePath('4aa6a2ad'), '/p/4aa6a2ad', 'the path');
  eq(shareUrl('https://krnl.app', '4aa6a2ad'), 'https://krnl.app/p/4aa6a2ad', 'the whole link');
  eq(shareUrl('https://krnl.app/', '4aa6a2ad'), 'https://krnl.app/p/4aa6a2ad', 'a trailing slash is not a second slash');
});

test('a share is a wa.me link with the public URL, and never Telegram', () => {
  const href = whatsappHref('https://krnl.app/p/4aa6a2ad');
  ok(href.startsWith('https://wa.me/?text='), 'WhatsApp, opened with the link ready');
  ok(!href.includes('t.me'), 'never Telegram');
  eq(decodeURIComponent(href.split('text=')[1]), 'https://krnl.app/p/4aa6a2ad',
    'the link is the message');
  ok(!href.includes('phone='), 'no number is filled in, so nothing is sent on her behalf');
});

test('a note in front of the link is encoded, not concatenated raw', () => {
  const href = whatsappHref('https://krnl.app/p/x', 'Ready for you');
  eq(decodeURIComponent(href.split('text=')[1]), 'Ready for you https://krnl.app/p/x',
    'the note reads before the link');
});

test('sending and opening are not claimed, because nothing records them', () => {
  const d = deliveryState(preview({}));
  ok(!d.known, 'the product does not know when a link was sent or opened');
  ok(d.line.length > 0, 'so it says that in words');
  ok(!/\bsent on\b|\bopened at\b/i.test(d.line), 'and never states a time it does not have');
  eq(deliveryState(undefined).line, '', 'with no preview there is nothing to say');
});

// ── 6. The gates ─────────────────────────────────────────────────────────────

const gateSet = (over: Partial<{ gates: { id: string; name: string; question: string; kind: 'brand' | 'operational' }[] }> = {}) => ({
  version: 1,
  locked_with_strategy_version: 1,
  locked_at: '2026-07-22T00:00:00.000Z',
  gates: [
    { id: 'g1', name: 'Says one thing', question: 'One idea, not three?', kind: 'brand' as const },
    { id: 'g2', name: 'Sounds like her', question: 'Would she say it out loud?', kind: 'brand' as const },
  ],
  ...over,
});

test('a profile with no gate set is told so, and no pass is invented', () => {
  const r = gateReading({ gateSet: null, operational: OPERATIONAL_GATES, stage: 'posted' });
  ok(!r.known, 'there is nothing to read');
  eq(r.rows, [], 'and nothing is drawn');
  eq(r.headline, '', 'no count is stated');
  ok(r.line.includes('No gates are written'), 'it says what is missing');
});

test('an empty gate set is also said, not padded out', () => {
  const r = gateReading({ gateSet: gateSet({ gates: [] }), operational: [], stage: 'posted' });
  ok(!r.known, 'an empty set has nothing to show');
  eq(r.rows, [], 'no rows');
});

test('the gates are the profile brand gates plus the operational ones', () => {
  const r = gateReading({ gateSet: gateSet(), operational: OPERATIONAL_GATES, stage: 'review' });
  ok(r.known, 'there is a set to read');
  eq(r.rows.map(g => g.id), ['g1', 'g2', 'accuracy', 'format'], 'brand first, then operational');
  eq(r.rows.filter(g => g.kind === 'operational').length, OPERATIONAL_GATES.length,
    'the operational gates never vary');
});

test('the headline is counted from the rows it describes', () => {
  const two = gateReading({ gateSet: gateSet(), operational: [], stage: 'idea' });
  eq(two.headline, '2 gates every piece clears', 'two gates, two counted');
  const four = gateReading({ gateSet: gateSet(), operational: OPERATIONAL_GATES, stage: 'idea' });
  eq(four.headline, '4 gates every piece clears', 'four gates, four counted');
  const one = gateReading({
    gateSet: gateSet({ gates: [{ id: 'g1', name: 'One', question: 'Only?', kind: 'brand' }] }),
    operational: [], stage: 'idea',
  });
  eq(one.headline, '1 gate every piece clears', 'and one is singular');
});

test('a gate is marked only once the piece has come out of review', () => {
  const before = ['idea', 'writing', 'review'] as const;
  for (const stage of before) {
    const r = gateReading({ gateSet: gateSet(), operational: OPERATIONAL_GATES, stage });
    ok(r.rows.every(g => !g.passed), `nothing is ticked at ${stage}`);
  }
  const after = ['ready', 'scheduled', 'posted'] as const;
  for (const stage of after) {
    const r = gateReading({ gateSet: gateSet(), operational: OPERATIONAL_GATES, stage });
    ok(r.rows.every(g => g.passed), `every gate is cleared at ${stage}`);
  }
});

// ── 7. The panel keeps its promises in the source ────────────────────────────

const PANEL = readFileSync(join(ROOT, 'components/creation/PiecePanel.tsx'), 'utf8');

test('the panel takes a piece and a way to close, and nothing else', () => {
  ok(/export default function PiecePanel\(\{ cardId, onClose \}/.test(PANEL),
    'the contract is cardId and onClose');
});

test('the panel does not keep a second copy of the board arithmetic', () => {
  ok(PANEL.includes("from '@/lib/creation/board'"), 'previewFor and unattachedPreviews are imported');
  ok(!/function (previewFor|unattachedPreviews)\b/.test(PANEL), 'and not written again here');
  ok(PANEL.includes("from '@/components/InstagramPost'"), 'the Instagram preview is the existing one');
  ok(!/from '@\/components\/PreviewsView'/.test(PANEL), 'the old previews screen is not reached into');
});

test('off means absent: the panel draws no disabled control', () => {
  ok(!/\bdisabled\b/.test(PANEL), 'nothing is rendered dead');
});

test('it wears the Strategy panel geometry', () => {
  ok(PANEL.includes('md:w-[470px]'), '470px on desktop');
  ok(PANEL.includes('w-full'), 'full width on phone');
  ok(PANEL.includes('bg-paper'), '#faf8f6');
  ok(PANEL.includes('shadow-panel'), 'the panel shadow, from the tokens');
  ok(PANEL.includes('justify-end'), 'and it comes from the right');
});
