'use client';

// Draw at one true size, then scale the whole thing — 2026-08-17.
//
// HER CORRECTION: "I want this to be a responsive thing, like it happens in
// frameworks and other websites... I want you to redesign it a bit or make it
// in a way that it's framer-like, with width and height adjustable. It's not
// like a PNG or something."
//
// THE BUG THIS FIXES. The phone was `w-full max-w-[392px]`, so in a narrower
// column it got NARROWER while its text stayed 15px. Everything then wrapped:
// the name onto two lines, the bio onto two, "Followed by" onto two. That is
// not what a phone does. A phone keeps its proportions and gets smaller.
//
// So the phone is laid out ONCE at its true width and this scales the result.
// Type, spacing and images shrink together, exactly as a design tool does it,
// and the outer box reports the scaled height so nothing below it overlaps.
//
// It is a transform, not a picture: the content stays live, editable and
// selectable inside it.

import { useEffect, useRef, useState } from 'react';

export default function Scaled({ width, children }: {
  /** The true width the child is laid out at, in CSS pixels. */
  width: number;
  children: React.ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const outer = box.current;
    const content = inner.current;
    if (!outer || !content) return;

    const measure = () => {
      const available = outer.clientWidth;
      if (!available) return;
      const s = available / width;
      setScale(s);
      // The transform does not change layout height, so the box is told what
      // the scaled content actually occupies. Without this, everything under
      // the phone sits under a box the wrong size.
      setHeight(content.offsetHeight * s);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    ro.observe(content);
    return () => ro.disconnect();
  }, [width]);

  return (
    <div ref={box} className="w-full overflow-hidden" style={{ height }}>
      <div
        ref={inner}
        style={{ width, transform: `scale(${scale})`, transformOrigin: 'top left' }}
      >
        {children}
      </div>
    </div>
  );
}
