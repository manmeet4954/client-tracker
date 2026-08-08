'use client';

// The profile frame — the restructure handoff, "Level 2 — Inside one profile".
//
// One world at a time. The three apps are the only navigation on her side; a
// client gets exactly the windows their doors grant. Leaving a profile means
// going back to the desk, and there is no other exit: nothing rendered in here
// links to another profile, in any form, including its name. That is acceptance
// test 1, checked statically and dynamically.
//
// CHROME IS INK. Her decision of 2026-08-04: a profile's colour is IDENTITY
// ONLY — the avatar square, the dot beside the name, a card edge. It never
// paints the rail, a tab, a button, a header band or an active state. Eight
// profiles used to mean eight coloured chromes, and that is most of why the app
// read as noise.
//
// Measurements come straight from the prototype and are not negotiable:
//   rail        224px, #1c1a21, padding 20px 14px 16px
//   app item    gap 11, padding 11x12, radius 13, 14.5px/600
//   active      white ground, #17151a text, icon #ea4711
//   inactive    rgba(255,255,255,.82), icon rgba(255,255,255,.7)
//   header      white, hairline bottom, padding 16px 26px (14px 16px on phone)
//   bottom bar  white, hairline top, icon 21px + 10.5px/600, active #ea4711

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BarChart3, ChevronLeft, List, MessageCircle, PenLine, SlidersHorizontal, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import type { ClientWindow } from '@/lib/access';
import { hueFor, renderProfile, shellRole } from '@/lib/shell/profile';
import { APPS, rendered } from '@/lib/shell/nav';
import type { RenderedNode } from '@/lib/shell/nav';
import { readAnswers, readRounds } from '@/lib/intake/rounds';
import { unanswered } from '@/lib/intake/status';
import { DEFAULT_STRATEGY_TAB, strategyTabOf } from '@/components/shell/StrategyPanel';

/** The design names three icons and only three. Intake, Creation, Analysis. */
const APP_ICON: Record<string, LucideIcon> = {
  intake: MessageCircle,
  creation: PenLine,
  analysis: BarChart3,
};

const WINDOW_ICON: Record<string, LucideIcon> = {
  brand: SlidersHorizontal,
  intake: MessageCircle,
  content: PenLine,
  assets: PenLine,
  results: BarChart3,
};

interface Item {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Empty string draws no badge at all, exactly as the prototype has it. */
  badge: string;
  /** The tail of the route, relative to the profile, used to decide active. */
  match: string;
}

function itemsForOwner(
  profileId: string, apps: RenderedNode[], badges: Record<string, string>,
): Item[] {
  return apps.map(a => ({
    id: a.id,
    label: a.label,
    href: a.children?.length
      ? `/profile/${profileId}/${a.id}/${a.children[0].id}`
      : `/profile/${profileId}/${a.id}`,
    icon: APP_ICON[a.id] ?? PenLine,
    badge: badges[a.id] ?? '',
    match: `/${a.id}`,
  }));
}

function itemsForClient(profileId: string, windows: ClientWindow[]): Item[] {
  return windows.map(w => ({
    id: w.id,
    label: w.label,
    href: `/profile/${profileId}${w.route}`,
    icon: WINDOW_ICON[w.id] ?? PenLine,
    badge: '',
    match: w.route,
  }));
}

/** The item the current address belongs to. Longest matching route wins. */
function activeIdOf(items: Item[], tail: string): string | null {
  let best: Item | null = null;
  for (const i of items) {
    const hit = i.match === '' ? tail === '' : tail === i.match || tail.startsWith(`${i.match}/`);
    if (hit && (!best || i.match.length > best.match.length)) best = i;
  }
  return best?.id ?? null;
}

export default function ProfileFrame({
  profileId, children,
}: { profileId: string; children: React.ReactNode }) {
  const { state, role, windows } = useApp();
  const { client, data } = useClient(profileId);
  const pathname = usePathname() ?? '';
  const search = useSearchParams();
  const [moreOpen, setMoreOpen] = useState(false);

  if (!client) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-sm text-faint">This profile is not available.</p>
      </div>
    );
  }

  const hue = hueFor(client);
  const kind = shellRole(state, role, profileId);
  const isOwner = kind === 'owner';
  const profile = renderProfile(state, profileId, role);

  // The only way out of a profile is the desk, and a client never sees the desk:
  // one binding means there is nowhere to go back to, so no back control is
  // drawn. Two or more and it goes to their own small picker, never the desk.
  const canLeave = isOwner || (state.bindings ?? []).filter(b => b.role === role).length > 1;

  const items = isOwner
    ? itemsForOwner(profileId, rendered(APPS, profile, kind), badgesFor(data))
    : itemsForClient(profileId, windows[profileId] ?? []);

  const base = `/profile/${profileId}`;
  const tail = pathname.startsWith(base) ? pathname.slice(base.length) : '';
  const activeId = activeIdOf(items, tail);

  // The corner is a panel over the current screen, carried on the query string,
  // so opening it never leaves the screen underneath and closing it just clears
  // the parameter. The old `/strategy/<panel>` addresses still render the same
  // panels as a page — deep links must not break.
  const inCorner = tail === '/strategy' || tail.startsWith('/strategy/');
  const openTab = search?.get('strategy') ?? null;
  const cornerOpen = isOwner && openTab !== null && !inCorner;

  /**
   * Spec 34 §2: Strategy is a ROOM now, not a drawer over the work. Seven
   * sections crammed into a 470px overlay is most of why it felt cramped, and
   * it is her decision space, not a quick peek.
   *
   * `?back=` carries where she was, so leaving the room returns there exactly
   * as closing the drawer used to.
   */
  const toRoom = (tab: string) => {
    const here = `${pathname}${search?.toString() ? `?${search.toString()}` : ''}`;
    return `/profile/${profileId}/strategy/${tab}?back=${encodeURIComponent(here)}`;
  };

  const withStrategy = (tab: string) => {
    const params = new URLSearchParams(search?.toString() ?? '');
    params.set('strategy', tab);
    return `${pathname}?${params.toString()}`;
  };
  const withoutStrategy = () => {
    const params = new URLSearchParams(search?.toString() ?? '');
    params.delete('strategy');
    const q = params.toString();
    return q ? `${pathname}?${q}` : pathname;
  };

  // §5.8 / §7.5 — one line at the top, in her language, with a date. A read-only
  // surface says so once; it never disables a hundred buttons.
  const notice = lifecycleNotice(client.lifecycle, client.lifecycleAt);

  // The phone bar holds three items and never a fourth. For her that is
  // automatic; a client login can hold up to five windows, so the third item
  // carries whatever the first two did not.
  const capped = items.length > 3 ? items.slice(0, 2) : items;
  const grouped = items.length > 3 ? items.slice(2) : [];
  const groupedOn = grouped.some(i => i.id === activeId);

  return (
    <div className="relative flex h-screen overflow-hidden bg-paper text-text">
      {/* Desktop: the rail is the three apps. NEVER the profile list. */}
      <aside
        className="hidden w-56 shrink-0 flex-col bg-ink text-white md:flex"
        style={{ padding: '20px 14px 16px' }}
      >
        {canLeave ? (
          <Link
            href="/shelf"
            className="flex items-center gap-2 px-2 pb-[18px] pt-0.5 text-[11.5px] font-bold uppercase tracking-[.13em] text-white/55 hover:text-white"
          >
            <ChevronLeft size={15} strokeWidth={2.3} />
            {isOwner ? 'The desk' : 'Your profiles'}
          </Link>
        ) : (
          <div className="pb-[18px]" />
        )}

        <div
          className="mb-1.5 flex items-center gap-[11px] px-2 pb-5"
          style={{ borderBottom: '1px solid rgba(255,255,255,.12)' }}
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-sm font-bold text-white"
            style={{ backgroundColor: hue }}
            aria-hidden="true"
          >
            {client.name.charAt(0)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-base font-semibold leading-[1.2] tracking-[-.01em]">
              {client.name}
            </span>
            <span className="mt-0.5 block text-[11.5px] text-white/55">{kindLine(kind, client.ownerKind)}</span>
          </span>
        </div>

        <nav className="flex flex-col gap-[3px] pt-3">
          {items.map(item => {
            const Icon = item.icon;
            const on = item.id === activeId;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`flex items-center gap-[11px] rounded-[13px] px-3 py-[11px] text-[14.5px] font-semibold tracking-[-.01em] ${
                  on ? 'bg-white text-text' : 'text-white/[.82] hover:bg-white/[.06]'
                }`}
              >
                <span className="flex items-center" style={{ color: on ? '#ea4711' : 'rgba(255,255,255,.7)' }}>
                  <Icon size={18} strokeWidth={1.9} />
                </span>
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && (
                  <span
                    className="tnum text-[11.5px] font-bold"
                    style={{ color: on ? '#9b95a1' : 'rgba(255,255,255,.55)' }}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1" />

        {isOwner && (
          <p className="px-2.5 text-[11.5px] leading-[1.5] text-white/35">
            {profile.strategy_locked
              ? 'Strategy locked. Creation is open.'
              : 'Strategy is not locked, so Creation is read only.'}
          </p>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header
          className="flex flex-none items-center gap-[11px] bg-white px-4 py-[14px] md:px-[26px] md:py-4"
          style={{ borderBottom: '1px solid rgba(23,21,26,.09)' }}
        >
          {canLeave && (
            <Link href="/shelf" className="flex text-muted md:hidden" aria-label={isOwner ? 'Back to the desk' : 'Back to your profiles'}>
              <ChevronLeft size={21} strokeWidth={2.2} />
            </Link>
          )}
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: hue }} />
          <span className="min-w-0 flex-1 truncate text-base font-semibold tracking-[-.01em]">
            {client.name}
          </span>
          {isOwner && !inCorner && (
            <Link
              href={toRoom(strategyTabOf(openTab ?? DEFAULT_STRATEGY_TAB))}
              title="Strategy"
              className="flex items-center gap-[7px] rounded-[11px] border px-[13px] py-[7px] text-muted hover:text-text"
              style={{ borderColor: 'rgba(23,21,26,.14)' }}
            >
              <SlidersHorizontal size={17} strokeWidth={1.9} />
              <span className="hidden text-[12.5px] font-semibold md:inline">Strategy</span>
            </Link>
          )}
        </header>

        <main className="flex-1 overflow-y-auto">
          {notice && (
            <div
              className="bg-chip px-4 py-2 text-sm text-muted md:px-[26px]"
              style={{ borderBottom: '1px solid rgba(23,21,26,.09)' }}
            >
              {notice}
            </div>
          )}
          {children}
        </main>

        {/* Phone: one item per live app, and never more than three. */}
        {items.length > 0 && (
          <nav
            className="flex flex-none bg-white pb-1.5 md:hidden"
            style={{ borderTop: '1px solid rgba(23,21,26,.09)' }}
          >
            {capped.map(item => {
              const Icon = item.icon;
              const on = item.id === activeId;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex flex-1 flex-col items-center gap-1 pb-2 pt-2.5 text-[10.5px] font-semibold"
                  style={{ color: on ? '#ea4711' : '#9b95a1' }}
                >
                  <Icon size={21} strokeWidth={1.9} />
                  {item.label}
                </Link>
              );
            })}
            {grouped.length > 0 && (
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                className="flex flex-1 flex-col items-center gap-1 pb-2 pt-2.5 text-[10.5px] font-semibold"
                style={{ color: groupedOn ? '#ea4711' : '#9b95a1' }}
              >
                <List size={21} strokeWidth={1.9} />
                More
              </button>
            )}
          </nav>
        )}
      </div>

      {/* The rest of a client's windows, behind the third item. */}
      {moreOpen && grouped.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-[rgba(23,21,26,.34)] md:hidden"
          onClick={() => setMoreOpen(false)}
        >
          <div className="rounded-t-frame bg-white p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 pb-2">
              <span className="flex-1 text-sm font-semibold">The rest of your windows</span>
              <button type="button" onClick={() => setMoreOpen(false)} aria-label="Close" className="flex text-faint">
                <X size={19} strokeWidth={2.2} />
              </button>
            </div>
            {grouped.map(item => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-3 border-t border-divider py-3 text-[14.5px] font-semibold"
                  style={{ color: item.id === activeId ? '#ea4711' : '#17151a' }}
                >
                  <Icon size={19} strokeWidth={1.9} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* The overlay is gone: Strategy opens as its own screen (spec 34 §2).
          A `?strategy=` link from anywhere still works - it redirects into the
          room - so no old link, banner button or bookmark breaks. */}
      {cornerOpen && <StrategyRedirect to={toRoom(strategyTabOf(openTab))} />}
    </div>
  );
}

/**
 * The two counts the design puts on the rail, each derived from the array it
 * describes: Intake carries the questions still waiting on an answer, Creation
 * the pieces that are not posted yet. No headline states a number that is not
 * counted from the same data at render time.
 */
function badgesFor(data: ReturnType<typeof useClient>['data']): Record<string, string> {
  const body = data.body;
  let open = 0;
  if (body) {
    const answers = readAnswers(body);
    for (const r of readRounds(body)) {
      if (r.status === 'not-sent' || r.status === 'curated') continue;
      open += unanswered(
        { version: r.version, parameters: r.parameters, sent: true, curation: r.curation },
        answers,
      ).length;
    }
  }
  const unposted = (data.contentCards ?? []).filter(c => c.stage !== 'posted').length;
  return {
    intake: open > 0 ? String(open) : '',
    creation: unposted > 0 ? String(unposted) : '',
  };
}

/** One plain line under the name. It never names another profile. */
function kindLine(kind: string, ownerKind: string | undefined): string {
  if (kind !== 'owner') return 'Your workspace';
  return ownerKind === 'hers' ? 'One of yours' : 'Client';
}

function lifecycleNotice(lifecycle: string | undefined, at: string | undefined): string | null {
  const since = at ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }).format(new Date(at)) : '';
  switch (lifecycle) {
    case 'paused':
      return since ? `Paused since ${since}. Everything here reads; nothing new is made.` : 'Paused. Everything here reads; nothing new is made.';
    case 'closing':
      return 'Closing. Connections are revoked and the export package is in the corner.';
    case 'archived':
      return 'Archived. Everything is readable and nothing can be changed.';
    default:
      return null;
  }
}

/**
 * An old `?strategy=` link, sent into the room.
 *
 * Every banner button, bookmark and deep link built before spec 34 used that
 * query. Rather than hunt them all down and risk missing one, the frame keeps
 * honouring it and forwards. It renders nothing.
 */
function StrategyRedirect({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => { router.replace(to); }, [router, to]);
  return null;
}
