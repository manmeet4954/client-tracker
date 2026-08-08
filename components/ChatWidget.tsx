'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle, X, ImagePlus, Send, Zap } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { decide, parseMessage, type InboxDecision } from '@/lib/whatsappInbox';
import { generateId, formatMonthKey } from '@/lib/utils';
import { AgendaItem, AssetItem, AssetSet, ChatMessage, ContentCard, ContentStage, Observation, PersonalTask } from '@/types';

// The dashboard chat (spec 18 part C, v4 brain): a floating chat on EVERY
// page, owner only. AI-FIRST since 2026-07-21 (her verdict on v2: a chat
// must understand, not keyword-match). Flow per message:
//   1. Explicit #task grammar and photo+#client stay deterministic (fast,
//      exact — hashtags are shortcuts, not requirements).
//   2. Everything else goes to /api/chat-brain: Claude reads the message
//      with her clients, topics, unposted cards, and the recent thread, and
//      returns a LIST of actions (v4, her 07-22 feedback: do the whole list
//      in one message, create real content cards, act instead of asking).
//      The widget VALIDATES every id, executes each action, and posts one
//      clean confirmation.
//   3. No key / any failure → the old hashtag rules take over, so the chat
//      degrades but never breaks.
// The thread lives in the owner-only chatLog slice (capped at 100).

const QUICK_SET_NAME = 'Quick Add';

// One executed action's outcome. `line` is a short fragment for the ok case
// (composed into a "Done" bubble) or a full "Not done - ..." sentence.
type ActionResult = { ok: boolean; line: string };

const STAGE_IDS: ContentStage[] = ['idea', 'writing', 'ready', 'scheduled', 'posted'];
function normStage(s?: string): ContentStage {
  const v = (s ?? '').toLowerCase();
  if (v === 'making') return 'writing'; // her label for the 'writing' stage
  return (STAGE_IDS as string[]).includes(v) ? (v as ContentStage) : 'idea';
}

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

interface BrainAction {
  type: 'add_card' | 'add_client_task' | 'add_my_task' | 'add_observation' | 'mark_posted' | 'file_photo';
  text?: string;
  clientId?: string;
  topic?: string;
  cardId?: string;
  contentType?: string;
  stage?: string;
}

interface BrainAnswer {
  fallback?: boolean;
  actions?: BrainAction[];
  reply?: string;
}

/** What `/api/desk-chat` answers (spec 30). `did` is what actually landed. */
interface DeskAnswer {
  /** True when the desk cannot run at all, e.g. no key. The old rules take over. */
  fallback?: boolean;
  reply?: string;
  did?: string[];
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

  // ── The individual actions (each validates, then returns a result line) ──

  function doMyTask(taskText: string): ActionResult {
    const clean = taskText.trim();
    if (!clean) return { ok: false, line: 'Not done - I did not catch what the task was.' };
    const task: PersonalTask = {
      id: generateId(), text: clean, bucket: 'todo', taskType: 'personal',
      clientIds: [], done: false, createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_TASK', payload: { task } });
    return { ok: true, line: `"${clean}" added to My Day` };
  }

  function doClientTask(clientId: string, taskText: string): ActionResult {
    const client = state.clients.find(c => c.id === clientId);
    if (!client) return { ok: false, line: `Not done - I could not tell which client "${taskText}" is for.` };
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
    return { ok: true, line: `"${taskText}" added to ${client.name}'s agenda` };
  }

  function doAddCard(clientId: string, title: string, contentType: string | undefined, stage: string | undefined): ActionResult {
    const client = state.clients.find(c => c.id === clientId);
    const name = (title || '').trim() || 'Untitled';
    if (!client) return { ok: false, line: `Not done - I could not tell which client the "${name}" card is for.` };
    const now = new Date().toISOString();
    const platforms = state.clientData[client.id]?.platforms ?? [];
    const type = (contentType || '').trim();
    const card: ContentCard = {
      id: generateId(), pillarId: '', title: name, hook: '', content: '', link: '',
      stage: normStage(stage), contentType: type, role: '',
      platform: platforms.length > 1 ? platforms[0] : undefined,
      scheduledDate: '', postUrl: '', notes: '', customValues: {},
      createdMonth: formatMonthKey(new Date()), createdAt: now, updatedAt: now,
    };
    dispatch({ type: 'ADD_CONTENT_CARD', payload: { clientId: client.id, card } });
    const label = type ? `${type} "${name}"` : `"${name}"`;
    return { ok: true, line: `${label} added to ${client.name}'s board` };
  }

  function doObservation(topic: string, noteText: string, clientId: string | undefined): ActionResult {
    const observation: Observation = {
      id: generateId(), topic: topic || 'Inbox', text: noteText,
      clientId: clientId && state.clients.some(c => c.id === clientId) ? clientId : undefined,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_OBSERVATION', payload: { observation } });
    return { ok: true, line: `noted under ${observation.topic}` };
  }

  async function doPhoto(clientId: string, file: File, caption: string): Promise<ActionResult> {
    const client = state.clients.find(c => c.id === clientId);
    if (!client) return { ok: false, line: 'Not done - whose photo is this? Tell me the client.' };
    const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    let url: string;
    try {
      url = await directUpload(file, ext);
    } catch {
      return { ok: false, line: 'Not done - the photo could not be uploaded. Try again.' };
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
    return { ok: true, line: `photo saved to ${client.name}'s assets` };
  }

  function doMarkPosted(clientId: string, cardId: string): ActionResult {
    const client = state.clients.find(c => c.id === clientId);
    const card = (state.clientData[clientId]?.contentCards ?? []).find(c => c.id === cardId);
    if (!client || !card) {
      return { ok: false, line: 'Not done - I could not find that post on the board. Which card is it?' };
    }
    const cardName = card.title || card.hook || 'that post';
    if (card.stage === 'posted') {
      return { ok: true, line: `"${cardName}" was already posted on ${client.name}'s board` };
    }
    dispatch({ type: 'MOVE_CONTENT_CARD', payload: { clientId, cardId, stage: 'posted' } });
    return { ok: true, line: `"${cardName}" marked posted on ${client.name}'s board` };
  }

  /** Turn a batch of executed actions into chat bubbles: one "Done" bubble
   *  summarising what landed, plus an amber bubble for anything that didn't. */
  function emit(results: ActionResult[]) {
    const ok = results.filter(r => r.ok).map(r => r.line);
    const bad = results.filter(r => !r.ok).map(r => r.line);
    if (ok.length === 1) say('dash', `Done - ${ok[0]}.`);
    else if (ok.length > 1) say('dash', `Done:\n${ok.map(l => `• ${l}`).join('\n')}`);
    if (bad.length) say('dash', bad.join('\n'), false);
    return { ok: ok.length, bad: bad.length };
  }

  /** The old deterministic behavior — used for explicit #task grammar,
   *  photo + explicit client tag, and as the safety net when the brain is
   *  unavailable. */
  async function legacyApply(d: InboxDecision, raw: string, sentPhoto: File | null) {
    if (d.kind === 'ask') { say('dash', `Not done - ${d.reply}`, false); return; }
    if (d.kind === 'photo') { emit([await doPhoto(d.client.id, sentPhoto!, d.caption)]); return; }
    if (d.kind === 'my-task') { emit([doMyTask(d.text)]); return; }
    if (d.kind === 'client-task') { emit([doClientTask(d.client.id, d.text)]); return; }
    if (d.kind === 'observation') { emit([doObservation(d.topic, d.text, d.clientId)]); return; }
    // needs-ai-topic → the small topic picker (also keyless-safe: "Inbox").
    const seen = new Set<string>();
    (state.observations ?? []).forEach(o => seen.add(o.topic));
    const res = await fetch('/api/inbox-topic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: d.text, topics: Array.from(seen) }),
    }).then(r => (r.ok ? r.json() : null)).catch(() => null);
    const topic = res?.topic || 'Inbox';
    const r = doObservation(topic, d.text, undefined);
    say('dash', topic === 'Inbox'
      ? 'Done - noted under Inbox. Tag it with a topic later.'
      : `Done - ${r.line}.`);
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

      // Everything else goes to the DESK, spec 30: a tool loop that looks things
      // up and does them server side, through the ordinary write door. It reads
      // her real data itself, so nothing about her state is packed up and sent.
      //
      // The old brain below is kept as the fallback, unchanged. If the desk is
      // unreachable or its key is missing, the chat still works exactly as it
      // did yesterday rather than going dead.
      if (!sentPhoto) {
        const desk: DeskAnswer | null = await fetch('/api/desk-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: raw,
            recent: recentBefore,
            today: new Date().toISOString().slice(0, 10),
          }),
        }).then(r => (r.ok ? r.json() : null)).catch(() => null);

        if (desk?.reply && !desk.fallback) {
          // It wrote to the stored state directly, so the tab has to catch up.
          // Reading it back is also the honest confirmation: what she sees next
          // is what actually landed, not what the chat believes it did.
          if (desk.did?.length) {
            const fresh = await fetch('/api/state')
              .then(r => (r.ok ? r.json() : null)).catch(() => null);
            if (fresh?.state) dispatch({ type: 'LOAD', payload: fresh.state });
          }
          say('dash', desk.reply);
          return;
        }
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

      if (!brain || brain.fallback) {
        await legacyApply(d, raw, sentPhoto);
        return;
      }

      // Execute every action the brain returned, in order.
      const actions = Array.isArray(brain.actions) ? brain.actions : [];
      let photoUsed = false;
      const results: ActionResult[] = [];
      for (const a of actions) {
        switch (a.type) {
          case 'add_card':
            results.push(doAddCard(a.clientId ?? '', a.text || raw, a.contentType, a.stage));
            break;
          case 'add_client_task':
            results.push(doClientTask(a.clientId ?? '', a.text || raw));
            break;
          case 'add_my_task':
            results.push(doMyTask(a.text || raw));
            break;
          case 'add_observation':
            results.push(doObservation(a.topic || 'Inbox', a.text || raw, a.clientId));
            break;
          case 'mark_posted':
            results.push(doMarkPosted(a.clientId ?? '', a.cardId ?? ''));
            break;
          case 'file_photo':
            if (sentPhoto && !photoUsed) { results.push(await doPhoto(a.clientId ?? '', sentPhoto, raw)); photoUsed = true; }
            else if (!sentPhoto) results.push({ ok: false, line: 'Not done - there was no photo attached.' });
            break;
        }
      }

      const counts = results.length ? emit(results) : { ok: 0, bad: 0 };
      const replyText = (brain.reply || '').trim();
      // Speak the reply when it is a real question/answer: always if nothing
      // was done, otherwise only when it is a follow-up question.
      if (replyText && (results.length === 0 || replyText.endsWith('?'))) {
        say('dash', replyText, counts.bad ? false : undefined);
      } else if (results.length === 0 && !replyText) {
        say('dash', 'Tell me a bit more.');
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
