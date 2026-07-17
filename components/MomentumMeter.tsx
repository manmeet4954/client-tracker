'use client';

import { useEffect, useMemo, useState } from 'react';
import { Flame, TrendingUp, TrendingDown, CheckCircle2 } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import {
  MomentumData, MomentumEntry, ContentCard,
  MOMENTUM_ACTIONS, MOMENTUM_POSTED_POINTS, MOMENTUM_DAY_CAP, MOMENTUM_SKIP_PENALTY,
} from '@/types';

// Momentum meter (spec 11). Tracks EFFORT, the one thing she controls, because
// results lag effort by weeks and watching results alone is demoralizing.
// The meter value is derived from the log on every render; only the log is
// stored. Posting is never logged by hand: posted cards on the Content board
// count automatically.

const EMPTY: MomentumData = { startDate: '', entries: [] };

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function daysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  let d = start;
  let guard = 0;
  while (d <= end && guard < 400) { out.push(d); d = addDays(d, 1); guard++; }
  return out;
}

/** Posted cards per day: the automatic part of the log. */
function postedByDay(cards: ContentCard[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const c of cards) {
    if (c.stage !== 'posted') continue;
    const date = (c.scheduledDate || c.updatedAt || '').slice(0, 10);
    if (!date) continue;
    map.set(date, (map.get(date) ?? 0) + 1);
  }
  return map;
}

function gainFor(entry: MomentumEntry | undefined, postedCount: number): number {
  const chips = (entry?.actions ?? []).reduce((n, id) => {
    const a = MOMENTUM_ACTIONS.find(x => x.id === id);
    return n + (a?.points ?? 0);
  }, 0);
  return Math.min(MOMENTUM_DAY_CAP, chips + postedCount * MOMENTUM_POSTED_POINTS);
}

export default function MomentumMeter({ clientId, accent }: { clientId: string; accent: string }) {
  const { dispatch } = useApp();
  const { data } = useClient(clientId);
  const momentum = data.momentum ?? EMPTY;
  const cards = data.contentCards ?? [];
  const today = todayStr();

  const posted = useMemo(() => postedByDay(cards), [cards]);
  const entryFor = (date: string) => momentum.entries.find(e => e.date === date);
  const todayEntry = entryFor(today);

  // The meter only starts counting once she logs for the first time. Before
  // that it shows the invitation state.
  const started = !!momentum.startDate;

  const { value, streak, todayGain } = useMemo(() => {
    if (!started) return { value: 0, streak: 0, todayGain: 0 };
    let v = 0;
    const days = daysBetween(momentum.startDate, today);
    for (const day of days) {
      const gain = gainFor(entryFor(day), posted.get(day) ?? 0);
      if (gain > 0) v += gain;
      else if (day !== today) v -= MOMENTUM_SKIP_PENALTY; // today never subtracts while it is still today
      v = Math.max(0, Math.min(100, v));
    }
    // Streak: worked days in a row, counting back from today (today only if
    // something is already logged or posted).
    let s = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      const day = days[i];
      const gain = gainFor(entryFor(day), posted.get(day) ?? 0);
      if (gain > 0) s++;
      else if (day === today) continue; // an empty today does not break the streak yet
      else break;
    }
    return { value: v, streak: s, todayGain: gainFor(todayEntry, posted.get(today) ?? 0) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [momentum, posted, today, started]);

  function save(next: MomentumData) {
    dispatch({ type: 'UPDATE_MOMENTUM', payload: { clientId, momentum: next } });
  }

  function toggleAction(id: string) {
    const cur = todayEntry ?? { date: today, actions: [] };
    const actions = cur.actions.includes(id)
      ? cur.actions.filter(a => a !== id)
      : [...cur.actions, id];
    const rest = momentum.entries.filter(e => e.date !== today);
    save({
      startDate: momentum.startDate || today,
      entries: [...rest, { ...cur, actions }],
    });
  }

  function saveNote(note: string) {
    const cur = todayEntry ?? { date: today, actions: [] };
    const rest = momentum.entries.filter(e => e.date !== today);
    save({
      startDate: momentum.startDate || today,
      entries: [...rest, { ...cur, note: note || undefined }],
    });
  }

  const postedToday = posted.get(today) ?? 0;
  const strip = daysBetween(addDays(today, -13), today);

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${accent}20` }}>
          <Flame size={17} style={{ color: accent }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-stone-900 text-sm">Momentum</p>
          <p className="text-xs text-stone-400 mt-0.5">
            This meter tracks your effort. Results always follow effort, a few weeks behind.
          </p>
        </div>
        {started && streak > 0 && (
          <span className="text-xs font-semibold tabular-nums shrink-0" style={{ color: accent }}>
            {streak} day{streak > 1 ? 's' : ''} in a row
          </span>
        )}
      </div>

      {/* The meter */}
      <div className="mt-4">
        <div className="flex items-end justify-between">
          <span className="text-3xl font-bold tabular-nums text-stone-900">{value}</span>
          {started && todayGain > 0 && (
            <span className="text-xs font-medium" style={{ color: accent }}>+{todayGain} today</span>
          )}
        </div>
        <div className="relative h-2.5 bg-stone-100 rounded-full overflow-hidden mt-2">
          <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
            style={{ width: `${value}%`, backgroundColor: accent }} />
        </div>
        {!started && (
          <p className="text-xs text-stone-400 mt-2">
            The meter starts the first time you log a day. Work moves it forward. A skipped day pulls it back a little. It can never go below zero.
          </p>
        )}
      </div>

      {/* Today's log */}
      <div className="mt-4">
        <p className="text-xs font-medium text-stone-500 mb-2">What did you do today?</p>
        <div className="flex flex-wrap gap-1.5">
          {postedToday > 0 && (
            <span className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border"
              style={{ borderColor: accent, color: accent, backgroundColor: `${accent}10` }}>
              <CheckCircle2 size={13} />
              Posted x{postedToday}, counted from your board
            </span>
          )}
          {MOMENTUM_ACTIONS.map(a => {
            const on = todayEntry?.actions.includes(a.id) ?? false;
            return (
              <button key={a.id} onClick={() => toggleAction(a.id)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                  on ? 'text-white' : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
                }`}
                style={on ? { backgroundColor: accent, borderColor: accent } : undefined}>
                {a.label}
              </button>
            );
          })}
        </div>
        <input
          defaultValue={todayEntry?.note ?? ''}
          key={today + (todayEntry?.note ?? '')}
          onBlur={e => { if (e.target.value !== (todayEntry?.note ?? '')) saveNote(e.target.value.trim()); }}
          placeholder="One line about today, if you want"
          className="mt-2 w-full text-xs px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400 placeholder:text-stone-300"
        />
      </div>

      {/* 14-day strip */}
      <div className="mt-4">
        <div className="flex gap-1.5">
          {strip.map(day => {
            const gain = gainFor(entryFor(day), posted.get(day) ?? 0);
            const isToday = day === today;
            const note = entryFor(day)?.note;
            const label = day.slice(5).replace('-', '/');
            return (
              <div key={day}
                title={`${label}${gain > 0 ? ` · worked (+${gain})` : isToday ? '' : ' · skipped'}${note ? ` · ${note}` : ''}`}
                className={`h-6 flex-1 rounded-md ${isToday && gain === 0 ? 'border-2 border-dashed border-stone-300 bg-white' : ''}`}
                style={gain > 0 ? { backgroundColor: accent, opacity: 0.35 + 0.65 * (gain / MOMENTUM_DAY_CAP) }
                  : !isToday ? { backgroundColor: '#e7e5e4' } : undefined}
              />
            );
          })}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-stone-400">2 weeks ago</span>
          <span className="text-[10px] text-stone-400">today</span>
        </div>
      </div>

      <ResultsRow accent={accent} />
    </div>
  );
}

// ── The honest mirror: real Instagram numbers under the effort meter ─────────

type IgSummary = {
  ok: boolean;
  lastSync?: string;
  followers?: number | null;
  followersDelta7d?: number | null;
  engagement7d?: number | null;
  engagementPrev7d?: number | null;
  reach7d?: number | null;
  reachPrev7d?: number | null;
};

const nf = new Intl.NumberFormat('en-IN');

function Delta({ now, prev }: { now: number | null | undefined; prev: number | null | undefined }) {
  if (now == null || prev == null) return null;
  const diff = now - prev;
  if (diff === 0) return <span className="text-[11px] text-stone-400">same as last week</span>;
  const up = diff > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${up ? 'text-emerald-600' : 'text-red-500'}`}>
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {up ? '+' : ''}{nf.format(diff)} vs last week
    </span>
  );
}

function ResultsRow({ accent }: { accent: string }) {
  const [ig, setIg] = useState<IgSummary | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/ig-metrics')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive) setIg(d); })
      .catch(() => { if (alive) setIg(null); });
    return () => { alive = false; };
  }, []);

  // The meter never breaks because of the pipe: no data, no row.
  if (!ig?.ok) return null;

  return (
    <div className="mt-4 pt-4 border-t border-stone-100">
      <p className="text-xs font-medium text-stone-500 mb-2">
        What Instagram shows. This follows your effort, with a delay. A flat week here does not mean the work is wasted.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="bg-stone-50 rounded-lg px-3 py-2.5">
          <p className="text-[11px] text-stone-400">Followers</p>
          <p className="text-lg font-bold tabular-nums text-stone-900">{ig.followers != null ? nf.format(ig.followers) : '–'}</p>
          {ig.followersDelta7d != null && (
            <span className={`text-[11px] font-medium ${ig.followersDelta7d >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {ig.followersDelta7d >= 0 ? '+' : ''}{nf.format(ig.followersDelta7d)} this week
            </span>
          )}
        </div>
        <div className="bg-stone-50 rounded-lg px-3 py-2.5">
          <p className="text-[11px] text-stone-400">Engagement this week</p>
          <p className="text-lg font-bold tabular-nums text-stone-900">{ig.engagement7d != null ? nf.format(ig.engagement7d) : '–'}</p>
          <Delta now={ig.engagement7d} prev={ig.engagementPrev7d} />
        </div>
        <div className="bg-stone-50 rounded-lg px-3 py-2.5">
          <p className="text-[11px] text-stone-400">Reach this week</p>
          <p className="text-lg font-bold tabular-nums text-stone-900">{ig.reach7d != null ? nf.format(ig.reach7d) : '–'}</p>
          <Delta now={ig.reach7d} prev={ig.reachPrev7d} />
        </div>
      </div>
      {ig.lastSync && <p className="text-[10px] text-stone-300 mt-1.5">Numbers refresh daily around 9 AM. Last update {ig.lastSync}.</p>}
    </div>
  );
}
