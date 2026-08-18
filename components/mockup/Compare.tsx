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
    <div className="grid gap-4 md:grid-cols-2">
      <Frame label="Now">
        {has ? (
          <div className="relative overflow-hidden rounded-[24px] border border-hairline bg-sunken">
            {/* Their real screenshot, whatever shape it is. `w-full` keeps it
                the same width as the phone beside it so the two read as a pair,
                and the height follows the picture rather than being cropped to
                match — a cropped before is a dishonest before. */}
            <img src={mockup.beforeImageUrl} alt="Their profile as it is today" className="w-full" />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex h-[420px] w-full flex-col items-center justify-center gap-2 rounded-[24px] border border-dashed border-hairline bg-sunken text-muted hover:text-text"
          >
            <ImagePlus size={22} strokeWidth={1.8} />
            <span className="text-[13px] font-semibold">Add a screenshot of their profile now</span>
            <span className="max-w-[240px] text-center text-[12px] leading-[1.5] text-faint">
              This is the before. It sits beside the new one so the difference
              speaks for itself.
            </span>
          </button>
        )}
        {mine && has && (
          <div className="mt-2 flex items-center gap-3">
            <button type="button" onClick={() => input.current?.click()}
              className="text-[12.5px] font-semibold text-muted hover:text-text">
              Replace
            </button>
            <button type="button" onClick={onClearBefore}
              className="text-[12.5px] font-semibold text-muted hover:text-accent-text">
              Remove
            </button>
          </div>
        )}
      </Frame>

      <Frame label="With KRNL">
        <div className="overflow-hidden rounded-[24px] border border-hairline">
          <Phone mockup={mockup} />
        </div>
      </Frame>

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
  return (
    <div>
      <p className="mb-1.5 text-[11.5px] font-bold uppercase tracking-[.11em] text-faint">{label}</p>
      {children}
    </div>
  );
}
