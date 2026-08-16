'use client';

// The pieces every Analysis surface is built from — the restructure handoff,
// "ANALYSIS", dressed in the design tokens.
//
// Nothing here computes. Every number, width, plural and day name arrives from
// `lib/analysis/groups.ts`, which is tested on plain Node. These are windows.
//
// Coverage lives in ONE component, `CoverageFirst`, and it is the first block of
// every group. The old per-tab `CoverageBanner` is gone: eight copies of a rule
// is eight chances to forget it, and the group already renders it above
// everything. A screen whose own coverage differs from the group's says so in a
// line rather than drawing a second bar.

import type { ReactNode } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import {
  HATCH, NO_READING, coverageBar, coverageDiffersLine, formatNumber, metricCard, percentWords,
} from '@/lib/analysis/groups';
import type {
  BarModel, Coverage, Measured, MetricCardModel, PillTone,
} from '@/lib/analysis/groups';

export type { BarModel, Coverage, Measured, MetricCardModel, PillTone };
export { HATCH, NO_READING, formatNumber, percentWords };

// ── Frames ───────────────────────────────────────────────────────────────────

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-card border border-hairline bg-surface shadow-card ${className}`}>
      {children}
    </div>
  );
}

/** 11.5px / 700 / .09em, uppercase, muted. The label above a block. */
export function Kicker({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11.5px] font-bold uppercase tracking-[.09em] text-muted">{children}</div>
  );
}

/** One screen's heading inside a group. Bricolage 700, 21px. */
export function ScreenTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="font-display text-[21px] font-bold leading-[1.15] tracking-[-.02em] text-text">
      {children}
    </h3>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Kicker>{children}</Kicker>;
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-hairline px-[18px] py-6 text-center text-sm text-faint">
      {children}
    </div>
  );
}

export function GhostButton(
  { href, onClick, children }: { href?: string; onClick?: () => void; children: ReactNode },
) {
  const className = 'inline-block whitespace-nowrap rounded-xl border border-[rgba(23,21,26,.14)] px-[17px] py-[9px] text-[13.5px] font-semibold text-text';
  if (href) return <Link href={href} className={className}>{children}</Link>;
  return <button type="button" onClick={onClick} className={className}>{children}</button>;
}

export function DarkButton(
  { href, onClick, children }: { href?: string; onClick?: () => void; children: ReactNode },
) {
  const className = 'inline-block whitespace-nowrap rounded-xl bg-ink px-[18px] py-2.5 text-[13.5px] font-semibold text-white';
  if (href) return <Link href={href} className={className}>{children}</Link>;
  return <button type="button" onClick={onClick} className={className}>{children}</button>;
}

// ── Coverage, the first thing on screen ─────────────────────────────────────

const TONE_CLASS: Record<PillTone, string> = {
  positive: 'bg-positive-bg text-positive',
  attention: 'bg-[rgba(234,71,17,.10)] text-accent-text',
  neutral: 'bg-control text-muted',
};

export function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return (
    <span className={`whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11.5px] font-semibold ${TONE_CLASS[tone]}`}>
      {children}
    </span>
  );
}

/**
 * The 12px bar of collected against uncollected days, and the two lines under
 * it. Absent when the API sent no coverage: an empty coverage card would be a
 * claim about days nobody counted.
 */
export function CoverageFirst({ coverage, fixHref }: { coverage?: Coverage; fixHref?: string }) {
  const bar = coverageBar(coverage);
  if (!bar) return null;
  return (
    <Card className="px-5 py-[18px]">
      <Kicker>Coverage</Kicker>
      <div className="mt-3 flex flex-wrap items-center gap-3.5">
        <div className="min-w-[200px] flex-1">
          <div className="flex h-3 overflow-hidden rounded-full bg-chip">
            <span className="bg-ink" style={{ width: `${bar.collectedPct}%` }} />
            <span style={{ width: `${bar.uncollectedPct}%`, background: HATCH }} />
          </div>
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-[12.5px] text-muted">
            <span>{bar.daysLine}</span>
            {bar.sinceLine ? <span className="font-semibold text-overdue">{bar.sinceLine}</span> : null}
          </div>
        </div>
        {fixHref && !bar.complete ? <GhostButton href={fixHref}>Fix connection</GhostButton> : null}
      </div>
      <p className="mt-3 text-[13px] leading-[1.55] text-muted">
        {bar.readAgainstLine
          ? `${bar.readAgainstLine} Missing days are shown as gaps, not zeros.`
          : 'Data collection is up to date. Metrics below reflect the full period.'}
      </p>
    </Card>
  );
}

/** A screen inside a group reading a different stretch than the block above it. */
export function CoverageDiffers({ screen, group }: { screen?: Coverage; group?: Coverage }) {
  const line = coverageDiffersLine(screen, group);
  if (!line) return null;
  return (
    <p className="rounded-card border border-hairline bg-surface px-[18px] py-3 text-[13px] text-overdue">
      {line}
    </p>
  );
}

// ── Numbers ──────────────────────────────────────────────────────────────────

const NOTE_CLASS = {
  muted: 'text-muted',
  faint: 'text-faint',
  positive: 'text-positive',
  overdue: 'text-overdue',
} as const;

/** Label, figure, one line under it. The figure is an em dash or a reading. */
export function MetricCard({ model }: { model: MetricCardModel }) {
  return (
    <Card className="px-[18px] py-4">
      <div className="text-[11.5px] font-bold uppercase tracking-[.09em] text-faint">{model.label}</div>
      <div className="mt-1.5 font-display text-[32px] font-bold leading-[1.15] tracking-[-.02em] tabular-nums text-text">
        {model.value}
      </div>
      {model.note ? (
        <div className={`text-[12.5px] font-semibold ${NOTE_CLASS[model.tone]}`}>{model.note}</div>
      ) : null}
    </Card>
  );
}

export function MetricGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fit,minmax(148px,1fr))] gap-3">{children}</div>;
}

/** Convenience: label + Measured straight onto a card. */
export function Metric(
  { label, m, coverage }: { label: string; m?: Measured; coverage?: Coverage },
) {
  return <MetricCard model={metricCard(label, m, coverage)} />;
}

/**
 * A bar. Hatched means "we were not looking" and fills the whole track, so a
 * gap can never be mistaken for a low number.
 */
export function Meter({ bar, height = 7 }: { bar: BarModel; height?: number }) {
  return (
    <div className="overflow-hidden rounded-full bg-chip" style={{ height }}>
      <span
        className="block h-full rounded-full"
        style={{ width: `${bar.pct}%`, background: bar.hatched ? HATCH : '#1c1a21' }}
      />
    </div>
  );
}

/** A number, or the honest reason there is not one. Zero is never a stand-in. */
export function Figure({ m, suffix }: { m: Measured | undefined; suffix?: string }) {
  if (!m) return <span className="text-faint">{NO_READING}</span>;
  switch (m.state) {
    case 'value':
      return (
        <span className="font-semibold tabular-nums text-text">
          {formatNumber(m.value)}{suffix ?? ''}
          {m.n !== undefined ? <span className="ml-1 text-xs font-normal text-faint">n={m.n}</span> : null}
        </span>
      );
    case 'no-coverage':
      return <span className="text-overdue">not collected</span>;
    case 'not-measurable':
      return <span className="text-faint">{m.because ?? 'not measured for this profile'}</span>;
    default:
      return <span className="text-faint">insufficient data{m.owed ? `: ${m.owed}` : ''}</span>;
  }
}

export const BAND_STYLE: Record<string, { label: string; tone: PillTone }> = {
  earning: { label: 'Performing', tone: 'positive' },
  steady: { label: 'Steady', tone: 'positive' },
  dragging: { label: 'Underperforming', tone: 'attention' },
  'too-early': { label: 'Insufficient data', tone: 'neutral' },
  blocked: { label: 'Not measured yet', tone: 'neutral' },
  'not-measurable': { label: 'Not measurable', tone: 'neutral' },
  'coverage-gap': { label: 'Collection gap', tone: 'attention' },
};

export function Band({ state }: { state: string }) {
  const style = BAND_STYLE[state] ?? BAND_STYLE['too-early'];
  return <Pill tone={style.tone}>{style.label}</Pill>;
}

/** "Insufficient data", with exactly what is still needed. */
export function TooEarly({ owed }: { owed?: string }) {
  return (
    <div className="rounded-xl bg-control px-3.5 py-2.5 text-[13px] text-muted">
      <span className="font-semibold text-text">Insufficient data.</span>
      {owed ? <span> {owed}.</span> : null}
    </div>
  );
}

/** One plain sentence, folded away until she asks for it. */
export function ShowMyWorking({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!children) return null;
  return (
    <div className="mt-2.5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-[12.5px] font-semibold text-faint underline underline-offset-2 hover:text-text"
      >
        {open ? 'Hide calculation' : 'Show calculation'}
      </button>
      {open ? (
        <p className="mt-2 rounded-xl bg-control px-3.5 py-2.5 text-[12.5px] leading-[1.6] text-muted">
          {children}
        </p>
      ) : null}
    </div>
  );
}

/** One row in a list card: name on the left, reading on the right. */
export function Row({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3.5 border-t border-divider px-[18px] py-3.5 first:border-t-0">
      {children}
    </div>
  );
}
