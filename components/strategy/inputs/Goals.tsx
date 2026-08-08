'use client';

// Goals. The goal, its number, and how it is measured. The measurement is not
// optional, and the screen says what happens without it rather than leaving it
// in a spec (spec 34 §3, S16).

import { useState } from 'react';
import { Plus, Trash2, Info } from 'lucide-react';
import {
  GOAL_PRESETS, GOAL_MEASURES, GOAL_PERIODS, MEASUREMENT_LINE, type GoalItem,
} from '@/lib/strategy/inputs';
import { IconButton, Kicker, LineBox } from './ui';

export default function Goals({
  value, onChange,
}: { value: GoalItem[]; onChange: (next: GoalItem[]) => void }) {
  const [draft, setDraft] = useState('');
  const taken = (name: string) => value.some(g => g.goal.toLowerCase() === name.toLowerCase());

  function add(name: string) {
    const n = name.trim();
    if (!n || taken(n)) { setDraft(''); return; }
    onChange([...value, { goal: n, number: null, period: GOAL_PERIODS[1], measured: '' }]);
    setDraft('');
  }

  function set(i: number, patch: Partial<GoalItem>) {
    onChange(value.map((g, n) => (n === i ? { ...g, ...patch } : g)));
  }

  return (
    <div>
      {value.length > 0 && <Kicker>What this is for</Kicker>}

      <div className="space-y-2">
        {value.map((g, i) => (
          <div key={i} className="rounded-card border border-hairline bg-white p-3.5">
            <div className="flex items-center gap-2">
              <span className="flex-1 text-[14px] font-semibold text-text">{g.goal}</span>
              <IconButton onClick={() => onChange(value.filter((_, n) => n !== i))} label={`Remove ${g.goal}`}>
                <Trash2 size={16} strokeWidth={1.9} />
              </IconButton>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <input
                type="number"
                min={0}
                value={g.number ?? ''}
                onChange={e => {
                  const n = Number(e.target.value);
                  set(i, { number: e.target.value === '' || Number.isNaN(n) ? null : n });
                }}
                placeholder="0"
                className="tnum w-[92px] rounded-[10px] border border-hairline bg-white px-2.5 py-2 text-right text-[13.5px] text-text focus:border-[rgba(23,21,26,.3)] focus:outline-none"
              />
              {GOAL_PERIODS.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => set(i, { period: p })}
                  className={`rounded-[10px] px-[11px] py-[6px] text-[12.5px] font-semibold ${
                    g.period === p ? 'bg-ink text-white' : 'border border-hairline bg-white text-muted hover:text-text'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <p className="mt-3 text-[11px] font-bold uppercase tracking-[.12em] text-faint">
              How you will know it moved
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {GOAL_MEASURES.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => set(i, { measured: g.measured === m ? '' : m })}
                  className={`rounded-[10px] px-[11px] py-[6px] text-[12.5px] font-semibold ${
                    g.measured === m ? 'bg-ink text-white' : 'border border-hairline bg-white text-muted hover:text-text'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2.5">
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[.12em] text-faint">Add a goal</p>
        <div className="flex flex-wrap gap-1.5">
          {GOAL_PRESETS.filter(p => !taken(p)).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => add(p)}
              className="flex items-center gap-1 rounded-[10px] border border-hairline bg-white px-[11px] py-[6px] text-[12.5px] text-muted hover:text-text"
            >
              <Plus size={13} strokeWidth={2.4} />
              {p}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-1.5">
          <LineBox value={draft} onChange={setDraft} placeholder="Or name another one" wide />
          <button
            type="button"
            onClick={() => add(draft)}
            disabled={!draft.trim()}
            className="shrink-0 rounded-[10px] bg-ink px-3 py-2 text-[12.5px] font-semibold text-white disabled:opacity-30"
          >
            Add
          </button>
        </div>
      </div>

      <p className="mt-3 flex items-start gap-1.5 text-[12.5px] leading-[1.5] text-muted">
        <Info size={14} strokeWidth={2} className="mt-[2px] shrink-0 text-faint" />
        {MEASUREMENT_LINE}
      </p>
    </div>
  );
}
