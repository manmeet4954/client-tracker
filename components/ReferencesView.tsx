'use client';

import { useState } from 'react';
import { Plus, Pin, Trash2, Link2, Image, FileText, ExternalLink, Search, Pencil } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import { generateId } from '@/lib/utils';
import { Reference, ReferenceType } from '@/types';
import Modal from './Modal';

export default function ReferencesView({ clientId }: { clientId: string }) {
  const { dispatch } = useApp();
  const { data } = useClient(clientId);
  const [addType, setAddType] = useState<ReferenceType | null>(null);
  const [editingRef, setEditingRef] = useState<Reference | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<ReferenceType | ''>('');

  const refs = data.references.filter(r => {
    if (search && !r.title.toLowerCase().includes(search.toLowerCase()) && !r.content.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType && r.type !== filterType) return false;
    return true;
  });

  const pinned = refs.filter(r => r.pinned);
  const unpinned = refs.filter(r => !r.pinned);

  function deleteRef(refId: string) {
    dispatch({ type: 'DELETE_REFERENCE', payload: { clientId, refId } });
  }

  function togglePin(refId: string) {
    dispatch({ type: 'TOGGLE_PIN', payload: { clientId, refId } });
  }

  function saveEdit(refId: string, title: string, content: string) {
    dispatch({ type: 'EDIT_REFERENCE', payload: { clientId, refId, title, content } });
    setEditingRef(null);
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-5">
        <div className="flex items-center gap-2 border border-stone-200 bg-white rounded-lg px-3 py-1.5 flex-1 max-w-xs">
          <Search size={14} className="text-stone-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search references..."
            className="text-sm bg-transparent focus:outline-none text-stone-700 placeholder-stone-400 flex-1"
          />
        </div>
        <div className="flex items-center gap-1 border border-stone-200 bg-white rounded-lg p-0.5">
          {(['', 'link', 'image', 'text'] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                filterType === t ? 'bg-[#1f1f1f] text-white' : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              {t === '' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <AddButton label="Link" icon={<Link2 size={14} />} onClick={() => setAddType('link')} />
          <AddButton label="Image" icon={<Image size={14} />} onClick={() => setAddType('image')} />
          <AddButton label="Note" icon={<FileText size={14} />} onClick={() => setAddType('text')} />
        </div>
      </div>

      {data.references.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center mb-4">
            <Pin size={24} className="text-stone-300" />
          </div>
          <p className="font-medium text-stone-600 mb-1">No references yet</p>
          <p className="text-sm text-stone-400">Add links, images, or notes to build your inspiration board.</p>
        </div>
      )}

      {pinned.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-1.5 mb-3">
            <Pin size={13} className="text-accent" />
            <h3 className="text-xs font-medium text-stone-500 uppercase tracking-wide">Pinned</h3>
          </div>
          <RefGrid refs={pinned} onDelete={deleteRef} onTogglePin={togglePin} onEdit={setEditingRef} />
        </section>
      )}

      {unpinned.length > 0 && (
        <section>
          {pinned.length > 0 && (
            <h3 className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-3">All References</h3>
          )}
          <RefGrid refs={unpinned} onDelete={deleteRef} onTogglePin={togglePin} onEdit={setEditingRef} />
        </section>
      )}

      <AddRefModal
        open={!!addType}
        type={addType!}
        onClose={() => setAddType(null)}
        onSave={(ref) => {
          dispatch({ type: 'ADD_REFERENCE', payload: { clientId, ref } });
          setAddType(null);
        }}
      />

      {editingRef && (
        <EditRefModal
          ref_={editingRef}
          onClose={() => setEditingRef(null)}
          onSave={(title, content) => saveEdit(editingRef.id, title, content)}
        />
      )}
    </div>
  );
}

function AddButton({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-stone-600 border border-stone-200 bg-white rounded-lg hover:border-stone-400 hover:text-stone-900 transition-colors"
    >
      {icon}
      {label}
    </button>
  );
}

function RefGrid({ refs, onDelete, onTogglePin, onEdit }: {
  refs: Reference[];
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onEdit: (ref: Reference) => void;
}) {
  return (
    <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
      {refs.map(ref => (
        <RefCard key={ref.id} ref_={ref} onDelete={onDelete} onTogglePin={onTogglePin} onEdit={onEdit} />
      ))}
    </div>
  );
}

function RefCard({ ref_, onDelete, onTogglePin, onEdit }: {
  ref_: Reference;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onEdit: (ref: Reference) => void;
}) {
  const [readOpen, setReadOpen] = useState(false);

  const TYPE_ICON: Record<ReferenceType, React.ReactNode> = {
    link: <Link2 size={12} className="text-sky-500" />,
    image: <Image size={12} className="text-emerald-500" />,
    text: <FileText size={12} className="text-amber-500" />,
  };

  return (
    <>
      <div
        className={`break-inside-avoid bg-white border border-stone-200 rounded-xl overflow-hidden group hover:shadow-md hover:border-stone-300 transition-all mb-4 ${ref_.type === 'text' ? 'cursor-pointer' : ''}`}
        onClick={() => ref_.type === 'text' && setReadOpen(true)}
      >
        {ref_.type === 'image' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ref_.content}
            alt={ref_.title || 'Reference image'}
            className="w-full object-cover"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}

        <div className="p-3">
          <div className="flex items-start gap-2 mb-1">
            <span className="shrink-0 mt-0.5">{TYPE_ICON[ref_.type]}</span>
            {ref_.title && (
              <p className="text-sm font-medium text-stone-900 flex-1 leading-snug">{ref_.title}</p>
            )}
          </div>

          {ref_.type === 'link' && (
            <a
              href={ref_.content}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-sky-500 hover:text-sky-700 truncate mt-1"
              onClick={e => e.stopPropagation()}
            >
              <ExternalLink size={10} />
              <span className="truncate">{ref_.content}</span>
            </a>
          )}

          {ref_.type === 'text' && (
            <>
              <p className="text-xs text-stone-600 mt-1 line-clamp-4">{ref_.content}</p>
              {ref_.content.length > 200 && (
                <p className="text-xs text-accent mt-1">Tap to read full note</p>
              )}
            </>
          )}

          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-stone-50 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={e => { e.stopPropagation(); onTogglePin(ref_.id); }}
              className={`p-1 rounded transition-colors ${ref_.pinned ? 'text-accent' : 'text-stone-400 hover:text-accent'}`}
            >
              <Pin size={13} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onEdit(ref_); }}
              className="p-1 rounded text-stone-400 hover:text-stone-700 transition-colors"
              title="Edit"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete(ref_.id); }}
              className="p-1 rounded text-stone-400 hover:text-red-500 transition-colors ml-auto"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Full-text read modal */}
      <Modal open={readOpen} onClose={() => setReadOpen(false)} title={ref_.title || 'Note'} size="md">
        <div className="p-6">
          <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">{ref_.content}</p>
        </div>
      </Modal>
    </>
  );
}

function EditRefModal({ ref_, onClose, onSave }: {
  ref_: Reference;
  onClose: () => void;
  onSave: (title: string, content: string) => void;
}) {
  const [title, setTitle] = useState(ref_.title);
  const [content, setContent] = useState(ref_.content);

  const LABEL: Record<ReferenceType, string> = {
    link: 'URL',
    image: 'Image URL',
    text: 'Note',
  };

  function save() {
    if (!content.trim()) return;
    onSave(title.trim(), content.trim());
  }

  return (
    <Modal open onClose={onClose} title="Edit Reference" size="md">
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Title</label>
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Give it a name..."
            className="input-base w-full"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">{LABEL[ref_.type]}</label>
          {ref_.type === 'text' ? (
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={6}
              className="input-base w-full resize-none"
            />
          ) : (
            <input
              value={content}
              onChange={e => setContent(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && save()}
              className="input-base w-full"
            />
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={!content.trim()} className="btn-primary">Save</button>
        </div>
      </div>
    </Modal>
  );
}

function AddRefModal({
  open,
  type,
  onClose,
  onSave,
}: {
  open: boolean;
  type: ReferenceType;
  onClose: () => void;
  onSave: (ref: Reference) => void;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const TITLES: Record<ReferenceType, string> = {
    link: 'Add Link',
    image: 'Add Image',
    text: 'Add Note',
  };

  const PLACEHOLDERS: Record<ReferenceType, string> = {
    link: 'https://...',
    image: 'https://... or paste an image URL',
    text: 'Write your note or idea here...',
  };

  function save() {
    if (!content.trim()) return;
    onSave({
      id: generateId(),
      type,
      content: content.trim(),
      title: title.trim(),
      pinned: false,
      createdAt: new Date().toISOString(),
    });
    setTitle('');
    setContent('');
  }

  return (
    <Modal open={open} onClose={() => { onClose(); setTitle(''); setContent(''); }} title={TITLES[type] ?? 'Add Reference'} size="md">
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Title (optional)</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Give it a name..."
            className="input-base w-full"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">
            {type === 'link' ? 'URL' : type === 'image' ? 'Image URL' : 'Note'}
          </label>
          {type === 'text' ? (
            <textarea
              autoFocus
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={PLACEHOLDERS[type]}
              rows={5}
              className="input-base w-full resize-none"
            />
          ) : (
            <input
              autoFocus
              value={content}
              onChange={e => setContent(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && save()}
              placeholder={PLACEHOLDERS[type]}
              className="input-base w-full"
            />
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={!content.trim()} className="btn-primary">Add</button>
        </div>
      </div>
    </Modal>
  );
}
