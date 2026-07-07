'use client';

import { useState } from 'react';
import { Plus, Search, Copy, Check, Trash2, MessageCircle, ShieldAlert, X, PackageOpen } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import { generateId } from '@/lib/utils';
import { LeadAnswer, LEAD_ANSWER_STARTER_CATEGORIES } from '@/types';
import { DIVINE_LEAD_SEED } from '@/lib/divineLeadSeed';
import Modal from './Modal';

/** Copy with a fallback for contexts where the clipboard API is unavailable
 *  (e.g. Instagram's in-app browser). Resolves true when the text was copied. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export default function AnswersView({ clientId }: { clientId: string }) {
  const { dispatch } = useApp();
  const { client, data } = useClient(clientId);
  const isDivine = /divine/i.test(client?.name ?? '');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<LeadAnswer | null>(null);

  const answers = data.leadAnswers ?? [];
  const categories = Array.from(new Set(answers.map(a => a.category)));

  const q = query.trim().toLowerCase();
  const filtered = q
    ? answers.filter(a =>
        [a.question, a.reply, a.category, a.rule ?? ''].some(s => s.toLowerCase().includes(q)))
    : answers;

  function newAnswer(category = '') {
    const now = new Date().toISOString();
    setEditing({ id: generateId(), category, question: '', reply: '', rule: '', createdAt: now, updatedAt: now });
  }

  function save(answer: LeadAnswer) {
    const exists = answers.some(a => a.id === answer.id);
    dispatch({
      type: exists ? 'UPDATE_LEAD_ANSWER' : 'ADD_LEAD_ANSWER',
      payload: { clientId, answer: { ...answer, updatedAt: new Date().toISOString() } },
    });
    setEditing(null);
  }

  function remove(answerId: string) {
    dispatch({ type: 'DELETE_LEAD_ANSWER', payload: { clientId, answerId } });
    setEditing(null);
  }

  function loadSeedPack() {
    const now = new Date().toISOString();
    DIVINE_LEAD_SEED.forEach(seed => {
      dispatch({
        type: 'ADD_LEAD_ANSWER',
        payload: { clientId, answer: { id: generateId(), ...seed, rule: seed.rule ?? '', createdAt: now, updatedAt: now } },
      });
    });
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div>
          <h2 className="text-lg font-bold text-stone-900">Lead Answers</h2>
          <p className="text-sm text-stone-400">Ready replies for DMs. Search, copy, send.</p>
        </div>
        <button onClick={() => newAnswer()} className="btn-primary flex items-center gap-1.5 ml-auto">
          <Plus size={15} /> Answer
        </button>
      </div>

      {answers.length > 0 && (
        <div className="relative mb-6 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search: trial, couple, yoga price..."
            className="input-base w-full pl-9 pr-8"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700">
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {answers.length === 0 ? (
        <EmptyState onAdd={newAnswer} onLoadPack={isDivine ? loadSeedPack : undefined} />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-stone-400 py-12 text-center">Nothing matches &ldquo;{query}&rdquo;. Try another word, or add it as a new answer.</p>
      ) : (
        <div className="space-y-8">
          {categories
            .filter(cat => filtered.some(a => a.category === cat))
            .map(cat => (
              <section key={cat}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-2.5">{cat || 'Uncategorised'}</h3>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 items-start">
                  {filtered.filter(a => a.category === cat).map(a => (
                    <AnswerCard key={a.id} answer={a} onOpen={() => setEditing(a)} />
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}

      {editing && (
        <AnswerEditor
          answer={editing}
          categories={categories.length ? categories : LEAD_ANSWER_STARTER_CATEGORIES}
          onClose={() => setEditing(null)}
          onSave={save}
          onDelete={answers.some(a => a.id === editing.id) ? () => remove(editing.id) : undefined}
        />
      )}
    </div>
  );
}

function AnswerCard({ answer, onOpen }: { answer: LeadAnswer; onOpen: () => void }) {
  const [copied, setCopied] = useState(false);

  function copy(e: React.MouseEvent) {
    e.stopPropagation();
    if (!answer.reply.trim()) return;
    copyText(answer.reply.trim()).then(ok => {
      if (!ok) return;
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div
      onClick={onOpen}
      className="group bg-white border border-stone-200 rounded-xl p-3.5 cursor-pointer hover:shadow-sm hover:border-stone-300 transition-all"
    >
      <div className="flex items-start gap-2">
        <p className="text-sm font-medium text-stone-900 leading-snug flex-1">{answer.question || 'Untitled question'}</p>
        <button
          onClick={copy}
          className={`shrink-0 flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border transition-colors ${
            copied
              ? 'text-emerald-700 border-emerald-200 bg-emerald-50'
              : 'text-stone-500 border-stone-200 hover:text-stone-900 hover:border-stone-400'
          }`}
          title="Copy the reply"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {answer.reply.trim() && (
        <p className="text-xs text-stone-500 mt-1.5 line-clamp-3 whitespace-pre-line">{answer.reply.trim()}</p>
      )}
      {answer.rule?.trim() && (
        <p className="flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 rounded-md px-2 py-1.5 mt-2">
          <ShieldAlert size={12} className="shrink-0 mt-0.5" />
          <span className="line-clamp-2">{answer.rule.trim()}</span>
        </p>
      )}
    </div>
  );
}

function AnswerEditor({ answer, categories, onClose, onSave, onDelete }: {
  answer: LeadAnswer;
  categories: string[];
  onClose: () => void;
  onSave: (a: LeadAnswer) => void;
  onDelete?: () => void;
}) {
  const [category, setCategory] = useState(answer.category);
  const [question, setQuestion] = useState(answer.question);
  const [reply, setReply] = useState(answer.reply);
  const [rule, setRule] = useState(answer.rule ?? '');

  const canSave = question.trim().length > 0 || reply.trim().length > 0;

  return (
    <Modal open onClose={onClose} title={onDelete ? 'Edit Answer' : 'New Answer'} size="lg">
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Topic</label>
          <input
            value={category}
            onChange={e => setCategory(e.target.value)}
            list="answer-categories"
            placeholder="e.g. Gym membership"
            className="input-base w-full"
          />
          <datalist id="answer-categories">
            {categories.map(c => <option key={c} value={c} />)}
          </datalist>
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">The question, as leads ask it</label>
          <input
            autoFocus={!onDelete}
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="e.g. What's the price for the couple package?"
            className="input-base w-full"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Reply (what gets copied and sent)</label>
          <textarea
            value={reply}
            onChange={e => setReply(e.target.value)}
            placeholder="Write it exactly as it should land in the DM."
            rows={6}
            className="input-base w-full resize-y text-[13px] leading-relaxed"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">
            Internal rule (optional) <span className="text-stone-400 font-normal">visible here only, never sent</span>
          </label>
          <textarea
            value={rule}
            onChange={e => setRule(e.target.value)}
            placeholder="Do's and don'ts, when to escalate to Manmeet or Gautam..."
            rows={3}
            className="input-base w-full resize-y text-[13px] leading-relaxed"
          />
        </div>

        <div className="flex items-center gap-2">
          {onDelete && (
            <button
              onClick={() => { if (confirm('Delete this answer?')) onDelete(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button
              onClick={() => canSave && onSave({ ...answer, category: category.trim(), question: question.trim(), reply, rule: rule.trim() })}
              disabled={!canSave}
              className="btn-primary disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function EmptyState({ onAdd, onLoadPack }: { onAdd: (category?: string) => void; onLoadPack?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center mb-4">
        <MessageCircle size={24} className="text-stone-300" />
      </div>
      <p className="font-medium text-stone-600 mb-1">No answers yet</p>
      <p className="text-sm text-stone-400 mb-6 max-w-sm">
        Every question a lead asks gets one card: the question, the reply to paste, and an optional internal rule.
      </p>
      {onLoadPack && (
        <button onClick={onLoadPack} className="btn-primary flex items-center gap-2 mb-6">
          <PackageOpen size={15} /> Load the Divine Studio pack ({DIVINE_LEAD_SEED.length} answers)
        </button>
      )}
      <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-3">{onLoadPack ? 'Or start with a topic' : 'Start with a topic'}</p>
      <div className="flex flex-wrap justify-center gap-2 max-w-lg">
        {LEAD_ANSWER_STARTER_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => onAdd(cat)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-stone-600 border border-stone-200 bg-white rounded-lg hover:border-stone-400 hover:text-stone-900 transition-colors"
          >
            <Plus size={13} /> {cat}
          </button>
        ))}
      </div>
    </div>
  );
}
