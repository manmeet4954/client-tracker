'use client';

// The profile interior — spec 28 §5, §7, §16.3.
//
// Reachable ONLY for a profile that has cut over: a migrated body AND a locked
// strategy. Until then this address sends the login back to the legacy
// workspace, which keeps working exactly as it does today. One shelf, two
// destinations, for as long as it takes — and the rollback path is that same
// legacy tree, always one URL away.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp, useClient } from '@/contexts/AppContext';
import { isCutOver, staysOnLegacy } from '@/lib/shell/profile';
import ProfileFrame from '@/components/shell/Frame';

export default function ProfileLayout({
  children, params,
}: { children: React.ReactNode; params: { id: string } }) {
  const { state, role, windows } = useApp();
  const { client, data } = useClient(params.id);
  const router = useRouter();

  const bindingKind = (state.bindings ?? [])
    .find(b => b.role === role && b.profileId === params.id)?.kind;
  // §19's interim ruling, explicit: a staff binding and Sonia's binding keep the
  // legacy workspace for this profile until she answers. Nothing breaks, nothing
  // waits, and two shells coexist on one profile for as long as that takes.
  const legacy = staysOnLegacy(role, bindingKind);
  const ready = isCutOver(data);

  useEffect(() => {
    if (!client) return;
    if (legacy || !ready) router.replace(`/client/${params.id}`);
  }, [client, legacy, ready, params.id, router]);

  if (!client) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-sm text-stone-400">This profile is not available.</p>
      </div>
    );
  }
  if (legacy || !ready) return null;

  // §7.5 — a client login on a profile whose lifecycle opens no doors gets one
  // screen with one line. Not an error, not a login failure, not a blank page.
  if (role !== 'owner' && (windows[params.id] ?? []).length === 0) {
    return (
      <div className="flex h-screen items-center justify-center px-6 text-center">
        <p className="text-sm text-stone-500">
          This workspace is closed for now. Manmeet can reopen it.
        </p>
      </div>
    );
  }

  return <ProfileFrame profileId={params.id}>{children}</ProfileFrame>;
}
