'use client';

// The mini-shelf — spec 28 §7.2, building PLAN §11's ruling on spec 21 Q3:
// "A person holding bindings to several profiles gets a picker limited to THEIR
// profiles only — never anyone else's."
//
// No today strip. No weekly pulse. No add-profile. NO COUNTS THAT REVEAL HER
// WORKSHOP — a card carries the profile name, its colour, and at most one
// door-shaped line. Counts that come from behind a door they do not hold are not
// composed at all, here or anywhere.

import { useRouter } from 'next/navigation';
import { useApp, useClient } from '@/contexts/AppContext';
import { accentFor } from '@/lib/shell/profile';
import type { ClientWindow } from '@/lib/access';

export default function MiniShelf({
  profiles,
}: { profiles: { id: string; windows: ClientWindow[]; href: string }[] }) {
  const { logout } = useApp();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center px-4 py-4 md:px-8">
          <h1 className="text-lg font-bold text-stone-900">Your workspaces</h1>
          <button type="button" onClick={logout} className="ml-auto text-sm text-stone-500">Log out</button>
        </div>
      </header>
      <main className="mx-auto grid max-w-3xl grid-cols-1 gap-4 px-4 py-6 sm:grid-cols-2 md:px-8">
        {profiles.map(p => <MiniCard key={p.id} {...p} onOpen={() => router.push(p.href)} />)}
      </main>
    </div>
  );
}

function MiniCard({
  id, windows, onOpen,
}: { id: string; windows: ClientWindow[]; href: string; onOpen: () => void }) {
  const { client, data } = useClient(id);
  const accent = accentFor(client, data);
  // The one door-shaped line, and only when the door that would produce it is
  // actually held. Everything else about this profile stays behind the doors.
  const reviewing = windows.some(w => w.doors.includes('give:review'));
  const waiting = reviewing
    ? (data.body?.paths?.['work-log/creation'] ?? [])
      .filter(e => String((e.data as { stage?: unknown })?.stage ?? '') === 'review').length
    : 0;

  return (
    <button type="button" onClick={onOpen}
      className="overflow-hidden rounded-2xl border border-stone-200 bg-white text-left hover:border-stone-300">
      <div className="h-1.5" style={{ backgroundColor: accent }} />
      <div className="p-4">
        <p className="text-sm font-semibold text-stone-900">{client?.name}</p>
        {waiting > 0 && (
          <p className="mt-1 text-xs text-stone-500">
            {waiting} waiting for your review.
          </p>
        )}
      </div>
    </button>
  );
}
