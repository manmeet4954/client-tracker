'use client';

// The Strategy room. Spec 34 §2.
//
// Strategy stops being a 470px drawer sliding over the work. It is a screen:
// its sections down the left, the work in the middle, the whole width. Seven
// tabs crammed into a narrow overlay was most of why it felt cramped.
//
// On a phone the sections become a strip across the top that scrolls sideways
// and never wraps to a second line.
//
// Leaving returns to where she was. The screen she came from is carried on
// `?back=`, so closing the room is one link and not a guess.

import Link from 'next/link';
import { ChevronLeft, Lock, LockOpen } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { renderProfile } from '@/lib/shell/profile';
import { CORNER_PANELS, ROOM_PANELS, SETTINGS_PANELS } from '@/lib/shell/nav';
import { StrategyBody } from '@/components/shell/StrategyPanel';
import Decide from './Decide';

/**
 * The sections, taken FROM the navigation map rather than listed again here.
 *
 * This used to be a second hardcoded list, and it did exactly what a second
 * list of anything always does: spec 35 registered a Profile mockup panel in
 * `CORNER_PANELS`, and the room silently did not draw it, because the room was
 * reading its own copy. One list, one place, and a new panel appears by being
 * registered rather than by being remembered twice.
 *
 * `Decide it` is shortened to `Decide` because the room has the space to be
 * plain; that relabelling is the only thing this adds to the map.
 */
const label = (p: { id: string; label: string }) => ({ id: p.id, label: p.label });

/** The brand work. */
export const ROOM_SECTIONS: { id: string; label: string }[] = CORNER_PANELS.map(label);
/** How the profile is run, kept apart on her instruction (2026-08-11). */
export const ROOM_SETTINGS: { id: string; label: string }[] = SETTINGS_PANELS.map(label);
/** Every section the room can open, including the ones reached from a row. */
export const ALL_SECTIONS: { id: string; label: string }[] = ROOM_PANELS.map(label);

export const DEFAULT_SECTION = 'brand-document';

export function roomSectionOf(value: string | null | undefined): string {
  // `derivation` is not in the rail any more, but a row on The brand still
  // opens it, so routing must keep accepting it.
  if (value === 'derivation') return 'derivation';
  return ALL_SECTIONS.some(s => s.id === value) ? (value as string) : DEFAULT_SECTION;
}

export default function Room({
  profileId, section, backHref, hrefFor,
}: {
  profileId: string;
  section: string;
  /** Where she was before she opened Strategy. */
  backHref: string;
  hrefFor: (sectionId: string) => string;
}) {
  const { state, role } = useApp();
  const locked = renderProfile(state, profileId, role).strategy_locked;
  const active = roomSectionOf(section);

  return (
    <div className="min-h-full bg-paper">
      <header
        className="flex items-center gap-3 bg-ink px-4 py-3.5 text-white md:px-7 md:py-4"
      >
        <Link
          href={backHref}
          className="flex items-center gap-1.5 text-[12.5px] font-semibold text-white/60 hover:text-white"
        >
          <ChevronLeft size={18} strokeWidth={2.3} />
          <span className="hidden md:inline">Back to the work</span>
        </Link>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[19px] font-bold leading-[1.15] tracking-[-.02em] md:text-[21px]">
            Strategy
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-[12.5px] font-semibold text-white/60">
          {locked ? <Lock size={15} strokeWidth={2.1} /> : <LockOpen size={15} strokeWidth={2.1} />}
          <span className="hidden sm:inline">
            {locked ? 'Locked' : 'Not locked yet'}
          </span>
        </span>
      </header>

      {/* Phone: one row of sections, sideways, never two lines. */}
      <nav
        className="no-scrollbar flex gap-1.5 overflow-x-auto bg-control px-4 py-2.5 md:hidden"
        style={{ borderBottom: '1px solid rgba(23,21,26,.09)' }}
      >
        {[...ROOM_SECTIONS, ...ROOM_SETTINGS].map(s => (
          <Link
            key={s.id}
            href={hrefFor(s.id)}
            className={`shrink-0 whitespace-nowrap rounded-[10px] px-[13px] py-[7px] text-[12.5px] font-semibold ${
              s.id === active ? 'bg-ink text-white' : 'bg-white text-muted'
            }`}
          >
            {s.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-start">
        {/* Desktop: the sections live down the left and stay put. */}
        <aside
          className="sticky top-0 hidden w-[172px] shrink-0 flex-col gap-0.5 p-3 md:flex"
          style={{ borderRight: '1px solid rgba(23,21,26,.09)' }}
        >
          {ROOM_SECTIONS.map(s => (
            <Link
              key={s.id}
              href={hrefFor(s.id)}
              className={`rounded-[10px] px-3 py-2.5 text-[13.5px] font-semibold ${
                s.id === active ? 'bg-ink text-white' : 'text-muted hover:bg-white hover:text-text'
              }`}
            >
              {s.label}
            </Link>
          ))}

          <p className="mt-4 px-3 pb-1 text-[11px] font-bold uppercase tracking-[.1em] text-faint">
            Settings
          </p>
          {ROOM_SETTINGS.map(s => (
            <Link
              key={s.id}
              href={hrefFor(s.id)}
              className={`rounded-[10px] px-3 py-2.5 text-[13.5px] font-semibold ${
                s.id === active ? 'bg-ink text-white' : 'text-muted hover:bg-white hover:text-text'
              }`}
            >
              {s.label}
            </Link>
          ))}
          {!locked && (
            <p className="mt-3 px-3 text-[12px] leading-[1.55] text-faint">
              Briefs and drafts wait for this. Recording your work does not.
            </p>
          )}
        </aside>

        <main className="min-w-0 flex-1 px-4 py-5 md:px-6 md:py-6">
          {active === 'derivation'
            ? <Decide profileId={profileId} brandHref={hrefFor('brand')} />
            : <StrategyBody profileId={profileId} tab={active} hrefFor={hrefFor} />}
        </main>
      </div>
    </div>
  );
}
