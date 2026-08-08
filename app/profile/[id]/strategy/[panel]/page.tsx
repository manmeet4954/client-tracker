'use client';

// The corner's panels at their own address — spec 28 §5.5, §5.4, §5.7.
//
// The corner itself is now a PANEL over the current screen, carried on the
// query string and rendered by the frame. These addresses stay alive because
// they are registered routes and a deep link must not break: they render the
// same tab strip and the same panel bodies, drawn as a page because there is no
// screen underneath them to slide over.
//
// §3.3's placement rule is what allows a creation path like
// `work-log/creation/channels` to render here: the corner is STRICTER than the
// path's own audience, and the rule only ever works that way round.

import { notFound } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import { CORNER_PANELS } from '@/lib/shell/nav';
import { shellRole } from '@/lib/shell/profile';
import { StrategyPage } from '@/components/shell/StrategyPanel';

export default function CornerPanelPage({ params }: { params: { id: string; panel: string } }) {
  const { state, role } = useApp();

  const known = CORNER_PANELS.find(p => p.id === params.panel);
  if (!known) notFound();
  if (shellRole(state, role, params.id) !== 'owner') notFound();

  return <StrategyPage profileId={params.id} tab={params.panel} />;
}
