// Documents as the third intake route — spec 33 §2, and spec 32 §4's honesty
// rule about what "read" is allowed to mean.
//
// What these actually check, rather than what they look like they check:
//
//   1. A document is a ROUTE. It stores with the answers, and it never answers
//      a question by itself: attaching one to a parameter leaves that question
//      waiting and leaves the round's status exactly where it was.
//   2. Extraction is honest. `ok` only where the words are genuinely in hand,
//      `unreadable` where there are none to get, `not-attempted` where nobody
//      has tried, and never a state that flatters the truth.
//   3. A document whose text could not be read is never silently dropped. It
//      still comes back from the context report, by title, source and reason.
//   4. Every count in every line is counted from the array, proved by changing
//      the array and reading the sentence again.
//
// Plain Node, no dependencies, in the house harness style.
//
// NOT REGISTERED in tests/run.ts (that file is shared and owned by the
// integrator). Run it on its own with:
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \
//     "import('./tests/intake.documents.test.ts').then(async m => \
//      process.exit(await (await import('./tests/harness.ts')).run()))"

import { suite, test, ok, eq, throws } from './harness.ts';
import { emptyBody, putEntry, type ProfileBody } from '../lib/tree/body.ts';
import type { IntakeRound } from '../lib/tree/objects.ts';
import type { SwitchConfig } from '../lib/tree/contract.ts';
import { openRound, readAnswers, readRounds, refreshRounds, INTAKE_PATH } from '../lib/intake/rounds.ts';
import { answersFor } from '../lib/intake/curate.ts';
import { composeRounds } from '../lib/intake/screens.ts';
import {
  addDocument, readDocuments, classifyDocument, extractionLine, unread,
  documentsForParameter, documentsForRoundOnly, documentsLine, documentContext,
  documentContextHeader, nextDocumentId, titleFor, sourceWords, kindWords,
  behindLogin, hostOf, extensionOf, registerDocumentTextReader,
  documentTextReaderInstalled, readDocumentText, DocumentRefused, DOCUMENT_RECORD,
} from '../lib/intake/documents.ts';

const NOW = '2026-08-04T09:00:00.000Z';
const LATER = '2026-08-05T09:00:00.000Z';
const CONFIG: SwitchConfig = {};

const ONE_LINE = 'identity.one-line';
const HATE = 'voice.words-they-hate';

/**
 * Force a round out of the door. Every parameter ships `vocabulary: draft`, so
 * `sendRound` correctly refuses in a fixture; the states after the send are
 * still real states and still have to behave.
 */
function markSent(body: ProfileBody, version: number, now = NOW): ProfileBody {
  const round = readRounds(body).find(r => r.version === version)!;
  const sent: IntakeRound = { ...round, status: 'sent' };
  return putEntry(body, INTAKE_PATH, {
    id: round.id, type: 'intake_round', data: sent as unknown as Record<string, unknown>,
  }, { writer: 'owner', now });
}

/** A sent round holding exactly the parameters named. */
function sentRound(parameters: string[]): ProfileBody {
  const opened = openRound(emptyBody(NOW), {
    parameters, delivery: 'documents', config: CONFIG, now: NOW,
  });
  return refreshRounds(markSent(opened.body, 1), NOW);
}

// ── 1. The route, and where it lives ─────────────────────────────────────────

suite('spec 33 §2 — a document is a route, stored with the answers');

test('1. a file, a link and pasted text all store at context/intake/answers', () => {
  let body = sentRound([ONE_LINE, HATE]);

  body = addDocument(body, {
    round: 1, kind: 'file', title: 'The brand deck',
    url: 'https://store.example.com/orig-1.pdf', filename: 'deck.pdf',
    given_by: 'shiva', now: NOW,
  }).body;
  body = addDocument(body, {
    round: 1, kind: 'link', title: 'Their site',
    url: 'https://divinestudio.example.com/about', given_by: 'shiva', now: NOW,
  }).body;
  body = addDocument(body, {
    round: 1, kind: 'text', title: 'What she told me on the call',
    text: 'We want to sound calm, never salesy.', given_by: 'owner', now: NOW,
  }).body;

  const docs = readDocuments(body);
  eq(docs.length, 3, 'all three kinds came back');
  eq(docs.map(d => d.kind), ['file', 'link', 'text'], 'and in the order they arrived');
  eq(
    body.paths['context/intake/answers'].every(e => e.path === 'context/intake/answers'),
    true,
    'they live with the answers, which is what they are: raw material the client gave',
  );
  eq(
    body.paths['context/intake/answers'].every(e => e.type === 'answer'),
    true,
    'as entries of the type that path declares, told apart by the record field',
  );
  eq(
    docs.every(() => true) && body.paths['context/intake/answers']
      .every(e => (e.data as Record<string, unknown>).record === DOCUMENT_RECORD),
    true,
    'and every one of them carries the document discriminator',
  );
});

test('2. the round can be read back and documents belong to their own round', () => {
  let body = sentRound([ONE_LINE]);
  body = addDocument(body, {
    round: 1, kind: 'text', title: 'Round one note', text: 'one', given_by: 'shiva', now: NOW,
  }).body;

  const second = openRound(body, { parameters: [HATE], delivery: 'documents', config: CONFIG, now: LATER });
  body = second.body;
  body = addDocument(body, {
    round: 2, kind: 'text', title: 'Round two note', text: 'two', given_by: 'shiva', now: LATER,
  }).body;

  eq(readDocuments(body).length, 2, 'both are kept');
  eq(readDocuments(body, 1).map(d => d.title), ['Round one note'], 'round one sees only its own');
  eq(readDocuments(body, 2).map(d => d.title), ['Round two note'], 'round two sees only its own');
  eq(readRounds(body).length, 2, 'and the rounds themselves are untouched by any of it');
});

test('3. nothing is altered afterwards: a second write on the same id is refused (S11)', () => {
  let body = sentRound([ONE_LINE]);
  const first = addDocument(body, {
    round: 1, kind: 'text', title: 'The brief', text: 'first words', given_by: 'shiva', now: NOW,
  });
  body = first.body;

  // The id counts up rather than colliding, so two documents with the same
  // title both survive. Nothing overwrites anything.
  const second = addDocument(body, {
    round: 1, kind: 'text', title: 'The brief', text: 'different words', given_by: 'shiva', now: LATER,
  });
  ok(second.document.id !== first.document.id, 'the second gets its own id');
  eq(readDocuments(second.body).length, 2, 'and both are kept, because raw material is never replaced');
  eq(
    readDocuments(second.body).map(d => d.text),
    ['first words', 'different words'],
    'the first one still says exactly what it said',
  );
});

test('4. an empty one is refused rather than stored as a shell', () => {
  const body = sentRound([ONE_LINE]);
  throws(
    () => addDocument(body, { round: 1, kind: 'text', text: '   ', given_by: 'shiva', now: NOW }),
    'nothing in this one to keep',
    'pasted nothing is not a document',
  );
  throws(
    () => addDocument(body, { round: 1, kind: 'link', given_by: 'shiva', now: NOW }),
    'a link needs the link',
    'a link with no link is not a document',
  );
  throws(
    () => addDocument(body, { round: 1, kind: 'file', given_by: 'shiva', now: NOW }),
    'a file needs its stored url',
    'a file that never uploaded is not a document',
  );
  ok(DocumentRefused, 'and the refusal has its own error type');
});

// ── 2. It never answers a question by itself ─────────────────────────────────

suite('spec 33 §2 — a document proposes, it never answers');

test('5. attaching a document to one question leaves that question waiting', () => {
  let body = sentRound([ONE_LINE, HATE]);
  const before = composeRounds(body)[0];
  eq(before.openCount, 2, 'both questions start open, counted from the array');

  body = addDocument(body, {
    round: 1, kind: 'file', title: 'Strategy deck',
    url: 'https://store.example.com/orig-9.pdf', filename: 'strategy.pdf',
    answers_parameter: ONE_LINE, given_by: 'shiva', now: NOW,
  }).body;
  body = refreshRounds(body, NOW);

  const after = composeRounds(body)[0];
  eq(after.openCount, 2, 'the question it was handed over for is STILL open');
  eq(
    after.questions.find(q => q.parameterId === ONE_LINE)?.state,
    'waiting',
    'a deck is not an answer: only a person answering answers',
  );
  eq(readRounds(body)[0].status, 'sent', 'and the round has not moved to answered');
});

test('6. a document never shows up as an answer for any parameter', () => {
  let body = sentRound([ONE_LINE]);
  body = addDocument(body, {
    round: 1, kind: 'text', title: 'A note', text: 'they want calm',
    answers_parameter: ONE_LINE, given_by: 'shiva', now: NOW,
  }).body;

  eq(answersFor(body, ONE_LINE).length, 0, 'curation sees no typed answer here, because there is none');
  eq(
    readAnswers(body).filter(a => a.parameter_id !== '').length,
    0,
    'and no document leaks into the answer list wearing a parameter id',
  );
});

test('7. round-wide and question-specific documents are told apart', () => {
  let body = sentRound([ONE_LINE, HATE]);
  body = addDocument(body, {
    round: 1, kind: 'text', title: 'For the whole round', text: 'everything', given_by: 'shiva', now: NOW,
  }).body;
  body = addDocument(body, {
    round: 1, kind: 'text', title: 'For one question', text: 'this bit',
    answers_parameter: HATE, given_by: 'shiva', now: NOW,
  }).body;

  const docs = readDocuments(body, 1);
  eq(documentsForParameter(docs, HATE).map(d => d.title), ['For one question'], 'the one given to a question');
  eq(documentsForParameter(docs, ONE_LINE), [], 'and nothing borrowed from the round');
  eq(documentsForRoundOnly(docs).map(d => d.title), ['For the whole round'], 'the one given to the round');
});

test('8. covers is never guessed on the way in', () => {
  const body = sentRound([ONE_LINE]);
  const { document } = addDocument(body, {
    round: 1, kind: 'file', title: 'A deck', url: 'https://store.example.com/o.pdf',
    answers_parameter: ONE_LINE, given_by: 'shiva', now: NOW,
  });
  eq(document.covers, undefined, 'she decides what a document speaks to, during curation');
});

// ── 3. Extraction, honestly (spec 32 §4) ─────────────────────────────────────

suite('spec 32 §4 — what "read" is allowed to mean');

test('9. pasted text is already text, so it is ok and it is kept verbatim', () => {
  const c = classifyDocument({ kind: 'text', text: 'Never say hustle.  ' });
  eq(c.extraction_state, 'ok', 'nothing to extract, it is already words');
  eq(c.extracted, 'Never say hustle.  ', 'kept exactly as pasted, spaces and all');
});

test('10. a PDF is not-attempted, and the line says so plainly', () => {
  const c = classifyDocument({ kind: 'file', filename: 'brand-book.pdf' });
  eq(c.extraction_state, 'not-attempted', 'no parser is installed, and we do not pretend one is');
  ok(c.reason.includes('Nothing has read this yet'), 'and it says exactly that');
  ok(!/read in full/i.test(c.reason), 'and never claims it was read');

  const byMime = classifyDocument({ kind: 'file', url: 'https://s.example.com/o', mime: 'application/pdf' });
  eq(byMime.extraction_state, 'not-attempted', 'the mime type says the same thing when the name has lost the extension');
});

test('11. a scan or a photo of a document is unreadable, and says why', () => {
  for (const name of ['scan.jpg', 'page.png', 'IMG_4021.HEIC', 'shot.webp']) {
    const c = classifyDocument({ kind: 'file', filename: name });
    eq(c.extraction_state, 'unreadable', `${name} has no words in it to read`);
    ok(c.reason.includes('picture'), `${name} says plainly that it is a picture`);
  }
  eq(
    classifyDocument({ kind: 'file', url: 'https://s.example.com/o', mime: 'image/jpeg' }).extraction_state,
    'unreadable',
    'and the mime type alone is enough to say so',
  );
});

test('12. video and sound are out of scope, and are never presented as read', () => {
  const c = classifyDocument({ kind: 'file', filename: 'call.mp4' });
  eq(c.extraction_state, 'unreadable', 'video is not read here');
  ok(c.reason.includes('assets'), 'and it says where it belongs instead');
});

test('13. a link behind a login is unreadable; an ordinary link is not-attempted', () => {
  eq(
    classifyDocument({ kind: 'link', url: 'https://drive.google.com/drive/folders/abc' }).extraction_state,
    'unreadable',
    'a private Drive folder cannot be fetched',
  );
  eq(
    classifyDocument({ kind: 'link', url: 'https://www.notion.so/team/page' }).extraction_state,
    'unreadable',
    'nor a Notion page',
  );
  ok(
    classifyDocument({ kind: 'link', url: 'https://canva.com/design/x' }).reason.includes('login'),
    'and the reason names the login rather than hiding it',
  );
  eq(
    classifyDocument({ kind: 'link', url: 'https://divinestudio.example.com/about' }).extraction_state,
    'not-attempted',
    'an ordinary page is simply not fetched yet, and says so',
  );
  eq(
    classifyDocument({ kind: 'link', url: 'https://example.com/x', needsLogin: true }).extraction_state,
    'unreadable',
    'and the person adding it can say plainly that it needs a login',
  );
});

test('14. host and extension reading, including the cases that trip it', () => {
  eq(hostOf('https://www.Notion.so/a/b'), 'notion.so', 'the www comes off and the case is flattened');
  eq(hostOf('not a url'), '', 'and a non-url is not forced into being one');
  eq(behindLogin('https://sub.sharepoint.com/x'), true, 'a subdomain of a login host counts');
  eq(behindLogin('https://example.com/notion.so'), false, 'a login host in the PATH does not');
  eq(extensionOf('https://s.example.com/orig-1.pdf?token=abc#x'), 'pdf', 'the query and hash come off');
  eq(extensionOf('https://s.example.com/orig-1'), '', 'and no extension is not invented');
});

test('15. the seam: a parser can be dropped in, and until it is nothing is claimed', () => {
  eq(documentTextReaderInstalled('file'), false, 'nothing is installed today');

  const pending = classifyDocument({ kind: 'file', filename: 'deck.pdf' });
  eq(pending.extraction_state, 'not-attempted', 'so the state is the literal truth');

  registerDocumentTextReader('file', async () => 'the words inside the deck');
  ok(documentTextReaderInstalled('file'), 'a reader can be registered without touching this file');

  return readDocumentText({ kind: 'file', filename: 'deck.pdf' }).then(read => {
    eq(read.extraction_state, 'ok', 'and then, and only then, the state says read');
    eq(read.extracted, 'the words inside the deck', 'with the words actually in hand');

    // A reader must never rescue a verdict of "there is nothing to read".
    return readDocumentText({ kind: 'file', filename: 'scan.jpg' }).then(scan => {
      eq(scan.extraction_state, 'unreadable', 'a picture stays unreadable whatever is installed');
      registerDocumentTextReader('file', null);
      eq(documentTextReaderInstalled('file'), false, 'and the seam unhooks cleanly for the next test');
    });
  });
});

test('16. a reader that finds nothing, or throws, never returns ok', () => {
  registerDocumentTextReader('file', async () => '   ');
  return readDocumentText({ kind: 'file', filename: 'empty.pdf' }).then(empty => {
    eq(empty.extraction_state, 'unreadable', 'a file with no words in it is unreadable, not read');
    registerDocumentTextReader('file', async () => { throw new Error('boom'); });
    return readDocumentText({ kind: 'file', filename: 'broken.pdf' }).then(broken => {
      eq(broken.extraction_state, 'not-attempted', 'a failed read is a read that did not happen');
      ok(broken.reason.includes('did not finish'), 'and it says so');
      registerDocumentTextReader('file', null);
    });
  });
});

test('17. the stored reason survives the round trip and drives the line', () => {
  let body = sentRound([ONE_LINE]);
  body = addDocument(body, {
    round: 1, kind: 'file', title: 'A scan of the brief',
    url: 'https://store.example.com/orig-3.jpg', filename: 'brief-page-1.jpg',
    given_by: 'shiva', now: NOW,
  }).body;

  const doc = readDocuments(body)[0];
  eq(doc.extraction_state, 'unreadable', 'read back exactly as it was decided');
  ok(unread(doc), 'so the row draws its state dot');
  ok(extractionLine(doc).includes('picture'), 'and the line she reads is the reason itself');
  eq(doc.extracted, null, 'with no text, because there is none');
});

// ── 4. Never silently dropped ────────────────────────────────────────────────

suite('spec 32 §4 — an unread document is still reportable');

test('18. every document reaches the context report, read or not', () => {
  let body = sentRound([ONE_LINE]);
  body = addDocument(body, {
    round: 1, kind: 'text', title: 'Call notes', text: 'calm, never salesy', given_by: 'owner', now: NOW,
  }).body;
  body = addDocument(body, {
    round: 1, kind: 'file', title: 'The strategy deck',
    url: 'https://store.example.com/orig-7.pdf', filename: 'strategy.pdf',
    given_by: 'shiva', now: NOW,
  }).body;
  body = addDocument(body, {
    round: 1, kind: 'link', title: 'Their Drive folder',
    url: 'https://drive.google.com/drive/folders/zzz', given_by: 'shiva', now: NOW,
  }).body;

  const report = documentContext(readDocuments(body, 1));
  eq(report.length, 3, 'all three are in the report, including the two nobody has read');
  eq(report.map(r => r.title), ['Call notes', 'The strategy deck', 'Their Drive folder'], 'by title');

  const deck = report.find(r => r.title === 'The strategy deck')!;
  eq(deck.text, null, 'the deck carries no text, because none was read');
  ok(deck.line.startsWith('The strategy deck (a file, from shiva'), 'but it is named, with its source');
  ok(deck.line.includes('Not read:'), 'and marked plainly as not read');

  const notes = report.find(r => r.title === 'Call notes')!;
  eq(notes.text, 'calm, never salesy', 'the one that was read carries its words');
  ok(notes.line.includes('Read in full'), 'and says so');

  ok(
    report.every(r => r.note.length > 0),
    'every entry carries a plain reason, so nothing is a bare unexplained state',
  );
});

test('19. the report header counts what is there, and changes when it changes', () => {
  eq(documentContextHeader([]), 'Nothing was handed over.', 'with none, it says none');
  eq(
    documentContextHeader([{ extraction_state: 'ok' }]),
    '1 thing was handed over, and all of it read.',
    'one read',
  );
  const two = documentContextHeader([{ extraction_state: 'ok' }, { extraction_state: 'unreadable' }]);
  ok(two.startsWith('2 things were handed over.'), 'two counted from the array');
  ok(two.includes('1 of them has not been read'), 'and the unread one is named in the count, not hidden');

  const three = documentContextHeader([
    { extraction_state: 'ok' }, { extraction_state: 'unreadable' }, { extraction_state: 'not-attempted' },
  ]);
  ok(three.startsWith('3 things were handed over.'), 'add one and the sentence moves');
  ok(three.includes('2 of them have not been read'), 'and so does the unread count');
});

// ── 5. Counted, never stored ─────────────────────────────────────────────────

suite('spec 33 §5 — every count comes from the array it describes');

test('20. the round card line is recounted every time the array changes', () => {
  eq(documentsLine([]), 'No files received yet.', 'nothing is nothing');
  eq(
    documentsLine([{ extraction_state: 'ok' }]),
    '1 thing handed over. All of them read.',
    'one, read',
  );
  eq(
    documentsLine([{ extraction_state: 'unreadable' }]),
    '1 thing handed over. None of it read yet, so only its name is known.',
    'one, not read, and the sentence says what is actually known',
  );
  eq(
    documentsLine([{ extraction_state: 'ok' }, { extraction_state: 'not-attempted' }, { extraction_state: 'unreadable' }]),
    '3 things handed over. 1 read, 2 not.',
    'three, and every number in it counted from the three',
  );
});

test('21. the words on a row are built from the record, never typed twice', () => {
  const body = sentRound([ONE_LINE]);
  const { document } = addDocument(body, {
    round: 1, kind: 'link', title: 'Their site',
    url: 'https://divinestudio.example.com/about', given_by: 'shiva', now: NOW,
  });
  eq(sourceWords(document), 'a link, from shiva, 4 Aug', 'kind, who, when');
  eq(kindWords('file'), 'a file', 'and the kind words are one list, used everywhere');
});

test('22. a title is derived from what was given, and nothing is invented', () => {
  eq(titleFor({ kind: 'link', url: 'https://www.example.com/a/b' }), 'A link on example.com', 'a link names its host');
  eq(titleFor({ kind: 'file', url: 'https://s.example.com/x/deck.pdf' }), 'deck.pdf', 'a file keeps its name');
  eq(titleFor({ kind: 'text', text: 'we want to sound calm and never salesy at all' }),
    'we want to sound calm and never…', 'pasted text takes its own first words');
  eq(titleFor({ kind: 'file', url: 'https://s.example.com/x/deck.pdf', title: '  The deck ' }), 'The deck',
    'and what she typed always wins');
});

test('23. ids do not collide, and the second one does not overwrite the first', () => {
  let body = sentRound([ONE_LINE]);
  eq(nextDocumentId(body, 1, 'The brand deck'), 'd1-the-brand-deck', 'a readable id');
  body = addDocument(body, {
    round: 1, kind: 'text', title: 'The brand deck', text: 'a', given_by: 'shiva', now: NOW,
  }).body;
  eq(nextDocumentId(body, 1, 'The brand deck'), 'd1-the-brand-deck-2', 'and the next one counts up');
});
