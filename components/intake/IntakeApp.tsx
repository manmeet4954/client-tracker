'use client';

// The Intake app — the segmented shell over its two screens.
//
// Restructure handoff: "Two screens, segmented control: Rounds · Curation."
//
// The Curation segment is present only when there is something to curate. That
// is rule 3 doing its job rather than being described: a screen with nothing in
// it is not rendered, not shown empty and not shown disabled. With nothing
// back, Intake is one screen and the segmented control does not draw at all.
//
// Intake as a whole is present only while questions are outstanding, and after
// that it lives in Strategy → Intake history. That decision belongs to the
// navigation map (lib/shell/nav.ts), which this component does not own.

import { useMemo, useState } from 'react';
import { useApp, useClient } from '@/contexts/AppContext';
import { Screen, ScreenHeader } from '@/components/shell/Screen';
import ProfileBodyGate from '@/components/ProfileBodyGate';
import { composeRounds, hasCuration, intakeHeadline } from '@/lib/intake/screens';
import Rounds from './Rounds';
import Curation from './Curation';

type Section = 'rounds' | 'curation';

export default function IntakeApp({ clientId }: { clientId: string }) {
  const { role } = useApp();
  const { client, data } = useClient(clientId);
  const [section, setSection] = useState<Section>('rounds');

  const body = data.body;
  const ownerProfile = client?.ownerKind === 'hers';

  const headline = useMemo(() => (body ? intakeHeadline(composeRounds(body)) : ''), [body]);
  const curation = useMemo(
    () => (body ? hasCuration(body, { includeUnanswered: ownerProfile }) : false),
    [body, ownerProfile],
  );

  if (role !== 'owner') {
    return (
      <Screen>
        <ScreenHeader title="Intake" />
        <p className="text-sm text-muted">This screen is hers.</p>
      </Screen>
    );
  }

  if (!body) return <ProfileBodyGate clientId={clientId} />;

  const segments = curation
    ? [{ id: 'rounds', label: 'Rounds' }, { id: 'curation', label: 'Curation' }]
    : [{ id: 'rounds', label: 'Rounds' }];
  const active: Section = curation ? section : 'rounds';

  return (
    <Screen>
      <ScreenHeader
        title="Intake"
        segments={segments}
        active={active}
        onSelect={id => setSection(id as Section)}
      />
      <p className="-mt-2 text-sm leading-[1.5] text-muted">{headline}</p>

      {active === 'rounds'
        ? <Rounds clientId={clientId} body={body} />
        : <Curation clientId={clientId} body={body} ownerProfile={ownerProfile} />}
    </Screen>
  );
}
