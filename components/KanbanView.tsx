'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  DndContext, DragEndEvent, DragStartEvent, DragOverlay,
  PointerSensor, useSensor, useSensors, useDroppable, useDraggable,
} from '@dnd-kit/core';
import {
  Plus, X, Pencil, Trash2, Settings2, ExternalLink, Link2,
  ChevronLeft, ChevronRight, GripVertical, ChevronDown,
} from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import { generateId, formatDate, formatMonthKey, formatMonthLabel, prevMonth, nextMonth } from '@/lib/utils';
import { KanbanCard, ColumnId, COLUMNS, CustomFieldDef, DEFAULT_CONTENT_TYPES, DEFAULT_CATEGORIES } from '@/types';
import Modal from './Modal';

const COLUMN_STYLES: Record<ColumnId, { dot: string; bg: string; border: string }> = {
  raw: { dot: 'bg-violet-400', bg: 'bg-violet-50', border: 'border-violet-100' },
  'in-progress': { dot: 'bg-amber-400', bg: 'bg-amber-50', border: 'border-amber-100' },
  done: { dot: 'bg-emerald-400', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  scheduled: { dot: 'bg-sky-400', bg: 'bg-sky-50', border: 'border-sky-100' },
};

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

export default function KanbanView({ clientId }: { clientId: string }) {
  const { dispatch } = useApp();
  const { data } = useClient(clientId);
  const router = useRouter();
  const searchParams = useSearchParams();
  const month = searchParams.get('month') ?? formatMonthKey(new Date());
  function setMonth(m: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('month', m);
    router.replace(`?${params.toString()}`);
  }
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [editCard, setEditCard] = useState<KanbanCard | null>(null);
  const [addColumn, setAddColumn] = useState<ColumnId | null>(null);
  const [fieldModalOpen, setFieldModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');

  const sensors = useSensors(useSensor(SmartPointerSensor, { activationConstraint: { distance: 6 } }));
  const activeCard = data.cards.find(c => c.id === activeCardId) ?? null;

  const visibleCards = data.cards.filter(c => {
    const matchMonth = !c.createdMonth || c.createdMonth === month;
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase());
    const matchType = !filterType || c.contentType === filterType;
    return matchMonth && matchSearch && matchType;
  });

  const allTypes = Array.from(new Set([...DEFAULT_CONTENT_TYPES, ...data.cards.map(c => c.contentType)])).filter(Boolean);

  function handleDragStart(e: DragStartEvent) { setActiveCardId(e.active.id as string); }

  function handleDragEnd(e: DragEndEvent) {
    setActiveCardId(null);
    if (!e.over) return;
    const cardId = e.active.id as string;
    const colId = e.over.id as ColumnId;
    if (COLUMNS.find(c => c.id === colId)) {
      dispatch({ type: 'MOVE_CARD', payload: { clientId, cardId, columnId: colId } });
    }
  }

  function moveCard(cardId: string, columnId: ColumnId) {
    dispatch({ type: 'MOVE_CARD', payload: { clientId, cardId, columnId } });
  }

  return (
    <div className="h-full flex flex-col">
      {/* Month nav */}
      <div className="px-4 md:px-6 pt-4 pb-2 bg-[#F7F7F5] flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-stone-400">Viewing</p>
          <p className="text-sm font-semibold text-stone-900">{formatMonthLabel(month)}</p>
        </div>
        <div className="flex items-center gap-1 bg-white border border-stone-200 rounded-lg p-0.5">
          <button onClick={() => setMonth(prevMonth(month))} className="p-1.5 rounded-md text-stone-500 hover:bg-stone-50 transition-colors"><ChevronLeft size={15} /></button>
          <button onClick={() => setMonth(formatMonthKey(new Date()))} className="px-2.5 py-1 text-xs text-stone-500 hover:text-stone-900 transition-colors">Today</button>
          <button onClick={() => setMonth(nextMonth(month))} className="p-1.5 rounded-md text-stone-500 hover:bg-stone-50 transition-colors"><ChevronRight size={15} /></button>
        </div>
        <p className="text-xs text-stone-400 hidden md:block">
          Cards are filtered by the selected month
        </p>
      </div>

      {/* Toolbar */}
      <div className="px-4 md:px-6 py-2.5 border-b border-stone-200 bg-white flex items-center gap-2 flex-wrap">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search..."
          className="px-3 py-1.5 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent w-36 md:w-48"
        />
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="px-3 py-1.5 text-sm border border-stone-200 rounded-lg text-stone-600 bg-white focus:outline-none">
          <option value="">All types</option>
          {allTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={() => setFieldModalOpen(true)}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm text-stone-500 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors">
          <Settings2 size={13} />
          <span className="hidden sm:inline">Custom Fields</span>
        </button>
      </div>

      {/* Board */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-x-auto p-4 md:p-6">
          <div className="flex gap-3 md:gap-4 min-w-max h-full">
            {COLUMNS.map(col => (
              <KanbanColumn
                key={col.id}
                columnId={col.id}
                label={col.label}
                cards={visibleCards.filter(c => c.columnId === col.id)}
                activeCardId={activeCardId}
                onAddCard={() => setAddColumn(col.id)}
                onEditCard={setEditCard}
                onDeleteCard={id => dispatch({ type: 'DELETE_CARD', payload: { clientId, cardId: id } })}
                onMoveCard={moveCard}
                style={COLUMN_STYLES[col.id]}
              />
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
          {activeCard && (
            <div className="bg-white border-2 border-accent rounded-xl shadow-2xl p-3 w-60 rotate-1 opacity-95">
              <p className="font-medium text-sm text-stone-900 truncate">{activeCard.name}</p>
              {activeCard.contentType && <p className="text-xs text-stone-400 mt-1">{activeCard.contentType}</p>}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Add Card Modal */}
      {addColumn && (
        <CardFormModal open onClose={() => setAddColumn(null)} columnId={addColumn}
          customFields={data.customFields}
          onSave={card => {
            dispatch({ type: 'ADD_CARD', payload: { clientId, card: { ...card, createdMonth: month } } });
            setAddColumn(null);
          }}
        />
      )}

      {editCard && (
        <CardFormModal key={editCard.id} open onClose={() => setEditCard(null)}
          columnId={editCard.columnId} existingCard={editCard}
          customFields={data.customFields}
          onSave={card => {
            dispatch({ type: 'UPDATE_CARD', payload: { clientId, card } });
            setEditCard(null);
          }}
        />
      )}

      <CustomFieldsModal
        open={fieldModalOpen} onClose={() => setFieldModalOpen(false)}
        fields={data.customFields}
        onAdd={field => dispatch({ type: 'ADD_FIELD', payload: { clientId, field } })}
        onUpdate={field => dispatch({ type: 'UPDATE_FIELD', payload: { clientId, field } })}
        onDelete={fieldId => dispatch({ type: 'DELETE_FIELD', payload: { clientId, fieldId } })}
      />
    </div>
  );
}

function KanbanColumn({ columnId, label, cards, activeCardId, onAddCard, onEditCard, onDeleteCard, onMoveCard, style }: {
  columnId: ColumnId; label: string; cards: KanbanCard[];
  activeCardId: string | null;
  onAddCard: () => void; onEditCard: (c: KanbanCard) => void;
  onDeleteCard: (id: string) => void; onMoveCard: (id: string, col: ColumnId) => void;
  style: { dot: string; bg: string; border: string };
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId });

  return (
    <div className="flex flex-col w-56 md:w-64 shrink-0">
      <div className={`flex items-center gap-2 px-3 py-2.5 rounded-t-xl border ${style.border} ${style.bg}`}>
        <span className={`w-2 h-2 rounded-full ${style.dot}`} />
        <span className="font-medium text-sm text-stone-800 flex-1 truncate">{label}</span>
        <span className="text-xs text-stone-500 bg-white px-1.5 py-0.5 rounded-full font-medium">{cards.length}</span>
      </div>
      <div ref={setNodeRef}
        className={`flex-1 min-h-[300px] rounded-b-xl border-x border-b border-stone-200 p-2 space-y-2 transition-colors ${isOver ? 'bg-accent-light border-accent/40' : 'bg-stone-50'}`}>
        {cards.map(card => (
          <DraggableCard key={card.id} card={card} isDraggingActive={activeCardId === card.id}
            onEdit={() => onEditCard(card)}
            onDelete={() => onDeleteCard(card.id)}
            onMove={(col) => onMoveCard(card.id, col)}
          />
        ))}
        <button onClick={onAddCard}
          className="w-full flex items-center gap-1.5 px-3 py-2 text-sm text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors">
          <Plus size={13} />
          Add idea
        </button>
      </div>
    </div>
  );
}

const TYPE_COLORS: Record<string, string> = {
  Static: 'bg-purple-100 text-purple-700',
  Carousel: 'bg-blue-100 text-blue-700',
  Reel: 'bg-pink-100 text-pink-700',
  Poster: 'bg-orange-100 text-orange-700',
  Banner: 'bg-yellow-100 text-yellow-700',
  PDF: 'bg-red-100 text-red-700',
  Presentation: 'bg-green-100 text-green-700',
};

function DraggableCard({ card, isDraggingActive, onEdit, onDelete, onMove }: {
  card: KanbanCard; isDraggingActive: boolean;
  onEdit: () => void; onDelete: () => void; onMove: (col: ColumnId) => void;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: card.id });
  const [showMove, setShowMove] = useState(false);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ touchAction: 'none', opacity: isDraggingActive ? 0.3 : 1 }}
      className="bg-white rounded-xl border border-stone-200 p-3 select-none cursor-grab active:cursor-grabbing hover:shadow-md hover:border-stone-300 transition-all group"
    >
      <div className="flex items-start gap-2">
        <GripVertical size={14} className="text-stone-300 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-stone-900 leading-snug">{card.name}</p>

          <div className="flex flex-wrap gap-1 mt-1.5">
            {card.contentType && (
              <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${TYPE_COLORS[card.contentType] ?? 'bg-stone-100 text-stone-600'}`}>
                {card.contentType}
              </span>
            )}
            {card.category && (
              <span className={`text-xs px-1.5 py-0.5 rounded-md ${card.category === 'Evergreen' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-600'}`}>
                {card.category}
              </span>
            )}
          </div>

          {card.date && (
            <p className="text-xs text-stone-400 mt-1.5">{formatDate(card.date)}</p>
          )}

          {card.notes && (
            <p className="text-xs text-stone-400 mt-1 line-clamp-2">{card.notes}</p>
          )}

          {card.postUrl && (
            <a
              href={card.postUrl} target="_blank" rel="noopener noreferrer"
              data-no-dnd="true"
              onPointerDown={e => e.stopPropagation()}
              className="flex items-center gap-1 mt-1.5 text-xs text-sky-500 hover:text-sky-700 truncate"
            >
              <Link2 size={10} />
              <span className="truncate">View post</span>
              <ExternalLink size={9} />
            </a>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div
        className="flex items-center gap-1 mt-2 pt-2 border-t border-stone-100 opacity-0 group-hover:opacity-100 transition-opacity"
        onPointerDown={e => e.stopPropagation()}
        data-no-dnd="true"
      >
        <button onClick={onEdit}
          className="flex items-center gap-1 px-2 py-0.5 text-xs text-stone-500 hover:text-stone-900 hover:bg-stone-50 rounded transition-colors">
          <Pencil size={11} /> Edit
        </button>

        {/* Move to dropdown */}
        <div className="relative">
          <button onClick={() => setShowMove(!showMove)}
            className="flex items-center gap-0.5 px-2 py-0.5 text-xs text-stone-500 hover:text-stone-900 hover:bg-stone-50 rounded transition-colors">
            Move <ChevronDown size={10} />
          </button>
          {showMove && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMove(false)} />
              <div className="absolute left-0 top-full mt-1 bg-white border border-stone-200 rounded-lg shadow-lg z-20 min-w-[140px]">
                {COLUMNS.filter(c => c.id !== card.columnId).map(c => (
                  <button key={c.id}
                    onClick={() => { onMove(c.id); setShowMove(false); }}
                    className="w-full text-left px-3 py-2 text-xs text-stone-700 hover:bg-stone-50 transition-colors first:rounded-t-lg last:rounded-b-lg">
                    → {c.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <button onClick={onDelete}
          className="flex items-center gap-1 px-2 py-0.5 text-xs text-stone-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors ml-auto">
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-stone-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function CardFormModal({ open, onClose, columnId, existingCard, customFields, onSave }: {
  open: boolean; onClose: () => void; columnId: ColumnId;
  existingCard?: KanbanCard; customFields: CustomFieldDef[];
  onSave: (card: KanbanCard) => void;
}) {
  const isEdit = !!existingCard;
  const [name, setName] = useState(existingCard?.name ?? '');
  const [date, setDate] = useState(existingCard?.date ?? '');
  const [contentType, setContentType] = useState(existingCard?.contentType ?? '');
  const [customType, setCustomType] = useState('');
  const [category, setCategory] = useState(existingCard?.category ?? '');
  const [customCategory, setCustomCategory] = useState('');
  const [notes, setNotes] = useState(existingCard?.notes ?? '');
  const [scheduledDate, setScheduledDate] = useState(existingCard?.scheduledDate ?? '');
  const [postUrl, setPostUrl] = useState(existingCard?.postUrl ?? '');
  const [customValues, setCustomValues] = useState<Record<string, string | string[]>>(existingCard?.customValues ?? {});

  function save() {
    if (!name.trim()) return;
    const card: KanbanCard = {
      id: existingCard?.id ?? generateId(),
      columnId: existingCard?.columnId ?? columnId,
      name: name.trim(),
      date, notes, scheduledDate,
      postUrl: postUrl.trim(),
      contentType: contentType === '__custom__' ? customType.trim() : contentType,
      category: category === '__custom__' ? customCategory.trim() : category,
      customValues,
      createdMonth: existingCard?.createdMonth ?? '',
      createdAt: existingCard?.createdAt ?? new Date().toISOString(),
    };
    onSave(card);
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Card' : 'New Idea'} size="md">
      <div className="p-5 space-y-4">
        <Field label="Name *">
          <input autoFocus value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
            placeholder="Idea name..." className="input-base" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-base" />
          </Field>
          <Field label="Scheduled / Posted Date">
            <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className="input-base" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Content Type">
            <select value={contentType} onChange={e => setContentType(e.target.value)} className="input-base">
              <option value="">Select type</option>
              {DEFAULT_CONTENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              <option value="__custom__">+ Custom type...</option>
            </select>
            {contentType === '__custom__' && (
              <input value={customType} onChange={e => setCustomType(e.target.value)}
                placeholder="Enter type name" className="input-base mt-2" />
            )}
          </Field>
          <Field label="Category">
            <select value={category} onChange={e => setCategory(e.target.value)} className="input-base">
              <option value="">Select category</option>
              {DEFAULT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="__custom__">+ Custom...</option>
            </select>
            {category === '__custom__' && (
              <input value={customCategory} onChange={e => setCustomCategory(e.target.value)}
                placeholder="Category name" className="input-base mt-2" />
            )}
          </Field>
        </div>

        {/* Post link */}
        <Field label="Post Link (URL to final content)">
          <div className="flex items-center gap-2 border border-stone-200 rounded-lg px-3 focus-within:ring-2 focus-within:ring-accent/30 focus-within:border-accent transition-colors">
            <Link2 size={14} className="text-stone-400 shrink-0" />
            <input
              value={postUrl} onChange={e => setPostUrl(e.target.value)}
              placeholder="https://drive.google.com/... or any link"
              className="flex-1 py-2 text-sm bg-transparent focus:outline-none text-stone-700 placeholder-stone-400"
            />
          </div>
        </Field>

        {customFields.map(field => (
          <Field key={field.id} label={field.name}>
            {field.type === 'single' ? (
              <select value={(customValues[field.id] as string) ?? ''} onChange={e => setCustomValues(p => ({ ...p, [field.id]: e.target.value }))} className="input-base">
                <option value="">Select...</option>
                {field.options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <div className="flex flex-wrap gap-2">
                {field.options.map(o => {
                  const vals = (customValues[field.id] as string[]) ?? [];
                  const sel = vals.includes(o);
                  return (
                    <button key={o} type="button"
                      onClick={() => setCustomValues(p => ({ ...p, [field.id]: sel ? vals.filter(v => v !== o) : [...vals, o] }))}
                      className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${sel ? 'bg-accent text-white border-accent' : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'}`}>
                      {o}
                    </button>
                  );
                })}
              </div>
            )}
          </Field>
        ))}

        <Field label="Notes">
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Any notes..." rows={3} className="input-base resize-none" />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={!name.trim()} className="btn-primary">{isEdit ? 'Save Changes' : 'Add Idea'}</button>
        </div>
      </div>
    </Modal>
  );
}

function CustomFieldsModal({ open, onClose, fields, onAdd, onUpdate, onDelete }: {
  open: boolean; onClose: () => void; fields: CustomFieldDef[];
  onAdd: (f: CustomFieldDef) => void; onUpdate: (f: CustomFieldDef) => void; onDelete: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'single' | 'multi'>('single');
  const [optionInput, setOptionInput] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [editId, setEditId] = useState<string | null>(null);

  function reset() { setName(''); setType('single'); setOptions([]); setOptionInput(''); setEditId(null); }

  function addOption() {
    const o = optionInput.trim();
    if (o && !options.includes(o)) { setOptions(p => [...p, o]); setOptionInput(''); }
  }

  function save() {
    if (!name.trim() || options.length === 0) return;
    if (editId) onUpdate({ id: editId, name: name.trim(), type, options });
    else onAdd({ id: generateId(), name: name.trim(), type, options });
    reset();
  }

  return (
    <Modal open={open} onClose={onClose} title="Custom Fields" size="md">
      <div className="p-5 space-y-5">
        {fields.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide">Existing Fields</p>
            {fields.map(f => (
              <div key={f.id} className="flex items-center gap-3 p-3 border border-stone-200 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-900">{f.name}</p>
                  <p className="text-xs text-stone-400">{f.type === 'single' ? 'Single' : 'Multi'} · {f.options.join(', ')}</p>
                </div>
                <button onClick={() => { setEditId(f.id); setName(f.name); setType(f.type); setOptions(f.options); }} className="p-1.5 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-100"><Pencil size={13} /></button>
                <button onClick={() => onDelete(f.id)} className="p-1.5 rounded text-stone-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        )}
        <div className="border border-stone-200 rounded-xl p-4 space-y-3">
          <p className="text-xs font-medium text-stone-500">{editId ? 'Edit Field' : 'New Field'}</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name"><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Platform" className="input-base" /></Field>
            <Field label="Type">
              <select value={type} onChange={e => setType(e.target.value as 'single' | 'multi')} className="input-base">
                <option value="single">Single select</option>
                <option value="multi">Multi select</option>
              </select>
            </Field>
          </div>
          <Field label="Options">
            <div className="flex gap-2">
              <input value={optionInput} onChange={e => setOptionInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addOption()}
                placeholder="Add option, press Enter" className="input-base flex-1" />
              <button onClick={addOption} className="btn-secondary shrink-0">Add</button>
            </div>
            {options.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {options.map(o => (
                  <span key={o} className="flex items-center gap-1 px-2 py-0.5 bg-stone-100 text-stone-700 text-xs rounded-full">
                    {o}
                    <button onClick={() => setOptions(p => p.filter(x => x !== o))} className="text-stone-400 hover:text-red-500"><X size={10} /></button>
                  </span>
                ))}
              </div>
            )}
          </Field>
          <div className="flex justify-end gap-2">
            {editId && <button onClick={reset} className="btn-secondary">Cancel</button>}
            <button onClick={save} disabled={!name.trim() || options.length === 0} className="btn-primary">{editId ? 'Update' : 'Create Field'}</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
