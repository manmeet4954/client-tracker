'use client';

import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import {
  AppState, Client, ClientData, KanbanCard, AgendaItem,
  Reference, BrandOverview, BrandKit, CustomFieldDef, ColumnId, EvergreenIdea, StudioComposition,
  PersonalTask, BrainNode, BrainEdge, ColdCall,
} from '@/types';
import { generateId, CLIENT_COLORS, formatMonthKey } from '@/lib/utils';
import type { Role } from '@/lib/access';
import PasscodeGate from '@/components/PasscodeGate';

type AuthStatus = 'loading' | 'needsAuth' | 'authed';

const defaultBrand: BrandOverview = {
  tagline: '',
  goals: [],
  strategy: '',
  audience: '',
  services: [],
};

const defaultBrandKit: BrandKit = { colors: [], fonts: [] };

function defaultClientData(): ClientData {
  return {
    cards: [],
    customFields: [],
    monthData: {},
    references: [],
    brand: { ...defaultBrand },
    brandKit: { ...defaultBrandKit },
    postTarget: 0,
    evergreenIdeas: [],
    studioCompositions: [],
    coldCalls: [],
  };
}

const SEED: AppState = {
  clients: [
    { id: 'career-bubble', name: 'Career Bubble', color: '#8B5CF6', createdAt: new Date().toISOString() },
    { id: 'divine-studio', name: 'Divine Studio', color: '#10B981', createdAt: new Date().toISOString() },
    { id: 'sonias-crochet', name: "Sonia's Crochet", color: '#F43F5E', createdAt: new Date().toISOString() },
  ],
  clientData: {
    'career-bubble': defaultClientData(),
    'divine-studio': defaultClientData(),
    'sonias-crochet': defaultClientData(),
  },
  personalTasks: [],
  brainDump: { nodes: [], edges: [] },
};

export type Action =
  | { type: 'LOAD'; payload: AppState }
  | { type: 'ADD_CLIENT'; payload: { name: string } }
  | { type: 'REMOVE_CLIENT'; payload: string }
  | { type: 'RENAME_CLIENT'; payload: { id: string; name: string } }
  | { type: 'ADD_CARD'; payload: { clientId: string; card: KanbanCard } }
  | { type: 'UPDATE_CARD'; payload: { clientId: string; card: KanbanCard } }
  | { type: 'DELETE_CARD'; payload: { clientId: string; cardId: string } }
  | { type: 'MOVE_CARD'; payload: { clientId: string; cardId: string; columnId: ColumnId } }
  | { type: 'ADD_AGENDA'; payload: { clientId: string; month: string; item: AgendaItem } }
  | { type: 'TOGGLE_AGENDA'; payload: { clientId: string; month: string; itemId: string } }
  | { type: 'DELETE_AGENDA'; payload: { clientId: string; month: string; itemId: string } }
  | { type: 'UPDATE_AGENDA_TEXT'; payload: { clientId: string; month: string; itemId: string; text: string } }
  | { type: 'ADD_REFERENCE'; payload: { clientId: string; ref: Reference } }
  | { type: 'EDIT_REFERENCE'; payload: { clientId: string; refId: string; title: string; content: string } }
  | { type: 'DELETE_REFERENCE'; payload: { clientId: string; refId: string } }
  | { type: 'TOGGLE_PIN'; payload: { clientId: string; refId: string } }
  | { type: 'UPDATE_BRAND'; payload: { clientId: string; brand: BrandOverview } }
  | { type: 'SET_POST_TARGET'; payload: { clientId: string; target: number } }
  | { type: 'ADD_FIELD'; payload: { clientId: string; field: CustomFieldDef } }
  | { type: 'UPDATE_FIELD'; payload: { clientId: string; field: CustomFieldDef } }
  | { type: 'DELETE_FIELD'; payload: { clientId: string; fieldId: string } }
  | { type: 'ADD_EVERGREEN'; payload: { clientId: string; idea: EvergreenIdea } }
  | { type: 'UPDATE_EVERGREEN'; payload: { clientId: string; idea: EvergreenIdea } }
  | { type: 'DELETE_EVERGREEN'; payload: { clientId: string; ideaId: string } }
  | { type: 'SAVE_STUDIO_COMP'; payload: { clientId: string; comp: StudioComposition } }
  | { type: 'DELETE_STUDIO_COMP'; payload: { clientId: string; compId: string } }
  | { type: 'UPDATE_BRAND_KIT'; payload: { clientId: string; brandKit: BrandKit } }
  | { type: 'ADD_TASK'; payload: { task: PersonalTask } }
  | { type: 'EDIT_TASK'; payload: { task: PersonalTask } }
  | { type: 'TOGGLE_TASK'; payload: { taskId: string } }
  | { type: 'DELETE_TASK'; payload: { taskId: string } }
  | { type: 'ADD_BRAIN_NODE'; payload: { node: BrainNode } }
  | { type: 'UPDATE_BRAIN_NODE'; payload: { node: BrainNode } }
  | { type: 'DELETE_BRAIN_NODE'; payload: { nodeId: string } }
  | { type: 'ADD_BRAIN_EDGE'; payload: { edge: BrainEdge } }
  | { type: 'DELETE_BRAIN_EDGE'; payload: { edgeId: string } }
  | { type: 'ADD_COLD_CALL'; payload: { clientId: string; call: ColdCall } }
  | { type: 'ADD_COLD_CALLS'; payload: { clientId: string; calls: ColdCall[] } }
  | { type: 'UPDATE_COLD_CALL'; payload: { clientId: string; call: ColdCall } }
  | { type: 'DELETE_COLD_CALL'; payload: { clientId: string; callId: string } };

function reducer(state: AppState, action: Action): AppState {
  const cd = (id: string) => state.clientData[id] ?? defaultClientData();
  const updateClient = (id: string, patch: Partial<ClientData>): AppState => ({
    ...state,
    clientData: { ...state.clientData, [id]: { ...cd(id), ...patch } },
  });

  switch (action.type) {
    case 'LOAD':
      // Normalize older saved states that predate newer top-level fields
      return {
        ...action.payload,
        personalTasks: action.payload.personalTasks ?? [],
        brainDump: action.payload.brainDump ?? { nodes: [], edges: [] },
      };

    case 'ADD_CLIENT': {
      const id = generateId();
      const colorIndex = state.clients.length % CLIENT_COLORS.length;
      const client: Client = {
        id,
        name: action.payload.name,
        color: CLIENT_COLORS[colorIndex],
        createdAt: new Date().toISOString(),
      };
      return {
        ...state,
        clients: [...state.clients, client],
        clientData: { ...state.clientData, [id]: defaultClientData() },
      };
    }

    case 'REMOVE_CLIENT': {
      const { [action.payload]: _removed, ...rest } = state.clientData;
      return { ...state, clients: state.clients.filter(c => c.id !== action.payload), clientData: rest };
    }

    case 'RENAME_CLIENT':
      return {
        ...state,
        clients: state.clients.map(c =>
          c.id === action.payload.id ? { ...c, name: action.payload.name } : c
        ),
      };

    case 'ADD_CARD':
      return updateClient(action.payload.clientId, {
        cards: [...cd(action.payload.clientId).cards, action.payload.card],
      });

    case 'UPDATE_CARD':
      return updateClient(action.payload.clientId, {
        cards: cd(action.payload.clientId).cards.map(c =>
          c.id === action.payload.card.id ? action.payload.card : c
        ),
      });

    case 'DELETE_CARD':
      return updateClient(action.payload.clientId, {
        cards: cd(action.payload.clientId).cards.filter(c => c.id !== action.payload.cardId),
      });

    case 'MOVE_CARD':
      return updateClient(action.payload.clientId, {
        cards: cd(action.payload.clientId).cards.map(c =>
          c.id === action.payload.cardId ? { ...c, columnId: action.payload.columnId } : c
        ),
      });

    case 'ADD_AGENDA': {
      const { clientId, month, item } = action.payload;
      const data = cd(clientId);
      const existing = data.monthData[month] ?? { agenda: [] };
      return updateClient(clientId, {
        monthData: { ...data.monthData, [month]: { ...existing, agenda: [...existing.agenda, item] } },
      });
    }

    case 'TOGGLE_AGENDA': {
      const { clientId, month, itemId } = action.payload;
      const data = cd(clientId);
      const existing = data.monthData[month] ?? { agenda: [] };
      return updateClient(clientId, {
        monthData: {
          ...data.monthData,
          [month]: {
            ...existing,
            agenda: existing.agenda.map(i => i.id === itemId ? { ...i, done: !i.done } : i),
          },
        },
      });
    }

    case 'DELETE_AGENDA': {
      const { clientId, month, itemId } = action.payload;
      const data = cd(clientId);
      const existing = data.monthData[month] ?? { agenda: [] };
      return updateClient(clientId, {
        monthData: {
          ...data.monthData,
          [month]: { ...existing, agenda: existing.agenda.filter(i => i.id !== itemId) },
        },
      });
    }

    case 'UPDATE_AGENDA_TEXT': {
      const { clientId, month, itemId, text } = action.payload;
      const data = cd(clientId);
      const existing = data.monthData[month] ?? { agenda: [] };
      return updateClient(clientId, {
        monthData: {
          ...data.monthData,
          [month]: {
            ...existing,
            agenda: existing.agenda.map(i => i.id === itemId ? { ...i, text } : i),
          },
        },
      });
    }

    case 'ADD_REFERENCE':
      return updateClient(action.payload.clientId, {
        references: [action.payload.ref, ...cd(action.payload.clientId).references],
      });

    case 'EDIT_REFERENCE':
      return updateClient(action.payload.clientId, {
        references: cd(action.payload.clientId).references.map(r =>
          r.id === action.payload.refId
            ? { ...r, title: action.payload.title, content: action.payload.content }
            : r
        ),
      });

    case 'DELETE_REFERENCE':
      return updateClient(action.payload.clientId, {
        references: cd(action.payload.clientId).references.filter(r => r.id !== action.payload.refId),
      });

    case 'TOGGLE_PIN':
      return updateClient(action.payload.clientId, {
        references: cd(action.payload.clientId).references.map(r =>
          r.id === action.payload.refId ? { ...r, pinned: !r.pinned } : r
        ),
      });

    case 'UPDATE_BRAND':
      return updateClient(action.payload.clientId, { brand: action.payload.brand });

    case 'SET_POST_TARGET':
      return updateClient(action.payload.clientId, { postTarget: action.payload.target });

    case 'ADD_FIELD':
      return updateClient(action.payload.clientId, {
        customFields: [...cd(action.payload.clientId).customFields, action.payload.field],
      });

    case 'UPDATE_FIELD':
      return updateClient(action.payload.clientId, {
        customFields: cd(action.payload.clientId).customFields.map(f =>
          f.id === action.payload.field.id ? action.payload.field : f
        ),
      });

    case 'DELETE_FIELD':
      return updateClient(action.payload.clientId, {
        customFields: cd(action.payload.clientId).customFields.filter(f => f.id !== action.payload.fieldId),
      });

    case 'ADD_EVERGREEN':
      return updateClient(action.payload.clientId, {
        evergreenIdeas: [action.payload.idea, ...(cd(action.payload.clientId).evergreenIdeas ?? [])],
      });

    case 'UPDATE_EVERGREEN':
      return updateClient(action.payload.clientId, {
        evergreenIdeas: (cd(action.payload.clientId).evergreenIdeas ?? []).map(i =>
          i.id === action.payload.idea.id ? action.payload.idea : i
        ),
      });

    case 'DELETE_EVERGREEN':
      return updateClient(action.payload.clientId, {
        evergreenIdeas: (cd(action.payload.clientId).evergreenIdeas ?? []).filter(i => i.id !== action.payload.ideaId),
      });

    case 'SAVE_STUDIO_COMP': {
      const existing = (cd(action.payload.clientId).studioCompositions ?? []);
      const idx = existing.findIndex(c => c.id === action.payload.comp.id);
      const updated = idx >= 0
        ? existing.map(c => c.id === action.payload.comp.id ? action.payload.comp : c)
        : [action.payload.comp, ...existing];
      return updateClient(action.payload.clientId, { studioCompositions: updated });
    }

    case 'DELETE_STUDIO_COMP':
      return updateClient(action.payload.clientId, {
        studioCompositions: (cd(action.payload.clientId).studioCompositions ?? []).filter(c => c.id !== action.payload.compId),
      });

    case 'UPDATE_BRAND_KIT':
      return updateClient(action.payload.clientId, { brandKit: action.payload.brandKit });

    case 'ADD_COLD_CALL':
      return updateClient(action.payload.clientId, {
        coldCalls: [action.payload.call, ...(cd(action.payload.clientId).coldCalls ?? [])],
      });

    case 'ADD_COLD_CALLS':
      return updateClient(action.payload.clientId, {
        coldCalls: [...action.payload.calls, ...(cd(action.payload.clientId).coldCalls ?? [])],
      });

    case 'UPDATE_COLD_CALL':
      return updateClient(action.payload.clientId, {
        coldCalls: (cd(action.payload.clientId).coldCalls ?? []).map(c =>
          c.id === action.payload.call.id ? action.payload.call : c
        ),
      });

    case 'DELETE_COLD_CALL':
      return updateClient(action.payload.clientId, {
        coldCalls: (cd(action.payload.clientId).coldCalls ?? []).filter(c => c.id !== action.payload.callId),
      });

    case 'ADD_TASK':
      return { ...state, personalTasks: [action.payload.task, ...(state.personalTasks ?? [])] };

    case 'EDIT_TASK':
      return {
        ...state,
        personalTasks: (state.personalTasks ?? []).map(t =>
          t.id === action.payload.task.id ? action.payload.task : t
        ),
      };

    case 'TOGGLE_TASK':
      return {
        ...state,
        personalTasks: (state.personalTasks ?? []).map(t =>
          t.id === action.payload.taskId
            ? { ...t, done: !t.done, completedAt: !t.done ? new Date().toISOString() : undefined }
            : t
        ),
      };

    case 'DELETE_TASK':
      return {
        ...state,
        personalTasks: (state.personalTasks ?? []).filter(t => t.id !== action.payload.taskId),
      };

    case 'ADD_BRAIN_NODE':
      return {
        ...state,
        brainDump: {
          nodes: [...(state.brainDump?.nodes ?? []), action.payload.node],
          edges: state.brainDump?.edges ?? [],
        },
      };

    case 'UPDATE_BRAIN_NODE':
      return {
        ...state,
        brainDump: {
          nodes: (state.brainDump?.nodes ?? []).map(n =>
            n.id === action.payload.node.id ? action.payload.node : n
          ),
          edges: state.brainDump?.edges ?? [],
        },
      };

    case 'DELETE_BRAIN_NODE':
      return {
        ...state,
        brainDump: {
          nodes: (state.brainDump?.nodes ?? []).filter(n => n.id !== action.payload.nodeId),
          // cascade: drop any edge touching the deleted node
          edges: (state.brainDump?.edges ?? []).filter(
            e => e.from !== action.payload.nodeId && e.to !== action.payload.nodeId
          ),
        },
      };

    case 'ADD_BRAIN_EDGE': {
      const edges = state.brainDump?.edges ?? [];
      const { from, to } = action.payload.edge;
      // avoid self-links and duplicates (either direction)
      if (from === to || edges.some(e => (e.from === from && e.to === to) || (e.from === to && e.to === from))) {
        return state;
      }
      return {
        ...state,
        brainDump: { nodes: state.brainDump?.nodes ?? [], edges: [...edges, action.payload.edge] },
      };
    }

    case 'DELETE_BRAIN_EDGE':
      return {
        ...state,
        brainDump: {
          nodes: state.brainDump?.nodes ?? [],
          edges: (state.brainDump?.edges ?? []).filter(e => e.id !== action.payload.edgeId),
        },
      };

    default:
      return state;
  }
}

interface CtxValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  role: Role;
  logout: () => void;
}

const AppContext = createContext<CtxValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, SEED);
  const [status, setStatus] = React.useState<AuthStatus>('loading');
  const [role, setRole] = React.useState<Role>('owner');
  const [authError, setAuthError] = React.useState('');
  const [selectedMonth, setSelectedMonth] = React.useState(() => formatMonthKey(new Date()));
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef = useRef(false);

  // Pull the (role-appropriate) state from the server.
  async function loadState() {
    try {
      const res = await fetch('/api/state', { cache: 'no-store' });
      if (res.status === 401) { setStatus('needsAuth'); return; }
      if (!res.ok) { setStatus('needsAuth'); return; }
      const { role: r, state: s } = await res.json();
      setRole(r as Role);
      if (s) dispatch({ type: 'LOAD', payload: s as AppState });
      loadedRef.current = true;
      setStatus('authed');
    } catch {
      setStatus('needsAuth');
    }
  }

  // Auto-resume only if a persistent role stayed logged in (localStorage), or
  // within the same browser session for per-open roles (sessionStorage clears
  // when the app/tab closes → passcode required again).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const persistent = localStorage.getItem('dash_persist') === '1';
    const activeThisSession = sessionStorage.getItem('dash_active') === '1';
    if (persistent || activeThisSession) loadState();
    else setStatus('needsAuth');
  }, []);

  // Save to the server (debounced) on every state change once loaded.
  useEffect(() => {
    if (status !== 'authed' || !loadedRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state }),
      }).catch(() => { /* offline — next change retries */ });
    }, 1000);
  }, [state, status]);

  async function login(passcode: string) {
    setAuthError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Incorrect passcode' }));
        setAuthError(error ?? 'Incorrect passcode');
        return;
      }
      const { role: r } = await res.json().catch(() => ({ role: 'owner' }));
      if (r === 'sonia') localStorage.setItem('dash_persist', '1'); // mom stays logged in
      else sessionStorage.setItem('dash_active', '1');               // others: this session only
      setStatus('loading');
      await loadState();
    } catch {
      setAuthError('Could not connect. Try again.');
    }
  }

  async function logout() {
    await fetch('/api/auth', { method: 'DELETE' }).catch(() => {});
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('dash_active');
      localStorage.removeItem('dash_persist');
    }
    loadedRef.current = false;
    setStatus('needsAuth');
  }

  if (status === 'loading') return null;
  if (status === 'needsAuth') return <PasscodeGate onSubmit={login} error={authError} />;

  return (
    <AppContext.Provider value={{ state, dispatch, selectedMonth, setSelectedMonth, role, logout }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}

export function useClient(clientId: string) {
  const { state } = useApp();
  const client = state.clients.find(c => c.id === clientId);
  const data = state.clientData[clientId] ?? defaultClientData();
  return { client, data };
}

export { formatMonthKey };
