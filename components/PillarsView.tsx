'use client';

import { useState } from 'react';
import {
  Plus, Trash2, Pencil, Copy, Check, Columns3, Table2, LayoutGrid,
  MoreHorizontal, Sparkles,
} from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import { generateId, CLIENT_COLORS } from '@/lib/utils';
import { ContentPillar, PillarCard, PillarCardStatus, PILLAR_CARD_STATUSES } from '@/types';
import Modal from './Modal';

// Starter pillars offered when a client has none yet — one click to seed.
const STARTER_PILLARS = ['Educational', 'Founder story', 'Client wins / Trust', 'Community', 'Behind the scenes', 'Promotional'];

function statusMeta(id: PillarCardStatus) {
  return PILLAR_CARD_STATUSES.find(s => s.id === id) ?? PILLAR_CARD_STATUSES[0];
}

/** The block copied for hand-off: content is the star, title/hook lead it. */
function formatForCopy(card: PillarCard): string {
  const parts = [];
  if (card.title.trim()) parts.push(card.title.trim());
  if (card.hook.trim()) parts.push(card.hook.trim());
  const head = parts.join('\n');
  if (card.content.trim()) return head ? `${head}\n\n${card.content.trim()}` : card.content.trim();
  return head;
}

export default function PillarsView({ clientId }: { clientId: string }) {
  const { dispatch } = useApp();
  const { data } = useClient(clientId);
  const [view, setView] = useState<'board' | 'table'>('board');
  const [editingCard, setEditingCard] = useState<PillarCard | null>(null);
  const [renamingPillar, setRenamingPillar] = useState<ContentPillar | null>(null);

  const pillars = data.pillars ?? [];
  const cards = data.pillarCards ?? [];

  function addPillar(name: string) {
    const color = CLIENT_COLORS[pillars.length % CLIENT_COLORS.length];
    dispatch({
      type: 'ADD_PILLAR',
      payload: { clientId, pillar: { id: generateId(), name: name.trim(), color, createdAt: new Date().toISOString() } },
    });
  }

  function newCard(pillarId: string) {
    const now = new Date().toISOString();
    setEditingCard({ id: generateId(), pillarId, title: '', hook: '', content: '', status: 'idea', createdAt: now, updatedAt: now });
  }

  function saveCard(card: PillarCard) {
    const exists = cards.some(c => c.id === card.id);
    dispatch({
      type: exists ? 'UPDATE_PILLAR_CARD' : 'ADD_PILLAR_CARD',
      payload: { clientId, card: { ...card, updatedAt: new Date().toISOString() } },
    });
    setEditingCard(null);
  }

  function deleteCard(cardId: string) {
    dispatch({ type: 'DELETE_PILLAR_CARD', payload: { clientId, cardId } });
    setEditingCard(null);
  }

  function setCardStatus(card: PillarCard, status: PillarCardStatus) {
    dispatch({ type: 'UPDATE_PILLAR_CARD', payload: { clientId, card: { ...card, status, updatedAt: new Date().toISOString() } } });
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header: view toggle + add pillar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div>
          <h2 className="text-lg font-bold text-stone-900">Content Pillars</h2>
          <p className="text-sm text-stone-400">Themes as columns, topics as cards. Write once, hand off to anyone.</p>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <div className="flex items-center gap-0.5 border border-stone-200 bg-white rounded-lg p-0.5">
            <ViewBtn active={view === 'board'} onClick={() => setView('board')} icon={<LayoutGrid size={14} />} label="Board" />
            <ViewBtn active={view === 'table'} onClick={() => setView('table')} icon={<Table2 size={14} />} label="Table" />
          </div>
          {pillars.length > 0 && <AddPillarButton onAdd={addPillar} />}
        </div>
      </div>

      {pillars.length === 0 ? (
        <EmptyState onAdd={addPillar} />
      ) : view === 'board' ? (
        <BoardView
          pillars={pillars}
          cards={cards}
          onAddCard={newCard}
          onOpenCard={setEditingCard}
          onStatus={setCardStatus}
          onRenamePillar={setRenamingPillar}
          onDeletePillar={id => {
            if (confirm('Delete this pillar and all its topic cards?')) dispatch({ type: 'DELETE_PILLAR', payload: { clientId, pillarId: id } });
          }}
          onAddPillar={addPillar}
        />
      ) : (
        <TableView pillars={pillars} cards={cards} onOpenCard={setEditingCard} onStatus={setCardStatus} />
      )}

      {editingCard && (
        <CardEditor
          card={editingCard}
          pillars={pillars}
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

// ── Board view ───────────────────────────────────────────────────────────────

function BoardView({ pillars, cards, onAddCard, onOpenCard, onStatus, onRenamePillar, onDeletePillar, onAddPillar }: {
  pillars: ContentPillar[];
  cards: PillarCard[];
  onAddCard: (pillarId: string) => void;
  onOpenCard: (card: PillarCard) => void;
  onStatus: (card: PillarCard, s: PillarCardStatus) => void;
  onRenamePillar: (p: ContentPillar) => void;
  onDeletePillar: (id: string) => void;
  onAddPillar: (name: string) => void;
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 items-start">
      {pillars.map(pillar => {
        const pillarCards = cards.filter(c => c.pillarId === pillar.id);
        return (
          <div key={pillar.id} className="w-72 shrink-0 bg-stone-50 border border-stone-200 rounded-xl flex flex-col max-h-[calc(100vh-220px)]">
            {/* Column header */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-stone-200">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: pillar.color }} />
              <h3 className="text-sm font-semibold text-stone-800 truncate flex-1">{pillar.name}</h3>
              <span className="text-[11px] text-stone-400 tabular-nums">{pillarCards.length}</span>
              <PillarMenu onRename={() => onRenamePillar(pillar)} onDelete={() => onDeletePillar(pillar.id)} />
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {pillarCards.map(card => (
                <TopicCard key={card.id} card={card} onOpen={() => onOpenCard(card)} onStatus={s => onStatus(card, s)} />
              ))}
              <button
                onClick={() => onAddCard(pillar.id)}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-stone-500 hover:text-stone-900 hover:bg-white rounded-lg border border-dashed border-stone-300 transition-colors"
              >
                <Plus size={13} /> Add topic
              </button>
            </div>
          </div>
        );
      })}

      {/* Add pillar column */}
      <div className="w-72 shrink-0">
        <AddPillarColumn onAdd={onAddPillar} />
      </div>
    </div>
  );
}

function TopicCard({ card, onOpen, onStatus }: {
  card: PillarCard;
  onOpen: () => void;
  onStatus: (s: PillarCardStatus) => void;
}) {
  const [copied, setCopied] = useState(false);
  const meta = statusMeta(card.status);

  function copy(e: React.MouseEvent) {
    e.stopPropagation();
    const text = formatForCopy(card);
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function cycleStatus(e: React.MouseEvent) {
    e.stopPropagation();
    const i = PILLAR_CARD_STATUSES.findIndex(s => s.id === card.status);
    onStatus(PILLAR_CARD_STATUSES[(i + 1) % PILLAR_CARD_STATUSES.length].id);
  }

  return (
    <div
      onClick={onOpen}
      className="group bg-white border border-stone-200 rounded-lg p-2.5 cursor-pointer hover:shadow-sm hover:border-stone-300 transition-all"
    >
      <p className="text-sm font-medium text-stone-900 leading-snug line-clamp-2">{card.title || 'Untitled topic'}</p>
      {card.hook && <p className="text-xs text-stone-500 mt-1 line-clamp-2">{card.hook}</p>}
      <div className="flex items-center gap-1 mt-2">
        <button
          onClick={cycleStatus}
          className="text-[10px] font-medium rounded-full px-1.5 py-0.5"
          style={{ color: meta.color, backgroundColor: meta.bg }}
          title="Click to change status"
        >
          {meta.label}
        </button>
        {card.content.trim() && <span className="text-[10px] text-stone-300">•</span>}
        {card.content.trim() && <span className="text-[10px] text-stone-400">content ready</span>}
        <button
          onClick={copy}
          className={`ml-auto p-1 rounded transition-colors ${copied ? 'text-emerald-600' : 'text-stone-400 hover:text-stone-700 opacity-0 group-hover:opacity-100'}`}
          title="Copy for hand-off"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
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

function TableView({ pillars, cards, onOpenCard, onStatus }: {
  pillars: ContentPillar[];
  cards: PillarCard[];
  onOpenCard: (card: PillarCard) => void;
  onStatus: (card: PillarCard, s: PillarCardStatus) => void;
}) {
  const pillarById = (id: string) => pillars.find(p => p.id === id);
  const sorted = [...cards].sort((a, b) => a.pillarId.localeCompare(b.pillarId) || a.createdAt.localeCompare(b.createdAt));

  if (cards.length === 0) {
    return <p className="text-sm text-stone-400 py-12 text-center">No topics yet. Switch to Board view and add some.</p>;
  }

  return (
    <div className="border border-stone-200 rounded-xl overflow-hidden bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-stone-50 border-b border-stone-200 text-left text-xs text-stone-500">
            <th className="px-3 py-2 font-medium">Pillar</th>
            <th className="px-3 py-2 font-medium">Title</th>
            <th className="px-3 py-2 font-medium hidden md:table-cell">Hook</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium w-10"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(card => {
            const pillar = pillarById(card.pillarId);
            const meta = statusMeta(card.status);
            return (
              <tr key={card.id} onClick={() => onOpenCard(card)} className="border-b border-stone-100 last:border-0 hover:bg-stone-50 cursor-pointer">
                <td className="px-3 py-2">
                  {pillar && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-stone-600">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: pillar.color }} />
                      {pillar.name}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 font-medium text-stone-900">{card.title || 'Untitled topic'}</td>
                <td className="px-3 py-2 text-stone-500 hidden md:table-cell max-w-xs truncate">{card.hook}</td>
                <td className="px-3 py-2">
                  <span className="text-[10px] font-medium rounded-full px-1.5 py-0.5" style={{ color: meta.color, backgroundColor: meta.bg }}>
                    {meta.label}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <CopyIconButton card={card} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CopyIconButton({ card }: { card: PillarCard }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={e => {
        e.stopPropagation();
        const text = formatForCopy(card);
        if (text) navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
      }}
      className={`p-1 rounded transition-colors ${copied ? 'text-emerald-600' : 'text-stone-400 hover:text-stone-700'}`}
      title="Copy for hand-off"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

// ── Card editor ──────────────────────────────────────────────────────────────

function CardEditor({ card, pillars, onClose, onSave, onDelete }: {
  card: PillarCard;
  pillars: ContentPillar[];
  onClose: () => void;
  onSave: (card: PillarCard) => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(card.title);
  const [hook, setHook] = useState(card.hook);
  const [content, setContent] = useState(card.content);
  const [status, setStatus] = useState<PillarCardStatus>(card.status);
  const [pillarId, setPillarId] = useState(card.pillarId);
  const [copied, setCopied] = useState(false);

  function save() {
    onSave({ ...card, title: title.trim(), hook: hook.trim(), content, status, pillarId });
  }

  function copyAll() {
    const text = formatForCopy({ ...card, title, hook, content });
    if (text) navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }

  return (
    <Modal open onClose={onClose} title={card.title ? 'Edit Topic' : 'New Topic'} size="lg">
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Pillar</label>
            <select value={pillarId} onChange={e => setPillarId(e.target.value)} className="input-base w-full">
              {pillars.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="min-w-[140px]">
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as PillarCardStatus)} className="input-base w-full">
              {PILLAR_CARD_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Title / topic</label>
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. 3 resume mistakes that cost you interviews"
            className="input-base w-full"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Hook (first line)</label>
          <input
            value={hook}
            onChange={e => setHook(e.target.value)}
            placeholder="The scroll-stopping opening line..."
            className="input-base w-full"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Content</label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Write the full post here — caption, script, or carousel copy. Whoever produces it just copies this out."
            rows={10}
            className="input-base w-full resize-y font-mono text-[13px] leading-relaxed"
          />
        </div>

        <div className="flex items-center gap-2">
          <button onClick={copyAll} className="btn-secondary flex items-center gap-1.5">
            {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy for hand-off'}
          </button>
          {onDelete && (
            <button
              onClick={() => { if (confirm('Delete this topic?')) onDelete(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button onClick={save} className="btn-primary">Save</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── Pillar add / rename ──────────────────────────────────────────────────────

function AddPillarButton({ onAdd }: { onAdd: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary flex items-center gap-1.5">
        <Plus size={15} /> Pillar
      </button>
      {open && (
        <Modal open onClose={() => { setOpen(false); setName(''); }} title="New Pillar" size="sm">
          <div className="p-6 space-y-4">
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { onAdd(name); setName(''); setOpen(false); } }}
              placeholder="e.g. Founder story"
              className="input-base w-full"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setOpen(false); setName(''); }} className="btn-secondary">Cancel</button>
              <button onClick={() => { if (name.trim()) { onAdd(name); setName(''); setOpen(false); } }} disabled={!name.trim()} className="btn-primary">Add</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function AddPillarColumn({ onAdd }: { onAdd: (name: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  if (!adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        className="w-full flex items-center justify-center gap-1.5 py-3 text-sm text-stone-400 hover:text-stone-700 hover:bg-stone-50 rounded-xl border border-dashed border-stone-300 transition-colors"
      >
        <Plus size={15} /> Add pillar
      </button>
    );
  }
  return (
    <div className="bg-stone-50 border border-stone-200 rounded-xl p-2">
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && name.trim()) { onAdd(name); setName(''); setAdding(false); }
          if (e.key === 'Escape') { setName(''); setAdding(false); }
        }}
        onBlur={() => { if (name.trim()) onAdd(name); setName(''); setAdding(false); }}
        placeholder="Pillar name"
        className="input-base w-full text-sm"
      />
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
  return (
    <Modal open onClose={onClose} title="Edit Pillar" size="sm">
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Name</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} className="input-base w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Colour</label>
          <div className="flex flex-wrap gap-2">
            {CLIENT_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-stone-400 scale-110' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={() => name.trim() && onSave({ ...pillar, name: name.trim(), color })} disabled={!name.trim()} className="btn-primary">Save</button>
        </div>
      </div>
    </Modal>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: (name: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center mb-4">
        <Columns3 size={24} className="text-stone-300" />
      </div>
      <p className="font-medium text-stone-600 mb-1">No content pillars yet</p>
      <p className="text-sm text-stone-400 mb-6 max-w-sm">
        Pillars are your content themes. Add topics under each, write the full post once, and hand it off ready to publish.
      </p>
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={14} className="text-accent" />
        <span className="text-xs font-medium text-stone-500 uppercase tracking-wide">Quick start</span>
      </div>
      <div className="flex flex-wrap justify-center gap-2 max-w-lg">
        {STARTER_PILLARS.map(name => (
          <button
            key={name}
            onClick={() => onAdd(name)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-stone-600 border border-stone-200 bg-white rounded-lg hover:border-stone-400 hover:text-stone-900 transition-colors"
          >
            <Plus size={13} /> {name}
          </button>
        ))}
      </div>
    </div>
  );
}
