'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, Check, Calendar, Trash2, Pencil,
  ChevronDown, CheckCircle2, Circle, Sparkles, Users, Network,
  Instagram, Pin, PinOff, Repeat,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { generateId, formatDate } from '@/lib/utils';
import { PersonalTask, TaskRepeat, Client, ContentCard } from '@/types';

// ── helpers ──────────────────────────────────────────────────────────────────

function pickAccent(brandColors: { hex: string; role?: string }[] | undefined, fallback: string): string {
  if (!brandColors?.length) return fallback;
  const primary = brandColors.find(c => /primary|accent/i.test(c.role ?? ''));
  return primary?.hex ?? brandColors[0]?.hex ?? fallback;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Still going';
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Section = 'overdue' | 'today' | 'week' | 'later';

// The dashboard sorts, never the user: sections are computed from dates.
// Legacy bucket is only a fallback for tasks that never got a due date.
function sectionOf(t: PersonalTask, today: string, weekEnd: string): Section {
  if (t.dueDate) {
    if (t.dueDate < today) return 'overdue';
    if (t.dueDate === today) return 'today';
    if (t.dueDate <= weekEnd) return 'week';
    return 'later';
  }
  if (t.pinnedOn === today) return 'today';
  if (t.bucket === 'today') return 'today';
  if (t.bucket === 'week') return 'week';
  return 'later';
}

const SECTION_META: { id: Section; label: string; sub: string }[] = [
  { id: 'overdue', label: 'Overdue', sub: 'Slipped past their date' },
  { id: 'today', label: 'Today', sub: 'Due today or pinned' },
  { id: 'week', label: 'This Week', sub: 'Next 7 days' },
  { id: 'later', label: 'Later', sub: 'Everything else' },
];

// ── Main ─────────────────────────────────────────────────────────────────────

export default function PersonalDashboard() {
  const { state, dispatch } = useApp();
  const router = useRouter();

  const tasks = state.personalTasks ?? [];
  const today = todayISO();
  const weekEnd = addDaysISO(7);

  const accentFor = (clientId?: string): string => {
    if (!clientId) return '#8c52ff';
    const c = state.clients.find(x => x.id === clientId);
    if (!c) return '#8c52ff';
    return pickAccent(state.clientData[clientId]?.brandKit?.colors, c.color);
  };

  // Posts going live today (or slipped), pulled straight from Content cards.
  // Ticking one marks the card Posted — one tick, both surfaces update.
  const livePosts: { clientId: string; clientName: string; card: ContentCard }[] = [];
  for (const client of state.clients) {
    for (const card of state.clientData[client.id]?.contentCards ?? []) {
      if (card.stage === 'posted' || !card.scheduledDate) continue;
      if (card.scheduledDate <= today) {
        livePosts.push({ clientId: client.id, clientName: client.name, card });
      }
    }
  }
  livePosts.sort((a, b) => a.card.scheduledDate.localeCompare(b.card.scheduledDate));

  const doneToday = tasks.filter(
    t => t.done && t.completedAt && t.completedAt.slice(0, 10) === today
  ).length;
  const pendingTotal = tasks.filter(t => !t.done).length;

  const active = tasks.filter(t => !t.done);
  const doneTodayList = tasks.filter(t => t.done && t.completedAt && t.completedAt.slice(0, 10) === today);
  const bySection = (s: Section) => active.filter(t => sectionOf(t, today, weekEnd) === s);

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      {/* ── Header band ── */}
      <header className="relative overflow-hidden" style={{ background: 'linear-gradient(120deg, #8c52ff 0%, #c35dcc 52%, #ff914d 100%)' }}>
        <div className="relative z-10 px-5 md:px-10 pt-6 pb-7 max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-5">
            <button onClick={() => router.push('/')} className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium transition-colors">
              <ArrowLeft size={16} /> Home
            </button>
            <div className="flex items-center gap-2">
              <GlassBtn onClick={() => router.push('/clients')} icon={<Users size={14} className="text-white" />} label="Clients" />
              <GlassBtn onClick={() => router.push('/map')} icon={<Network size={14} className="text-white" />} label="Container" />
              <GlassBtn onClick={() => router.push('/brain')} icon={<Sparkles size={14} className="text-white" />} label="Brain Dump" />
            </div>
          </div>

          <p className="text-white/60 text-[11px] font-medium tracking-[0.2em] uppercase mb-1.5">
            {new Intl.DateTimeFormat('en-US', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
          </p>
          <h1 className="text-white" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: 'clamp(28px, 5vw, 44px)', letterSpacing: '-0.02em' }}>
            {getGreeting()}, Manmeet.
          </h1>

          <div className="flex items-center gap-2.5 mt-4">
            <StatPill label="going live" value={livePosts.length} />
            <StatPill label="done today" value={doneToday} />
            <StatPill label="pending" value={pendingTotal} />
          </div>
        </div>
      </header>

      <main className="px-4 md:px-10 py-6 max-w-4xl mx-auto space-y-5">
        {/* ── Going live today ── */}
        {livePosts.length > 0 && (
          <div className="bg-white rounded-2xl border border-stone-200">
            <div className="px-4 pt-4 pb-3 border-b border-stone-100 flex items-center gap-2">
              <Instagram size={15} className="text-pink-500" />
              <h2 className="font-semibold text-stone-900 text-sm">Going live</h2>
              <span className="text-xs text-stone-400 font-medium ml-auto">{livePosts.length}</span>
            </div>
            <div className="px-2 py-2">
              {livePosts.map(({ clientId, clientName, card }) => {
                const slipped = card.scheduledDate < today;
                return (
                  <div key={card.id} className="group flex items-start gap-2.5 px-2 py-2 rounded-lg hover:bg-stone-50 transition-colors">
                    <button
                      onClick={() => dispatch({ type: 'MOVE_CONTENT_CARD', payload: { clientId, cardId: card.id, stage: 'posted' } })}
                      className="shrink-0 mt-0.5" title="Mark posted"
                    >
                      <Circle size={18} className="text-stone-300 hover:text-emerald-500" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug text-stone-700">{card.title || 'Untitled post'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-flex items-center gap-1 text-[11px] text-stone-500">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accentFor(clientId) }} />
                          {clientName}
                        </span>
                        {card.platform && <span className="text-[11px] text-indigo-500">{card.platform}</span>}
                        <span className={`text-[11px] ${slipped ? 'text-red-500 font-medium' : 'text-stone-400'}`}>
                          {slipped ? `was due ${formatDate(card.scheduledDate)}` : 'today'}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => router.push(`/client/${clientId}/content`)}
                      className="opacity-0 group-hover:opacity-100 text-[11px] text-stone-400 hover:text-stone-700 transition-opacity shrink-0 mt-1"
                    >
                      open →
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Quick add ── */}
        <QuickAdd
          clients={state.clients}
          accentFor={accentFor}
          onAdd={task => dispatch({ type: 'ADD_TASK', payload: { task } })}
        />

        {/* ── Auto-sorted sections ── */}
        {SECTION_META.map(sec => {
          const list = bySection(sec.id);
          if (list.length === 0 && sec.id !== 'today') return null;
          return (
            <div key={sec.id} className="bg-white rounded-2xl border border-stone-200">
              <div className="px-4 pt-4 pb-3 border-b border-stone-100 flex items-baseline justify-between">
                <div>
                  <h2 className={`font-semibold text-sm ${sec.id === 'overdue' ? 'text-red-600' : 'text-stone-900'}`}>{sec.label}</h2>
                  <p className="text-xs text-stone-400 mt-0.5">{sec.sub}</p>
                </div>
                <span className="text-xs text-stone-400 font-medium">{list.length}</span>
              </div>
              <div className="px-2 py-2">
                {list.length === 0 && <p className="text-xs text-stone-300 text-center py-4">Nothing here</p>}
                {list.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    clients={state.clients}
                    accentFor={accentFor}
                    today={today}
                    showPin={sec.id === 'week' || sec.id === 'later'}
                    onToggle={() => dispatch({ type: 'TOGGLE_TASK', payload: { taskId: task.id } })}
                    onEdit={t => dispatch({ type: 'EDIT_TASK', payload: { task: t } })}
                    onDelete={() => dispatch({ type: 'DELETE_TASK', payload: { taskId: task.id } })}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* ── Done today ── */}
        {doneTodayList.length > 0 && (
          <div className="bg-white rounded-2xl border border-stone-200">
            <div className="px-4 pt-4 pb-3 border-b border-stone-100">
              <p className="text-[10px] font-medium text-stone-300 uppercase tracking-wide">Done today ({doneTodayList.length})</p>
            </div>
            <div className="px-2 py-2">
              {doneTodayList.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  clients={state.clients}
                  accentFor={accentFor}
                  today={today}
                  showPin={false}
                  onToggle={() => dispatch({ type: 'TOGGLE_TASK', payload: { taskId: task.id } })}
                  onEdit={t => dispatch({ type: 'EDIT_TASK', payload: { task: t } })}
                  onDelete={() => dispatch({ type: 'DELETE_TASK', payload: { taskId: task.id } })}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function GlassBtn({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-2 px-3.5 py-2 rounded-2xl transition-all duration-200 hover:scale-[1.04] active:scale-[0.97]"
      style={{ background: 'rgba(255,255,255,0.16)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.28)' }}>
      {icon}
      <span className="text-white text-xs font-semibold">{label}</span>
    </button>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1.5 px-3.5 py-2 rounded-2xl"
      style={{ background: 'rgba(255,255,255,0.16)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.25)' }}>
      <span className="text-white font-bold text-lg leading-none">{value}</span>
      <span className="text-white/70 text-xs">{label}</span>
    </div>
  );
}

// ── Quick add ────────────────────────────────────────────────────────────────

function QuickAdd({ clients, accentFor, onAdd }: {
  clients: Client[];
  accentFor: (clientId?: string) => string;
  onAdd: (task: PersonalTask) => void;
}) {
  const [text, setText] = useState('');
  const [clientId, setClientId] = useState<string | undefined>(undefined);
  const [dueDate, setDueDate] = useState('');
  const [repeat, setRepeat] = useState<TaskRepeat>('');

  function add() {
    const t = text.trim();
    if (!t) return;
    onAdd({
      id: generateId(), text: t, bucket: 'todo', clientId,
      dueDate: dueDate || undefined, repeat: repeat || undefined,
      done: false, createdAt: new Date().toISOString(),
    });
    setText(''); setClientId(undefined); setDueDate(''); setRepeat('');
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200 px-3 py-3">
      <div className="flex items-center gap-2 border border-stone-200 rounded-xl px-3 py-2 focus-within:border-stone-400 transition-colors">
        <Plus size={15} className="text-stone-300 shrink-0" />
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Add a task… set a date and it sorts itself"
          className="flex-1 text-sm bg-transparent focus:outline-none text-stone-700 placeholder-stone-400 min-w-0"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <ClientPicker clients={clients} value={clientId} onChange={setClientId} accentFor={accentFor} />
        <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs text-stone-500 hover:border-stone-400 transition-colors cursor-pointer">
          <Calendar size={12} />
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="bg-transparent focus:outline-none text-stone-600 w-[88px]" />
        </label>
        <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs text-stone-500 hover:border-stone-400 transition-colors">
          <Repeat size={12} />
          <select value={repeat} onChange={e => setRepeat(e.target.value as TaskRepeat)} className="bg-transparent focus:outline-none text-stone-600">
            <option value="">Once</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
        {text.trim() && (
          <button onClick={add} className="ml-auto px-3 py-1.5 rounded-lg bg-[#1f1f1f] text-white text-xs font-medium hover:bg-stone-700 transition-colors">
            Add
          </button>
        )}
      </div>
    </div>
  );
}

// ── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({ task, clients, accentFor, today, showPin, onToggle, onEdit, onDelete }: {
  task: PersonalTask;
  clients: Client[];
  accentFor: (clientId?: string) => string;
  today: string;
  showPin: boolean;
  onToggle: () => void;
  onEdit: (task: PersonalTask) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.text);

  const client = task.clientId ? clients.find(c => c.id === task.clientId) : undefined;
  const accent = accentFor(task.clientId);
  const overdue = !task.done && !!task.dueDate && task.dueDate < today;
  const pinned = task.pinnedOn === today;

  function saveEdit() {
    const t = draft.trim();
    if (t) onEdit({ ...task, text: t });
    else setDraft(task.text);
    setEditing(false);
  }

  return (
    <div className="group flex items-start gap-2.5 px-2 py-2 rounded-lg hover:bg-stone-50 transition-colors">
      <button onClick={onToggle} className="shrink-0 mt-0.5 transition-colors" title={task.done ? 'Mark undone' : 'Mark done'}>
        {task.done
          ? <CheckCircle2 size={18} style={{ color: accent }} />
          : <Circle size={18} className="text-stone-300 hover:text-stone-500" />}
      </button>

      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { setDraft(task.text); setEditing(false); } }}
            className="w-full text-sm text-stone-700 bg-transparent border-b border-stone-300 focus:outline-none pb-0.5"
          />
        ) : (
          <p onDoubleClick={() => setEditing(true)}
            className={`text-sm leading-snug cursor-default ${task.done ? 'line-through text-stone-400' : 'text-stone-700'}`}>
            {task.text}
          </p>
        )}

        {(client || task.dueDate || task.repeat || pinned) && (
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {client && (
              <span className="inline-flex items-center gap-1 text-[11px] text-stone-500">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accent }} />
                {client.name}
              </span>
            )}
            {task.dueDate && (
              <span className={`inline-flex items-center gap-1 text-[11px] ${overdue ? 'text-red-500 font-medium' : 'text-stone-400'}`}>
                <Calendar size={10} />
                {formatDate(task.dueDate)}{overdue ? ' · overdue' : ''}
              </span>
            )}
            {task.repeat && (
              <span className="inline-flex items-center gap-1 text-[11px] text-violet-500">
                <Repeat size={10} /> {task.repeat}
              </span>
            )}
            {pinned && (
              <span className="inline-flex items-center gap-1 text-[11px] text-amber-600">
                <Pin size={10} /> pinned
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {showPin && !task.done && (
          <button
            onClick={() => onEdit({ ...task, pinnedOn: pinned ? undefined : today })}
            className="p-1 rounded text-stone-400 hover:text-amber-600 transition-colors"
            title={pinned ? 'Unpin from today' : 'Pin to today'}
          >
            {pinned ? <PinOff size={13} /> : <Pin size={13} />}
          </button>
        )}
        <button onClick={() => setEditing(true)} className="p-1 rounded text-stone-400 hover:text-stone-700 transition-colors">
          <Pencil size={13} />
        </button>
        <button onClick={onDelete} className="p-1 rounded text-stone-400 hover:text-red-500 transition-colors">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ── Client picker dropdown ───────────────────────────────────────────────────

function ClientPicker({ clients, value, onChange, accentFor }: {
  clients: Client[];
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  accentFor: (clientId?: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const selected = value ? clients.find(c => c.id === value) : undefined;

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs text-stone-500 hover:border-stone-400 transition-colors">
        {selected ? (
          <>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accentFor(selected.id) }} />
            <span className="max-w-[120px] truncate">{selected.name}</span>
          </>
        ) : (
          <span className="text-stone-400">Client</span>
        )}
        <ChevronDown size={12} className="text-stone-400" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-56 bg-white border border-stone-200 rounded-xl shadow-xl py-1 max-h-[60vh] overflow-y-auto">
          <button onClick={() => { onChange(undefined); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-stone-500 hover:bg-stone-50 transition-colors">
            {value === undefined && <Check size={12} className="text-stone-700" />}
            <span className={value === undefined ? 'text-stone-900 font-medium' : ''}>No client (personal)</span>
          </button>
          {clients.map(c => (
            <button key={c.id} onClick={() => { onChange(c.id); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-stone-50 transition-colors">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: accentFor(c.id) }} />
              <span className={`truncate ${value === c.id ? 'text-stone-900 font-medium' : 'text-stone-600'}`}>{c.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
