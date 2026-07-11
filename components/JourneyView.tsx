'use client';

import { useState } from 'react';
import { Target, Pencil, Check, ExternalLink, Wand2 } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import { JourneyData, ContentCard, ContentPillar } from '@/types';
import Modal from './Modal';

// Journey v2 — the map IS the page. Every month is a stacked bar, each
// segment a pillar in its own color, so consistency (and drift) is visible
// at a glance. Tap a pillar in the legend to isolate it. The only manual
// inputs on the whole page: the goal, and one north-star number per month.

const EMPTY_JOURNEY: JourneyData = { northStar: '', checkIns: [], channels: [], nextSteps: '' };
const UNSORTED_COLOR = '#d6d3d1';

function pickAccent(brandColors: { hex: string; role?: string }[] | undefined, fallback: string): string {
  if (!brandColors?.length) return fallback;
  const primary = brandColors.find(c => /primary|accent/i.test(c.role ?? ''));
  return primary?.hex ?? brandColors[0]?.hex ?? fallback;
}

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
  return out.slice(-12);
}

export default function JourneyView({ clientId }: { clientId: string }) {
  const { dispatch } = useApp();
  const { client, data } = useClient(clientId);
  const journey = data.journey ?? EMPTY_JOURNEY;
  const cards = data.contentCards ?? [];
  const pillars = data.pillars ?? [];
  const platforms = data.platforms ?? [];
  const multiPlatform = platforms.length > 1;
  const accent = client ? pickAccent(data.brandKit?.colors, client.color) : '#ea4711';

  const [pillarFilter, setPillarFilter] = useState<string | null>(null); // pillar id, '' = unsorted
  const [platformFilter, setPlatformFilter] = useState('');
  const [sorting, setSorting] = useState(false);

  function save(patch: Partial<JourneyData>) {
    dispatch({ type: 'UPDATE_JOURNEY', payload: { clientId, journey: { ...journey, ...patch } } });
  }

  let posted = cards.filter(c => c.stage === 'posted');
  if (platformFilter) posted = posted.filter(c => c.platform === platformFilter);

  const postedMonths = posted.map(c => c.createdMonth).filter(Boolean).sort();
  const startMonth = journey.startMonth || postedMonths[0] || currentMonth();
  const months = monthsBetween(startMonth, currentMonth());
  const thisMonth = currentMonth();
  const postedThisMonth = posted.filter(c => c.createdMonth === thisMonth);

  const hasUnsorted = posted.some(c => !c.pillarId || !pillars.some(p => p.id === c.pillarId));
  const segments: { id: string; name: string; color: string; targetPct?: number }[] = [
    ...pillars.map(p => ({ id: p.id, name: p.name, color: p.color, targetPct: p.targetPct })),
    ...(hasUnsorted ? [{ id: '', name: 'Unsorted', color: UNSORTED_COLOR, targetPct: undefined }] : []),
  ];

  const countFor = (month: string, segId: string) =>
    posted.filter(c => c.createdMonth === month && (segId === ''
      ? (!c.pillarId || !pillars.some(p => p.id === c.pillarId))
      : c.pillarId === segId)).length;

  const unsortedCards = cards.filter(c => !c.pillarId || !pillars.some(p => p.id === c.pillarId));

  return (
    <div className="p-4 md:p-8 space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-lg font-bold text-stone-900">Journey</h2>
          <p className="text-sm text-stone-400">Every month, told in your pillars&apos; colors.</p>
        </div>
        {unsortedCards.length > 0 && pillars.length > 0 && (
          <button onClick={() => setSorting(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg ml-auto transition-opacity hover:opacity-90"
            style={{ backgroundColor: accent }}>
            <Wand2 size={13} /> Sort {unsortedCards.length} posts into pillars
          </button>
        )}
        {multiPlatform && (
          <div className={`flex items-center gap-0.5 border border-stone-200 bg-white rounded-lg p-0.5 ${unsortedCards.length > 0 && pillars.length > 0 ? '' : 'ml-auto'}`}>
            <button onClick={() => setPlatformFilter('')}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${platformFilter === '' ? 'bg-[#1f1f1f] text-white' : 'text-stone-500 hover:text-stone-900'}`}>
              All
            </button>
            {platforms.map(p => (
              <button key={p} onClick={() => setPlatformFilter(platformFilter === p ? '' : p)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${platformFilter === p ? 'bg-[#1f1f1f] text-white' : 'text-stone-500 hover:text-stone-900'}`}>
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Goal (slim, above the stage) ── */}
      <GoalCard journey={journey} accent={accent} onSave={save} />

      {/* ── THE MAP ── */}
      <div className="bg-white rounded-xl border border-stone-200 p-5 md:p-8">
        {/* Pillar legend — tap to isolate */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {segments.map(seg => {
            const count = postedThisMonth.filter(c => (seg.id === ''
              ? (!c.pillarId || !pillars.some(p => p.id === c.pillarId))
              : c.pillarId === seg.id)).length;
            const actualPct = postedThisMonth.length ? Math.round((count / postedThisMonth.length) * 100) : 0;
            const active = pillarFilter === null || pillarFilter === seg.id;
            return (
              <button key={seg.id || 'unsorted'}
                onClick={() => setPillarFilter(pillarFilter === seg.id ? null : seg.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-all ${
                  active ? 'border-stone-300 bg-white' : 'border-stone-100 bg-stone-50 opacity-40'
                }`}
                title={seg.targetPct != null ? `this month ${actualPct}% vs target ${seg.targetPct}%` : `this month ${actualPct}%`}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                <span className="font-medium text-stone-700">{seg.name}</span>
                <span className="text-stone-400 tabular-nums">
                  {actualPct}%{seg.targetPct != null ? ` / ${seg.targetPct}%` : ''}
                </span>
              </button>
            );
          })}
        </div>

        {/* Stacked month bars */}
        {posted.length === 0 ? (
          <p className="text-sm text-stone-400 py-8 text-center">
            The map draws itself as posts go live. Nothing posted yet{platformFilter ? ` on ${platformFilter}` : ''}.
          </p>
        ) : (
          <MonthBars
            months={months}
            segments={segments}
            countFor={countFor}
            pillarFilter={pillarFilter}
            journey={journey}
            accent={accent}
            onSave={save}
          />
        )}
      </div>

      {sorting && (
        <SortModal
          cards={unsortedCards}
          pillars={pillars}
          onAssign={(card, pillarId) =>
            dispatch({ type: 'UPDATE_CONTENT_CARD', payload: { clientId, card: { ...card, pillarId, updatedAt: new Date().toISOString() } } })
          }
          onClose={() => setSorting(false)}
        />
      )}
    </div>
  );
}

// ── Sort into pillars (one-time triage for migrated posts) ──────────────────

function SortModal({ cards, pillars, onAssign, onClose }: {
  cards: ContentCard[];
  pillars: ContentPillar[];
  onAssign: (card: ContentCard, pillarId: string) => void;
  onClose: () => void;
}) {
  const [skipped, setSkipped] = useState<string[]>([]);
  const queue = cards.filter(c => !skipped.includes(c.id));
  const card = queue[0];

  if (!card) {
    return (
      <Modal open onClose={onClose} title="Sort into pillars" size="md">
        <div className="p-8 text-center">
          <p className="font-medium text-stone-700">All sorted.</p>
          <p className="text-sm text-stone-400 mt-1">The map is in full color now.</p>
          <button onClick={onClose} className="btn-primary mt-5">Done</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title={`Sort into pillars — ${queue.length} left`} size="md">
      <div className="p-6 space-y-5">
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-4">
          <p className="font-medium text-stone-900 leading-snug">{card.title || 'Untitled post'}</p>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {card.createdMonth && <span className="text-xs text-stone-400">{card.createdMonth}</span>}
            {card.contentType && <span className="text-xs text-stone-500">{card.contentType}</span>}
            {card.postUrl?.trim() && (
              <a href={/^https?:\/\//i.test(card.postUrl) ? card.postUrl : `https://${card.postUrl}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-sky-600 hover:underline">
                <ExternalLink size={11} /> open the live post
              </a>
            )}
          </div>
          {card.hook && <p className="text-xs text-stone-500 mt-2 line-clamp-2">{card.hook}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {pillars.map(p => (
            <button key={p.id} onClick={() => onAssign(card, p.id)}
              className="flex items-center gap-2.5 px-4 py-3 text-sm font-medium text-stone-800 bg-white border border-stone-200 rounded-xl hover:border-stone-400 hover:shadow-sm transition-all text-left">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
              {p.name}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button onClick={() => setSkipped(s => [...s, card.id])} className="text-xs text-stone-400 hover:text-stone-700">
            Skip this one
          </button>
          <button onClick={onClose} className="btn-secondary">Stop for now</button>
        </div>
      </div>
    </Modal>
  );
}

// ── Month bars ───────────────────────────────────────────────────────────────

function MonthBars({ months, segments, countFor, pillarFilter, journey, accent, onSave }: {
  months: string[];
  segments: { id: string; name: string; color: string }[];
  countFor: (month: string, segId: string) => number;
  pillarFilter: string | null;
  journey: JourneyData;
  accent: string;
  onSave: (p: Partial<JourneyData>) => void;
}) {
  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const visible = (segId: string) => pillarFilter === null || pillarFilter === segId;
  const totalFor = (m: string) => segments.reduce((n, s) => n + (visible(s.id) ? countFor(m, s.id) : 0), 0);
  const maxTotal = Math.max(1, ...months.map(totalFor));
  const BAR_H = 260;

  const checkIn = (m: string) => journey.checkIns.find(c => c.month === m);

  function saveCheckIn(month: string) {
    const rest = journey.checkIns.filter(c => c.month !== month);
    onSave({ checkIns: draft === '' ? rest : [...rest, { month, value: Number(draft) }] });
    setEditingMonth(null);
    setDraft('');
  }

  return (
    <div className="overflow-x-auto">
      {/* The wipe: each month's bar rises from the floor, left to right */}
      <style>{`
        @keyframes journeyRise {
          from { transform: scaleY(0); }
          to { transform: scaleY(1); }
        }
      `}</style>
      <div className="flex items-end gap-5 md:gap-7 min-w-max pb-1">
        {months.map((m, mi) => {
          const total = totalFor(m);
          const ci = checkIn(m);
          return (
            <div key={m} className="flex flex-col items-center gap-2 w-24 group">
              {/* north-star number, tap to log */}
              {editingMonth === m ? (
                <input autoFocus type="number" value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onBlur={() => saveCheckIn(m)}
                  onKeyDown={e => e.key === 'Enter' && saveCheckIn(m)}
                  className="w-14 text-center text-[11px] border border-stone-300 rounded px-0.5 py-0.5 focus:outline-none" />
              ) : (
                <button onClick={() => { setEditingMonth(m); setDraft(ci?.value?.toString() ?? ''); }}
                  className="text-[11px] font-semibold tabular-nums transition-colors"
                  style={{ color: ci ? accent : '#d6d3d1' }}
                  title={journey.northStar ? `${journey.northStar} in ${monthLabel(m)} — tap to log` : 'Set the goal below, then log its number here monthly'}>
                  {ci ? ci.value : '+'}
                </button>
              )}

              {/* stacked bar — rises on load, lifts on hover */}
              <div
                className="w-16 md:w-20 flex flex-col-reverse rounded-lg overflow-hidden bg-stone-100 transition-transform duration-200 group-hover:-translate-y-1.5 group-hover:shadow-lg"
                style={{
                  height: BAR_H,
                  transformOrigin: 'bottom',
                  animation: `journeyRise 0.65s cubic-bezier(0.22, 1, 0.36, 1) both`,
                  animationDelay: `${mi * 110}ms`,
                }}
              >
                {segments.map(seg => {
                  if (!visible(seg.id)) return null;
                  const count = countFor(m, seg.id);
                  if (!count) return null;
                  const h = Math.max(6, Math.round((count / maxTotal) * BAR_H));
                  return (
                    <div key={seg.id || 'unsorted'} style={{ height: h, backgroundColor: seg.color }}
                      title={`${seg.name}: ${count} post${count > 1 ? 's' : ''}`} />
                  );
                })}
              </div>

              <span className="text-[10px] uppercase tracking-wide text-stone-400">{monthLabel(m)}</span>
              <span className="text-sm font-bold text-stone-700 tabular-nums -mt-1.5">{total || ''}</span>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-stone-400 mt-2">
        Hover a color for the pillar and count. The number on top is your goal metric for that month — tap to log it.
      </p>
    </div>
  );
}

// ── Goal ─────────────────────────────────────────────────────────────────────

function GoalCard({ journey, accent, onSave }: { journey: JourneyData; accent: string; onSave: (p: Partial<JourneyData>) => void }) {
  const [editing, setEditing] = useState(false);
  const [metric, setMetric] = useState(journey.northStar);
  const [value, setValue] = useState(journey.targetValue?.toString() ?? '');
  const [date, setDate] = useState(journey.targetDate ?? '');

  const latest = [...journey.checkIns].sort((a, b) => a.month.localeCompare(b.month)).pop();
  const progress = journey.targetValue && latest ? Math.min(100, Math.round((latest.value / journey.targetValue) * 100)) : null;

  if (!editing) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${accent}20` }}>
            <Target size={17} style={{ color: accent }} />
          </div>
          <div className="flex-1 min-w-0">
            {journey.northStar ? (
              <>
                <p className="font-semibold text-stone-900 text-sm">
                  {journey.targetValue != null ? `${journey.targetValue} ` : ''}{journey.northStar}
                  {journey.targetDate ? ` by ${monthLabel(journey.targetDate)}` : ''}
                </p>
                {progress !== null && latest ? (
                  <>
                    <div className="relative h-2 bg-stone-100 rounded-full overflow-hidden mt-2 max-w-sm">
                      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${progress}%`, backgroundColor: accent }} />
                    </div>
                    <p className="text-xs text-stone-400 mt-1">{latest.value} of {journey.targetValue} ({progress}%) as of {monthLabel(latest.month)}</p>
                  </>
                ) : (
                  <p className="text-xs text-stone-400 mt-0.5">Log the monthly number on the map above and progress appears here.</p>
                )}
              </>
            ) : (
              <>
                <p className="font-semibold text-stone-500 text-sm">No goal set yet</p>
                <p className="text-xs text-stone-400 mt-0.5">One metric, one number, one date. The map measures against it.</p>
              </>
            )}
          </div>
          <button onClick={() => { setMetric(journey.northStar); setValue(journey.targetValue?.toString() ?? ''); setDate(journey.targetDate ?? ''); setEditing(true); }}
            className="p-1.5 rounded-md text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-colors shrink-0">
            <Pencil size={14} />
          </button>
        </div>
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
