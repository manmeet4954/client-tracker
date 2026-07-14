'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, Check, Calendar, Trash2, Pencil,
  ChevronDown, CheckCircle2, Circle, Sparkles, Users, Network,
  Instagram, Pin, PinOff, Repeat, Ban,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { generateId, formatDate, formatMonthKey } from '@/lib/utils';
import {
  PersonalTask, TaskRepeat, TaskType, Client, ContentCard,
  ContentStage, CONTENT_STAGES, AgendaItem,
} from '@/types';
import CardEditor from './CardEditor';
import Modal from './Modal';

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

  // When she starts a Content task, the real card editor opens here, pre-filled.
  const [contentFlow, setContentFlow] = useState<{ clientIds: string[]; card: ContentCard } | null>(null);
  // The task whose full edit modal is open (pencil control). Null = closed.
  const [editTask, setEditTask] = useState<PersonalTask | null>(null);

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

  // A content task shows its linked card's live stage — read from state, never
  // copied. If it has several cards, the first found card's stage wins.
  function contentStageOf(task: PersonalTask): ContentStage | null {
    if (task.taskType !== 'content' || !task.linkedCards?.length) return null;
    for (const lc of task.linkedCards) {
      const card = state.clientData[lc.clientId]?.contentCards?.find(c => c.id === lc.cardId);
      if (card) return card.stage;
    }
    return null;
  }

  // ── Content flow: open the real card editor, fill once, one card per client ──
  function startContent(clientIds: string[], title: string, dueDate: string) {
    const first = clientIds[0];
    if (!first) return;
    const now = new Date().toISOString();
    const platforms = state.clientData[first]?.platforms ?? [];
    setContentFlow({
      clientIds,
      card: {
        id: generateId(), pillarId: '', title, hook: '', content: '', link: '',
        stage: 'idea', contentType: '', role: '',
        platform: platforms.length > 1 ? platforms[0] : undefined,
        scheduledDate: dueDate || '', postUrl: '', notes: '', customValues: {},
        createdMonth: formatMonthKey(new Date()), createdAt: now, updatedAt: now,
      },
    });
  }

  function saveContent(draft: ContentCard) {
    if (!contentFlow) return;
    const now = new Date().toISOString();
    const linkedCards: { clientId: string; cardId: string }[] = [];
    contentFlow.clientIds.forEach((cid, i) => {
      const cardId = generateId();
      const card: ContentCard = {
        ...draft,
        id: cardId,
        // A pillar id belongs to the first client only; other clients start Unsorted.
        pillarId: i === 0 ? draft.pillarId : '',
        collabId: undefined,
        collabWith: undefined,
        createdMonth: draft.createdMonth || formatMonthKey(new Date()),
        createdAt: now,
        updatedAt: now,
      };
      dispatch({ type: 'ADD_CONTENT_CARD', payload: { clientId: cid, card } });
      linkedCards.push({ clientId: cid, cardId });
    });
    const task: PersonalTask = {
      id: generateId(), text: draft.title || 'Untitled post', bucket: 'todo',
      taskType: 'content', clientIds: [...contentFlow.clientIds],
      dueDate: draft.scheduledDate || undefined, linkedCards,
      done: false, createdAt: now,
    };
    dispatch({ type: 'ADD_TASK', payload: { task } });
    setContentFlow(null);
  }

  // ── Client task: an agenda item on each chosen client's Dashboard ──
  function addClientTask(clientIds: string[], text: string, dueDate: string) {
    const now = new Date().toISOString();
    const month = dueDate ? dueDate.slice(0, 7) : formatMonthKey(new Date());
    const linkedAgenda: { clientId: string; month: string; itemId: string }[] = [];
    clientIds.forEach(cid => {
      const itemId = generateId();
      const item: AgendaItem = { id: itemId, text, dueDate, done: false };
      dispatch({ type: 'ADD_AGENDA', payload: { clientId: cid, month, item } });
      linkedAgenda.push({ clientId: cid, month, itemId });
    });
    const task: PersonalTask = {
      id: generateId(), text, bucket: 'todo', taskType: 'client-task',
      clientIds: [...clientIds], dueDate: dueDate || undefined, linkedAgenda,
      done: false, createdAt: now,
    };
    dispatch({ type: 'ADD_TASK', payload: { task } });
  }

  // ── Two-way sync on tick ──
  function toggleTask(task: PersonalTask) {
    if (task.taskType === 'content' && task.linkedCards?.length) {
      // Ticking done pushes every linked card to Posted.
      if (!task.done) {
        task.linkedCards.forEach(lc =>
          dispatch({ type: 'MOVE_CONTENT_CARD', payload: { clientId: lc.clientId, cardId: lc.cardId, stage: 'posted' } }));
      }
      dispatch({ type: 'TOGGLE_TASK', payload: { taskId: task.id } });
      return;
    }
    if (task.taskType === 'client-task' && task.linkedAgenda?.length) {
      // Keep the linked agenda items in step with the task's new done state.
      const target = !task.done;
      task.linkedAgenda.forEach(la => {
        const item = state.clientData[la.clientId]?.monthData?.[la.month]?.agenda.find(i => i.id === la.itemId);
        if (item && item.done !== target) {
          dispatch({ type: 'TOGGLE_AGENDA', payload: { clientId: la.clientId, month: la.month, itemId: la.itemId } });
        }
      });
      dispatch({ type: 'TOGGLE_TASK', payload: { taskId: task.id } });
      return;
    }
    dispatch({ type: 'TOGGLE_TASK', payload: { taskId: task.id } });
  }

  // Deleting (or dropping) a task removes the client-side windows it opened:
  // the linked content card(s) and/or agenda item(s), then the task itself.
  function deleteTask(task: PersonalTask) {
    task.linkedCards?.forEach(lc =>
      dispatch({ type: 'DELETE_CONTENT_CARD', payload: { clientId: lc.clientId, cardId: lc.cardId } }));
    task.linkedAgenda?.forEach(la =>
      dispatch({ type: 'DELETE_AGENDA', payload: { clientId: la.clientId, month: la.month, itemId: la.itemId } }));
    dispatch({ type: 'DELETE_TASK', payload: { taskId: task.id } });
  }

  // ── Save from the edit modal ──
  // Move any linked content card(s) if the stage changed, then persist the
  // task's own edited fields. Non-content tasks pass newStage = null.
  function saveTaskEdit(updated: PersonalTask, newStage: ContentStage | null) {
    if (newStage && updated.linkedCards?.length) {
      updated.linkedCards.forEach(lc =>
        dispatch({ type: 'MOVE_CONTENT_CARD', payload: { clientId: lc.clientId, cardId: lc.cardId, stage: newStage } }));
    }
    dispatch({ type: 'EDIT_TASK', payload: { task: updated } });
    setEditTask(null);
  }

  // Renders one auto-sorted section as a card. Overdue + Today fill the split's
  // right column; This Week + Later sit full width below it. Same behavior as
  // before: empty sections vanish, except Today which always shows.
  function renderSection(id: Section) {
    const sec = SECTION_META.find(s => s.id === id)!;
    const list = bySection(id);
    if (list.length === 0 && id !== 'today') return null;
    return (
      <div className="bg-white rounded-2xl border border-stone-200">
        <div className="px-4 pt-4 pb-3 border-b border-stone-100 flex items-baseline justify-between">
          <div>
            <h2 className={`font-semibold text-sm ${id === 'overdue' ? 'text-red-600' : 'text-stone-900'}`}>{sec.label}</h2>
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
              stage={contentStageOf(task)}
              showPin={id === 'week' || id === 'later'}
              onToggle={() => toggleTask(task)}
              onEdit={t => dispatch({ type: 'EDIT_TASK', payload: { task: t } })}
              onOpenEdit={setEditTask}
              onDelete={() => deleteTask(task)}
            />
          ))}
        </div>
      </div>
    );
  }

  const firstClient = contentFlow?.clientIds[0];
  const flowData = firstClient ? state.clientData[firstClient] : undefined;

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
        {/* ── Quick add (first) ── */}
        <QuickAdd
          clients={state.clients}
          accentFor={accentFor}
          onAddPersonal={task => dispatch({ type: 'ADD_TASK', payload: { task } })}
          onStartContent={startContent}
          onAddClientTask={addClientTask}
        />

        {/* ── Split: Going live (left) + Today's to-do (right) ── */}
        <div className="grid md:grid-cols-2 gap-5 items-start">
          {/* Left: posts going live today, pulled from Content cards */}
          <div className="bg-white rounded-2xl border border-stone-200">
            <div className="px-4 pt-4 pb-3 border-b border-stone-100 flex items-center gap-2">
              <Instagram size={15} className="text-pink-500" />
              <h2 className="font-semibold text-stone-900 text-sm">Going live</h2>
              {livePosts.length > 0 && <span className="text-xs text-stone-400 font-medium ml-auto">{livePosts.length}</span>}
            </div>
            {livePosts.length > 0 ? (
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
            ) : (
              <p className="text-xs text-stone-400 text-center py-8">Nothing going live today</p>
            )}
          </div>

          {/* Right: today's to-do — overdue first, then due today or pinned */}
          <div className="space-y-5">
            {renderSection('overdue')}
            {renderSection('today')}
          </div>
        </div>

        {/* ── This Week + Later (full width, below the split) ── */}
        {renderSection('week')}
        {renderSection('later')}

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
                  stage={contentStageOf(task)}
                  showPin={false}
                  onToggle={() => toggleTask(task)}
                  onEdit={t => dispatch({ type: 'EDIT_TASK', payload: { task: t } })}
                  onOpenEdit={setEditTask}
                  onDelete={() => deleteTask(task)}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {contentFlow && flowData && firstClient && (
        <CardEditor
          card={contentFlow.card}
          pillars={flowData.pillars ?? []}
          customFields={flowData.customFields ?? []}
          platforms={flowData.platforms ?? []}
          sourceClientId={firstClient}
          onClose={() => setContentFlow(null)}
          onSave={saveContent}
        />
      )}

      {editTask && (
        <EditTaskModal
          task={editTask}
          clients={state.clients}
          accentFor={accentFor}
          currentStage={contentStageOf(editTask)}
          onClose={() => setEditTask(null)}
          onSave={saveTaskEdit}
        />
      )}
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

const TASK_TYPE_TABS: { id: TaskType; label: string }[] = [
  { id: 'content', label: 'Content' },
  { id: 'client-task', label: 'Client task' },
  { id: 'personal', label: 'Personal' },
];

function QuickAdd({ clients, accentFor, onAddPersonal, onStartContent, onAddClientTask }: {
  clients: Client[];
  accentFor: (clientId?: string) => string;
  onAddPersonal: (task: PersonalTask) => void;
  onStartContent: (clientIds: string[], title: string, dueDate: string) => void;
  onAddClientTask: (clientIds: string[], text: string, dueDate: string) => void;
}) {
  const [taskType, setTaskType] = useState<TaskType>('personal');
  const [text, setText] = useState('');
  const [clientId, setClientId] = useState<string | undefined>(undefined); // personal, single
  const [clientIds, setClientIds] = useState<string[]>([]);                // content / client task
  const [dueDate, setDueDate] = useState('');
  const [repeat, setRepeat] = useState<TaskRepeat>('');

  const needsClients = taskType === 'content' || taskType === 'client-task';
  const canAdd =
    taskType === 'content' ? clientIds.length > 0
    : taskType === 'client-task' ? !!text.trim() && clientIds.length > 0
    : !!text.trim();

  function reset() {
    setText(''); setClientId(undefined); setClientIds([]); setDueDate(''); setRepeat('');
  }

  function toggleClient(id: string) {
    setClientIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function add() {
    if (!canAdd) return;
    if (taskType === 'content') {
      onStartContent(clientIds, text.trim(), dueDate);
      reset();
      return;
    }
    if (taskType === 'client-task') {
      onAddClientTask(clientIds, text.trim(), dueDate);
      reset();
      return;
    }
    onAddPersonal({
      id: generateId(), text: text.trim(), bucket: 'todo', taskType: 'personal',
      clientIds: clientId ? [clientId] : [],
      dueDate: dueDate || undefined, repeat: repeat || undefined,
      done: false, createdAt: new Date().toISOString(),
    });
    reset();
  }

  const placeholder =
    taskType === 'content' ? 'Post title (optional) — set the rest in the editor'
    : taskType === 'client-task' ? 'What needs doing for the client?'
    : 'Add a task… set a date and it sorts itself';

  return (
    <div className="bg-white rounded-2xl border border-stone-200 px-3 py-3">
      {/* Type picker */}
      <div className="flex items-center gap-0.5 mb-2.5 bg-stone-100 rounded-lg p-0.5 w-fit">
        {TASK_TYPE_TABS.map(t => (
          <button key={t.id} onClick={() => setTaskType(t.id)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              taskType === t.id ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 border border-stone-200 rounded-xl px-3 py-2 focus-within:border-stone-400 transition-colors">
        <Plus size={15} className="text-stone-300 shrink-0" />
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder={placeholder}
          className="flex-1 text-sm bg-transparent focus:outline-none text-stone-700 placeholder-stone-400 min-w-0"
        />
      </div>

      {/* Chosen client chips (content / client task) */}
      {needsClients && clientIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          {clientIds.map(id => {
            const c = clients.find(x => x.id === id);
            if (!c) return null;
            return (
              <span key={id} className="inline-flex items-center gap-1 text-[11px] text-stone-600 bg-stone-100 rounded-full pl-2 pr-1 py-0.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accentFor(id) }} />
                {c.name}
                <button onClick={() => toggleClient(id)} className="p-0.5 rounded-full text-stone-400 hover:text-red-500 transition-colors" title="Remove">
                  <Ban size={11} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-2">
        {needsClients ? (
          <MultiClientPicker clients={clients} values={clientIds} onToggle={toggleClient} accentFor={accentFor} />
        ) : (
          <ClientPicker clients={clients} value={clientId} onChange={setClientId} accentFor={accentFor} />
        )}
        <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs text-stone-500 hover:border-stone-400 transition-colors cursor-pointer">
          <Calendar size={12} />
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="bg-transparent focus:outline-none text-stone-600 w-[88px]" />
        </label>
        {taskType === 'personal' && (
          <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs text-stone-500 hover:border-stone-400 transition-colors">
            <Repeat size={12} />
            <select value={repeat} onChange={e => setRepeat(e.target.value as TaskRepeat)} className="bg-transparent focus:outline-none text-stone-600">
              <option value="">Once</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
        )}
        {canAdd && (
          <button onClick={add} className="ml-auto px-3 py-1.5 rounded-lg bg-[#1f1f1f] text-white text-xs font-medium hover:bg-stone-700 transition-colors">
            {taskType === 'content' ? 'Next: write the post' : 'Add'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({ task, clients, accentFor, today, stage, showPin, onToggle, onEdit, onOpenEdit, onDelete }: {
  task: PersonalTask;
  clients: Client[];
  accentFor: (clientId?: string) => string;
  today: string;
  stage: ContentStage | null;
  showPin: boolean;
  onToggle: () => void;
  onEdit: (task: PersonalTask) => void;      // quick writes: inline rename, pin toggle
  onOpenEdit: (task: PersonalTask) => void;  // opens the full edit modal (pencil)
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.text);

  const taskClients = (task.clientIds ?? []).map(id => clients.find(c => c.id === id)).filter(Boolean) as Client[];
  const accent = accentFor(task.clientIds?.[0]);
  const overdue = !task.done && !!task.dueDate && task.dueDate < today;
  const pinned = task.pinnedOn === today;
  const isContent = task.taskType === 'content';
  const stageMeta = stage ? CONTENT_STAGES.find(s => s.id === stage) : undefined;

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

        {(taskClients.length > 0 || task.dueDate || task.repeat || pinned || stageMeta) && (
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {stageMeta && (
              <span className="text-[11px] font-medium rounded-full px-1.5 py-0.5"
                style={{ color: stageMeta.color, backgroundColor: stageMeta.bg }} title="Live stage of the linked post">
                {stageMeta.label}
              </span>
            )}
            {taskClients.map(c => (
              <span key={c.id} className="inline-flex items-center gap-1 text-[11px] text-stone-500">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accentFor(c.id) }} />
                {c.name}
              </span>
            ))}
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
        <button onClick={() => onOpenEdit(task)} className="p-1 rounded text-stone-400 hover:text-stone-700 transition-colors" title="Edit task">
          <Pencil size={13} />
        </button>
        <button onClick={onDelete} className="p-1 rounded text-stone-400 hover:text-red-500 transition-colors"
          title={isContent ? 'Drop this post (deletes the card)' : 'Delete'}>
          {isContent ? <Ban size={13} /> : <Trash2 size={13} />}
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

// ── Multi client picker (content + client tasks) ─────────────────────────────
// Same dropdown pattern as ClientPicker, but stays open and toggles many.
// Chosen clients render as chips in QuickAdd.

function MultiClientPicker({ clients, values, onToggle, accentFor }: {
  clients: Client[];
  values: string[];
  onToggle: (id: string) => void;
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

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs text-stone-500 hover:border-stone-400 transition-colors">
        <Users size={12} className="text-stone-400" />
        <span className={values.length ? 'text-stone-700' : 'text-stone-400'}>
          {values.length ? `${values.length} client${values.length > 1 ? 's' : ''}` : 'Pick clients'}
        </span>
        <ChevronDown size={12} className="text-stone-400" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-56 bg-white border border-stone-200 rounded-xl shadow-xl py-1 max-h-[60vh] overflow-y-auto">
          {clients.length === 0 && <p className="px-3 py-2 text-xs text-stone-400">No clients yet</p>}
          {clients.map(c => {
            const sel = values.includes(c.id);
            return (
              <button key={c.id} onClick={() => onToggle(c.id)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-stone-50 transition-colors">
                <span className="w-4 shrink-0">{sel && <Check size={12} className="text-stone-700" />}</span>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: accentFor(c.id) }} />
                <span className={`truncate ${sel ? 'text-stone-900 font-medium' : 'text-stone-600'}`}>{c.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Edit task modal ──────────────────────────────────────────────────────────
// The pencil on any TaskRow opens this. It edits the task's own fields (name,
// clients, due date, repeat) and — for a content task — its live stage, which
// moves the linked post on the board so both surfaces stay in step. Clients
// here are display tags; changing them does not add or remove linked cards.

function EditTaskModal({ task, clients, accentFor, currentStage, onClose, onSave }: {
  task: PersonalTask;
  clients: Client[];
  accentFor: (clientId?: string) => string;
  currentStage: ContentStage | null;
  onClose: () => void;
  onSave: (updated: PersonalTask, newStage: ContentStage | null) => void;
}) {
  const [name, setName] = useState(task.text);
  const [clientIds, setClientIds] = useState<string[]>(task.clientIds ?? []);
  const [dueDate, setDueDate] = useState(task.dueDate ?? '');
  const [repeat, setRepeat] = useState<TaskRepeat>(task.repeat ?? '');
  const [stage, setStage] = useState<ContentStage>(currentStage ?? 'idea');

  // Only content tasks with a live linked card get the stage control.
  const isContent = task.taskType === 'content' && !!task.linkedCards?.length && currentStage !== null;

  function toggleClient(id: string) {
    setClientIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function save() {
    const updated: PersonalTask = {
      ...task,
      text: name.trim() || task.text,
      clientIds,
      dueDate: dueDate || undefined,
      repeat: repeat || undefined,
    };
    const newStage = isContent && stage !== currentStage ? stage : null;
    onSave(updated, newStage);
  }

  const fieldCls =
    'text-sm text-stone-700 border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-stone-400 transition-colors bg-white';

  return (
    <Modal open onClose={onClose} title="Edit task">
      <div className="p-5 space-y-4">
        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Name</label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); }}
            className={`w-full ${fieldCls}`}
          />
        </div>

        {/* Clients */}
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Clients</label>
          {clientIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {clientIds.map(id => {
                const c = clients.find(x => x.id === id);
                if (!c) return null;
                return (
                  <span key={id} className="inline-flex items-center gap-1 text-[11px] text-stone-600 bg-stone-100 rounded-full pl-2 pr-1 py-0.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accentFor(id) }} />
                    {c.name}
                    <button onClick={() => toggleClient(id)} className="p-0.5 rounded-full text-stone-400 hover:text-red-500 transition-colors" title="Remove">
                      <Ban size={11} />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          <MultiClientPicker clients={clients} values={clientIds} onToggle={toggleClient} accentFor={accentFor} />
        </div>

        {/* Due date + Repeat */}
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Due date</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={fieldCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Repeat</label>
            <select value={repeat} onChange={e => setRepeat(e.target.value as TaskRepeat)} className={fieldCls}>
              <option value="">Once</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>

        {/* Stage (content tasks only) */}
        {isContent && (
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Stage</label>
            <select value={stage} onChange={e => setStage(e.target.value as ContentStage)} className={fieldCls}>
              {CONTENT_STAGES.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <p className="text-[11px] text-stone-400 mt-1.5">Moves the linked post on the board too.</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-stone-100">
        <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs font-medium text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors">
          Cancel
        </button>
        <button onClick={save} className="px-3 py-1.5 rounded-lg bg-[#1f1f1f] text-white text-xs font-medium hover:bg-stone-700 transition-colors">
          Save
        </button>
      </div>
    </Modal>
  );
}
