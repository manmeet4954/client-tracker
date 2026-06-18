'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, ClipboardList } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import { generateId } from '@/lib/utils';
import { OnboardingItem } from '@/types';

const DEFAULT_QUESTIONS = [
  'In a word or short phrase, what do you want to be known as?',
  'Who exactly is your audience? Age, gender, how they look, where they are.',
  'What is the one thing people compliment you on the most?',
  'What will people get from you that they will not get from any other image consultant?',
  'You taught for 15 years. What did you love about it, and what made you step away?',
  'Why this, and why now, at this point in your life?',
  'You said this is not about money right now. So what is it about? (what will you measure?)',
  'What part of your story are you nervous to put online, and what feels easy?',
  'Why image coaching specifically? What happened in her own life that made her care about this?',
  'Who is the person she most wants to help, and why does she feel qualified to help them in a way no one else can?',
  'What does she believe about image or self-presentation that most people get wrong?',
  'Design Style',
];

function pickAccent(brandColors: { hex: string; role?: string }[] | undefined, fallback: string): string {
  if (!brandColors?.length) return fallback;
  const primary = brandColors.find(c => /primary|accent/i.test(c.role ?? ''));
  return primary?.hex ?? brandColors[0]?.hex ?? fallback;
}

export default function OnboardingView({ clientId }: { clientId: string }) {
  const { dispatch } = useApp();
  const { client, data } = useClient(clientId);
  const accent = pickAccent(data.brandKit?.colors, client?.color ?? '#8c52ff');

  const items = data.onboarding ?? [];
  const seeded = useRef(false);

  // First visit: pre-fill the discovery questions.
  useEffect(() => {
    if (!seeded.current && items.length === 0) {
      seeded.current = true;
      dispatch({
        type: 'SET_ONBOARDING',
        payload: {
          clientId,
          items: DEFAULT_QUESTIONS.map(q => ({ id: generateId(), question: q, answer: '' })),
        },
      });
    }
  }, [items.length, clientId, dispatch]);

  function addQuestion() {
    dispatch({ type: 'ADD_ONBOARDING_ITEM', payload: { clientId, item: { id: generateId(), question: '', answer: '' } } });
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
            <ClipboardList size={18} style={{ color: accent }} />
            Onboarding
          </h2>
          <p className="text-sm text-stone-400 mt-0.5">
            Discovery questions — fill in the answers as you learn about her.
          </p>
        </div>
        <button
          onClick={addQuestion}
          className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white rounded-lg transition-opacity hover:opacity-90 shrink-0"
          style={{ backgroundColor: accent }}
        >
          <Plus size={15} />
          Add Question
        </button>
      </div>

      {/* Questions */}
      <div className="space-y-3">
        {items.map((item, i) => (
          <QuestionCard
            key={item.id}
            index={i + 1}
            item={item}
            accent={accent}
            onChange={updated => dispatch({ type: 'UPDATE_ONBOARDING_ITEM', payload: { clientId, item: updated } })}
            onDelete={() => dispatch({ type: 'DELETE_ONBOARDING_ITEM', payload: { clientId, itemId: item.id } })}
          />
        ))}
      </div>

      <button
        onClick={addQuestion}
        className="mt-4 flex items-center gap-2 w-full justify-center py-3 rounded-xl border-2 border-dashed border-stone-200 text-stone-400 hover:border-stone-400 hover:text-stone-600 transition-colors text-sm font-medium"
      >
        <Plus size={16} /> Add Question
      </button>
    </div>
  );
}

function QuestionCard({ index, item, accent, onChange, onDelete }: {
  index: number;
  item: OnboardingItem;
  accent: string;
  onChange: (item: OnboardingItem) => void;
  onDelete: () => void;
}) {
  const [question, setQuestion] = useState(item.question);
  const [answer, setAnswer] = useState(item.answer);

  return (
    <div className="group bg-white border border-stone-200 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <span
          className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5"
          style={{ backgroundColor: accent }}
        >
          {index}
        </span>
        <div className="flex-1 min-w-0">
          {/* Question (editable) */}
          <textarea
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onBlur={() => question !== item.question && onChange({ ...item, question: question.trim() })}
            rows={Math.max(1, Math.ceil(question.length / 60))}
            placeholder="Type a question…"
            className="w-full font-medium text-stone-900 text-sm bg-transparent focus:outline-none resize-none leading-snug"
          />
          {/* Answer */}
          <textarea
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            onBlur={() => answer !== item.answer && onChange({ ...item, answer })}
            rows={3}
            placeholder="Write the answer here…"
            className="w-full mt-2 text-sm text-stone-700 bg-stone-50 rounded-lg p-3 border border-transparent focus:outline-none focus:bg-white focus:border-stone-300 resize-y placeholder-stone-400 transition-colors"
          />
        </div>
        <button
          onClick={onDelete}
          className="shrink-0 p-1.5 rounded-md text-stone-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
          title="Delete question"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
