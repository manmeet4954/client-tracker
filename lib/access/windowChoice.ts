// What the client can see, as a choice she makes — 2026-08-11.
//
// HER BRIEF: "instead of asking me to do it the same way we built Divine's
// prototype, build a settings feature in my dashboard where I can select what
// exactly the client can view while adding the profile, and what not."
//
// The app already decides this, correctly, in lib/access.ts §7.3: a client sees
// one of five windows, and each window renders only when certain SWITCHES are
// on. What was missing is not the mechanism, it is the choice: she had to know
// that `analysis.digest_client` plus `analysis.client_publication` is what puts
// Results in front of a client, and set both by hand, per profile, on a screen
// of forty switches.
//
// So this file is the translation layer and nothing more. Five windows in her
// words, the switches each one needs, and what a tick does. The access rules
// themselves are untouched: `windowsForBinding` remains the only authority on
// what a client actually reaches, and this can never grant anything that
// function would refuse. It just sets the switches she would have set.
//
// Pure. `now` is injected, no clock, no React.

import type { PathState } from '../tree/contract.ts';
import { resolveSwitch } from '../tree/switches.ts';

// 2026-08-16, her verdict: the client sees HER dashboard, filtered — the same
// folders and the same names, cut down to what she ticked. So the rows below
// are her folders: Brand, Intake, Creation, Analysis. Assets stopped being a
// window and became a part of Creation, which is where she keeps it.
export type WindowKey = 'brand' | 'intake' | 'creation' | 'analysis';

/**
 * A window with more than one thing in it splits into PARTS (2026-08-11).
 * Her note: "in content there are multiple things, can we make the settings
 * better to make sure I can choose what to show and what to hide." A part is
 * one switch with her words on it; the window is on when ANY part is on,
 * which is exactly how `windowsForBinding` grants the window itself.
 */
export interface WindowPart {
  key: string;
  label: string;
  line: string;
  switch: string;
}

export interface WindowChoice {
  key: WindowKey;
  /** Her words for it, not the route's. */
  label: string;
  /** What the client would actually see, said in one line. */
  line: string;
  /** Present only where the window holds separately switchable things. */
  parts?: WindowPart[];
  /** True where the SERVER grants on any switch rather than all: the toggle
   *  must read the same way or OFF can lie. */
  anyOf?: boolean;
  /**
   * Switches that must be ON for this window to render for them. Turning the
   * window on turns all of these on; turning it off turns them all off.
   *
   * These mirror `WINDOWS` in lib/access.ts. The test pins them to that table,
   * so a window that gains a switch there can never quietly stop working here.
   */
  switches: string[];
}

export const WINDOW_CHOICES: WindowChoice[] = [
  {
    // 2026-08-16: this hung on `strategy.fixed`, a FIXED switch the write door
    // now refuses — the toggle wrote a forbidden position, and OFF would have
    // cascaded into her own board. `strategy.client_brand` is the window's own
    // movable switch, default active, so the toggle finally does what it says.
    key: 'brand', label: 'Brand',
    line: 'The positioning, audience and voice you locked. Read only.',
    switches: ['strategy.client_brand'],
  },
  {
    // BOTH switches, and anyOf, because that is exactly how the server grants
    // this window (2026-08-11: her toggle was OFF and the Intake tab showed
    // anyway - the toggle moved one switch while windowsForBinding granted on
    // either of two).
    key: 'intake', label: 'Intake',
    line: 'The questions you sent them, answered in their own dashboard.',
    switches: ['intake.questionnaire', 'intake.finding_session'],
    anyOf: true,
  },
  {
    // Her folder, with her tabs as its parts (2026-08-16). Every part rides
    // the switch it always rode; nothing new is granted, only regrouped.
    key: 'creation', label: 'Creation',
    line: 'The real board and its tabs, read only, exactly as you see it.',
    switches: ['creation.review', 'creation.scheduling', 'assets.client_upload', 'references.from_client'],
    parts: [
      {
        key: 'board', label: 'Board', switch: 'creation.scheduling',
        line: 'The board as it stands, from review to posted.',
      },
      {
        key: 'approvals', label: 'Approvals', switch: 'creation.review',
        line: 'They can approve a piece or ask for a revision, on the piece itself.',
      },
      {
        key: 'assets', label: 'Assets', switch: 'assets.client_upload',
        line: 'They can upload photos and video for you to use.',
      },
      {
        key: 'references', label: 'References', switch: 'references.from_client',
        line: 'The references kept for this brand, and theirs to add to.',
      },
    ],
  },
  {
    key: 'analysis', label: 'Analysis',
    line: 'The performance summary, but only the ones you have approved to send.',
    switches: ['analysis.digest_client', 'analysis.client_publication'],
  },
];

/** The presets, so the common cases are one tap rather than five decisions.
 *  `partsOn` narrows a window to some of its parts: the window is on, the
 *  unnamed parts are off. Absent means the whole window. */
export const ACCESS_PRESETS: {
  id: string; label: string; line: string; windows: WindowKey[];
  partsOn?: Partial<Record<WindowKey, string[]>>;
}[] = [
  {
    id: 'closed', label: 'Nothing yet', windows: [],
    line: 'They cannot open anything. Use this while you are still setting them up.',
  },
  {
    id: 'approvals', label: 'Approvals only', windows: ['creation'],
    partsOn: { creation: ['board', 'approvals'] },
    line: 'They see the board and approve posts. Nothing else.',
  },
  {
    id: 'onboarding', label: 'Onboarding', windows: ['intake', 'creation'],
    partsOn: { creation: ['assets'] },
    line: 'They answer your questions and send you material. No board yet.',
  },
  {
    id: 'full', label: 'Everything', windows: ['brand', 'intake', 'creation', 'analysis'],
    line: 'The full client view, analysis included.',
  },
];

export function findWindow(key: WindowKey): WindowChoice {
  const found = WINDOW_CHOICES.find(w => w.key === key);
  if (!found) throw new Error(`[access] no window ${key}`);
  return found;
}

/**
 * Position-or-default, per switch — 2026-08-16.
 *
 * `windowsOn` used to read her EXPLICIT positions only, so on a never-touched
 * profile a default-active window (Brand, Intake, Content, Assets) rendered
 * for the client while its toggle read OFF — the exact "Settings say one
 * thing, the client sees another" this screen exists to prevent. A switch
 * with no position reads as its suggested default, the same first step
 * `effectiveState` takes. The requires-cascade is deliberately NOT folded in:
 * for a bound client the login is derived from the binding (same date), so
 * position-or-default and cascade truth agree across all five windows — and
 * for a profile with nobody bound, the screen already says so in words.
 * The one copy of this reading; the parts row in ClientAccess uses it too.
 */
export function readPosition(positions: Record<string, PathState | undefined>, id: string): PathState {
  return positions[id] ?? resolveSwitch(id)?.suggested_default ?? 'hidden';
}

/**
 * Which windows are on, read from switch positions.
 *
 * A window counts as on only when EVERY switch it needs is active, because that
 * is the condition `windowsForBinding` applies. Reading it any other way would
 * show her a tick for a window the client cannot actually open, which is the
 * one failure this screen exists to prevent.
 */
export function windowsOn(positions: Record<string, PathState | undefined>): WindowKey[] {
  return WINDOW_CHOICES
    .filter(w => w.parts
      // A window with parts is on when ANY part is, mirroring the server's
      // `.some` over clientSwitches. Requiring every part would show her an
      // off-toggle for a window the client can open, the exact lie this
      // screen exists to prevent. `anyOf` is the same truth for windows whose
      // switches are not worth separate toggles.
      ? w.parts.some(part => readPosition(positions, part.switch) === 'active')
      : w.anyOf
        ? w.switches.some(s => readPosition(positions, s) === 'active')
        : w.switches.every(s => readPosition(positions, s) === 'active'))
    .map(w => w.key);
}

/** One part's move: its own switch and nothing else. */
export function movePart(key: WindowKey, partKey: string, on: boolean): { id: string; state: PathState }[] {
  const part = findWindow(key).parts?.find(p => p.key === partKey);
  if (!part) throw new Error(`[access] no part ${partKey} on ${key}`);
  return [{ id: part.switch, state: on ? 'active' : 'hidden' }];
}

/**
 * The switch moves one tick implies. Returned as a list rather than applied so
 * the caller writes them through the ordinary door, and so this stays testable
 * without a body.
 */
export function moveFor(key: WindowKey, on: boolean): { id: string; state: PathState }[] {
  return findWindow(key).switches.map(id => ({ id, state: on ? 'active' : 'hidden' }));
}

/** Every move a preset implies: the named windows on, all the others off.
 *  `partsOn` (2026-08-16) narrows a named window to some of its parts, so a
 *  preset like Onboarding can open Creation's Assets tab without the board. */
export function movesForPreset(
  windows: WindowKey[], partsOn?: Partial<Record<WindowKey, string[]>>,
): { id: string; state: PathState }[] {
  const wanted = new Set(windows);
  const out: { id: string; state: PathState }[] = [];
  const seen = new Set<string>();
  for (const w of WINDOW_CHOICES) {
    const narrow = wanted.has(w.key) ? partsOn?.[w.key] : undefined;
    if (narrow && w.parts) {
      for (const p of w.parts) {
        const [move] = movePart(w.key, p.key, narrow.includes(p.key));
        if (seen.has(move.id) && move.state !== 'active') continue;
        if (move.state === 'active') seen.add(move.id);
        out.push(move);
      }
      continue;
    }
    for (const move of moveFor(w.key, wanted.has(w.key))) {
      // A switch shared by two windows must not be turned off by the second
      // after the first turned it on. On wins, always: the safe direction here
      // is the one that matches what she ticked.
      if (seen.has(move.id) && move.state !== 'active') continue;
      if (move.state === 'active') seen.add(move.id);
      out.push(move);
    }
  }
  return dedupe(out);
}

function dedupe(moves: { id: string; state: PathState }[]): { id: string; state: PathState }[] {
  const byId = new Map<string, PathState>();
  for (const m of moves) {
    // Later "active" beats an earlier "hidden"; an earlier "active" is kept.
    if (byId.get(m.id) === 'active') continue;
    byId.set(m.id, m.state);
  }
  return [...byId].map(([id, state]) => ({ id, state }));
}

/*
 * `blockedReason` LIVED HERE and is gone (2026-08-11). It said a ticked Brand
 * window would not render until strategy locked, and her order removed the
 * rule itself: "get rid of this rule that they can't use or see anything
 * without a set strategy for clients." No rule, no caveat.
 */

/** The one line at the top: what this client can open right now. */
export function accessLine(on: WindowKey[]): string {
  if (on.length === 0) return 'This client cannot open anything yet.';
  const labels = on.map(k => findWindow(k).label.toLowerCase());
  if (labels.length === 1) return `They can open ${labels[0]}.`;
  return `They can open ${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}.`;
}
