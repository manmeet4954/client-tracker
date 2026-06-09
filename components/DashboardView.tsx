'use client';

import { useState, useRef, useEffect } from 'react';
import {
  ChevronLeft, ChevronRight, CheckCircle2, Circle,
  Trash2, Plus, CalendarPlus, Target, Pencil, Check,
} from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import { generateId, formatMonthKey, formatMonthLabel, prevMonth, nextMonth, formatDate } from '@/lib/utils';
import { AgendaItem } from '@/types';

function pickAccent(brandColors: { hex: string; role?: string }[] | undefined, fallback: string): string {
  if (!brandColors?.length) return fallback;
  const primary = brandColors.find(c => /primary|accent/i.test(c.role ?? ''));
  return primary?.hex ?? brandColors[0]?.hex ?? fallback;
}

export default function DashboardView({ clientId }: { clientId: string }) {
  const { dispatch, selectedMonth: month, setSelectedMonth: setMonth } = useApp();
  const { client, data } = useClient(clientId);
  const accent = client ? pickAccent(data.brandKit?.colors, client.color) : '#ea4711';
  const [newItem, setNewItem] = useState('');
  const [newDue, setNewDue] = useState('');
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetDraft, setTargetDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const targetInputRef = useRef<HTMLInputElement>(null);

  const agenda = (data.monthData[month] ?? { agenda: [] }).agenda;
  const agendaDone = agenda.filter(i => i.done).length;
  const agendaTotal = agenda.length;

  // Count posts in Done OR Scheduled/Posted for this month only
  const postsDone = data.cards.filter(c =>
    (c.columnId === 'done' || c.columnId === 'scheduled') &&
    c.createdMonth === month
  ).length;
  const postTarget = data.postTarget ?? 0;
  const postPct = postTarget === 0 ? 0 : Math.min(100, Math.round((postsDone / postTarget) * 100));

  useEffect(() => {
    if (agendaTotal === 0) inputRef.current?.focus();
  }, [month, agendaTotal]);

  useEffect(() => {
    if (editingTarget) targetInputRef.current?.focus();
  }, [editingTarget]);

  function saveTarget() {
    const val = parseInt(targetDraft, 10);
    if (!isNaN(val) && val >= 0) {
      dispatch({ type: 'SET_POST_TARGET', payload: { clientId, target: val } });
    }
    setEditingTarget(false);
  }

  function addItem() {
    const text = newItem.trim();
    if (!text) return;
    const item: AgendaItem = { id: generateId(), text, dueDate: newDue, done: false };
    dispatch({ type: 'ADD_AGENDA', payload: { clientId, month, item } });
    setNewItem('');
    setNewDue('');
    inputRef.current?.focus();
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-5">

      {/* Month nav */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg md:text-xl font-semibold text-stone-900">{formatMonthLabel(month)}</h2>
          <p className="text-sm text-stone-400 mt-0.5">Monthly overview</p>
        </div>
        <div className="flex items-center gap-1 bg-white border border-stone-200 rounded-lg p-0.5">
          <button onClick={() => setMonth(prevMonth(month))} className="p-1.5 rounded-md text-stone-500 hover:text-stone-900 hover:bg-stone-50 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setMonth(formatMonthKey(new Date()))} className="px-3 py-1 text-xs text-stone-500 hover:text-stone-900 transition-colors">
            Today
          </button>
          <button onClick={() => setMonth(nextMonth(month))} className="p-1.5 rounded-md text-stone-500 hover:text-stone-900 hover:bg-stone-50 transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* ── POST TARGET (primary metric) ── */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target size={15} style={{ color: accent }} />
            <h3 className="font-semibold text-stone-900 text-sm">Monthly Post Target</h3>
          </div>
          {/* Editable target */}
          <div className="flex items-center gap-2">
            {editingTarget ? (
              <div className="flex items-center gap-1">
                <input
                  ref={targetInputRef}
                  type="number"
                  min={0}
                  value={targetDraft}
                  onChange={e => setTargetDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveTarget(); if (e.key === 'Escape') setEditingTarget(false); }}
                  onFocus={e => (e.currentTarget.style.borderColor = accent)}
                  onBlur={e => { e.currentTarget.style.borderColor = ''; saveTarget(); }}
                  className="w-16 text-center text-sm border border-stone-300 rounded-md px-2 py-1 focus:outline-none"
                  placeholder="0"
                />
                <button onClick={saveTarget} className="p-1 text-emerald-500 hover:text-emerald-600">
                  <Check size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setTargetDraft(String(postTarget || '')); setEditingTarget(true); }}
                className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-900 transition-colors group"
              >
                <span className="font-medium">{postTarget > 0 ? `Target: ${postTarget} posts` : 'Set target'}</span>
                <Pencil size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
          </div>
        </div>

        <div className="px-5 py-5">
          {postTarget === 0 ? (
            // No target set yet
            <div className="text-center py-4">
              <Target size={32} className="mx-auto mb-3 text-stone-200" />
              <p className="text-stone-500 text-sm font-medium">No monthly target set</p>
              <p className="text-stone-400 text-xs mt-1 mb-4">Set a target to track your post progress</p>
              <button
                onClick={() => { setTargetDraft(''); setEditingTarget(true); }}
                className="px-4 py-2 text-sm font-medium bg-[#1f1f1f] text-white rounded-lg hover:bg-stone-700 transition-colors"
              >
                Set monthly target
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-6">
              {/* Big number */}
              <div className="flex-shrink-0 text-center">
                <div className="text-4xl font-bold text-stone-900">{postsDone}</div>
                <div className="text-sm text-stone-400 mt-0.5">of {postTarget}</div>
              </div>

              {/* Progress */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-stone-600 font-medium">
                    {postsDone >= postTarget
                      ? '🎉 Target reached!'
                      : `${postTarget - postsDone} post${postTarget - postsDone !== 1 ? 's' : ''} to go`}
                  </span>
                  <span className="text-sm font-semibold text-stone-700">{postPct}%</span>
                </div>
                <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${postPct}%`,
                      backgroundColor: postPct >= 100 ? '#10B981' : accent,
                    }}
                  />
                </div>
                <p className="text-xs text-stone-400 mt-2">
                  Counts cards moved to <strong className="text-stone-500">Done</strong> in Kanban this month
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── AGENDA + DEADLINES ── */}
      <div className="flex flex-col md:grid md:grid-cols-5 gap-5">

        {/* Agenda */}
        <div className="md:col-span-3 bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-stone-900 text-sm">Agenda</h3>
              <p className="text-xs text-stone-400 mt-0.5">{agendaDone} of {agendaTotal} items complete</p>
            </div>
            <span className="text-xs font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">{agendaTotal} items</span>
          </div>

          {agendaTotal > 0 && (
            <div className="px-5 py-3 border-b border-stone-100">
              <div className="flex items-center justify-between text-xs text-stone-500 mb-1.5">
                <span>Progress</span>
                <span className="font-medium text-stone-700">
                  {Math.round((agendaDone / agendaTotal) * 100)}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.round((agendaDone / agendaTotal) * 100)}%`,
                    backgroundColor: agendaDone === agendaTotal ? '#10B981' : accent,
                  }}
                />
              </div>
            </div>
          )}

          <div className="divide-y divide-stone-50">
            {agenda.length === 0 && (
              <div
                className="px-5 py-8 text-center cursor-text"
                onClick={() => inputRef.current?.focus()}
              >
                <CalendarPlus size={28} className="mx-auto mb-2 text-stone-300" />
                <p className="text-stone-400 text-sm">No agenda items for this month yet.</p>
                <p className="text-stone-400 text-xs mt-1">Type below and press <kbd className="px-1 py-0.5 bg-stone-100 rounded text-stone-500 font-mono text-[10px]">Enter</kbd> to add.</p>
              </div>
            )}
            {agenda.map(item => (
              <AgendaRow
                key={item.id}
                item={item}
                accent={accent}
                onToggle={() => dispatch({ type: 'TOGGLE_AGENDA', payload: { clientId, month, itemId: item.id } })}
                onDelete={() => dispatch({ type: 'DELETE_AGENDA', payload: { clientId, month, itemId: item.id } })}
                onTextChange={text => dispatch({ type: 'UPDATE_AGENDA_TEXT', payload: { clientId, month, itemId: item.id, text } })}
              />
            ))}
          </div>

          <div className="px-4 py-3 border-t border-stone-200 bg-stone-50 flex items-center gap-2">
            <Plus size={15} className="text-stone-400 shrink-0" />
            <input
              ref={inputRef}
              value={newItem}
              onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addItem()}
              placeholder="Add agenda item and press Enter..."
              className="flex-1 text-sm text-stone-700 placeholder-stone-400 bg-transparent focus:outline-none"
            />
            <input
              type="date"
              value={newDue}
              onChange={e => setNewDue(e.target.value)}
              className="text-xs text-stone-500 border border-stone-200 rounded px-1.5 py-0.5 bg-white focus:outline-none cursor-pointer hidden sm:block"
            />
            <button
              onClick={addItem}
              disabled={!newItem.trim()}
              className="px-3 py-1.5 text-xs font-medium bg-[#1f1f1f] text-white rounded-md disabled:opacity-20 hover:bg-stone-700 transition-colors shrink-0"
            >
              Add
            </button>
          </div>
        </div>

        {/* Upcoming Deadlines */}
        <div className="md:col-span-2 bg-white rounded-xl border border-stone-200 p-5">
          <h3 className="font-semibold text-stone-900 text-sm mb-3">Upcoming Deadlines</h3>
          {agenda.filter(i => !i.done && i.dueDate).length === 0 ? (
            <p className="text-xs text-stone-400">No deadlines set — add a due date to an agenda item.</p>
          ) : (
            <div className="space-y-2">
              {agenda
                .filter(i => !i.done && i.dueDate)
                .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                .slice(0, 6)
                .map(item => (
                  <div key={item.id} className="flex items-start justify-between gap-2">
                    <span className="text-xs text-stone-700 truncate">{item.text}</span>
                    <span className="text-xs text-stone-400 shrink-0">{formatDate(item.dueDate)}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AgendaRow({ item, accent, onToggle, onDelete, onTextChange }: {
  item: AgendaItem;
  accent: string;
  onToggle: () => void;
  onDelete: () => void;
  onTextChange: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);

  function save() {
    if (draft.trim()) onTextChange(draft.trim());
    else setDraft(item.text);
    setEditing(false);
  }

  return (
    <div className="group flex items-center gap-3 px-5 py-3 hover:bg-stone-50 transition-colors">
      <button onClick={onToggle} className="shrink-0 text-stone-400 transition-colors"
        onMouseEnter={e => { if (!item.done) (e.currentTarget as HTMLElement).style.color = accent; }}
        onMouseLeave={e => { if (!item.done) (e.currentTarget as HTMLElement).style.color = ''; }}>
        {item.done ? <CheckCircle2 size={17} className="text-emerald-500" /> : <Circle size={17} />}
      </button>
      {editing ? (
        <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setDraft(item.text); setEditing(false); } }}
          className="flex-1 text-sm text-stone-700 bg-transparent border-b focus:outline-none"
          style={{ borderColor: accent }}
        />
      ) : (
        <span
          onDoubleClick={() => setEditing(true)}
          className={`flex-1 text-sm cursor-default select-none ${item.done ? 'line-through text-stone-400' : 'text-stone-700'}`}
        >
          {item.text}
        </span>
      )}
      {item.dueDate && !editing && (
        <span className="text-xs text-stone-400 shrink-0">{formatDate(item.dueDate)}</span>
      )}
      <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-red-500 transition-all">
        <Trash2 size={13} />
      </button>
    </div>
  );
}
