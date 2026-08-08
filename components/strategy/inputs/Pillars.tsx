'use client';

// Pillars. A set builder: three to five, each with a name, a job and a share of
// the mix. The shares are shown adding up, and it says so when they do not
// (spec 34 §3).

import { Plus, Trash2 } from 'lucide-react';
import {
  PILLAR_JOBS, PILLARS_MAX, pillarShareTotal, type Pillar, type PillarJob,
} from '@/lib/strategy/inputs';
import { IconButton, Kicker, LineBox } from './ui';

export default function Pillars({
  value, onChange,
}: { value: Pillar[]; onChange: (next: Pillar[]) => void }) {
  const total = pillarShareTotal(value);
  const even = value.length > 0;

  function set(i: number, patch: Partial<Pillar>) {
    onChange(value.map((p, n) => (n === i ? { ...p, ...patch } : p)));
  }

  function splitEvenly() {
    const n = value.length;
    if (n === 0) return;
    const base = Math.floor(100 / n);
    onChange(value.map((p, i) => ({ ...p, share: i === 0 ? 100 - base * (n - 1) : base })));
  }

  return (
    <div>
      <Kicker>The mix</Kicker>

      <div className="space-y-2">
        {value.map((p, i) => (
          <div key={i} className="rounded-card border border-hairline bg-white p-3">
            <div className="flex items-center gap-2">
              <LineBox
                value={p.name}
                onChange={v => set(i, { name: v })}
                placeholder="Name this pillar"
                wide
              />
              <IconButton onClick={() => onChange(value.filter((_, n) => n !== i))} label={`Remove ${p.name || 'this pillar'}`}>
                <Trash2 size={16} strokeWidth={1.9} />
              </IconButton>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {PILLAR_JOBS.map(job => (
                <button
                  key={job}
                  type="button"
                  onClick={() => set(i, { job: job as PillarJob })}
                  className={`rounded-[10px] px-[11px] py-[6px] text-[12.5px] font-semibold ${
                    p.job === job ? 'bg-ink text-white' : 'border border-hairline bg-white text-muted hover:text-text'
                  }`}
                >
                  {job}
                </button>
              ))}
              <span className="ml-auto flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={p.share ?? ''}
                  onChange={e => {
                    const n = Number(e.target.value);
                    set(i, { share: e.target.value === '' || Number.isNaN(n) ? null : n });
                  }}
                  className="tnum w-[62px] rounded-[10px] border border-hairline bg-white px-2.5 py-2 text-right text-[13.5px] text-text focus:border-[rgba(23,21,26,.3)] focus:outline-none"
                />
                <span className="text-[12.5px] text-faint">% of the mix</span>
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onChange([...value, { name: '', job: null, share: null }])}
          disabled={value.length >= PILLARS_MAX}
          className="flex items-center gap-1.5 rounded-[10px] bg-ink px-3 py-2 text-[12.5px] font-semibold text-white disabled:opacity-30"
        >
          <Plus size={14} strokeWidth={2.4} />
          Add a pillar
        </button>
        {even && (
          <button
            type="button"
            onClick={splitEvenly}
            className="rounded-[10px] border border-hairline bg-white px-3 py-2 text-[12.5px] font-semibold text-muted hover:text-text"
          >
            Split evenly
          </button>
        )}
        {value.length > 0 && (
          <span
            className={`tnum ml-auto text-[12.5px] font-semibold ${total === 100 ? 'text-positive' : 'text-accent-text'}`}
          >
            {total} of 100
          </span>
        )}
      </div>
    </div>
  );
}
