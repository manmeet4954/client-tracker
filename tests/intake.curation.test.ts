// Spec 33 §3 and §4 on HER side — lib/intake/curationNav.ts.
//
// What these check, in the order the spec asks for it:
//
//   1. Curation reads a document beside a typed answer, as one list of
//      sources, each labelled with where it came from.
//   2. A document never curates anything by itself: it sits in `offered`
//      until she names it, and naming it is what sets its coverage.
//   3. Provenance names a document as plainly as it names an answer (S11).
//   4. A document that could not be read is never presented as read (32 §4).
//   5. Back, Skip and Next: where am I, how do I go on, how do I go back, and
//      how do I leave without losing anything (spec 33 §5).
//   6. Every count is counted from the array it describes. Each of these is
//      asserted by CHANGING the array and reading the sentence again, which is
//      the only way to catch a number someone typed in.
//
// Plain Node, no dependencies, in the house harness style.
//
// NOT REGISTERED in tests/run.ts (that file is shared and owned by the
// integrator). Run it on its own with:
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \
//     "import('./tests/intake.curation.test.ts').then(async m => \
//      process.exit(await (await import('./tests/harness.ts')).run()))"

import { suite, test, ok, eq } from './harness.ts';
import { emptyBody, putEntry, type ProfileBody } from '../lib/tree/body.ts';
import type { IntakeDocument } from '../lib/tree/objects.ts';
import type { SwitchConfig } from '../lib/tree/contract.ts';
import { openRound, fileAnswer, ANSWERS_PATH } from '../lib/intake/rounds.ts';
import { curateParameter, readCurated } from '../lib/intake/curate.ts';
import { composeCuration, curationQueue, type QueueItem } from '../lib/intake/screens.ts';
import {
  composeSources, curationNav, documentCoverage, documentRef, documentStateLine,
  isDocumentRecord, openOn, provenanceLine, readDocuments, resolveSources,
  skipParameter, stepBack, stepNext, unskipParameter,
} from '../lib/intake/curationNav.ts';

const NOW = '2026-08-01T09:00:00.000Z';
const LATER = '2026-08-02T09:00:00.000Z';
const CONFIG: SwitchConfig = {};

const ONE_LINE = 'identity.one-line';
const HATE = 'voice.words-they-hate';
const PAIN = 'audience.pain';

function withRound(body: ProfileBody, parameters: string[], now = NOW): ProfileBody {
  return openRound(body, {
    parameters, delivery: 'documents', config: CONFIG, now,
  }).body;
}

function answer(
  body: ProfileBody, version: number, parameter: string, value: string,
  by = 'client', now = NOW,
): ProfileBody {
  return fileAnswer(body, {
    round: version, parameter_id: parameter, value, by,
    source: `round-${version}`, now, writer: 'client',
  });
}

/**
 * A document, written the way the upload agent writes one: at the answers
 * path, as the folder's one entry type, told apart by its shape.
 */
function document(
  body: ProfileBody, doc: Partial<IntakeDocument> & { id: string }, now = NOW,
): ProfileBody {
  const record: IntakeDocument = {
    id: doc.id,
    round: doc.round ?? 1,
    title: doc.title ?? 'Brand deck',
    kind: doc.kind ?? 'file',
    url: doc.url,
    text: doc.text,
    given_by: doc.given_by ?? 'client',
    received_at: doc.received_at ?? now,
    extracted: doc.extracted,
    extraction_state: doc.extraction_state ?? 'ok',
    covers: doc.covers,
    answers_parameter: doc.answers_parameter,
  };
  return putEntry(body, ANSWERS_PATH, {
    id: doc.id, type: 'answer', data: record as unknown as Record<string, unknown>,
  }, { writer: 'client', now });
}

function item(id: string, over: Partial<QueueItem> = {}): QueueItem {
  return { id, label: id, curated: false, answers: 1, waiting: true, ...over };
}

// ── 1. A document is a source, read beside the typed answers ────────────────

suite('spec 33 §3 — curation reads a document exactly like an answer');

test('1. a document record is told apart from an answer by its shape, both ways', () => {
  ok(isDocumentRecord({ title: 'Deck', kind: 'file', extraction_state: 'ok' }),
    'a document record is a document');
  ok(isDocumentRecord({ title: 'Their site', kind: 'link', extraction_state: 'unreadable' }),
    'a link is a document');
  ok(!isDocumentRecord({ parameter_id: ONE_LINE, answer: 'We make bags', kind: 'answer' }),
    'a typed answer is NOT a document');
  ok(!isDocumentRecord({ parameter_id: ONE_LINE, answer: '', kind: 'skipped' }),
    'a skip is NOT a document');
  ok(!isDocumentRecord(undefined), 'and nothing is not a document');
});

test('2. a document stored beside the answers is read back as a document', () => {
  let body = withRound(emptyBody(NOW), [ONE_LINE]);
  body = answer(body, 1, ONE_LINE, 'We make bags for cyclists.');
  body = document(body, { id: 'doc-deck', title: 'Brand deck', extracted: 'Bags for cyclists.' });

  const docs = readDocuments(body);
  eq(docs.length, 1, 'exactly one document, and the typed answer is not one of them');
  eq(docs[0].title, 'Brand deck', 'read back with its title');
  eq(docs[0].extraction_state, 'ok', 'and its honest extraction state');
});

test('3. the left column shows every source, answers and documents, labelled', () => {
  let body = withRound(emptyBody(NOW), [ONE_LINE]);
  body = answer(body, 1, ONE_LINE, 'We make bags for cyclists.');
  body = document(body, {
    id: 'doc-deck', title: 'Brand deck', extracted: 'Bags for cyclists.',
    covers: [ONE_LINE],
  });

  const { sources, line } = composeSources(body, ONE_LINE);
  eq(sources.length, 2, 'both an answer and a document');
  eq(sources.map(s => s.kind), ['answer', 'document'], 'each carrying what it is');
  ok(sources[0].from.startsWith('Answer 1'), `the answer says where it came from: ${sources[0].from}`);
  eq(sources[1].from, 'Brand deck, a file', 'and so does the document');
  eq(line, '1 answer and 1 document, kept exactly as they arrived.', 'counted, both kinds');
});

test('4. the counted sentence is COUNTED — add a document, the sentence changes', () => {
  let body = withRound(emptyBody(NOW), [ONE_LINE]);
  body = answer(body, 1, ONE_LINE, 'We make bags.');
  eq(composeSources(body, ONE_LINE).line, '1 answer, kept exactly as it arrived.',
    'one answer, singular');

  body = document(body, { id: 'd1', title: 'Deck', extracted: 'x', covers: [ONE_LINE] });
  eq(composeSources(body, ONE_LINE).line, '1 answer and 1 document, kept exactly as they arrived.',
    'the same sentence, recounted from the array');

  body = document(body, { id: 'd2', title: 'Notes', extracted: 'y', covers: [ONE_LINE] });
  eq(composeSources(body, ONE_LINE).line, '1 answer and 2 documents, kept exactly as they arrived.',
    'and again');
});

test('5. no sources, and every empty case says the true thing', () => {
  let body = withRound(emptyBody(NOW), [ONE_LINE, HATE]);
  eq(composeSources(body, ONE_LINE).line, 'Nothing has come back for this one yet.',
    'nothing at all');

  body = fileAnswer(body, {
    round: 1, parameter_id: ONE_LINE, kind: 'skipped', value: '', by: 'client',
    source: 'round-1', now: NOW, writer: 'client',
  });
  eq(composeSources(body, ONE_LINE).line, '1 time asked, and they chose not to answer.',
    'a refusal is knowledge, and it is not an answer');
  const skip = composeSources(body, ONE_LINE).sources[0];
  eq(skip.text, '', 'a refusal carries no words');
  eq(skip.note, 'They chose not to answer this.', 'it says what happened instead');
});

test('6. a raw source is permanent, document or answer, and says so in the type', () => {
  let body = withRound(emptyBody(NOW), [ONE_LINE]);
  body = answer(body, 1, ONE_LINE, 'We make bags.');
  body = document(body, { id: 'd1', title: 'Deck', extracted: 'x', covers: [ONE_LINE] });
  const { sources } = composeSources(body, ONE_LINE);
  for (const s of sources) {
    eq(s.editable, false, `${s.from} must never carry an edit affordance (S11)`);
  }
});

// ── 2. A document never curates anything by itself ──────────────────────────

suite('spec 33 §3 — a document proposes, she decides');

test('7. an unnamed document is OFFERED, not counted as a source for anything', () => {
  let body = withRound(emptyBody(NOW), [ONE_LINE, HATE]);
  body = answer(body, 1, ONE_LINE, 'We make bags.');
  body = document(body, { id: 'd1', title: 'Deck', extracted: 'the whole brand' });

  const one = composeSources(body, ONE_LINE);
  eq(one.sources.length, 1, 'the document has not been named, so it is not a source');
  eq(one.offered.length, 1, 'it is offered to her instead');
  eq(one.offeredLine, '1 more thing handed over. Say if it speaks to this one.',
    'and the offer is counted');

  const other = composeSources(body, HATE);
  eq(other.sources.length, 0, 'and it certainly did not answer a different parameter');
  eq(other.offered.length, 1, 'it is offered there too, because she decides');
});

test('8. she names it by curating from it, and THAT is what sets covers', () => {
  let body = withRound(emptyBody(NOW), [ONE_LINE]);
  body = document(body, { id: 'd1', title: 'Deck', extracted: 'Bags for cyclists.' });
  eq(readDocuments(body)[0].covers, [], 'nothing is guessed on upload');

  body = curateParameter(body, {
    parameter_id: ONE_LINE, value: 'Bags for cyclists', source_refs: [documentRef('d1')],
    curator: 'owner', confidence: 'confirmed', now: LATER,
  });

  eq(documentCoverage(body), { d1: [ONE_LINE] }, 'her decision is what covers it');
  eq(readDocuments(body)[0].covers, [ONE_LINE], 'and the document now reads as covering it');
  const after = composeSources(body, ONE_LINE);
  eq(after.sources.length, 1, 'it has moved from offered to source');
  eq(after.offered.length, 0, 'and is no longer only offered');
});

test('9. the ref for a document can never be mistaken for an answer or her note', () => {
  const ref = documentRef('d1');
  eq(ref, 'document:d1', 'one prefix, one meaning');
  ok(!ref.startsWith('owner-direct:'),
    'so a value curated from a document is never reported as her own note (§7.4)');
});

test('10. a document alone still cannot write anything: curating needs her', () => {
  let body = withRound(emptyBody(NOW), [ONE_LINE]);
  body = document(body, { id: 'd1', title: 'Deck', extracted: 'Bags for cyclists.' });
  eq(readCurated(body, ONE_LINE), null,
    'a document sitting in the folder curates nothing by existing');
});

// ── 3. Provenance names a document as plainly as an answer ─────────────────

suite('spec 33 §3 — provenance, with a document in it (S11)');

test('11. a value curated from a document names the document, not a lost ref', () => {
  let body = withRound(emptyBody(NOW), [ONE_LINE]);
  body = document(body, { id: 'd1', title: 'Brand deck', extracted: 'Bags for cyclists.' });
  body = curateParameter(body, {
    parameter_id: ONE_LINE, value: 'Bags for cyclists', source_refs: [documentRef('d1')],
    curator: 'owner', confidence: 'confirmed', now: LATER,
  });

  const panel = composeCuration(body, ONE_LINE)!;
  const docs = readDocuments(body);
  const resolved = resolveSources(panel.current!, docs);
  eq(resolved.map(s => s.kind), ['document'], 'resolved as a document');
  eq(resolved[0].from, 'Brand deck, a file', 'and named');

  const line = provenanceLine(panel.current, panel.superseded, docs);
  ok(line.includes('Curated by owner on 2 Aug.'), `who and when: ${line}`);
  ok(line.includes('From 1 document.'), `from what: ${line}`);
  ok(line.includes('They said it plainly.'), `how sure: ${line}`);
});

test('12. an answer and a document together are both counted in the line', () => {
  let body = withRound(emptyBody(NOW), [ONE_LINE]);
  body = answer(body, 1, ONE_LINE, 'We make bags for cyclists.');
  body = document(body, { id: 'd1', title: 'Brand deck', extracted: 'Bags.' });
  const answerId = composeSources(body, ONE_LINE).sources[0].ref;

  body = curateParameter(body, {
    parameter_id: ONE_LINE, value: 'Bags for cyclists',
    source_refs: [answerId, documentRef('d1')],
    curator: 'owner', confidence: 'inferred', now: LATER,
  });

  const panel = composeCuration(body, ONE_LINE)!;
  const line = provenanceLine(panel.current, panel.superseded, readDocuments(body));
  ok(line.includes('From 1 answer and 1 document.'), `both counted: ${line}`);
});

test('13. a ref pointing at nothing says so, and is never dressed up', () => {
  let body = withRound(emptyBody(NOW), [ONE_LINE]);
  body = curateParameter(body, {
    parameter_id: ONE_LINE, value: 'Bags', source_refs: [documentRef('gone')],
    curator: 'owner', confidence: 'confirmed', now: LATER,
  });
  const panel = composeCuration(body, ONE_LINE)!;
  const resolved = resolveSources(panel.current!, readDocuments(body));
  eq(resolved.map(s => s.kind), ['missing'], 'honest about a ref it cannot resolve');
});

// ── 4. Spec 32 §4: never presented as read ─────────────────────────────────

suite('spec 32 §4 — a scan says so, and is never shown as read');

test('14. an unreadable file carries no text and says why', () => {
  let body = withRound(emptyBody(NOW), [ONE_LINE]);
  body = document(body, {
    id: 'd1', title: 'Scanned brief', kind: 'file',
    extraction_state: 'unreadable', extracted: null, covers: [ONE_LINE],
  });
  const s = composeSources(body, ONE_LINE).sources[0];
  eq(s.readable, false, 'not readable');
  eq(s.text, '', 'and no text is invented for it');
  ok(s.note.includes('nothing in it has been read'), `it says so plainly: ${s.note}`);
});

test('15. a link behind a login stores, and says it was not opened', () => {
  const line = documentStateLine({ kind: 'link', extraction_state: 'unreadable' });
  ok(line.includes('cannot be opened from here'), `${line}`);
  eq(documentStateLine({ kind: 'file', extraction_state: 'not-attempted' }),
    'This one has not been read yet.', 'not read yet is not the same as unreadable');
  eq(documentStateLine({ kind: 'file', extraction_state: 'none' }),
    'There is no text in this one to read.', 'and neither is empty');
  eq(documentStateLine({ kind: 'file', extraction_state: 'ok' }), '',
    'a read one needs no apology');
});

test('16. pasted text is readable without any extraction at all', () => {
  let body = withRound(emptyBody(NOW), [ONE_LINE]);
  body = document(body, {
    id: 'd1', title: 'Their strategy note', kind: 'text', text: 'We only speak to cyclists.',
    extraction_state: 'none', covers: [ONE_LINE],
  });
  const s = composeSources(body, ONE_LINE).sources[0];
  eq(s.readable, true, 'text she pasted is already text');
  eq(s.text, 'We only speak to cyclists.', 'and it is there, verbatim');
});

test('17. an unreadable document can still be curated from, by her, with her eyes', () => {
  let body = withRound(emptyBody(NOW), [ONE_LINE]);
  body = document(body, {
    id: 'd1', title: 'Scanned brief', extraction_state: 'unreadable', extracted: null,
  });
  body = curateParameter(body, {
    parameter_id: ONE_LINE, value: 'Bags for cyclists', source_refs: [documentRef('d1')],
    curator: 'owner', confidence: 'confirmed', now: LATER,
  });
  const panel = composeCuration(body, ONE_LINE)!;
  const resolved = resolveSources(panel.current!, readDocuments(body));
  eq(resolved[0].kind, 'document', 'she read it herself and said so');
  eq(resolved[0].text, '', 'but the system still never claims to have read it');
});

// ── 5. Back, Skip, Next, and leaving without losing anything ───────────────

suite('spec 33 §4 and §5 — where am I, how do I go on, back, and out');

test('18. where am I: counted from the queue, and it moves when she does', () => {
  const queue = [item('a'), item('b'), item('c', { curated: true, waiting: false })];
  eq(curationNav(queue, 'a', []).where, '1 of 3', 'first');
  eq(curationNav(queue, 'b', []).where, '2 of 3', 'second');
  eq(curationNav(queue, 'c', []).where, '3 of 3', 'third');
  eq(curationNav(queue, 'a', []).written, '1 of 3 written.', 'and the progress line survives');
});

test('19. the counts are COUNTED — a shorter queue says a shorter thing', () => {
  const three = [item('a'), item('b'), item('c')];
  eq(curationNav(three, 'b', []).where, '2 of 3', 'three');
  eq(curationNav(three.slice(0, 2), 'b', []).where, '2 of 2', 'two, from the same call');
  eq(curationNav([], null, []).where, '', 'and nothing says nothing');
  eq(curationNav([], null, []).written, 'Nothing has come back to curate yet.',
    'rather than "0 of 0 written"');
});

test('20. how do I go on and how do I go back: one step, in queue order', () => {
  const queue = [item('a'), item('b'), item('c')];
  eq(stepNext(queue, 'a'), 'b', 'next');
  eq(stepBack(queue, 'b'), 'a', 'back');
  eq(stepBack(queue, 'a'), null, 'and back at the first is honestly nothing');
  eq(stepNext(queue, 'c'), null, 'as is next at the last');

  const first = curationNav(queue, 'a', []);
  eq(first.canBack, false, 'so the control is off, not lying');
  eq(first.canNext, true, 'and forward is open');
  const last = curationNav(queue, 'c', []);
  eq(last.canNext, false, 'the other end, the other way round');
  eq(last.canBack, true, 'back stays open');
});

test('21. skip is a third state: set aside, nothing written, nothing lost', () => {
  const queue = [item('a'), item('b'), item('c')];
  const after = skipParameter(queue, 'a', []);
  eq(after.skipped, ['a'], 'a is set aside');
  eq(after.currentId, 'b', 'and she is moved on');

  const nav = curationNav(queue, 'b', after.skipped);
  eq(nav.setAside.map(i => i.id), ['a'], 'the set-aside pile is visible');
  eq(nav.setAsideLine, '1 set aside to come back to.', 'and counted');
  eq(curationNav(queue, 'b', ['a', 'c']).setAsideLine, '2 set aside to come back to.',
    'counted from the array, again');
});

test('22. skipping again walks past what she already set aside', () => {
  const queue = [item('a'), item('b'), item('c')];
  const one = skipParameter(queue, 'a', []);
  const two = skipParameter(queue, one.currentId, one.skipped);
  eq(two.skipped, ['a', 'b'], 'both set aside');
  eq(two.currentId, 'c', 'and she lands on the one she has not seen, not back on a');
});

test('23. skipping the last one wraps to something she has not set aside', () => {
  const queue = [item('a'), item('b'), item('c')];
  const after = skipParameter(queue, 'c', ['b']);
  eq(after.currentId, 'a', 'it goes to the first live one rather than dead-ending');
  eq(after.skipped, ['b', 'c'], 'and remembers both');
});

test('24. skipping the only one leaves her on it rather than nowhere', () => {
  const queue = [item('a')];
  const after = skipParameter(queue, 'a', []);
  eq(after.currentId, 'a', 'there is nowhere else to be');
  eq(curationNav(queue, 'a', []).canSkip, false, 'and skip is not offered at all');
});

test('25. coming back clears the set-aside mark', () => {
  eq(unskipParameter(['a', 'b'], 'a'), ['b'], 'one comes back');
  eq(unskipParameter(['a'], 'zz'), ['a'], 'and one that was never set aside changes nothing');
  const nav = curationNav([item('a'), item('b')], 'a', ['a']);
  eq(nav.currentSetAside, true, 'while she is on it, the screen can say so');
});

test('26. the screen opens on the first job she has not set aside', () => {
  const queue = [
    item('a', { waiting: true }),
    item('b', { waiting: true }),
    item('c', { waiting: false, curated: true }),
  ];
  eq(openOn(queue, null, []), 'a', 'the first job');
  eq(openOn(queue, null, ['a']), 'b', 'skipping past what she set aside');
  eq(openOn(queue, 'c', ['a']), 'c', 'what she asked for always wins');
  eq(openOn(queue, 'nope', []), 'a', 'and a stale request falls back rather than blanking');
  eq(openOn(queue, null, ['a', 'b']), 'a',
    'with every job set aside it returns to them rather than showing nothing');
  eq(openOn([], null, []), null, 'an empty queue is honestly null');
});

test('27. how do I leave without losing anything, said on the screen', () => {
  const nav = curationNav([item('a'), item('b')], 'a', []);
  ok(nav.leaveLine.includes('saved when you write it'),
    `the fourth question of the standing rule is answered in words: ${nav.leaveLine}`);
});

// ── 6. It holds on a real queue, not only on hand-made items ───────────────

suite('spec 33 — the nav on a real curation queue');

test('28. a real body: answers in, queue out, and the nav walks it', () => {
  let body = withRound(emptyBody(NOW), [ONE_LINE, HATE, PAIN]);
  body = answer(body, 1, ONE_LINE, 'We make bags for cyclists.');
  body = answer(body, 1, HATE, 'Never say hustle.');
  body = answer(body, 1, PAIN, 'They cannot find one that fits a laptop.');

  const queue = curationQueue(body);
  eq(queue.length, 3, 'three parameters have something behind them');
  const start = openOn(queue, null, []);
  eq(start, queue[0].id, 'it opens on the first job');

  const nav = curationNav(queue, start, []);
  eq(nav.where, '1 of 3', 'where she is');
  eq(nav.written, '0 of 3 written.', 'and what is done');

  const skipped = skipParameter(queue, start, []);
  const after = curationNav(queue, skipped.currentId, skipped.skipped);
  eq(after.where, '2 of 3', 'skip moved her on');
  eq(after.setAsideLine, '1 set aside to come back to.', 'and left a way back');
});

test('29. writing one changes the written count, counted from the queue', () => {
  let body = withRound(emptyBody(NOW), [ONE_LINE, HATE]);
  body = answer(body, 1, ONE_LINE, 'We make bags for cyclists.');
  body = answer(body, 1, HATE, 'Never say hustle.');
  const before = curationQueue(body);
  eq(curationNav(before, before[0].id, []).written, '0 of 2 written.', 'nothing yet');

  const ref = composeSources(body, ONE_LINE).sources[0].ref;
  body = curateParameter(body, {
    parameter_id: ONE_LINE, value: 'Bags for cyclists', source_refs: [ref],
    curator: 'owner', confidence: 'confirmed', now: LATER,
  });
  const after = curationQueue(body);
  eq(curationNav(after, after[0].id, []).written, '1 of 2 written.', 'and now one is');
});

test('30. a document alone puts nothing in her queue, and never invents a parameter', () => {
  let body = withRound(emptyBody(NOW), [ONE_LINE, HATE]);
  body = document(body, { id: 'd1', title: 'Deck', extracted: 'everything about them' });
  eq(curationQueue(body).length, 0,
    'plan §3.1 holds: a document is a route, and it answers nothing by itself');
  eq(readDocuments(body).length, 1, 'while still being there for her to read');
});
