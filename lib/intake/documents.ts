// Documents as the third intake route — spec 33 §2.
//
// She onboards a client who hands over a brief and a strategy deck instead of
// typing answers. This file is how that material arrives, where it lives, and
// what we are willing to CLAIM about having read it.
//
// Four things this file holds to, and none of them is a preference:
//
// 1. A document is a ROUTE, never a new kind of knowledge (PLAN §3.1). It never
//    invents a parameter and it never answers one by itself. `answers_parameter`
//    says which question it was handed over in answer to; it does not make that
//    question answered. Only a person answering answers a question.
// 2. It is stored with the ANSWERS, because that is what it is: raw material the
//    client gave, kept exactly as it arrived and never altered (S11). The path is
//    append-only and refuses amendments, so nothing here ever edits one back.
// 3. Extraction is honest, exactly as spec 32 §4 requires. `ok` means the text is
//    genuinely in hand. `not-attempted` means nobody has tried, and says so.
//    `unreadable` means there is no text to get, and says why in plain words.
//    Nothing is ever presented as read when it was not.
// 4. A document whose text could not be read is NEVER silently dropped. It stays
//    listable and reportable by title, source and reason, so anything reading
//    context can say the thing exists rather than answering as though it had
//    read it.
//
// Every count in every line here is counted from the array it describes.

import type { ProfileBody } from '../tree/body.ts';
import { putEntry, readPath } from '../tree/body.ts';
import type { IntakeDocument } from '../tree/objects.ts';
import { ANSWERS_PATH } from './rounds.ts';
import { plural, shortDate } from './screens.ts';

/**
 * The discriminator on the stored entry. `context/intake/answers` holds entries
 * of type `answer` by declaration, so a document rides in the same entry type
 * and is told apart by this field. Nothing else at that path carries it.
 */
export const DOCUMENT_RECORD = 'document';

export type DocumentKind = IntakeDocument['kind'];
export type ExtractionState = IntakeDocument['extraction_state'];

// ── What kind of thing is this, really ───────────────────────────────────────

/** Pictures. A photo of a page has no text layer, and never will without OCR. */
const PICTURE = [
  'jpg', 'jpeg', 'png', 'heic', 'heif', 'webp', 'gif', 'tif', 'tiff', 'bmp', 'avif',
];

/** Video and audio are out of scope entirely (spec 32 §4). They are assets. */
const MOVING = ['mp4', 'mov', 'm4v', 'webm', 'avi', 'mkv', 'mp3', 'm4a', 'wav', 'aac', 'flac'];

/** Formats a parser could read, once a parser exists. See `readDocumentText`. */
const PARSABLE = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'key', 'pages', 'odt', 'odp', 'rtf'];

/** Hosts that put the material behind a login. A link to one stores fine and is
 *  hers to open; its text cannot be fetched from here, and the record says so. */
const LOGIN_HOSTS = [
  'drive.google.com', 'docs.google.com', 'notion.so', 'notion.site', 'canva.com',
  'figma.com', 'dropbox.com', 'sharepoint.com', 'onedrive.live.com', 'box.com',
  'app.slack.com', 'mail.google.com', 'linear.app', 'airtable.com',
];

export function extensionOf(urlOrName = ''): string {
  const clean = urlOrName.split('?')[0].split('#')[0];
  const dot = clean.lastIndexOf('.');
  if (dot < 0) return '';
  const ext = clean.slice(dot + 1).toLowerCase();
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : '';
}

export function hostOf(url = ''): string {
  const m = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i.exec(url.trim());
  if (!m) return '';
  return m[1].toLowerCase().replace(/^www\./, '').split(':')[0];
}

export function behindLogin(url = ''): boolean {
  const host = hostOf(url);
  if (!host) return false;
  return LOGIN_HOSTS.some(h => host === h || host.endsWith(`.${h}`));
}

// ── The honest states (spec 32 §4) ───────────────────────────────────────────

export interface ClassifyInput {
  kind: DocumentKind;
  url?: string;
  text?: string;
  /** The browser's mime type, when a file picker gave us one. */
  mime?: string;
  /** The original file name, when the stored url has lost it. */
  filename?: string;
  /** Set when the person adding it says plainly that it needs a login. */
  needsLogin?: boolean;
}

export interface Classification {
  extraction_state: ExtractionState;
  /** The readable text when there genuinely is some. Null when there is not. */
  extracted: string | null;
  /** One plain line saying what was read, or why nothing was. */
  reason: string;
}

/**
 * What we are willing to claim about this thing's text, decided from what it is
 * rather than from hope. Nothing here fetches anything: a state of
 * `not-attempted` is the literal truth that nobody has tried yet.
 */
export function classifyDocument(input: ClassifyInput): Classification {
  if (input.kind === 'text') {
    const text = (input.text ?? '').trim();
    if (!text) {
      return { extraction_state: 'none', extracted: null, reason: 'Nothing was written in it.' };
    }
    return {
      extraction_state: 'ok', extracted: input.text ?? '',
      reason: 'Read in full, exactly as it was pasted.',
    };
  }

  if (input.kind === 'link') {
    const url = input.url ?? '';
    if (!url.trim()) {
      return { extraction_state: 'none', extracted: null, reason: 'No link was given.' };
    }
    if (input.needsLogin || behindLogin(url)) {
      return {
        extraction_state: 'unreadable', extracted: null,
        reason: 'This link needs a login, so its words cannot be read from here. '
          + 'It is kept as a link to open.',
      };
    }
    return {
      extraction_state: 'not-attempted', extracted: null,
      reason: 'Nothing has read this link yet. It is kept and can be opened.',
    };
  }

  // A file.
  const ext = extensionOf(input.filename || input.url || '');
  const mime = (input.mime ?? '').toLowerCase();

  if (PICTURE.includes(ext) || mime.startsWith('image/')) {
    return {
      extraction_state: 'unreadable', extracted: null,
      reason: 'This is a picture, so there are no words in it to read. '
        + 'It is kept and can be opened, but nothing has read it.',
    };
  }
  if (MOVING.includes(ext) || mime.startsWith('video/') || mime.startsWith('audio/')) {
    return {
      extraction_state: 'unreadable', extracted: null,
      reason: 'Video and sound are not read here. This one belongs in assets.',
    };
  }
  if (PARSABLE.includes(ext) || mime === 'application/pdf') {
    return {
      extraction_state: 'not-attempted', extracted: null,
      reason: 'Nothing has read this yet. A file like this needs a reader we have not added, '
        + 'so only its name is known.',
    };
  }
  return {
    extraction_state: 'not-attempted', extracted: null,
    reason: 'Nothing has read this yet. The file is kept and can be opened.',
  };
}

/**
 * The stored record. It is `IntakeDocument` plus the one plain sentence saying
 * what happened when we tried to read it, kept beside the state so the two can
 * never drift apart into a reassuring line the state disagrees with.
 */
export type IntakeDocumentRecord = IntakeDocument & { reason?: string };

const FALLBACK_LINES: Record<ExtractionState, string> = {
  ok: 'Read in full.',
  none: 'There is nothing in it to read.',
  unreadable: 'Its words cannot be read. It is kept and can be opened.',
  'not-attempted': 'Nothing has read this yet. It is kept and can be opened, '
    + 'and only its name is known.',
};

/** The line the screen shows, and the line a context reader repeats. */
export function extractionLine(doc: Pick<IntakeDocumentRecord, 'extraction_state' | 'reason'>): string {
  return (doc.reason ?? '').trim() || FALLBACK_LINES[doc.extraction_state];
}

/** True when the record must draw its state dot: the text is not in hand. */
export function unread(doc: Pick<IntakeDocument, 'extraction_state'>): boolean {
  return doc.extraction_state !== 'ok';
}

// ── The extraction seam ──────────────────────────────────────────────────────

/**
 * The one function a parser drops into. Nothing is registered today, and
 * `readDocumentText` says `not-attempted` for as long as that is true — which
 * is the honest answer, not a placeholder pretending to be one.
 *
 * Adding a parser is a dependency, and a dependency is her decision recorded
 * under CLAUDE.md rule 5. The handoff note names the exact library.
 */
export type DocumentTextReader = (
  source: { kind: DocumentKind; url?: string; filename?: string; mime?: string },
) => Promise<string | null>;

const READERS: Partial<Record<DocumentKind, DocumentTextReader>> = {};

export function registerDocumentTextReader(kind: DocumentKind, reader: DocumentTextReader | null): void {
  if (reader) READERS[kind] = reader;
  else delete READERS[kind];
}

export function documentTextReaderInstalled(kind: DocumentKind): boolean {
  return !!READERS[kind];
}

/**
 * Try to read a document's words. With no reader installed for its kind this
 * returns `not-attempted` and nothing else: it never guesses, and it never
 * downgrades an `unreadable` verdict into a hopeful one.
 */
export async function readDocumentText(input: ClassifyInput): Promise<Classification> {
  const first = classifyDocument(input);
  if (first.extraction_state !== 'not-attempted') return first;

  const reader = READERS[input.kind];
  if (!reader) return first;

  try {
    const text = await reader({
      kind: input.kind, url: input.url, filename: input.filename, mime: input.mime,
    });
    const trimmed = (text ?? '').trim();
    if (!trimmed) {
      return {
        extraction_state: 'unreadable', extracted: null,
        reason: 'A reader opened it and found no words in it. It is kept and can be opened.',
      };
    }
    return { extraction_state: 'ok', extracted: text ?? '', reason: 'Read in full.' };
  } catch {
    return {
      extraction_state: 'not-attempted', extracted: null,
      reason: 'Reading it did not finish. It is kept and can be opened, and only its name is known.',
    };
  }
}

// ── Reading them back ────────────────────────────────────────────────────────

function isDocumentEntry(data: Record<string, unknown>): boolean {
  return data.record === DOCUMENT_RECORD;
}

function toDocument(id: string, createdAt: string, data: Record<string, unknown>): IntakeDocumentRecord {
  const kind = (data.kind as DocumentKind) ?? 'text';
  return {
    id,
    round: typeof data.round === 'number' ? data.round : 0,
    title: (data.title as string) ?? '',
    kind,
    url: (data.url as string) || undefined,
    text: (data.text as string) || undefined,
    given_by: (data.given_by as string) ?? 'unknown',
    received_at: (data.received_at as string) || createdAt,
    extracted: (data.extracted as string) ?? null,
    extraction_state: (data.extraction_state as ExtractionState) ?? 'not-attempted',
    covers: Array.isArray(data.covers) ? (data.covers as string[]) : undefined,
    answers_parameter: (data.answers_parameter as string) || undefined,
    reason: (data.reason as string) || undefined,
  };
}

/** Every document handed over, oldest first. Optionally one round's only. */
export function readDocuments(body: ProfileBody, round?: number): IntakeDocumentRecord[] {
  return readPath(body, ANSWERS_PATH)
    .filter(e => isDocumentEntry(e.data as Record<string, unknown>))
    .map(e => toDocument(e.id, e.created_at, e.data as Record<string, unknown>))
    .filter(d => round === undefined || d.round === round)
    .sort((a, b) => (a.received_at < b.received_at ? -1 : a.received_at > b.received_at ? 1 : 0));
}

/** The ones handed over in answer to one question, rather than to the round. */
export function documentsForParameter<T extends IntakeDocument>(docs: T[], parameterId: string): T[] {
  return docs.filter(d => d.answers_parameter === parameterId);
}

/** The ones given to the round as a whole, answering no single question. */
export function documentsForRoundOnly<T extends IntakeDocument>(docs: T[]): T[] {
  return docs.filter(d => !d.answers_parameter);
}

// ── Writing one ──────────────────────────────────────────────────────────────

export interface AddDocumentInput {
  round: number;
  title?: string;
  kind: DocumentKind;
  url?: string;
  text?: string;
  mime?: string;
  filename?: string;
  needsLogin?: boolean;
  given_by: string;
  /** Set only when it was handed over in answer to ONE question (§2). */
  answers_parameter?: string;
  now: string;
  writer?: 'owner' | 'client';
  /** A classification already done, e.g. by a server-side reader. */
  classification?: Classification;
}

export class DocumentRefused extends Error {}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
}

/** A title, from what we were given, without inventing anything. */
export function titleFor(input: { title?: string; kind: DocumentKind; url?: string; text?: string }): string {
  const given = (input.title ?? '').trim();
  if (given) return given;
  if (input.kind === 'link') {
    const host = hostOf(input.url ?? '');
    return host ? `A link on ${host}` : 'A link';
  }
  if (input.kind === 'file') {
    const clean = (input.url ?? '').split('?')[0].split('#')[0];
    const name = clean.split('/').pop() ?? '';
    return name || 'A file';
  }
  const words = (input.text ?? '').trim().split(/\s+/).slice(0, 7).join(' ');
  return words ? `${words}${(input.text ?? '').trim().split(/\s+/).length > 7 ? '…' : ''}` : 'Pasted text';
}

/**
 * A stable id that does not collide. The answers path is append-only: writing
 * an id that is already there throws, and that is the guarantee working, not a
 * bug to route around. So the id counts up against what is already stored.
 */
export function nextDocumentId(body: ProfileBody, round: number, title: string): string {
  const base = `d${round}-${slug(title) || 'document'}`;
  const taken = new Set(readPath(body, ANSWERS_PATH).map(e => e.id));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/**
 * Store one. Append-only, never altered afterwards (S11).
 *
 * Note what is NOT set here: `covers`. A document proposes, she decides
 * (PLAN §5.1 item 4), so what it speaks to is written during her curation pass
 * and never guessed on the way in.
 */
export function addDocument(
  body: ProfileBody, input: AddDocumentInput,
): { body: ProfileBody; document: IntakeDocumentRecord } {
  const kind = input.kind;
  if (kind === 'file' && !(input.url ?? '').trim()) {
    throw new DocumentRefused('a file needs its stored url');
  }
  if (kind === 'link' && !(input.url ?? '').trim()) {
    throw new DocumentRefused('a link needs the link');
  }
  if (kind === 'text' && !(input.text ?? '').trim()) {
    throw new DocumentRefused('there is nothing in this one to keep');
  }

  const title = titleFor({ title: input.title, kind, url: input.url, text: input.text });
  const c = input.classification ?? classifyDocument({
    kind, url: input.url, text: input.text, mime: input.mime,
    filename: input.filename, needsLogin: input.needsLogin,
  });

  const document: IntakeDocumentRecord = {
    id: nextDocumentId(body, input.round, title),
    round: input.round,
    title,
    kind,
    url: (input.url ?? '').trim() || undefined,
    text: kind === 'text' ? input.text : undefined,
    given_by: input.given_by,
    received_at: input.now,
    extracted: c.extracted,
    extraction_state: c.extraction_state,
    answers_parameter: input.answers_parameter,
    reason: c.reason,
  };

  const data: Record<string, unknown> = {
    record: DOCUMENT_RECORD,
    round: document.round,
    title: document.title,
    kind: document.kind,
    url: document.url,
    text: document.text,
    given_by: document.given_by,
    received_at: document.received_at,
    extracted: document.extracted,
    extraction_state: document.extraction_state,
    answers_parameter: document.answers_parameter,
    reason: document.reason,
  };

  const next = putEntry(body, ANSWERS_PATH, {
    id: document.id, type: 'answer', data,
  }, { writer: input.writer ?? 'owner', now: input.now });

  return { body: next, document };
}

// ── What the screen says, and what a context reader repeats ──────────────────

const KIND_WORDS: Record<DocumentKind, string> = {
  file: 'a file',
  link: 'a link',
  text: 'pasted text',
};

export function kindWords(kind: DocumentKind): string {
  return KIND_WORDS[kind];
}

/** "a file, from Shiva, 4 Jun". Never a count, never a claim about reading. */
export function sourceWords(doc: IntakeDocument): string {
  const parts = [KIND_WORDS[doc.kind], `from ${doc.given_by}`];
  const when = shortDate(doc.received_at);
  if (when) parts.push(when);
  return parts.join(', ');
}

/**
 * The summary line on the round card. Counted from the array it describes, at
 * the moment it is drawn.
 */
export function documentsLine(docs: Pick<IntakeDocument, 'extraction_state'>[]): string {
  if (docs.length === 0) return 'Nothing handed over on this round yet.';
  const read = docs.filter(d => d.extraction_state === 'ok').length;
  const notRead = docs.length - read;
  const head = `${docs.length} ${plural(docs.length, 'thing', 'things')} handed over.`;
  if (notRead === 0) return `${head} All of them read.`;
  if (read === 0) {
    return `${head} None of ${plural(docs.length, 'it', 'them')} read yet, so only ${plural(docs.length, 'its name is', 'their names are')} known.`;
  }
  return `${head} ${read} read, ${notRead} not.`;
}

export interface DocumentContextEntry {
  id: string;
  title: string;
  kind: DocumentKind;
  source: string;
  state: ExtractionState;
  /** The plain reason. Always present, whatever the state. */
  note: string;
  /** The words, only when they were genuinely read. Null otherwise, always. */
  text: string | null;
  /** One line, safe to hand to anything reading context. */
  line: string;
}

/**
 * THE RULE THAT MATTERS MOST (spec 32 §4, PLAN §5.2 applied to reading).
 *
 * Every document appears here, including every one whose text could not be
 * read. An unreadable document is reported by title, source and reason, so a
 * reader can say "there is a deck here that nobody has read" instead of
 * answering as though it had read it. Nothing is filtered out for being
 * inconvenient.
 */
export function documentContext(docs: IntakeDocumentRecord[]): DocumentContextEntry[] {
  return docs.map(doc => {
    const source = sourceWords(doc);
    const read = doc.extraction_state === 'ok';
    const note = extractionLine(doc);
    return {
      id: doc.id,
      title: doc.title,
      kind: doc.kind,
      source,
      state: doc.extraction_state,
      note,
      text: read ? (doc.extracted ?? doc.text ?? '') : null,
      line: read
        ? `${doc.title} (${source}). Read in full.`
        : `${doc.title} (${source}). Not read: ${note}`,
    };
  });
}

/** The one line a packet header carries, counted from the array. */
export function documentContextHeader(docs: Pick<IntakeDocument, 'extraction_state'>[]): string {
  if (docs.length === 0) return 'Nothing was handed over.';
  const notRead = docs.filter(d => d.extraction_state !== 'ok').length;
  if (notRead === 0) {
    return `${docs.length} ${plural(docs.length, 'thing was', 'things were')} handed over, and all of ${plural(docs.length, 'it', 'them')} read.`;
  }
  return `${docs.length} ${plural(docs.length, 'thing was', 'things were')} handed over. `
    + `${notRead} of ${plural(docs.length, 'it', 'them')} ${plural(notRead, 'has', 'have')} not been read, `
    + `so ${plural(notRead, 'it is', 'they are')} listed by name only.`;
}
