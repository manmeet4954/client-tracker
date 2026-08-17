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
// AssetsView is no longer imported here (2026-08-17). It was the CLIENT's
// assets screen while her own side rendered AssetsScreen: one feature, two
// components, drifting apart. The client now gets hers from the SECTIONS map.
// The component itself stays where the legacy /client/[id]/assets route mounts
// it and is not deleted while that address still answers.
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
 * The client's Creation: HER folder, HER tabs, HER sections, HER components,
 * filtered by HER switches. This function ARRANGES; it renders nothing of its
 * own (CLAUDE.md rule 0).
 *
 * It was rewritten twice on 2026-08-17, both times for the same fault, and the
 * history is the point:
 *
 *  1. The board was mounted with every write disabled and an Add card bolted
 *     on. Her verdict: "when we have built this as a kanban board, why do I
 *     have to give each and every instruction one by one... I cannot move this
 *     card to the other stages."
 *  2. The Board TAB was mounted without its Slides view, because this function
 *     hand-listed what a client gets instead of reading her own list. Her
 *     verdict: "the slide option is missing in the creation part."
 *
 * Both are DISSECTION (spec 36 §1): shipping a fraction of a feature and
 * waiting to be asked for the rest. The cure is structural rather than a
 * promise — the sections come from the SAME `SECTIONS` map her side reads, so
 * a view she adds appears for clients with no work here at all. If you find
 * yourself adding a hand-written list of what a client may see to this file,
 * that is the mistake coming back.
 *
 * The tabs are real addresses (/creation/board, /creation/assets,
 * /creation/references), so anything bookmarked keeps working.
 */
function ClientCreation({ profileId, accent, pieceId, tab, path, search }: {
  profileId: string;
  accent: string;
  pieceId?: string;
  tab: string;
  path: string;
  search: string;
}) {
  const { state, role } = useApp();
  const router = useRouter();
  const profile = renderProfile(state, profileId, role);
  const on = (s: string) => renderState(profile, s, 'client') === 'active';
  const [section, setSection] = useState<string | null>(null);

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

  // HER SECTIONS, not a client list of them (2026-08-17, her report: "the
  // slide option is missing in the creation part... where you can preview the
  // options"). Creation → Board is ONE tab with TWO views on her screen, Board
  // and Slides, and the client was given one of them. That is dissection again
  // (spec 36 §1): the plug is the Board TAB, and a client with it in gets
  // everything the tab does.
  //
  // So the client's Board tab reads the SAME `SECTIONS` map her side reads,
  // asked with role 'client'. The switches decide, exactly as they do for her,
  // and a section she adds later appears for clients with no further work —
  // which is the whole point of the plug rule.
  // 2026-08-17, generalised from the board to EVERY tab. Assets was the second
  // proven dissection: her side renders AssetsScreen (553 lines) and a client
  // was given AssetsView (453) — two components for one feature, which is the
  // drift rule 0 exists to stop. Reading her map means a client gets whichever
  // component SHE renders, for every tab, forever.
  //
  // References is the one tab still mounted below rather than from here, and
  // the reason is recorded honestly: her `references.our_vision` is
  // audience:'owner', so it resolves hidden for a client and the tab would
  // vanish. A client rides `references.from_client` instead — the same
  // ReferencesScreen component either way, so the FEATURE is whole; it is the
  // SWITCH that is dissected. Spec 36 §3 collapses that, and until it does,
  // moving References here would take the tab away rather than complete it.
  const sections = (SECTIONS[current ?? '']?.({
    id: profileId, accent, seedId: '', readOnly: !ideasOn, openPiece,
  }) ?? [])
    .map(s => ({ ...s, state: renderState(profile, s.switch, 'client') }))
    .filter(s => s.state !== 'hidden');
  const activeSection = sections.find(s => s.id === section) ?? sections[0];

  return (
    <Screen>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {tabs.length > 1 && (
          <Segmented
            segments={tabs.map(t => ({
              id: t.id, label: t.label, href: `/profile/${profileId}/creation/${t.id}`,
            }))}
            active={current ?? ''}
          />
        )}
        {sections.length > 1 && (
          <Segmented
            segments={sections.map(s => ({ id: s.id, label: s.label }))}
            active={activeSection?.id ?? ''}
            onSelect={setSection}
          />
        )}
      </div>

      <div className="-mx-4 md:-mx-7">
        {/* Her sections, whichever tab this is. See the note above for why
            References is still mounted by hand. */}
        {activeSection ? activeSection.render()
          : current === 'references' ? <ReferencesScreen profileId={profileId} />
          : null}
        {!current && (
          <p className="p-8 text-sm text-faint">Nothing here is open for you yet.</p>
        )}
      </div>

      {pieceId && (
        <ClientPiecePanel profileId={profileId} pieceId={pieceId} onClose={closePiece}
          mayEdit={ideasOn} />
      )}
    </Screen>
  );
}
