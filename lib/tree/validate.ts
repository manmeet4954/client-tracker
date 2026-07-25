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

export interface Violation {
  check: 'no-address' | 'no-switch' | 'no-fifth-door' | 'registry' | 'orphan';
  where: string;
  reason: string;
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
