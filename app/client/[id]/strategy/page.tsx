'use client';

import { useState } from 'react';
import StrategyDerivationView from '@/components/StrategyDerivationView';
import GateSetView from '@/components/GateSetView';
import SwitchboardView from '@/components/SwitchboardView';
import StrategyLockView from '@/components/StrategyLockView';

/**
 * Strategy is the always-on decision layer, not a switch (PLAN §3.10). It runs
 * in the order she set: derive it, write the gates, set the switches, then lock
 * it in one act (spec 22 §8).
 */
const SECTIONS = [
  { id: 'derive', label: 'Decide it' },
  { id: 'gates', label: 'Gates' },
  { id: 'switches', label: 'Switches' },
  { id: 'lock', label: 'Lock' },
] as const;

type Section = (typeof SECTIONS)[number]['id'];

export default function StrategyPage({ params }: { params: { id: string } }) {
  const [section, setSection] = useState<Section>('derive');

  return (
    <div className="p-4 md:p-8">
      <nav className="flex flex-wrap gap-1.5 mb-5 max-w-4xl mx-auto">
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)}
            className={`px-3.5 py-1.5 text-sm rounded-full border transition-colors ${
              section === s.id
                ? 'bg-stone-900 text-white border-stone-900'
                : 'border-stone-200 text-stone-600 hover:bg-stone-50'
            }`}>
            {s.label}
          </button>
        ))}
      </nav>

      {section === 'derive' && <StrategyDerivationView clientId={params.id} />}
      {section === 'gates' && <GateSetView clientId={params.id} />}
      {section === 'switches' && <SwitchboardView clientId={params.id} />}
      {section === 'lock' && <StrategyLockView clientId={params.id} />}
    </div>
  );
}
