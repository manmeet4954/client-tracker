// The documentation reader — 2026-08-11.
//
// The rules that decide whether her brand guide opens or shows a blank box.

import { suite, test, eq } from './harness.ts';
import { libraryDocuments, readerKind, whoAndWhen } from '../lib/intake/library.ts';
import type { IntakeDocument } from '../lib/tree/objects.ts';

const doc = (over: Partial<IntakeDocument>): IntakeDocument => ({
  id: 'd', round: 0, title: 'A thing', kind: 'file', given_by: 'client',
  received_at: '2026-08-11T09:00:00.000Z', extraction_state: 'none', ...over,
} as IntakeDocument);

suite('the documentation reader');

test('a stored PDF is drawn as a PDF', () => {
  eq(readerKind(doc({ url: 'https://x.co/assets/brand-guide.pdf' })), 'pdf', 'a stored pdf');
  eq(readerKind(doc({ url: 'https://x.co/a/b.PDF?token=1' })), 'pdf', 'case and query do not fool it');
});

test('images are drawn as images', () => {
  eq(readerKind(doc({ url: 'https://x.co/a.png' })), 'image', 'png');
  eq(readerKind(doc({ url: 'https://x.co/a.jpeg?v=2' })), 'image', 'jpeg with a query');
});

test('a link stays a link, even a link to a pdf', () => {
  // A Canva or Drive link that ends .pdf will usually refuse to be framed, and
  // a permanently blank box reads as a broken app.
  eq(readerKind(doc({ kind: 'link', url: 'https://drive.google.com/x.pdf' })), 'link', 'a drive pdf link');
  eq(readerKind(doc({ kind: 'link', url: 'https://canva.com/design/abc' })), 'link', 'a canva link');
});

test('a paste reads as its own words', () => {
  eq(readerKind(doc({ kind: 'text', text: 'They want fewer reels.' })), 'text', 'a paste');
});

test('an unreadable file falls back to whatever text was read from it', () => {
  eq(readerKind(doc({ url: 'https://x.co/a.docx' })), 'other', 'nothing read, nothing to draw');
  eq(
    readerKind(doc({ url: 'https://x.co/a.docx', extracted: 'The brief said...' })),
    'text',
    'read text is better than an apology',
  );
});

test('a document says who sent it and when', () => {
  eq(whoAndWhen(doc({ given_by: 'client', received_at: '2026-08-11T09:00:00.000Z' })), 'client, 11 Aug 2026', 'who and when');
  eq(whoAndWhen(doc({ given_by: '', received_at: '' })), 'Filed', 'never a blank line');
});

test('the library gathers every round, newest first, with no duplicates', () => {
  const byRound: Record<number, IntakeDocument[]> = {
    0: [doc({ id: 'a', received_at: '2026-08-01T09:00:00.000Z' })],
    2: [
      doc({ id: 'b', received_at: '2026-08-09T09:00:00.000Z' }),
      doc({ id: 'a', received_at: '2026-08-01T09:00:00.000Z' }),
    ],
  };
  const all = libraryDocuments(r => byRound[r] ?? [], 4);
  eq(all.length, 2, 'the same document in two rounds is one document');
  eq(all[0].id, 'b', 'newest first');
});
