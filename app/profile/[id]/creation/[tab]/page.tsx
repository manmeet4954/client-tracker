'use client';

// Creation's five sub-tabs — spec 28 §5.2, mounting the screens that already
// exist at their new addresses. Engine · Board · Assets · References · Logs.
// Five, in that order, no sixth.
//
// Nothing here is a new capability. Every section is an existing surface, moved,
// and every one of them is behind the switch its owning spec registered — asked
// through `renderState`, never read directly.

import { useState } from 'react';
import { notFound, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useApp, useClient } from '@/contexts/AppContext';
import { CREATION_TABS, rendered } from '@/lib/shell/nav';
import { accentFor, renderProfile, shellRole } from '@/lib/shell/profile';
import { renderState } from '@/lib/tree/render';
import ContentView from '@/components/ContentView';
import PreviewsView from '@/components/PreviewsView';
import AnswersView from '@/components/AnswersView';
import AssetsView from '@/components/AssetsView';
import CatalogueView from '@/components/CatalogueView';
import ReferencesView from '@/components/ReferencesView';
import DashboardView from '@/components/DashboardView';
import ListsView from '@/components/ListsView';
import ColdCallsView from '@/components/ColdCallsView';
import OrdersView from '@/components/OrdersView';
import MomentumMeter from '@/components/MomentumMeter';
import EngineRoomView from '@/components/EngineRoomView';
import CostumeView from '@/components/CostumeView';
import { ContentWindow } from '@/components/shell/ClientWindows';

interface Section { id: string; label: string; switch: string; render: () => React.ReactNode }

export default function CreationTabPage({ params }: { params: { id: string; tab: string } }) {
  const { state, role } = useApp();
  const { client, data } = useClient(params.id);
  const search = useSearchParams();
  const [section, setSection] = useState<string | null>(null);

  const tabDef = CREATION_TABS.find(t => t.id === params.tab);
  if (!tabDef) notFound();

  const kind = shellRole(state, role, params.id);
  const profile = renderProfile(state, params.id, role);
  const accent = accentFor(client, data);
  const seedId = search?.get('seed') ?? '';
  const pieceId = search?.get('piece') ?? '';

  // A client reaches exactly two of the five, and both are projections.
  if (kind !== 'owner') {
    if (params.tab === 'board') return <ContentWindow profileId={params.id} pieceId={pieceId} />;
    if (params.tab === 'assets') return <AssetsView clientId={params.id} />;
    notFound();
  }

  const sections: Section[] = SECTIONS[params.tab]?.(params.id, accent, seedId) ?? [];
  const live = sections
    .map(s => ({ ...s, state: renderState(profile, s.switch, kind) }))
    .filter(s => s.state !== 'hidden');

  const subTabs = rendered(CREATION_TABS, profile, kind);
  const current = live.find(s => s.id === section) ?? live[0];

  return (
    <div>
      {/* The five sub-tabs: a horizontally scrollable row under the header, never
          a second bottom bar (§8). */}
      <nav className="no-scrollbar flex gap-1 overflow-x-auto border-b border-stone-200 bg-white px-3">
        {subTabs.map(t => {
          const on = t.id === params.tab;
          return (
            <Link key={t.id} href={`/profile/${params.id}/creation/${t.id}`}
              className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm ${
                on ? 'font-semibold' : 'border-transparent text-stone-500'
              }`}
              style={on ? { borderColor: accent, color: accent } : undefined}>
              {t.label}
            </Link>
          );
        })}
      </nav>

      {live.length > 1 && (
        <nav className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pt-3">
          {live.map(s => {
            const on = s.id === current?.id;
            return (
              <button key={s.id} type="button" onClick={() => setSection(s.id)}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs ${
                  on ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 text-stone-600'
                }`}>
                {s.label}
              </button>
            );
          })}
        </nav>
      )}

      {current?.state === 'history' && <ReadOnlyLine />}
      {current ? current.render() : <Nothing />}
    </div>
  );
}

function ReadOnlyLine() {
  return (
    <div className="border-b border-stone-200 bg-stone-100 px-4 py-2 text-sm text-stone-700">
      This one is switched off and kept. Everything below reads; nothing new is written.
    </div>
  );
}

function Nothing() {
  return <p className="p-8 text-sm text-stone-400">Nothing here is switched on for this profile.</p>;
}

/** Each sub-tab's sections, with the switch each one is governed by (§5.2). */
const SECTIONS: Record<string, (id: string, accent: string, seedId: string) => Section[]> = {
  engine: (id, _accent, seedId) => [
    {
      id: 'room', label: 'The room', switch: 'creation.engine',
      render: () => (seedId
        ? <CostumeView clientId={id} seedId={seedId} />
        : <EngineRoomView clientId={id} />),
    },
  ],
  board: id => [
    { id: 'stages', label: 'Stages', switch: 'creation.board', render: () => <ContentView clientId={id} /> },
    { id: 'review', label: 'Review', switch: 'creation.review', render: () => <PreviewsView clientId={id} /> },
    { id: 'funnel', label: 'Funnel', switch: 'creation.funnel_replies', render: () => <AnswersView clientId={id} /> },
  ],
  assets: id => [
    { id: 'library', label: 'Library', switch: 'assets.library', render: () => <AssetsView clientId={id} /> },
    { id: 'catalogue', label: 'Catalogue', switch: 'assets.catalogue_export', render: () => <CatalogueView clientId={id} /> },
  ],
  references: id => [
    { id: 'references', label: 'References', switch: 'references.our_vision', render: () => <ReferencesView clientId={id} /> },
  ],
  logs: (id, accent) => [
    { id: 'tasks', label: 'Tasks', switch: 'logs.tasks', render: () => <DashboardView clientId={id} /> },
    { id: 'lists', label: 'Pipelines', switch: 'logs.pipelines.lists', render: () => <ListsView clientId={id} /> },
    { id: 'coldcalls', label: 'Cold calls', switch: 'logs.pipelines.cold_calls', render: () => <ColdCallsView clientId={id} /> },
    { id: 'orders', label: 'Orders', switch: 'logs.pipelines.orders', render: () => <OrdersView clientId={id} /> },
    { id: 'notes', label: 'Notes', switch: 'logs.observations', render: () => <ProfileNotes clientId={id} /> },
    // PLAN §7, and it is a rule: the effort and money meters survive only inside
    // her own profiles. On a client profile the switch resolves hidden for
    // everyone, her included, so this section is simply not here.
    { id: 'effort', label: 'Effort', switch: 'logs.effort_meter', render: () => <MomentumMeter clientId={id} accent={accent} /> },
  ],
};

/**
 * Logs → Notes. THIS profile's own notes, read out of its own body, and never
 * the owner-level inbox: that one carries notes tagged to other profiles, and
 * nothing inside a profile may name another (§5.7). §9's named consequence
 * stands — a tagged note is readable here and in the frozen inbox until the
 * chat's own spec lands.
 */
function ProfileNotes({ clientId }: { clientId: string }) {
  const { data } = useClient(clientId);
  const notes = (data.body?.paths?.['work-log/logs/observations'] ?? [])
    .slice()
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  if (notes.length === 0) {
    return <p className="p-8 text-sm text-stone-400">No notes on this profile yet.</p>;
  }
  return (
    <div className="mx-auto max-w-3xl space-y-2 p-4 md:p-8">
      {notes.map(n => (
        <div key={n.id} className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="whitespace-pre-wrap text-sm text-stone-800">
            {String((n.data as { text?: unknown; note?: unknown })?.text
              ?? (n.data as { note?: unknown })?.note ?? '')}
          </p>
          <p className="mt-1 text-xs text-stone-400">{String(n.created_at).slice(0, 10)}</p>
        </div>
      ))}
    </div>
  );
}
