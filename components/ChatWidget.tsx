'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle, X, ImagePlus, Send, Zap } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { decide, parseMessage, type InboxDecision } from '@/lib/whatsappInbox';
import { generateId, formatMonthKey } from '@/lib/utils';
import { AgendaItem, AssetItem, AssetSet, ChatMessage, Observation, PersonalTask } from '@/types';

// The dashboard chat (spec 18 part C, v3 brain): a floating chat on EVERY
// page, owner only. AI-FIRST since 2026-07-21 (her verdict on v2: a chat
// must understand, not keyword-match). Flow per message:
//   1. Explicit #task grammar and photo+#client stay deterministic (fast,
//      exact — hashtags are shortcuts, not requirements).
//   2. Everything else goes to /api/chat-brain: Claude reads the message
//      with her clients, topics, unposted cards, and the recent thread, and
//      returns ONE action. The widget VALIDATES every id before acting.
//   3. No key / any failure → the old hashtag rules take over, so the chat
//      degrades but never breaks.
// The thread lives in the owner-only chatLog slice (capped at 100).

const QUICK_SET_NAME = 'Quick Add';

/** Same signed-upload path the Assets tab uses. */
async function directUpload(file: Blob, ext: string): Promise<string> {
  const signRes = await fetch('/api/upload/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ext, kind: 'orig' }),
  });
  if (!signRes.ok) throw new Error('upload-permission');
  const { path, token, publicUrl } = await signRes.json();
  const { error } = await supabase.storage
    .from('assets')
    .uploadToSignedUrl(path, token, file, { contentType: file.type || undefined });
  if (error) throw new Error(error.message);
  return publicUrl as string;
}

interface BrainAnswer {
  action: 'add_my_task' | 'add_client_task' | 'add_observation' | 'file_photo' | 'mark_posted' | 'reply' | 'fallback';
  text?: string;
  clientId?: string;
  topic?: string;
  cardId?: string;
  reply?: string;
}

export default function ChatWidget() {
  // Public share pages render outside the app context — no widget there.
  const isPublic = usePathname()?.startsWith('/p/') ?? false;
  if (isPublic) return null;
  return <ChatWidgetInner />;
}

function ChatWidgetInner() {
  const { state, dispatch, role } = useApp();

  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const log = state.chatLog ?? [];

  // Keep the newest message in view.
  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [open, log.length]);

  if (role !== 'owner') return null;

  function say(who: 'me' | 'dash', msg: string, ok?: boolean) {
    const message: ChatMessage = {
      id: generateId(), who, text: msg, ok, createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_CHAT_MESSAGE', payload: { message } });
  }

  // ── The individual actions (each validates before touching state) ────────

  function doMyTask(taskText: string, reply?: string) {
    const task: PersonalTask = {
      id: generateId(), text: taskText, bucket: 'todo', taskType: 'personal',
      clientIds: [], done: false, createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_TASK', payload: { task } });
    say('dash', reply || 'Done - added to My Day.');
  }

  function doClientTask(clientId: string, taskText: string, reply?: string) {
    const client = state.clients.find(c => c.id === clientId);
    if (!client) { say('dash', 'Not done - I could not tell which client that was for.', false); return; }
    const month = formatMonthKey(new Date());
    const item: AgendaItem = { id: generateId(), text: taskText, dueDate: '', done: false };
    dispatch({ type: 'ADD_AGENDA', payload: { clientId: client.id, month, item } });
    const task: PersonalTask = {
      id: generateId(), text: taskText, bucket: 'todo', taskType: 'client-task',
      clientIds: [client.id],
      linkedAgenda: [{ clientId: client.id, month, itemId: item.id }],
      done: false, createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_TASK', payload: { task } });
    say('dash', reply || `Done - added to ${client.name}'s agenda.`);
  }

  function doObservation(topic: string, noteText: string, clientId: string | undefined, reply?: string) {
    const observation: Observation = {
      id: generateId(), topic: topic || 'Inbox', text: noteText,
      clientId: clientId && state.clients.some(c => c.id === clientId) ? clientId : undefined,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_OBSERVATION', payload: { observation } });
    say('dash', reply || `Done - noted under ${observation.topic}.`);
  }

  async function doPhoto(clientId: string, file: File, caption: string, reply?: string) {
    const client = state.clients.find(c => c.id === clientId);
    if (!client) { say('dash', 'Not done - whose photo is this? Tell me the client.', false); return; }
    const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    let url: string;
    try {
      url = await directUpload(file, ext);
    } catch {
      say('dash', 'Not done - the photo could not be uploaded. Try again.', false);
      return;
    }
    const cd = state.clientData[client.id];
    let set: AssetSet | undefined = (cd?.assetSets ?? []).find(s => s.name === QUICK_SET_NAME);
    if (!set) {
      set = { id: generateId(), name: QUICK_SET_NAME, createdAt: new Date().toISOString() };
      dispatch({ type: 'ADD_ASSET_SET', payload: { clientId: client.id, set } });
    }
    const item: AssetItem = {
      id: generateId(), setId: set.id, url, thumbUrl: url,
      fileName: caption || file.name, size: file.size,
      uploadedBy: 'owner', createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_ASSET_ITEM', payload: { clientId: client.id, item } });
    say('dash', reply || `Done - photo saved to ${client.name}'s assets.`);
  }

  function doMarkPosted(clientId: string, cardId: string, reply?: string) {
    const client = state.clients.find(c => c.id === clientId);
    const card = (state.clientData[clientId]?.contentCards ?? []).find(c => c.id === cardId);
    if (!client || !card) {
      say('dash', 'Not done - I could not find that post on the board. Which card is it?', false);
      return;
    }
    if (card.stage === 'posted') {
      say('dash', `"${card.title || card.hook}" is already marked posted on ${client.name}'s board.`);
      return;
    }
    dispatch({ type: 'MOVE_CONTENT_CARD', payload: { clientId, cardId, stage: 'posted' } });
    say('dash', reply || `Done - marked "${card.title || card.hook}" as posted on ${client.name}'s board.`);
  }

  /** The old deterministic behavior — used for explicit #task grammar,
   *  photo + explicit client tag, and as the safety net when the brain is
   *  unavailable. */
  async function legacyApply(d: InboxDecision, raw: string, sentPhoto: File | null) {
    if (d.kind === 'ask') { say('dash', `Not done - ${d.reply}`, false); return; }
    if (d.kind === 'photo') { await doPhoto(d.client.id, sentPhoto!, d.caption); return; }
    if (d.kind === 'my-task') { doMyTask(d.text); return; }
    if (d.kind === 'client-task') { doClientTask(d.client.id, d.text); return; }
    if (d.kind === 'observation') { doObservation(d.topic, d.text, d.clientId); return; }
    // needs-ai-topic → the small topic picker (also keyless-safe: "Inbox").
    const seen = new Set<string>();
    (state.observations ?? []).forEach(o => seen.add(o.topic));
    const res = await fetch('/api/inbox-topic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: d.text, topics: Array.from(seen) }),
    }).then(r => (r.ok ? r.json() : null)).catch(() => null);
    const topic = res?.topic || 'Inbox';
    doObservation(topic, d.text, undefined, topic === 'Inbox'
      ? 'Done - noted under Inbox. Tag it with a topic later.'
      : `Done - noted under ${topic}.`);
  }

  async function send() {
    if (busy) return;
    const raw = text.trim();
    if (!raw && !photo) return;
    setBusy(true);

    const recentBefore = log.slice(-8).map(m => ({ who: m.who, text: m.text }));
    say('me', photo ? `${raw || '(photo)'} 📷` : raw);
    const sentPhoto = photo;
    setText('');
    setPhoto(null);
    if (fileRef.current) fileRef.current.value = '';

    try {
      const d = decide(state, raw, !!sentPhoto);
      const { tags } = parseMessage(raw);

      // Deterministic shortcuts: explicit #task grammar, and a photo whose
      // caption already names the client. Exact, instant, no AI needed.
      if (tags.includes('task') || (sentPhoto && d.kind === 'photo')) {
        await legacyApply(d, raw, sentPhoto);
        return;
      }

      // Everything else: the brain reads it with full context.
      const topics: string[] = [];
      const seenTopics = new Set<string>();
      (state.observations ?? []).forEach(o => {
        if (!seenTopics.has(o.topic)) { seenTopics.add(o.topic); topics.push(o.topic); }
      });
      const cards: { clientId: string; cardId: string; title: string; stage: string }[] = [];
      for (const c of state.clients) {
        for (const card of state.clientData[c.id]?.contentCards ?? []) {
          if (card.stage === 'posted') continue;
          cards.push({
            clientId: c.id, cardId: card.id,
            title: (card.title || card.hook || '').slice(0, 60), stage: card.stage,
          });
          if (cards.length >= 80) break;
        }
        if (cards.length >= 80) break;
      }

      const brain: BrainAnswer | null = await fetch('/api/chat-brain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: raw,
          hasPhoto: !!sentPhoto,
          clients: state.clients.map(c => ({ id: c.id, name: c.name })),
          topics,
          cards,
          recent: recentBefore,
        }),
      }).then(r => (r.ok ? r.json() : null)).catch(() => null);

      if (!brain || brain.action === 'fallback') {
        await legacyApply(d, raw, sentPhoto);
        return;
      }

      switch (brain.action) {
        case 'add_my_task':
          doMyTask(brain.text || raw, brain.reply);
          break;
        case 'add_client_task':
          doClientTask(brain.clientId ?? '', brain.text || raw, brain.reply);
          break;
        case 'add_observation':
          doObservation(brain.topic || 'Inbox', brain.text || raw, brain.clientId, brain.reply);
          break;
        case 'file_photo':
          if (sentPhoto) await doPhoto(brain.clientId ?? '', sentPhoto, raw, brain.reply);
          else say('dash', brain.reply || 'There was no photo attached.', false);
          break;
        case 'mark_posted':
          doMarkPosted(brain.clientId ?? '', brain.cardId ?? '', brain.reply);
          break;
        default:
          say('dash', brain.reply || 'Tell me a bit more.');
      }
    } catch {
      say('dash', 'Not done - something went wrong. Try again.', false);
    } finally {
      setBusy(false);
      boxRef.current?.focus();
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-stone-900 text-white shadow-xl hover:bg-stone-700 transition-colors flex items-center justify-center"
        title="Dashboard chat"
      >
        <MessageCircle size={24} />
      </button>
    );
  }

  return (
    <div className="fixed z-50 bg-white flex flex-col overflow-hidden inset-0 md:inset-auto md:bottom-5 md:right-5 md:w-[380px] md:h-[600px] md:max-h-[80vh] md:rounded-2xl md:border md:border-stone-200 md:shadow-2xl">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 bg-stone-900 text-white shrink-0">
        <span className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
          <Zap size={15} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">Dashboard</p>
          <p className="text-[11px] text-white/50 leading-tight">Tell me, I handle it</p>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          title="Close"
        >
          <X size={18} />
        </button>
      </div>

      {/* Thread */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-stone-50">
        {log.length === 0 && (
          <div className="text-xs text-stone-400 bg-white border border-stone-200 rounded-xl px-3 py-2.5 leading-relaxed">
            Just talk to me:<br />
            <span className="text-stone-600">note under Shivansh - no systems in his business</span><br />
            <span className="text-stone-600">careerbubble's new post is live</span><br />
            <span className="text-stone-600">remind me to call the printer</span><br />
            <span className="text-stone-600">a photo + whose it is</span><br />
            I file it, update the board, and answer back.
          </div>
        )}
        {log.map(m => (
          <div key={m.id} className={`flex ${m.who === 'me' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] px-3 py-2 text-sm whitespace-pre-wrap break-words rounded-2xl ${
                m.who === 'me'
                  ? 'bg-stone-900 text-white rounded-br-md'
                  : m.ok === false
                    ? 'bg-amber-50 text-amber-900 border border-amber-200 rounded-bl-md'
                    : 'bg-white text-stone-800 border border-stone-200 rounded-bl-md'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="px-3 py-2 text-sm text-stone-400 bg-white border border-stone-200 rounded-2xl rounded-bl-md">
              ...
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-stone-200 bg-white px-3 py-2.5 space-y-2">
        {photo && (
          <div className="flex items-center gap-2 text-xs text-stone-600 bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5">
            <ImagePlus size={13} className="shrink-0 text-stone-400" />
            <span className="truncate flex-1">{photo.name}</span>
            <button
              onClick={() => { setPhoto(null); if (fileRef.current) fileRef.current.value = ''; }}
              className="p-0.5 rounded text-stone-400 hover:text-stone-700"
              title="Remove photo"
            >
              <X size={13} />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => setPhoto(e.target.files?.[0] ?? null)}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="p-2.5 rounded-xl border border-stone-200 text-stone-500 hover:border-stone-400 hover:text-stone-700 transition-colors shrink-0"
            title="Attach a photo"
          >
            <ImagePlus size={17} />
          </button>
          <textarea
            ref={boxRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder={photo ? 'Whose photo is it?' : 'Type here...'}
            rows={1}
            className="flex-1 px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent resize-none"
          />
          <button
            onClick={send}
            disabled={busy || (!text.trim() && !photo)}
            className="p-2.5 rounded-xl bg-stone-900 text-white hover:bg-stone-700 disabled:opacity-40 transition-colors shrink-0"
            title="Send"
          >
            <Send size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
