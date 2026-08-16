'use client';

// `/profile/<id>/strategy` — the owner corner (§5.5).
//
// Strategy is not a switch. It is the always-on decision layer that OWNS the
// switchboard (PLAN §3.10), present in every profile, including one at `setup`
// with nothing else rendering: it is how a profile gets from nothing to locked.
//
// Audience: owner, always, in every position of every switch. The corner does
// not exist for any non-owner login — not greyed, not present.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import { shellRole } from '@/lib/shell/profile';

export default function CornerLanding({ params }: { params: { id: string } }) {
  const { state, role } = useApp();
  const router = useRouter();
  const owner = shellRole(state, role, params.id) === 'owner';

  useEffect(() => {
    router.replace(owner ? `/profile/${params.id}/strategy/brand-document` : `/profile/${params.id}`);
  }, [owner, params.id, router]);

  return null;
}
