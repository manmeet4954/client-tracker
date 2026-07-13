'use client';

import { useState } from 'react';
import { Copy, Check, Users, Share2, Trash2 } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import {
  ContentPillar, ContentCard, ContentStage, CONTENT_STAGES,
  DEFAULT_CONTENT_TYPES, CustomFieldDef,
} from '@/types';
import Modal from './Modal';

/** Hand-off copy: title + hook lead, content is the star, link closes. */
export function formatForCopy(card: ContentCard): string {
  const parts = [];
  if (card.title.trim()) parts.push(card.title.trim());
  if (card.hook.trim()) parts.push(card.hook.trim());
  const head = parts.join('\n');
  const link = card.link?.trim() ?? '';
  let out = card.content.trim() ? (head ? `${head}\n\n${card.content.trim()}` : card.content.trim()) : head;
  if (link) out = out ? `${out}\n\n${link}` : link;
  return out;
}

// ── Card editor ──────────────────────────────────────────────────────────────
// The one post editor, shared by the Content tab and My Day's content flow.

export default function CardEditor({ card, pillars, customFields, platforms, sourceClientId, onClose, onSave, onDelete }: {
  card: ContentCard;
  pillars: ContentPillar[];
  customFields: CustomFieldDef[];
  platforms: string[];
  sourceClientId: string;
  onClose: () => void;
  onSave: (card: ContentCard) => void;
  onDelete?: () => void;
}) {
  const { state, role, dispatch } = useApp();
  const [draft, setDraft] = useState<ContentCard>({ ...card, link: card.link ?? '' });
  const [copied, setCopied] = useState(false);
  const [shareClientId, setShareClientId] = useState('');
  const [sharePillarId, setSharePillarId] = useState('');
  const multiPlatform = platforms.length > 1;

  const set = (patch: Partial<ContentCard>) => setDraft(d => ({ ...d, ...patch }));

  const liveCard = (state.clientData[sourceClientId]?.contentCards ?? []).find(c => c.id === card.id);
  const collabWith = liveCard?.collabWith ?? card.collabWith ?? [];

  const otherClients = state.clients
    .filter(c => c.id !== sourceClientId)
    .map(c => ({ id: c.id, name: c.name, pillars: state.clientData[c.id]?.pillars ?? [] }));
  const shareTarget = otherClients.find(c => c.id === shareClientId);

  function trimmed(): ContentCard {
    return { ...draft, title: draft.title.trim(), hook: draft.hook.trim(), link: draft.link?.trim(), postUrl: draft.postUrl.trim() };
  }

  function copyAll() {
    const text = formatForCopy(draft);
    if (text) navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }

  function sendToAccount() {
    if (!shareTarget || !sharePillarId) return;
    dispatch({
      type: 'SHARE_CONTENT_CARD',
      payload: { sourceClientId, sourceCard: trimmed(), targetClientId: shareTarget.id, targetPillarId: sharePillarId },
    });
    setShareClientId('');
    setSharePillarId('');
  }

  return (
    <Modal open onClose={onClose} title={onDelete ? 'Edit Post' : 'New Post'} size="lg">
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Pillar</label>
            <select value={draft.pillarId} onChange={e => set({ pillarId: e.target.value })} className="input-base w-full">
              <option value="">Unsorted</option>
              {pillars.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="min-w-[130px]">
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Stage</label>
            <select value={draft.stage} onChange={e => set({ stage: e.target.value as ContentStage })} className="input-base w-full">
              {CONTENT_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          {multiPlatform && (
            <div className="min-w-[130px]">
              <label className="block text-xs font-medium text-stone-500 mb-1.5">Platform</label>
              <select value={draft.platform ?? ''} onChange={e => set({ platform: e.target.value })} className="input-base w-full">
                {platforms.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Title / topic</label>
          <input autoFocus value={draft.title} onChange={e => set({ title: e.target.value })}
            placeholder="e.g. 3 resume mistakes that cost you interviews" className="input-base w-full" />
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Hook (first line)</label>
          <input value={draft.hook} onChange={e => set({ hook: e.target.value })}
            placeholder="The scroll-stopping opening line..." className="input-base w-full" />
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Content</label>
          <textarea value={draft.content} onChange={e => set({ content: e.target.value })}
            placeholder="Write the full post here — caption, script, or carousel copy."
            rows={8} className="input-base w-full resize-y font-mono text-[13px] leading-relaxed" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Reference link (doc, Canva, reel)</label>
            <input value={draft.link ?? ''} onChange={e => set({ link: e.target.value })}
              placeholder="Paste a link" className="input-base w-full" inputMode="url" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Live post link (after posting)</label>
            <input value={draft.postUrl} onChange={e => set({ postUrl: e.target.value })}
              placeholder="https://instagram.com/p/..." className="input-base w-full" inputMode="url" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Content type</label>
            <select value={draft.contentType} onChange={e => set({ contentType: e.target.value })} className="input-base w-full">
              <option value="">Select type</option>
              {Array.from(new Set([...DEFAULT_CONTENT_TYPES, draft.contentType])).filter(Boolean).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Go-live date</label>
            <input type="date" value={draft.scheduledDate} onChange={e => set({ scheduledDate: e.target.value })} className="input-base w-full" />
          </div>
        </div>

        {customFields.map(field => (
          <div key={field.id}>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">{field.name}</label>
            {field.type === 'single' ? (
              <select value={(draft.customValues[field.id] as string) ?? ''}
                onChange={e => set({ customValues: { ...draft.customValues, [field.id]: e.target.value } })} className="input-base w-full">
                <option value="">Select...</option>
                {field.options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <div className="flex flex-wrap gap-2">
                {field.options.map(o => {
                  const vals = (draft.customValues[field.id] as string[]) ?? [];
                  const sel = vals.includes(o);
                  return (
                    <button key={o} type="button"
                      onClick={() => set({ customValues: { ...draft.customValues, [field.id]: sel ? vals.filter(v => v !== o) : [...vals, o] } })}
                      className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${sel ? 'bg-accent text-white border-accent' : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'}`}>
                      {o}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Notes</label>
          <textarea value={draft.notes} onChange={e => set({ notes: e.target.value })}
            placeholder="Anything else..." rows={2} className="input-base w-full resize-none" />
        </div>

        {role === 'owner' && otherClients.length > 0 && (
          <div className="border-t border-stone-100 pt-4">
            <label className="flex items-center gap-1.5 text-xs font-medium text-stone-500 mb-2">
              <Share2 size={13} /> Collaborate — also post on another account
            </label>
            {collabWith.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {collabWith.map(p => (
                  <span key={p.clientId} className="inline-flex items-center gap-1 text-[11px] text-violet-700 bg-violet-50 rounded-full px-2 py-0.5">
                    <Users size={11} /> {p.clientName}
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-end gap-2">
              <select value={shareClientId}
                onChange={e => {
                  const id = e.target.value;
                  setShareClientId(id);
                  setSharePillarId(otherClients.find(c => c.id === id)?.pillars[0]?.id ?? '');
                }}
                className="input-base flex-1 min-w-[140px]">
                <option value="">Choose account…</option>
                {otherClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={sharePillarId} onChange={e => setSharePillarId(e.target.value)}
                disabled={!shareTarget || shareTarget.pillars.length === 0}
                className="input-base flex-1 min-w-[140px] disabled:opacity-50">
                <option value="">{shareTarget ? 'Choose bucket…' : 'Bucket'}</option>
                {shareTarget?.pillars.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button onClick={sendToAccount} disabled={!shareTarget || !sharePillarId}
                className="btn-secondary flex items-center gap-1.5 disabled:opacity-40">
                <Share2 size={14} /> Send
              </button>
            </div>
            {shareTarget && shareTarget.pillars.length === 0 && (
              <p className="text-[11px] text-amber-600 mt-1.5">{shareTarget.name} has no pillars yet. Add one on their board first.</p>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button onClick={copyAll} className="btn-secondary flex items-center gap-1.5">
            {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy for hand-off'}
          </button>
          {onDelete && (
            <button onClick={() => { if (confirm('Delete this post?')) onDelete(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 size={14} /> Delete
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button onClick={() => onSave(trimmed())} className="btn-primary">Save</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
