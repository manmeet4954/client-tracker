'use client';

// The Intake app — spec 28 §5.4, mounting spec 22's surfaces at their new
// address. On her side it is the round machinery and the curation workspace; on
// the client's it is their open round and their own answers, read-only.
//
// §5.4's quiet done: when every round is curated, Intake stops being navigation
// on both sides. That is the container rule doing its work — the app's switches
// resolve through `intake.questionnaire`, and the round list moves into the
// corner at Strategy → Intake history.

import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import IntakeView from '@/components/IntakeView';
import CurationView from '@/components/CurationView';
import { ClientIntakeWindow } from '@/components/shell/ClientWindows';
import { shellRole } from '@/lib/shell/profile';

const SECTIONS = [
  { id: 'rounds', label: 'Rounds' },
  { id: 'curation', label: 'Curation' },
] as const;

export default function IntakePage({ params }: { params: { id: string } }) {
  const { state, role } = useApp();
  const [section, setSection] = useState<'rounds' | 'curation'>('rounds');

  if (shellRole(state, role, params.id) !== 'owner') {
    return <ClientIntakeWindow profileId={params.id} />;
  }

  return (
    <div className="p-4 md:p-8">
      <nav className="mx-auto mb-5 flex max-w-4xl flex-wrap gap-1.5">
        {SECTIONS.map(s => (
          <button key={s.id} type="button" onClick={() => setSection(s.id)}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
              section === s.id
                ? 'border-stone-900 bg-stone-900 text-white'
                : 'border-stone-200 text-stone-600 hover:bg-stone-50'
            }`}>
            {s.label}
          </button>
        ))}
      </nav>
      {section === 'rounds' ? <IntakeView clientId={params.id} /> : <CurationView clientId={params.id} />}
    </div>
  );
}
