// Every way into the Strategy room lands somewhere real — 2026-08-11.
//
// WHY THIS FILE EXISTS. Deleting the Facts tab broke the Strategy button on
// every profile, and it stayed broken through a "fix" and a deploy, because:
//
//   1. THREE lists of panels existed (lib/shell/nav, components/strategy/Room,
//      components/shell/StrategyPanel), and only two were updated.
//   2. The default tab was a string, 'facts', that nothing checked.
//   3. The panel route called notFound() on anything unrecognised, so a stale
//      link died instead of landing.
//   4. It was verified with curl, which returns 200 for a page that 404s in the
//      browser a moment later.
//
// So these tests check the thing curl cannot: that every destination the app
// can send her to is a panel that exists.

import { readFileSync } from 'node:fs';
import { suite, test, eq, ok } from './harness.ts';
import { CORNER_PANELS, ROOM_PANELS, SETTINGS_PANELS } from '../lib/shell/nav.ts';

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

suite('the Strategy room: every door lands somewhere');

test('the default tab is a panel that actually exists', () => {
  // The exact bug. 'facts' was the default long after Facts was deleted.
  const src = read('../components/shell/StrategyPanel.tsx');
  const found = /export const DEFAULT_STRATEGY_TAB = '([a-z-]+)'/.exec(src);
  ok(!!found, 'DEFAULT_STRATEGY_TAB is declared');
  const id = found![1];
  ok(ROOM_PANELS.some(p => p.id === id), `the Strategy button opens "${id}", which is not a panel`);
});

test('the /strategy landing redirects to a panel that exists', () => {
  const src = read('../app/profile/[id]/strategy/page.tsx');
  const found = /strategy\/([a-z-]+)`/.exec(src);
  ok(!!found, 'the landing page redirects somewhere');
  ok(
    ROOM_PANELS.some(p => p.id === found![1]),
    `/strategy redirects to "${found![1]}", which is not a panel`,
  );
});

test('the tab list is derived, never written a second time', () => {
  // Three copies of one list is what caused this. The panel list may be read
  // from nav.ts and mapped; it may not be retyped.
  const src = read('../components/shell/StrategyPanel.tsx');
  const decl = /export const STRATEGY_TABS[^\n]*\n/.exec(src);
  ok(!!decl, 'STRATEGY_TABS is declared');
  ok(/ROOM_PANELS/.test(decl![0]), 'STRATEGY_TABS must derive from ROOM_PANELS, not restate it');
});

test('the panel route never dead-ends on an unknown panel', () => {
  const src = read('../app/profile/[id]/strategy/[panel]/page.tsx');
  // notFound() is still correct for a non-owner. It is not correct for a panel
  // name we renamed, which is our problem and not hers.
  ok(/DEFAULT_STRATEGY_TAB/.test(src), 'an unrecognised panel falls back to the default');
  ok(!/if \(!known\) notFound\(\)/.test(src), 'an unrecognised panel must not 404');
});

test('the two groups do not overlap, and together they are the room', () => {
  const ids = ROOM_PANELS.map(p => p.id);
  eq(new Set(ids).size, ids.length, 'a panel is in both groups');
  eq(ids.length, CORNER_PANELS.length + SETTINGS_PANELS.length, 'the room is both groups');
  for (const p of ROOM_PANELS) ok(p.label.length > 0, `${p.id} has no label`);
});

test('every panel the room can draw has something to draw', () => {
  // A panel in the rail with no case in the renderer is a blank screen, which
  // is the same failure wearing different clothes.
  const src = read('../components/shell/StrategyPanel.tsx');
  for (const p of ROOM_PANELS) {
    ok(
      src.includes(`case '${p.id}':`) || p.id === 'derivation',
      `panel "${p.id}" is in the rail but the renderer has no case for it`,
    );
  }
});

test('Settings is reachable from somewhere a person can click', () => {
  // It was built, deployed and linked from nowhere, so it did not exist.
  const shelf = read('../components/shell/Shelf.tsx');
  ok(/href="\/settings"/.test(shelf), 'the desk has no way into Settings');
});
