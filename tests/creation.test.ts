// The restructure, phase 2 — Creation.
//
// Three things are held here, because all three are the kind of thing a later
// "tidy up" would quietly undo:
//
//   1. The six stages are a RELABEL plus ONE insertion. No stored id moved.
//   2. Review is a STATE of a piece, so a preview points at the card it was
//      made for, and a preview that points at nothing is still reachable.
//   3. Every number the board says out loud is counted from the array it
//      describes, at render time.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq, ok, suite, test } from './harness.ts';
import { CONTENT_STAGES } from '../types/index.ts';
import {
  agendaOf, monthCells, needsToday, plural, previewFor, unattachedPreviews,
} from '../lib/creation/board.ts';
import { CREATION_TABS } from '../lib/shell/nav.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

type Card = Parameters<typeof needsToday>[0]['cards'][number];
type Preview = Parameters<typeof unattachedPreviews>[0][number];

const card = (over: Partial<Card>): Card => ({
  id: 'c1', pillarId: '', title: 'A piece', hook: '', content: '',
  stage: 'idea', contentType: '', scheduledDate: '', postUrl: '', notes: '',
  customValues: {}, createdMonth: '2026-08',
  createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
  ...over,
} as Card);

const preview = (over: Partial<Preview>): Preview => ({
  id: 'p1', shareId: 'abc', name: 'July carousel', postType: 'static',
  images: ['a.jpg'], caption: '',
  createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
  ...over,
} as Preview);

// ── 1. Six stages, and not one stored value moved ────────────────────────────

suite('the restructure, phase 2 — six stages, no migration');

test('1. the board reads Idea, Build, Review, Approved, Scheduled, Posted', () => {
  eq(CONTENT_STAGES.map(s => s.label),
    ['Idea', 'Build', 'Review', 'Approved', 'Scheduled', 'Posted'],
    'the six the design and the Piece object both name');
});

test('1b. and the ids underneath them are the ones already in the database', () => {
  // This is the whole point. `writing` still says writing, `ready` still says
  // ready. A card sitting at `ready` yesterday reads "Approved" today and was
  // never rewritten. Change one of these and every profile needs a migration.
  eq(CONTENT_STAGES.map(s => s.id),
    ['idea', 'writing', 'review', 'ready', 'scheduled', 'posted'],
    'the stored ids, in board order');
});

test('1c. review is the only new id, and it sits between build and approved', () => {
  const ids = CONTENT_STAGES.map(s => s.id);
  eq(ids.indexOf('review'), ids.indexOf('writing') + 1, 'straight after Build');
  eq(ids.indexOf('ready'), ids.indexOf('review') + 1, 'and straight before Approved');
});

test('1d. the tree maps all six, so a migration never meets an unknown stage', () => {
  const text = readFileSync(join(ROOT, 'lib/tree/migrate.ts'), 'utf8');
  const map = text.slice(text.indexOf('const STAGE_MAP'), text.indexOf('export function migrateProfile'));
  for (const s of CONTENT_STAGES) {
    ok(new RegExp(`\\b${s.id}:`).test(map), `${s.id} has no canonical mapping`);
  }
  ok(/writing: 'build'/.test(map), 'writing is canonically build');
  ok(/ready: 'approved'/.test(map), 'ready is canonically approved');
});

test('1e. the comment that stops the next agent "cleaning up" the ids is there', () => {
  const text = readFileSync(join(ROOT, 'types/index.ts'), 'utf8');
  ok(/DO NOT "CLEAN THIS UP"/.test(text), 'types/index.ts says it in as many words');
});

// ── 2. Review is a state, not a screen ───────────────────────────────────────

suite('the restructure, phase 2 — review is a state of a piece');

test('2. a preview points at the card it was made for', () => {
  const cards = [card({ id: 'c1' })];
  const p = preview({ id: 'p1', cardId: 'c1' });
  eq(previewFor([p], 'c1')?.id, 'p1', 'the piece finds its preview');
  eq(unattachedPreviews([p], cards), [], 'and nothing is orphaned');
});

test('2b. a preview made before the link existed is NOT lost', () => {
  const cards = [card({ id: 'c1' })];
  const old = preview({ id: 'p-old' });               // no cardId at all
  eq(unattachedPreviews([old], cards).map(p => p.id), ['p-old'], 'it is listed, not deleted');
});

test('2c. and neither is one whose card went away', () => {
  const dangling = preview({ id: 'p-x', cardId: 'gone' });
  eq(unattachedPreviews([dangling], [card({ id: 'c1' })]).map(p => p.id), ['p-x'],
    'a link that resolves to nothing still leaves the preview reachable');
});

test('2d. Board no longer carries a Review section, and Logs took saved replies', () => {
  const board = CREATION_TABS.find(t => t.id === 'board')!;
  const logs = CREATION_TABS.find(t => t.id === 'logs')!;
  ok(board.switches.includes('creation.review'),
    'review still governs the board, because it is a state OF the board');
  ok(!board.switches.includes('creation.funnel_replies'), 'saved replies left the board');
  ok(logs.switches.includes('creation.funnel_replies'), 'and landed in Logs → Pipelines');
});

test('2e. static: the creation page mounts no second preview screen', () => {
  const page = readFileSync(join(ROOT, 'app/profile/[id]/creation/[tab]/page.tsx'), 'utf8');
  ok(!/PreviewsView/.test(page), 'Previews is not a screen inside the shell any more');
  ok(/PiecePanel/.test(page), 'the piece panel is');
  const panel = readFileSync(join(ROOT, 'components/creation/PiecePanel.tsx'), 'utf8');
  ok(/InstagramPost/.test(panel), 'and it reuses the one preview renderer, never a second');
});

// ── 3. Every number is counted from its own array ────────────────────────────

suite('the restructure, phase 2 — counted, never stated');

test('3. needs today: overdue and today, and nothing that is already out', () => {
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

test('3b. an empty strip is empty, not a zero dressed up as work', () => {
  eq(needsToday({ today: '2026-08-04', cards: [], agenda: [] }), [], 'nothing');
});

test('3c. singular and plural, both', () => {
  eq(plural(1, 'preview'), '1 preview', 'one');
  eq(plural(0, 'preview'), '0 previews', 'none');
  eq(plural(4, 'piece'), '4 pieces', 'many');
});

test('3d. the month grid is a real month, and a piece lands on its own day', () => {
  // August 2026 starts on a Saturday, so five leading blanks, then the 1st.
  const cells = monthCells('2026-08', [card({ id: 'a', scheduledDate: '2026-08-04' })]);
  ok(cells.length >= 35 && cells.length % 7 === 0, 'whole weeks, at least the design\'s 35');
  eq(cells.filter(c => c.day !== null).length, 31, 'thirty-one days, counted');
  const fourth = cells.find(c => c.date === '2026-08-04')!;
  eq(fourth.cards.map(c => c.id), ['a'], 'on the fourth, and nowhere else');
  eq(cells.filter(c => c.cards.length > 0).length, 1, 'exactly one cell holds anything');
});

test('3e. a month needing six weeks gets six, rather than losing days', () => {
  const cells = monthCells('2026-05', []);             // 31 days, starts Friday
  eq(cells.filter(c => c.day !== null).length, 31, 'no day is dropped to keep 35 cells');
});

test('3f. the phone agenda is every dated piece, in date order', () => {
  const list = agendaOf([
    card({ id: 'b', scheduledDate: '2026-08-09' }),
    card({ id: 'a', scheduledDate: '2026-08-02' }),
    card({ id: 'n' }),
  ]);
  eq(list.map(c => c.id), ['a', 'b'], 'dated only, earliest first');
});
