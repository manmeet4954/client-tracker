// The validator — spec 21 §4.2. Three checks that REFUSE the build, not warn:
//
//   1. No address, no build (law 4)      — every read/write resolves to a declared path.
//   2. No switch, no feature (§6 rule 3) — every feature names a switch that exists.
//   3. No fifth door (S19)               — no client audience without one of the four
//                                          give-points (or the declared see-points).
//
// Plus the registry integrity the three checks stand on, and §8.11's orphan
// check: every slice of AppState and ClientData appears in the address map
// exactly once.

import type { AppState, ClientData } from '../../types/index.ts';
import type { Audience, ClientDoor, FeatureDeclaration, PathDeclaration } from './contract.ts';
import { CLIENT_GIVE_DOORS, CLIENT_SEE_DOORS } from './contract.ts';
import { DECLARATIONS, findDeclaration, isDeclared } from './declarations.ts';
import { FEATURES, declaredSlices } from './features.ts';
import { SWITCHES, findSwitch, switchExists } from './switches.ts';
import { PARAMETERS, findVocabularyList } from '../intake/parameters.ts';
import { derivationViolations } from '../strategy/derivation.ts';

export interface Violation {
  check: 'no-address' | 'no-switch' | 'no-fifth-door' | 'registry' | 'orphan' | 'intake'
    | 'narrowing';
  where: string;
  reason: string;
}

// ── spec 26 §4.1 — the narrowing rule ────────────────────────────────────────
//
// "A child path may declare an audience MORE restrictive than its parent, never
// less. Law 3 inherits connections downward; it must not force visibility
// downward." Without it the S16 measurement declarations would leak into the
// client's strategy summary, which is workshop material (CLAUDE.md rule 1).
//
// Two halves, both checked:
//  1. A PARAMETER (law 2's third level — the compartment inside the box) may
//     never be broader than the entry it lives in. A compartment more visible
//     than its box is exactly the leak this rule exists to stop.
//  2. Any child that widens its parent at all must declare its OWN client door.
//     That is what `references/from-client` (give:assets) and `logs/tasks`
//     (see:obligations) do — deliberate doors on hers-by-default folders, not
//     inherited visibility.
//
// Narrowing is always legal, which is the sentence the spec asks the validator
// to carry, and it is why `goals/*/measurement` can be owner-only inside an
// `audience: both` parent.

const AUDIENCE_BREADTH: Record<Audience, number> = { owner: 0, client: 1, both: 2 };

/** The nearest declared ancestor of a declared path, or null at the root. */
function parentDeclaration(path: string): PathDeclaration | null {
  const parts = path.split('/');
  for (let i = parts.length - 1; i > 0; i--) {
    const dec = findDeclaration(parts.slice(0, i).join('/'));
    if (dec && dec.path !== path) return dec;
  }
  return null;
}

export function narrowingViolations(): Violation[] {
  const out: Violation[] = [];
  for (const d of DECLARATIONS) {
    const parent = parentDeclaration(d.path);
    if (!parent) continue;
    const wider = AUDIENCE_BREADTH[d.audience] > AUDIENCE_BREADTH[parent.audience];
    if (!wider) continue;
    if (d.kind === 'parameter') {
      out.push({
        check: 'narrowing', where: d.path,
        reason: `a parameter may not be more visible than its entry: "${d.audience}" inside "${parent.path}" (${parent.audience}) — §4.1`,
      });
      continue;
    }
    if (!d.client_door) {
      out.push({
        check: 'narrowing', where: d.path,
        reason: `widens "${parent.path}" (${parent.audience} → ${d.audience}) without declaring its own client door — visibility is never inherited downward (§4.1)`,
      });
    }
  }
  return out;
}

/** Readers that are people or systems rather than paths. */
const NON_PATH_READERS = new Set([
  'owner', 'client', 'collaborator', 'shelf', 'access-resolver',
  'engine:content', 'engine:analysis',
]);

function readerResolves(reader: string): boolean {
  if (NON_PATH_READERS.has(reader)) return true;
  if (reader.startsWith('pipe:')) return true;
  return isDeclared(reader);
}

function writerResolves(writer: string): boolean {
  if (NON_PATH_READERS.has(writer)) return true;
  if (writer.startsWith('pipe:')) return true;
  if (writer.startsWith('path:')) return isDeclared(writer.slice(5));
  return false;
}

function doorsFor(audience: Audience): ClientDoor[] {
  return audience === 'owner' ? [] : [...CLIENT_GIVE_DOORS, ...CLIENT_SEE_DOORS];
}

// ── Check 3: the four doors ──────────────────────────────────────────────────

/**
 * S19: the client's only doors are the four give-points (and the declared
 * see-points). A client write to anything else is refused server side.
 */
export function clientMayWrite(path: string): boolean {
  const dec = findDeclaration(path);
  if (!dec) return false;
  if (dec.audience === 'owner') return false;
  if (!dec.client_door) return false;
  if (!CLIENT_GIVE_DOORS.includes(dec.client_door)) return false;
  return dec.fed_by.includes('client');
}

export function clientMayRead(path: string): boolean {
  const dec = findDeclaration(path);
  if (!dec) return false;
  return dec.audience !== 'owner' && !!dec.client_door;
}

/**
 * The same two questions, asked of a profile in a given lifecycle state
 * (spec 22 §11.1). A profile at `setup` opens `give:intake` and nothing else —
 * not assets, not review, not perception, not a single see-point.
 */
export function clientMayWriteAt(path: string, doors: ClientDoor[]): boolean {
  const dec = findDeclaration(path);
  return clientMayWrite(path) && !!dec?.client_door && doors.includes(dec.client_door);
}

export function clientMayReadAt(path: string, doors: ClientDoor[]): boolean {
  const dec = findDeclaration(path);
  return clientMayRead(path) && !!dec?.client_door && doors.includes(dec.client_door);
}

/** Every path a client may ever write, with the door it comes through. */
export function clientWritablePaths(): { path: string; door: ClientDoor }[] {
  return DECLARATIONS
    .filter(d => clientMayWrite(d.path))
    .map(d => ({ path: d.path, door: d.client_door! }));
}

// ── The orphan check (§8.11) ─────────────────────────────────────────────────
//
// These two lists are type-checked against the real models: add a slice to
// AppState or ClientData without giving it an address and TypeScript stops the
// build before the validator even runs.

const APP_STATE_SLICES: Record<keyof AppState, true> = {
  clients: true, clientData: true, personalTasks: true, brainDump: true,
  containerMap: true, observations: true, chatLog: true, bindings: true,
  tasteRules: true,
};

const CLIENT_DATA_SLICES: Record<keyof ClientData, true> = {
  cards: true, customFields: true, monthData: true, references: true, brand: true,
  brandKit: true, postTarget: true, evergreenIdeas: true, studioCompositions: true,
  coldCalls: true, onboarding: true, orders: true, catalogueCategories: true,
  catalogueItems: true, instagram: true, previewPosts: true, pillars: true,
  pillarCards: true, assetSets: true, assetItems: true, driveFolderUrl: true,
  leadAnswers: true, contentCards: true, platforms: true, lists: true, listRows: true,
  journey: true, momentum: true, topics: true, goals: true, body: true,
};

export const APP_STATE_KEYS = Object.keys(APP_STATE_SLICES) as (keyof AppState)[];
export const CLIENT_DATA_KEYS = Object.keys(CLIENT_DATA_SLICES) as (keyof ClientData)[];

function orphanViolations(): Violation[] {
  const out: Violation[] = [];
  const claimed = declaredSlices();
  const covers = (key: string) =>
    claimed.some(s => s === key || s.startsWith(key + '.'));

  for (const k of APP_STATE_KEYS) {
    if (k === 'clientData') continue; // the container itself, claimed by profile.bodies
    if (!covers(`state.${k}`)) {
      out.push({ check: 'orphan', where: `AppState.${k}`, reason: 'no address in the map (spec 21 §8)' });
    }
  }
  for (const k of CLIENT_DATA_KEYS) {
    if (!covers(`clientData.${k}`)) {
      out.push({ check: 'orphan', where: `ClientData.${k}`, reason: 'no address in the map (spec 21 §8)' });
    }
  }
  // And nothing claimed twice — one address each (§8.11).
  const seen = new Set<string>();
  for (const s of claimed) {
    if (seen.has(s)) out.push({ check: 'orphan', where: s, reason: 'claimed by two features' });
    seen.add(s);
  }
  return out;
}

// ── Intake: "intake is HOW, never WHAT" made checkable (spec 22 §2) ──────────
//
// Three build-refusing checks, straight out of the rule:
//   1. No question without a parameter, and every parameter lives in a declared
//      detail folder. If a question exists, a parameter exists.
//   2. Intake never asks a strategy question. No parameter may address
//      context/content-strategy — that folder is DERIVED, not collected.
//   3. Exactly ONE parameter curates into work-log/creation/topics: the
//      client-ideas lane (§7.5). A second one would be a fifth door.

const DETAIL_ROOTS = ['context/personal-details/', 'context/business-details/'];

export function intakeViolations(): Violation[] {
  const out: Violation[] = [];
  let clientIdeaLanes = 0;

  for (const p of PARAMETERS) {
    if (!isDeclared(p.path)) {
      out.push({ check: 'no-address', where: `parameter ${p.id}`, reason: `path "${p.path}" is not declared (law 4)` });
      continue;
    }
    if (p.path.startsWith('context/content-strategy')) {
      out.push({
        check: 'intake', where: `parameter ${p.id}`,
        reason: 'intake never asks a strategy question: content-strategy is derived, not collected (§2 rule 2)',
      });
    }
    if (p.curates_to) {
      if (p.curates_to !== 'work-log/creation/topics') {
        out.push({
          check: 'intake', where: `parameter ${p.id}`,
          reason: `curates into "${p.curates_to}", and the only non-detail target allowed is work-log/creation/topics (§7.5)`,
        });
      } else {
        clientIdeaLanes++;
      }
      if (p.path !== 'context/intake/answers') {
        out.push({
          check: 'intake', where: `parameter ${p.id}`,
          reason: 'the client-ideas lane lands at context/intake/answers, the same door as every other answer',
        });
      }
    } else if (!DETAIL_ROOTS.some(r => p.path.startsWith(r))) {
      out.push({
        check: 'intake', where: `parameter ${p.id}`,
        reason: 'a parameter lives under personal-details or business-details (§4.1)',
      });
    }
    if (p.options && !findVocabularyList(p.options)) {
      out.push({ check: 'intake', where: `parameter ${p.id}`, reason: `unknown vocabulary list "${p.options}"` });
    }
  }

  if (clientIdeaLanes !== 1) {
    out.push({
      check: 'intake', where: 'the client-ideas lane',
      reason: `exactly one parameter may curate into the seed bank, and ${clientIdeaLanes} do (§7.5, S19)`,
    });
  }

  for (const d of derivationViolations()) {
    out.push({ check: 'intake', where: d.where, reason: d.reason });
  }

  return out;
}

// ── The whole validation ─────────────────────────────────────────────────────

/** One feature, checked on its own — so the checks can be proven to bite. */
export function featureViolations(f: FeatureDeclaration): Violation[] {
  const out: Violation[] = [];
  if (!f.switch || !switchExists(f.switch)) {
    out.push({ check: 'no-switch', where: `feature ${f.id}`, reason: `switch "${f.switch}" is not registered` });
  }
  if (f.writes && !isDeclared(f.writes)) {
    out.push({ check: 'no-address', where: `feature ${f.id}`, reason: `writes undeclared path "${f.writes}"` });
  }
  if (!f.writes && !['leaves', 'frozen', 'deleted', 'active'].includes(f.state)) {
    out.push({ check: 'no-address', where: `feature ${f.id}`, reason: 'no write address and no disposition explaining why' });
  }
  for (const r of f.reads) {
    if (!isDeclared(r)) {
      out.push({ check: 'no-address', where: `feature ${f.id}`, reason: `reads undeclared path "${r}"` });
    }
  }
  return out;
}

/** One declaration, checked on its own. */
export function declarationViolations(d: PathDeclaration): Violation[] {
  const out: Violation[] = [];
  if (!switchExists(d.switch)) {
    out.push({ check: 'no-switch', where: d.path, reason: `switch "${d.switch}" is not registered` });
  }
  for (const w of d.fed_by) {
    if (!writerResolves(w)) {
      out.push({ check: 'no-address', where: d.path, reason: `fed_by "${w}" does not resolve` });
    }
  }
  for (const r of d.read_by) {
    if (!readerResolves(r)) {
      out.push({ check: 'no-address', where: d.path, reason: `read_by "${r}" does not resolve` });
    }
  }
  if (d.audience !== 'owner') {
    if (!d.client_door) {
      out.push({ check: 'no-fifth-door', where: d.path, reason: 'client audience with no declared door (S19)' });
    } else if (!doorsFor(d.audience).includes(d.client_door)) {
      out.push({ check: 'no-fifth-door', where: d.path, reason: `"${d.client_door}" is not one of the four give-points or the declared see-points` });
    } else if (CLIENT_SEE_DOORS.includes(d.client_door) && d.fed_by.includes('client')) {
      out.push({ check: 'no-fifth-door', where: d.path, reason: `a see-point may not be fed by the client ("${d.client_door}")` });
    }
  } else if (d.client_door) {
    out.push({ check: 'no-fifth-door', where: d.path, reason: 'owner-only path carries a client door' });
  } else if (d.fed_by.includes('client')) {
    out.push({ check: 'no-fifth-door', where: d.path, reason: 'owner-only path declares the client as a writer' });
  }
  if (d.zone === 'tree' && !/^(context|work-log)(\/|$)/.test(d.path)) {
    out.push({ check: 'registry', where: d.path, reason: 'tree paths live under context/ or work-log/ (law 1)' });
  }
  if (d.states.length === 0) {
    out.push({ check: 'registry', where: d.path, reason: 'no allowed states declared (S9)' });
  }
  return out;
}

export function validateRegistries(): Violation[] {
  const out: Violation[] = [];

  for (const d of DECLARATIONS) out.push(...declarationViolations(d));

  for (const s of SWITCHES) {
    for (const p of s.owns) {
      if (!isDeclared(p)) {
        out.push({ check: 'no-address', where: `switch ${s.id}`, reason: `owns undeclared path "${p}"` });
      }
    }
    for (const r of s.requires) {
      if (!switchExists(r)) {
        out.push({ check: 'no-switch', where: `switch ${s.id}`, reason: `requires unknown switch "${r}"` });
      }
    }
    for (const dep of s.dependents) {
      if (!switchExists(dep)) {
        out.push({ check: 'no-switch', where: `switch ${s.id}`, reason: `dependent "${dep}" is not registered` });
      }
    }
    if (s.suggested_default && !s.allowed_states.includes(s.suggested_default)) {
      out.push({ check: 'registry', where: `switch ${s.id}`, reason: 'suggested default is not an allowed state' });
    }
  }

  for (const f of FEATURES) out.push(...featureViolations(f));

  out.push(...orphanViolations());
  out.push(...intakeViolations());
  out.push(...narrowingViolations());   // spec 26 §4.1
  return out;
}

/** CI entry point: the build refuses to proceed on any violation. */
export function assertRegistriesValid(): void {
  const v = validateRegistries();
  if (v.length) {
    const lines = v.map(x => `  [${x.check}] ${x.where}: ${x.reason}`).join('\n');
    throw new Error(`[tree] ${v.length} declaration violation(s):\n${lines}`);
  }
}

/** Law 4 at the edges: used by the write door and by any code addressing data. */
export function assertPathWritable(path: string, writer: 'owner' | 'client'): PathDeclaration {
  const dec = findDeclaration(path);
  if (!dec) throw new Error(`[tree] no address, no write: "${path}" is not declared (law 4)`);
  if (writer === 'client' && !clientMayWrite(path)) {
    throw new Error(`[tree] no fifth door: a client may not write "${path}" (S19)`);
  }
  if (writer === 'owner' && !dec.fed_by.includes('owner') && !dec.fed_by.some(w => w.startsWith('path:') || w.startsWith('pipe:') || w.startsWith('engine:'))) {
    throw new Error(`[tree] "${path}" declares no owner writer`);
  }
  return dec;
}

export { findSwitch };
