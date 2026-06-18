import { AppState, ClientData } from '@/types';

export type Role = 'owner' | 'intern' | 'sonia';

const EMPTY_BRAIN = { nodes: [], edges: [] };

// Which clients each restricted role may access — matched by NAME so it's
// robust to generated client ids.
const RESTRICTED_MATCHERS: Record<Exclude<Role, 'owner'>, (name: string) => boolean> = {
  intern: (n) => /divine/i.test(n) || /resume/i.test(n),
  sonia: (n) => /sonia/i.test(n) || /crochet/i.test(n),
};

export function clientAllowedForRole(role: Role, name: string): boolean {
  if (role === 'owner') return true;
  return RESTRICTED_MATCHERS[role](name);
}

export function allowedClientIds(state: AppState, role: Role): string[] {
  return (state.clients ?? [])
    .filter(c => clientAllowedForRole(role, c.name))
    .map(c => c.id);
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
 * Shape the state a role is allowed to RECEIVE. Owners get everything;
 * restricted roles get only their clients + data, never personal tasks or
 * brain dump.
 */
export function filterStateForRole(state: AppState, role: Role): AppState {
  const norm = normalizeState(state);
  if (role === 'owner') return norm;
  const ids = new Set(allowedClientIds(norm, role));
  const clients = norm.clients.filter(c => ids.has(c.id));
  const clientData: Record<string, ClientData> = {};
  ids.forEach(id => {
    if (norm.clientData[id]) clientData[id] = norm.clientData[id];
  });
  return { clients, clientData, personalTasks: [], brainDump: { ...EMPTY_BRAIN } };
}

/**
 * Merge a restricted role's submitted state back into the authoritative full
 * state. Changes are allowed ONLY to that role's clients' data; the client
 * list, other clients, personal tasks and brain dump always come from
 * `current`, so a forged payload can never reach anything else.
 */
export function mergeRoleWrite(current: AppState, incoming: AppState, role: Role): AppState {
  const cur = normalizeState(current);
  if (role === 'owner') return normalizeState(incoming);
  const ids = new Set(allowedClientIds(cur, role)); // allowed set from the AUTHORITATIVE state
  const clientData = { ...cur.clientData };
  const incomingData = incoming?.clientData ?? {};
  ids.forEach(id => {
    if (incomingData[id]) clientData[id] = incomingData[id];
  });
  return {
    clients: cur.clients,
    clientData,
    personalTasks: cur.personalTasks,
    brainDump: cur.brainDump,
  };
}
