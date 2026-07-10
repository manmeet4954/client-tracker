'use client';

import { useState } from 'react';
import { Plus, Trash2, Pencil, Link2, MoreHorizontal, ListTodo, X, ChevronRight } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import { generateId } from '@/lib/utils';
import { TrackList, ListRow, ListStage } from '@/types';
import Modal from './Modal';

// Lists ARE pipelines: each list defines its own stages, rows move through
// them. One feature, endless uses — collaborators, colleges, workshops,
// locations. The stage columns answer "what's done, scheduled, pending".

const STAGE_PRESETS: { name: string; stages: string[] }[] = [
  { name: 'Outreach', stages: ['Not contacted', 'Reached out', 'Agreed', 'Scheduled', 'Conducted'] },
  { name: 'Simple', stages: ['To do', 'Doing', 'Done'] },
  { name: 'Shortlist', stages: ['Ideas', 'Shortlisted', 'Final'] },
];

const STAGE_COLORS = ['#a8a29e', '#7c3aed', '#d97706', '#0284c7', '#059669', '#dc2626', '#0891b2'];

function toHref(link: string): string {
  return /^https?:\/\//i.test(link) ? link : `https://${link}`;
}

export default function ListsView({ clientId }: { clientId: string }) {
  const { dispatch } = useApp();
  const { data } = useClient(clientId);
  const lists = data.lists ?? [];
  const rows = data.listRows ?? [];

  const [activeId, setActiveId] = useState<string | null>(lists[0]?.id ?? null);
  const [creating, setCreating] = useState(false);
  const [editingList, setEditingList] = useState<TrackList | null>(null);
  const [editingRow, setEditingRow] = useState<ListRow | null>(null);

  const active = lists.find(l => l.id === activeId) ?? lists[0] ?? null;
  const activeRows = active ? rows.filter(r => r.listId === active.id) : [];

  function createList(list: TrackList) {
    dispatch({ type: 'ADD_LIST', payload: { clientId, list } });
    setActiveId(list.id);
    setCreating(false);
  }

  function saveRow(row: ListRow) {
    const exists = rows.some(r => r.id === row.id);
    dispatch({
      type: exists ? 'UPDATE_LIST_ROW' : 'ADD_LIST_ROW',
      payload: { clientId, row: { ...row, updatedAt: new Date().toISOString() } },
    });
    setEditingRow(null);
  }

  function moveRow(row: ListRow, stageId: string) {
    dispatch({ type: 'UPDATE_LIST_ROW', payload: { clientId, row: { ...row, stageId, updatedAt: new Date().toISOString() } } });
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div>
          <h2 className="text-lg font-bold text-stone-900">Lists</h2>
          <p className="text-sm text-stone-400">Every list is a pipeline. Name it, set its stages, move things through.</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary flex items-center gap-1.5 ml-auto">
          <Plus size={15} /> List
        </button>
      </div>

      {lists.length === 0 ? (
        <EmptyState onCreate={() => setCreating(true)} />
      ) : (
        <>
          {/* List switcher */}
          <div className="flex items-center gap-1.5 mb-5 flex-wrap">
            {lists.map(l => (
              <button key={l.id} onClick={() => setActiveId(l.id)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  active?.id === l.id ? 'bg-[#1f1f1f] text-white border-[#1f1f1f]' : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
                }`}>
                {l.name}
                <span className="ml-1.5 text-[11px] opacity-60">{rows.filter(r => r.listId === l.id).length}</span>
              </button>
            ))}
            {active && (
              <button onClick={() => setEditingList(active)} className="p-1.5 rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-colors" title="Edit list & stages">
                <Pencil size={14} />
              </button>
            )}
          </div>

          {/* Pipeline board */}
          {active && (
            <div className="flex gap-4 overflow-x-auto pb-4 items-start">
              {active.stages.map((stage, i) => {
                const stageRows = activeRows.filter(r => r.stageId === stage.id);
                const color = STAGE_COLORS[i % STAGE_COLORS.length];
                return (
                  <div key={stage.id} className="w-64 shrink-0 bg-stone-50 border border-stone-200 rounded-xl flex flex-col max-h-[calc(100vh-280px)]">
                    <div className="flex items-center gap-2 px-3 py-2.5 border-b border-stone-200">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <h3 className="text-sm font-semibold text-stone-800 truncate flex-1">{stage.name}</h3>
                      <span className="text-[11px] text-stone-400 tabular-nums">{stageRows.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                      {stageRows.map(row => (
                        <RowCard key={row.id} row={row} list={active}
                          onOpen={() => setEditingRow(row)}
                          onMove={sid => moveRow(row, sid)}
                        />
                      ))}
                      <button
                        onClick={() => {
                          const now = new Date().toISOString();
                          setEditingRow({ id: generateId(), listId: active.id, stageId: stage.id, name: '', link: '', note: '', createdAt: now, updatedAt: now });
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-stone-500 hover:text-stone-900 hover:bg-white rounded-lg border border-dashed border-stone-300 transition-colors">
                        <Plus size={13} /> Add
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {creating && <ListModal onClose={() => setCreating(false)} onSave={createList} />}

      {editingList && (
        <ListModal
          existing={editingList}
          onClose={() => setEditingList(null)}
          onSave={list => { dispatch({ type: 'UPDATE_LIST', payload: { clientId, list } }); setEditingList(null); }}
          onDelete={() => {
            if (confirm('Delete this list and everything in it?')) {
              dispatch({ type: 'DELETE_LIST', payload: { clientId, listId: editingList.id } });
              setEditingList(null);
              setActiveId(null);
            }
          }}
        />
      )}

      {editingRow && active && (
        <RowModal
          row={editingRow}
          list={active}
          isNew={!rows.some(r => r.id === editingRow.id)}
          onClose={() => setEditingRow(null)}
          onSave={saveRow}
          onDelete={() => { dispatch({ type: 'DELETE_LIST_ROW', payload: { clientId, rowId: editingRow.id } }); setEditingRow(null); }}
        />
      )}
    </div>
  );
}

// ── Row card ─────────────────────────────────────────────────────────────────

function RowCard({ row, list, onOpen, onMove }: {
  row: ListRow;
  list: TrackList;
  onOpen: () => void;
  onMove: (stageId: string) => void;
}) {
  const [menu, setMenu] = useState(false);
  return (
    <div onClick={onOpen} className="group bg-white border border-stone-200 rounded-lg p-2.5 cursor-pointer hover:shadow-sm hover:border-stone-300 transition-all">
      <div className="flex items-start gap-2">
        <p className="text-sm font-medium text-stone-900 leading-snug flex-1">{row.name || 'Unnamed'}</p>
        <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={() => setMenu(m => !m)} className="p-0.5 rounded text-stone-300 hover:text-stone-700 opacity-0 group-hover:opacity-100 transition-opacity">
            <MoreHorizontal size={14} />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="absolute right-0 top-5 z-20 w-40 bg-white border border-stone-200 rounded-lg shadow-lg py-1">
                {list.stages.filter(s => s.id !== row.stageId).map(s => (
                  <button key={s.id} onClick={() => { onMove(s.id); setMenu(false); }}
                    className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50 text-left">
                    <ChevronRight size={11} /> {s.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      {row.link?.trim() && (
        <a href={toHref(row.link.trim())} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
          className="inline-flex items-center gap-1 mt-1 max-w-full text-[11px] text-sky-600 hover:underline">
          <Link2 size={11} className="shrink-0" />
          <span className="truncate">{row.link.trim().replace(/^https?:\/\/(www\.)?/i, '')}</span>
        </a>
      )}
      {row.note?.trim() && <p className="text-xs text-stone-400 mt-1 line-clamp-2">{row.note}</p>}
    </div>
  );
}

// ── List create / edit ───────────────────────────────────────────────────────

function ListModal({ existing, onClose, onSave, onDelete }: {
  existing?: TrackList;
  onClose: () => void;
  onSave: (l: TrackList) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [stages, setStages] = useState<ListStage[]>(existing?.stages ?? []);
  const [stageInput, setStageInput] = useState('');

  function addStage() {
    const s = stageInput.trim();
    if (!s) return;
    setStages(p => [...p, { id: generateId(), name: s }]);
    setStageInput('');
  }

  function applyPreset(names: string[]) {
    setStages(names.map(n => ({ id: generateId(), name: n })));
  }

  const canSave = name.trim() && stages.length > 0;

  return (
    <Modal open onClose={onClose} title={existing ? 'Edit List' : 'New List'} size="md">
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Name</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. Colleges & workshops, Collaborators" className="input-base w-full" />
        </div>

        {!existing && stages.length === 0 && (
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Start from a preset</label>
            <div className="flex flex-wrap gap-2">
              {STAGE_PRESETS.map(p => (
                <button key={p.name} onClick={() => applyPreset(p.stages)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-stone-200 bg-white text-stone-600 hover:border-stone-400 transition-colors"
                  title={p.stages.join(' → ')}>
                  {p.name} <span className="text-stone-400">({p.stages.length})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Stages, in order</label>
          {stages.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {stages.map((s, i) => (
                <span key={s.id} className="flex items-center gap-1 px-2 py-1 bg-stone-100 text-stone-700 text-xs rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STAGE_COLORS[i % STAGE_COLORS.length] }} />
                  {s.name}
                  <button onClick={() => setStages(p => p.filter(x => x.id !== s.id))} className="text-stone-400 hover:text-red-500"><X size={10} /></button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input value={stageInput} onChange={e => setStageInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addStage()}
              placeholder="Add stage, press Enter" className="input-base flex-1" />
            <button onClick={addStage} className="btn-secondary shrink-0">Add</button>
          </div>
          {existing && <p className="text-[11px] text-stone-400 mt-1.5">Removing a stage hides its rows until they are moved. Add the stage back to see them again.</p>}
        </div>

        <div className="flex items-center gap-2">
          {onDelete && (
            <button onClick={onDelete} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 size={14} /> Delete list
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button
              onClick={() => canSave && onSave({ id: existing?.id ?? generateId(), name: name.trim(), stages, createdAt: existing?.createdAt ?? new Date().toISOString() })}
              disabled={!canSave} className="btn-primary disabled:opacity-40">
              Save
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── Row modal ────────────────────────────────────────────────────────────────

function RowModal({ row, list, isNew, onClose, onSave, onDelete }: {
  row: ListRow;
  list: TrackList;
  isNew: boolean;
  onClose: () => void;
  onSave: (r: ListRow) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(row.name);
  const [link, setLink] = useState(row.link ?? '');
  const [note, setNote] = useState(row.note ?? '');
  const [stageId, setStageId] = useState(row.stageId);

  return (
    <Modal open onClose={onClose} title={isNew ? 'Add to list' : 'Edit entry'} size="md">
      <div className="p-6 space-y-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Name</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)}
              placeholder="Person, college, place..." className="input-base w-full" />
          </div>
          <div className="min-w-[150px]">
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Stage</label>
            <select value={stageId} onChange={e => setStageId(e.target.value)} className="input-base w-full">
              {list.stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Link or contact</label>
          <input value={link} onChange={e => setLink(e.target.value)}
            placeholder="Profile, website, phone..." className="input-base w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Note</label>
          <textarea value={note} onChange={e => setNote(e.target.value)}
            placeholder="Anything worth remembering..." rows={3} className="input-base w-full resize-none" />
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <button onClick={() => { if (confirm('Delete this entry?')) onDelete(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 size={14} /> Delete
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button onClick={() => name.trim() && onSave({ ...row, name: name.trim(), link: link.trim(), note: note.trim(), stageId })}
              disabled={!name.trim()} className="btn-primary disabled:opacity-40">
              Save
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center mb-4">
        <ListTodo size={24} className="text-stone-300" />
      </div>
      <p className="font-medium text-stone-600 mb-1">No lists yet</p>
      <p className="text-sm text-stone-400 mb-6 max-w-sm">
        Collaborators to contact, colleges to pitch, workshops to run. Make a list, give it stages, and move things through.
      </p>
      <button onClick={onCreate} className="btn-primary flex items-center gap-1.5">
        <Plus size={15} /> Create the first list
      </button>
    </div>
  );
}
