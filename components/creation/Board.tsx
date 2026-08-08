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
import { ChevronDown } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import { formatDate, formatMonthLabel } from '@/lib/utils';
import { CONTENT_STAGES, type ContentCard, type ContentPillar, type ContentStage } from '@/types';
import {
  agendaIdOf, agendaOf, bareId, boardCards, boardNote, cardChips, dndId, monthCells,
  needsOpenKey, needsToday, pillarColumns, pillarMixLine, plural, readNeedsOpen,
  stageBuckets, unattachedPreviews, writeNeedsOpen,
  type NeedRow, type PillarColumn as PillarCol,
} from '@/lib/creation/board';
import { LockBanner, Segmented } from '@/components/shell/Screen';

const VIEWS = [
  { id: 'board', label: 'Board' },
  { id: 'pillars', label: 'Pillars' },
  { id: 'table', label: 'Table' },
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
  /** Before the lock nothing here moves. The banner above says why, once. */
  readOnly: boolean;
  /**
   * Opens the piece panel over this screen. The panel is another screen's job;
   * the board only ever hands it a card id.
   */
  onOpenPiece: (cardId: string) => void;
  /**
   * Whether the board draws the lock banner itself. The Creation page already
   * draws one above every sub-tab, so it passes false. A board mounted on its
   * own keeps the design's behaviour and draws it.
   */
  lockBanner?: boolean;
}

export default function Board({
  profileId, hue, readOnly, onOpenPiece, lockBanner = true,
}: BoardProps) {
  const { dispatch, selectedMonth: month } = useApp();
  const { data } = useClient(profileId);

  const [view, setView] = useState('board');
  const [dragging, setDragging] = useState<string | null>(null);
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
  const buckets = stageBuckets(CONTENT_STAGES, mine);

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
      {buckets.map(b => (
        <StageRows
          key={b.stage.id}
          stage={b.stage}
          cards={b.cards}
          hue={hue}
          readOnly={readOnly}
          onOpen={onOpenPiece}
        />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-3.5">
      {lockBanner && readOnly && <LockBanner />}

      {/* ── Needs you today. This profile, and no other. ───────────────────── */}
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

      {/* ── The four views ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented segments={VIEWS} active={view} onSelect={setView} />
        <span className="text-[12.5px] text-faint">{boardNote(readOnly)}</span>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={(e: DragStartEvent) => setDragging(String(e.active.id))}
        onDragEnd={onDragEnd}
      >
        {view === 'board' && (
          <>
            {/* Desktop: six columns. */}
            <div className="hidden items-start gap-[11px] overflow-x-auto pb-2 md:flex">
              {buckets.map(b => (
                <StageColumn
                  key={b.stage.id}
                  stage={b.stage}
                  cards={b.cards}
                  hue={hue}
                  pillars={pillars}
                  readOnly={readOnly}
                  dragging={dragging}
                  onOpen={onOpenPiece}
                />
              ))}
            </div>
            {/* Phone: the same stages, stacked, as rows. */}
            <div className="md:hidden">{stacked}</div>
          </>
        )}

        {/* Table is the stacked form at every width. */}
        {view === 'table' && stacked}

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
      {orphans.length > 0 && (
        <div className="overflow-hidden rounded-card border border-hairline bg-white shadow-card">
          <div className="px-[18px] pb-2.5 pt-3.5">
            <p className="text-[11.5px] font-bold uppercase tracking-[.09em] text-muted">
              {plural(orphans.length, 'preview')} not attached to a piece
            </p>
            <p className="mt-1 text-[12.5px] leading-[1.5] text-faint">
              These were made before a preview belonged to a piece. Open the piece it was made for and
              attach it there. Nothing is deleted.
            </p>
          </div>
          {orphans.map(p => (
            <div key={p.id} className="flex items-center gap-3.5 border-t border-divider px-[18px] py-3.5">
              <span className="flex-1 text-[14.5px] font-semibold text-text">{p.name || 'Untitled preview'}</span>
              <span className="text-[12px] text-faint">{plural(p.images.length, 'slide')}</span>
              <a
                href={`/p/${p.shareId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12.5px] font-semibold text-muted underline"
              >
                Open it
              </a>
            </div>
          ))}
        </div>
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

function StageColumn({ stage, cards, hue, pillars, readOnly, dragging, onOpen }: {
  stage: { id: ContentStage; label: string };
  cards: ContentCard[];
  hue: string;
  pillars: ContentPillar[];
  readOnly: boolean;
  dragging: string | null;
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dndId('col', stage.id), disabled: readOnly });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[170px] w-[206px] flex-none rounded-card px-3 py-3.5 ${
        stage.id === 'posted' ? 'bg-sunken-muted' : 'bg-sunken'
      } ${isOver && !readOnly ? 'ring-2 ring-accent/40' : ''}`}
    >
      <div className="mb-[11px] flex items-center justify-between">
        <span className="text-[11.5px] font-bold uppercase tracking-[.09em] text-muted">{stage.label}</span>
        <span className="tnum rounded-full bg-white px-2 py-px text-[11.5px] font-semibold text-faint">{cards.length}</span>
      </div>
      {cards.map(c => (
        <PieceCard
          key={c.id}
          card={c}
          hue={hue}
          pillars={pillars}
          onOpen={onOpen}
          draggable={!readOnly}
          dim={dragging !== null && bareId(dragging) === c.id}
        />
      ))}
    </div>
  );
}

/**
 * The phone form of the board, and the Table view: stacked stage sections.
 *
 * The whole section is a drop target, so a piece can be moved here too. The
 * prototype does the same: the stage is the target, in both shapes.
 */
function StageRows({ stage, cards, hue, readOnly, onOpen }: {
  stage: { id: ContentStage; label: string };
  cards: ContentCard[];
  hue: string;
  readOnly: boolean;
  onOpen: (id: string) => void;
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
      {cards.length === 0 ? (
        <p className="border-t border-divider px-4 py-3 text-[12.5px] text-faint">Nothing at this stage.</p>
      ) : cards.map(c => (
        <StageRow key={c.id} card={c} hue={hue} readOnly={readOnly} onOpen={onOpen} />
      ))}
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
    // Stacked full width on a phone. Never a horizontal scroller there.
    <div className="flex flex-col items-stretch gap-[11px] md:flex-row md:items-start md:overflow-x-auto">
      {columns.map(col => (
        <div
          key={col.id || 'unsorted'}
          className="w-full rounded-card bg-sunken px-3 py-3.5 md:min-h-[170px] md:w-[206px] md:flex-none"
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
