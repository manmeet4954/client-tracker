// What the reader can draw, and how a document names itself — 2026-08-11.
//
// Split out of the component so the decisions are testable: "is this a PDF" is
// a rule about filenames and urls, not a piece of layout, and getting it wrong
// means her brand guide opens as a wall of nothing.
//
// Pure. No clock, no React, no fetch.

import type { IntakeDocument } from '../tree/objects.ts';

/** What the reader will do with it. */
export type ReaderKind = 'pdf' | 'image' | 'text' | 'link' | 'other';

const IMAGE = /\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i;
const PDF = /\.pdf(\?|#|$)/i;

/**
 * A stored FILE is judged by what it is; a LINK is always a link, even when it
 * ends in .pdf, because it lives on somebody else's server and will usually
 * refuse to be framed. Showing her a permanently blank box would be worse than
 * saying plainly that it opens elsewhere.
 */
export function readerKind(doc: IntakeDocument): ReaderKind {
  if (doc.kind === 'text') return 'text';
  if (doc.kind === 'link') return 'link';
  const url = doc.url ?? '';
  if (PDF.test(url)) return 'pdf';
  if (IMAGE.test(url)) return 'image';
  // A stored file the browser cannot draw still has its read text, if any.
  return doc.extracted ? 'text' : 'other';
}

/** "Sent by the client, 11 Aug" — who it came from and when, in one line. */
export function whoAndWhen(doc: IntakeDocument): string {
  const who = (doc.given_by ?? '').trim();
  const when = shortDay(doc.received_at);
  if (who && when) return `${who}, ${when}`;
  return who || when || 'Filed';
}

function shortDay(iso: string | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(d)} ${months[Number(m) - 1] ?? m} ${y}`;
}

/**
 * Every document on the profile, newest first, whatever round it arrived under.
 *
 * The round a brief happened to arrive with is an accident of WHEN it came, not
 * a filing decision, and a library that only showed the current round's would
 * hide most of what she has. The reader is handed a per-round lookup so this
 * stays pure and the component keeps owning the body.
 */
export function libraryDocuments(
  forRound: (round: number) => IntakeDocument[],
  maxRound = 40,
): IntakeDocument[] {
  const seen = new Map<string, IntakeDocument>();
  for (let round = 0; round <= maxRound; round++) {
    for (const doc of forRound(round)) {
      if (!seen.has(doc.id)) seen.set(doc.id, doc);
    }
  }
  return [...seen.values()].sort((a, b) => (a.received_at < b.received_at ? 1 : -1));
}
