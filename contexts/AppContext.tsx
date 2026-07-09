'use client';

import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import {
  AppState, Client, ClientData, KanbanCard, AgendaItem,
  Reference, BrandOverview, BrandKit, CustomFieldDef, ColumnId, EvergreenIdea, StudioComposition,
  PersonalTask, BrainNode, BrainEdge, MapNode, ColdCall, OnboardingItem, SoniaOrder,
  CatalogueCategory, CatalogueItem, InstagramProfile, PreviewPost,
  ContentPillar, PillarCard, CollabRef, AssetSet, AssetItem,
} from '@/types';
import { generateId, CLIENT_COLORS, formatMonthKey } from '@/lib/utils';
import type { Role } from '@/lib/access';
import PasscodeGate from '@/components/PasscodeGate';

type AuthStatus = 'loading' | 'needsAuth' | 'authed';

const DEFAULT_CATALOGUE_CATEGORIES: CatalogueCategory[] = [
  { id: 'cat-hair-accessories', name: 'Hair Accessories', createdAt: new Date(0).toISOString() },
  { id: 'cat-keychains',        name: 'Keychains',        createdAt: new Date(0).toISOString() },
  { id: 'cat-flowers',          name: 'Flowers',          createdAt: new Date(0).toISOString() },
  { id: 'cat-bags',             name: 'Bags',             createdAt: new Date(0).toISOString() },
  { id: 'cat-clothes',          name: 'Clothes',          createdAt: new Date(0).toISOString() },
  { id: 'cat-rakhis',           name: 'Rakhis',           createdAt: new Date(0).toISOString() },
  { id: 'cat-frames',           name: 'Frames',           createdAt: new Date(0).toISOString() },
];

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
    onboarding: [],
    orders: [],
    catalogueCategories: [...DEFAULT_CATALOGUE_CATEGORIES],
    catalogueItems: [],
    instagram: { handle: '', avatarUrl: '' },
    previewPosts: [],
    pillars: [],
    pillarCards: [],
    assetSets: [],
    assetItems: [],
    driveFolderUrl: '',
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
  containerMap: { nodes: [] },
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
  | { type: 'SEED_CONTAINER_MAP'; payload: { nodes: MapNode[] } }
  | { type: 'ADD_MAP_NODE'; payload: { node: MapNode } }
  | { type: 'UPDATE_MAP_NODE'; payload: { node: MapNode } }
  | { type: 'DELETE_MAP_NODE'; payload: { nodeId: string } }
  | { type: 'ADD_COLD_CALL'; payload: { clientId: string; call: ColdCall } }
  | { type: 'ADD_COLD_CALLS'; payload: { clientId: string; calls: ColdCall[] } }
  | { type: 'UPDATE_COLD_CALL'; payload: { clientId: string; call: ColdCall } }
  | { type: 'DELETE_COLD_CALL'; payload: { clientId: string; callId: string } }
  | { type: 'SET_ONBOARDING'; payload: { clientId: string; items: OnboardingItem[] } }
  | { type: 'ADD_ONBOARDING_ITEM'; payload: { clientId: string; item: OnboardingItem } }
  | { type: 'UPDATE_ONBOARDING_ITEM'; payload: { clientId: string; item: OnboardingItem } }
  | { type: 'DELETE_ONBOARDING_ITEM'; payload: { clientId: string; itemId: string } }
  | { type: 'ADD_ORDER'; payload: { clientId: string; order: SoniaOrder } }
  | { type: 'UPDATE_ORDER'; payload: { clientId: string; order: SoniaOrder } }
  | { type: 'DELETE_ORDER'; payload: { clientId: string; orderId: string } }
  | { type: 'ADD_CATALOGUE_CATEGORY'; payload: { clientId: string; category: CatalogueCategory } }
  | { type: 'DELETE_CATALOGUE_CATEGORY'; payload: { clientId: string; categoryId: string } }
  | { type: 'ADD_CATALOGUE_ITEM'; payload: { clientId: string; item: CatalogueItem } }
  | { type: 'DELETE_CATALOGUE_ITEM'; payload: { clientId: string; itemId: string } }
  | { type: 'UPDATE_INSTAGRAM'; payload: { clientId: string; instagram: InstagramProfile } }
  | { type: 'ADD_PREVIEW_POST'; payload: { clientId: string; post: PreviewPost } }
  | { type: 'UPDATE_PREVIEW_POST'; payload: { clientId: string; post: PreviewPost } }
  | { type: 'DELETE_PREVIEW_POST'; payload: { clientId: string; postId: string } }
  | { type: 'ADD_PILLAR'; payload: { clientId: string; pillar: ContentPillar } }
  | { type: 'UPDATE_PILLAR'; payload: { clientId: string; pillar: ContentPillar } }
  | { type: 'DELETE_PILLAR'; payload: { clientId: string; pillarId: string } }
  | { type: 'ADD_PILLAR_CARD'; payload: { clientId: string; card: PillarCard } }
  | { type: 'UPDATE_PILLAR_CARD'; payload: { clientId: string; card: PillarCard } }
  | { type: 'DELETE_PILLAR_CARD'; payload: { clientId: string; cardId: string } }
  | { type: 'SHARE_PILLAR_CARD'; payload: { sourceClientId: string; sourceCard: PillarCard; targetClientId: string; targetPillarId: string } }
  | { type: 'ADD_ASSET_SET'; payload: { clientId: string; set: AssetSet } }
  | { type: 'RENAME_ASSET_SET'; payload: { clientId: string; setId: string; name: string } }
  | { type: 'DELETE_ASSET_SET'; payload: { clientId: string; setId: string } }
  | { type: 'ADD_ASSET_ITEM'; payload: { clientId: string; item: AssetItem } }
  | { type: 'DELETE_ASSET_ITEM'; payload: { clientId: string; itemId: string } }
  | { type: 'SET_DRIVE_FOLDER'; payload: { clientId: string; url: string } };

function reducer(state: AppState, action: Action): AppState {
  const cd = (id: string) => state.clientData[id] ?? defaultClientData();
  const updateClient = (id: string, patch: Partial<ClientData>): AppState => ({
    ...state,
    clientData: { ...state.clientData, [id]: { ...cd(id), ...patch } },
  });

  switch (action.type) {
    case 'LOAD': {
      const payload = action.payload;
      const patchedClientData: typeof payload.clientData = {};
      for (const [id, cdata] of Object.entries(payload.clientData ?? {})) {
        patchedClientData[id] = {
          ...cdata,
          // Seed default categories for clients that have none yet
          catalogueCategories: (cdata.catalogueCategories?.length ?? 0) > 0
            ? cdata.catalogueCategories
            : [...DEFAULT_CATALOGUE_CATEGORIES],
        };
      }
      return {
        ...payload,
        clientData: patchedClientData,
        personalTasks: payload.personalTasks ?? [],
        brainDump: payload.brainDump ?? { nodes: [], edges: [] },
        containerMap: payload.containerMap ?? { nodes: [] },
      };
    }

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

    case 'SET_ONBOARDING':
      return updateClient(action.payload.clientId, { onboarding: action.payload.items });

    case 'ADD_ONBOARDING_ITEM':
      return updateClient(action.payload.clientId, {
        onboarding: [...(cd(action.payload.clientId).onboarding ?? []), action.payload.item],
      });

    case 'UPDATE_ONBOARDING_ITEM':
      return updateClient(action.payload.clientId, {
        onboarding: (cd(action.payload.clientId).onboarding ?? []).map(o =>
          o.id === action.payload.item.id ? action.payload.item : o
        ),
      });

    case 'DELETE_ONBOARDING_ITEM':
      return updateClient(action.payload.clientId, {
        onboarding: (cd(action.payload.clientId).onboarding ?? []).filter(o => o.id !== action.payload.itemId),
      });

    case 'ADD_ORDER':
      return updateClient(action.payload.clientId, {
        orders: [action.payload.order, ...(cd(action.payload.clientId).orders ?? [])],
      });

    case 'UPDATE_ORDER':
      return updateClient(action.payload.clientId, {
        orders: (cd(action.payload.clientId).orders ?? []).map(o =>
          o.id === action.payload.order.id ? action.payload.order : o
        ),
      });

    case 'DELETE_ORDER':
      return updateClient(action.payload.clientId, {
        orders: (cd(action.payload.clientId).orders ?? []).filter(o => o.id !== action.payload.orderId),
      });

    case 'ADD_CATALOGUE_CATEGORY':
      return updateClient(action.payload.clientId, {
        catalogueCategories: [...(cd(action.payload.clientId).catalogueCategories ?? []), action.payload.category],
      });

    case 'DELETE_CATALOGUE_CATEGORY': {
      const { clientId, categoryId } = action.payload;
      return updateClient(clientId, {
        catalogueCategories: (cd(clientId).catalogueCategories ?? []).filter(c => c.id !== categoryId),
        catalogueItems: (cd(clientId).catalogueItems ?? []).filter(i => i.categoryId !== categoryId),
      });
    }

    case 'ADD_CATALOGUE_ITEM':
      return updateClient(action.payload.clientId, {
        catalogueItems: [...(cd(action.payload.clientId).catalogueItems ?? []), action.payload.item],
      });

    case 'DELETE_CATALOGUE_ITEM':
      return updateClient(action.payload.clientId, {
        catalogueItems: (cd(action.payload.clientId).catalogueItems ?? []).filter(i => i.id !== action.payload.itemId),
      });

    case 'ADD_ASSET_SET':
      return updateClient(action.payload.clientId, {
        assetSets: [...(cd(action.payload.clientId).assetSets ?? []), action.payload.set],
      });

    case 'RENAME_ASSET_SET':
      return updateClient(action.payload.clientId, {
        assetSets: (cd(action.payload.clientId).assetSets ?? []).map(s =>
          s.id === action.payload.setId ? { ...s, name: action.payload.name } : s
        ),
      });

    case 'DELETE_ASSET_SET': {
      const { clientId, setId } = action.payload;
      return updateClient(clientId, {
        assetSets: (cd(clientId).assetSets ?? []).filter(s => s.id !== setId),
        assetItems: (cd(clientId).assetItems ?? []).filter(i => i.setId !== setId),
      });
    }

    case 'ADD_ASSET_ITEM':
      return updateClient(action.payload.clientId, {
        assetItems: [action.payload.item, ...(cd(action.payload.clientId).assetItems ?? [])],
      });

    case 'DELETE_ASSET_ITEM':
      return updateClient(action.payload.clientId, {
        assetItems: (cd(action.payload.clientId).assetItems ?? []).filter(i => i.id !== action.payload.itemId),
      });

    case 'SET_DRIVE_FOLDER':
      return updateClient(action.payload.clientId, { driveFolderUrl: action.payload.url });

    case 'UPDATE_INSTAGRAM':
      return updateClient(action.payload.clientId, { instagram: action.payload.instagram });

    case 'ADD_PREVIEW_POST':
      return updateClient(action.payload.clientId, {
        previewPosts: [action.payload.post, ...(cd(action.payload.clientId).previewPosts ?? [])],
      });

    case 'UPDATE_PREVIEW_POST':
      return updateClient(action.payload.clientId, {
        previewPosts: (cd(action.payload.clientId).previewPosts ?? []).map(p =>
          p.id === action.payload.post.id ? action.payload.post : p
        ),
      });

    case 'DELETE_PREVIEW_POST':
      return updateClient(action.payload.clientId, {
        previewPosts: (cd(action.payload.clientId).previewPosts ?? []).filter(p => p.id !== action.payload.postId),
      });

    case 'ADD_PILLAR':
      return updateClient(action.payload.clientId, {
        pillars: [...(cd(action.payload.clientId).pillars ?? []), action.payload.pillar],
      });

    case 'UPDATE_PILLAR':
      return updateClient(action.payload.clientId, {
        pillars: (cd(action.payload.clientId).pillars ?? []).map(p =>
          p.id === action.payload.pillar.id ? action.payload.pillar : p
        ),
      });

    case 'DELETE_PILLAR':
      return updateClient(action.payload.clientId, {
        pillars: (cd(action.payload.clientId).pillars ?? []).filter(p => p.id !== action.payload.pillarId),
        // cascade: drop the topic cards that belonged to the deleted pillar
        pillarCards: (cd(action.payload.clientId).pillarCards ?? []).filter(c => c.pillarId !== action.payload.pillarId),
      });

    case 'ADD_PILLAR_CARD':
      return updateClient(action.payload.clientId, {
        pillarCards: [...(cd(action.payload.clientId).pillarCards ?? []), action.payload.card],
      });

    case 'UPDATE_PILLAR_CARD': {
      const { clientId, card } = action.payload;
      // Update the card in its own account.
      const next = updateClient(clientId, {
        pillarCards: (cd(clientId).pillarCards ?? []).map(c => c.id === card.id ? card : c),
      });
      // If it's part of a collaboration, push the shared fields (title/hook/
      // content/link) to its twins on the other accounts. Bucket and status
      // stay per-account, so they're deliberately left untouched.
      if (!card.collabId) return next;
      const synced = { title: card.title, hook: card.hook, content: card.content, link: card.link, updatedAt: card.updatedAt };
      const patched = { ...next.clientData };
      for (const [cid, cdata] of Object.entries(next.clientData)) {
        if (cid === clientId) continue;
        const list = cdata.pillarCards ?? [];
        if (list.some(c => c.collabId === card.collabId)) {
          patched[cid] = { ...cdata, pillarCards: list.map(c => c.collabId === card.collabId ? { ...c, ...synced } : c) };
        }
      }
      return { ...next, clientData: patched };
    }

    case 'DELETE_PILLAR_CARD': {
      const { clientId, cardId } = action.payload;
      const removed = (cd(clientId).pillarCards ?? []).find(c => c.id === cardId);
      const next = updateClient(clientId, {
        pillarCards: (cd(clientId).pillarCards ?? []).filter(c => c.id !== cardId),
      });
      // If the deleted card was in a collaboration, drop this account from the
      // twins' `collabWith` so their badge updates. A card left with no
      // partners loses its collab link entirely.
      if (!removed?.collabId) return next;
      const patched = { ...next.clientData };
      for (const [cid, cdata] of Object.entries(next.clientData)) {
        const list = cdata.pillarCards ?? [];
        if (list.some(c => c.collabId === removed.collabId)) {
          patched[cid] = {
            ...cdata,
            pillarCards: list.map(c => {
              if (c.collabId !== removed.collabId) return c;
              const nextWith = (c.collabWith ?? []).filter(w => w.clientId !== clientId);
              return { ...c, collabWith: nextWith, collabId: nextWith.length ? c.collabId : undefined };
            }),
          };
        }
      }
      return { ...next, clientData: patched };
    }

    case 'SHARE_PILLAR_CARD': {
      const { sourceClientId, sourceCard, targetClientId, targetPillarId } = action.payload;
      if (sourceClientId === targetClientId) return state;
      const now = new Date().toISOString();
      const collabId = sourceCard.collabId ?? generateId();
      const nameOf = (id: string) => state.clients.find(c => c.id === id)?.name ?? '';

      // Full member set = every account already in this collab + source + target.
      const memberSet = new Set<string>([sourceClientId, targetClientId]);
      for (const [cid, cdata] of Object.entries(state.clientData)) {
        if ((cdata.pillarCards ?? []).some(c => c.collabId === collabId)) memberSet.add(cid);
      }
      const memberIds = Array.from(memberSet);
      const collabWithFor = (selfId: string): CollabRef[] =>
        memberIds.filter(id => id !== selfId).map(id => ({ clientId: id, clientName: nameOf(id) }));

      const clientData = { ...state.clientData };

      // 1. Persist the (edited) source card + its collab metadata.
      const srcData = clientData[sourceClientId] ?? defaultClientData();
      const srcList = srcData.pillarCards ?? [];
      const updatedSource: PillarCard = { ...sourceCard, collabId, collabWith: collabWithFor(sourceClientId), updatedAt: now };
      clientData[sourceClientId] = {
        ...srcData,
        pillarCards: srcList.some(c => c.id === sourceCard.id)
          ? srcList.map(c => c.id === sourceCard.id ? updatedSource : c)
          : [...srcList, updatedSource],
      };

      // 2. Create the twin on the target account, in the chosen bucket.
      const tgtData = clientData[targetClientId] ?? defaultClientData();
      const twin: PillarCard = {
        id: generateId(),
        pillarId: targetPillarId,
        title: sourceCard.title,
        hook: sourceCard.hook,
        content: sourceCard.content,
        link: sourceCard.link,
        status: 'idea',
        collabId,
        collabWith: collabWithFor(targetClientId),
        createdAt: now,
        updatedAt: now,
      };
      clientData[targetClientId] = { ...tgtData, pillarCards: [...(tgtData.pillarCards ?? []), twin] };

      // 3. Refresh collabWith on any pre-existing members so their badges list
      //    the newly added account too.
      for (const id of memberIds) {
        if (id === sourceClientId || id === targetClientId) continue;
        const data = clientData[id];
        if (!data) continue;
        clientData[id] = {
          ...data,
          pillarCards: (data.pillarCards ?? []).map(c =>
            c.collabId === collabId ? { ...c, collabWith: collabWithFor(id) } : c
          ),
        };
      }

      return { ...state, clientData };
    }

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

    case 'SEED_CONTAINER_MAP':
      // Only ever fills an empty map — never overwrites her edits.
      if ((state.containerMap?.nodes?.length ?? 0) > 0) return state;
      return { ...state, containerMap: { nodes: action.payload.nodes } };

    case 'ADD_MAP_NODE':
      return {
        ...state,
        containerMap: { nodes: [...(state.containerMap?.nodes ?? []), action.payload.node] },
      };

    case 'UPDATE_MAP_NODE':
      return {
        ...state,
        containerMap: {
          nodes: (state.containerMap?.nodes ?? []).map(n =>
            n.id === action.payload.node.id ? action.payload.node : n
          ),
        },
      };

    case 'DELETE_MAP_NODE': {
      const all = state.containerMap?.nodes ?? [];
      // cascade: remove the node and all its descendants
      const doomed = new Set<string>([action.payload.nodeId]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const n of all) {
          if (n.parentId && doomed.has(n.parentId) && !doomed.has(n.id)) {
            doomed.add(n.id);
            grew = true;
          }
        }
      }
      return { ...state, containerMap: { nodes: all.filter(n => !doomed.has(n.id)) } };
    }

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
  /** Persist the latest state to the server immediately and resolve once it
   *  lands (true) or fails (false). Call right after a dispatch whose result
   *  a server-rendered page will read — e.g. creating a shareable preview. */
  saveNow: () => Promise<boolean>;
}

const AppContext = createContext<CtxValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  // Public share pages (/p/...) need no session and must never show the gate.
  const isPublic = usePathname()?.startsWith('/p/') ?? false;
  const [state, dispatch] = useReducer(reducer, SEED);
  const [status, setStatus] = React.useState<AuthStatus>('loading');
  const [role, setRole] = React.useState<Role>('owner');
  const [authError, setAuthError] = React.useState('');
  const [selectedMonth, setSelectedMonth] = React.useState(() => formatMonthKey(new Date()));
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef = useRef(false);
  const dirtyRef = useRef(false);   // true while there are unsaved local changes
  const skipSaveRef = useRef(false); // skip the save that a fresh LOAD would trigger
  const flushRef = useRef(false);    // when set, the next save runs immediately (no debounce)
  const flushWaiters = useRef<((ok: boolean) => void)[]>([]);

  // Persist immediately and resolve when done. Used before revealing a public
  // share link so the post is guaranteed to be in the DB, not waiting on the
  // 1s debounce. Relies on a state change (the dispatch) having just fired the
  // save effect; a 6s fallback guarantees the promise never hangs.
  function saveNow(): Promise<boolean> {
    flushRef.current = true;
    return new Promise<boolean>(resolve => {
      const done = (ok: boolean) => resolve(ok);
      flushWaiters.current.push(done);
      setTimeout(() => {
        const i = flushWaiters.current.indexOf(done);
        if (i >= 0) { flushWaiters.current.splice(i, 1); resolve(false); }
      }, 6000);
    });
  }

  // Pull the (role-appropriate) state from the server.
  async function loadState() {
    try {
      const res = await fetch('/api/state', { cache: 'no-store' });
      if (res.status === 401) { setStatus('needsAuth'); return; }
      if (!res.ok) { setStatus('needsAuth'); return; }
      const { role: r, state: s } = await res.json();
      setRole(r as Role);
      // Don't echo freshly-loaded data back to the server — that would clobber
      // out-of-band writes (e.g. a link just saved from the share sheet).
      if (s) { skipSaveRef.current = true; dispatch({ type: 'LOAD', payload: s as AppState }); }
      loadedRef.current = true;
      setStatus('authed');
    } catch {
      setStatus('needsAuth');
    }
  }

  // Always attempt to resume from the server cookie on startup.
  // The server returns 401 if there is no valid session → show the gate.
  // This way a valid cookie (intern/owner) auto-logs in even after closing
  // and reopening the app — no client-side storage flag required.
  useEffect(() => {
    if (typeof window === 'undefined' || isPublic) return;
    loadState();
  }, []);

  // Save to the server (debounced) on every state change once loaded. When a
  // flush is requested (saveNow), skip the debounce and persist immediately,
  // resolving any waiters with the outcome.
  useEffect(() => {
    if (status !== 'authed' || !loadedRef.current) return;
    if (skipSaveRef.current) { skipSaveRef.current = false; return; } // just loaded — nothing to save
    dirtyRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);

    const doSave = () =>
      fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state }),
      })
        .then(res => {
          if (res.status === 401) {
            // Session expired while editing — show the gate so changes aren't silently lost.
            loadedRef.current = false;
            setStatus('needsAuth');
            return false;
          }
          if (!res.ok) return false; // server error (e.g. Supabase write failed)
          dirtyRef.current = false;
          return true;
        })
        .catch(() => false); // offline — next change will retry

    if (flushRef.current) {
      flushRef.current = false;
      const waiters = flushWaiters.current;
      flushWaiters.current = [];
      doSave().then(ok => waiters.forEach(w => w(ok)));
    } else {
      saveTimer.current = setTimeout(doSave, 1000);
    }
  }, [state, status]);

  // When the app comes back to the foreground, re-pull fresh data — so a link
  // saved from the share sheet (or an edit by another role) shows up, instead
  // of the dashboard sitting on a stale in-memory copy. Skipped while there are
  // unsaved local edits so we never clobber them.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible' && loadedRef.current && !dirtyRef.current) {
        loadState();
      }
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

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
      if (r && r !== 'owner') localStorage.setItem('dash_persist', '1'); // restricted roles stay logged in
      else sessionStorage.setItem('dash_active', '1');                   // owner: this session only
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

  if (isPublic) return <>{children}</>;
  if (status === 'loading') return null;
  if (status === 'needsAuth') return <PasscodeGate onSubmit={login} error={authError} />;

  return (
    <AppContext.Provider value={{ state, dispatch, selectedMonth, setSelectedMonth, role, logout, saveNow }}>
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
