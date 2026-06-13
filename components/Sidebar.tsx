'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Plus, Briefcase, Trash2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import Modal from './Modal';

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

// Glass styles
const GLASS_ACTIVE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.22)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  border: '1px solid rgba(255,255,255,0.35)',
  boxShadow: '0 4px 20px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.25)',
};

const GRAIN_URI = "data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

function pickAccent(
  brandColors: { hex: string; role?: string }[] | undefined,
  fallback: string
): string {
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
  const [collapsed, setCollapsed] = useState(false);

  const activeId = pathname.match(/\/client\/([^/]+)/)?.[1];

  // Restore collapsed state from localStorage
  useEffect(() => {
    if (localStorage.getItem('sidebar-collapsed') === 'true') setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar-collapsed', String(next));
  }

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
      {/* ── Sidebar panel ── */}
      <aside
        className={`
          shrink-0 h-full flex flex-col overflow-hidden relative
          fixed md:relative z-50 inset-y-0 left-0
          transition-all duration-300 ease-in-out
          ${collapsed ? 'w-[58px]' : 'w-56'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{
          background: 'linear-gradient(-45deg, #8c52ff, #c35dcc, #ff914d, #c35dcc, #8c52ff)',
          backgroundSize: '400% 400%',
          animation: 'gradientDrift 14s ease infinite',
        }}
      >
        {/* Grain texture */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            zIndex: 0,
            opacity: 0.045,
            backgroundImage: `url("${GRAIN_URI}")`,
            backgroundRepeat: 'repeat',
            backgroundSize: '256px 256px',
          }}
        />

        {/* All content sits above grain */}
        <div className="relative z-10 flex flex-col h-full">

          {/* ── Header ── */}
          <div className={`flex items-center border-b border-white/15 py-[14px] ${collapsed ? 'justify-center px-2' : 'px-4 gap-2.5'}`}>
            <Link
              href="/"
              onClick={handleLinkClick}
              className="flex items-center gap-2.5 hover:opacity-80 transition-opacity min-w-0"
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.3)',
                }}
              >
                <Briefcase size={14} className="text-white" />
              </div>
              {!collapsed && (
                <span className="font-semibold text-sm text-white truncate">My Clients</span>
              )}
            </Link>

            {/* Mobile close */}
            {!collapsed && (
              <button
                onClick={onClose}
                className="md:hidden p-1 rounded text-white/60 hover:text-white transition-colors ml-auto"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* ── Client list ── */}
          <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
            {state.clients.map(client => {
              const isActive = client.id === activeId;
              const accent = pickAccent(
                state.clientData[client.id]?.brandKit?.colors,
                client.color
              );

              /* ── Collapsed: dot + tooltip ── */
              if (collapsed) {
                return (
                  <div key={client.id} className="relative group flex justify-center mb-1">
                    <Link
                      href={`/client/${client.id}`}
                      onClick={handleLinkClick}
                      className="flex items-center justify-center w-9 h-9 rounded-xl transition-all hover:bg-white/10"
                      style={isActive ? GLASS_ACTIVE : {}}
                      title={client.name}
                    >
                      <span
                        className="w-3 h-3 rounded-full transition-all"
                        style={{
                          backgroundColor: accent,
                          boxShadow: isActive ? `0 0 10px ${accent}99` : 'none',
                        }}
                      />
                    </Link>
                    {/* Hover tooltip */}
                    <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-stone-900/90 text-white text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                      {client.name}
                    </div>
                  </div>
                );
              }

              /* ── Expanded: glass pill ── */
              return (
                <div key={client.id} className="group relative">
                  <Link
                    href={`/client/${client.id}`}
                    onClick={handleLinkClick}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all ${
                      isActive
                        ? 'text-white font-semibold'
                        : 'text-white/75 hover:text-white hover:bg-white/10'
                    }`}
                    style={isActive ? GLASS_ACTIVE : {}}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: accent }}
                    />
                    <span className="truncate">{client.name}</span>
                  </Link>
                  <button
                    onClick={() => setConfirmDelete(client.id)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 rounded text-white/45 hover:text-white transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </nav>

          {/* ── Footer: Add + Collapse toggle ── */}
          <div className={`border-t border-white/15 py-2 ${collapsed ? 'px-1.5' : 'px-2'}`}>
            {/* Add client */}
            {collapsed ? (
              <button
                onClick={() => setAddOpen(true)}
                title="Add Client"
                className="flex items-center justify-center w-9 h-9 rounded-xl mx-auto text-white/60 hover:text-white hover:bg-white/10 transition-all mb-1"
              >
                <Plus size={16} />
              </button>
            ) : (
              <button
                onClick={() => setAddOpen(true)}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm text-white/65 hover:text-white hover:bg-white/10 transition-all mb-1"
              >
                <Plus size={15} />
                <span>Add Client</span>
              </button>
            )}

            {/* Collapse toggle — desktop only */}
            <button
              onClick={toggleCollapsed}
              className="hidden md:flex items-center justify-center w-full py-1.5 rounded-xl text-white/35 hover:text-white/70 hover:bg-white/8 transition-all"
            >
              {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
            </button>
          </div>

        </div>
      </aside>

      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={onClose} />
      )}

      {/* ── Add client modal ── */}
      <Modal
        open={addOpen}
        onClose={() => { setAddOpen(false); setNewName(''); }}
        title="New Client"
        size="sm"
      >
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Client Name</label>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
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

      {/* ── Delete confirm modal ── */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete Client?"
        size="sm"
      >
        <div className="p-6 space-y-4">
          <p className="text-sm text-stone-600">
            This will permanently delete{' '}
            <strong>{state.clients.find(c => c.id === confirmDelete)?.name}</strong> and all their data.
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
