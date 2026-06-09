'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Plus, Briefcase, Trash2, X } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import Modal from './Modal';

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

/** Pick the best accent colour for a client from its brand kit */
function pickAccent(brandColors: { hex: string; role?: string }[] | undefined, fallback: string): string {
  if (!brandColors?.length) return fallback;
  const primary = brandColors.find(c => /primary|accent/i.test(c.role ?? ''));
  return primary?.hex ?? brandColors[0]?.hex ?? fallback;
}

export default function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const { state, dispatch } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const activeId = pathname.match(/\/client\/([^/]+)/)?.[1];

  function addClient() {
    const name = newName.trim();
    if (!name) return;
    dispatch({ type: 'ADD_CLIENT', payload: { name } });
    setNewName('');
    setAddOpen(false);
  }

  function handleLinkClick() {
    onClose?.();
  }

  return (
    <>
      {/* Sidebar panel */}
      <aside className={`
        w-56 shrink-0 h-full bg-white border-r border-stone-200 flex flex-col overflow-hidden
        fixed md:relative z-50 inset-y-0 left-0
        transition-transform duration-300 ease-in-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="px-4 py-4 border-b border-stone-100 flex items-center justify-between">
          <Link href="/" onClick={handleLinkClick} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 rounded-lg bg-[#1f1f1f] flex items-center justify-center">
              <Briefcase size={14} className="text-white" />
            </div>
            <span className="font-semibold text-sm text-stone-900">My Clients</span>
          </Link>
          {/* Close button — mobile only */}
          <button onClick={onClose} className="md:hidden p-1 rounded text-stone-400 hover:text-stone-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {state.clients.map(client => {
            const isActive = client.id === activeId;
            return (
              <div key={client.id} className="group relative">
                <Link
                  href={`/client/${client.id}`}
                  onClick={handleLinkClick}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                    isActive ? 'bg-stone-100 text-stone-900 font-medium' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: pickAccent(state.clientData[client.id]?.brandKit?.colors, client.color) }} />
                  <span className="truncate">{client.name}</span>
                </Link>
                <button
                  onClick={() => setConfirmDelete(client.id)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 rounded text-stone-400 hover:text-red-500 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </nav>

        <div className="px-2 py-3 border-t border-stone-100">
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-stone-500 hover:text-stone-900 hover:bg-stone-50 transition-colors"
          >
            <Plus size={15} />
            <span>Add Client</span>
          </button>
        </div>
      </aside>

      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/25 md:hidden" onClick={onClose} />
      )}

      <Modal open={addOpen} onClose={() => { setAddOpen(false); setNewName(''); }} title="New Client" size="sm">
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Client Name</label>
            <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addClient()}
              placeholder="e.g. Brand Name"
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setAddOpen(false); setNewName(''); }} className="btn-secondary">Cancel</button>
            <button onClick={addClient} disabled={!newName.trim()} className="btn-primary">Add Client</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Client?" size="sm">
        <div className="p-6 space-y-4">
          <p className="text-sm text-stone-600">
            This will permanently delete <strong>{state.clients.find(c => c.id === confirmDelete)?.name}</strong> and all their data.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setConfirmDelete(null)} className="btn-secondary">Cancel</button>
            <button
              onClick={() => {
                if (confirmDelete) {
                  const remaining = state.clients.filter(c => c.id !== confirmDelete);
                  dispatch({ type: 'REMOVE_CLIENT', payload: confirmDelete });
                  setConfirmDelete(null);
                  if (remaining.length > 0) router.push(`/client/${remaining[0].id}`);
                }
              }}
              className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
