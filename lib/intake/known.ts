// The words the rebuilt Intake page says about itself — 2026-08-11.
//
// Her brief asked for two things this file owns. First, "make it simple instead
// of 'record this' or 'do that'": nothing here instructs. It states what is
// known and what is not, and stops. Second, "what will proceed where": a gap is
// only worth her attention if something downstream is actually waiting on it,
// so each gap here names what it holds up — and where nothing is held up, it
// SAYS SO rather than implying urgency it cannot justify.
//
// That second half is the honest part. Four of the eight facts block nothing at
// all; a page that dressed all eight as equally urgent would be lying to her
// every time she opened it.
//
// Pure. No clock, no imports beyond the count it reads.

import type { FactsCount } from '../strategy/facts.ts';

const WORDS = ['None', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'];

/** "Three of eight known." Derived from the boxes, never typed anywhere. */
export function knownLine(f: FactsCount): string {
  if (f.known === f.total) return 'Brand profile complete.';
  return `Brand profile ${f.known} of ${f.total} complete.`;
}

/**
 * What each fact actually holds up, in the app as it is today.
 *
 * These are not opinions. Positioning, audience and voice are what the drafting
 * prompt reads; pillars are what a board column is filed under; platforms
 * narrow what can be scheduled at all. The other four are read by her and by
 * the context bundle, and nothing refuses without them — so they say that.
 */
const BLOCKS: Record<string, string | null> = {
  Positioning: 'copywriting',
  Audience: 'copywriting',
  Voice: 'copywriting',
  Pillars: 'assigning posts to pillars',
  Platforms: 'scheduling',
  Cadence: null,
  Goals: null,
  Look: null,
  // Anything the facts list gains later and this map has not met is treated as
  // blocking nothing, which is the safe direction: it can never invent urgency.
};

/** Does a blank in this fact stop anything? Unknown names block nothing. */
export function blocksOf(fact: string): string | null {
  return BLOCKS[fact] ?? null;
}

/**
 * The one line under the count. It names what is genuinely waiting, and when
 * nothing is, it says the gaps are optional — which is the sentence that turns
 * this page from a checklist into a store.
 */
export function gapNote(f: FactsCount): string {
  if (f.missing.length === 0) return 'No outstanding information.';

  const blocking = f.missing.filter(m => blocksOf(m) !== null);
  if (blocking.length === 0) {
    return f.missing.length === 1
      ? `${f.missing[0]} is outstanding. Nothing depends on it.`
      : 'The remaining details are optional. Nothing depends on them.';
  }

  const held = [...new Set(blocking.map(m => blocksOf(m) as string))];
  return `${list(blocking)} outstanding, which holds up ${list(held)}.`;
}

/** "a, b and c" — the serial comma left out, the way she writes. */
function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
