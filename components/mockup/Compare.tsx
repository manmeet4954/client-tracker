'use client';

// Before and after, side by side — 2026-08-17.
//
// HER BRIEF: "when someone is given the link, they can see the optimized
// profile, but they can also see the before version of their profile. They can
// also compare them in parallel to see exactly what the difference is."
//
// THE BEFORE IS A SCREENSHOT of their real profile, uploaded, and that was her
// choice when asked. A rebuilt "before" invites the one answer that ruins the
// whole point: "you made that look bad on purpose."
//
// FRAMING IS HERS. The first version matched the two columns by cropping, and
// it ate the left edge of a real screenshot's bio. Her answer was the right
// one: "can i not adjust it myself if u build the settings like that for both
// before and after." So nothing here guesses at a crop. Zoom starts at 100,
// which shows the WHOLE thing, letterboxed if it does not fill — a word is
// never hidden unless she hid it — and she can zoom and move either side.
//
// ONE COMPONENT, mounted by her screen and by a client's alike. The client's
// copy is this view with the controls absent, never a second one drawn for
// them (CLAUDE.md rule 0).

import { useRef } from 'react';
import { ImagePlus } from 'lucide-react';
import Phone from '@/components/mockup/Phone';
import type { MockupFraming, ProfileMockupRecord } from '@/lib/mockup/profile';

export default function Compare({ mockup, onBefore, onClearBefore, onFraming }: {
  mockup: ProfileMockupRecord;
  /** All three absent for a client: they read the comparison, they do not build it. */
  onBefore?: (file: File) => void;
  onClearBefore?: () => void;
  onFraming?: (side: 'before' | 'after', patch: Partial<MockupFraming>) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const has = !!mockup.beforeImageUrl;
  const mine = !!onBefore;

  if (!has && !mine) {
    return (
      <div className="mx-auto max-w-[392px]">
        <p className="mb-1.5 text-[11.5px] font-bold uppercase tracking-[.11em] text-faint">Your profile</p>
        <Framed framing={mockup.framing.after}><Phone mockup={mockup} /></Framed>
      </div>
    );
  }

  return (
    <div className="grid items-stretch gap-4 md:grid-cols-2">
      <Column label="Now" framing={mockup.framing.before}
        controls={mine && has ? { side: 'before' as const, onFraming } : undefined}>
        {has ? (
          <img
            src={mockup.beforeImageUrl}
            alt="Their profile as it is today"
            className="h-full w-full object-contain object-top"
          />
        ) : null}
      </Column>

      {!has && mine && (
        <div className="md:hidden" />
      )}

      <Column label="With KRNL" framing={mockup.framing.after}
        controls={mine ? { side: 'after' as const, onFraming } : undefined}>
        <Phone mockup={mockup} />
      </Column>

      {mine && !has && (
        <div className="md:col-span-2">
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex min-h-[160px] w-full flex-col items-center justify-center gap-2 rounded-[22px] border border-dashed border-hairline bg-sunken text-muted hover:text-text"
          >
            <ImagePlus size={22} strokeWidth={1.8} />
            <span className="text-[13px] font-semibold">Add a screenshot of their profile now</span>
            <span className="max-w-[260px] text-center text-[12px] leading-[1.5] text-faint">
              This is the before. It sits beside the new one so the difference
              speaks for itself.
            </span>
          </button>
        </div>
      )}

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

/** One labelled side: the picture, framed as she set it, and her controls. */
function Column({ label, framing, controls, children }: {
  label: string;
  framing: MockupFraming;
  controls?: { side: 'before' | 'after'; onFraming?: (s: 'before' | 'after', p: Partial<MockupFraming>) => void };
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex h-full w-full max-w-[392px] flex-col">
      <p className="mb-1.5 text-[11.5px] font-bold uppercase tracking-[.11em] text-faint">{label}</p>
      <div className="min-h-0 flex-1">
        <Framed framing={framing}>{children}</Framed>
      </div>
      {controls?.onFraming && <Controls framing={framing} side={controls.side} onFraming={controls.onFraming} />}
    </div>
  );
}

/**
 * The frame both sides sit in.
 *
 * At zoom 100 nothing is scaled and nothing is cut: `object-contain` on the
 * image, and the phone at its natural size. Above 100 the content is scaled and
 * `x`/`y` decide what stays in view. `overflow-hidden` is what makes the two
 * columns end on the same line however they are set.
 */
function Framed({ framing, children }: { framing: MockupFraming; children: React.ReactNode }) {
  const scale = framing.zoom / 100;
  return (
    <div className="h-full overflow-hidden rounded-[22px] border border-hairline bg-sunken">
      <div
        className="h-full w-full"
        style={{
          transform: scale === 1 ? undefined : `scale(${scale})`,
          transformOrigin: `${framing.x}% ${framing.y}%`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Her three numbers, said in plain words. Never rendered for a client. */
function Controls({ framing, side, onFraming }: {
  framing: MockupFraming;
  side: 'before' | 'after';
  onFraming: (s: 'before' | 'after', p: Partial<MockupFraming>) => void;
}) {
  const moved = framing.zoom !== 100 || framing.x !== 50 || framing.y !== 0;
  return (
    <div className="mt-2 space-y-1.5">
      <Slider label="Zoom" value={framing.zoom} min={100} max={300} suffix="%"
        onChange={v => onFraming(side, { zoom: v })} />
      {framing.zoom > 100 && (
        <>
          <Slider label="Left and right" value={framing.x} min={0} max={100}
            onChange={v => onFraming(side, { x: v })} />
          <Slider label="Up and down" value={framing.y} min={0} max={100}
            onChange={v => onFraming(side, { y: v })} />
        </>
      )}
      {moved && (
        <button type="button" onClick={() => onFraming(side, { zoom: 100, x: 50, y: 0 })}
          className="text-[12px] font-semibold text-muted hover:text-text">
          Reset this side
        </button>
      )}
    </div>
  );
}

function Slider({ label, value, min, max, suffix, onChange }: {
  label: string; value: number; min: number; max: number; suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-2.5">
      <span className="w-[92px] shrink-0 text-[12px] text-muted">{label}</span>
      <input
        type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="min-w-0 flex-1 accent-[#ea4711]"
      />
      <span className="tnum w-[46px] shrink-0 text-right text-[12px] text-faint">
        {Math.round(value)}{suffix ?? ''}
      </span>
    </label>
  );
}
