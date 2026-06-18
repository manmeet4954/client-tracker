'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Repeat, FileText } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import { generateId } from '@/lib/utils';
import { EvergreenIdea, DEFAULT_CONTENT_TYPES } from '@/types';
import Modal from './Modal';

export default function EvergreenView({ clientId }: { clientId: string }) {
  const { dispatch } = useApp();
  const { data } = useClient(clientId);
  const ideas = data.evergreenIdeas ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EvergreenIdea | null>(null);

  function openAdd() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(idea: EvergreenIdea) {
    setEditing(idea);
    setModalOpen(true);
  }

  function deleteIdea(ideaId: string) {
    dispatch({ type: 'DELETE_EVERGREEN', payload: { clientId, ideaId } });
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
            <Repeat size={18} className="text-emerald-500" />
            Evergreen Ideas
          </h2>
          <p className="text-sm text-stone-400 mt-0.5">
            Reusable content ideas you can repurpose any month. Just a reference list — not linked to the Kanban.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-[#1f1f1f] rounded-lg hover:bg-stone-800 transition-colors shrink-0"
        >
          <Plus size={15} />
          Add Idea
        </button>
      </div>

      {/* Empty state */}
      {ideas.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
            <Repeat size={24} className="text-emerald-300" />
          </div>
          <p className="font-medium text-stone-600 mb-1">No evergreen ideas yet</p>
          <p className="text-sm text-stone-400">Add ideas you want to repurpose every month.</p>
        </div>
      )}

      {/* List */}
      {ideas.length > 0 && (
        <div className="space-y-2.5">
          {ideas.map(idea => (
            <div
              key={idea.id}
              className="group bg-white border border-stone-200 rounded-xl px-4 py-3 hover:shadow-sm hover:border-stone-300 transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-stone-900">{idea.title}</p>
                    {idea.format && (
                      <span className="text-xs px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700">
                        {idea.format}
                      </span>
                    )}
                  </div>
                  {idea.notes && (
                    <p className="text-xs text-stone-500 mt-1 whitespace-pre-wrap leading-relaxed flex items-start gap-1.5">
                      <FileText size={12} className="text-stone-300 mt-0.5 shrink-0" />
                      {idea.notes}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => openEdit(idea)}
                    className="p-1.5 rounded-md text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => deleteIdea(idea.id)}
                    className="p-1.5 rounded-md text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <EvergreenModal
        open={modalOpen}
        existing={editing}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSave={(idea) => {
          if (editing) {
            dispatch({ type: 'UPDATE_EVERGREEN', payload: { clientId, idea } });
          } else {
            dispatch({ type: 'ADD_EVERGREEN', payload: { clientId, idea } });
          }
          setModalOpen(false);
          setEditing(null);
        }}
      />
    </div>
  );
}

function EvergreenModal({
  open,
  existing,
  onClose,
  onSave,
}: {
  open: boolean;
  existing: EvergreenIdea | null;
  onClose: () => void;
  onSave: (idea: EvergreenIdea) => void;
}) {
  const [title, setTitle] = useState('');
  const [format, setFormat] = useState('');
  const [notes, setNotes] = useState('');

  // Sync form when opening / switching between add and edit
  const [lastId, setLastId] = useState<string | null>(null);
  const currentId = existing?.id ?? null;
  if (open && currentId !== lastId) {
    setLastId(currentId);
    setTitle(existing?.title ?? '');
    setFormat(existing?.format ?? '');
    setNotes(existing?.notes ?? '');
  }

  function save() {
    if (!title.trim()) return;
    onSave({
      id: existing?.id ?? generateId(),
      title: title.trim(),
      format: format.trim(),
      notes: notes.trim(),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    });
  }

  return (
    <Modal open={open} onClose={onClose} title={existing ? 'Edit Idea' : 'Add Evergreen Idea'} size="md">
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Title</label>
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
            placeholder="e.g. Client Review Solo or Group"
            className="input-base w-full"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Format</label>
          <div className="flex flex-wrap gap-1.5">
            {DEFAULT_CONTENT_TYPES.map(t => (
              <button
                key={t}
                onClick={() => setFormat(format === t ? '' : t)}
                className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                  format === t
                    ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                    : 'bg-white border-stone-200 text-stone-500 hover:border-stone-400'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any detail on how to repurpose this..."
            rows={3}
            className="input-base w-full resize-none"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={!title.trim()} className="btn-primary">
            {existing ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
