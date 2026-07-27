'use client';

// The three shared pieces every analysis surface uses — spec 27 §21.
//
// CoverageBanner exists because §4.4's rule is that coverage renders BEFORE
// performance, on every surface, and a rule each screen has to remember is a rule
// one screen will forget. TooEarly and ShowMyWorking exist for the same reason:
// "too early to judge" and "here is the working" have one wording, in one place.

import type { ReactNode } from 'react';
import { useState } from 'react';

export interface Coverage {
  complete: boolean;
  days_expected: number;
  days_covered: number;
  words: string;
  gaps: { from: string; to: string; reason: string }[];
}

/** Not a badge in a corner. If the pipe is stalled, this is the first thing on
 *  the screen, in her language (§5). */
export function CoverageBanner({ coverage }: { coverage: Coverage | undefined }) {
  if (!coverage) return null;
  if (coverage.complete) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        Collecting normally. {coverage.days_covered} of {coverage.days_expected} days in this period.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
      <div className="text-sm font-semibold text-amber-900">Not collecting</div>
      <div className="mt-1 text-sm text-amber-900">{coverage.words}</div>
      <div className="mt-2 text-xs text-amber-800">
        {coverage.days_covered} of {coverage.days_expected} days collected. The numbers below stop where the collection stopped.
      </div>
    </div>
  );
}

/** "Too early to judge", with exactly what is still owed (§7.3). */
export function TooEarly({ owed }: { owed?: string }) {
  return (
    <div className="rounded-md bg-stone-100 px-3 py-2 text-sm text-stone-600">
      <span className="font-medium">Too early to judge.</span>
      {owed ? <span> {owed}.</span> : null}
    </div>
  );
}

/** One plain sentence, folded away until she asks for it (§7.2). */
export function ShowMyWorking({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-xs font-medium text-stone-500 underline underline-offset-2 hover:text-stone-800"
      >
        {open ? 'Hide my working' : 'Show my working'}
      </button>
      {open ? (
        <p className="mt-2 rounded-md bg-stone-50 px-3 py-2 text-xs leading-relaxed text-stone-600">
          {children}
        </p>
      ) : null}
    </div>
  );
}

export interface Measured {
  state: 'value' | 'too-early' | 'no-coverage' | 'not-measurable';
  value?: number;
  n?: number;
  owed?: string;
  because?: string;
}

/** A number, or the honest reason there is not one. Zero is never used for any
 *  of the last three states (§4.4). */
export function Figure({ m, suffix }: { m: Measured | undefined; suffix?: string }) {
  if (!m) return <span className="text-stone-400">no reading</span>;
  switch (m.state) {
    case 'value':
      return (
        <span className="font-semibold text-stone-900">
          {formatNumber(m.value)}{suffix ?? ''}
          {m.n ? <span className="ml-1 text-xs font-normal text-stone-500">n={m.n}</span> : null}
        </span>
      );
    case 'no-coverage':
      return <span className="text-amber-700">we were not looking</span>;
    case 'not-measurable':
      return <span className="text-stone-500">{m.because ?? 'not measured for this profile'}</span>;
    default:
      return <span className="text-stone-500">too early{m.owed ? `: ${m.owed}` : ''}</span>;
  }
}

export function formatNumber(v: number | undefined): string {
  if (v === undefined) return 'no reading';
  if (Math.abs(v) < 1 && v !== 0) return v.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  return v.toLocaleString('en-US');
}

export function percentWords(v: number | undefined): string {
  if (v === undefined) return 'no lift yet';
  const pct = Math.round(v * 1000) / 10;
  return `${pct > 0 ? '+' : ''}${pct}%`;
}

export const BAND_STYLE: Record<string, { label: string; className: string }> = {
  earning: { label: 'Earning', className: 'bg-emerald-100 text-emerald-800' },
  steady: { label: 'Steady', className: 'bg-sky-100 text-sky-800' },
  dragging: { label: 'Dragging', className: 'bg-rose-100 text-rose-800' },
  'too-early': { label: 'Too early to judge', className: 'bg-stone-100 text-stone-600' },
  blocked: { label: 'Not measured yet', className: 'bg-stone-100 text-stone-600' },
  'not-measurable': { label: 'Not measurable here', className: 'bg-stone-100 text-stone-600' },
  'coverage-gap': { label: 'Collection gap', className: 'bg-amber-100 text-amber-800' },
};

export function Band({ state }: { state: string }) {
  const style = BAND_STYLE[state] ?? BAND_STYLE['too-early'];
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${style.className}`}>
      {style.label}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-stone-300 px-4 py-6 text-center text-sm text-stone-500">{children}</div>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">{children}</h3>;
}
