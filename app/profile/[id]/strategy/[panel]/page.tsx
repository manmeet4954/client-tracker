'use client';

// Strategy at its own address, as a room and not an overlay (spec 34 §2).
//
// The route itself does not change: `/profile/<id>/strategy/<panel>` is still
// the address, still owner only, and every deep link that worked before still
// lands on the section it names. What changed is that it draws full screen with
// its sections down the left, instead of a 470px drawer over the board.
//
// `?back=` carries the screen she came from so that leaving returns her there.
// Only a path inside this app is accepted; anything else falls back to the
// profile itself.

import { notFound } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import { CORNER_PANELS } from '@/lib/shell/nav';
import { shellRole } from '@/lib/shell/profile';
import Room from '@/components/strategy/Room';

/** A back link is only followed when it points inside this app. */
function safeBack(raw: string | null, profileId: string): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return `/profile/${profileId}`;
}

export default function CornerPanelPage({ params }: { params: { id: string; panel: string } }) {
  const { state, role } = useApp();
  const search = useSearchParams();

  const known = CORNER_PANELS.find(p => p.id === params.panel);
  if (!known) notFound();
  if (shellRole(state, role, params.id) !== 'owner') notFound();

  const back = safeBack(search?.get('back') ?? null, params.id);
  const hrefFor = (id: string) =>
    `/profile/${params.id}/strategy/${id}?back=${encodeURIComponent(back)}`;

  return <Room profileId={params.id} section={params.panel} backHref={back} hrefFor={hrefFor} />;
}
