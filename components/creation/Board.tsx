'use client';

// Creation → Board — the restructure handoff, "CREATION → Board".
//
// ONE screen with four views of the same pieces: Board, Pillars, Table, Month.
// Review and scheduling are STATES of a piece, not screens, so nothing here
// navigates: a card asks its parent to open the piece panel over the board,
// through `onOpenPiece`. This screen never builds that panel and never routes.
//
// Measurements are the prototype's and are not negotiable:
//   column      206px, #f6f3f0 (Posted #f1eeeb), radius 18, padding 14px 12px
//   card        white, hairline, radius 14, padding 12px 13px,
//               border-left 3px solid <profile hue>
//   title       14px/600 · tag chip 11px/600 on #f4f1ee · meta 11.5px #9b95a1
//   month cell  62px min-height, chips 10px in the profile hue
//
// The hue paints the left edge of a card, the dot on a row and a month chip.
// It never paints a column, a control, a tab or an active state — chrome is ink.
//
// Every number on this screen is counted from the array it describes, in
// lib/creation/board.ts, at render time. Nothing here states a figure.

import { useEffect, useState } from 'react';
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
} from '@dnd-kit/core';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import { formatDate, formatMonthLabel } from '@/lib/utils';
import { CONTENT_STAGES, type ContentCard, type ContentPillar, type ContentStage, type PreviewPost } from '@/types';
import {
  agendaIdOf, agendaOf, bareId, boardCards, boardNote, cardChips, dndId, monthCells,
  monthsWithWork, needsOpenKey, needsToday, pillarColumns, pillarMixLine, plural, readNeedsOpen,
  postedLine, postedTally, performanceLine,
  shiftMonth, stageBuckets, unattachedPreviews, writeNeedsOpen,
  type NeedRow, type PillarColumn as PillarCol,
} from '@/lib/creation/board';
import { LockBanner, Segmented } from '@/components/shell/Screen';
import { attachPreview } from '@/lib/creation/piece';
import AddEntry from '@/components/creation/AddEntry';

// Table LEFT the views on 2026-08-11. It rendered the stacked shape at every
// width, which is exactly what Board already is on a phone: two names for one
// screen. Her words: "the table and the board are the same thing."
const VIEWS = [
  { id: 'board', label: 'Board' },
  { id: 'pillars', label: 'Pillars' },
  { id: 'month', label: 'Month' },
];

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function isInteractive(el: Element | null): boolean {
  let cur = el;
  while (cur) {
    if (['button', 'input', 'textarea', 'select', 'a', 'label'].includes(cur.tagName.toLowerCase())) return true;
    cur = cur.parentElement;
  }
  return false;
}

/** The repo's existing sensor idiom: a pointer down on a control is not a drag. */
class SmartPointerSensor extends PointerSensor {
  static activators = [{
    eventName: 'onPointerDown' as const,
    handler: ({ nativeEvent }: { nativeEvent: PointerEvent }) =>
      !isInteractive(nativeEvent.target as Element),
  }];
}

export interface BoardProps {
  profileId: string;
  /** The profile's identity hue. It paints a card edge, a dot, a month chip. */
  hue: string;
  /**
   * The board reads and does not move. Since 2026-08-09 the strategy lock is NOT
   * a reason for this: recording always works. What is left is a profile that is
   * archived or resting, and a board switch she moved to `history`.
   */
  readOnly: boolean;
  /**
   * Opens the piece panel over this screen. The panel is another screen's job;
   * the board only ever hands it a card id.
   */
  onOpenPiece: (cardId: string) => void;
  /**
   * Whether the board draws the strategy banner itself. The Creation page draws
   * one above every sub-tab already, so it passes nothing.
   *
   * It used to be drawn whenever the board was read-only, because read-only and
   * "not locked yet" were the same thing. They are not any more, so the CALLER
   * decides: it is the one that knows whether the strategy has locked.
   */
  lockBanner?: boolean;
  /**
   * Rendered at the foot of the IDEA column only (2026-08-16). The client's
   * Creation passes the idea lane here (their pending suggestions and the
   * add box) so a client's idea lives where ideas live, without this board
   * learning anything about suggestions. Owner callers pass nothing.
   */
  ideaExtra?: React.ReactNode;
}

export default function Board({
  profileId, hue, readOnly, onOpenPiece, lockBanner = false, ideaExtra,
}: BoardProps) {
  const { dispatch, selectedMonth: month, setSelectedMonth } = useApp();
  const { client, data } = useClient(profileId);
  // Read-only and resting are two different facts (2026-08-17). A client's
  // board is always read-only; only a paused profile is resting.
  const resting = client?.lifecycle === 'paused'
    || client?.lifecycle === 'closing'
    || client?.lifecycle === 'archived';

  const [view, setView] = useState('board');
  const [dragging, setDragging] = useState<string | null>(null);
  // The unattached-previews list starts folded: it is a reminder, not the work.
  const [orphansOpen, setOrphansOpen] = useState(false);
  // Server and first client render agree (open), then the remembered value
  // arrives. Reading storage in the initial state would mismatch hydration.
  const [needsOpen, setNeedsOpen] = useState(true);

  useEffect(() => {
    try { setNeedsOpen(readNeedsOpen(localStorage.getItem(needsOpenKey(profileId)))); } catch { /* private mode */ }
  }, [profileId]);

  const cards = data.contentCards ?? [];
  const pillars = data.pillars ?? [];
  const agenda = data.monthData?.[month]?.agenda ?? [];
  const today = new Date().toISOString().slice(0, 10);

  const mine = boardCards(cards, month);
  const needs = needsToday({ cards, agenda, today });
  const orphans = unattachedPreviews(data.previewPosts ?? [], cards);
  // When the chosen month has nothing but other months do, say where the work
  // is instead of presenting an empty board as the truth about the profile.
  // Where the work is, for the ONE case that needs it: this month is empty and
  // another is not.
  //
  // A row of month chips lived here for about an hour on 2026-08-11. It was
  // built to answer "I can't see the other months", and her verdict on seeing
  // it was right: "we have the adjustment thing... I don't think we need July,
  // June, May, or any months separately." The arrows already move months, so
  // the chips were a second control for a job that had one.
  const monthHint = mine.length === 0
    ? (monthsWithWork(cards).find(m => m !== month) ?? null)
    : null;
  const buckets = stageBuckets(CONTENT_STAGES, mine);
  // Approved and Scheduled are parked, her call: "not something that we are
  // going to be doing right now." Rejected only exists once something has been
  // rejected. A parked column HOLDING pieces still draws, because data never
  // disappears behind a preference.
  const parked: ContentStage[] = ['ready', 'scheduled', 'rejected'];
  const shown = buckets.filter(b => !parked.includes(b.stage.id) || b.cards.length > 0);
  const tally = postedTally(cards, month);

  const sensors = useSensors(useSensor(SmartPointerSensor, { activationConstraint: { distance: 6 } }));
  const draggingCard = dragging ? cards.find(c => c.id === bareId(dragging)) ?? null : null;

  function toggleNeeds() {
    setNeedsOpen(open => {
      try { localStorage.setItem(needsOpenKey(profileId), writeNeedsOpen(!open)); } catch { /* private mode */ }
      return !open;
    });
  }

  function tickOff(row: NeedRow) {
    if (readOnly) return;
    const itemId = agendaIdOf(row);
    if (!itemId) return;
    dispatch({ type: 'TOGGLE_AGENDA', payload: { clientId: profileId, month, itemId } });
  }

  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    if (readOnly || !e.over) return;
    const stage = bareId(String(e.over.id)) as ContentStage;
    if (!CONTENT_STAGES.some(s => s.id === stage)) return;
    dispatch({
      type: 'MOVE_CONTENT_CARD',
      payload: { clientId: profileId, cardId: bareId(String(e.active.id)), stage },
    });
  }

  const stacked = (
    <div className="flex flex-col gap-3">
      {shown.map(b => (
        <StageRows
          key={b.stage.id}
          stage={b.stage}
          cards={b.cards}
          hue={hue}
          readOnly={readOnly}
          onOpen={onOpenPiece}
          profileId={profileId}
          month={month}
          extra={b.stage.id === 'idea' ? ideaExtra : undefined}
        />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-3.5">
      {lockBanner && <LockBanner />}

      {/* ── Needs you today. Hidden entirely when there is nothing in it. ──
          It was a full card saying "nothing is due today", above the board,
          every day that nothing was due, which is most days. An empty state
          does not need furniture. */}
      {needs.length > 0 && (
      <div className="overflow-hidden rounded-card border border-hairline bg-white shadow-card">
        <button
          type="button"
          onClick={toggleNeeds}
          aria-expanded={needsOpen}
          className="flex w-full items-center gap-[11px] px-[18px] py-3.5 text-left"
        >
          <span className={`flex text-faint transition-transform ${needsOpen ? '' : '-rotate-90'}`}>
            <ChevronDown size={15} strokeWidth={2.2} />
          </span>
          <span className="flex-1 text-[15px] font-semibold text-text">Needs you today</span>
          <span className="tnum rounded-full bg-[rgba(234,71,17,.10)] px-2.5 py-[3px] text-[11.5px] font-semibold text-accent-text">
            {needs.length}
          </span>
        </button>
        {needsOpen && needs.length === 0 && (
          <p className="border-t border-divider px-[18px] py-3 text-[13px] text-faint">
            Nothing is due today and nothing has slipped.
          </p>
        )}
        {needsOpen && needs.map(n => (
          <div key={n.id} className="flex items-center gap-3 border-t border-divider px-[18px] py-[13px]">
            {n.kind === 'task' && !readOnly ? (
              <button
                type="button"
                aria-label={`Mark "${n.title}" done`}
                onClick={() => tickOff(n)}
                className="h-[18px] w-[18px] flex-none rounded-full border-2 border-[#cfc9c4]"
              />
            ) : (
              <span
                className="h-2 w-2 flex-none rounded-full"
                style={{ background: n.kind === 'task' ? '#cfc9c4' : hue }}
              />
            )}
            {n.cardId ? (
              <button
                type="button"
                onClick={() => onOpenPiece(n.cardId as string)}
                className="flex-1 text-left text-[14.5px] font-semibold text-text"
              >
                {n.title}
              </button>
            ) : (
              <span className="flex-1 text-[14.5px] font-semibold text-text">{n.title}</span>
            )}
            <span className={`whitespace-nowrap text-[12.5px] font-semibold ${n.overdue ? 'text-overdue' : 'text-faint'}`}>
              {n.when}
            </span>
          </div>
        ))}
      </div>
      )}

      {/* ── The four views, and which month is on the table ────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented segments={VIEWS} active={view} onSelect={setView} />
          {/* The board shows ONE month. This is where that month is chosen.
              Before this strip existed the screen filtered by month with no way
              to change it, so past months looked like an empty board. */}
          <div className="flex items-center gap-1 rounded-[10px] bg-chip px-1 py-1">
            <button type="button" aria-label="Earlier month"
              onClick={() => setSelectedMonth(shiftMonth(month, -1))}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-white">
              <ChevronLeft size={15} strokeWidth={2.2} />
            </button>
            <span className="min-w-[104px] text-center text-[12.5px] font-semibold tabular-nums text-text">
              {formatMonthLabel(month)}
            </span>
            <button type="button" aria-label="Later month"
              onClick={() => setSelectedMonth(shiftMonth(month, 1))}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-white">
              <ChevronRight size={15} strokeWidth={2.2} />
            </button>
          </div>
          {monthHint && (
            <button type="button" onClick={() => setSelectedMonth(monthHint)}
              className="text-[12.5px] font-semibold text-accent-text">
              This month is empty. Jump to {formatMonthLabel(monthHint)}.
            </button>
          )}
        </div>
        {/* The right of the row is the reading: what went out this month. The
            drag hint that used to live here was a first-run hint shown forever;
            the read-only state, which actually matters, still speaks. */}
        <span className="text-[12.5px] text-muted">
          <span className="tnum font-semibold text-text">{postedLine(tally, formatMonthLabel(month))}</span>{' '}
          <span className="hidden text-faint lg:inline">{performanceLine(tally)}</span>
          {readOnly && <span className="ml-2 font-semibold text-accent-text">{boardNote(true, resting)}</span>}
        </span>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={(e: DragStartEvent) => setDragging(String(e.active.id))}
        onDragEnd={onDragEnd}
      >
        {view === 'board' && (
          <>
            {/* Desktop: six columns. */}
            <div className="hidden items-start gap-[11px] overflow-x-auto pb-2 pr-1 md:flex">
              {shown.map(b => (
                <StageColumn
                  key={b.stage.id}
                  stage={b.stage}
                  cards={b.cards}
                  hue={hue}
                  pillars={pillars}
                  readOnly={readOnly}
                  dragging={dragging}
                  onOpen={onOpenPiece}
                  profileId={profileId}
                  month={month}
                  onReject={b.stage.id === 'review' && !readOnly
                    ? (cardId: string) => dispatch({
                        type: 'MOVE_CONTENT_CARD',
                        payload: { clientId: profileId, cardId, stage: 'rejected' },
                      })
                    : undefined}
                  extra={b.stage.id === 'idea' ? ideaExtra : undefined}
                />
              ))}
            </div>
            {/* Phone: the same stages, stacked, as rows. */}
            <div className="md:hidden">{stacked}</div>
          </>
        )}

        <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
          {draggingCard && (
            <div
              className="w-[182px] rounded-[14px] border border-hairline bg-white px-[13px] py-3 shadow-card"
              style={{ borderLeft: `3px solid ${hue}` }}
            >
              <span className="text-sm font-semibold text-text">{draggingCard.title || 'Untitled post'}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {view === 'pillars' && (
        <PillarsView columns={pillarColumns(mine, pillars)} hue={hue} onOpen={onOpenPiece} />
      )}

      {view === 'month' && (
        <MonthView month={month} cards={mine} hue={hue} onOpen={onOpenPiece} />
      )}

      {/* ── Previews with nothing to hold on to (S9: nothing is deleted) ────── */}
      {/* One quiet line, not a block. Her note on 2026-08-09: the board is the
          screen, and this list was taking more room than the work itself. It
          folds to a notification and opens only when she wants to clear it. */}
      {orphans.length > 0 && (
        <div className="overflow-hidden rounded-card border border-hairline bg-white shadow-card">
          <button type="button" onClick={() => setOrphansOpen(v => !v)}
            className="flex w-full items-center gap-[11px] px-[18px] py-3 text-left">
            <span className="h-2 w-2 flex-none rounded-full bg-faint" />
            <span className="flex-1 text-[13px] font-semibold text-muted">
              {plural(orphans.length, 'preview')} to attach to a piece
            </span>
            <span className="text-[12.5px] font-semibold text-faint">{orphansOpen ? 'Hide' : 'Open'}</span>
            <span className={`flex text-faint ${orphansOpen ? '' : '-rotate-90'}`}>
              <ChevronDown size={15} strokeWidth={2.2} />
            </span>
          </button>
          {orphansOpen && (
            <p className="px-[18px] pb-2.5 text-[12.5px] leading-[1.5] text-faint">
              Pick the piece each one belongs to. Nothing is deleted.
            </p>
          )}
          {orphansOpen && orphans.map(p => (
            <OrphanRow key={p.id} preview={p} cards={cards} profileId={profileId} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * One loose preview, attachable where it is listed (2026-08-11).
 *
 * The strip used to say "open the piece it was made for and attach it there":
 * directions to a control, on a screen that had room for the control itself.
 * Her question was the proof: "where can I attach them, how can I attach
 * them???" Pick the piece, press Attach, done. The write is the same
 * `attachPreview` the piece panel performs.
 */
function OrphanRow({ preview, cards, profileId }: {
  preview: PreviewPost;
  cards: ContentCard[];
  profileId: string;
}) {
  const { dispatch, saveNow } = useApp();
  const [target, setTarget] = useState('');

  // Review first, then the rest newest first: the piece it belongs to is
  // usually the one just worked on.
  const ordered = [...cards].sort((a, b) =>
    Number(b.stage === 'review') - Number(a.stage === 'review')
    || (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));

  function attach() {
    if (!target) return;
    dispatch({
      type: 'UPDATE_PREVIEW_POST',
      payload: { clientId: profileId, post: attachPreview(preview, target, new Date().toISOString()) },
    });
    void saveNow();
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-divider px-[18px] py-3">
      <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-text">
        {preview.name || 'Untitled preview'}
        <span className="ml-2 text-[12px] font-normal text-faint">{plural(preview.images.length, 'slide')}</span>
      </span>
      <a href={`/p/${preview.shareId}`} target="_blank" rel="noopener noreferrer"
        className="text-[12.5px] font-semibold text-muted underline">
        View
      </a>
      <select value={target} onChange={e => setTarget(e.target.value)}
        aria-label="The piece this belongs to"
        className="max-w-[220px] rounded-lg border border-[rgba(23,21,26,.12)] px-2.5 py-1.5 text-[12.5px] text-text focus:border-accent focus:outline-none">
        <option value="">Which piece?</option>
        {ordered.map(c => <option key={c.id} value={c.id}>{c.title || 'Untitled'}</option>)}
      </select>
      {target && (
        <button type="button" onClick={attach}
          className="rounded-lg bg-ink px-3.5 py-1.5 text-[12.5px] font-semibold text-white">
          Attach
        </button>
      )}
    </div>
  );
}

// ── The card, in its two shapes ──────────────────────────────────────────────

function metaOf(card: ContentCard): string {
  return card.scheduledDate ? formatDate(card.scheduledDate) : 'No date yet';
}

function PieceCard({ card, hue, pillars, onOpen, draggable, dim }: {
  card: ContentCard;
  hue: string;
  pillars: ContentPillar[];
  onOpen: (id: string) => void;
  draggable: boolean;
  dim: boolean;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: dndId('col', card.id), disabled: !draggable,
  });
  const chips = cardChips(card, pillars);
  return (
    <div
      ref={setNodeRef}
      {...(draggable ? attributes : {})}
      {...(draggable ? listeners : {})}
      role="button"
      tabIndex={0}
      draggable={draggable ? undefined : false}
      onClick={() => onOpen(card.id)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(card.id); } }}
      style={{ borderLeft: `3px solid ${hue}`, touchAction: 'none', opacity: dim ? 0.45 : 1 }}
      className="mb-[9px] block w-full cursor-pointer select-none rounded-[14px] border border-hairline bg-white px-[13px] py-3 text-left shadow-card"
    >
      <span className="block text-sm font-semibold leading-[1.35] text-text">{card.title || 'Untitled post'}</span>
      {chips.length > 0 && (
        <span className="mt-[9px] flex flex-wrap gap-[5px]">
          {chips.map(t => (
            <span key={t} className="rounded-full bg-control px-[9px] py-0.5 text-[11px] font-semibold text-muted">{t}</span>
          ))}
        </span>
      )}
      <span className="tnum mt-2 block text-[11.5px] text-faint">{metaOf(card)}</span>
    </div>
  );
}

function StageColumn({ stage, cards, hue, pillars, readOnly, dragging, onOpen, profileId, month, onReject, extra }: {
  stage: { id: ContentStage; label: string };
  cards: ContentCard[];
  hue: string;
  pillars: ContentPillar[];
  readOnly: boolean;
  dragging: string | null;
  onOpen: (id: string) => void;
  profileId: string;
  month: string;
  /** Present only on the Review column: one tap records the rejection. */
  onReject?: (cardId: string) => void;
  /** Present only on the Idea column, only for a client: the idea lane. */
  extra?: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dndId('col', stage.id), disabled: readOnly });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[300px] w-full min-w-[240px] flex-1 rounded-card px-3 py-3.5 ${
        stage.id === 'posted' ? 'bg-sunken-muted' : 'bg-sunken'
      } ${isOver && !readOnly ? 'ring-2 ring-accent/40' : ''}`}
    >
      <div className="mb-[11px] flex items-center justify-between">
        <span className="text-[11.5px] font-bold uppercase tracking-[.09em] text-muted">{stage.label}</span>
        <span className="tnum rounded-full bg-white px-2 py-px text-[11.5px] font-semibold text-faint">{cards.length}</span>
      </div>
      {cards.map(c => (
        <div key={c.id}>
          <PieceCard
            card={c}
            hue={hue}
            pillars={pillars}
            onOpen={onOpen}
            draggable={!readOnly}
            dim={dragging !== null && bareId(dragging) === c.id}
          />
          {onReject && (
            <button type="button" onClick={() => onReject(c.id)}
              className="mb-2 ml-1 text-[11.5px] font-semibold text-faint hover:text-accent-text">
              Reject
            </button>
          )}
        </div>
      ))}
      {/* Add where you are looking: this creates the piece already in THIS
          column, rather than in Idea to be dragged over afterwards. */}
      {!readOnly && (
        <div className="mt-1.5">
          <AddEntry profileId={profileId} stage={stage.id} month={month} compact />
        </div>
      )}
      {extra}
    </div>
  );
}

/**
 * The phone form of the board, and the Table view: stacked stage sections.
 *
 * The whole section is a drop target, so a piece can be moved here too. The
 * prototype does the same: the stage is the target, in both shapes.
 */
function StageRows({ stage, cards, hue, readOnly, onOpen, profileId, month, extra }: {
  stage: { id: ContentStage; label: string };
  cards: ContentCard[];
  hue: string;
  readOnly: boolean;
  onOpen: (id: string) => void;
  profileId: string;
  month: string;
  /** Present only on the Idea section, only for a client: the idea lane. */
  extra?: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dndId('row', stage.id), disabled: readOnly });
  return (
    <div
      ref={setNodeRef}
      className={`overflow-hidden rounded-card border bg-white shadow-card ${
        isOver && !readOnly ? 'border-accent' : 'border-hairline'
      }`}
    >
      <div className="flex items-center justify-between px-4 py-[13px]">
        <span className="text-[11.5px] font-bold uppercase tracking-[.09em] text-muted">{stage.label}</span>
        <span className="tnum text-[11.5px] font-semibold text-faint">{cards.length}</span>
      </div>
      {cards.map(c => (
        <StageRow key={c.id} card={c} hue={hue} readOnly={readOnly} onOpen={onOpen} />
      ))}
      {/* The phone had no way to add (2026-08-11, her report from mobile:
          "no option to add an idea or build it"). Same card as the columns. */}
      {!readOnly && (
        <div className="border-t border-divider px-3 py-2.5">
          <AddEntry profileId={profileId} stage={stage.id} month={month} compact />
        </div>
      )}
      {extra && <div className="border-t border-divider px-3 py-2.5">{extra}</div>}
    </div>
  );
}

function StageRow({ card, hue, readOnly, onOpen }: {
  card: ContentCard;
  hue: string;
  readOnly: boolean;
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: dndId('row', card.id), disabled: readOnly,
  });
  return (
    <div
      ref={setNodeRef}
      {...(readOnly ? {} : attributes)}
      {...(readOnly ? {} : listeners)}
      role="button"
      tabIndex={0}
      draggable={readOnly ? false : undefined}
      onClick={() => onOpen(card.id)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(card.id); } }}
      style={{ touchAction: 'none' }}
      className="flex w-full cursor-pointer select-none items-center gap-3 border-t border-divider px-4 py-[13px] text-left"
    >
      <span className="h-2 w-2 flex-none rounded-full" style={{ background: hue }} />
      <span className="flex-1 text-[15px] font-semibold text-text">{card.title || 'Untitled post'}</span>
      <span className="tnum whitespace-nowrap text-[12px] text-faint">{metaOf(card)}</span>
    </div>
  );
}

// ── Pillars ──────────────────────────────────────────────────────────────────

function PillarsView({ columns, hue, onOpen }: {
  columns: PillarCol[];
  hue: string;
  onOpen: (id: string) => void;
}) {
  if (columns.length === 0) {
    return <p className="py-10 text-center text-sm text-faint">No pillars on this profile yet.</p>;
  }

  return (
    // A responsive grid that uses the width it has (2026-08-11, her note: "the
    // pillars themselves are not looking good, there is a lot of white space").
    // Fixed 206px columns floated in a wide screen; a grid divides it instead.
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {columns.map(col => (
        <div
          key={col.id || 'unsorted'}
          className="w-full rounded-card bg-sunken px-4 py-4 md:min-h-[300px]"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11.5px] font-bold uppercase tracking-[.09em] text-muted">{col.label}</span>
            {col.targetPct !== null && (
              <span className="tnum whitespace-nowrap text-[11.5px] text-faint">{col.targetPct}% target</span>
            )}
          </div>
          <p className="mb-[11px] mt-1 text-[11.5px] text-faint">{pillarMixLine(col)}</p>
          {col.cards.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => onOpen(c.id)}
              style={{ borderLeft: `3px solid ${hue}` }}
              className="mb-[9px] block w-full rounded-[14px] border border-hairline bg-white px-[13px] py-3 text-left"
            >
              <span className="block text-sm font-semibold text-text">{c.title || 'Untitled post'}</span>
              <span className="tnum mt-[7px] block text-[11.5px] text-faint">{metaOf(c)}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Month ────────────────────────────────────────────────────────────────────

function MonthView({ month, cards, hue, onOpen }: {
  month: string;
  cards: ContentCard[];
  hue: string;
  onOpen: (id: string) => void;
}) {
  const cells = monthCells(month, cards);
  const listed = agendaOf(cards);

  return (
    <>
      {/* Desktop: the grid. */}
      <div className="hidden rounded-card border border-hairline bg-white p-4 shadow-card md:block">
        <p className="mb-3 text-[11.5px] font-bold uppercase tracking-[.09em] text-muted">
          {formatMonthLabel(month)} · {plural(listed.length, 'dated piece')}
        </p>
        <div className="mb-2 grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map(d => (
            <span key={d} className="text-[11px] font-bold uppercase tracking-[.09em] text-faint">{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((cell, i) => (
            <div
              key={cell.date || `pad-${i}`}
              className={`flex min-h-[62px] flex-col gap-1 rounded-[10px] p-1.5 ${cell.day ? 'bg-sunken' : ''}`}
            >
              <span className="tnum text-[11px] text-faint">{cell.day ?? ''}</span>
              {cell.cards.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onOpen(c.id)}
                  style={{ background: hue }}
                  className="rounded-[5px] px-1 py-0.5 text-left text-[10px] font-semibold leading-[1.25] text-white"
                >
                  {c.title || 'Untitled post'}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Phone: an agenda list, not a grid. */}
      <div className="overflow-hidden rounded-card border border-hairline bg-white shadow-card md:hidden">
        <p className="px-4 pb-2 pt-3.5 text-[11.5px] font-bold uppercase tracking-[.09em] text-muted">
          {formatMonthLabel(month)} · {plural(listed.length, 'dated piece')}
        </p>
        {listed.length === 0 ? (
          <p className="border-t border-divider px-4 py-3 text-[12.5px] text-faint">Nothing has a date this month.</p>
        ) : listed.map(c => (
          <button
            key={c.id}
            type="button"
            onClick={() => onOpen(c.id)}
            className="flex w-full items-center gap-3 border-t border-divider px-4 py-3.5 text-left"
          >
            <span className="h-2 w-2 flex-none rounded-full" style={{ background: hue }} />
            <span className="flex-1 text-[15px] font-semibold text-text">{c.title || 'Untitled post'}</span>
            <span className="tnum whitespace-nowrap text-[12.5px] text-faint">{formatDate(c.scheduledDate)}</span>
          </button>
        ))}
      </div>
    </>
  );
}
