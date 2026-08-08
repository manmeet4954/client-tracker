'use client';

// The Intake app — spec 28 §5.4, redressed by phase 5 of the restructure.
//
// Two screens, Rounds and Curation, and IntakeApp owns the segmented control
// over them along with its own Screen and header. Nothing wraps it: a second
// Screen here would draw a second title.
//
// §5.4's quiet done still holds: when every round is curated, Intake stops being
// navigation on both sides, and the round list moves into the corner at
// Strategy → Intake history.

import { useApp } from '@/contexts/AppContext';
import IntakeApp from '@/components/intake/IntakeApp';
import { ClientIntakeWindow } from '@/components/shell/ClientWindows';
import { shellRole } from '@/lib/shell/profile';

export default function IntakePage({ params }: { params: { id: string } }) {
  const { state, role } = useApp();

  if (shellRole(state, role, params.id) !== 'owner') {
    return <ClientIntakeWindow profileId={params.id} />;
  }

  return <IntakeApp clientId={params.id} />;
}
