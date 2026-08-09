// Strategy as a layer, not a gate (docs/Strategy as a Layer, not a Gate.md).
//
// Strategy is eight facts about a brand, always partial, never a door. This
// module answers exactly one question: which of the eight are known right now.
// A fact is known when its box is non-empty. Nothing here blocks anything;
// the count is information, not permission.
//
// Every fact reads a slice the screens already render. No new storage:
//   Positioning  brand.tagline      (the positioning statement box on Brand)
//   Audience     brand.audience
//   Voice        brand.voice        (new optional field on the brand slice)
//   Pillars      pillars
//   Platforms    platforms
//   Cadence      postTarget
//   Goals        goals              (the ClientGoal picks the Journey tab reads)
//   Look         brandKit           (colors or fonts)
//
// Imports are relative and extensioned so plain Node can run this file in the
// test harness, no build step.

import type { BrandKit, BrandOverview, ClientGoal, ContentPillar } from '../../types/index.ts';

/** The slices the eight facts read. Structurally a subset of ClientData. */
export interface FactsInput {
  brand?: Partial<BrandOverview>;
  pillars?: ContentPillar[];
  platforms?: string[];
  postTarget?: number;
  goals?: ClientGoal[];
  brandKit?: BrandKit;
}

export interface FactsCount {
  known: number;
  total: 8;
  /** The plain names of the facts still blank, in the page's order. */
  missing: string[];
}

function filled(s: string | undefined | null): boolean {
  return (s ?? '').trim().length > 0;
}

/** The eight, in the order the page shows them. */
export const FACT_NAMES = [
  'Positioning', 'Audience', 'Voice', 'Pillars', 'Platforms', 'Cadence', 'Goals', 'Look',
] as const;

const CHECKS: Record<(typeof FACT_NAMES)[number], (d: FactsInput) => boolean> = {
  Positioning: d => filled(d.brand?.tagline),
  Audience: d => filled(d.brand?.audience),
  Voice: d => filled(d.brand?.voice),
  Pillars: d => (d.pillars ?? []).length > 0,
  Platforms: d => (d.platforms ?? []).some(p => filled(p)),
  Cadence: d => (d.postTarget ?? 0) > 0,
  Goals: d => (d.goals ?? []).length > 0,
  Look: d => (d.brandKit?.colors ?? []).length > 0 || (d.brandKit?.fonts ?? []).length > 0,
};

export function factsKnown(data: FactsInput): FactsCount {
  const missing = FACT_NAMES.filter(name => !CHECKS[name](data));
  return { known: FACT_NAMES.length - missing.length, total: 8, missing: [...missing] };
}

const WORDS = ['None', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'];

/** The quiet status line: "Three of eight known." Derived, never typed. */
export function factsLine(f: FactsCount): string {
  return `${WORDS[f.known] ?? f.known} of eight known.`;
}

/**
 * The one nudge the page makes, and it reads like progress, not refusal.
 * Shown while any of the facts drafting leans on is still blank.
 */
export function draftingNote(f: FactsCount): string | null {
  const leansOn = ['Positioning', 'Audience', 'Voice', 'Platforms'];
  return f.missing.some(name => leansOn.includes(name))
    ? 'Drafting works best once positioning, audience and voice are in.'
    : null;
}
