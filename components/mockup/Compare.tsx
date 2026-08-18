'use client';

// Before and after, side by side — 2026-08-17.
//
// HER BRIEF: "I just want that when someone is given the link, they can see the
// optimized profile, but they can also see the before version of their profile.
// They can also compare them in parallel to see exactly what the difference is."
//
// THE BEFORE IS A SCREENSHOT of their real profile, uploaded, and that was her
// choice when asked. A rebuilt "before" mockup invites the one answer that
// ruins the whole point — "you made that look bad on purpose". A screenshot is
// theirs, and undeniable.
//
// ONE COMPONENT, mounted by her screen and by a client's alike. The client's
// copy is the same view with the upload control absent, never a second one
// drawn for them (CLAUDE.md rule 0).
//
// A mockup with no before is a complete mockup: this renders the phone alone
// and says nothing about a missing screenshot to anyone but her.

import { useRef } from 'react';
import { ImagePlus } from 'lucide-react';
import Phone from '@/components/mockup/Phone';
import type { ProfileMockupRecord } from '@/lib/mockup/profile';

export default function Compare({ mockup, onBefore, onClearBefore }: {
  mockup: ProfileMockupRecord;
  /** Absent for a client: they read the comparison, they do not build it. */
  onBefore?: (file: File) => void;
  onClearBefore?: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const has = !!mockup.beforeImageUrl;
  const mine = !!onBefore;

  // Nothing to compare and nobody who could add one: just the phone.
  if (!has && !mine) {
    return (
      <div className="mx-auto max-w-[420px]">
        <Frame label="Your profile">
          <Phone mockup={mockup} />
        </Frame>
      </div>
    );
  }

  return (
    <div className="grid items-stretch gap-4 md:grid-cols-2">
      <Frame label="Now">
        {has ? (
          <>
            {/* MATCHED TO THE PHONE (2026-08-17, her note: "both the mockups
                currently looks unbalanced, can u make the aspect ratio similar,
                easy for comparison").
                
                Two things were wrong. The screenshot filled the column while
                the phone capped itself at 392px, so they were different widths.
                And their heights were whatever their content happened to be.
                
                Both columns are now the same width, and the grid stretches
                both cells to the taller of the two, so `h-full` here makes the
                screenshot end exactly where the phone does. No fixed height is
                guessed: whatever the phone grows to, the before matches it.
                
                `object-top` keeps the part that is being compared - the name,
                the bio, the link, the first rows of the grid. A phone
                screenshot is far taller than what the mockup draws, so
                something has to give at the BOTTOM, which is the end of a feed
                nobody is comparing. */}
            <div className="h-full overflow-hidden rounded-[22px] border border-hairline bg-sunken">
              <img
                src={mockup.beforeImageUrl}
                alt="Their profile as it is today"
                className="h-full w-full object-cover object-top"
              />
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex h-full min-h-[420px] w-full flex-col items-center justify-center gap-2 rounded-[22px] border border-dashed border-hairline bg-sunken text-muted hover:text-text"
          >
            <ImagePlus size={22} strokeWidth={1.8} />
            <span className="text-[13px] font-semibold">Add a screenshot of their profile now</span>
            <span className="max-w-[240px] text-center text-[12px] leading-[1.5] text-faint">
              This is the before. It sits beside the new one so the difference
              speaks for itself.
            </span>
          </button>
        )}
      </Frame>

      <Frame label="With KRNL">
        <div className="h-full overflow-hidden rounded-[22px] border border-hairline">
          <Phone mockup={mockup} />
        </div>
      </Frame>

      {/* Under the pair, so it can never push one column out of line. */}
      {mine && has && (
        <div className="flex items-center gap-3 md:col-span-2">
          <button type="button" onClick={() => input.current?.click()}
            className="text-[12.5px] font-semibold text-muted hover:text-text">
            Replace the screenshot
          </button>
          <button type="button" onClick={onClearBefore}
            className="text-[12.5px] font-semibold text-muted hover:text-accent-text">
            Remove
          </button>
        </div>
      )}

      {mine && (
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) onBefore!(f);
            e.target.value = '';
          }}
        />
      )}
    </div>
  );
}

/** A labelled column. The label is the only thing drawn outside the picture. */
function Frame({ label, children }: { label: string; children: React.ReactNode }) {
  // `max-w-[392px]` is the phone's own width (Phone.tsx). Capping BOTH columns
  // to it is what stops the screenshot rendering wider than the thing it is
  // being compared against on a big screen.
  return (
    <div className="mx-auto flex h-full w-full max-w-[392px] flex-col">
      <p className="mb-1.5 text-[11.5px] font-bold uppercase tracking-[.11em] text-faint">{label}</p>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
