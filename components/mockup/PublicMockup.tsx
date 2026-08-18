'use client';

// What someone opening the link sees — 2026-08-17.
//
// HER CORRECTION: "can we not have 1 link showing both the versions."
//
// She is right, and the two-link version I built first was worse for a reason
// worth writing down: a link is a thing she pastes into a message, and the
// moment there are two of them she has to remember which is which, every time,
// forever. One link, and the person opening it chooses.
//
// The comparison leads, because it is the point — the difference is the thing
// she is showing them. "Just the new profile" is one tap away for anyone who
// wants to see it on its own, at full size.
//
// With no screenshot uploaded there is nothing to switch between, so no switch
// is drawn. A control with one option is furniture.
//
// Read-only throughout: this mounts HER components with the handlers left off,
// exactly as spec 35 requires, and there is no editing affordance in any state.

import { useState } from 'react';
import Phone, { PHONE_WIDTH } from '@/components/mockup/Phone';
import Scaled from '@/components/mockup/Scaled';
import Compare from '@/components/mockup/Compare';
import { THEMES, type ProfileMockupRecord } from '@/lib/mockup/profile';

export default function PublicMockup({ mockup, initial }: {
  mockup: ProfileMockupRecord;
  /** `?view=solo` opens straight on the single profile. The default is both. */
  initial?: 'compare' | 'solo';
}) {
  const canCompare = !!mockup.beforeImageUrl;
  const [view, setView] = useState<'compare' | 'solo'>(
    canCompare && initial !== 'solo' ? 'compare' : 'solo',
  );
  const bg = (THEMES[mockup.theme] ?? THEMES.dark).bg;

  if (!canCompare) {
    return (
      <div className="flex min-h-screen flex-col items-center sm:py-8" style={{ background: bg }}>
        {/* PHONE_WIDTH, not 470 (2026-08-17, her note: "just the new profile
            here is cutting off from the right side"). The phone is laid out at
            430 and sat inside a 470 box, so 40px of flat background ran down
            the right of it and read as the screen being cut. The box is the
            phone's own width now, and <Scaled> fits it to a narrower screen
            without reflowing a single line. */}
        <main className="w-full" style={{ maxWidth: PHONE_WIDTH }}>
          <Scaled width={PHONE_WIDTH}><Phone mockup={mockup} /></Scaled>
        </main>
        <p className="py-4 text-[11px] text-stone-400">Profile mockup</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper px-2 py-4 sm:px-4 sm:py-10">
      <div className="mx-auto mb-4 flex w-fit rounded-full bg-control p-1">
        {([['compare', 'Before and after'], ['solo', 'Just the new profile']] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold ${
              view === id ? 'bg-white text-text shadow-card' : 'text-muted hover:text-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <main className="mx-auto w-full"
        style={{ maxWidth: view === 'compare' ? 980 : PHONE_WIDTH }}>
        {view === 'compare'
          ? <Compare mockup={mockup} />
          : (
            <div className="overflow-hidden rounded-[22px]" style={{ background: bg }}>
              <Scaled width={PHONE_WIDTH}><Phone mockup={mockup} /></Scaled>
            </div>
          )}
      </main>
      <p className="pt-6 text-center text-[11px] text-stone-400">Profile mockup</p>
    </div>
  );
}
