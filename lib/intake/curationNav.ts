// Curation, spec 33 §3 and the second half of §4 — the logic, without React.
//
// Two jobs live here, and they are the two halves of her ask.
//
// ONE. CURATION READS A DOCUMENT EXACTLY LIKE AN ANSWER. Her sentence was
// "studied the same way the questions are studied", so the left column is not a
// list of answers with a documents box bolted under it. It is one list of
// SOURCES, each labelled with where it came from: a typed answer, a skip, or
// something they handed over. She reads them all, she decides, she writes the
// curated value on the right, and the provenance names whichever source it
// actually came from (S11).
//
// TWO. BACK AND SKIP, so both sides of intake use the same three words. `Next`
// walks forward one, `Back` walks back one, `Skip` sets this one aside and
// moves on. They mean the same three things on the client's form and on hers.
//
// Three rules this file is careful about, because they are guarantees:
//
//   1. A raw source is permanent. Every `CurationSource` carries the literal
//      `editable: false` so a component cannot forget, exactly as `AnswerLine`
//      does. A document is raw material too and gets the same treatment.
//   2. A document that could not be read is NEVER presented as read (spec 32
//      §4). `readable` is the honest field and `note` is the sentence.
//   3. Every count in every sentence here is counted from the array it
//      describes, at call time. Nothing is stored and nothing is a percentage.

import type { ProfileBody } from '../tree/body.ts';
import { readPath } from '../tree/body.ts';
import type { IntakeDocument } from '../tree/objects.ts';
import { ANSWERS_PATH } from './rounds.ts';
import { answersFor, curatedIds, readCurated } from './curate.ts';
import {
  confidenceWords, listWords, plural, shortDate,
  type CuratedReading, type QueueItem,
} from './screens.ts';

// ── Documents: reading them out of the answers folder ────────────────────────

/**
 * A document stores at `context/intake/answers` beside the typed answers,
 * because that is what it is: raw material the client gave. The folder holds
 * one entry type, so the two are told apart by the SHAPE of the record and
 * not by a second path.
 */
const DOCUMENT_KINDS = ['file', 'link', 'text'];

export function isDocumentRecord(data: Record<string, unknown> | undefined): boolean {
  if (!data) return false;
  if (typeof data.extraction_state === 'string') return true;
  return typeof data.kind === 'string'
    && DOCUMENT_KINDS.includes(data.kind)
    && typeof data.title === 'string';
}

export interface DocumentSource extends IntakeDocument {
  /**
   * Every parameter this document has been said to speak to: what was stored
   * on the record, plus the question it was attached to, plus every parameter
   * whose curated value names it as a source. See `documentCoverage`.
   */
  covers: string[];
}

/**
 * A curated value's source ref for a document. Never `owner-direct:`, so
 * `ownerDirectOnly` stays honest, and never a bare id, so it can never be
 * mistaken for an answer id.
 */
export const DOCUMENT_REF = 'document:';

export function documentRef(id: string): string {
  return `${DOCUMENT_REF}${id}`;
}

export function isDocumentRef(ref: string): boolean {
  return ref.startsWith(DOCUMENT_REF);
}

export function documentIdFromRef(ref: string): string {
  return isDocumentRef(ref) ? ref.slice(DOCUMENT_REF.length) : ref;
}

/**
 * Which documents she has decided speak to which parameters — DERIVED, not
 * stored by a second write.
 *
 * The reason is a law, not a shortcut. `context/intake/answers` is append-only
 * and refuses amendments (S11, `NO_AMENDMENT_PATHS`), so a document record can
 * never be edited after it arrives. Her decision therefore lives where every
 * other decision of hers lives: on the CURATED side, as provenance. Choosing a
 * document as the source of a parameter is the act that makes it cover that
 * parameter. A document still proposes nothing by itself.
 */
export function documentCoverage(body: ProfileBody): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const parameterId of curatedIds(body)) {
    const curated = readCurated(body, parameterId);
    for (const ref of curated?.provenance?.source_refs ?? []) {
      if (!isDocumentRef(ref)) continue;
      const id = documentIdFromRef(ref);
      const list = out[id] ?? (out[id] = []);
      if (!list.includes(parameterId)) list.push(parameterId);
    }
  }
  return out;
}

/** Every document handed over on this profile, oldest first. */
export function readDocuments(body: ProfileBody): DocumentSource[] {
  const derived = documentCoverage(body);
  return readPath(body, ANSWERS_PATH)
    .filter(e => isDocumentRecord(e.data as Record<string, unknown>))
    .map(e => {
      const d = e.data as unknown as IntakeDocument;
      const covers: string[] = [];
      for (const p of [...(d.covers ?? []), ...(derived[e.id] ?? [])]) {
        if (p && !covers.includes(p)) covers.push(p);
      }
      if (d.answers_parameter && !covers.includes(d.answers_parameter)) {
        covers.push(d.answers_parameter);
      }
      return {
        ...d,
        id: e.id,
        round: typeof d.round === 'number' ? d.round : 0,
        received_at: d.received_at || e.created_at,
        extraction_state: d.extraction_state ?? 'not-attempted',
        covers,
      };
    })
    .sort((a, b) => (a.received_at < b.received_at ? -1 : 1));
}

const KIND_WORDS: Record<IntakeDocument['kind'], string> = {
  file: 'a file',
  link: 'a link',
  text: 'text they pasted',
};

/**
 * Spec 32 §4 applied to one document. A scan says so plainly, in her words,
 * and is never shown as though its contents were read.
 */
export function documentStateLine(doc: Pick<IntakeDocument, 'kind' | 'extraction_state'>): string {
  switch (doc.extraction_state) {
    case 'ok':
      return '';
    case 'unreadable':
      return doc.kind === 'link'
        ? 'This link cannot be opened from here, so nothing in it has been read. Open it yourself.'
        : 'There is no text layer in this one, so nothing in it has been read. Open it yourself.';
    case 'none':
      return 'There is no text in this one to read.';
    default:
      return 'This one has not been read yet.';
  }
}

export function documentText(doc: IntakeDocument): string {
  if (doc.extraction_state === 'ok') return doc.extracted ?? doc.text ?? '';
  if (doc.kind === 'text') return doc.text ?? '';
  return '';
}

export function documentReadable(doc: IntakeDocument): boolean {
  if (doc.extraction_state === 'ok') return true;
  return doc.kind === 'text' && (doc.text ?? '').trim().length > 0;
}

// ── One list of sources: answers and documents together ──────────────────────

export interface CurationSource {
  /** What goes into `source_refs` if she curates from this one. */
  ref: string;
  kind: 'answer' | 'skipped' | 'document';
  /** Where it came from, on the label: "Answer 1, round 2", "A file". */
  from: string;
  /** The words exactly as they arrived. Empty when a document was not read. */
  text: string;
  /** Who gave it and when. */
  meta: string;
  /** Honest, per spec 32 §4. False means nothing in it has been read. */
  readable: boolean;
  /** The sentence shown instead of text when `readable` is false. */
  note: string;
  /** Always false. It is here so a component cannot forget (S11). */
  readonly editable: false;
  /** Present on a document, so the screen can offer opening it. */
  document?: DocumentSource;
}

export interface CurationSources {
  /** Everything that speaks to this parameter, answers and documents alike. */
  sources: CurationSource[];
  /** Handed over, and not yet said to speak to this parameter. She decides. */
  offered: CurationSource[];
  /** Counted from `sources`, every time. */
  line: string;
  /** Counted from `offered`, every time. Empty when there are none. */
  offeredLine: string;
}

function answerSource(
  a: { id: string; value: string; kind: 'answer' | 'skipped'; by: string; at: string; round_version: number },
  index: number,
): CurationSource {
  return {
    ref: a.id,
    kind: a.kind,
    from: `Answer ${index + 1}, round ${a.round_version}`,
    text: a.kind === 'skipped' ? '' : a.value,
    meta: `${a.by}, round ${a.round_version}${a.at ? `, ${shortDate(a.at)}` : ''}`,
    readable: a.kind === 'answer',
    note: a.kind === 'skipped' ? 'They chose not to answer this.' : '',
    editable: false,
  };
}

export function documentSource(doc: DocumentSource): CurationSource {
  const readable = documentReadable(doc);
  return {
    ref: documentRef(doc.id),
    kind: 'document',
    from: `${doc.title}, ${KIND_WORDS[doc.kind] ?? 'handed over'}`,
    text: readable ? documentText(doc) : '',
    meta: `${doc.given_by}, round ${doc.round}${doc.received_at ? `, ${shortDate(doc.received_at)}` : ''}`,
    readable,
    note: readable ? '' : documentStateLine(doc),
    editable: false,
    document: doc,
  };
}

function sourcesLine(sources: CurationSource[]): string {
  const said = sources.filter(s => s.kind === 'answer').length;
  const docs = sources.filter(s => s.kind === 'document').length;
  const notSaid = sources.filter(s => s.kind === 'skipped').length;

  if (said + docs === 0) {
    if (notSaid > 0) {
      return `${notSaid} ${plural(notSaid, 'time', 'times')} asked, and they chose not to answer.`;
    }
    return 'Nothing has come back for this one yet.';
  }

  const parts: string[] = [];
  if (said > 0) parts.push(`${said} ${plural(said, 'answer', 'answers')}`);
  if (docs > 0) parts.push(`${docs} ${plural(docs, 'document', 'documents')}`);
  const total = said + docs;
  return `${listWords(parts)}, kept exactly as ${plural(total, 'it', 'they')} arrived.`;
}

function offeredLineFor(offered: CurationSource[]): string {
  const n = offered.length;
  if (n === 0) return '';
  const ask = n === 1 ? 'Say if it speaks to this one.' : 'Say if any of them speaks to this one.';
  return `${n} more ${plural(n, 'thing', 'things')} handed over. ${ask}`;
}

/**
 * The left column of the Curation screen: every source for this parameter, in
 * one list, each labelled with where it came from.
 *
 * A document she has not yet tied to this parameter is NOT in `sources`. It is
 * in `offered`, where she can name it. That is spec 33's "a document never
 * curates anything by itself" made structural rather than promised: nothing
 * moves from `offered` to `sources` without her choosing it.
 */
export function composeSources(body: ProfileBody, parameterId: string): CurationSources {
  const answers = answersFor(body, parameterId).map(answerSource);
  const documents = readDocuments(body);

  const named: CurationSource[] = [];
  const offered: CurationSource[] = [];
  for (const doc of documents) {
    (doc.covers.includes(parameterId) ? named : offered).push(documentSource(doc));
  }

  const sources = [...answers, ...named];
  return {
    sources,
    offered,
    line: sourcesLine(sources),
    offeredLine: offeredLineFor(offered),
  };
}

// ── Provenance, once a document can be one of the sources ────────────────────

export interface ResolvedSource {
  kind: 'answer' | 'document' | 'owner' | 'missing';
  ref: string;
  text: string;
  from: string;
}

/**
 * `screens.readingFrom` resolves an answer ref and her own note. It does not
 * know about documents, so a document ref lands there as `missing`. This puts
 * the name back on it, without touching that file.
 */
export function resolveSources(
  reading: CuratedReading, documents: DocumentSource[],
): ResolvedSource[] {
  const byId = new Map(documents.map(d => [d.id, d]));
  return reading.sources.map(s => {
    if (s.kind === 'answer') {
      return {
        kind: 'answer' as const, ref: s.ref, text: s.text,
        from: s.round === undefined ? 'An answer' : `An answer, round ${s.round}`,
      };
    }
    if (s.kind === 'owner') {
      return { kind: 'owner' as const, ref: s.ref, text: s.text, from: 'Your own note' };
    }
    const doc = isDocumentRef(s.ref) ? byId.get(documentIdFromRef(s.ref)) : undefined;
    if (doc) {
      return {
        kind: 'document' as const, ref: s.ref,
        text: documentReadable(doc) ? documentText(doc) : '',
        from: `${doc.title}, ${KIND_WORDS[doc.kind] ?? 'handed over'}`,
      };
    }
    return { kind: 'missing' as const, ref: s.ref, text: s.text, from: 'A source we could not find' };
  });
}

/**
 * Who curated it, when, from what, how sure, and what it replaced — all five,
 * with a document named as plainly as an answer.
 */
export function provenanceLine(
  current: CuratedReading | null, superseded: CuratedReading[], documents: DocumentSource[],
): string {
  if (!current) return 'Nothing written yet.';
  const resolved = resolveSources(current, documents);
  const parts: string[] = [`Curated by ${current.curator} on ${shortDate(current.at)}.`];

  const answers = resolved.filter(s => s.kind === 'answer').length;
  const docs = resolved.filter(s => s.kind === 'document').length;
  const from: string[] = [];
  if (answers > 0) from.push(`${answers} ${plural(answers, 'answer', 'answers')}`);
  if (docs > 0) from.push(`${docs} ${plural(docs, 'document', 'documents')}`);

  if (from.length > 0) parts.push(`From ${listWords(from)}.`);
  else if (current.ownerDirectOnly) parts.push('From your own note, not from an answer.');

  const words = confidenceWords(current.confidence);
  if (words) parts.push(words);

  if (superseded.length > 0) {
    parts.push(
      `It replaced ${superseded.length} earlier ${plural(superseded.length, 'reading', 'readings')}, kept below.`,
    );
  }
  return parts.join(' ');
}

// ── Where am I, how do I go on, how do I go back, how do I leave ─────────────
//
// Spec 33 §5, the standing UI rule, answered on her side of intake with the
// same three words the client's form uses.

export interface CurationNav {
  currentId: string | null;
  /** 1-based position of the current parameter in the queue. 0 when empty. */
  index: number;
  total: number;
  /** "3 of 18". Counted from the queue, never stored, never a percentage. */
  where: string;
  /** "4 of 18 written." Kept from what already worked. */
  written: string;
  backId: string | null;
  nextId: string | null;
  canBack: boolean;
  canNext: boolean;
  canSkip: boolean;
  /** True when the one on screen is one she already set aside. */
  currentSetAside: boolean;
  /** The ones she set aside, in queue order, so she can come back to them. */
  setAside: QueueItem[];
  /** Counted from `setAside`. Empty when there are none. */
  setAsideLine: string;
  /** How she leaves without losing anything. */
  leaveLine: string;
}

function positionOf(queue: QueueItem[], currentId: string | null): number {
  return currentId ? queue.findIndex(i => i.id === currentId) : -1;
}

/** One back, in queue order. Null at the first one, and the button says so. */
export function stepBack(queue: QueueItem[], currentId: string | null): string | null {
  const at = positionOf(queue, currentId);
  return at > 0 ? queue[at - 1].id : null;
}

/** One on, in queue order. This is `Next`, and it is not `Next one waiting`. */
export function stepNext(queue: QueueItem[], currentId: string | null): string | null {
  const at = positionOf(queue, currentId);
  if (at < 0) return queue[0]?.id ?? null;
  return at < queue.length - 1 ? queue[at + 1].id : null;
}

/**
 * Skip: "I will come back to this". A third state, not an abandonment, and
 * nothing about the parameter is written or lost. She lands on the next one
 * she has NOT set aside, so skipping does not walk her through the same
 * set-aside pile again.
 */
export function skipParameter(
  queue: QueueItem[], currentId: string | null, skipped: string[],
): { currentId: string | null; skipped: string[] } {
  if (!currentId || positionOf(queue, currentId) < 0) return { currentId, skipped };
  const next = skipped.includes(currentId) ? skipped : [...skipped, currentId];
  const at = positionOf(queue, currentId);
  const after = queue.slice(at + 1).find(i => !next.includes(i.id));
  const before = queue.slice(0, at).find(i => !next.includes(i.id));
  const target = after?.id ?? before?.id ?? stepNext(queue, currentId) ?? queue[0]?.id ?? currentId;
  return { currentId: target, skipped: next };
}

/** She came back to it, or wrote it. Either way it is no longer set aside. */
export function unskipParameter(skipped: string[], id: string): string[] {
  return skipped.filter(x => x !== id);
}

/**
 * Which parameter the screen opens on. What she asked for wins; otherwise the
 * first job she has not set aside; otherwise anything left rather than nothing.
 */
export function openOn(
  queue: QueueItem[], requested: string | null | undefined, skipped: string[] = [],
): string | null {
  if (requested && queue.some(i => i.id === requested)) return requested;
  return queue.find(i => i.waiting && !skipped.includes(i.id))?.id
    ?? queue.find(i => i.waiting)?.id
    ?? queue.find(i => !skipped.includes(i.id))?.id
    ?? queue[0]?.id
    ?? null;
}

const LEAVE_LINE =
  'Everything you write is saved when you write it. You can close this and come back.';

export function curationNav(
  queue: QueueItem[], currentId: string | null, skipped: string[] = [],
): CurationNav {
  const at = positionOf(queue, currentId);
  const total = queue.length;
  const index = at < 0 ? 0 : at + 1;
  const written = queue.filter(i => i.curated).length;
  const setAside = queue.filter(i => skipped.includes(i.id));
  const backId = stepBack(queue, currentId);
  const nextId = stepNext(queue, currentId);

  return {
    currentId,
    index,
    total,
    where: total === 0 ? '' : `${index} of ${total}`,
    written: total === 0 ? 'Nothing has come back to curate yet.' : `${written} of ${total} written.`,
    backId,
    nextId,
    canBack: backId !== null,
    canNext: nextId !== null,
    canSkip: total > 1 && at >= 0,
    currentSetAside: currentId !== null && skipped.includes(currentId),
    setAside,
    setAsideLine: setAside.length === 0
      ? ''
      : `${setAside.length} set aside to come back to.`,
    leaveLine: LEAVE_LINE,
  };
}
