import { AppState, ClientData, ListRow, TrackList } from '@/types';

export type Role = 'owner' | 'intern' | 'sonia' | 'shiva' | 'merushri';

/** Roles that belong to a client brand (they see only their own workspace,
 *  with a reduced tab set). */
export const CLIENT_ROLES: Role[] = ['shiva', 'merushri'];

const EMPTY_BRAIN = { nodes: [], edges: [] };
const EMPTY_MAP = { nodes: [] };

// Which clients each restricted role may access — matched by NAME so it's
// robust to generated client ids.
const RESTRICTED_MATCHERS: Record<Exclude<Role, 'owner'>, (name: string) => boolean> = {
  intern: (n) => /divine/i.test(n) || /resume/i.test(n),
  sonia: (n) => /sonia/i.test(n) || /crochet/i.test(n),
  shiva: (n) => /shiva/i.test(n),
  merushri: (n) => /career|bubble/i.test(n),
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

/** Shared lists (spec 12): `sharedFrom` marks an injected window onto another
 *  client's list. Windows exist only in role-filtered payloads — never in the
 *  stored blob. This strips any stray window (and its rows) before storage. */
function stripInjectedLists(lists: TrackList[], listRows: ListRow[]): { lists: TrackList[]; listRows: ListRow[] } {
  if (!lists.some(l => l.sharedFrom)) return { lists, listRows };
  const injected = new Set(lists.filter(l => l.sharedFrom).map(l => l.id));
  return {
    lists: lists.filter(l => !l.sharedFrom),
    listRows: listRows.filter(r => !injected.has(r.listId)),
  };
}

/** An empty, valid AppState (used when there is no saved row yet). */
export function emptyState(): AppState {
  return { clients: [], clientData: {}, personalTasks: [], brainDump: { ...EMPTY_BRAIN }, containerMap: { ...EMPTY_MAP } };
}

/** Normalize older saved states so every top-level field exists. */
export function normalizeState(state: AppState): AppState {
  const rawData = state.clientData ?? {};
  const clientData: typeof rawData = {};
  for (const id of Object.keys(rawData)) {
    const { orders, catalogueCategories, catalogueItems, pillars, pillarCards, leadAnswers, lists, listRows, topics, ...rest } = rawData[id];
    clientData[id] = {
      ...rest,
      orders: orders ?? [],
      catalogueCategories: catalogueCategories ?? [],
      catalogueItems: catalogueItems ?? [],
      pillars: pillars ?? [],
      pillarCards: pillarCards ?? [],
      leadAnswers: leadAnswers ?? [],
      ...stripInjectedLists(lists ?? [], listRows ?? []),
      topics: topics ?? [],
      // `goals` stays optional (undefined = not chosen yet) — no default.
      // NOTE: contentCards deliberately NOT defaulted here — the client-side
      // LOAD migration keys off it being undefined.
    };
  }
  return {
    clients: state.clients ?? [],
    clientData,
    // Migrate older tasks to the typed model. Existing tasks become plain
    // personal tasks that keep their client tag for display (via clientIds);
    // they never retroactively spawn cards or agenda items. Idempotent: a task
    // already carrying taskType / clientIds is left untouched.
    personalTasks: (state.personalTasks ?? []).map(t => ({
      ...t,
      taskType: t.taskType ?? 'personal',
      clientIds: t.clientIds ?? (t.clientId ? [t.clientId] : []),
    })),
    brainDump: state.brainDump ?? { ...EMPTY_BRAIN },
    containerMap: state.containerMap ?? { ...EMPTY_MAP },
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
  // Shared lists (spec 12): inject a window onto any other client's list that
  // is shared with one of this role's clients. The window carries `sharedFrom`
  // so the UI can badge it and mergeRoleWrite can route row edits back. Only
  // the shared list and its rows cross the boundary — nothing else.
  ids.forEach(id => {
    const base = clientData[id];
    if (!base) return;
    const extraLists: TrackList[] = [];
    const extraRows: ListRow[] = [];
    for (const ownerId of Object.keys(norm.clientData)) {
      if (ownerId === id || ids.has(ownerId)) continue;
      const od = norm.clientData[ownerId];
      for (const l of od.lists ?? []) {
        if ((l.sharedWith ?? []).some(w => w.clientId === id)) {
          const ownerName = norm.clients.find(c => c.id === ownerId)?.name ?? '';
          extraLists.push({ ...l, sharedFrom: { clientId: ownerId, clientName: ownerName } });
          extraRows.push(...(od.listRows ?? []).filter(r => r.listId === l.id));
        }
      }
    }
    if (extraLists.length) {
      clientData[id] = {
        ...base,
        lists: [...(base.lists ?? []), ...extraLists],
        listRows: [...(base.listRows ?? []), ...extraRows],
      };
    }
  });
  return { clients, clientData, personalTasks: [], brainDump: { ...EMPTY_BRAIN }, containerMap: { ...EMPTY_MAP } };
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
    const inc = incomingData[id];
    if (!inc) return;
    // Shared lists (spec 12): split injected windows out of the incoming data
    // before storing this client's own slice (windows are never stored).
    const windows = (inc.lists ?? []).filter(l => l.sharedFrom);
    clientData[id] = {
      ...inc,
      ...stripInjectedLists(inc.lists ?? [], inc.listRows ?? []),
    };
    // Route each window's ROW edits back into the owning client's data — but
    // only when the AUTHORITATIVE state confirms the owner really shares that
    // list with this client. The list object itself (name, stages, sharedWith)
    // is never writable through a window, and nothing else of the owner's data
    // can be reached, so a forged payload gains nothing.
    for (const w of windows) {
      const ownerId = w.sharedFrom!.clientId;
      const ownerData = clientData[ownerId];
      if (!ownerData || ids.has(ownerId)) continue;
      const authList = (cur.clientData[ownerId]?.lists ?? []).find(l => l.id === w.id);
      if (!authList || !(authList.sharedWith ?? []).some(s => s.clientId === id)) continue;
      const newRows = (inc.listRows ?? []).filter(r => r.listId === w.id);
      clientData[ownerId] = {
        ...ownerData,
        listRows: [
          ...(ownerData.listRows ?? []).filter(r => r.listId !== w.id),
          ...newRows,
        ],
      };
    }
  });
  return {
    clients: cur.clients,
    clientData,
    personalTasks: cur.personalTasks,
    brainDump: cur.brainDump,
    containerMap: cur.containerMap,
  };
}
