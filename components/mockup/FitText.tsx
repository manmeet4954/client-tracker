'use client';

// Text that shrinks rather than wraps — 2026-08-17.
//
// HER ASK: "the name line... and the second line... are coming in the next
// lines, and I don't want that. I want them to be in one line only."
//
// The phone is laid out at a real phone's width, and the column beside the
// avatar is genuinely narrower than "Gautam Nauharia | Hybrid Athlete & Yoga
// Coach" at 15px. Instagram wraps it. She does not want it wrapped.
//
// Widening the phone would be lying about the phone, and cutting the text is
// hers to decide, not mine. So the type SHRINKS to fit instead: it starts at
// the size Instagram uses and steps down only as far as it must, and only for
// the block that actually overflows. Short text is untouched, so nothing looks
// shrunken until something has to.
//
// It measures per line, not per character: `lines` is how many the content is
// allowed to occupy — 1 for the name, and for the bio the number of newlines
// SHE typed, so her own line breaks are kept and only accidental wrapping is
// removed.
//
// There is a floor. Below it, readability costs more than the wrap saves, and
// it is allowed to wrap again — a silent 6px name would be worse than the
// thing she is asking me to fix.

import { useEffect, useRef, useState } from 'react';

const FLOOR = 0.72;   // of the starting size, ~11px from 15px

export default function FitText({ text, lines, children }: {
  /** What is measured. Passed separately so a re-fit runs when it changes. */
  text: string;
  /** How many lines the content may occupy at full size. */
  lines: number;
  children: React.ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = box.current;
    if (!el) return;

    let cancelled = false;
    const fit = () => {
      if (cancelled) return;
      // Always measure from full size, or a previous shrink compounds and the
      // text creeps smaller every time she types.
      el.style.fontSize = '';
      const full = parseFloat(getComputedStyle(el).fontSize) || 15;
      const line = parseFloat(getComputedStyle(el).lineHeight) || full * 1.35;
      const allowed = Math.ceil(line * lines) + 1;      // +1 for sub-pixel rounding

      let s = 1;
      while (s > FLOOR && el.scrollHeight > allowed) {
        s -= 0.02;
        el.style.fontSize = `${full * s}px`;
      }
      el.style.fontSize = '';
      if (!cancelled) setScale(s);
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => { cancelled = true; ro.disconnect(); };
  }, [text, lines]);

  return (
    <div ref={box} style={scale === 1 ? undefined : { fontSize: `${scale}em` }}>
      {children}
    </div>
  );
}
