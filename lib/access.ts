import { AppState, ClientData } from '@/types';

export type Role = 'owner' | 'intern';

const EMPTY_BRAIN = { nodes: [], edges: [] };

/** Which clients an intern may access — matched by NAME (robust to generated ids). */
export function isInternClient(name: string): boolean {
  return /divine/i.test(name) || /resume/i.test(name);
}

export function allowedClientIds(state: AppState): string[] {
  return (state.clients ?? []).filter(c => isInternClient(c.name)).map(c => c.id);
}

/** An empty, valid AppState (used when there is no saved row yet). */
export function emptyState(): AppState {
  return { clients: [], clientData: {}, personalTasks: [], brainDump: { ...EMPTY_BRAIN } };
}

/** Normalize older saved states so every top-level field exists. */
export function normalizeState(state: AppState): AppState {
  return {
    clients: state.clients ?? [],
    clientData: state.clientData ?? {},
    personalTasks: state.personalTasks ?? [],
    brainDump: state.brainDump ?? { ...EMPTY_BRAIN },
  };
}

/**
 * Shape the state an intern is allowed to RECEIVE.
 * Only the allowed clients + their data; never personal tasks or brain dump.
 */
export function filterStateForIntern(state: AppState): AppState {
  const norm = normalizeState(state);
  const ids = new Set(allowedClientIds(norm));
  const clients = norm.clients.filter(c => ids.has(c.id));
  const clientData: Record<string, ClientData> = {};
  ids.forEach(id => {
    if (norm.clientData[id]) clientData[id] = norm.clientData[id];
  });
  return { clients, clientData, personalTasks: [], brainDump: { ...EMPTY_BRAIN } };
}

/**
 * Merge an intern's submitted state back into the authoritative full state.
 * Changes are allowed ONLY to allowed clients' clientData. The client list,
 * other clients, personal tasks and brain dump are always taken from `current`,
 * so a forged payload can never touch anything the intern shouldn't reach.
 */
export function mergeInternWrite(current: AppState, incoming: AppState): AppState {
  const cur = normalizeState(current);
  const ids = new Set(allowedClientIds(cur)); // allowed set from the AUTHORITATIVE state
  const clientData = { ...cur.clientData };
  const incomingData = incoming?.clientData ?? {};
  ids.forEach(id => {
    if (incomingData[id]) clientData[id] = incomingData[id];
  });
  return {
    clients: cur.clients,          // intern cannot add/remove/rename clients
    clientData,                    // only allowed ids updated
    personalTasks: cur.personalTasks,
    brainDump: cur.brainDump,
  };
}
