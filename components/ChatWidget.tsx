'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle, X, ImagePlus, Send, Zap } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { decide } from '@/lib/whatsappInbox';
import { generateId, formatMonthKey } from '@/lib/utils';
import { AgendaItem, AssetItem, AssetSet, ChatMessage, Observation, PersonalTask } from '@/types';

// The dashboard chat (spec 18 part C): a floating chat on EVERY page, owner
// only. She talks, it files, it answers in the thread — "Done — added to My
// Day." or "Not done — whose photo is this?". Routing is the same brain the
// WhatsApp pipe uses (lib/whatsappInbox): #task → My Day, #client #task →
// client agenda, #word → observation topic, photo + client tag → client
// assets, plain text → AI-picked topic via /api/inbox-topic. The thread
// itself is stored in the chatLog slice (owner-only, capped at 100).

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

  async function send() {
    if (busy) return;
    const raw = text.trim();
    if (!raw && !photo) return;
    setBusy(true);

    say('me', photo ? `${raw || '(photo)'} 📷` : raw);
    const sentPhoto = photo;
    setText('');
    setPhoto(null);
    if (fileRef.current) fileRef.current.value = '';

    try {
      const d = decide(state, raw, !!sentPhoto);

      if (d.kind === 'ask') {
        say('dash', `Not done — ${d.reply}`, false);
        return;
      }

      if (d.kind === 'photo') {
        const ext = (sentPhoto!.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        let url: string;
        try {
          url = await directUpload(sentPhoto!, ext);
        } catch {
          say('dash', 'Not done — the photo could not be uploaded. Try again.', false);
          return;
        }
        const cd = state.clientData[d.client.id];
        let set: AssetSet | undefined = (cd?.assetSets ?? []).find(s => s.name === QUICK_SET_NAME);
        if (!set) {
          set = { id: generateId(), name: QUICK_SET_NAME, createdAt: new Date().toISOString() };
          dispatch({ type: 'ADD_ASSET_SET', payload: { clientId: d.client.id, set } });
        }
        const item: AssetItem = {
          id: generateId(), setId: set.id, url, thumbUrl: url,
          fileName: d.caption || sentPhoto!.name, size: sentPhoto!.size,
          uploadedBy: 'owner', createdAt: new Date().toISOString(),
        };
        dispatch({ type: 'ADD_ASSET_ITEM', payload: { clientId: d.client.id, item } });
        say('dash', `Done — photo saved to ${d.client.name}'s assets.`);
        return;
      }

      if (d.kind === 'my-task') {
        const task: PersonalTask = {
          id: generateId(), text: d.text, bucket: 'todo', taskType: 'personal',
          clientIds: [], done: false, createdAt: new Date().toISOString(),
        };
        dispatch({ type: 'ADD_TASK', payload: { task } });
        say('dash', 'Done — added to My Day.');
        return;
      }

      if (d.kind === 'client-task') {
        const month = formatMonthKey(new Date());
        const item: AgendaItem = { id: generateId(), text: d.text, dueDate: '', done: false };
        dispatch({ type: 'ADD_AGENDA', payload: { clientId: d.client.id, month, item } });
        const task: PersonalTask = {
          id: generateId(), text: d.text, bucket: 'todo', taskType: 'client-task',
          clientIds: [d.client.id],
          linkedAgenda: [{ clientId: d.client.id, month, itemId: item.id }],
          done: false, createdAt: new Date().toISOString(),
        };
        dispatch({ type: 'ADD_TASK', payload: { task } });
        say('dash', `Done — added to ${d.client.name}'s agenda.`);
        return;
      }

      // Observation — her tag names the topic, or AI files untagged text.
      let topic = '';
      let clientId: string | undefined;
      let noteText = raw;
      if (d.kind === 'observation') {
        topic = d.topic;
        clientId = d.clientId;
        noteText = d.text;
      } else {
        const seen = new Set<string>();
        (state.observations ?? []).forEach(o => seen.add(o.topic));
        const res = await fetch('/api/inbox-topic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: d.text, topics: Array.from(seen) }),
        }).then(r => (r.ok ? r.json() : null)).catch(() => null);
        topic = res?.topic || 'Inbox';
        noteText = d.text;
      }
      const observation: Observation = {
        id: generateId(), topic, text: noteText, clientId,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      dispatch({ type: 'ADD_OBSERVATION', payload: { observation } });
      say('dash', topic === 'Inbox'
        ? 'Done — noted under Inbox. Tag it with a topic later.'
        : `Done — noted under ${topic}.`);
    } catch {
      say('dash', 'Not done — something went wrong. Try again.', false);
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
          <p className="text-[11px] text-white/50 leading-tight">Tell me, I file it</p>
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
            Talk to me like a chat:<br />
            <span className="text-stone-600">#task call the printer</span> → My Day<br />
            <span className="text-stone-600">#divine #task fix the reel</span> → their agenda<br />
            <span className="text-stone-600">#reels a thought</span> → your Observations<br />
            a photo + <span className="text-stone-600">#divine</span> → their assets<br />
            Plain text files itself.
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
            placeholder={photo ? 'Whose photo? e.g. #divine' : 'Type here...'}
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
