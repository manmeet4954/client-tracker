'use client';

// `/profile/<id>` — spec 28 §5.1's landing rule and §7.3's client landing.
//
// There is no profile home screen. On her side this redirects to the first
// rendering app, in the order Intake → Creation → Analysis; if none render, it
// opens the Strategy corner with one line naming what is owed. On the client's
// side the profile root IS the Brand window, so it renders rather than redirects.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import { renderProfile, shellRole } from '@/lib/shell/profile';
import { landingPath } from '@/lib/shell/nav';
import { BrandWindow } from '@/components/shell/ClientWindows';

export default function ProfileLanding({ params }: { params: { id: string } }) {
  const { state, role, windows } = useApp();
  const router = useRouter();
  const kind = shellRole(state, role, params.id);
  const list = windows[params.id] ?? [];
  const first = list[0];

  const target = kind === 'owner'
    ? landingPath(params.id, renderProfile(state, params.id, role), kind)
    : first && first.route ? `/profile/${params.id}${first.route}` : null;

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  if (kind !== 'owner' && first?.id === 'brand') return <BrandWindow profileId={params.id} />;
  return null;
}
