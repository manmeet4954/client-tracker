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
import { HistoryLine, Screen, Segmented } from '@/components/shell/Screen';
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
import { ClientPiecePanel } from '@/components/shell/ClientWindows';
import AddEntry from '@/components/creation/AddEntry';

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

  // The client's Creation — reshaped 2026-08-16 on her verdict: the client
  // sees HER dashboard, the same folders and the same names, cut down to what
  // she ticked. So Creation carries her tabs — Board, Assets, References —
  // each shown only when its switch is on, at the same addresses she uses.
  // A verdict on a Review piece lives ON the piece, in the panel a tapped
  // card opens; the Approvals digest tab is gone. Engine and Logs stay a hard
  // 404; her tasks never reach a client login at all (the server hands them
  // an empty personalTasks).
  if (kind !== 'owner') {
    if (!['board', 'assets', 'references'].includes(params.tab)) notFound();
    return (
      <ClientCreation
        profileId={params.id} accent={accent} pieceId={pieceId} tab={params.tab}
        path={path} search={search?.toString() ?? ''}
      />
    );
  }

  /**
   * Can this screen be written to right now?
   *
   * Her decision, 2026-08-09: recording what is happening always works, locked
   * or not, and generation is the only thing that needs a strategy. So the lock
   * no longer makes a screen read-only. What still does: a switch she moved to
   * `history`, and a profile that is archived or resting.
   *
   * Both of those come from the one resolver, asked with the lock set aside —
   * the same question the desk chat's write door asks. VISIBILITY is untouched:
   * `live` below still asks the ordinary way, so a client sees exactly what a
   * client saw before, and a tab that is hidden is never reached here at all.
   */
  const writable = (switchId: string) =>
    renderState({ ...profile, strategy_locked: true }, switchId, kind) === 'active';

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
    id: params.id, accent, seedId, readOnly: !writable('creation.board'), openPiece,
  }) ?? [];
  const live = sections
    .map(s => ({ ...s, state: renderState(profile, s.switch, kind) }))
    .filter(s => s.state !== 'hidden');

  const subTabs = rendered(CREATION_TABS, profile, kind);
  const current = live.find(s => s.id === section) ?? live[0];

  // ONE ROW (2026-08-11). Her count on opening this screen: "40% of the
  // screen is covered with crap and things which aren't the main focus." The
  // stack was six bars deep before the first card: title, tabs, the lock line,
  // a full-width section bar, the posted line, the view controls. The 30px
  // "Creation" heading told her what the sidebar already had; the lock line
  // repeated what the Strategy room owns; the section toggle deserved a chip,
  // not a bar. One row holds all of it now, and the board starts where the
  // screen does.
  const header = (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <div className="flex items-center gap-3">
        <span className="text-[12px] font-bold uppercase tracking-[.11em] text-faint">Creation</span>
        {live.length > 1 && (
          <Segmented segments={live.map(sec => ({ id: sec.id, label: sec.label }))}
            active={current?.id ?? ''} onSelect={setSection} />
        )}
      </div>
      <Segmented
        segments={subTabs.map(t => ({
          id: t.id, label: t.label, href: `/profile/${params.id}/creation/${t.id}`,
        }))}
        active={params.tab}
      />
    </div>
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
        <div className="-mx-4 md:-mx-7">
          <Logs profileId={params.id} />
          {effort && <MomentumMeter clientId={params.id} accent={accent} />}
        </div>
        {piece}
      </Screen>
    );
  }

  return (
    <Screen>
      {header}

      {/* "Turned off" may only be said when SHE turned it off. The lock also
          renders a switch as history, and for an hour tonight this line said
          "this section is turned off" over every unlocked profile's board,
          with Add buttons visible right under it. `writable` asks with the
          lock set aside, so it distinguishes her decision from the lock's. */}
      {current && current.state === 'history' && !writable(current.switch) && <HistoryLine />}

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
        <Board profileId={id} hue={accent} readOnly={readOnly} onOpenPiece={openPiece} />
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


/**
 * The client's Creation: her folder, her tabs, filtered by her switches
 * (2026-08-16). The board is HER component with every write disabled, because
 * a second board drawn specially for clients would drift from the real one
 * within a week. Tapping a card opens the client piece panel, and a
 * Review-stage piece carries its verdict controls there — the Approvals
 * digest tab that stood beside the board is gone. The tabs are real
 * addresses (/creation/board, /creation/assets, /creation/references), so
 * anything bookmarked keeps working.
 */
function ClientCreation({ profileId, accent, pieceId, tab, path, search }: {
  profileId: string;
  accent: string;
  pieceId?: string;
  tab: string;
  path: string;
  search: string;
}) {
  const { state, role, selectedMonth } = useApp();
  const router = useRouter();
  const profile = renderProfile(state, profileId, role);
  const on = (s: string) => renderState(profile, s, 'client') === 'active';

  // Board shows when any of its switches is on: with only Approvals ticked the
  // board is still where the waiting piece lives, and with only Add-ideas
  // ticked the board is still where the Idea column is (2026-08-16).
  const ideasOn = on('creation.seed_input_client');
  const tabs = [
    ...(on('creation.scheduling') || on('creation.review') || ideasOn
      ? [{ id: 'board', label: 'Board' }] : []),
    ...(on('assets.client_upload') ? [{ id: 'assets', label: 'Assets' }] : []),
    ...(on('references.from_client') ? [{ id: 'references', label: 'References' }] : []),
  ];
  const current = tabs.some(t => t.id === tab) ? tab : tabs[0]?.id;

  function openPiece(cardId: string) {
    const next = new URLSearchParams(search);
    next.set('piece', cardId);
    router.replace(`${path}?${next.toString()}`, { scroll: false });
  }

  function closePiece() {
    const next = new URLSearchParams(search);
    next.delete('piece');
    const q = next.toString();
    router.replace(q ? `${path}?${q}` : path, { scroll: false });
  }

  return (
    <Screen>
      {tabs.length > 1 && (
        <Segmented
          segments={tabs.map(t => ({
            id: t.id, label: t.label, href: `/profile/${profileId}/creation/${t.id}`,
          }))}
          active={current ?? ''}
        />
      )}

      <div className="-mx-4 md:-mx-7">
        {current === 'board' && (
          <Board profileId={profileId} hue={accent} readOnly onOpenPiece={openPiece}
            // HER OWN add-post card, not a client-special box (2026-08-17, her
            // correction: "you don't have to build anything new... the add post
            // feature is in my dashboard, where you can select the pillar,
            // where you can add the content and everything"). Same component,
            // same ADD_CONTENT_CARD, same card downstream; the server merge
            // already accepts a bound client's own contentCards.
            ideaExtra={ideasOn
              ? <AddEntry profileId={profileId} stage="idea" month={selectedMonth} compact />
              : undefined} />
        )}
        {current === 'assets' && <AssetsView clientId={profileId} />}
        {current === 'references' && <ReferencesScreen profileId={profileId} />}
        {!current && (
          <p className="p-8 text-sm text-faint">Nothing here is open for you yet.</p>
        )}
      </div>

      {pieceId && (
        <ClientPiecePanel profileId={profileId} pieceId={pieceId} onClose={closePiece} />
      )}
    </Screen>
  );
}
