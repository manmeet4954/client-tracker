// The brand as one document — 2026-08-11.
//
// The page claims to be the WHOLE brand. That claim is only true if every
// decision the app stores appears on it, so the first two tests are the load
// bearing ones: nothing may be left off, and nothing may appear twice.

import { suite, test, eq, ok } from './harness.ts';
import {
  ADDED_INPUTS, DOCUMENT_SECTIONS, documentInputs, documentLine, findInput,
  sectionGap, sectionInputs,
} from '../lib/strategy/document.ts';
import { STRATEGY_INPUTS } from '../lib/strategy/inputs.ts';

suite('strategy as one document');

test('every decision the app stores appears on the page', () => {
  const shown = DOCUMENT_SECTIONS.flatMap(s => s.paths);
  for (const input of STRATEGY_INPUTS) {
    ok(shown.includes(input.path), `${input.label} is stored but never shown`);
  }
});

test('nothing appears twice, and nothing shown is invented', () => {
  const shown = DOCUMENT_SECTIONS.flatMap(s => s.paths);
  eq(new Set(shown).size, shown.length, 'a path is in two sections');
  for (const path of shown) {
    ok(!!findInput(path), `the page shows ${path}, which no input declares`);
  }
});

test('the two her brief named, and the app never held, are there', () => {
  // USPs and demographics. She named both; nothing in STRATEGY_INPUTS held
  // either, and this is the test that stops them being quietly dropped again.
  const labels = ADDED_INPUTS.map(i => i.label);
  eq(labels.includes('USPs'), true, 'USPs');
  eq(labels.includes('Demographics'), true, 'Demographics');
  for (const added of ADDED_INPUTS) {
    ok(
      !STRATEGY_INPUTS.some(i => i.path === added.path),
      `${added.label} was added to the lock's list, which changes what locking demands`,
    );
    ok(
      DOCUMENT_SECTIONS.some(s => s.paths.includes(added.path)),
      `${added.label} is declared but sits in no section`,
    );
  }
});

test('the count follows the lock, not the page', () => {
  // The two added rows must never make the brand read as unfinished, because
  // nothing waits on them.
  const allFourteen = STRATEGY_INPUTS.map(i => i.path);
  eq(documentLine(allFourteen), 'The brand is decided.', 'the added rows do not hold it open');
  eq(documentLine([]), `Nothing decided yet. ${STRATEGY_INPUTS.length} to go.`, 'empty');
  eq(documentLine(allFourteen.slice(0, 3)), `3 of ${STRATEGY_INPUTS.length} decided.`, 'partway');
});

test('a section names what it is still missing, and stays quiet when full', () => {
  const brand = DOCUMENT_SECTIONS.find(s => s.id === 'brand')!;
  eq(sectionGap(brand, []), 'Positioning, USPs and Proof library are not decided yet.', 'three named');
  eq(sectionGap(brand, brand.paths), null, 'a full section says nothing');
  const visual = DOCUMENT_SECTIONS.find(s => s.id === 'visual')!;
  eq(sectionGap(visual, []), 'Visual branding is not decided yet.', 'one reads as one');
});

test('every section carries rows, a heading and what it answers', () => {
  for (const s of DOCUMENT_SECTIONS) {
    ok(s.title.length > 0, `${s.id} has no title`);
    ok(s.answers.length > 0, `${s.id} does not say what it answers`);
    ok(sectionInputs(s).length > 0, `${s.id} draws nothing`);
  }
  eq(documentInputs().length, STRATEGY_INPUTS.length + ADDED_INPUTS.length, 'the fourteen plus the two');
});

test('no line she reads carries an em dash', () => {
  for (const s of DOCUMENT_SECTIONS) {
    eq(s.title.includes('—'), false, s.title);
    eq(s.answers.includes('—'), false, s.answers);
  }
  for (const i of ADDED_INPUTS) {
    eq(i.help.includes('—'), false, i.help);
    eq(i.label.includes('—'), false, i.label);
  }
  eq(documentLine([]).includes('—'), false, 'the count line');
});
