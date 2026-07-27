'use client';

// `/shelf` — spec 28 §4 for her, §7.1 and §7.2 for everyone else.
//
// "A client's login skips the shelf entirely — they land inside their profile,
// seeing only what their switches grant." (PLAN §2.) The shelf is not rendered,
// not linked, and not reachable for them. A person holding two or more live
// bindings gets the mini-shelf: their profiles, and nothing else.

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import Shelf from '@/components/shell/Shelf';
import MiniShelf from '@/components/shell/MiniShelf';
import { isCutOver, staysOnLegacy } from '@/lib/shell/profile';

export default function ShelfPage() {
  const { state, role, windows } = useApp();
  const router = useRouter();

  // Their own bindings only. The payload never carried anyone else's (spec 21
  // §6), so there is nothing here to filter a second time.
  const mine = useMemo(() => {
    if (role === 'owner') return [];
    return (state.bindings ?? [])
      .filter(b => b.role === role)
      .filter(b => state.clients.some(c => c.id === b.profileId))
      .map(b => {
        const legacy = staysOnLegacy(role, b.kind) || !isCutOver(state.clientData[b.profileId]);
        return {
          id: b.profileId,
          windows: windows[b.profileId] ?? [],
          href: legacy ? `/client/${b.profileId}` : `/profile/${b.profileId}`,
          legacy,
        };
      })
      // A profile whose lifecycle grants them no doors is not listed — unless it
      // is one of §19's interim legacy bindings, which still has its workspace.
      .filter(p => p.legacy || p.windows.length > 0);
  }, [state, role, windows]);

  const only = role !== 'owner' && mine.length === 1 ? mine[0].href : null;

  useEffect(() => {
    if (only) router.replace(only);
  }, [only, router]);

  if (role === 'owner') return <Shelf />;
  if (only) return null;
  if (mine.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center px-6 text-center">
        <p className="text-sm text-stone-500">
          This workspace is closed for now. Manmeet can reopen it.
        </p>
      </div>
    );
  }
  return <MiniShelf profiles={mine} />;
}
