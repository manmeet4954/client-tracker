import type { AppState, Client, ClientData, ListRow, ProfileBinding, TrackList } from '@/types';
import type { ProfileBody } from '@/lib/tree/body';
// Relative, extensioned imports: these modules also run under plain Node in the
// acceptance tests (tests/run.ts), where the `@/` alias does not exist.
import { LIFECYCLE_POLICY } from './tree/objects.ts';
import { clientMayWrite, clientMayRead } from './tree/validate.ts';
import { deriveLegacyBindings } from './tree/legacyBindings.ts';

export type Role = 'owner' | 'intern' | 'sonia' | 'shiva' | 'merushri';

/** Roles that belong to a client brand (they see only their own workspace,
 *  with a reduced tab set). */
export const CLIENT_ROLES: Role[] = ['shiva', 'merushri'];

const EMPTY_BRAIN = { nodes: [], edges: [] };
const EMPTY_MAP = { nodes: [] };

// ── Profile bindings (spec 21 §6) ────────────────────────────────────────────
// Access binds by profile ID. The client-NAME regexes are gone: they lived in
// this file and could silently open or cut off a login on a rename. A binding is
// a (person, profile) pair; a person holding several gets a picker limited to
// THEIR profiles (PLAN §11, ruling on Q3).

export function bindingsForRole(state: AppState, role: Role): ProfileBinding[] {
  if (role === 'owner') return [];
  return (state.bindings ?? []).filter(b => b.role === role);
}

/** Does this profile's lifecycle still let a client login in at all (S22)? */
function lifecycleGrantsClientAccess(client: Client | undefined): boolean {
  if (!client) return false;
  return LIFECYCLE_POLICY[client.lifecycle ?? 'active'].client_access;
}

export function allowedClientIds(state: AppState, role: Role): string[] {
  if (role === 'owner') return (state.clients ?? []).map(c => c.id);
  const byId = new Map((state.clients ?? []).map(c => [c.id, c]));
  return bindingsForRole(state, role)
    .filter(b => {
      const client = byId.get(b.profileId);
      if (!client) return false;
      // Staff (the intern) work inside her side; client logins additionally
      // depend on the profile's lifecycle.
      return b.kind === 'staff' ? true : lifecycleGrantsClientAccess(client);
    })
    .map(b => b.profileId);
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
  return { clients: [], clientData: {}, personalTasks: [], brainDump: { ...EMPTY_BRAIN }, containerMap: { ...EMPTY_MAP }, observations: [], chatLog: [], bindings: [] };
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
      // `body` stays optional (undefined = this profile is not migrated yet).
      // NOTE: contentCards deliberately NOT defaulted here — the client-side
      // LOAD migration keys off it being undefined.
    };
  }
  const clients = state.clients ?? [];
  return {
    clients,
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
    observations: state.observations ?? [],
    chatLog: state.chatLog ?? [],
    // First normalize after the restructure: write down the access the name
    // rules were already granting, then never consult a name again (§6).
    bindings: state.bindings ?? deriveLegacyBindings(clients),
  };
}

// ── Body filtering (the tree's audience rules, enforced server side) ─────────
// CLAUDE.md rule 2: filtering lives here and only gets stronger. A migrated
// profile's body is path-addressed, so "what may this login see" is answered by
// the declarations themselves rather than by a hand-kept tab list.

function filterBodyForNonOwner(body: ProfileBody | undefined): ProfileBody | undefined {
  if (!body) return undefined;
  const paths: ProfileBody['paths'] = {};
  for (const p of Object.keys(body.paths)) {
    if (clientMayRead(p)) paths[p] = body.paths[p];
  }
  return { ...body, paths, sort_queue: [] }; // her sort queue is never client-facing
}

/** Only the four give-points may come back from any non-owner login (S19). */
function mergeBodyFromNonOwner(current: ProfileBody | undefined, incoming: ProfileBody | undefined): ProfileBody | undefined {
  if (!current) return current;           // nothing to merge into yet
  if (!incoming) return current;
  const paths = { ...current.paths };
  for (const p of Object.keys(incoming.paths)) {
    if (clientMayWrite(p)) paths[p] = incoming.paths[p];
  }
  return { ...current, paths };
}

/**
 * Shape the state a role is allowed to RECEIVE. Owners get everything;
 * restricted roles get only their bound profiles + data, never personal tasks,
 * brain dump, observations or the chat thread.
 */
export function filterStateForRole(state: AppState, role: Role): AppState {
  const norm = normalizeState(state);
  if (role === 'owner') return norm;
  const ids = new Set(allowedClientIds(norm, role));
  const clients = norm.clients.filter(c => ids.has(c.id));
  const clientData: Record<string, ClientData> = {};
  ids.forEach(id => {
    const data = norm.clientData[id];
    if (!data) return;
    // EVERY non-owner login, staff included: the body is filtered by the
    // declarations. Her per-profile notes live inside it now, and `audience:
    // owner` has to mean the same thing for the intern as for a client.
    clientData[id] = { ...data, body: filterBodyForNonOwner(data.body) };
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
  return {
    clients,
    clientData,
    personalTasks: [],
    brainDump: { ...EMPTY_BRAIN },
    containerMap: { ...EMPTY_MAP },
    observations: [],
    chatLog: [],
    // Their own bindings only — never anyone else's (PLAN §11, Q3).
    bindings: bindingsForRole(norm, role),
  };
}

/**
 * Merge a restricted role's submitted state back into the authoritative full
 * state. Changes are allowed ONLY to that role's bound profiles' data; the
 * profile list, bindings, other profiles, personal tasks, observations, the
 * chat thread and the brain dump always come from `current`, so a forged
 * payload can never reach anything else.
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
      // The body is path-addressed: a non-owner login may return the four
      // give-points and nothing else (S19). It never received the rest, so it
      // has nothing else to send back.
      body: mergeBodyFromNonOwner(cur.clientData[id]?.body, inc.body),
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
    observations: cur.observations,
    chatLog: cur.chatLog,
    bindings: cur.bindings,
  };
}
