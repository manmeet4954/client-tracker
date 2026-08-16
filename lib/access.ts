import type { AppState, Client, ClientData, ListRow, ProfileBinding, TrackList } from '@/types';
import type { ProfileBody } from '@/lib/tree/body';
// Relative, extensioned imports: these modules also run under plain Node in the
// acceptance tests (tests/run.ts), where the `@/` alias does not exist.
import type { ClientDoor } from './tree/contract.ts';
import type { Lifecycle } from './tree/objects.ts';
import { LIFECYCLE_POLICY, doorsOpenAt } from './tree/objects.ts';
import { pathState } from './tree/switches.ts';
import { renderState } from './tree/render.ts';
import { switchConfigFromBody, withDerivedLogin } from './strategy/derivation.ts';
import { isCutOver, renderProfile, staysOnLegacy } from './shell/profile.ts';
import { clientMayWrite, clientMayRead, clientMayWriteAt, clientMayReadAt } from './tree/validate.ts';
import { findDeclaration } from './tree/declarations.ts';
import { deriveLegacyBindings } from './tree/legacyBindings.ts';

/**
 * The five fixed logins, plus any number of INVITED ones.
 *
 * 2026-08-11: `guest:<invite id>` was added because the five were written into
 * the code and could only grow by a deploy. Her words: "I cannot register
 * everyone's password every time." A guest role behaves like any other
 * restricted role everywhere below; it is only its ORIGIN that differs, being
 * a row she made rather than an environment variable.
 */
export type Role = 'owner' | 'intern' | 'sonia' | 'shiva' | 'merushri' | `guest:${string}`;

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

/** Staff or client, for one (person, profile) pair. Staff work inside her side;
 *  a client login is scoped by the doors its lifecycle opens (spec 22 §11.1). */
function bindingKind(state: AppState, role: Role, profileId: string): 'client' | 'staff' {
  const b = (state.bindings ?? []).find(x => x.role === role && x.profileId === profileId);
  return b?.kind === 'staff' ? 'staff' : 'client';
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
  return { clients: [], clientData: {}, personalTasks: [], brainDump: { ...EMPTY_BRAIN }, containerMap: { ...EMPTY_MAP }, observations: [], chatLog: [], bindings: [], tasteRules: [] };
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
    // 2026-08-11, and this line is a bug fix with a bruise behind it. This
    // function rebuilds the state BY ENUMERATION, so a slice missing from the
    // list is silently stripped on every save. `invites` was missing: she made
    // an invite, sent the code, and the client's sign-in said "incorrect"
    // because the server never held the invite at all. The compile-time
    // completeness check on the scope maps did not cover this hand-built
    // object; a test now pins it instead.
    invites: state.invites ?? [],
    // Spec 25 §9.2: the owner-zone taste store. Empty until she accepts a rule.
    tasteRules: state.tasteRules ?? [],
  };
}

// ── Body filtering (the tree's audience rules, enforced server side) ─────────
// CLAUDE.md rule 2: filtering lives here and only gets stronger. A migrated
// profile's body is path-addressed, so "what may this login see" is answered by
// the declarations themselves rather than by a hand-kept tab list.

const STRATEGY_PREFIX = 'context/content-strategy';

/**
 * The client sees the LOCKED version only (spec 22 §8.8, §10). Working edits
 * toward the next version are invisible until she locks them — that is PLAN
 * §4's "never the raw working notes", and it needs no second artifact.
 */
function lockedOnly(entries: ProfileBody['paths'][string]): ProfileBody['paths'][string] {
  return entries.filter(e => {
    const v = (e.data as { strategy_version?: unknown } | undefined)?.strategy_version;
    return e.state === 'active' && typeof v === 'number';
  });
}

// ── Spec 24 §13.2 — the piece stage gate ─────────────────────────────────────
//
// The bug this closes: `filterBodyForNonOwner` filtered at PATH level only, so a
// path either reached a non-owner login whole or not at all. `work-log/creation`
// is `audience: 'both', client_door: 'see:upcoming'`, so EVERY piece at every
// stage would have reached a client login. Nothing created pieces at `build`
// through the tree until spec 24, which is why it had not bitten yet.
//
// The rule it generalizes: a child or an entry may be more restrictive than its
// parent, never less. Law 3 inherits connections downward; it must not force
// visibility downward. CLAUDE.md rule 2 stands — filtering only gets stronger.

const PIECE_PATH = 'work-log/creation';

/** The only stages a non-owner login may ever see. PLAN §4: "drafts before review". */
const CLIENT_VISIBLE_STAGES = new Set(['review', 'approved', 'scheduled', 'posted']);

/**
 * The engine's internals, removed from every piece a non-owner receives. PLAN §4
 * excludes the costume and the birth snapshot by name; materials, the batch id
 * and her notes are the same kind of thing.
 */
const PIECE_FIELDS_STRIPPED = ['costume', 'birth', 'batch_id', 'materials', 'notes'] as const;

function narrowPieces(entries: ProfileBody['paths'][string]): ProfileBody['paths'][string] {
  const out: ProfileBody['paths'][string] = [];
  for (const e of entries) {
    const data = (e.data ?? {}) as Record<string, unknown>;
    if (!CLIENT_VISIBLE_STAGES.has(String(data.stage))) continue;   // idea and build never travel
    const kept: Record<string, unknown> = { ...data };
    for (const f of PIECE_FIELDS_STRIPPED) delete kept[f];
    // Amendments carry the same internals (a costume completion, a materials
    // attach, a late birth), so they are stripped with the fields they change.
    out.push({ ...e, data: kept, amendments: undefined });
  }
  return out;
}

// ── Spec 27 §14 — the publication gate ───────────────────────────────────────
//
// PLAN §5.2 rule 3: "anything a CLIENT sees is drafted by the engine and approved
// or edited by her first." The committed pick is that the client's analysis
// window renders the latest APPROVED PUBLICATION, never a live query — because
// that is the only shape where "never automatic" is structurally true, and
// because a live client view would show a client a coverage gap in real time with
// no words around it.
//
// The rule, enforced server side and in the STRONGER direction only (CLAUDE.md
// rule 2): on any analysis path, a non-owner role receives entries marked
// `published: true` with an approval stamp, and nothing else. Everything else
// under work-log/analysis — verdicts, comparisons, sync health, the funnel, the
// engine runs, show-my-working — is `audience: owner` and never reaches this
// function at all.

const ANALYSIS_DOOR = 'see:analysis';

function publishedOnly(
  path: string, entries: ProfileBody['paths'][string],
): ProfileBody['paths'][string] {
  return entries.filter(e => {
    const d = (e.data ?? {}) as Record<string, unknown>;
    // Approval is a deliberate act with a date and her name on it. A `published`
    // flag with no stamp is not an approval, so it does not travel.
    if (d.published !== true) return false;
    if (!d.approved_at || !d.approved_by) return false;
    // Only a client publication is ever served to a client. A monthly digest or
    // a weekly pulse marked published would still be her working record.
    if (path === 'work-log/analysis/digests' && d.kind !== 'client-publication') return false;
    return true;
  });
}

// ── Spec 28 §6 — "not rendered" is a server-side fact ────────────────────────
//
// S9 splits "off" into three, and the last column of §6's table is the one that
// matters: a `hidden` thing is ABSENT from the role-filtered body, and the shell
// simply has nothing to draw. A `history` thing travels, read-only, and is
// refused on write (spec 21 §5.2). This is the pass that makes that true.
//
// It only ever REMOVES (CLAUDE.md rule 2), and it only acts on a profile whose
// switchboard she has actually walked. Spec 21 §9.6's rule stands: a migrated
// profile with no positions set keeps rendering exactly what it renders today,
// and suggestions are never applied as her decision. That is also why an
// unwalked profile is untouched here rather than stripped by defaults.

function applySwitchStates(
  body: ProfileBody, paths: ProfileBody['paths'], kind: 'client' | 'staff',
): ProfileBody['paths'] {
  const stored = switchConfigFromBody(body);
  if (Object.keys(stored).length === 0) return paths;   // she has set nothing yet
  // 2026-08-16: a live client binding IS the login, and this function only
  // runs for a login that holds one — so the payload resolves with the same
  // derived truth the window grant does (`windowsForBinding` via
  // `renderProfile`). One helper, both sites; they can never disagree.
  const config = kind === 'client' ? withDerivedLogin(stored, '') : stored;
  const out: ProfileBody['paths'] = {};
  for (const p of Object.keys(paths)) {
    let state: 'active' | 'history' | 'hidden';
    try {
      state = pathState(p, config);
    } catch {
      state = 'active';   // an address the resolver cannot place is left as it was
    }
    if (state === 'hidden') continue;                    // absent, not greyed out
    out[p] = state === 'history'
      ? paths[p].map(e => ({ ...e, state: 'history' as const }))
      : paths[p];
  }
  return out;
}

function filterBodyForNonOwner(
  body: ProfileBody | undefined, kind: 'client' | 'staff', lifecycle: Lifecycle | undefined,
): ProfileBody | undefined {
  if (!body) return undefined;
  // Staff work inside her side, so their body is filtered by audience alone.
  // A client login is additionally scoped by the doors its lifecycle opens
  // (spec 22 §11.1): at `setup` that is intake, and nothing else.
  const doors = kind === 'client' ? doorsOpenAt(lifecycle) : null;
  const paths: ProfileBody['paths'] = {};
  for (const p of Object.keys(body.paths)) {
    if (!clientMayRead(p)) continue;
    if (doors && !clientMayReadAt(p, doors)) continue;
    if (p === PIECE_PATH) {
      // Entry-level narrowing, server side, for EVERY non-owner login — staff
      // included. The engine's internals are hers (spec 24 §13.1).
      paths[p] = narrowPieces(body.paths[p]);
      continue;
    }
    if (findDeclaration(p)?.client_door === ANALYSIS_DOOR) {
      // Spec 27 §14. Every non-owner login, staff included: nothing on an
      // analysis path travels until she has approved it.
      paths[p] = publishedOnly(p, body.paths[p]);
      continue;
    }
    paths[p] = doors && (p === STRATEGY_PREFIX || p.startsWith(STRATEGY_PREFIX + '/'))
      ? lockedOnly(body.paths[p])
      : body.paths[p];
  }
  // her sort queue is never client-facing; and a switch she has set to hidden
  // takes its paths out of the payload entirely (§6).
  return { ...body, paths: applySwitchStates(body, paths, kind), sort_queue: [] };
}

/** Only the four give-points may come back from any non-owner login (S19), and
 *  only the ones this profile's lifecycle actually opens (spec 22 §11.1). */
function mergeBodyFromNonOwner(
  current: ProfileBody | undefined, incoming: ProfileBody | undefined,
  kind: 'client' | 'staff', lifecycle: Lifecycle | undefined,
): ProfileBody | undefined {
  if (!current) return current;           // nothing to merge into yet
  if (!incoming) return current;
  const doors = kind === 'client' ? doorsOpenAt(lifecycle) : null;
  const paths = { ...current.paths };
  for (const p of Object.keys(incoming.paths)) {
    if (!clientMayWrite(p)) continue;
    if (doors && !clientMayWriteAt(p, doors)) continue;
    paths[p] = incoming.paths[p];
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
    const kind = bindingKind(norm, role, id);
    const lifecycle = norm.clients.find(c => c.id === id)?.lifecycle;
    clientData[id] = { ...data, body: filterBodyForNonOwner(data.body, kind, lifecycle) };
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
    // Spec 25 §12.1: no switch, in any position, grants anyone but her sight of
    // a taste rule. It never leaves this function for a non-owner login.
    tasteRules: [],
  };
}

// ── Spec 28 §15.2 — the client's windows ─────────────────────────────────────
//
// One exported function returning the ordered list of client windows a binding
// grants, derived from doors + switches + lifecycle. The client's navigation is
// rendered from it, and the same list is asserted server side.
//
// It GRANTS NOTHING. It is a projection of what the filter has already decided:
// every window below reads paths that `filterBodyForNonOwner` has already let
// through, and a window whose door is shut is simply not in the list. CLAUDE.md
// rule 2 stands — filtering only gets stronger.

export type ClientWindowId = 'brand' | 'intake' | 'content' | 'assets' | 'results';

export interface ClientWindow {
  id: ClientWindowId;
  label: string;
  /** Relative to `/profile/<id>`. Empty string is the profile root. */
  route: string;
  doors: ClientDoor[];
}

/** §7.3's table, in its own order — which is also their landing order. */
const WINDOWS: {
  id: ClientWindowId; label: string; route: string; doors: ClientDoor[];
  /** Any one of these rendering for THEM is enough. */
  clientSwitches: string[];
  /** And these must be on HER side too, where the window depends on her flow. */
  ownerSwitches?: string[];
  /** The Brand window is the LOCKED strategy summary, so it needs a lock. */
  needsLockedStrategy?: boolean;
}[] = [
  {
    // needsLockedStrategy came OFF on 2026-08-11, her order. The window shows
    // whatever summary exists; before a lock it says the summary is coming,
    // which the window already knew how to say.
    //
    // 2026-08-16: the switch here was `strategy.fixed`, which is FIXED — so
    // her Brand toggle wrote a position the registry forbids, and OFF would
    // have cascaded into everything requiring strategy. The window now hangs
    // on its own movable switch, default active, so nothing visible changed
    // and the toggle became real.
    id: 'brand', label: 'Brand', route: '', doors: ['see:strategy', 'see:obligations'],
    clientSwitches: ['strategy.client_brand'],
  },
  {
    id: 'intake', label: 'Intake', route: '/intake', doors: ['give:intake'],
    clientSwitches: ['intake.questionnaire', 'intake.finding_session'],
  },
  {
    id: 'content', label: 'Content', route: '/creation/board',
    doors: ['see:upcoming', 'give:review', 'give:perception'],
    clientSwitches: ['creation.review', 'creation.scheduling'],
  },
  {
    id: 'assets', label: 'Assets', route: '/creation/assets', doors: ['give:assets'],
    clientSwitches: ['assets.client_upload'],
  },
  {
    id: 'results', label: 'Results', route: '/analysis', doors: ['see:analysis'],
    clientSwitches: ['analysis.digest_client'],
    // The Results window renders an approved PUBLICATION, never a live query
    // (spec 27 §14). The publication flow is hers, so it is checked as hers.
    ownerSwitches: ['analysis.client_publication'],
  },
];

export function windowsForBinding(state: AppState, role: Role, profileId: string): ClientWindow[] {
  if (role === 'owner') return [];
  const norm = normalizeState(state);
  if (!allowedClientIds(norm, role).includes(profileId)) return [];
  const kind = bindingKind(norm, role, profileId);
  // §19's interim ruling: staff and Sonia keep the legacy workspace, so the new
  // shell offers them no windows at all.
  if (staysOnLegacy(role, kind)) return [];
  if (!isCutOver(norm.clientData[profileId])) return [];

  const profile = renderProfile(norm, profileId, role);
  const out: ClientWindow[] = [];
  for (const w of WINDOWS) {
    const theirs = w.clientSwitches.some(s => renderState(profile, s, 'client') === 'active');
    if (!theirs) continue;
    // "Is her flow switched ON", not "what does her shell draw right now" — so
    // the lock is set aside, exactly as the desk's guardPath and the Creation
    // screen ask it (lib/desk/write.ts). Before 2026-08-16 the lock dropped
    // her side of an unlocked profile to `history` here too, which silently
    // vetoed Results however she set the switches.
    const hers = (w.ownerSwitches ?? [])
      .every(s => renderState({ ...profile, strategy_locked: true }, s, 'owner') === 'active');
    if (!hers) continue;
    out.push({ id: w.id, label: w.label, route: w.route, doors: w.doors });
  }
  return out;
}

/** Every profile this login reaches in the NEW shell, with its windows. */
export function windowsForRole(state: AppState, role: Role): Record<string, ClientWindow[]> {
  const out: Record<string, ClientWindow[]> = {};
  if (role === 'owner') return out;
  for (const id of allowedClientIds(normalizeState(state), role)) {
    out[id] = windowsForBinding(state, role, id);
  }
  return out;
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
      body: mergeBodyFromNonOwner(
        cur.clientData[id]?.body, inc.body,
        bindingKind(cur, role, id), cur.clients.find(c => c.id === id)?.lifecycle,
      ),
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
    // A non-owner login never received them, so it has nothing to send back.
    tasteRules: cur.tasteRules,
  };
}
