'use client';

// Before and after, side by side — 2026-08-17.
//
// HER BRIEF: "when someone is given the link, they can see the optimized
// profile, but they can also see the before version of their profile. They can
// also compare them in parallel to see exactly what the difference is."
//
// THE BEFORE IS A SCREENSHOT of their real profile, uploaded — her choice when
// asked. A rebuilt "before" invites the one answer that ruins the whole point:
// "you made that look bad on purpose."
//
// ── What she corrected, and what it taught ──────────────────────────────────
//
// First I matched the two heights by CROPPING, and it ate the left edge of the
// bio. Then I offered a zoom, and that was the wrong tool: "It's not the zoom I
// asked for. I want this to be a responsive thing, like it happens in
// frameworks... it's not like a PNG or something."
//
// She was right twice. The phone was `w-full max-w-[392px]`, so a narrower
// column made it NARROWER while its text stayed 15px — the name broke onto two
// lines, the bio onto two, "Followed by" onto two. A phone does not do that. A
// phone keeps its proportions and gets smaller.
//
// So the phone is laid out once at its true width (430, a current large
// iPhone, which is what her own screenshots come from) and <Scaled> resizes the
// whole thing. Nothing reflows. One SIZE control drives both columns together,
// because two things sized differently cannot be compared.
//
// ONE COMPONENT, mounted by her screen and by a client's alike. Their copy is
// this view with the controls absent, never a second one (CLAUDE.md rule 0).

import { useRef, useState } from 'react';
import { Download, ImagePlus } from 'lucide-react';
import Phone, { PHONE_WIDTH } from '@/components/mockup/Phone';
import Scaled from '@/components/mockup/Scaled';
import { THEMES, type ProfileMockupRecord } from '@/lib/mockup/profile';
import { downloadPng, pngName } from '@/lib/exportPng';

export default function Compare({ mockup, onBefore, onClearBefore, onSize }: {
  mockup: ProfileMockupRecord;
  onBefore?: (file: File) => void;
  onClearBefore?: () => void;
  /** Absent for a client: they read the comparison, they do not size it. */
  onSize?: (percent: number) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const has = !!mockup.beforeImageUrl;
  const mine = !!onBefore;
  const bg = (THEMES[mockup.theme] ?? THEMES.dark).bg;
  // One number for the pair. 100 fills the space it is given.
  const size = mockup.framing.after.zoom;

  // ── Saving it as a picture ────────────────────────────────────────────────
  //
  // The capture points at an OFFSCREEN copy drawn at the phone's true width,
  // never at what is on screen. What is on screen lives inside a
  // `transform: scale()` — that is what makes it responsive — so capturing it
  // would bake in whatever size the window happened to be and produce a small,
  // soft file. Offscreen it is always 430 per phone, however the page is sized.
  const shot = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!shot.current || saving) return;
    setSaving(true);
    try {
      await downloadPng(shot.current, pngName([mockup.username || mockup.name, has ? 'before-and-after' : 'profile', mockup.date]), { background: bg });
    } catch {
      // A remote image that refuses to be read cross-origin is the one real
      // failure here, and it is not worth a dialog: the picture is still on
      // screen and she can screenshot it.
    } finally {
      setSaving(false);
    }
  }

  const saveButton = (
    <button type="button" onClick={save} disabled={saving}
      className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted hover:text-text disabled:opacity-50">
      <Download size={14} strokeWidth={2.2} />
      {saving ? 'Saving…' : 'Download as PNG'}
    </button>
  );

  // Drawn at true size, off the side of the page, only so it can be captured.
  const offscreen = (
    <div aria-hidden className="pointer-events-none fixed left-[-99999px] top-0">
      <div ref={shot} style={{ background: bg, padding: 16, display: 'flex', gap: 16 }}>
        {has && (
          <img src={mockup.beforeImageUrl} alt="" style={{ width: PHONE_WIDTH, alignSelf: 'flex-start' }} />
        )}
        <div style={{ width: PHONE_WIDTH }}><Phone mockup={mockup} /></div>
      </div>
    </div>
  );

  if (!has) {
    return (
      <div>
        <div className="mx-auto" style={{ width: `${size}%`, maxWidth: PHONE_WIDTH }}>
          <Label>{mine ? 'With KRNL' : 'Your profile'}</Label>
          <Frame bg={bg}><Scaled width={PHONE_WIDTH}><Phone mockup={mockup} /></Scaled></Frame>
        </div>
        <div className="mt-3 flex justify-center">{saveButton}</div>
        {offscreen}
        {mine && (
          <>
            <SizeControl value={size} onChange={onSize} />
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="mt-3 flex min-h-[120px] w-full flex-col items-center justify-center gap-2 rounded-[22px] border border-dashed border-hairline bg-sunken text-muted hover:text-text"
            >
              <ImagePlus size={22} strokeWidth={1.8} />
              <span className="text-[13px] font-semibold">Add a screenshot of their profile now</span>
              <span className="max-w-[280px] text-center text-[12px] leading-[1.5] text-faint">
                This is the before. It sits beside the new one so the difference
                speaks for itself.
              </span>
            </button>
            <FileInput inputRef={input} onBefore={onBefore} />
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* TWO COLUMNS AT EVERY SIZE (2026-08-17, her note: "on the phone, it
          doesn't look that good... it's not optimized"). It was `md:grid-cols-2`,
          so on a phone the two stacked and she had to SCROLL between them —
          and two things you cannot see at once are not a comparison. They are
          side by side at every width now; the phone scales, so half a narrow
          screen still shows a whole profile rather than a cropped one. The gap
          tightens on small screens because every pixel of width is a pixel of
          profile. */}
      <div className="mx-auto grid grid-cols-2 items-start gap-2 sm:gap-4"
        style={{ width: `${size}%`, maxWidth: PHONE_WIDTH * 2 + 16 }}>
        <div>
          <Label>Now</Label>
          {/* The screenshot fills the same column width as the phone, so the
              two are the same size and the comparison is fair. Its own height
              follows the picture: nothing is cropped, ever, because a cropped
              before is a dishonest before. */}
          <Frame bg={bg}>
            <img src={mockup.beforeImageUrl} alt="Their profile as it is today"
              className="block w-full" />
          </Frame>
        </div>
        <div>
          <Label>With KRNL</Label>
          <Frame bg={bg}><Scaled width={PHONE_WIDTH}><Phone mockup={mockup} /></Scaled></Frame>
        </div>
      </div>

      <div className="mt-3 flex justify-center">{saveButton}</div>
      {offscreen}

      {mine && (
        <>
          <SizeControl value={size} onChange={onSize} />
          <div className="mt-2 flex items-center gap-3">
            <button type="button" onClick={() => input.current?.click()}
              className="text-[12.5px] font-semibold text-muted hover:text-text">
              Replace the screenshot
            </button>
            <button type="button" onClick={onClearBefore}
              className="text-[12.5px] font-semibold text-muted hover:text-accent-text">
              Remove
            </button>
          </div>
          <FileInput inputRef={input} onBefore={onBefore} />
        </>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 truncate text-[10px] font-bold uppercase tracking-[.09em] text-faint sm:text-[11.5px] sm:tracking-[.11em]">{children}</p>;
}

/** The frame carries the PHONE'S background, so any gap reads as the screen. */
function Frame({ bg, children }: { bg: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-hairline" style={{ background: bg }}>
      {children}
    </div>
  );
}

/**
 * ONE control, driving both columns.
 *
 * Not a zoom: the phone is not a picture being magnified, it is a layout being
 * resized, so its type and spacing move together and nothing ever reflows. Two
 * columns sized separately could not be compared, which is why there is one
 * number and not two.
 */
function SizeControl({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  if (!onChange) return null;
  return (
    <label className="mt-3 flex items-center gap-2.5">
      <span className="w-[42px] shrink-0 text-[12px] text-muted">Size</span>
      <input
        type="range" min={40} max={100} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="min-w-0 max-w-[280px] flex-1 accent-[#ea4711]"
      />
      <span className="tnum w-[46px] shrink-0 text-[12px] text-faint">{Math.round(value)}%</span>
    </label>
  );
}

function FileInput({ inputRef, onBefore }: {
  inputRef: React.RefObject<HTMLInputElement>;
  onBefore?: (file: File) => void;
}) {
  return (
    <input
      ref={inputRef}
      type="file"
      accept="image/png,image/jpeg,image/webp"
      className="hidden"
      onChange={e => {
        const f = e.target.files?.[0];
        if (f && onBefore) onBefore(f);
        e.target.value = '';
      }}
    />
  );
}
