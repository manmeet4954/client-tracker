// Creation → Board — the arithmetic, and the guarantees the screen must keep.
//
// The board is the screen she works on every day, so the things tested here are
// the ones a later tidy-up would quietly break:
//
//   1. Every number the board says out loud is COUNTED from the array it
//      describes. The handoff calls this a recurring bug to be treated as a rule.
//   2. Off means absent. An empty thing is not drawn as an empty thing.
//   3. The board reads and nothing moves when the profile is RESTING. The
//      strategy lock is not one of those reasons any more (2026-08-09).
//   4. The board opens the piece panel by asking, never by routing. Another
//      screen owns that panel.
//
// Plain Node, no dependencies. Registered nowhere yet — see docs/phase-notes/board.md.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq, ok, suite, test } from './harness.ts';
import { CONTENT_STAGES } from '../types/index.ts';
import {
  agendaIdOf, agendaOf, bareId, boardCards, boardNote, cardChips, dndId, monthCells,
  needsOpenKey, needsToday, pillarColumns, pillarMixLine, plural, previewFor,
  readNeedsOpen, stageBuckets, unattachedPreviews, writeNeedsOpen,
} from '../lib/creation/board.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BOARD_TSX = readFileSync(join(ROOT, 'components/creation/Board.tsx'), 'utf8');
const SCREEN_TSX = readFileSync(join(ROOT, 'components/shell/Screen.tsx'), 'utf8');
const CREATION_PAGE_TSX = readFileSync(
  join(ROOT, 'app/profile/[id]/creation/[tab]/page.tsx'), 'utf8',
);

type Card = Parameters<typeof needsToday>[0]['cards'][number];
type Pillar = Parameters<typeof pillarColumns>[1][number];
type Preview = Parameters<typeof unattachedPreviews>[0][number];

const card = (over: Partial<Card>): Card => ({
  id: 'c1', pillarId: '', title: 'A piece', hook: '', content: '',
  stage: 'idea', contentType: '', scheduledDate: '', postUrl: '', notes: '',
  customValues: {}, createdMonth: '2026-08',
  createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
  ...over,
} as Card);

const pillar = (over: Partial<Pillar>): Pillar => ({
  id: 'p1', name: 'AI Lane', color: '#3b82f6', createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
} as Pillar);

const preview = (over: Partial<Preview>): Preview => ({
  id: 'pv1', shareId: 'abc', name: 'July carousel', postType: 'static',
  images: ['a.jpg'], caption: '',
  createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
  ...over,
} as Preview);

// ── 1. Needs you today ───────────────────────────────────────────────────────

suite('Board — needs you today');

test('overdue first, then today, and nothing that is already out', () => {
  const rows = needsToday({
    today: '2026-08-04',
    cards: [
      card({ id: 'a', title: 'Late one', scheduledDate: '2026-08-01' }),
      card({ id: 'b', title: 'Today one', scheduledDate: '2026-08-04' }),
      card({ id: 'c', title: 'Next week', scheduledDate: '2026-08-11' }),
      card({ id: 'd', title: 'Already out', scheduledDate: '2026-08-01', stage: 'posted' }),
      card({ id: 'e', title: 'No date' }),
    ],
    agenda: [
      { id: 't1', text: 'Send the invoice', dueDate: '2026-08-04', done: false },
      { id: 't2', text: 'Done already', dueDate: '2026-08-01', done: true },
    ],
  });
  eq(rows.map(r => r.title), ['Late one', 'Today one', 'Send the invoice'],
    'overdue first, then today, and nothing else');
  eq(rows.filter(r => r.overdue).length, 1, 'exactly one has slipped');
  eq(rows[0].cardId, 'a', 'a piece row can open its piece');
});

test('the count pill is the length of the list under it, never a stored figure', () => {
  const rows = needsToday({
    today: '2026-08-04',
    cards: [card({ id: 'a', scheduledDate: '2026-08-04' }), card({ id: 'b', scheduledDate: '2026-08-02' })],
    agenda: [{ id: 't1', text: 'Chase the logo', dueDate: '2026-08-03', done: false }],
  });
  eq(rows.length, 3, 'three rows');
  ok(/\{needs\.length\}/.test(BOARD_TSX), 'and the pill renders needs.length, not a number');
});

test('an empty strip is empty, not a zero dressed up as work', () => {
  eq(needsToday({ today: '2026-08-04', cards: [], agenda: [] }), [], 'nothing');
  ok(/Nothing is due today and nothing has slipped\./.test(BOARD_TSX),
    'and it says so in words rather than drawing a 0');
});

test('the same day is not sorted apart by the first letter of its words', () => {
  const rows = needsToday({
    today: '2026-08-04',
    cards: [card({ id: 'a', title: 'A piece', scheduledDate: '2026-08-04' })],
    agenda: [{ id: 't1', text: 'A task', dueDate: '2026-08-04', done: false }],
  });
  eq(rows.map(r => r.overdue), [false, false], 'both are today');
  eq(rows.map(r => r.when), ['goes live today', 'due today'], 'and both say today');
});

test('a task row knows the agenda item behind it, a piece row does not', () => {
  const rows = needsToday({
    today: '2026-08-04',
    cards: [card({ id: 'a', scheduledDate: '2026-08-04' })],
    agenda: [{ id: 't1', text: 'Chase the logo', dueDate: '2026-08-04', done: false }],
  });
  eq(agendaIdOf(rows[0]), null, 'a piece has no agenda id');
  eq(agendaIdOf(rows[1]), 't1', 'a task hands back the raw id, unprefixed');
});

// ── 2. Remembering the strip ─────────────────────────────────────────────────

suite('Board — the strip remembers, per profile');

test('the key is per profile, because the strip is per profile', () => {
  ok(needsOpenKey('a') !== needsOpenKey('b'), 'two profiles never share one memory');
});

test('anything but the word closed means open', () => {
  eq(readNeedsOpen(null), true, 'never opened before: open');
  eq(readNeedsOpen('open'), true, 'open');
  eq(readNeedsOpen('closed'), false, 'closed');
  eq(readNeedsOpen('clos'), true, 'a half-written value never hides her work');
  eq(readNeedsOpen(writeNeedsOpen(false)), false, 'what it writes, it reads back');
  eq(readNeedsOpen(writeNeedsOpen(true)), true, 'both ways');
});

test('storage is read in an effect, so the server and the first render agree', () => {
  ok(/useState\(true\)/.test(BOARD_TSX), 'the strip starts open on both sides');
  ok(/useEffect\(\(\) => \{\s*try \{ setNeedsOpen\(readNeedsOpen/.test(BOARD_TSX),
    'and the remembered value arrives after hydration');
});

// ── 3. What the board is looking at ──────────────────────────────────────────

suite('Board — the month it draws');

test('a dated piece belongs to its own month, and only that one', () => {
  const cards = [
    card({ id: 'aug', scheduledDate: '2026-08-04' }),
    card({ id: 'sep', scheduledDate: '2026-09-04' }),
  ];
  eq(boardCards(cards, '2026-08').map(c => c.id), ['aug'], 'August');
  eq(boardCards(cards, '2026-09').map(c => c.id), ['sep'], 'September');
});

test('a piece with no date yet belongs to every month until it gets one', () => {
  const idea = card({ id: 'idea', scheduledDate: '', createdMonth: '' });
  eq(boardCards([idea], '2026-08').map(c => c.id), ['idea'], 'August');
  eq(boardCards([idea], '2027-02').map(c => c.id), ['idea'], 'and February next year');
});

test('a dated piece beats the month it was created in', () => {
  const moved = card({ id: 'm', createdMonth: '2026-07', scheduledDate: '2026-08-04' });
  eq(boardCards([moved], '2026-07'), [], 'not where it was written');
  eq(boardCards([moved], '2026-08').map(c => c.id), ['m'], 'where it goes live');
});

// ── 4. The six stages ────────────────────────────────────────────────────────

suite('Board — six columns, counted');

test('the columns are the six stages from types, in order, never a hardcoded list', () => {
  eq(stageBuckets(CONTENT_STAGES, []).map(b => b.stage.label),
    ['Idea', 'Build', 'Review', 'Approved', 'Scheduled', 'Posted'], 'the six');
  ok(/CONTENT_STAGES/.test(BOARD_TSX), 'the screen reads them from types');
  ok(!/'Approved'|"Approved"/.test(BOARD_TSX), 'and spells none of them itself');
});

test('every piece lands in exactly one column, and the counts add up', () => {
  const cards = [
    card({ id: 'a', stage: 'idea' }),
    card({ id: 'b', stage: 'idea' }),
    card({ id: 'c', stage: 'review' }),
    card({ id: 'd', stage: 'posted' }),
  ];
  const buckets = stageBuckets(CONTENT_STAGES, cards);
  eq(buckets.reduce((n, b) => n + b.cards.length, 0), cards.length, 'nothing is lost or doubled');
  eq(buckets.find(b => b.stage.id === 'idea')!.cards.map(c => c.id), ['a', 'b'], 'idea holds two');
  eq(buckets.find(b => b.stage.id === 'ready')!.cards, [], 'approved holds none, and is still drawn');
});

test('Posted is the one column with the quieter ground', () => {
  ok(/stage\.id === 'posted' \? 'bg-sunken-muted' : 'bg-sunken'/.test(BOARD_TSX),
    '#f1eeeb for Posted, #f6f3f0 for the rest');
  ok(/w-\[206px\]/.test(BOARD_TSX), 'columns are 206px');
});

// ── 5. Pillars ───────────────────────────────────────────────────────────────

suite('Board — pillars, and the mix target');

test('the share is counted from the pieces drawn beneath it', () => {
  const pillars = [pillar({ id: 'p1', name: 'AI Lane', targetPct: 35 }), pillar({ id: 'p2', name: 'Proof' })];
  const cards = [
    card({ id: 'a', pillarId: 'p1' }), card({ id: 'b', pillarId: 'p1' }),
    card({ id: 'c', pillarId: 'p1' }), card({ id: 'd', pillarId: 'p2' }),
  ];
  const cols = pillarColumns(cards, pillars);
  eq(cols.map(c => c.label), ['AI Lane', 'Proof'], 'a column per pillar');
  eq(cols[0].sharePct, 75, 'three of four');
  eq(cols[1].sharePct, 25, 'one of four');
  eq(cols[0].targetPct, 35, 'the target is the strategy figure, stated as a target');
  eq(cols[1].targetPct, null, 'a pillar with no target has none, rather than a 0');
});

test('the unsorted column exists only when something is actually unsorted', () => {
  const pillars = [pillar({ id: 'p1' })];
  eq(pillarColumns([card({ id: 'a', pillarId: 'p1' })], pillars).length, 1,
    'off means absent: no empty "No pillar yet"');
  const loose = pillarColumns([card({ id: 'a', pillarId: '' }), card({ id: 'b', pillarId: 'gone' })], pillars);
  eq(loose.map(c => c.label), ['AI Lane', 'No pillar yet'], 'and it appears when it has to');
  eq(loose[1].cards.map(c => c.id), ['a', 'b'], 'both the blank and the dangling one');
});

test('an empty board is 0%, never a division by nothing', () => {
  const cols = pillarColumns([], [pillar({ id: 'p1', targetPct: 35 })]);
  eq(cols[0].sharePct, 0, 'zero, and finite');
  eq(pillarMixLine(cols[0]), 'Nothing here this month.', 'and it says so in words');
});

test('the mix line counts, in singular and plural', () => {
  const one = pillarColumns([card({ id: 'a', pillarId: 'p1' })], [pillar({ id: 'p1' })])[0];
  eq(pillarMixLine(one), '1 piece, 100% of the board', 'one piece');
  const cards = [card({ id: 'a', pillarId: 'p1' }), card({ id: 'b', pillarId: 'p1' }), card({ id: 'c' })];
  const many = pillarColumns(cards, [pillar({ id: 'p1' })])[0];
  eq(pillarMixLine(many), '2 pieces, 67% of the board', 'two of three');
});

test('pillars stack on a phone and never scroll sideways there', () => {
  ok(/flex flex-col items-stretch gap-\[11px\] md:flex-row/.test(BOARD_TSX),
    'a column on the phone, a row from md up');
  ok(!/(?<!md:)overflow-x-auto[^"]*md:flex-row/.test(BOARD_TSX),
    'the sideways scroll is behind md:');
});

// ── 6. Month, and its phone form ─────────────────────────────────────────────

suite('Board — the month, and the agenda it becomes');

test('the grid is a real month, and a piece lands on its own day', () => {
  // August 2026 starts on a Saturday, so five leading blanks, then the 1st.
  const cells = monthCells('2026-08', [card({ id: 'a', scheduledDate: '2026-08-04' })]);
  ok(cells.length >= 35 && cells.length % 7 === 0, 'whole weeks, at least the design\'s 35');
  eq(cells.filter(c => c.day !== null).length, 31, 'thirty-one days, counted');
  eq(cells.find(c => c.date === '2026-08-04')!.cards.map(c => c.id), ['a'], 'on the fourth');
  eq(cells.filter(c => c.cards.length > 0).length, 1, 'exactly one cell holds anything');
});

test('a month needing six weeks gets six, rather than losing days', () => {
  eq(monthCells('2026-05', []).filter(c => c.day !== null).length, 31,
    'no day is dropped to keep 35 cells');
});

test('a nonsense month draws nothing rather than guessing', () => {
  eq(monthCells('', []), [], 'empty');
  eq(monthCells('not-a-month', []), [], 'still empty');
});

test('the phone agenda is every dated piece, in date order', () => {
  const list = agendaOf([
    card({ id: 'b', scheduledDate: '2026-08-09' }),
    card({ id: 'a', scheduledDate: '2026-08-02' }),
    card({ id: 'n' }),
  ]);
  eq(list.map(c => c.id), ['a', 'b'], 'dated only, earliest first');
});

test('the month headline counts the agenda it is written above', () => {
  ok(/plural\(listed\.length, 'dated piece'\)/.test(BOARD_TSX),
    'the figure comes from the same array both viewports render');
  ok(/md:hidden/.test(BOARD_TSX) && /hidden .*md:block/.test(BOARD_TSX),
    'grid from md up, agenda list below it');
  ok(/min-h-\[62px\]/.test(BOARD_TSX), 'cells are 62px');
});

// ── 7. Read only ─────────────────────────────────────────────────────────────
//
// Her decision, 2026-08-09: the strategy lock no longer makes the board read
// only. Recording always works. What is left is a profile that is archived or
// resting, and a board switch she moved to `history`.

suite('Board — read only when the profile is resting, not when strategy is open');

test('the note under the views says which state the board is in', () => {
  eq(boardNote(true), 'Read only. This profile is resting, so nothing here moves.', 'a resting profile');
  eq(boardNote(false), 'Drag a piece to move it. Review and scheduling are states, not screens.',
    'a working profile');
  ok(!/Strategy/.test(boardNote(true)), 'and it never blames the strategy for it');
});

test('nothing moves and nothing is ticked off while it reads', () => {
  ok(/function onDragEnd[\s\S]{0,200}?if \(readOnly \|\| !e\.over\) return;/.test(BOARD_TSX),
    'a drop is refused');
  ok(/function tickOff[\s\S]{0,120}?if \(readOnly\) return;/.test(BOARD_TSX),
    'and so is ticking a task off');
  ok(/draggable=\{draggable \? undefined : false\}/.test(BOARD_TSX),
    'the card itself carries draggable="false"');
  ok(/useDroppable\(\{ id: dndId\('col', stage\.id\), disabled: readOnly \}\)/.test(BOARD_TSX),
    'and the columns stop being drop targets');
});

test('the two shapes of the board never register the same drag id twice', () => {
  // Both are in the DOM at once, one hidden by CSS. Same id twice would mean one
  // silently winning, and a piece dropped into the wrong shape's column.
  eq(dndId('col', 'idea'), 'col:idea', 'the column');
  eq(dndId('row', 'idea'), 'row:idea', 'the stacked section');
  ok(dndId('col', 'idea') !== dndId('row', 'idea'), 'never equal');
  eq(bareId('col:idea'), 'idea', 'and the drop handler reads the stage back out');
  eq(bareId('row:c-123'), 'c-123', 'a card id too');
  eq(bareId('idea'), 'idea', 'an id with no surface is left alone');
});

test('the banner is the shell\'s one banner, not a second copy of the words', () => {
  ok(/import \{ LockBanner, Segmented \} from '@\/components\/shell\/Screen'/.test(BOARD_TSX),
    'one home for the lock copy');
  ok(!/Strategy is not locked yet/.test(BOARD_TSX), 'the board never respells it');
});

test('the lock banner says the work still saves, and never claims nothing can be written', () => {
  const banner = SCREEN_TSX.slice(SCREEN_TSX.indexOf('export function LockBanner'));
  ok(!/nothing can be written here/.test(banner),
    'the old sentence is gone: it stopped being true on 2026-08-09');
  ok(!/pieces\s+cannot move/.test(banner), 'and so is the half about the pieces');
  ok(/still saves/.test(banner), 'it says the recording still saves');
  ok(/Strategy is still to be locked/.test(banner), 'and it still says what is waiting');
  ok(!/—/.test(banner), 'no em dashes in anything she reads');
});

test('the lock is not what makes a Creation screen read only', () => {
  ok(!/readOnly: beforeLock/.test(CREATION_PAGE_TSX),
    'read-only no longer comes from the lock');
  ok(/const writable = \(switchId: string\) =>/.test(CREATION_PAGE_TSX),
    'it comes from one helper');
  ok(/renderState\(\{ \.\.\.profile, strategy_locked: true \}, switchId, kind\) === 'active'/
    .test(CREATION_PAGE_TSX),
    'which asks the ONE resolver, with the lock set aside and nothing re-implemented');
  ok(/readOnly: !writable\('creation\.board'\)/.test(CREATION_PAGE_TSX),
    'and the board is read-only only when its own switch or the profile says so');
  // Seeing is decided the ordinary way, so nothing here widens what a client sees.
  ok(/renderState\(profile, s\.switch, kind\)/.test(CREATION_PAGE_TSX),
    'visibility still asks with the real profile');
});

// ── 8. The piece panel is somebody else's screen ─────────────────────────────

suite('Board — one thing, one home');

test('a card asks for the panel and never routes to it', () => {
  ok(/onOpenPiece: \(cardId: string\) => void;/.test(BOARD_TSX), 'the contract is a prop');
  ok(!/next\/navigation/.test(BOARD_TSX), 'the board does not route');
  ok(!/PiecePanel/.test(BOARD_TSX), 'and does not build the panel');
});

test('a preview belongs to its piece, and one that belongs to nothing is kept', () => {
  const cards = [card({ id: 'c1' })];
  const attached = preview({ id: 'pv1', cardId: 'c1' });
  eq(previewFor([attached], 'c1')?.id, 'pv1', 'the piece finds its preview');
  eq(unattachedPreviews([attached], cards), [], 'and nothing is orphaned');
  eq(unattachedPreviews([preview({ id: 'old' })], cards).map(p => p.id), ['old'],
    'a preview made before the link existed is listed, not deleted');
  eq(unattachedPreviews([preview({ id: 'x', cardId: 'gone' })], cards).map(p => p.id), ['x'],
    'and neither is one whose card went away');
});

test('the orphan strip is drawn only when there are orphans', () => {
  ok(/\{orphans\.length > 0 && \(/.test(BOARD_TSX), 'off means absent');
  ok(/plural\(orphans\.length, 'preview'\)/.test(BOARD_TSX), 'and its headline is counted');
});

// ── 9. Chips and small copy ──────────────────────────────────────────────────

suite('Board — the card, and what it says');

test('a card shows only the chips it actually has', () => {
  const pillars = [pillar({ id: 'p1', name: 'AI Lane' })];
  eq(cardChips(card({ pillarId: 'p1', contentType: 'Carousel', platform: 'Instagram' }), pillars),
    ['AI Lane', 'Carousel', 'Instagram'], 'pillar, format, platform, in that order');
  eq(cardChips(card({ pillarId: '', contentType: '  ', platform: '' }), pillars), [],
    'a bare card draws no chip strip at all');
  eq(cardChips(card({ pillarId: 'gone', contentType: 'Reel' }), pillars), ['Reel'],
    'a pillar that no longer exists is simply not named');
});

test('singular and plural, both', () => {
  eq(plural(1, 'preview'), '1 preview', 'one');
  eq(plural(0, 'preview'), '0 previews', 'none');
  eq(plural(4, 'piece'), '4 pieces', 'many');
  eq(plural(1, 'dated piece'), '1 dated piece', 'a two-word noun still works');
});

test('the copy carries no em dashes', () => {
  const copy = BOARD_TSX.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  ok(!copy.includes('—'), 'house rule: no em dashes in UI copy');
});
