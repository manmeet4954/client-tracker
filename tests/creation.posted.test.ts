// The posted-so-far bar — 2026-08-11.
//
// The load-bearing test is the last one: performance must refuse to show a
// number it does not have. Instagram collection has been stalled since 12 July,
// so "0 reach" would be a lie about the work rather than a fact about it.

import { suite, test, eq } from './harness.ts';
import { postedLine, postedTally, performanceLine } from '../lib/creation/board.ts';
import type { ContentCard } from '../types/index.ts';

const card = (over: Partial<ContentCard>): ContentCard => ({
  id: 'c', pillarId: '', title: 't', hook: '', content: '', stage: 'idea',
  contentType: '', scheduledDate: '', postUrl: '', notes: '', customValues: {},
  createdMonth: '2026-07', ...over,
} as ContentCard);

suite('how much has gone out');

test('it counts the month on the table, the whole profile, and what is left', () => {
  const cards = [
    card({ stage: 'posted', scheduledDate: '2026-07-04' }),
    card({ stage: 'posted', scheduledDate: '2026-07-19' }),
    card({ stage: 'posted', scheduledDate: '2026-06-02' }),
    card({ stage: 'writing', scheduledDate: '2026-07-30' }),
  ];
  const t = postedTally(cards, '2026-07');
  eq(t.month, 2, 'posted in July');
  eq(t.everything, 3, 'posted ever');
  eq(t.planned, 1, 'dated in July and not out yet');
});

test('the sentence reads plainly, and says nothing it cannot', () => {
  eq(
    postedLine(postedTally([], '2026-07'), 'July'),
    'Nothing posted in July yet.',
    'an empty month',
  );
  const cards = [
    card({ stage: 'posted', scheduledDate: '2026-07-04' }),
    card({ stage: 'posted', scheduledDate: '2026-06-01' }),
    card({ stage: 'idea', scheduledDate: '2026-07-28' }),
  ];
  eq(
    postedLine(postedTally(cards, '2026-07'), 'July'),
    '1 posted in July, 1 still to go. 2 in all.',
    'a month with work behind and ahead',
  );
});

test('performance refuses to invent a reading', () => {
  // The whole point. Three posted pieces, no readings collected: the bar must
  // say nothing was measured, NEVER "0 reach".
  const cards = [
    card({ stage: 'posted', scheduledDate: '2026-07-04' }),
    card({ stage: 'posted', scheduledDate: '2026-07-11' }),
  ];
  const t = postedTally(cards, '2026-07');
  eq(t.reach, null, 'no average is computed from nothing');
  eq(
    performanceLine(t),
    'No performance readings collected, so nothing here is measured.',
    'posted but never read',
  );
  eq(performanceLine(postedTally([], '2026-07')), 'No performance to read yet.', 'and nothing posted');
});

test('a real reading is averaged over only the pieces that carry one', () => {
  const cards = [
    card({ stage: 'posted', scheduledDate: '2026-07-04', customValues: { reach: '1000' } }),
    card({ stage: 'posted', scheduledDate: '2026-07-11', customValues: { reach: '3000' } }),
    card({ stage: 'posted', scheduledDate: '2026-07-18' }),
  ];
  const t = postedTally(cards, '2026-07');
  eq(t.reach, 2000, 'the unmeasured piece does not drag the average to zero');
  eq(t.measured, 2, 'and it is honest about how many were read');
  eq(performanceLine(t), '2,000 average reach across 2 measured posts.', 'a real average');
});
