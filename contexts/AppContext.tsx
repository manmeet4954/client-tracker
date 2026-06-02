'use client';

import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import {
  AppState, Client, ClientData, KanbanCard, AgendaItem,
  Reference, BrandOverview, CustomFieldDef, ColumnId, EvergreenIdea,
} from '@/types';
import { generateId, CLIENT_COLORS, formatMonthKey } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

const STORAGE_KEY = 'clientdash_v2';
const DB_ROW_ID = 'manmeet';

const defaultBrand: BrandOverview = {
  tagline: '',
  goals: [],
  strategy: '',
  audience: '',
  services: [],
};

function defaultClientData(): ClientData {
  return {
    cards: [],
    customFields: [],
    monthData: {},
    references: [],
    brand: { ...defaultBrand },
    postTarget: 0,
    evergreenIdeas: [],
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
  | { type: 'DELETE_REFERENCE'; payload: { clientId: string; refId: string } }
  | { type: 'TOGGLE_PIN'; payload: { clientId: string; refId: string } }
  | { type: 'UPDATE_BRAND'; payload: { clientId: string; brand: BrandOverview } }
  | { type: 'SET_POST_TARGET'; payload: { clientId: string; target: number } }
  | { type: 'ADD_FIELD'; payload: { clientId: string; field: CustomFieldDef } }
  | { type: 'UPDATE_FIELD'; payload: { clientId: string; field: CustomFieldDef } }
  | { type: 'DELETE_FIELD'; payload: { clientId: string; fieldId: string } }
  | { type: 'ADD_EVERGREEN'; payload: { clientId: string; idea: EvergreenIdea } }
  | { type: 'UPDATE_EVERGREEN'; payload: { clientId: string; idea: EvergreenIdea } }
  | { type: 'DELETE_EVERGREEN'; payload: { clientId: string; ideaId: string } };

function reducer(state: AppState, action: Action): AppState {
  const cd = (id: string) => state.clientData[id] ?? defaultClientData();
  const updateClient = (id: string, patch: Partial<ClientData>): AppState => ({
    ...state,
    clientData: { ...state.clientData, [id]: { ...cd(id), ...patch } },
  });

  switch (action.type) {
    case 'LOAD':
      return action.payload;

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
        clients: [...state.clients, client],
        clientData: { ...state.clientData, [id]: defaultClientData() },
      };
    }

    case 'REMOVE_CLIENT': {
      const { [action.payload]: _removed, ...rest } = state.clientData;
      return { clients: state.clients.filter(c => c.id !== action.payload), clientData: rest };
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

    default:
      return state;
  }
}

interface CtxValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
}

const AppContext = createContext<CtxValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, SEED);
  const [loaded, setLoaded] = React.useState(false);
  const [selectedMonth, setSelectedMonth] = React.useState(() => formatMonthKey(new Date()));
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from Supabase on mount, fall back to localStorage
  useEffect(() => {
    async function loadState() {
      try {
        const { data, error } = await supabase
          .from('app_state')
          .select('data')
          .eq('id', DB_ROW_ID)
          .single();

        if (!error && data?.data) {
          dispatch({ type: 'LOAD', payload: data.data as AppState });
        } else {
          // Fall back to localStorage if Supabase has no data yet
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) dispatch({ type: 'LOAD', payload: JSON.parse(raw) });
        }
      } catch {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          try { dispatch({ type: 'LOAD', payload: JSON.parse(raw) }); } catch { /* ignore */ }
        }
      }
      setLoaded(true);
    }
    loadState();
  }, []);

  // Save to Supabase (debounced) + localStorage on every state change
  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await supabase.from('app_state').upsert({ id: DB_ROW_ID, data: state, updated_at: new Date().toISOString() });
    }, 1000); // debounce 1s so we don't spam on every keystroke
  }, [state, loaded]);

  if (!loaded) return null;

  return <AppContext.Provider value={{ state, dispatch, selectedMonth, setSelectedMonth }}>{children}</AppContext.Provider>;
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
