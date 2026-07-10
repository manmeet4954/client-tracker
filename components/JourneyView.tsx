'use client';

import { useState } from 'react';
import { Target, Pencil, Check, Plus, Trash2, Flag, TrendingUp, ListChecks } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import { generateId } from '@/lib/utils';
import { JourneyData, JourneyChannel, ContentCard } from '@/types';

// The strategy-meets-progress layer: one goal, the content mix vs its target,
// a month-by-month map, channel statuses, and the ordered next steps.
// Everything computable is computed from content cards; only the goal, the
// monthly north-star number, and channel notes are entered by hand.

const EMPTY_JOURNEY: JourneyData = { northStar: '', checkIns: [], channels: [], nextSteps: '' };

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function monthsBetween(start: string, end: string): string[] {
  const out: string[] = [];
  let [y, m] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return out.slice(-12); // cap the map at the last 12 months
}

export default function JourneyView({ clientId }: { clientId: string }) {
  const { dispatch } = useApp();
  const { client, data } = useClient(clientId);
  const journey = data.journey ?? EMPTY_JOURNEY;
  const cards = data.contentCards ?? [];
  const pillars = data.pillars ?? [];

  function save(patch: Partial<JourneyData>) {
    dispatch({ type: 'UPDATE_JOURNEY', payload: { clientId, journey: { ...journey, ...patch } } });
  }

  // ── computed: posted cards by month, pillar mix ──
  const posted = cards.filter(c => c.stage === 'posted');
  const postedMonths = posted.map(c => c.createdMonth).filter(Boolean).sort();
  const startMonth = journey.startMonth || postedMonths[0] || currentMonth();
  const months = monthsBetween(startMonth, currentMonth());

  const thisMonth = currentMonth();
  const postedThisMonth = posted.filter(c => c.createdMonth === thisMonth);

  // Actual mix this month vs pillar targets (only pillars with a target set).
  const withTargets = pillars.filter(p => (p.targetPct ?? 0) > 0);
  const mix = withTargets.map(p => {
    const count = postedThisMonth.filter(c => c.pillarId === p.id).length;
    const actualPct = postedThisMonth.length ? Math.round((count / postedThisMonth.length) * 100) : 0;
    return { pillar: p, count, actualPct, targetPct: p.targetPct ?? 0 };
  });
  const starving = mix.filter(m => m.targetPct > 0 && m.count === 0);
  const heavy = mix.filter(m => m.actualPct > m.targetPct + 15);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-5">
      <div>
        <h2 className="text-lg font-bold text-stone-900">Journey</h2>
        <p className="text-sm text-stone-400">How it started, how it&apos;s going, and where it&apos;s headed.</p>
      </div>

      <GoalCard journey={journey} onSave={save} />

      {/* ── Content mix vs target ── */}
      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp size={15} className="text-accent" />
          <h3 className="font-semibold text-stone-900 text-sm">Content mix — {monthLabel(thisMonth)}</h3>
          <span className="text-xs text-stone-400 ml-auto">{postedThisMonth.length} posted</span>
        </div>
        {withTargets.length === 0 ? (
          <p className="text-sm text-stone-400 mt-3">
            No pillar targets set yet. Edit a pillar and give it a target percent (e.g. AI lane 40) and the mix appears here on its own.
          </p>
        ) : (
          <>
            <div className="space-y-3 mt-4">
              {mix.map(({ pillar, count, actualPct, targetPct }) => (
                <div key={pillar.id}>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-700">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: pillar.color }} />
                      {pillar.name}
                    </span>
                    <span className="text-[11px] text-stone-400 tabular-nums">{count} posts · {actualPct}% vs {targetPct}%</span>
                  </div>
                  <div className="relative h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(actualPct, 100)}%`, backgroundColor: pillar.color }} />
                    <div className="absolute inset-y-0 w-0.5 bg-stone-500" style={{ left: `${Math.min(targetPct, 100)}%` }} title={`target ${targetPct}%`} />
                  </div>
                </div>
              ))}
            </div>
            {(starving.length > 0 || heavy.length > 0) && postedThisMonth.length > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-4">
                {starving.length > 0 && <>No posts yet this month for {starving.map(s => s.pillar.name).join(', ')}. </>}
                {heavy.length > 0 && <>Heavy on {heavy.map(h => h.pillar.name).join(', ')}.</>}
              </p>
            )}
          </>
        )}
      </div>

      {/* ── The map: month by month ── */}
      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Flag size={15} className="text-accent" />
          <h3 className="font-semibold text-stone-900 text-sm">The map</h3>
          {journey.targetValue != null && journey.northStar && (
            <span className="text-xs text-stone-400 ml-auto">goal: {journey.targetValue} {journey.northStar.toLowerCase()}{journey.targetDate ? ` by ${monthLabel(journey.targetDate)}` : ''}</span>
          )}
        </div>
        <MonthMap months={months} posted={posted} journey={journey} onSave={save} />
      </div>

      {/* ── Channels ── */}
      <ChannelsCard channels={journey.channels} onChange={channels => save({ channels })} clientName={client?.name ?? ''} />

      {/* ── Next steps ── */}
      <NextStepsCard value={journey.nextSteps} onSave={nextSteps => save({ nextSteps })} />
    </div>
  );
}

// ── Goal ─────────────────────────────────────────────────────────────────────

function GoalCard({ journey, onSave }: { journey: JourneyData; onSave: (p: Partial<JourneyData>) => void }) {
  const [editing, setEditing] = useState(false);
  const [metric, setMetric] = useState(journey.northStar);
  const [value, setValue] = useState(journey.targetValue?.toString() ?? '');
  const [date, setDate] = useState(journey.targetDate ?? '');

  if (!editing) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-5 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-accent-light flex items-center justify-center shrink-0">
          <Target size={17} className="text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          {journey.northStar ? (
            <>
              <p className="font-semibold text-stone-900 text-sm">
                {journey.targetValue != null ? `${journey.targetValue} ` : ''}{journey.northStar}
                {journey.targetDate ? ` by ${monthLabel(journey.targetDate)}` : ''}
              </p>
              <p className="text-xs text-stone-400 mt-0.5">The north star. Everything below measures against this.</p>
            </>
          ) : (
            <>
              <p className="font-semibold text-stone-500 text-sm">No goal set yet</p>
              <p className="text-xs text-stone-400 mt-0.5">One metric, one number, one date. Not vague.</p>
            </>
          )}
        </div>
        <button onClick={() => { setMetric(journey.northStar); setValue(journey.targetValue?.toString() ?? ''); setDate(journey.targetDate ?? ''); setEditing(true); }}
          className="p-1.5 rounded-md text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-colors shrink-0">
          <Pencil size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Metric</label>
          <input value={metric} onChange={e => setMetric(e.target.value)} placeholder="e.g. Signups, Trial bookings" className="input-base w-full" autoFocus />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Target number</label>
          <input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="300" className="input-base w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">By when</label>
          <input type="month" value={date} onChange={e => setDate(e.target.value)} className="input-base w-full" />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
        <button
          onClick={() => { onSave({ northStar: metric.trim(), targetValue: value ? Number(value) : undefined, targetDate: date || undefined }); setEditing(false); }}
          className="btn-primary flex items-center gap-1.5">
          <Check size={14} /> Save goal
        </button>
      </div>
    </div>
  );
}

// ── Month map ────────────────────────────────────────────────────────────────

function MonthMap({ months, posted, journey, onSave }: {
  months: string[];
  posted: ContentCard[];
  journey: JourneyData;
  onSave: (p: Partial<JourneyData>) => void;
}) {
  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const maxPosts = Math.max(1, ...months.map(m => posted.filter(c => c.createdMonth === m).length));
  const checkIn = (m: string) => journey.checkIns.find(c => c.month === m);

  function saveCheckIn(month: string) {
    const value = Number(draft);
    const rest = journey.checkIns.filter(c => c.month !== month);
    onSave({ checkIns: draft === '' ? rest : [...rest, { month, value }] });
    setEditingMonth(null);
    setDraft('');
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-3 min-w-max pb-1">
        {months.map(m => {
          const count = posted.filter(c => c.createdMonth === m).length;
          const ci = checkIn(m);
          const h = Math.round((count / maxPosts) * 64);
          return (
            <div key={m} className="flex flex-col items-center gap-1 w-14">
              {/* north-star number (manual, monthly) */}
              {editingMonth === m ? (
                <input
                  autoFocus type="number" value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onBlur={() => saveCheckIn(m)}
                  onKeyDown={e => e.key === 'Enter' && saveCheckIn(m)}
                  className="w-12 text-center text-[11px] border border-stone-300 rounded px-0.5 py-0.5 focus:outline-none"
                />
              ) : (
                <button
                  onClick={() => { setEditingMonth(m); setDraft(ci?.value?.toString() ?? ''); }}
                  className={`text-[11px] font-medium tabular-nums ${ci ? 'text-emerald-600' : 'text-stone-300 hover:text-stone-500'}`}
                  title={journey.northStar ? `${journey.northStar} in ${monthLabel(m)} — click to set` : 'Set the goal first, then log the number monthly'}
                >
                  {ci ? ci.value : '·'}
                </button>
              )}
              {/* posts bar */}
              <div className="w-7 bg-stone-100 rounded-t-md flex items-end" style={{ height: 64 }}>
                <div className="w-full rounded-t-md bg-accent/70" style={{ height: `${h}px` }} title={`${count} posts`} />
              </div>
              <span className="text-[10px] text-stone-400">{monthLabel(m)}</span>
              <span className="text-[10px] text-stone-300 tabular-nums">{count}</span>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-stone-400 mt-2">
        Bars = posts that went live. The number above each month is the north-star count — tap to log it, once a month, that&apos;s all.
      </p>
    </div>
  );
}

// ── Channels ─────────────────────────────────────────────────────────────────

function ChannelsCard({ channels, onChange, clientName }: {
  channels: JourneyChannel[];
  onChange: (c: JourneyChannel[]) => void;
  clientName: string;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  function seed() {
    onChange([
      { id: generateId(), name: 'Instagram', note: '' },
      { id: generateId(), name: 'YouTube', note: '' },
      { id: generateId(), name: 'LinkedIn', note: '' },
      { id: generateId(), name: 'SEO / website', note: '' },
    ]);
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <ListChecks size={15} className="text-accent" />
        <h3 className="font-semibold text-stone-900 text-sm">Where each channel stands</h3>
        <button onClick={() => setAdding(true)} className="ml-auto p-1 rounded text-stone-400 hover:text-stone-900" title="Add channel">
          <Plus size={14} />
        </button>
      </div>

      {channels.length === 0 && !adding && (
        <button onClick={seed} className="text-xs text-sky-600 hover:underline">
          Start with the standard four (Instagram, YouTube, LinkedIn, SEO)
        </button>
      )}

      <div className="space-y-2">
        {channels.map(ch => (
          <ChannelRow key={ch.id} channel={ch}
            onSave={c => onChange(channels.map(x => x.id === c.id ? c : x))}
            onDelete={() => onChange(channels.filter(x => x.id !== ch.id))}
          />
        ))}
      </div>

      {adding && (
        <input
          autoFocus value={name}
          onChange={e => setName(e.target.value)}
          onBlur={() => { if (name.trim()) onChange([...channels, { id: generateId(), name: name.trim(), note: '' }]); setName(''); setAdding(false); }}
          onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { onChange([...channels, { id: generateId(), name: name.trim(), note: '' }]); setName(''); setAdding(false); } }}
          placeholder="Channel name"
          className="input-base w-full mt-2 text-sm"
        />
      )}
    </div>
  );
}

function ChannelRow({ channel, onSave, onDelete }: {
  channel: JourneyChannel;
  onSave: (c: JourneyChannel) => void;
  onDelete: () => void;
}) {
  const [note, setNote] = useState(channel.note);
  return (
    <div className="group flex items-start gap-3 px-3 py-2 rounded-lg bg-stone-50 border border-stone-100">
      <span className="text-xs font-semibold text-stone-700 w-24 shrink-0 mt-1">{channel.name}</span>
      <input
        value={note}
        onChange={e => setNote(e.target.value)}
        onBlur={() => note !== channel.note && onSave({ ...channel, note })}
        placeholder="Where it stands, next move..."
        className="flex-1 text-xs bg-transparent focus:outline-none text-stone-600 placeholder-stone-400 mt-1"
      />
      <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 p-1 rounded text-stone-300 hover:text-red-500 transition-opacity shrink-0">
        <Trash2 size={12} />
      </button>
    </div>
  );
}

// ── Next steps ───────────────────────────────────────────────────────────────

function NextStepsCard({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5">
      <h3 className="font-semibold text-stone-900 text-sm mb-1">Next steps</h3>
      <p className="text-xs text-stone-400 mb-3">The 3 to 5 moves, in order. Rewrite freely as things change.</p>
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => draft !== value && onSave(draft)}
        placeholder={'1. Rewrite the LinkedIn page\n2. First YouTube short\n3. Pitch two colleges'}
        rows={4}
        className="input-base w-full resize-y text-sm leading-relaxed"
      />
    </div>
  );
}
