'use client';

// `/profile/<id>/creation` — redirects to the first rendering sub-tab (§3.1).

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import { CREATION_TABS, rendered } from '@/lib/shell/nav';
import { renderProfile, shellRole } from '@/lib/shell/profile';

export default function CreationLanding({ params }: { params: { id: string } }) {
  const { state, role } = useApp();
  const router = useRouter();
  const kind = shellRole(state, role, params.id);
  const first = rendered(CREATION_TABS, renderProfile(state, params.id, role), kind)[0];

  useEffect(() => {
    router.replace(first ? `/profile/${params.id}/creation/${first.id}` : `/profile/${params.id}`);
  }, [first, params.id, router]);

  return null;
}
