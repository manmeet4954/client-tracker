'use client';

// The shelf — spec 28 §4. Her login's landing.
//
// PLAN §2 item 1: "a grid of profile cards, clients and her own, each with its
// brand colour and a one-line pulse. Cards show status, never content: nothing
// from inside a profile leaks onto the shelf. The shelf also carries her one
// cross-profile window: the today strip. Add-profile lives here."
//
// No global search. No cross-profile board, calendar or analytics. No recent
// activity. Anything else that wants to be cross-profile is a plan change, and
// therefore hers (§4.7).

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, LogOut, Plus } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import Modal from '@/components/Modal';
import type { ShelfCard } from '@/lib/shell/shelf';
import { PULSE_EMPTY_LINE, composeShelf, composeTodayStrip, composeWeeklyPulse } from '@/lib/shell/shelf';
import { renderProfile } from '@/lib/shell/profile';
import { renderState } from '@/lib/tree/render';
import { amendEntry } from '@/lib/tree/body';
import { CLIENT_COLORS } from '@/lib/utils';

const TASKS = 'work-log/logs/tasks';

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Shelf() {
  const { state, dispatch, logout } = useApp();
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [colour, setColour] = useState(CLIENT_COLORS[0]);
  const [ownerKind, setOwnerKind] = useState<'hers' | 'client'>('client');
  const [showArchived, setShowArchived] = useState(false);

  const day = today();
  const cards = useMemo(() => composeShelf(state, 'owner'), [state]);
  const strip = useMemo(() => composeTodayStrip(state, day), [state, day]);
  const pulse = useMemo(() => composeWeeklyPulse(state), [state]);

  const live = cards.filter(c => c.group !== 'archived');
  const archived = cards.filter(c => c.group === 'archived');
  const dateLine = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date());

  function addProfile() {
    const n = name.trim();
    if (!n) return;
    // §4.5 — the shell's ONE write. Born at lifecycle `setup`, owner_kind chosen,
    // no switch positions set, no strategy version.
    dispatch({
      type: 'ADD_CLIENT',
      payload: { name: n, color: colour, ownerKind, lifecycle: 'setup' },
    });
    setName('');
    setAddOpen(false);
  }

  /**
   * Ticking a row completes it in place, through that profile's own scope: one
   * write, one path, no cross-profile write. Tasks are append-only, so a tick is
   * an AMENDMENT — the original record stays intact (S11).
   */
  function tick(profileId: string, taskId: string) {
    const body = state.clientData[profileId]?.body;
    if (!body) return;
    if (!(body.paths[TASKS] ?? []).some(e => e.id === taskId)) return;
    const next = amendEntry(body, TASKS, taskId, {
      at: new Date().toISOString(), by: 'owner', note: 'done, from the today strip',
      changed: { done: true },
    });
    dispatch({ type: 'SET_BODY', payload: { clientId: profileId, body: next } });
  }

  const pulseOn = (state.clients ?? []).some(c =>
    renderState(renderProfile(state, c.id, 'owner'), 'shelf.weekly_pulse', 'owner') === 'active');

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4 md:px-8">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-stone-900">Your profiles</h1>
            <p className="text-xs text-stone-500">{dateLine}</p>
          </div>
          {strip.length > 0 && (
            <a href="#today"
              className="ml-auto rounded-full bg-stone-900 px-3 py-1.5 text-xs font-medium text-white">
              {strip.length} due today
            </a>
          )}
          <button type="button" onClick={logout}
            className={`flex items-center gap-1.5 text-sm text-stone-500 ${strip.length > 0 ? '' : 'ml-auto'}`}>
            <LogOut size={15} />
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 md:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {live.map(card => <Card key={card.id} card={card} onOpen={() => router.push(card.href)} />)}
          <button type="button" onClick={() => setAddOpen(true)}
            className="flex min-h-[112px] items-center justify-center gap-2 rounded-2xl border border-dashed border-stone-300 text-sm text-stone-500 hover:border-stone-400">
            <Plus size={16} />
            Add a profile
          </button>
        </div>

        {archived.length > 0 && (
          <section className="mt-6">
            <button type="button" onClick={() => setShowArchived(v => !v)}
              className="flex items-center gap-1.5 text-sm text-stone-500">
              {showArchived ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              Archived ({archived.length})
            </button>
            {showArchived && (
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {archived.map(card => <Card key={card.id} card={card} onOpen={() => router.push(card.href)} />)}
              </div>
            )}
          </section>
        )}

        {/* §4.3 — the one cross-profile window. */}
        <section id="today" className="mt-8">
          <h2 className="mb-2 text-sm font-semibold text-stone-900">Due today</h2>
          {strip.length === 0
            ? <p className="rounded-xl border border-stone-200 bg-white px-4 py-4 text-sm text-stone-500">Nothing due today.</p>
            : (
              <ul className="space-y-1.5">
                {strip.map(row => (
                  <li key={`${row.profile_id}-${row.task_id}`}
                    className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
                    <input type="checkbox" onChange={() => tick(row.profile_id, row.task_id)}
                      aria-label={`Mark done: ${row.text}`} className="h-4 w-4" />
                    <button type="button" onClick={() => router.push(`/profile/${row.profile_id}`)}
                      className="min-w-0 flex-1 text-left">
                      <span className="text-sm text-stone-900">{row.text}</span>
                      <span className="ml-2 inline-flex items-center gap-1 text-xs text-stone-500">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} />
                        {row.profile_name}
                      </span>
                    </button>
                    <span className={`text-xs ${row.overdue ? 'text-rose-600' : 'text-stone-400'}`}>
                      {row.overdue ? 'overdue' : 'today'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
        </section>

        {/* §4.4 — her private weekly read, composed from each profile's own entry. */}
        {pulseOn && (
          <section className="mt-8">
            <h2 className="mb-2 text-sm font-semibold text-stone-900">This week</h2>
            {pulse.length === 0
              ? <p className="rounded-xl border border-stone-200 bg-white px-4 py-4 text-sm text-stone-500">{PULSE_EMPTY_LINE}</p>
              : (
                <div className="space-y-2">
                  {pulse.map(g => (
                    <div key={g.profile_id} className="rounded-xl border border-stone-200 bg-white p-4">
                      <p className="flex items-center gap-2 text-sm font-medium text-stone-900">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                        {g.profile_name}
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {g.lines.map((l, i) => <li key={i} className="text-sm text-stone-600">{l}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
          </section>
        )}
      </main>

      <Modal open={addOpen} onClose={() => { setAddOpen(false); setName(''); }} title="New profile" size="sm">
        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-stone-500">Name</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addProfile()}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-stone-500">Colour</label>
            <div className="flex flex-wrap gap-1.5">
              {CLIENT_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColour(c)}
                  aria-label={`Colour ${c}`}
                  className={`h-7 w-7 rounded-full ${colour === c ? 'ring-2 ring-stone-900 ring-offset-2' : ''}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-stone-500">Whose is it</label>
            <div className="flex gap-1.5">
              {(['client', 'hers'] as const).map(k => (
                <button key={k} type="button" onClick={() => setOwnerKind(k)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm ${
                    ownerKind === k ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 text-stone-600'
                  }`}>
                  {k === 'hers' ? 'Mine' : 'A client'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setAddOpen(false); setName(''); }} className="btn-secondary">Cancel</button>
            <button type="button" onClick={addProfile} disabled={!name.trim()} className="btn-primary">Add profile</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/**
 * §4.2 — the card. Name, colour, lifecycle chip, one status line of counts, one
 * attention line. Tapping it enters the profile. There is nothing else to tap:
 * no menu, no quick actions, no open-in. Lifecycle changes and deletion live
 * inside the profile, because they are decisions.
 */
function Card({ card, onOpen }: { card: ShelfCard; onOpen: () => void }) {
  const muted = card.lifecycle === 'paused' || card.lifecycle === 'archived';
  return (
    <button type="button" onClick={onOpen}
      className={`overflow-hidden rounded-2xl border border-stone-200 bg-white text-left transition-all hover:border-stone-300 hover:shadow-sm ${
        muted ? 'opacity-60' : ''
      }`}>
      <div className="h-1.5" style={{ backgroundColor: card.color }} />
      <div className="p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
            style={{ backgroundColor: card.color }}>
            {card.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="truncate text-sm font-semibold text-stone-900">{card.name}</span>
          {card.chip && (
            <span className="ml-auto shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-600">
              {card.chip}
            </span>
          )}
        </div>
        {card.status && (
          <p className="mt-2 text-xs text-stone-500">
            {card.status}{card.frozen_at ? ' · frozen at the pause' : ''}
          </p>
        )}
        {card.attention && <p className="mt-1 text-xs text-amber-700">{card.attention}</p>}
      </div>
    </button>
  );
}
