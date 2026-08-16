'use client';

// Strategy room → Facts.
//
// The SAME eight boxes Intake shows, rendered from components/intake/FactRows
// so the two can never drift. This screen is the reading of them inside the
// Strategy room; Intake is where they are filled and where the client is asked.
//
// It used to carry its own copy of the rows AND its own "Ask the blanks" block,
// which meant asking could start in two places and land in one. Her brief on
// 2026-08-11 was "what will proceed where" — so asking lives in exactly one
// place now, and this screen points at it rather than repeating it.

import Link from 'next/link';
import { useApp, useClient } from '@/contexts/AppContext';
import FactRows from '@/components/intake/FactRows';
import { factsKnown } from '@/lib/strategy/facts';
import { gapNote, knownLine } from '@/lib/intake/known';

export default function Facts({ profileId, brandHref }: { profileId: string; brandHref: string }) {
  const { role } = useApp();
  const { data } = useClient(profileId);

  // Owner only, always, in every switch position (spec 34 §2).
  if (role !== 'owner') return <p className="p-8 text-sm text-faint">This screen is hers.</p>;

  const count = factsKnown(data);

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-4">
        <h2 className="font-display text-[21px] font-bold tracking-[-.02em] text-text">Facts</h2>
        <p className="tnum mt-1.5 text-[13.5px] font-semibold text-muted">{knownLine(count)}</p>
        <p className="mt-1 text-[12.5px] leading-[1.6] text-faint">{gapNote(count)}</p>
      </header>

      <FactRows profileId={profileId} brandHref={brandHref} />

      {count.missing.length > 0 && (
        <p className="mt-4 text-[12.5px] text-muted">
          <Link href={`/profile/${profileId}/intake`} className="font-semibold text-accent hover:underline">
            Ask them the blanks in Intake
          </Link>
          , or fill any box above yourself.
        </p>
      )}
    </div>
  );
}
