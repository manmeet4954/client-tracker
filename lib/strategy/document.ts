// The brand, as one document — 2026-08-11.
//
// HER BRIEF: "the work I want Strategy to do is basically: answer what the
// brand is all about, what we have decided for the brand, how the brand will
// proceed, what it uses as USPs, what the client profiles are, everything like
// visual and content strategy, what the audience will be, what the deliverables
// will be, what the pillars will be... it should be presented simply rather
// than with so many things."
//
// THE FINDING THAT SHAPED THIS FILE: twelve of the fourteen decisions the app
// already stores ARE her list. Positioning, Audience, Pillars, Voice,
// Platforms, Visual branding, Cadence, Funnel shape, CTAs, Boundaries, Working
// mode and Obligations answer everything she named except two. So Strategy did
// not need building. It needed GROUPING, and its three overlapping tabs (Facts,
// Decide, Brand book) needed to stop being three.
//
// This file is that grouping, and nothing else. It stores no data, decides no
// values, and adds no rules: STRATEGY_INPUTS remains the single list of what a
// brand decides, `readStrategy` remains how a decision is read, and a section
// here is a heading over rows that already existed.
//
// THE TWO GENUINELY MISSING, added as declared rows rather than smuggled into
// an existing one:
//   - USPs. She named them; nothing in the app held them. Proof library is the
//     nearest thing and it is evidence, not a claim of difference.
//   - Demographics. "What are the demographics of this particular client" —
//     age, place, income. Audience holds who they are; not their numbers.
//
// Pure: no clock, no React, no state.

import { STRATEGY_INPUTS, type InputSpec } from './inputs.ts';

export interface DocumentSection {
  id: string;
  /** The heading she reads. */
  title: string;
  /** One line saying what this section answers, in her words from the brief. */
  answers: string;
  /** Strategy paths, in reading order. */
  paths: string[];
}

const CS = 'context/content-strategy';

/**
 * The five sections, in the order a person reads a brand document: who it is,
 * who it speaks to, what it says, how it looks, how the work runs.
 *
 * Every path in here must exist in STRATEGY_INPUTS, and every input must appear
 * in exactly one section. A test pins both directions, so a decision can never
 * be added to the app and quietly fail to appear on the page that is supposed
 * to be the whole brand.
 */
export const DOCUMENT_SECTIONS: DocumentSection[] = [
  {
    id: 'brand', title: 'The brand',
    answers: 'What this brand is all about, and what makes it different.',
    paths: [`${CS}/positioning`, `${CS}/usps`, `${CS}/proof-library`],
  },
  {
    id: 'audience', title: 'Who it is for',
    answers: 'The people it speaks to, and who it is not for.',
    paths: [`${CS}/audience-decided`, `${CS}/demographics`, `${CS}/boundaries`],
  },
  {
    id: 'content', title: 'What it says',
    answers: 'The pillars, the voice, where it posts and what it asks people to do.',
    paths: [`${CS}/pillars`, `${CS}/voice`, `${CS}/platforms`, `${CS}/ctas`],
  },
  {
    id: 'visual', title: 'How it looks',
    answers: 'The visual direction. Colours, type and files live in the brand book.',
    paths: [`${CS}/visual-branding`],
  },
  {
    id: 'working', title: 'How the work runs',
    answers: 'How it will proceed: the goals, the shape of the funnel, how often, who does what, and what you owe them.',
    paths: [`${CS}/goals`, `${CS}/funnel-shape`, `${CS}/cadence`, `${CS}/working-mode`, `${CS}/obligations`],
  },
];

/**
 * The two rows her brief named that the app never held.
 *
 * They are declared here beside the sections rather than pushed into
 * STRATEGY_INPUTS, because that list is spec 22's derivation surface: adding to
 * it changes what the lock demands and what the engine reads. These are hers to
 * write and read, they gate nothing, and the lock does not wait on them.
 */
export const ADDED_INPUTS: InputSpec[] = [
  {
    path: `${CS}/usps`, label: 'USPs', kind: 'chips', reasonRequired: false,
    help: 'What this brand has that the others do not. One per line.',
  },
  {
    path: `${CS}/demographics`, label: 'Demographics', kind: 'prose', reasonRequired: false,
    help: 'Age, where they live, what they earn, anything else that is a number rather than a feeling.',
  },
];

/** Every input the document can render: the fourteen, plus the two. */
export function documentInputs(): InputSpec[] {
  return [...STRATEGY_INPUTS, ...ADDED_INPUTS];
}

export function findInput(path: string): InputSpec | undefined {
  return documentInputs().find(i => i.path === path);
}

/** The specs of one section, in the section's own order, skipping unknowns. */
export function sectionInputs(section: DocumentSection): InputSpec[] {
  return section.paths.map(findInput).filter((i): i is InputSpec => !!i);
}

/**
 * The line at the top. It counts only what the LOCK actually waits on, which is
 * the fourteen: counting the two added rows would tell her the brand is
 * incomplete over two fields that stop nothing.
 */
export function documentLine(decidedPaths: string[]): string {
  const need = STRATEGY_INPUTS.length;
  const done = STRATEGY_INPUTS.filter(i => decidedPaths.includes(i.path)).length;
  if (done === 0) return `Nothing decided yet. ${need} to go.`;
  if (done === need) return 'The brand is decided.';
  return `${done} of ${need} decided.`;
}

/** What a section still needs, for the quiet line under its heading. */
export function sectionGap(section: DocumentSection, decidedPaths: string[]): string | null {
  const undecided = sectionInputs(section)
    .filter(i => !decidedPaths.includes(i.path))
    .map(i => i.label);
  if (undecided.length === 0) return null;
  if (undecided.length === 1) return `${undecided[0]} is not decided yet.`;
  return `${undecided.slice(0, -1).join(', ')} and ${undecided[undecided.length - 1]} are not decided yet.`;
}
