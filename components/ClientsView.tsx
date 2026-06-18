'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, ArrowUpRight, LogOut } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import Modal from '@/components/Modal';

function pickAccent(brandColors: { hex: string; role?: string }[] | undefined, fallback: string): string {
  if (!brandColors?.length) return fallback;
  const primary = brandColors.find(c => /primary|accent/i.test(c.role ?? ''));
  return primary?.hex ?? brandColors[0]?.hex ?? fallback;
}

export default function ClientsView() {
  const { state, dispatch, role, logout } = useApp();
  const isOwner = role === 'owner';
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');

  function addClient() {
    const n = newName.trim();
    if (!n) return;
    dispatch({ type: 'ADD_CLIENT', payload: { name: n } });
    setNewName('');
    setAddOpen(false);
  }

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      {/* Header band */}
      <header
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(120deg, #8c52ff 0%, #c35dcc 52%, #ff914d 100%)' }}
      >
        <div className="relative z-10 px-5 md:px-10 pt-6 pb-7 max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-5">
            {isOwner ? (
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium transition-colors"
              >
                <ArrowLeft size={16} />
                Home
              </button>
            ) : <span />}
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm font-medium transition-colors"
            >
              <LogOut size={15} />
              Log out
            </button>
          </div>
          <h1
            className="text-white"
            style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: 'clamp(28px, 5vw, 44px)', letterSpacing: '-0.02em' }}
          >
            Your Clients
          </h1>
          <p className="text-white/70 text-sm mt-1">
            {state.clients.length} {state.clients.length === 1 ? 'brand' : 'brands'} · tap to open a workspace
          </p>
        </div>
      </header>

      {/* Grid */}
      <main className="px-4 md:px-10 py-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {state.clients.map(client => {
            const accent = pickAccent(state.clientData[client.id]?.brandKit?.colors, client.color);
            return (
              <button
                key={client.id}
                onClick={() => router.push(`/client/${client.id}`)}
                className="group text-left bg-white rounded-2xl border border-stone-200 overflow-hidden hover:shadow-md hover:border-stone-300 transition-all hover:scale-[1.01]"
              >
                {/* accent strip */}
                <div className="h-1.5" style={{ backgroundColor: accent }} />
                <div className="p-4 flex items-center gap-3">
                  <span
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-sm"
                    style={{ backgroundColor: accent }}
                  >
                    {client.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-stone-900 truncate">{client.name}</p>
                    <p className="text-xs text-stone-400">Open workspace</p>
                  </div>
                  <ArrowUpRight size={18} className="text-stone-300 group-hover:text-stone-600 transition-colors shrink-0" />
                </div>
              </button>
            );
          })}

          {/* Add client (owner only) */}
          {isOwner && (
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-300 text-stone-400 hover:text-stone-600 hover:border-stone-400 transition-colors py-8 min-h-[92px]"
            >
              <Plus size={18} />
              <span className="font-medium text-sm">Add Client</span>
            </button>
          )}
        </div>
      </main>

      <Modal open={addOpen} onClose={() => { setAddOpen(false); setNewName(''); }} title="New Client" size="sm">
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Client name</label>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addClient()}
              placeholder="e.g. CareerBubble"
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setAddOpen(false); setNewName(''); }} className="btn-secondary">Cancel</button>
            <button onClick={addClient} disabled={!newName.trim()} className="btn-primary">Add</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
