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
import { ROOM_PANELS } from '@/lib/shell/nav';
import { DEFAULT_STRATEGY_TAB } from '@/components/shell/StrategyPanel';
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

  // A RENAMED PANEL MUST NEVER DEAD-END (2026-08-11). This used to call
  // notFound() on anything it did not recognise, so the day Facts was deleted
  // every stale link, bookmark and cached button 404ed rather than landing
  // somewhere useful. A missing panel is our renaming problem, not hers.
  //
  // `derivation` is allowed explicitly: it left the rail but a row on The brand
  // still opens it.
  const known = params.panel === 'derivation' || ROOM_PANELS.some(p => p.id === params.panel);
  if (shellRole(state, role, params.id) !== 'owner') notFound();

  const back = safeBack(search?.get('back') ?? null, params.id);
  const panel = known ? params.panel : DEFAULT_STRATEGY_TAB;
  const hrefFor = (id: string) =>
    `/profile/${params.id}/strategy/${id}?back=${encodeURIComponent(back)}`;

  return <Room profileId={params.id} section={panel} backHref={back} hrefFor={hrefFor} />;
}
