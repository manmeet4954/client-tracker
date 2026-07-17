'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart3, BookOpen, ChevronDown, ChevronUp, FlaskConical, Instagram, Layers, Sparkles } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import { CONTENT_STAGES } from '@/types';
import type {
  AnalyticsPayload, ExperimentStat, ExpressionNumbers, ExpressionStat,
  FunnelData, MetricReading, PatternsData, PillarScore, PostTags, TopicGroup,
} from '@/types/analytics';

// The Analytics tab (Spec 05). Three layers on one page:
//   1. Pillar Scorecard: is the strategy working?
//   3. Funnel: is it building the business?
//   2. Comparison (owner window): what is winning and why?
// Every number arrives precomputed from /api/analytics. This file only renders.

function pickAccent(brandColors: { hex: string; role?: string }[] | undefined, fallback: string): string {
  if (!brandColors?.length) return fallback;
  const primary = brandColors.find(c => /primary|accent/i.test(c.role ?? ''));
  return primary?.hex ?? brandColors[0]?.hex ?? fallback;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function fmt(n: number | null | undefined): string {
  return n == null ? 'no data' : n.toLocaleString('en-US');
}

function fmtRate(r: number | null | undefined): string {
  return r == null ? 'no data' : `${(r * 100).toFixed(1)}%`;
}

// The locked tag list (display copy). Values must match the server's list in
// app/api/ig-tag/route.ts; the server validates every correction anyway.
const TAG_FIELDS: { field: string; key: 'topicType' | 'hookType' | 'closeType' | 'ctaType' | 'captionStyle'; label: string; options: string[] }[] = [
  { field: 'topic_type', key: 'topicType', label: 'Topic type', options: ['how-to', 'story', 'myth-busting', 'fear-based', 'listicle', 'proof-win', 'trend', 'other'] },
  { field: 'hook_type', key: 'hookType', label: 'Hook', options: ['question', 'bold-claim', 'story-open', 'statistic', 'pain-point', 'other'] },
  { field: 'close_type', key: 'closeType', label: 'Close', options: ['cta-close', 'punchline', 'summary', 'open-loop', 'other'] },
  { field: 'cta_type', key: 'ctaType', label: 'CTA', options: ['comment', 'dm', 'link', 'save-share', 'follow', 'none'] },
  { field: 'caption_style', key: 'captionStyle', label: 'Caption', options: ['short', 'long', 'storytelling', 'list'] },
];
const TAG_BOOL_FIELDS: { field: string; key: 'hasFace' | 'trendingAudio'; label: string; trueWord: string; falseWord: string }[] = [
  { field: 'has_face', key: 'hasFace', label: 'Face', trueWord: 'face', falseWord: 'no face' },
  { field: 'trending_audio', key: 'trendingAudio', label: 'Audio', trueWord: 'trending audio', falseWord: 'original audio' },
];

const VERDICT_STYLE: Record<PillarScore['verdict'], { label: string; color: string; bg: string }> = {
  earning:    { label: 'Earning',            color: '#059669', bg: '#d1fae5' },
  steady:     { label: 'Steady',             color: '#0284c7', bg: '#e0f2fe' },
  dragging:   { label: 'Dragging',           color: '#dc2626', bg: '#fee2e2' },
  'too-early':{ label: 'Too early to judge', color: '#78716c', bg: '#f5f5f4' },
  'no-job':   { label: 'No job set',         color: '#78716c', bg: '#f5f5f4' },
  'no-goals': { label: 'No goals chosen',    color: '#78716c', bg: '#f5f5f4' },
};

export default function AnalyticsView({ clientId }: { clientId: string }) {
  const { role } = useApp();
  const { client, data } = useClient(clientId);
  const accent = client ? pickAccent(data.brandKit?.colors, client.color) : '#ea4711';

  const [payload, setPayload] = useState<AnalyticsPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    fetch(`/api/analytics?clientId=${encodeURIComponent(clientId)}`)
      .then(async res => {
        const body = await res.json().catch(() => null);
        if (!alive) return;
        if (!res.ok || !body || body.error) {
          setError(body?.error ?? 'Could not load the numbers.');
        } else {
          setPayload(body as AnalyticsPayload);
        }
      })
      .catch(() => { if (alive) setError('Could not load the numbers.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [clientId]);

  // Spec 06: owner corrects a tag. Saved server side (role-checked there) and
  // marked sticky, then mirrored into local state so the chip updates.
  const correctTag = async (igMediaId: string, field: string, value: string | boolean | null): Promise<boolean> => {
    try {
      const res = await fetch('/api/ig-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'correct', igMediaId, field, value }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) return false;
    } catch {
      return false;
    }
    setPayload(prev => {
      if (!prev?.comparison) return prev;
      const def = TAG_FIELDS.find(f => f.field === field) ?? TAG_BOOL_FIELDS.find(f => f.field === field);
      if (!def) return prev;
      const patch = (e: ExpressionStat): ExpressionStat => {
        if (e.igMediaId !== igMediaId || !e.tags) return e;
        const tags: PostTags = {
          ...e.tags,
          [def.key]: value,
          corrected: e.tags.corrected.includes(field) ? e.tags.corrected : [...e.tags.corrected, field],
        };
        return { ...e, tags };
      };
      return {
        ...prev,
        comparison: {
          ...prev.comparison,
          topics: prev.comparison.topics.map(t => ({ ...t, expressions: t.expressions.map(patch) })),
        },
      };
    });
    return true;
  };

  return (
    <div className="p-4 md:p-8 space-y-5">
      <div>
        <h2 className="text-lg font-bold text-stone-900">Analytics</h2>
        <p className="text-sm text-stone-400">What the numbers say, in plain words. Every post is compared with this account only.</p>
      </div>

      {loading && <LoadingBlocks />}

      {!loading && error && (
        <div className="bg-white rounded-xl border border-stone-200 p-8 text-center">
          <p className="text-sm font-medium text-stone-700">Something went wrong loading the numbers.</p>
          <p className="text-xs text-stone-400 mt-1">{error}</p>
        </div>
      )}

      {!loading && !error && payload && !payload.connected && (
        <ConnectPrompt isOwner={role === 'owner'} />
      )}

      {!loading && !error && payload && payload.connected && (
        <>
          <Scorecard payload={payload} accent={accent} />
          <Funnel funnel={payload.funnel} accent={accent} />
          {payload.comparison && (
            <Comparison
              topics={payload.comparison.topics}
              experiments={payload.comparison.experiments}
              patterns={payload.comparison.patterns}
              onCorrect={correctTag}
            />
          )}
        </>
      )}
    </div>
  );
}

// ── loading and empty states ─────────────────────────────────────────────────

function LoadingBlocks() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[0, 1].map(i => (
          <div key={i} className="bg-white rounded-xl border border-stone-200 p-5 animate-pulse space-y-3">
            <div className="h-4 bg-stone-100 rounded w-1/3" />
            <div className="h-3 bg-stone-100 rounded w-2/3" />
            <div className="h-3 bg-stone-100 rounded w-1/2" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-stone-200 p-5 animate-pulse">
        <div className="h-4 bg-stone-100 rounded w-1/4 mb-4" />
        <div className="h-24 bg-stone-50 rounded" />
      </div>
    </div>
  );
}

function ConnectPrompt({ isOwner }: { isOwner: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-10 text-center">
      <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto mb-3">
        <Instagram size={20} className="text-stone-400" />
      </div>
      <p className="font-medium text-stone-800">Connect this account to start</p>
      {isOwner ? (
        <p className="text-sm text-stone-400 mt-1">
          Link this client&apos;s Instagram account in{' '}
          <Link href="/connections" className="text-sky-600 hover:underline">Connections</Link>
          {' '}and the numbers start flowing in daily.
        </p>
      ) : (
        <p className="text-sm text-stone-400 mt-1">
          The Instagram account is not connected yet. Numbers appear here once it is.
        </p>
      )}
    </div>
  );
}

// ── Layer 1: the scorecard ───────────────────────────────────────────────────

function Scorecard({ payload, accent }: { payload: AnalyticsPayload; accent: string }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 size={16} style={{ color: accent }} />
        <h3 className="font-semibold text-stone-900 text-sm">Pillar scorecard</h3>
        <span className="text-xs text-stone-400">Last 10 weeks, judged on each pillar&apos;s job</span>
      </div>

      {payload.scorecard.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 p-8 text-center">
          <p className="text-sm font-medium text-stone-700">No pillars yet.</p>
          <p className="text-xs text-stone-400 mt-1">Create pillars on the Content tab and give each one a job. The scorecard builds itself from there.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {payload.scorecard.map(p => <PillarCard key={p.pillarId} score={p} />)}
        </div>
      )}
    </section>
  );
}

function deltaChip(m: MetricReading) {
  if (m.ratio == null) {
    return <span className="text-xs text-stone-400">{m.note ?? 'no data yet'}</span>;
  }
  const pct = Math.round((m.ratio - 1) * 100);
  const tone = pct >= 15 ? { color: '#059669', bg: '#d1fae5' }
    : pct <= -15 ? { color: '#dc2626', bg: '#fee2e2' }
    : { color: '#78716c', bg: '#f5f5f4' };
  const vsWords = m.vs === 'baseline' ? "vs this account's usual" : 'vs the 5 weeks before';
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums" style={{ color: tone.color, backgroundColor: tone.bg }}>
        {pct >= 0 ? '+' : ''}{pct}%
      </span>
      <span className="text-[11px] text-stone-400">{vsWords}</span>
    </span>
  );
}

function PillarCard({ score }: { score: PillarScore }) {
  const [open, setOpen] = useState(false);
  const v = VERDICT_STYLE[score.verdict];

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
      <div className="flex items-start gap-2.5">
        <span className="w-3 h-3 rounded-full shrink-0 mt-1" style={{ backgroundColor: score.color }} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-stone-900 text-sm leading-snug">{score.name}</p>
          {score.purpose && <p className="text-xs text-stone-400 mt-0.5">{score.purpose}</p>}
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold shrink-0" style={{ color: v.color, backgroundColor: v.bg }}>
          {v.label}
        </span>
      </div>

      {/* quantity vs mix target */}
      <p className="text-xs text-stone-500">
        {score.postedInWindow === 0
          ? 'No linked posts in the last 10 weeks.'
          : <>
              {score.postedInWindow} post{score.postedInWindow === 1 ? '' : 's'} in the last 10 weeks
              {score.experimentCount > 0 && <> ({score.experimentCount} {score.experimentCount === 1 ? 'is an experiment' : 'are experiments'}, judged separately)</>}
              {score.mixActualPct != null && (
                <>. That is {score.mixActualPct}% of content{score.mixTargetPct != null ? `, target ${score.mixTargetPct}%` : ''}.</>
              )}
            </>}
      </p>

      {/* the job's metrics */}
      {score.verdict === 'no-job' ? (
        <p className="text-sm text-stone-500 bg-stone-50 border border-stone-100 rounded-lg px-3 py-2.5">
          Set this pillar&apos;s job to judge it. One tap in the pillar settings on the Content tab.
        </p>
      ) : score.verdict === 'no-goals' ? (
        <p className="text-sm text-stone-500 bg-stone-50 border border-stone-100 rounded-lg px-3 py-2.5">
          Choose this account&apos;s goals on the Journey tab and this pillar gets judged on them.
        </p>
      ) : score.metrics.length > 0 && (
        <div className="space-y-2">
          {score.metrics.map(m => (
            <div key={m.key} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-stone-700">{m.label}</p>
                <p className="text-[11px] text-stone-400">{m.explainer}</p>
              </div>
              <div className="shrink-0 text-right pt-0.5">{deltaChip(m)}</div>
            </div>
          ))}
        </div>
      )}

      {/* show-its-work */}
      <div className="pt-1 border-t border-stone-100">
        <button onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1 text-[11px] text-stone-400 hover:text-stone-700 transition-colors">
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          How this was judged
        </button>
        {open && <p className="text-xs text-stone-500 mt-1.5 leading-relaxed">{score.howJudged}</p>}
      </div>
    </div>
  );
}

// ── Layer 3: the funnel ──────────────────────────────────────────────────────

function Funnel({ funnel, accent }: { funnel: FunnelData; accent: string }) {
  const months = [...funnel.months].reverse(); // newest first
  const hasGoal = !!funnel.northStarLabel;
  const highlight = (on: boolean) => on ? { backgroundColor: `${accent}10` } : {};
  const gLinks = funnel.goals.includes('links');
  const gFollowers = funnel.goals.includes('followers');
  const gConversations = funnel.goals.includes('conversations');

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles size={16} style={{ color: accent }} />
        <h3 className="font-semibold text-stone-900 text-sm">The funnel</h3>
        <span className="text-xs text-stone-400">From posts to the business, month by month</span>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-5">
        {months.length === 0 ? (
          <p className="text-sm text-stone-400 py-6 text-center">The funnel fills in as posts go live and the daily numbers arrive.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-stone-400 border-b border-stone-100">
                  <th className="py-2 pr-3 font-medium">Month</th>
                  <th className="py-2 px-3 font-medium">Posts</th>
                  <th className="py-2 px-3 font-medium">Reach</th>
                  <th className="py-2 px-3 font-medium">Profile visits</th>
                  <th className="py-2 px-3 font-medium" style={highlight(gLinks)}>Link taps</th>
                  <th className="py-2 px-3 font-medium" style={highlight(gFollowers)}>Followers</th>
                  <th className="py-2 pl-3 font-medium" style={highlight(gConversations)}>
                    {hasGoal ? funnel.northStarLabel : 'Your goal'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {months.map(m => (
                  <tr key={m.month} className="border-b border-stone-50 last:border-0 text-stone-700 tabular-nums">
                    <td className="py-2.5 pr-3 font-medium text-stone-900 whitespace-nowrap">{monthLabel(m.month)}</td>
                    <td className="py-2.5 px-3">{m.posts}</td>
                    <td className="py-2.5 px-3">{fmt(m.reach)}</td>
                    <td className="py-2.5 px-3 text-stone-500">{m.profileVisits == null ? <NoData since={funnel.profileVisitsSince} /> : fmt(m.profileVisits)}</td>
                    <td className="py-2.5 px-3 text-stone-500" style={highlight(gLinks)}>{m.linkTaps == null ? <NoData since={funnel.linkTapsSince} /> : fmt(m.linkTaps)}</td>
                    <td className="py-2.5 px-3" style={highlight(gFollowers)}>
                      {m.followerChange == null ? <span className="text-stone-300">no data</span>
                        : <span>{m.followerChange >= 0 ? '+' : ''}{fmt(m.followerChange)}</span>}
                    </td>
                    <td className="py-2.5 pl-3" style={highlight(gConversations)}>
                      {hasGoal ? (m.northStar == null ? <span className="text-stone-300">not logged</span> : fmt(m.northStar)) : <span className="text-stone-300">no goal</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* plain-language legend and honesty notes */}
        <div className="mt-4 pt-3 border-t border-stone-100 space-y-1">
          <p className="text-[11px] text-stone-400">Posts: what went live that month. Reach: how many people saw those posts. Profile visits: people who tapped through to the profile. Link taps: people who tapped the link in bio. Followers: gained or lost that month.</p>
          {funnel.profileVisitsSince ? (
            <p className="text-[11px] text-stone-400">Profile visits and link taps are collected daily since {funnel.profileVisitsSince}. Earlier months honestly say no data.</p>
          ) : (
            <p className="text-[11px] text-stone-400">Profile visits and link taps start collecting with the next daily sync. Until then those columns say no data.</p>
          )}
          {!hasGoal && (
            <p className="text-[11px] text-stone-400">Set a goal in Journey to complete this. The last step of the funnel is your goal number, logged there monthly.</p>
          )}
          {funnel.goals.length > 0 && (
            <p className="text-[11px] text-stone-400">Tinted columns are the goals chosen for this account.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function NoData({ since }: { since: string | null }) {
  return <span className="text-stone-300" title={since ? `Collecting since ${since}` : 'Not collected yet'}>no data</span>;
}

// ── Layer 2: the comparison (owner window) ───────────────────────────────────

function stageChip(stage: ExpressionStat['stage']) {
  const s = CONTENT_STAGES.find(x => x.id === stage);
  if (!s) return null;
  return (
    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ color: s.color, backgroundColor: s.bg }}>
      {s.label}
    </span>
  );
}

function NumberGrid({ n }: { n: ExpressionNumbers }) {
  const cells: { label: string; value: string; title: string }[] = [
    { label: 'Views', value: fmt(n.views), title: 'Times it was played or seen' },
    { label: 'Reach', value: fmt(n.reach), title: 'How many people saw it' },
    { label: 'Saves', value: fmt(n.saves), title: 'People kept it to come back to' },
    { label: 'Shares', value: fmt(n.shares), title: 'People sent it to someone' },
    { label: 'Save rate', value: fmtRate(n.savesPerView), title: 'Saves per view' },
    { label: 'Share rate', value: fmtRate(n.sharesPerView), title: 'Shares per view' },
  ];
  return (
    <div className="grid grid-cols-3 gap-x-3 gap-y-1.5 mt-2">
      {cells.map(c => (
        <div key={c.label} title={c.title}>
          <p className="text-[10px] uppercase tracking-wide text-stone-400">{c.label}</p>
          <p className="text-xs font-semibold text-stone-800 tabular-nums">{c.value}</p>
        </div>
      ))}
    </div>
  );
}

// Spec 06: the tag chips on one post. The comparison layer is owner-only, so
// everyone who sees these chips may correct them; the server checks the role
// again on every save. Tap a chip to correct it; corrections are sticky.
function TagChips({ e, onCorrect }: {
  e: ExpressionStat;
  onCorrect: (igMediaId: string, field: string, value: string | boolean | null) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (!e.tags || !e.igMediaId) return null;
  const tags = e.tags;
  const mediaId = e.igMediaId;

  const save = async (field: string, value: string | boolean | null) => {
    setSaving(true);
    await onCorrect(mediaId, field, value);
    setSaving(false);
    setEditing(null);
  };

  const chipClass = (corrected: boolean) =>
    `px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer transition-colors ${
      corrected ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
    }`;

  return (
    <div className="mt-2 pt-2 border-t border-stone-100">
      {tags.summary && <p className="text-[11px] text-stone-500 mb-1.5">{tags.summary}</p>}
      <div className="flex items-center gap-1 flex-wrap">
        {TAG_FIELDS.map(f => {
          const value = tags[f.key];
          if (value == null && editing !== f.field) return null;
          if (editing === f.field) {
            return (
              <select
                key={f.field}
                autoFocus
                disabled={saving}
                defaultValue={value ?? ''}
                onBlur={() => setEditing(null)}
                onChange={ev => save(f.field, ev.target.value || null)}
                className="text-[10px] border border-stone-300 rounded px-1 py-0.5 bg-white text-stone-700"
              >
                <option value="">not set</option>
                {f.options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            );
          }
          return (
            <button
              key={f.field}
              type="button"
              title={`${f.label}. Tap to correct.${tags.corrected.includes(f.field) ? ' Corrected by you.' : ''}`}
              onClick={() => setEditing(f.field)}
              className={chipClass(tags.corrected.includes(f.field))}
            >
              {value}
            </button>
          );
        })}
        {TAG_BOOL_FIELDS.map(f => {
          const value = tags[f.key];
          if (value == null && editing !== f.field) return null;
          if (editing === f.field) {
            return (
              <select
                key={f.field}
                autoFocus
                disabled={saving}
                defaultValue={value == null ? '' : String(value)}
                onBlur={() => setEditing(null)}
                onChange={ev => save(f.field, ev.target.value === '' ? null : ev.target.value === 'true')}
                className="text-[10px] border border-stone-300 rounded px-1 py-0.5 bg-white text-stone-700"
              >
                <option value="">not set</option>
                <option value="true">{f.trueWord}</option>
                <option value="false">{f.falseWord}</option>
              </select>
            );
          }
          return (
            <button
              key={f.field}
              type="button"
              title={`${f.label}. Tap to correct.${tags.corrected.includes(f.field) ? ' Corrected by you.' : ''}`}
              onClick={() => setEditing(f.field)}
              className={chipClass(tags.corrected.includes(f.field))}
            >
              {value ? f.trueWord : f.falseWord}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Spec 06: the patterns section. Every sentence and number here was computed
// in code on the server; the AI only supplied the content tags.
function Patterns({ patterns }: { patterns: PatternsData }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5">
      <div className="flex items-center gap-1.5 mb-3">
        <BookOpen size={13} className="text-stone-400" />
        <p className="text-xs font-medium text-stone-500">Patterns</p>
        <span className="text-[11px] text-stone-400">What kind of post works, from the last 10 weeks</span>
      </div>

      {patterns.taggedPostCount === 0 ? (
        <p className="text-sm text-stone-400 py-4 text-center">
          No tagged posts in the window yet. The reading layer tags recent posts after each daily sync, and patterns appear once tagged posts build up.
        </p>
      ) : (
        <div className="space-y-4">
          {patterns.ctaFlags.length > 0 && (
            <div className="space-y-1">
              {patterns.ctaFlags.map(flag => (
                <p key={flag} className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{flag}</p>
              ))}
            </div>
          )}

          {patterns.patterns.length === 0 ? (
            <p className="text-sm text-stone-400">
              No combination has shown up 3 or more times yet, so there is nothing solid to call a pattern. Early signals below.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {patterns.patterns.map(p => (
                <li key={`${p.topicType}|${p.format}|${p.pillarName}`} className="flex items-start gap-2 text-sm text-stone-700">
                  <span
                    className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                    style={{ backgroundColor: p.medianRatio == null ? '#d6d3d1' : p.medianRatio >= 1.15 ? '#059669' : p.medianRatio <= 0.85 ? '#dc2626' : '#0284c7' }}
                  />
                  <span>{p.sentence}</span>
                </li>
              ))}
            </ul>
          )}

          {patterns.earlySignals.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-stone-400 mb-1">Early signals</p>
              <ul className="space-y-1">
                {patterns.earlySignals.map(p => (
                  <li key={`${p.topicType}|${p.format}|${p.pillarName}`} className="text-xs text-stone-500">{p.sentence}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[11px] text-stone-400">
            Based on {patterns.taggedPostCount} tagged post{patterns.taggedPostCount === 1 ? '' : 's'} in the last 10 weeks. Each post is compared with this account&apos;s own usual reach for its format. Experiments stay out. Tags come from the reading layer and you can correct any of them on the post cards above.
          </p>
        </div>
      )}
    </div>
  );
}

function Comparison({ topics, experiments, patterns, onCorrect }: {
  topics: TopicGroup[];
  experiments: ExperimentStat[];
  patterns: PatternsData;
  onCorrect: (igMediaId: string, field: string, value: string | boolean | null) => Promise<boolean>;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Layers size={16} className="text-stone-500" />
        <h3 className="font-semibold text-stone-900 text-sm">Comparison</h3>
        <span className="text-xs text-stone-400">Same idea, different versions. Observations only, no verdicts.</span>
      </div>

      {/* topic groups */}
      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <p className="text-xs font-medium text-stone-500 mb-3">Topic groups</p>
        {topics.length === 0 ? (
          <p className="text-sm text-stone-400 py-4 text-center">
            No topic groups yet. Use Repurpose on a card to try the same idea in another format, and the versions line up here side by side.
          </p>
        ) : (
          <div className="space-y-5">
            {topics.map(t => (
              <div key={t.topicId}>
                <p className="text-sm font-semibold text-stone-900 mb-2">{t.name}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {t.expressions.map(e => (
                    <div key={e.cardId} className="border border-stone-200 rounded-lg p-3">
                      <p className="text-xs font-medium text-stone-800 leading-snug">{e.title}</p>
                      <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                        {e.format && <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-stone-100 text-stone-600">{e.format}</span>}
                        {stageChip(e.stage)}
                        <span className="inline-flex items-center gap-1 text-[10px] text-stone-500">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: e.pillarColor }} />
                          {e.pillarName}
                        </span>
                      </div>
                      {e.numbers ? <NumberGrid n={e.numbers} /> : (
                        <p className="text-[11px] text-stone-400 mt-2">
                          {e.stage === 'posted' ? 'Posted, but not linked to a live Instagram post yet. Paste the post link on the card.' : 'Not posted yet, so no numbers.'}
                        </p>
                      )}
                      <TagChips e={e} onCorrect={onCorrect} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-[11px] text-stone-400">Each version stands on its own. Versions of one topic are never averaged into one number.</p>
          </div>
        )}
      </div>

      {/* experiments */}
      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <div className="flex items-center gap-1.5 mb-3">
          <FlaskConical size={13} className="text-stone-400" />
          <p className="text-xs font-medium text-stone-500">Experiments</p>
        </div>
        {experiments.length === 0 ? (
          <p className="text-sm text-stone-400 py-4 text-center">
            No experiments running. Flag a card as an experiment to test an idea without touching its pillar&apos;s scorecard.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {experiments.map(e => (
              <div key={e.cardId} className="border border-stone-200 rounded-lg p-3">
                <p className="text-xs font-medium text-stone-800 leading-snug">{e.title}</p>
                <div className="flex items-center gap-1.5 mt-1.5">{stageChip(e.stage)}<span className="text-[10px] text-stone-500">{e.pillarName}</span></div>
                {e.hypothesis && <p className="text-[11px] text-stone-500 mt-1.5 italic">Testing: {e.hypothesis}</p>}
                {e.numbers ? <NumberGrid n={e.numbers} /> : <p className="text-[11px] text-stone-400 mt-2">No result yet. Numbers appear once the post is live and linked.</p>}
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-stone-400 mt-3">Experiment posts never count in their pillar&apos;s verdict, so a wild test cannot drag a pillar down.</p>
      </div>

      {/* patterns (Spec 06: the reading layer) */}
      <Patterns patterns={patterns} />
    </section>
  );
}
