'use client';

// The Analysis app — spec 28 §5.3. Spec 27's eight tabs, unchanged. This spec
// adds nothing to them and changes nothing about them; it supplies the frame:
// a tab row on desktop, a bottom-sheet picker on mobile, and the resolver that
// decides which of the eight exist.
//
// The Now tab's first block is always coverage (spec 27 §5). The shell may not
// move it, collapse it, or put a badge in a corner instead — and it does not.

import { useState } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronUp } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import { ANALYSIS_TABS, rendered } from '@/lib/shell/nav';
import { accentFor, renderProfile, shellRole } from '@/lib/shell/profile';
import AnalysisApp from '@/components/analysis/AnalysisApp';

export default function AnalysisTabPage({ params }: { params: { id: string; tab: string } }) {
  const { state, role } = useApp();
  const { client, data } = useClient(params.id);
  const [sheet, setSheet] = useState(false);

  const known = ANALYSIS_TABS.find(t => t.id === params.tab);
  if (!known) notFound();

  const kind = shellRole(state, role, params.id);
  if (kind !== 'owner') notFound();   // a client's analysis is the Results window

  const accent = accentFor(client, data);
  const tabs = rendered(ANALYSIS_TABS, renderProfile(state, params.id, role), kind);
  const current = tabs.find(t => t.id === params.tab);

  return (
    <div>
      {/* Desktop: a tab row. */}
      <nav className="no-scrollbar hidden gap-1 overflow-x-auto border-b border-stone-200 bg-white px-3 md:flex">
        {tabs.map(t => {
          const on = t.id === params.tab;
          return (
            <Link key={t.id} href={`/profile/${params.id}/analysis/${t.id}`}
              className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm ${
                on ? 'font-semibold' : 'border-transparent text-stone-500'
              }`}
              style={on ? { borderColor: accent, color: accent } : undefined}>
              {t.label}
            </Link>
          );
        })}
      </nav>

      {/* Mobile: a bottom-sheet picker, not a second row of eight. */}
      <button type="button" onClick={() => setSheet(true)}
        className="flex w-full items-center justify-between border-b border-stone-200 bg-white px-4 py-2.5 text-sm md:hidden">
        <span className="font-semibold" style={{ color: accent }}>{current?.label ?? params.tab}</span>
        <ChevronUp size={16} className="text-stone-400" />
      </button>
      {sheet && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/30 md:hidden"
          onClick={() => setSheet(false)}>
          <div className="rounded-t-2xl bg-white p-2" onClick={e => e.stopPropagation()}>
            {tabs.map(t => (
              <Link key={t.id} href={`/profile/${params.id}/analysis/${t.id}`}
                onClick={() => setSheet(false)}
                className="block rounded-xl px-4 py-3 text-sm text-stone-800">
                {t.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      <AnalysisApp clientId={params.id} accent={accent} tab={params.tab} />
    </div>
  );
}
