'use client';

import { useState } from 'react';
import {
  DndContext, DragEndEvent, DragStartEvent, DragOverlay,
  PointerSensor, useSensor, useSensors, useDroppable, useDraggable,
} from '@dnd-kit/core';
import {
  Plus, Trash2, Pencil, Copy, Check, Columns3, Table2, LayoutGrid, Kanban,
  MoreHorizontal, Sparkles, Link2, Users, Share2, ChevronLeft, ChevronRight,
  ExternalLink, Settings2, GripVertical, Target,
} from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import { generateId, CLIENT_COLORS, formatMonthKey, formatMonthLabel, prevMonth, nextMonth, formatDate } from '@/lib/utils';
import {
  ContentPillar, ContentCard, ContentStage, CONTENT_STAGES,
  DEFAULT_CONTENT_TYPES, DEFAULT_PLATFORMS, CustomFieldDef,
} from '@/types';
import Modal from './Modal';

const STARTER_PILLARS = ['Educational', 'Founder story', 'Client wins / Trust', 'Community', 'Behind the scenes', 'Promotional'];

// ResumeGuru's locked strategy mix — seeds pillars with targets + platforms.
const RESUMEGURU_PILLARS: { name: string; targetPct: number }[] = [
  { name: 'AI lane', targetPct: 40 },
  { name: 'Value', targetPct: 25 },
  { name: 'Career OS', targetPct: 20 },
  { name: 'Proof', targetPct: 15 },
];

type ViewId = 'board' | 'pillars' | 'table';

function stageMeta(id: ContentStage) {
  return CONTENT_STAGES.find(s => s.id === id) ?? CONTENT_STAGES[0];
}

/** Hand-off copy: title + hook lead, content is the star, link closes. */
function formatForCopy(card: ContentCard): string {
  const parts = [];
  if (card.title.trim()) parts.push(card.title.trim());
  if (card.hook.trim()) parts.push(card.hook.trim());
  const head = parts.join('\n');
  const link = card.link?.trim() ?? '';
  let out = card.content.trim() ? (head ? `${head}\n\n${card.content.trim()}` : card.content.trim()) : head;
  if (link) out = out ? `${out}\n\n${link}` : link;
  return out;
}

function toHref(link: string): string {
  return /^https?:\/\//i.test(link) ? link : `https://${link}`;
}

function isInteractive(el: Element | null): boolean {
  const tags = ['button', 'input', 'textarea', 'select', 'option', 'a', 'label'];
  let cur = el;
  while (cur) {
    if (tags.includes(cur.tagName.toLowerCase())) return true;
    if ((cur as HTMLElement).dataset?.noDnd) return true;
    cur = cur.parentElement;
  }
  return false;
}

class SmartPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown' as const,
      handler: ({ nativeEvent }: { nativeEvent: PointerEvent }) =>
        !isInteractive(nativeEvent.target as Element),
    },
  ];
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function ContentView({ clientId }: { clientId: string }) {
  const { dispatch, role, selectedMonth: month, setSelectedMonth: setMonth } = useApp();
  const { client, data } = useClient(clientId);
  const isResumeGuru = /resume/i.test(client?.name ?? '');
  const [view, setView] = useState<ViewId>(() => {
    if (typeof window === 'undefined') return 'board';
    return (localStorage.getItem(`content_view_${clientId}`) as ViewId) || 'board';
  });
  const [editingCard, setEditingCard] = useState<ContentCard | null>(null);
  const [renamingPillar, setRenamingPillar] = useState<ContentPillar | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  const pillars = data.pillars ?? [];
  const cards = data.contentCards ?? [];
  const platforms = data.platforms ?? [];
  const multiPlatform = platforms.length > 1;

  function switchView(v: ViewId) {
    setView(v);
    try { localStorage.setItem(`content_view_${clientId}`, v); } catch {}
  }

  // Month filter applies to Board and Table (the timeline lenses). The
  // Pillars lens is the idea library — it always shows everything.
  const monthFiltered = cards.filter(c => !c.createdMonth || c.createdMonth === month);
  const searched = (list: ContentCard[]) => {
    let out = list;
    if (platformFilter) out = out.filter(c => c.platform === platformFilter);
    if (search) out = out.filter(c => [c.title, c.hook, c.content].some(s => s.toLowerCase().includes(search.toLowerCase())));
    return out;
  };

  const boardCards = searched(monthFiltered);
  const pillarCards = searched(cards);

  const postedThisMonth = monthFiltered.filter(c => c.stage === 'posted').length;
  const postTarget = data.postTarget ?? 0;

  function newCard(preset: Partial<ContentCard>) {
    const now = new Date().toISOString();
    setEditingCard({
      id: generateId(), pillarId: '', title: '', hook: '', content: '', link: '',
      stage: 'idea', contentType: '', role: '', platform: multiPlatform ? platforms[0] : undefined,
      scheduledDate: '', postUrl: '', notes: '', customValues: {},
      createdMonth: month, createdAt: now, updatedAt: now,
      ...preset,
    });
  }

  function saveCard(card: ContentCard) {
    const exists = cards.some(c => c.id === card.id);
    dispatch({
      type: exists ? 'UPDATE_CONTENT_CARD' : 'ADD_CONTENT_CARD',
      payload: { clientId, card: { ...card, updatedAt: new Date().toISOString() } },
    });
    setEditingCard(null);
  }

  function deleteCard(cardId: string) {
    dispatch({ type: 'DELETE_CONTENT_CARD', payload: { clientId, cardId } });
    setEditingCard(null);
  }

  function setStage(cardId: string, stage: ContentStage) {
    dispatch({ type: 'MOVE_CONTENT_CARD', payload: { clientId, cardId, stage } });
  }

  function addPillar(name: string) {
    const color = CLIENT_COLORS[pillars.length % CLIENT_COLORS.length];
    dispatch({
      type: 'ADD_PILLAR',
      payload: { clientId, pillar: { id: generateId(), name: name.trim(), color, createdAt: new Date().toISOString() } },
    });
  }

  // One-click ResumeGuru setup: the 4 strategy pillars (with mix targets the
  // Journey tab measures against) + the three platforms.
  function loadResumeGuruPack() {
    RESUMEGURU_PILLARS.forEach((p, i) => {
      dispatch({
        type: 'ADD_PILLAR',
        payload: { clientId, pillar: { id: generateId(), name: p.name, targetPct: p.targetPct, color: CLIENT_COLORS[i % CLIENT_COLORS.length], createdAt: new Date().toISOString() } },
      });
    });
    dispatch({ type: 'SET_PLATFORMS', payload: { clientId, platforms: ['Instagram', 'LinkedIn', 'YouTube'] } });
  }

  const sensors = useSensors(useSensor(SmartPointerSensor, { activationConstraint: { distance: 6 } }));
  const activeCard = cards.find(c => c.id === activeCardId) ?? null;

  function handleDragEnd(e: DragEndEvent) {
    setActiveCardId(null);
    if (!e.over) return;
    const stage = e.over.id as ContentStage;
    if (CONTENT_STAGES.some(s => s.id === stage)) setStage(e.active.id as string, stage);
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold text-stone-900">Content</h2>
          <p className="text-sm text-stone-400">One card per post, from idea to live.</p>
        </div>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {postTarget > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-stone-500 border border-stone-200 bg-white rounded-lg px-2.5 py-1.5" title="Posted this month vs target">
              <Target size={13} className="text-accent" />
              {postedThisMonth}/{postTarget} this month
            </span>
          )}
          <div className="flex items-center gap-0.5 border border-stone-200 bg-white rounded-lg p-0.5">
            <ViewBtn active={view === 'board'} onClick={() => switchView('board')} icon={<Kanban size={14} />} label="Board" />
            <ViewBtn active={view === 'pillars'} onClick={() => switchView('pillars')} icon={<Columns3 size={14} />} label="Pillars" />
            <ViewBtn active={view === 'table'} onClick={() => switchView('table')} icon={<Table2 size={14} />} label="Table" />
          </div>
          {role === 'owner' && (
            <button onClick={() => setSettingsOpen(true)} className="p-2 rounded-lg border border-stone-200 bg-white text-stone-500 hover:text-stone-900 transition-colors" title="Platforms">
              <Settings2 size={14} />
            </button>
          )}
          <button onClick={() => newCard({})} className="btn-primary flex items-center gap-1.5">
            <Plus size={15} /> Post
          </button>
        </div>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search posts..."
          className="px-3 py-1.5 text-sm border border-stone-200 bg-white rounded-lg focus:outline-none w-44"
        />
        {multiPlatform && (
          <div className="flex items-center gap-0.5 border border-stone-200 bg-white rounded-lg p-0.5">
            <button onClick={() => setPlatformFilter('')}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${platformFilter === '' ? 'bg-[#1f1f1f] text-white' : 'text-stone-500 hover:text-stone-900'}`}>
              All
            </button>
            {platforms.map(p => (
              <button key={p} onClick={() => setPlatformFilter(platformFilter === p ? '' : p)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${platformFilter === p ? 'bg-[#1f1f1f] text-white' : 'text-stone-500 hover:text-stone-900'}`}>
                {p}
              </button>
            ))}
          </div>
        )}
        {view !== 'pillars' && (
          <div className="flex items-center gap-1 bg-white border border-stone-200 rounded-lg p-0.5 ml-auto">
            <button onClick={() => setMonth(prevMonth(month))} className="p-1.5 rounded-md text-stone-500 hover:bg-stone-50"><ChevronLeft size={15} /></button>
            <span className="px-2 text-xs font-medium text-stone-700">{formatMonthLabel(month)}</span>
            <button onClick={() => setMonth(formatMonthKey(new Date()))} className="px-2 py-1 text-xs text-stone-400 hover:text-stone-900">Today</button>
            <button onClick={() => setMonth(nextMonth(month))} className="p-1.5 rounded-md text-stone-500 hover:bg-stone-50"><ChevronRight size={15} /></button>
          </div>
        )}
      </div>

      {view === 'board' && (
        <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setActiveCardId(e.active.id as string)} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4 items-start">
            {CONTENT_STAGES.map(stage => (
              <StageColumn
                key={stage.id}
                stage={stage}
                pillars={pillars}
                multiPlatform={multiPlatform}
                cards={boardCards.filter(c => c.stage === stage.id)}
                activeCardId={activeCardId}
                onAdd={() => newCard({ stage: stage.id })}
                onOpen={setEditingCard}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
            {activeCard && (
              <div className="bg-white border-2 border-accent rounded-xl shadow-2xl p-3 w-60 rotate-1 opacity-95">
                <p className="font-medium text-sm text-stone-900 truncate">{activeCard.title || 'Untitled'}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {view === 'pillars' && (
        pillars.length === 0 && pillarCards.length === 0 ? (
          <PillarsEmptyState onAdd={addPillar} onLoadPack={isResumeGuru ? loadResumeGuruPack : undefined} />
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4 items-start">
            {pillars.map(pillar => (
              <PillarColumn
                key={pillar.id}
                title={pillar.name}
                color={pillar.color}
                cards={pillarCards.filter(c => c.pillarId === pillar.id)}
                multiPlatform={multiPlatform}
                onAdd={() => newCard({ pillarId: pillar.id })}
                onOpen={setEditingCard}
                onStage={setStage}
                menu={
                  <PillarMenu
                    onRename={() => setRenamingPillar(pillar)}
                    onDelete={() => {
                      if (confirm('Delete this pillar? Its posts move to Unsorted.')) {
                        dispatch({ type: 'DELETE_PILLAR', payload: { clientId, pillarId: pillar.id } });
                      }
                    }}
                  />
                }
              />
            ))}
            {pillarCards.some(c => !c.pillarId || !pillars.some(p => p.id === c.pillarId)) && (
              <PillarColumn
                title="Unsorted"
                color="#a8a29e"
                cards={pillarCards.filter(c => !c.pillarId || !pillars.some(p => p.id === c.pillarId))}
                multiPlatform={multiPlatform}
                onAdd={() => newCard({})}
                onOpen={setEditingCard}
                onStage={setStage}
              />
            )}
            <div className="w-72 shrink-0">
              <AddPillarColumn onAdd={addPillar} />
            </div>
          </div>
        )
      )}

      {view === 'table' && (
        <TableView cards={boardCards} pillars={pillars} multiPlatform={multiPlatform} onOpen={setEditingCard} />
      )}

      {editingCard && (
        <CardEditor
          card={editingCard}
          pillars={pillars}
          customFields={data.customFields ?? []}
          platforms={platforms}
          sourceClientId={clientId}
          onClose={() => setEditingCard(null)}
          onSave={saveCard}
          onDelete={cards.some(c => c.id === editingCard.id) ? () => deleteCard(editingCard.id) : undefined}
        />
      )}

      {renamingPillar && (
        <RenamePillarModal
          pillar={renamingPillar}
          onClose={() => setRenamingPillar(null)}
          onSave={p => { dispatch({ type: 'UPDATE_PILLAR', payload: { clientId, pillar: p } }); setRenamingPillar(null); }}
        />
      )}

      {settingsOpen && (
        <PlatformsModal
          platforms={platforms}
          onClose={() => setSettingsOpen(false)}
          onSave={p => { dispatch({ type: 'SET_PLATFORMS', payload: { clientId, platforms: p } }); setSettingsOpen(false); }}
        />
      )}
    </div>
  );
}

function ViewBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-colors ${
        active ? 'bg-[#1f1f1f] text-white' : 'text-stone-500 hover:text-stone-900'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ── Shared card ──────────────────────────────────────────────────────────────

function CollabBadge({ card }: { card: ContentCard }) {
  const partners = card.collabWith ?? [];
  if (!card.collabId || partners.length === 0) return null;
  const label = partners.map(p => p.clientName).join(', ');
  return (
    <span className="inline-flex items-center gap-1 max-w-full text-[11px] text-violet-700 bg-violet-50 rounded-full px-1.5 py-0.5 mt-1.5" title={`Shared with ${label}`}>
      <Users size={10} className="shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
}

function PostCardBody({ card, pillars, multiPlatform, showStage, onStage }: {
  card: ContentCard;
  pillars: ContentPillar[];
  multiPlatform: boolean;
  showStage?: boolean;
  onStage?: (s: ContentStage) => void;
}) {
  const [copied, setCopied] = useState(false);
  const meta = stageMeta(card.stage);
  const pillar = pillars.find(p => p.id === card.pillarId);

  function copy(e: React.MouseEvent) {
    e.stopPropagation();
    const text = formatForCopy(card);
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }

  function cycleStage(e: React.MouseEvent) {
    e.stopPropagation();
    if (!onStage) return;
    const i = CONTENT_STAGES.findIndex(s => s.id === card.stage);
    onStage(CONTENT_STAGES[(i + 1) % CONTENT_STAGES.length].id);
  }

  return (
    <>
      <p className="text-sm font-medium text-stone-900 leading-snug line-clamp-2">{card.title || 'Untitled post'}</p>
      {card.hook && <p className="text-xs text-stone-500 mt-1 line-clamp-2">{card.hook}</p>}
      <div className="flex flex-wrap items-center gap-1 mt-1.5">
        {pillar && (
          <span className="inline-flex items-center gap-1 text-[10px] text-stone-500">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pillar.color }} />
            {pillar.name}
          </span>
        )}
        {card.contentType && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-stone-100 text-stone-600">{card.contentType}</span>}
        {multiPlatform && card.platform && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600">{card.platform}</span>}
        {card.scheduledDate && <span className="text-[10px] text-stone-400">{formatDate(card.scheduledDate)}</span>}
      </div>
      {card.link?.trim() && (
        <a href={toHref(card.link.trim())} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} data-no-dnd="true"
          className="inline-flex items-center gap-1 mt-1.5 max-w-full text-[11px] text-sky-600 hover:underline" title={card.link.trim()}>
          <Link2 size={11} className="shrink-0" />
          <span className="truncate">{card.link.trim().replace(/^https?:\/\/(www\.)?/i, '')}</span>
        </a>
      )}
      {card.postUrl?.trim() && (
        <a href={toHref(card.postUrl.trim())} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} data-no-dnd="true"
          className="inline-flex items-center gap-1 mt-1 max-w-full text-[11px] text-emerald-600 hover:underline ml-2">
          <ExternalLink size={11} className="shrink-0" /> live post
        </a>
      )}
      <CollabBadge card={card} />
      <div className="flex items-center gap-1 mt-2" data-no-dnd="true">
        {showStage && (
          <button onClick={cycleStage} className="text-[10px] font-medium rounded-full px-1.5 py-0.5"
            style={{ color: meta.color, backgroundColor: meta.bg }} title="Click to change stage">
            {meta.label}
          </button>
        )}
        {card.stage === 'idea' && card.content.trim() && <span className="text-[10px] text-stone-400">content ready</span>}
        <button onClick={copy}
          className={`ml-auto p-1 rounded transition-colors ${copied ? 'text-emerald-600' : 'text-stone-400 hover:text-stone-700'}`}
          title="Copy for hand-off">
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
      </div>
    </>
  );
}

// ── Board view (stages) ──────────────────────────────────────────────────────

function StageColumn({ stage, cards, pillars, multiPlatform, activeCardId, onAdd, onOpen }: {
  stage: { id: ContentStage; label: string; color: string; bg: string };
  cards: ContentCard[];
  pillars: ContentPillar[];
  multiPlatform: boolean;
  activeCardId: string | null;
  onAdd: () => void;
  onOpen: (c: ContentCard) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <div className="w-64 shrink-0 flex flex-col max-h-[calc(100vh-260px)]">
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-t-xl border border-stone-200" style={{ backgroundColor: stage.bg }}>
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
        <span className="font-medium text-sm text-stone-800 flex-1">{stage.label}</span>
        <span className="text-[11px] text-stone-500 bg-white px-1.5 py-0.5 rounded-full">{cards.length}</span>
      </div>
      <div ref={setNodeRef}
        className={`flex-1 overflow-y-auto min-h-[120px] rounded-b-xl border-x border-b border-stone-200 p-2 space-y-2 transition-colors ${isOver ? 'bg-accent-light' : 'bg-stone-50'}`}>
        {cards.map(card => (
          <DraggableCard key={card.id} card={card} dim={activeCardId === card.id}
            onOpen={() => onOpen(card)}>
            <PostCardBody card={card} pillars={pillars} multiPlatform={multiPlatform} />
          </DraggableCard>
        ))}
        <button onClick={onAdd}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-stone-400 hover:text-stone-700 hover:bg-white rounded-lg border border-dashed border-stone-300 transition-colors">
          <Plus size={13} /> Add
        </button>
      </div>
    </div>
  );
}

function DraggableCard({ card, dim, onOpen, children }: {
  card: ContentCard; dim: boolean; onOpen: () => void; children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: card.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners}
      style={{ touchAction: 'none', opacity: dim ? 0.3 : 1 }}
      onClick={onOpen}
      className="bg-white border border-stone-200 rounded-lg p-2.5 cursor-pointer hover:shadow-sm hover:border-stone-300 transition-all select-none">
      <div className="flex items-start gap-1.5">
        <GripVertical size={13} className="text-stone-300 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}

// ── Pillars view (themes) ────────────────────────────────────────────────────

function PillarColumn({ title, color, cards, multiPlatform, onAdd, onOpen, onStage, menu }: {
  title: string;
  color: string;
  cards: ContentCard[];
  multiPlatform: boolean;
  onAdd: () => void;
  onOpen: (c: ContentCard) => void;
  onStage: (cardId: string, s: ContentStage) => void;
  menu?: React.ReactNode;
}) {
  // Posted cards are archive, not work — fold them behind a footer so the
  // column shows only what's current. Expand to browse history.
  const [showPosted, setShowPosted] = useState(false);
  const active = cards.filter(c => c.stage !== 'posted');
  const posted = cards.filter(c => c.stage === 'posted');

  const renderCard = (card: ContentCard) => (
    <div key={card.id} onClick={() => onOpen(card)}
      className="group bg-white border border-stone-200 rounded-lg p-2.5 cursor-pointer hover:shadow-sm hover:border-stone-300 transition-all">
      <PostCardBody card={card} pillars={[]} multiPlatform={multiPlatform} showStage onStage={s => onStage(card.id, s)} />
    </div>
  );

  return (
    <div className="w-72 shrink-0 bg-stone-50 border border-stone-200 rounded-xl flex flex-col max-h-[calc(100vh-260px)]">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-stone-200">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <h3 className="text-sm font-semibold text-stone-800 truncate flex-1">{title}</h3>
        <span className="text-[11px] text-stone-400 tabular-nums">{cards.length}</span>
        {menu}
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {active.map(renderCard)}
        <button onClick={onAdd}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-stone-500 hover:text-stone-900 hover:bg-white rounded-lg border border-dashed border-stone-300 transition-colors">
          <Plus size={13} /> Add topic
        </button>
        {posted.length > 0 && (
          <button onClick={() => setShowPosted(s => !s)}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] text-stone-400 hover:text-stone-700 rounded-lg transition-colors">
            {showPosted ? '▾' : '▸'} Posted ({posted.length})
          </button>
        )}
        {showPosted && posted.map(renderCard)}
      </div>
    </div>
  );
}

function PillarMenu({ onRename, onDelete }: { onRename: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className="p-0.5 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-200 transition-colors">
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-6 z-20 w-32 bg-white border border-stone-200 rounded-lg shadow-lg py-1">
            <button onClick={() => { onRename(); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50">
              <Pencil size={12} /> Rename
            </button>
            <button onClick={() => { onDelete(); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50">
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Table view ───────────────────────────────────────────────────────────────

function TableView({ cards, pillars, multiPlatform, onOpen }: {
  cards: ContentCard[];
  pillars: ContentPillar[];
  multiPlatform: boolean;
  onOpen: (card: ContentCard) => void;
}) {
  const sorted = [...cards].sort((a, b) =>
    CONTENT_STAGES.findIndex(s => s.id === a.stage) - CONTENT_STAGES.findIndex(s => s.id === b.stage) ||
    a.createdAt.localeCompare(b.createdAt)
  );
  if (cards.length === 0) {
    return <p className="text-sm text-stone-400 py-12 text-center">No posts this month. Add one, or switch months above.</p>;
  }
  return (
    <div className="border border-stone-200 rounded-xl overflow-hidden bg-white overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr className="bg-stone-50 border-b border-stone-200 text-left text-xs text-stone-500">
            <th className="px-3 py-2 font-medium">Title</th>
            <th className="px-3 py-2 font-medium">Pillar</th>
            <th className="px-3 py-2 font-medium">Stage</th>
            <th className="px-3 py-2 font-medium hidden md:table-cell">Type</th>
            {multiPlatform && <th className="px-3 py-2 font-medium">Platform</th>}
            <th className="px-3 py-2 font-medium hidden md:table-cell">Live date</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(card => {
            const pillar = pillars.find(p => p.id === card.pillarId);
            const meta = stageMeta(card.stage);
            return (
              <tr key={card.id} onClick={() => onOpen(card)} className="border-b border-stone-100 last:border-0 hover:bg-stone-50 cursor-pointer">
                <td className="px-3 py-2 font-medium text-stone-900">{card.title || 'Untitled'}</td>
                <td className="px-3 py-2">
                  {pillar && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-stone-600">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: pillar.color }} />
                      {pillar.name}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className="text-[10px] font-medium rounded-full px-1.5 py-0.5" style={{ color: meta.color, backgroundColor: meta.bg }}>
                    {meta.label}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-stone-500 hidden md:table-cell">{card.contentType}</td>
                {multiPlatform && <td className="px-3 py-2 text-xs text-stone-500">{card.platform}</td>}
                <td className="px-3 py-2 text-xs text-stone-500 hidden md:table-cell">{card.scheduledDate ? formatDate(card.scheduledDate) : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Card editor ──────────────────────────────────────────────────────────────

function CardEditor({ card, pillars, customFields, platforms, sourceClientId, onClose, onSave, onDelete }: {
  card: ContentCard;
  pillars: ContentPillar[];
  customFields: CustomFieldDef[];
  platforms: string[];
  sourceClientId: string;
  onClose: () => void;
  onSave: (card: ContentCard) => void;
  onDelete?: () => void;
}) {
  const { state, role, dispatch } = useApp();
  const [draft, setDraft] = useState<ContentCard>({ ...card, link: card.link ?? '' });
  const [copied, setCopied] = useState(false);
  const [shareClientId, setShareClientId] = useState('');
  const [sharePillarId, setSharePillarId] = useState('');
  const multiPlatform = platforms.length > 1;

  const set = (patch: Partial<ContentCard>) => setDraft(d => ({ ...d, ...patch }));

  const liveCard = (state.clientData[sourceClientId]?.contentCards ?? []).find(c => c.id === card.id);
  const collabWith = liveCard?.collabWith ?? card.collabWith ?? [];

  const otherClients = state.clients
    .filter(c => c.id !== sourceClientId)
    .map(c => ({ id: c.id, name: c.name, pillars: state.clientData[c.id]?.pillars ?? [] }));
  const shareTarget = otherClients.find(c => c.id === shareClientId);

  function trimmed(): ContentCard {
    return { ...draft, title: draft.title.trim(), hook: draft.hook.trim(), link: draft.link?.trim(), postUrl: draft.postUrl.trim() };
  }

  function copyAll() {
    const text = formatForCopy(draft);
    if (text) navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }

  function sendToAccount() {
    if (!shareTarget || !sharePillarId) return;
    dispatch({
      type: 'SHARE_CONTENT_CARD',
      payload: { sourceClientId, sourceCard: trimmed(), targetClientId: shareTarget.id, targetPillarId: sharePillarId },
    });
    setShareClientId('');
    setSharePillarId('');
  }

  return (
    <Modal open onClose={onClose} title={onDelete ? 'Edit Post' : 'New Post'} size="lg">
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Pillar</label>
            <select value={draft.pillarId} onChange={e => set({ pillarId: e.target.value })} className="input-base w-full">
              <option value="">Unsorted</option>
              {pillars.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="min-w-[130px]">
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Stage</label>
            <select value={draft.stage} onChange={e => set({ stage: e.target.value as ContentStage })} className="input-base w-full">
              {CONTENT_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          {multiPlatform && (
            <div className="min-w-[130px]">
              <label className="block text-xs font-medium text-stone-500 mb-1.5">Platform</label>
              <select value={draft.platform ?? ''} onChange={e => set({ platform: e.target.value })} className="input-base w-full">
                {platforms.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Title / topic</label>
          <input autoFocus value={draft.title} onChange={e => set({ title: e.target.value })}
            placeholder="e.g. 3 resume mistakes that cost you interviews" className="input-base w-full" />
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Hook (first line)</label>
          <input value={draft.hook} onChange={e => set({ hook: e.target.value })}
            placeholder="The scroll-stopping opening line..." className="input-base w-full" />
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Content</label>
          <textarea value={draft.content} onChange={e => set({ content: e.target.value })}
            placeholder="Write the full post here — caption, script, or carousel copy."
            rows={8} className="input-base w-full resize-y font-mono text-[13px] leading-relaxed" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Reference link (doc, Canva, reel)</label>
            <input value={draft.link ?? ''} onChange={e => set({ link: e.target.value })}
              placeholder="Paste a link" className="input-base w-full" inputMode="url" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Live post link (after posting)</label>
            <input value={draft.postUrl} onChange={e => set({ postUrl: e.target.value })}
              placeholder="https://instagram.com/p/..." className="input-base w-full" inputMode="url" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Content type</label>
            <select value={draft.contentType} onChange={e => set({ contentType: e.target.value })} className="input-base w-full">
              <option value="">Select type</option>
              {Array.from(new Set([...DEFAULT_CONTENT_TYPES, draft.contentType])).filter(Boolean).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Go-live date</label>
            <input type="date" value={draft.scheduledDate} onChange={e => set({ scheduledDate: e.target.value })} className="input-base w-full" />
          </div>
        </div>

        {customFields.map(field => (
          <div key={field.id}>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">{field.name}</label>
            {field.type === 'single' ? (
              <select value={(draft.customValues[field.id] as string) ?? ''}
                onChange={e => set({ customValues: { ...draft.customValues, [field.id]: e.target.value } })} className="input-base w-full">
                <option value="">Select...</option>
                {field.options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <div className="flex flex-wrap gap-2">
                {field.options.map(o => {
                  const vals = (draft.customValues[field.id] as string[]) ?? [];
                  const sel = vals.includes(o);
                  return (
                    <button key={o} type="button"
                      onClick={() => set({ customValues: { ...draft.customValues, [field.id]: sel ? vals.filter(v => v !== o) : [...vals, o] } })}
                      className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${sel ? 'bg-accent text-white border-accent' : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'}`}>
                      {o}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Notes</label>
          <textarea value={draft.notes} onChange={e => set({ notes: e.target.value })}
            placeholder="Anything else..." rows={2} className="input-base w-full resize-none" />
        </div>

        {role === 'owner' && otherClients.length > 0 && (
          <div className="border-t border-stone-100 pt-4">
            <label className="flex items-center gap-1.5 text-xs font-medium text-stone-500 mb-2">
              <Share2 size={13} /> Collaborate — also post on another account
            </label>
            {collabWith.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {collabWith.map(p => (
                  <span key={p.clientId} className="inline-flex items-center gap-1 text-[11px] text-violet-700 bg-violet-50 rounded-full px-2 py-0.5">
                    <Users size={11} /> {p.clientName}
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-end gap-2">
              <select value={shareClientId}
                onChange={e => {
                  const id = e.target.value;
                  setShareClientId(id);
                  setSharePillarId(otherClients.find(c => c.id === id)?.pillars[0]?.id ?? '');
                }}
                className="input-base flex-1 min-w-[140px]">
                <option value="">Choose account…</option>
                {otherClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={sharePillarId} onChange={e => setSharePillarId(e.target.value)}
                disabled={!shareTarget || shareTarget.pillars.length === 0}
                className="input-base flex-1 min-w-[140px] disabled:opacity-50">
                <option value="">{shareTarget ? 'Choose bucket…' : 'Bucket'}</option>
                {shareTarget?.pillars.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button onClick={sendToAccount} disabled={!shareTarget || !sharePillarId}
                className="btn-secondary flex items-center gap-1.5 disabled:opacity-40">
                <Share2 size={14} /> Send
              </button>
            </div>
            {shareTarget && shareTarget.pillars.length === 0 && (
              <p className="text-[11px] text-amber-600 mt-1.5">{shareTarget.name} has no pillars yet. Add one on their board first.</p>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button onClick={copyAll} className="btn-secondary flex items-center gap-1.5">
            {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy for hand-off'}
          </button>
          {onDelete && (
            <button onClick={() => { if (confirm('Delete this post?')) onDelete(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 size={14} /> Delete
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button onClick={() => onSave(trimmed())} className="btn-primary">Save</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── Pillar add / rename / platforms ─────────────────────────────────────────

function AddPillarColumn({ onAdd }: { onAdd: (name: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  if (!adding) {
    return (
      <button onClick={() => setAdding(true)}
        className="w-full flex items-center justify-center gap-1.5 py-3 text-sm text-stone-400 hover:text-stone-700 hover:bg-stone-50 rounded-xl border border-dashed border-stone-300 transition-colors">
        <Plus size={15} /> Add pillar
      </button>
    );
  }
  return (
    <div className="bg-stone-50 border border-stone-200 rounded-xl p-2">
      <input autoFocus value={name} onChange={e => setName(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && name.trim()) { onAdd(name); setName(''); setAdding(false); }
          if (e.key === 'Escape') { setName(''); setAdding(false); }
        }}
        onBlur={() => { if (name.trim()) onAdd(name); setName(''); setAdding(false); }}
        placeholder="Pillar name" className="input-base w-full text-sm" />
    </div>
  );
}

function RenamePillarModal({ pillar, onClose, onSave }: {
  pillar: ContentPillar;
  onClose: () => void;
  onSave: (p: ContentPillar) => void;
}) {
  const [name, setName] = useState(pillar.name);
  const [color, setColor] = useState(pillar.color);
  const [target, setTarget] = useState(pillar.targetPct?.toString() ?? '');
  return (
    <Modal open onClose={onClose} title="Edit Pillar" size="sm">
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Name</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} className="input-base w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">
            Mix target % <span className="text-stone-400 font-normal">optional — the Journey tab measures against it</span>
          </label>
          <input type="number" min={0} max={100} value={target} onChange={e => setTarget(e.target.value)} placeholder="e.g. 40" className="input-base w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Colour</label>
          <div className="flex flex-wrap gap-2">
            {CLIENT_COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-stone-400 scale-110' : ''}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={() => name.trim() && onSave({ ...pillar, name: name.trim(), color, targetPct: target ? Number(target) : undefined })} disabled={!name.trim()} className="btn-primary">Save</button>
        </div>
      </div>
    </Modal>
  );
}

function PlatformsModal({ platforms, onClose, onSave }: {
  platforms: string[];
  onClose: () => void;
  onSave: (p: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>(platforms);
  function toggle(p: string) {
    setSelected(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  }
  return (
    <Modal open onClose={onClose} title="Platforms" size="sm">
      <div className="p-6 space-y-4">
        <p className="text-sm text-stone-500">
          Pick the platforms this account posts on. With more than one, every post gets a platform tag and filter.
        </p>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_PLATFORMS.map(p => (
            <button key={p} onClick={() => toggle(p)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                selected.includes(p) ? 'bg-[#1f1f1f] text-white border-[#1f1f1f]' : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
              }`}>
              {p}
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={() => onSave(selected)} className="btn-primary">Save</button>
        </div>
      </div>
    </Modal>
  );
}

// ── Empty state (pillars view) ───────────────────────────────────────────────

function PillarsEmptyState({ onAdd, onLoadPack }: { onAdd: (name: string) => void; onLoadPack?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center mb-4">
        <LayoutGrid size={24} className="text-stone-300" />
      </div>
      <p className="font-medium text-stone-600 mb-1">No content pillars yet</p>
      <p className="text-sm text-stone-400 mb-6 max-w-sm">
        Pillars are your content themes. Add posts under each, write once, and track them to live on the Board.
      </p>
      {onLoadPack && (
        <button onClick={onLoadPack} className="btn-primary flex items-center gap-2 mb-6">
          <Sparkles size={15} /> Load the ResumeGuru pack (4 pillars with mix targets + 3 platforms)
        </button>
      )}
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={14} className="text-accent" />
        <span className="text-xs font-medium text-stone-500 uppercase tracking-wide">Quick start</span>
      </div>
      <div className="flex flex-wrap justify-center gap-2 max-w-lg">
        {STARTER_PILLARS.map(name => (
          <button key={name} onClick={() => onAdd(name)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-stone-600 border border-stone-200 bg-white rounded-lg hover:border-stone-400 hover:text-stone-900 transition-colors">
            <Plus size={13} /> {name}
          </button>
        ))}
      </div>
    </div>
  );
}
