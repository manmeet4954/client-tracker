'use client';

// The profile frame — spec 28 §5.1, §7.1, §8.
//
// One world at a time, lightly skinned in the brand's colour. The three apps are
// the only navigation on her side; a client gets exactly the windows their doors
// grant. Leaving a profile means going back to the shelf, and there is no other
// exit: nothing rendered in here links to another profile, in any form, including
// its name (§5.7). That is acceptance test 1, checked statically and dynamically.
//
// The accent is CHROME ONLY (§3.4): the header band, the active nav item, focus
// rings, primary buttons. Content surfaces stay neutral.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, ClipboardList, PenLine, BarChart3, SlidersHorizontal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import type { ClientWindow } from '@/lib/access';
import { accentFor, renderProfile, shellRole } from '@/lib/shell/profile';
import { APPS, rendered } from '@/lib/shell/nav';
import type { RenderedNode } from '@/lib/shell/nav';

const APP_ICON: Record<string, LucideIcon> = {
  intake: ClipboardList,
  creation: PenLine,
  analysis: BarChart3,
};

const WINDOW_ICON: Record<string, LucideIcon> = {
  brand: SlidersHorizontal,
  intake: ClipboardList,
  content: PenLine,
  assets: PenLine,
  results: BarChart3,
};

interface Item { id: string; label: string; href: string; icon: LucideIcon }

function itemsForOwner(profileId: string, apps: RenderedNode[]): Item[] {
  return apps.map(a => ({
    id: a.id,
    label: a.label,
    href: a.children?.length
      ? `/profile/${profileId}/${a.id}/${a.children[0].id}`
      : `/profile/${profileId}/${a.id}`,
    icon: APP_ICON[a.id] ?? PenLine,
  }));
}

function itemsForClient(profileId: string, windows: ClientWindow[]): Item[] {
  return windows.map(w => ({
    id: w.id,
    label: w.label,
    href: `/profile/${profileId}${w.route}`,
    icon: WINDOW_ICON[w.id] ?? PenLine,
  }));
}

export default function ProfileFrame({
  profileId, children,
}: { profileId: string; children: React.ReactNode }) {
  const { state, role, windows } = useApp();
  const { client, data } = useClient(profileId);
  const pathname = usePathname() ?? '';

  if (!client) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-sm text-stone-400">This profile is not available.</p>
      </div>
    );
  }

  const accent = accentFor(client, data);
  const kind = shellRole(state, role, profileId);
  const isOwner = kind === 'owner';
  const profile = renderProfile(state, profileId, role);
  const items = isOwner
    ? itemsForOwner(profileId, rendered(APPS, profile, kind))
    : itemsForClient(profileId, windows[profileId] ?? []);

  const inCorner = pathname.startsWith(`/profile/${profileId}/strategy`);
  const active = (href: string) => pathname.startsWith(href.split('?')[0]);

  // §5.8 / §7.5 — one line at the top, in her language, with a date. A read-only
  // surface says so once; it never disables a hundred buttons.
  const notice = lifecycleNotice(client.lifecycle, client.lifecycleAt);

  return (
    <div className="flex h-screen overflow-hidden bg-[#F7F7F5]">
      {/* Desktop: the sidebar is the three apps and the corner. NEVER the profile list. */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-stone-200 bg-white">
        <div className="px-4 py-3 border-b border-stone-100">
          <Link href="/shelf" className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-900">
            <ArrowLeft size={13} />
            All profiles
          </Link>
          <div className="mt-2.5 flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: accent }} />
            <h1 className="truncate text-sm font-bold text-stone-900">{client.name}</h1>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {items.map(item => {
            const Icon = item.icon;
            const on = active(`/profile/${profileId}/${item.id === 'brand' ? '' : item.id}`) && !inCorner;
            return (
              <Link key={item.id} href={item.href}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  on ? 'font-semibold' : 'text-stone-600 hover:bg-stone-50'
                }`}
                style={on ? { backgroundColor: `${accent}14`, color: accent } : undefined}>
                <Icon size={15} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {isOwner && (
          <div className="border-t border-stone-100 p-2">
            <Link href={`/profile/${profileId}/strategy`}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                inCorner ? 'font-semibold' : 'text-stone-600 hover:bg-stone-50'
              }`}
              style={inCorner ? { backgroundColor: `${accent}14`, color: accent } : undefined}>
              <SlidersHorizontal size={15} />
              Strategy and switches
            </Link>
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile header: back, name, corner. */}
        <header className="md:hidden shrink-0"
          style={{ background: `linear-gradient(to right, ${accent}22 0%, transparent 75%)` }}>
          <div className="flex items-center gap-2 px-3 py-2.5">
            <Link href="/shelf" className="rounded-lg p-1.5 text-stone-600" aria-label="Back to your profiles">
              <ArrowLeft size={18} />
            </Link>
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: accent }} />
            <h1 className="truncate text-sm font-bold text-stone-900">{client.name}</h1>
            {isOwner && (
              <Link href={`/profile/${profileId}/strategy`}
                className="ml-auto rounded-lg p-1.5 text-stone-600"
                aria-label="Strategy and switches">
                <SlidersHorizontal size={18} />
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {notice && (
            <div className="border-b border-stone-200 bg-stone-100 px-4 py-2 text-sm text-stone-700">
              {notice}
            </div>
          )}
          {children}
        </main>

        {/* Mobile: the bottom tab bar is the apps (or the granted windows), and
            never the corner — the corner is a control, not an app. */}
        {!inCorner && items.length > 0 && (
          <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-stone-200 bg-white md:hidden">
            {items.map(item => {
              const Icon = item.icon;
              const on = active(`/profile/${profileId}/${item.id === 'brand' ? '' : item.id}`);
              return (
                <Link key={item.id} href={item.href}
                  className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]"
                  style={{ color: on ? accent : '#78716c' }}>
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
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
