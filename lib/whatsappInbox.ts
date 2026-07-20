import type {
  AppState, Client, PersonalTask, AgendaItem, Observation, AssetSet, AssetItem,
} from '@/types';

// The WhatsApp inbox brain (Spec 18 part B). Pure functions: parse a message,
// decide where it belongs, apply it to an AppState copy. No network, no Meta
// API — the webhook route (app/api/whatsapp) does the I/O and calls this.
//
// Routing law: her explicit hashtags steer; AI only ever files UNTAGGED text,
// and only into Observations (owner-only). Nothing a client login can see is
// ever written without an explicit client hashtag from her (CLAUDE.md rule 1).

export interface ParsedMessage {
  tags: string[];   // hashtag words, lowercased, in order, '#' stripped
  rest: string;     // the message with hashtags removed, whitespace collapsed
}

export function parseMessage(text: string): ParsedMessage {
  const tags: string[] = [];
  const rest = text
    .replace(/(^|\s)#([a-zA-Z0-9_-]+)/g, (_m, _pre, tag: string) => {
      tags.push(tag.toLowerCase());
      return ' ';
    })
    .replace(/\s+/g, ' ')
    .trim();
  return { tags, rest };
}

/** Normalize a name for tag matching: lowercase, letters+digits only. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Which clients a tag could mean. A tag matches a client when it equals the
 *  whole squashed name ("divinestudio") or any single word of the name with
 *  4+ letters ("divine"). Ambiguous tags (two clients share the word) return
 *  both — the caller asks her instead of guessing. */
export function matchClients(tag: string, clients: Client[]): Client[] {
  const t = norm(tag);
  if (t.length < 3) return [];
  return clients.filter(c => {
    if (norm(c.name) === t) return true;
    return c.name
      .split(/[^a-zA-Z0-9]+/)
      .filter(w => w.length >= 4)
      .some(w => norm(w) === t);
  });
}

export type InboxDecision =
  | { kind: 'my-task'; text: string }
  | { kind: 'client-task'; client: Client; text: string }
  | { kind: 'observation'; topic: string; text: string; clientId?: string }
  | { kind: 'needs-ai-topic'; text: string }              // untagged text
  | { kind: 'photo'; client: Client; caption: string }     // caller saw media
  | { kind: 'ask'; reply: string };                        // can't act — tell her why

/** Decide what a TEXT message means. `hasMedia` switches to the photo rules. */
export function decide(state: AppState, text: string, hasMedia: boolean): InboxDecision {
  const { tags, rest } = parseMessage(text);
  const clients = state.clients ?? [];

  // Resolve tags: task flag, client tags, topic tags — in her typed order.
  const isTask = tags.includes('task');
  const otherTags = tags.filter(t => t !== 'task');
  const clientMatches: Client[] = [];
  const topicTags: string[] = [];
  for (const tag of otherTags) {
    const found = matchClients(tag, clients);
    if (found.length > 1) {
      return { kind: 'ask', reply: `"#${tag}" could mean ${found.map(c => c.name).join(' or ')}. Resend with the full name, like #${norm(found[0].name)}.` };
    }
    if (found.length === 1) clientMatches.push(found[0]);
    else topicTags.push(tag);
  }
  const client = clientMatches[0];

  if (hasMedia) {
    if (!client) {
      return { kind: 'ask', reply: 'Whose photo is this? Send it again with a client tag, like #divine or #sonia.' };
    }
    return { kind: 'photo', client, caption: rest };
  }

  if (!rest && tags.length === 0) return { kind: 'ask', reply: 'The message came through empty.' };

  if (isTask) {
    if (!rest) return { kind: 'ask', reply: 'The task text was empty. Try: #task call the printer.' };
    if (clientMatches.length > 1) {
      return { kind: 'ask', reply: 'One task, one client for now. Send it once per client.' };
    }
    return client
      ? { kind: 'client-task', client, text: rest }
      : { kind: 'my-task', text: rest };
  }

  // Not a task. A topic tag names the observation bucket; a client tag alone
  // tags the observation with that client; no tags at all → AI files it.
  if (topicTags.length > 0) {
    const topic = topicTags[0].charAt(0).toUpperCase() + topicTags[0].slice(1);
    return { kind: 'observation', topic, text: rest || topic, clientId: client?.id };
  }
  if (client) {
    return { kind: 'observation', topic: client.name, text: rest || client.name, clientId: client.id };
  }
  return { kind: 'needs-ai-topic', text: rest };
}

function id(): string {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

function monthKey(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export interface Applied {
  state: AppState;
  reply: string;
}

/** A My Day task (spec 01 shape, personal). */
export function applyMyTask(state: AppState, text: string, now = new Date()): Applied {
  const task: PersonalTask = {
    id: id(), text, bucket: 'todo', taskType: 'personal', clientIds: [],
    done: false, createdAt: now.toISOString(),
  };
  return {
    state: { ...state, personalTasks: [task, ...(state.personalTasks ?? [])] },
    reply: 'Added to My Day.',
  };
}

/** A client task: agenda item on the client's dashboard for the current
 *  month + a linked My Day task, exactly like spec 01 creates them. */
export function applyClientTask(state: AppState, client: Client, text: string, now = new Date()): Applied {
  const month = monthKey(now);
  const item: AgendaItem = { id: id(), text, dueDate: '', done: false };
  const cd = state.clientData[client.id];
  if (!cd) return { state, reply: `${client.name} has no workspace data yet — added nowhere.` };
  const existing = cd.monthData?.[month] ?? { agenda: [] };
  const task: PersonalTask = {
    id: id(), text, bucket: 'todo', taskType: 'client-task', clientIds: [client.id],
    linkedAgenda: [{ clientId: client.id, month, itemId: item.id }],
    done: false, createdAt: now.toISOString(),
  };
  return {
    state: {
      ...state,
      personalTasks: [task, ...(state.personalTasks ?? [])],
      clientData: {
        ...state.clientData,
        [client.id]: {
          ...cd,
          monthData: { ...cd.monthData, [month]: { ...existing, agenda: [...existing.agenda, item] } },
        },
      },
    },
    reply: `Added to ${client.name}'s agenda.`,
  };
}

export function applyObservation(state: AppState, topic: string, text: string, clientId: string | undefined, now = new Date()): Applied {
  const o: Observation = {
    id: id(), topic, text, clientId,
    createdAt: now.toISOString(), updatedAt: now.toISOString(),
  };
  return {
    state: { ...state, observations: [o, ...(state.observations ?? [])] },
    reply: `Noted under ${topic}.`,
  };
}

const WHATSAPP_SET_NAME = 'WhatsApp';

/** A photo into the client's Asset Vault, in a "WhatsApp" set (created on
 *  first use). `url` is the already-hosted public URL of the image. */
export function applyPhoto(
  state: AppState, client: Client, url: string, sizeBytes: number, caption: string, now = new Date(),
): Applied {
  const cd = state.clientData[client.id];
  if (!cd) return { state, reply: `${client.name} has no workspace data yet — photo not filed.` };
  let set: AssetSet | undefined = (cd.assetSets ?? []).find(s => s.name === WHATSAPP_SET_NAME);
  let assetSets = cd.assetSets ?? [];
  if (!set) {
    set = { id: id(), name: WHATSAPP_SET_NAME, createdAt: now.toISOString() };
    assetSets = [...assetSets, set];
  }
  const item: AssetItem = {
    id: id(), setId: set.id, url, thumbUrl: url,
    fileName: caption || `whatsapp-${now.toISOString().slice(0, 10)}`,
    size: sizeBytes, uploadedBy: 'owner', createdAt: now.toISOString(),
  };
  return {
    state: {
      ...state,
      clientData: {
        ...state.clientData,
        [client.id]: { ...cd, assetSets, assetItems: [item, ...(cd.assetItems ?? [])] },
      },
    },
    reply: `Photo saved to ${client.name}'s assets.`,
  };
}

/** Existing observation topics, most recent first — the AI's allowed choices. */
export function existingTopics(state: AppState): string[] {
  const seen = new Set<string>();
  for (const o of state.observations ?? []) {
    if (!seen.has(o.topic)) seen.add(o.topic);
  }
  return Array.from(seen);
}
