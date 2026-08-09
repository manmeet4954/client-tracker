'use client';

// The level-3 furniture — the restructure handoff, "Level 3 — Inside each app".
//
// Every app screen wears the same three things: a display title, a segmented
// control for its screens, and (before the lock) the banner that says why
// nothing here can be written. They live in one file so Intake, Creation and
// Analysis cannot drift apart, which is how the app grew two of everything the
// first time.
//
// Measurements come straight from the prototype and are not negotiable:
//   segmented wrap  #efece9, padding 4, radius 13, gap 4
//   segment         13px/600, padding 7x14, radius 10
//   segment on      white, #17151a, shadow 0 1px 2px rgba(23,21,26,.10)
//   title           Bricolage Grotesque 700, 30px, -.02em, line-height 1.05

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Lock } from 'lucide-react';

export interface Segment {
  id: string;
  label: string;
  href?: string;
}

/**
 * The segmented control. On a narrow screen it is ONE row that scrolls
 * sideways; it must never wrap to two lines, which is the rule the old tab bar
 * broke on every phone.
 */
export function Segmented({
  segments, active, onSelect,
}: {
  segments: Segment[];
  active: string;
  onSelect?: (id: string) => void;
}) {
  if (segments.length < 2) return null;
  return (
    <div className="no-scrollbar flex max-w-full flex-nowrap gap-1 overflow-x-auto rounded-[13px] bg-chip p-1 md:flex-wrap md:overflow-visible">
      {segments.map(s => {
        const on = s.id === active;
        const className = [
          'shrink-0 whitespace-nowrap rounded-[10px] px-3.5 py-[7px] text-[13px] font-semibold transition-colors',
          on ? 'bg-white text-text shadow-[0_1px_2px_rgba(23,21,26,.10)]' : 'text-muted hover:text-text',
        ].join(' ');
        return s.href
          ? <Link key={s.id} href={s.href} className={className}>{s.label}</Link>
          : <button key={s.id} type="button" onClick={() => onSelect?.(s.id)} className={className}>{s.label}</button>;
      })}
    </div>
  );
}

/** The app's title and its screens, on one line where there is room. */
export function ScreenHeader({
  title, segments, active, onSelect, children,
}: {
  title: string;
  segments?: Segment[];
  active?: string;
  onSelect?: (id: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3.5">
      <h2 className="font-display text-[30px] font-bold leading-[1.05] tracking-[-.02em] text-text">{title}</h2>
      {segments && active !== undefined && (
        <Segmented segments={segments} active={active} onSelect={onSelect} />
      )}
      {children}
    </div>
  );
}

/**
 * Before the lock.
 *
 * It used to read "nothing can be written here. Read the board, but the pieces
 * cannot move", and that was true when the lock refused every write. Her
 * decision of 2026-08-09 changed the rule: recording what is happening always
 * works, and only the parts that need a strategy wait for it. So the banner now
 * says what is actually off, and says the work still saves.
 *
 * The button opens the Strategy corner over the current screen. It never
 * navigates away, because the corner is a panel and not a place.
 */
export function LockBanner() {
  const pathname = usePathname() ?? '';
  const search = useSearchParams();
  const params = new URLSearchParams(search?.toString() ?? '');
  params.set('strategy', 'lock');

  return (
    <div className="flex flex-wrap items-center gap-3.5 rounded-2xl border border-[rgba(234,71,17,.3)] bg-white px-[18px] py-[15px]">
      <span className="flex text-accent">
        <Lock size={19} strokeWidth={1.9} />
      </span>
      <span className="min-w-[16rem] flex-1 text-sm leading-[1.5] text-text">
        Strategy is still to be locked, so the parts that need it are off, like drafts and briefs.
        Everything you record here still saves.
      </span>
      <Link
        href={`${pathname}?${params.toString()}`}
        className="whitespace-nowrap rounded-xl bg-ink px-[18px] py-2.5 text-[13.5px] font-semibold text-white"
      >
        Go and lock it
      </Link>
    </div>
  );
}

/** One line, for a screen that is switched off and kept (S9). */
export function HistoryLine({ children }: { children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-hairline bg-white px-[18px] py-3 text-sm text-muted">
      {children ?? 'This one is switched off and kept. Everything below reads; nothing new is written.'}
    </div>
  );
}

/** The page frame every level-3 screen sits in. */
export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-3.5 p-4 md:p-7">
      {children}
    </div>
  );
}
