'use client';

// Creation's five sub-tabs — spec 28 §5.2, mounting the screens that already
// exist at their new addresses. Engine · Board · Assets · References · Logs.
// Five, in that order, no sixth.
//
// Nothing here is a new capability. Every section is an existing surface, moved,
// and every one of them is behind the switch its owning spec registered — asked
// through `renderState`, never read directly.

import { useState } from 'react';
import { notFound, useRouter, useSearchParams } from 'next/navigation';
import { useApp, useClient } from '@/contexts/AppContext';
import { HistoryLine, LockBanner, Screen, ScreenHeader, Segmented } from '@/components/shell/Screen';
import { CREATION_TABS, rendered } from '@/lib/shell/nav';
import { accentFor, renderProfile, shellRole } from '@/lib/shell/profile';
import { renderState } from '@/lib/tree/render';
import PreviewsView from '@/components/PreviewsView';
import AssetsView from '@/components/AssetsView';
import MomentumMeter from '@/components/MomentumMeter';
import EngineRoomView from '@/components/EngineRoomView';
// The restructure, phase 2. Each of these replaces a screen that used to be its
// own tab; the old components stay where the legacy /client/[id] routes mount
// them, and are not deleted while those routes still answer.
import Board from '@/components/creation/Board';
import PiecePanel from '@/components/creation/PiecePanel';
import Logs from '@/components/creation/Logs';
import AssetsScreen from '@/components/creation/AssetsScreen';
import ReferencesScreen from '@/components/creation/ReferencesScreen';
import CostumeView from '@/components/CostumeView';
import { ContentWindow } from '@/components/shell/ClientWindows';

interface Section { id: string; label: string; switch: string; render: () => React.ReactNode }

export default function CreationTabPage({ params }: { params: { id: string; tab: string } }) {
  const { state, role } = useApp();
  const { client, data } = useClient(params.id);
  const search = useSearchParams();
  const router = useRouter();
  const path = `/profile/${params.id}/creation/${params.tab}`;
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

  // Before the lock, the whole app reads and nothing moves. One banner says so
  // once, at the top, rather than a hundred disabled controls (handoff rule 3).
  const beforeLockNow = !profile.strategy_locked;

  // A piece opens as a PANEL over whatever screen you are on, never as a place
  // you navigate to — review and scheduling are states of a piece, not screens
  // (handoff, "Review and scheduling are states of a piece"). The card id rides
  // in the query string so the panel survives a reload and a shared link.
  function openPiece(cardId: string) {
    const next = new URLSearchParams(search?.toString() ?? '');
    next.set('piece', cardId);
    router.replace(`${path}?${next.toString()}`, { scroll: false });
  }

  function closePiece() {
    const next = new URLSearchParams(search?.toString() ?? '');
    next.delete('piece');
    const q = next.toString();
    router.replace(q ? `${path}?${q}` : path, { scroll: false });
  }

  const piece = pieceId ? <PiecePanel cardId={pieceId} onClose={closePiece} /> : null;

  const sections: Section[] = SECTIONS[params.tab]?.({
    id: params.id, accent, seedId, readOnly: beforeLockNow, openPiece,
  }) ?? [];
  const live = sections
    .map(s => ({ ...s, state: renderState(profile, s.switch, kind) }))
    .filter(s => s.state !== 'hidden');

  const subTabs = rendered(CREATION_TABS, profile, kind);
  const current = live.find(s => s.id === section) ?? live[0];
  const beforeLock = beforeLockNow;

  const header = (
    <ScreenHeader
      title="Creation"
      segments={subTabs.map(t => ({
        id: t.id, label: t.label, href: `/profile/${params.id}/creation/${t.id}`,
      }))}
      active={params.tab}
    />
  );

  // Logs is the one tab that brings its own five-tab strip, so it is not a set
  // of sections with a strip drawn above it — that would be two strips stacked.
  if (params.tab === 'logs') {
    // PLAN §7 is a rule, not a preference: the effort and money meters exist in
    // her own profiles and nowhere else. On a client profile this resolves
    // hidden for everyone, her included, and nothing is drawn.
    const effort = renderState(profile, 'logs.effort_meter', kind) !== 'hidden';
    return (
      <Screen>
        {header}
        {beforeLock && <LockBanner />}
        <div className="-mx-4 md:-mx-7">
          <Logs profileId={params.id} readOnly={beforeLock} />
          {effort && <MomentumMeter clientId={params.id} accent={accent} />}
        </div>
        {piece}
      </Screen>
    );
  }

  return (
    <Screen>
      {header}

      {beforeLock && <LockBanner />}

      {live.length > 1 && (
        <Segmented segments={live.map(s => ({ id: s.id, label: s.label }))}
          active={current?.id ?? ''} onSelect={setSection} />
      )}

      {!beforeLock && current?.state === 'history' && <HistoryLine />}

      <div className="-mx-4 md:-mx-7">
        {current ? current.render() : <Nothing />}
      </div>

      {piece}
    </Screen>
  );
}

function Nothing() {
  return <p className="p-8 text-sm text-faint">Nothing here is switched on for this profile.</p>;
}

interface SectionArgs {
  id: string;
  accent: string;
  seedId: string;
  readOnly: boolean;
  openPiece: (cardId: string) => void;
}

/** Each sub-tab's sections, with the switch each one is governed by (§5.2). */
const SECTIONS: Record<string, (a: SectionArgs) => Section[]> = {
  engine: ({ id, seedId }) => [
    {
      id: 'room', label: 'The room', switch: 'creation.engine',
      render: () => (seedId
        ? <CostumeView clientId={id} seedId={seedId} />
        : <EngineRoomView clientId={id} />),
    },
  ],
  // The board is ONE screen with four views inside it, not four sections. Review
  // is not here at all: it is a state of a piece, read in the piece panel.
  //
  // "Slides" is the one honest exception, and it is temporary. The upload,
  // reorder and Canva editor still live inside PreviewsView, so removing this
  // would take away the only way to put pictures on a preview. It is labelled
  // for what it is rather than called Review, so it does not read as a second
  // place to approve things. It goes when that editor moves into the panel.
  board: ({ id, accent, readOnly, openPiece }) => [
    {
      id: 'stages', label: 'Board', switch: 'creation.board',
      render: () => (
        <Board profileId={id} hue={accent} readOnly={readOnly}
          lockBanner={false} onOpenPiece={openPiece} />
      ),
    },
    { id: 'slides', label: 'Slides', switch: 'creation.review', render: () => <PreviewsView clientId={id} /> },
  ],
  // The catalogue is a MODE of Assets, not a second screen beside it.
  assets: ({ id }) => [
    { id: 'library', label: 'Library', switch: 'assets.library', render: () => <AssetsScreen profileId={id} /> },
  ],
  references: ({ id }) => [
    { id: 'references', label: 'References', switch: 'references.our_vision', render: () => <ReferencesScreen profileId={id} /> },
  ],
  // Logs has no sections: it is special-cased in the component above, because it
  // brings its own five-tab strip and a second strip over it would be two.
};
