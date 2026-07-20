'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Eye, Pencil, Trash2, Check, X } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Observation } from '@/types';
import { generateId } from '@/lib/utils';

// Owner-only screen (Spec 18): her private observation notebook. Topics are
// free text and exist only through use. The observations slice never reaches
// any other role — filterStateForRole strips it server side.

export default function ObservationsView() {
  const { state, dispatch, role } = useApp();
  const router = useRouter();

  const [text, setText] = useState('');
  const [topic, setTopic] = useState('');
  const [clientId, setClientId] = useState('');
  const [filter, setFilter] = useState('');           // '' = all topics
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editTopic, setEditTopic] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const observations = state.observations ?? [];

  // Topics in order of most recent use, with counts.
  const topicCounts = new Map<string, number>();
  for (const o of observations) {
    topicCounts.set(o.topic, (topicCounts.get(o.topic) ?? 0) + 1);
  }
  const topics = Array.from(topicCounts.keys());

  const visible = filter ? observations.filter(o => o.topic === filter) : observations;

  // Group the visible notes by topic, keeping the newest-first order inside.
  const groups: { topic: string; items: Observation[] }[] = [];
  for (const o of visible) {
    const g = groups.find(x => x.topic === o.topic);
    if (g) g.items.push(o);
    else groups.push({ topic: o.topic, items: [o] });
  }

  const clientName = (id?: string) => state.clients.find(c => c.id === id)?.name;
  const clientColor = (id?: string) => state.clients.find(c => c.id === id)?.color;

  function save() {
    const t = text.trim();
    const tp = topic.trim();
    if (!t || !tp) return;
    const now = new Date().toISOString();
    const observation: Observation = {
      id: generateId(),
      topic: tp,
      text: t,
      clientId: clientId || undefined,
      createdAt: now,
      updatedAt: now,
    };
    dispatch({ type: 'ADD_OBSERVATION', payload: { observation } });
    setText('');
    // Topic and client stay picked — writing several notes in a row on the
    // same subject is the common case.
  }

  function startEdit(o: Observation) {
    setEditingId(o.id);
    setEditText(o.text);
    setEditTopic(o.topic);
    setConfirmId(null);
  }

  function saveEdit(o: Observation) {
    const t = editText.trim();
    const tp = editTopic.trim();
    if (!t || !tp) return;
    dispatch({
      type: 'UPDATE_OBSERVATION',
      payload: { observation: { ...o, text: t, topic: tp, updatedAt: new Date().toISOString() } },
    });
    setEditingId(null);
  }

  function remove(id: string) {
    if (confirmId !== id) { setConfirmId(id); return; }
    dispatch({ type: 'DELETE_OBSERVATION', payload: { observationId: id } });
    setConfirmId(null);
  }

  if (role !== 'owner') return null;

  return (
    <div className="min-h-screen bg-stone-50">
      <header
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(120deg, #4c1d95 0%, #7c3aed 55%, #c026d3 100%)' }}
      >
        <div className="relative z-10 px-5 md:px-10 pt-6 pb-7 max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium transition-colors"
            >
              <ArrowLeft size={16} />
              Home
            </button>
          </div>
          <h1
            className="text-white flex items-center gap-3"
            style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: 'clamp(28px, 5vw, 44px)', letterSpacing: '-0.02em' }}
          >
            <Eye size={32} className="shrink-0" />
            Observations
          </h1>
          <p className="text-white/70 text-sm mt-1">
            Your private notebook. Only you can see this.
          </p>
        </div>
      </header>

      <main className="px-4 md:px-10 py-6 max-w-3xl mx-auto space-y-6">
        {/* Quick add */}
        <section className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100">
            <h2 className="font-semibold text-stone-900 text-sm">Note something down</h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Write the observation, give it a topic. New topic words make new buckets.
            </p>
          </div>
          <div className="px-5 py-4 space-y-3">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="What did you notice?"
              rows={3}
              className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent resize-y"
            />
            {topics.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {topics.map(t => (
                  <button
                    key={t}
                    onClick={() => setTopic(topic === t ? '' : t)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      topic === t
                        ? 'bg-stone-900 text-white border-stone-900'
                        : 'bg-stone-50 text-stone-600 border-stone-200 hover:border-stone-400'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <input
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="Topic"
                className="flex-1 min-w-[140px] px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              />
              <select
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                className="px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              >
                <option value="">No client</option>
                {state.clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                onClick={save}
                disabled={!text.trim() || !topic.trim()}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-stone-900 hover:bg-stone-700 disabled:opacity-40 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </section>

        {/* Topic filter */}
        {topics.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilter('')}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                filter === ''
                  ? 'bg-stone-900 text-white border-stone-900'
                  : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
              }`}
            >
              All
            </button>
            {topics.map(t => (
              <button
                key={t}
                onClick={() => setFilter(filter === t ? '' : t)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  filter === t
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
                }`}
              >
                {t} <span className="opacity-50">{topicCounts.get(t)}</span>
              </button>
            ))}
          </div>
        )}

        {/* Notes, grouped by topic */}
        {observations.length === 0 ? (
          <section className="bg-white rounded-2xl border border-stone-200 px-5 py-8 text-center">
            <p className="text-sm text-stone-400">
              Nothing here yet. Your first observation starts the notebook.
            </p>
          </section>
        ) : (
          groups.map(group => (
            <section key={group.topic} className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-stone-100 flex items-center gap-2">
                <h2 className="font-semibold text-stone-900 text-sm">{group.topic}</h2>
                <span className="text-xs text-stone-400">{group.items.length}</span>
              </div>
              <ul className="divide-y divide-stone-100">
                {group.items.map(o => (
                  <li key={o.id} className="px-5 py-3.5">
                    {editingId === o.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent resize-y"
                        />
                        <div className="flex flex-wrap gap-2">
                          <input
                            value={editTopic}
                            onChange={e => setEditTopic(e.target.value)}
                            placeholder="Topic"
                            className="flex-1 min-w-[120px] px-3 py-1.5 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                          />
                          <button
                            onClick={() => saveEdit(o)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-stone-900 hover:bg-stone-700 transition-colors flex items-center gap-1"
                          >
                            <Check size={13} /> Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-stone-500 border border-stone-200 hover:border-stone-400 transition-colors flex items-center gap-1"
                          >
                            <X size={13} /> Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-stone-800 whitespace-pre-wrap">{o.text}</p>
                          <p className="text-xs text-stone-400 mt-1 flex items-center gap-1.5">
                            {clientName(o.clientId) && (
                              <>
                                <span
                                  className="w-2 h-2 rounded-full inline-block"
                                  style={{ backgroundColor: clientColor(o.clientId) }}
                                />
                                {clientName(o.clientId)}
                                <span className="text-stone-300">·</span>
                              </>
                            )}
                            {new Date(o.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                        <button
                          onClick={() => startEdit(o)}
                          className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors shrink-0"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => remove(o.id)}
                          className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                            confirmId === o.id
                              ? 'text-white bg-red-500 hover:bg-red-600'
                              : 'text-stone-400 hover:text-red-500 hover:bg-red-50'
                          }`}
                          title={confirmId === o.id ? 'Tap again to delete' : 'Delete'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </main>
    </div>
  );
}
