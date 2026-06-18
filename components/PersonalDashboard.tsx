'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, Check, Calendar, Trash2, Pencil,
  ChevronDown, CheckCircle2, Circle, Sparkles, Users,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { generateId, formatDate } from '@/lib/utils';
import { PersonalTask, TaskBucket, TASK_BUCKETS, Client } from '@/types';

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

function isOverdue(due?: string): boolean {
  if (!due) return false;
  return due < todayISO();
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function PersonalDashboard() {
  const { state, dispatch } = useApp();
  const router = useRouter();

  const tasks = state.personalTasks ?? [];
  const accentFor = (clientId?: string): string => {
    if (!clientId) return '#8c52ff';
    const c = state.clients.find(x => x.id === clientId);
    if (!c) return '#8c52ff';
    return pickAccent(state.clientData[clientId]?.brandKit?.colors, c.color);
  };

  const doneToday = tasks.filter(
    t => t.done && t.completedAt && t.completedAt.slice(0, 10) === todayISO()
  ).length;
  const pendingTotal = tasks.filter(t => !t.done).length;

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      {/* ── Header band ── */}
      <header
        className="relative overflow-hidden"
        style={{
          background: 'linear-gradient(120deg, #8c52ff 0%, #c35dcc 52%, #ff914d 100%)',
        }}
      >
        <div className="relative z-10 px-5 md:px-10 pt-6 pb-7 max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium transition-colors"
            >
              <ArrowLeft size={16} />
              Home
            </button>

            <div className="flex items-center gap-2">
              {/* Clients shortcut */}
              <button
                onClick={() => router.push('/clients')}
                className="flex items-center gap-2 px-3.5 py-2 rounded-2xl transition-all duration-200 hover:scale-[1.04] active:scale-[0.97]"
                style={{
                  background: 'rgba(255,255,255,0.16)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255,255,255,0.28)',
                }}
              >
                <Users size={14} className="text-white" />
                <span className="text-white text-xs font-semibold">Clients</span>
              </button>

              {/* Brain Dump shortcut */}
              <button
                onClick={() => router.push('/brain')}
                className="flex items-center gap-2 px-3.5 py-2 rounded-2xl transition-all duration-200 hover:scale-[1.04] active:scale-[0.97]"
                style={{
                  background: 'rgba(255,255,255,0.16)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255,255,255,0.28)',
                }}
              >
                <Sparkles size={14} className="text-white" />
                <span className="text-white text-xs font-semibold">Brain Dump</span>
              </button>
            </div>
          </div>

          <p className="text-white/60 text-[11px] font-medium tracking-[0.2em] uppercase mb-1.5">
            {new Intl.DateTimeFormat('en-US', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
          </p>
          <h1
            className="text-white"
            style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: 'clamp(28px, 5vw, 44px)', letterSpacing: '-0.02em' }}
          >
            {getGreeting()}, Manmeet.
          </h1>

          {/* Quick stats */}
          <div className="flex items-center gap-2.5 mt-4">
            <StatPill label="done today" value={doneToday} />
            <StatPill label="pending" value={pendingTotal} />
          </div>
        </div>
      </header>

      {/* ── Buckets ── */}
      <main className="px-4 md:px-10 py-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5 items-start">
          {TASK_BUCKETS.map(bucket => (
            <BucketCard
              key={bucket.id}
              bucket={bucket.id}
              label={bucket.label}
              sub={bucket.sub}
              tasks={tasks.filter(t => t.bucket === bucket.id)}
              clients={state.clients}
              accentFor={accentFor}
              onAdd={task => dispatch({ type: 'ADD_TASK', payload: { task } })}
              onToggle={taskId => dispatch({ type: 'TOGGLE_TASK', payload: { taskId } })}
              onEdit={task => dispatch({ type: 'EDIT_TASK', payload: { task } })}
              onDelete={taskId => dispatch({ type: 'DELETE_TASK', payload: { taskId } })}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="flex items-baseline gap-1.5 px-3.5 py-2 rounded-2xl"
      style={{
        background: 'rgba(255,255,255,0.16)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.25)',
      }}
    >
      <span className="text-white font-bold text-lg leading-none">{value}</span>
      <span className="text-white/70 text-xs">{label}</span>
    </div>
  );
}

// ── Bucket card ──────────────────────────────────────────────────────────────

function BucketCard({
  bucket, label, sub, tasks, clients, accentFor, onAdd, onToggle, onEdit, onDelete,
}: {
  bucket: TaskBucket;
  label: string;
  sub: string;
  tasks: PersonalTask[];
  clients: Client[];
  accentFor: (clientId?: string) => string;
  onAdd: (task: PersonalTask) => void;
  onToggle: (taskId: string) => void;
  onEdit: (task: PersonalTask) => void;
  onDelete: (taskId: string) => void;
}) {
  const [text, setText] = useState('');
  const [clientId, setClientId] = useState<string | undefined>(undefined);
  const [dueDate, setDueDate] = useState('');

  const active = tasks.filter(t => !t.done);
  const done = tasks.filter(t => t.done);

  function add() {
    const t = text.trim();
    if (!t) return;
    onAdd({
      id: generateId(),
      text: t,
      bucket,
      clientId,
      dueDate: dueDate || undefined,
      done: false,
      createdAt: new Date().toISOString(),
    });
    setText('');
    setClientId(undefined);
    setDueDate('');
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-stone-100">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold text-stone-900 text-sm">{label}</h2>
          <span className="text-xs text-stone-400 font-medium">{active.length}</span>
        </div>
        <p className="text-xs text-stone-400 mt-0.5">{sub}</p>
      </div>

      {/* Quick add */}
      <div className="px-3 pt-3">
        <div className="flex items-center gap-2 border border-stone-200 rounded-xl px-3 py-2 focus-within:border-stone-400 transition-colors">
          <Plus size={15} className="text-stone-300 shrink-0" />
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="Add a task…"
            className="flex-1 text-sm bg-transparent focus:outline-none text-stone-700 placeholder-stone-400 min-w-0"
          />
        </div>
        {/* Tag row */}
        <div className="flex items-center gap-2 mt-2 mb-1">
          <ClientPicker clients={clients} value={clientId} onChange={setClientId} accentFor={accentFor} />
          <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs text-stone-500 hover:border-stone-400 transition-colors cursor-pointer">
            <Calendar size={12} />
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="bg-transparent focus:outline-none text-stone-600 w-[88px]"
            />
          </label>
          {text.trim() && (
            <button onClick={add} className="ml-auto px-3 py-1.5 rounded-lg bg-[#1f1f1f] text-white text-xs font-medium hover:bg-stone-700 transition-colors">
              Add
            </button>
          )}
        </div>
      </div>

      {/* Task list */}
      <div className="px-2 pb-3 pt-1">
        {active.length === 0 && done.length === 0 && (
          <p className="text-xs text-stone-300 text-center py-6">Nothing here yet</p>
        )}

        {active.map(task => (
          <TaskRow
            key={task.id}
            task={task}
            clients={clients}
            accentFor={accentFor}
            onToggle={() => onToggle(task.id)}
            onEdit={onEdit}
            onDelete={() => onDelete(task.id)}
          />
        ))}

        {/* Completed */}
        {done.length > 0 && (
          <div className="mt-2 pt-2 border-t border-stone-100">
            <p className="text-[10px] font-medium text-stone-300 uppercase tracking-wide px-2 mb-1">
              Done ({done.length})
            </p>
            {done.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                clients={clients}
                accentFor={accentFor}
                onToggle={() => onToggle(task.id)}
                onEdit={onEdit}
                onDelete={() => onDelete(task.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({
  task, clients, accentFor, onToggle, onEdit, onDelete,
}: {
  task: PersonalTask;
  clients: Client[];
  accentFor: (clientId?: string) => string;
  onToggle: () => void;
  onEdit: (task: PersonalTask) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.text);

  const client = task.clientId ? clients.find(c => c.id === task.clientId) : undefined;
  const accent = accentFor(task.clientId);
  const overdue = !task.done && isOverdue(task.dueDate);

  function saveEdit() {
    const t = draft.trim();
    if (t) onEdit({ ...task, text: t });
    else setDraft(task.text);
    setEditing(false);
  }

  return (
    <div className="group flex items-start gap-2.5 px-2 py-2 rounded-lg hover:bg-stone-50 transition-colors">
      {/* Checkbox */}
      <button onClick={onToggle} className="shrink-0 mt-0.5 transition-colors" title={task.done ? 'Mark undone' : 'Mark done'}>
        {task.done
          ? <CheckCircle2 size={18} style={{ color: accent }} />
          : <Circle size={18} className="text-stone-300 hover:text-stone-500" />}
      </button>

      {/* Body */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { setDraft(task.text); setEditing(false); } }}
            className="w-full text-sm text-stone-700 bg-transparent border-b border-stone-300 focus:outline-none pb-0.5"
          />
        ) : (
          <p
            onDoubleClick={() => setEditing(true)}
            className={`text-sm leading-snug cursor-default ${task.done ? 'line-through text-stone-400' : 'text-stone-700'}`}
          >
            {task.text}
          </p>
        )}

        {/* Meta chips */}
        {(client || task.dueDate) && (
          <div className="flex items-center gap-2 mt-1">
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
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
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

function ClientPicker({
  clients, value, onChange, accentFor,
}: {
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
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs text-stone-500 hover:border-stone-400 transition-colors"
      >
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
          <button
            onClick={() => { onChange(undefined); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-stone-500 hover:bg-stone-50 transition-colors"
          >
            {value === undefined && <Check size={12} className="text-stone-700" />}
            <span className={value === undefined ? 'text-stone-900 font-medium' : ''}>No client (personal)</span>
          </button>
          {clients.map(c => (
            <button
              key={c.id}
              onClick={() => { onChange(c.id); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-stone-50 transition-colors"
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: accentFor(c.id) }} />
              <span className={`truncate ${value === c.id ? 'text-stone-900 font-medium' : 'text-stone-600'}`}>{c.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
