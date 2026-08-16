'use client';

// Adding a piece to the board — 2026-08-11.
//
// FIRST BUILD, that morning: a title, a pillar and a format, inline in the
// column. Her pick when I asked, and correct as far as it went.
//
// REBUILT the same day, when she saw it beside what she used to have: "we had a
// proper card system which used to open up whenever I added a post, which was
// categorised on the basis of the content pillar, the topic, the day we are
// posting it, the link of the post, everything... it also had this much space
// to paste the content as well, like the draft given by the client."
//
// She is right, and the inline row was the wrong shape for the job. Adding a
// post is not a one-field action: it is the moment the whole piece gets its
// facts, and the client's draft usually arrives in the same breath. A row three
// fields wide cannot hold a pasted carousel script, so it silently taught her
// to add a title now and fill the rest later, which is how a board fills up
// with cards nobody can act on.
//
// So it opens. Everything a piece carries at birth is here, and nothing is
// required except the name:
//   what it is (title) · pillar · format · the day it goes out · the link ·
//   the draft itself, with room to paste · a note to self
//
// It writes the SAME ContentCard the chat and the old form write, through the
// same ADD_CONTENT_CARD action. No new storage, no new shape, nothing about a
// piece added here is a special case anywhere downstream.

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import Modal from '@/components/Modal';
import { generateId, formatMonthKey } from '@/lib/utils';
import { DEFAULT_CONTENT_TYPES, type ContentCard, type ContentStage } from '@/types';

const LABEL = 'block text-[11.5px] font-bold uppercase tracking-[.08em] text-faint';
const FIELD =
  'mt-1 w-full rounded-xl border border-[rgba(23,21,26,.12)] bg-white px-3 py-2.5 text-[14px] text-text placeholder:text-faint focus:border-accent focus:outline-none';

export default function AddEntry({ profileId, stage, month, compact }: {
  profileId: string;
  /** The column it lands in. */
  stage: ContentStage;
  /** The month on the table, so a piece added in June is filed under June. */
  month: string;
  /** Column buttons are small; the one under the board is full width. */
  compact?: boolean;
}) {
  const { state, dispatch } = useApp();
  const { data } = useClient(profileId);
  const [open, setOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [pillarId, setPillarId] = useState('');
  const [contentType, setContentType] = useState('');
  const [topicId, setTopicId] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [link, setLink] = useState('');
  const [content, setContent] = useState('');
  const [notes, setNotes] = useState('');

  const pillars = data.pillars ?? [];
  const topics = data.topics ?? [];
  // Formats already used on this board, plus the defaults, so a format she
  // invented once is offered again rather than retyped.
  const used = (data.contentCards ?? [])
    .map(c => c.contentType)
    .filter((t): t is string => !!t && !DEFAULT_CONTENT_TYPES.includes(t));
  const types = [...DEFAULT_CONTENT_TYPES, ...new Set(used)];

  function reset() {
    setTitle(''); setPillarId(''); setContentType(''); setTopicId('');
    setScheduledDate(''); setLink(''); setContent(''); setNotes('');
  }

  function add() {
    const name = title.trim();
    if (!name) return;
    const now = new Date().toISOString();
    const platforms = state.clientData[profileId]?.platforms ?? [];
    const card: ContentCard = {
      id: generateId(),
      pillarId,
      title: name,
      hook: '',
      content: content.trim(),
      link: link.trim(),
      stage,
      contentType,
      role: '',
      platform: platforms.length > 1 ? platforms[0] : undefined,
      scheduledDate: scheduledDate.trim(),
      postUrl: '',
      notes: notes.trim(),
      customValues: {},
      // The month on the table when no date is given, not today's: adding to
      // June while reading June must stay in June. A DATE wins over both,
      // because a piece dated 3 September belongs to September.
      createdMonth: scheduledDate.trim()
        ? scheduledDate.slice(0, 7)
        : (/^\d{4}-\d{2}$/.test(month) ? month : formatMonthKey(new Date())),
      topicId: topicId || undefined,
      createdAt: now,
      updatedAt: now,
    };
    dispatch({ type: 'ADD_CONTENT_CARD', payload: { clientId: profileId, card } });
    reset();
    setOpen(false);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className={`flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[rgba(23,21,26,.2)] font-semibold text-muted hover:border-[rgba(234,71,17,.4)] hover:text-text ${
          compact ? 'py-2 text-[12px]' : 'py-2.5 text-[13px]'
        }`}>
        <Plus size={compact ? 14 : 15} strokeWidth={2.3} />
        Add
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Add a post" size="lg">
        <div className="space-y-3.5">
          <div>
            <label className={LABEL} htmlFor="add-title">What is it</label>
            <input id="add-title" autoFocus value={title} onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) add(); }}
              placeholder="Working title" className={FIELD} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={LABEL} htmlFor="add-pillar">Pillar</label>
              <select id="add-pillar" value={pillarId} onChange={e => setPillarId(e.target.value)} className={FIELD}>
                <option value="">Not sorted yet</option>
                {pillars.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="add-format">Format</label>
              <select id="add-format" value={contentType} onChange={e => setContentType(e.target.value)} className={FIELD}>
                <option value="">Not decided</option>
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={LABEL} htmlFor="add-date">Going out on</label>
              <input id="add-date" type="date" value={scheduledDate}
                onChange={e => setScheduledDate(e.target.value)} className={FIELD} />
            </div>
            {topics.length > 0 && (
              <div>
                <label className={LABEL} htmlFor="add-topic">Topic</label>
                <select id="add-topic" value={topicId} onChange={e => setTopicId(e.target.value)} className={FIELD}>
                  <option value="">None</option>
                  {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className={LABEL} htmlFor="add-link">Link</label>
            <input id="add-link" value={link} onChange={e => setLink(e.target.value)}
              placeholder="Canva, a doc, a reference" className={FIELD} />
          </div>

          <div>
            <label className={LABEL} htmlFor="add-content">The post</label>
            <textarea id="add-content" value={content} onChange={e => setContent(e.target.value)} rows={8}
              placeholder="Paste the draft here. The client's copy, your own, a script, a caption. Length is welcome."
              className={`${FIELD} resize-y leading-[1.6]`} />
          </div>

          <div>
            <label className={LABEL} htmlFor="add-notes">Notes</label>
            <textarea id="add-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Anything you want to remember about it" className={`${FIELD} resize-y`} />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button type="button" onClick={add} disabled={!title.trim()}
              className="rounded-xl bg-ink px-5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40">
              Add it
            </button>
            <button type="button" onClick={() => { reset(); setOpen(false); }}
              className="rounded-xl px-3 py-2.5 text-[13px] font-semibold text-muted hover:text-text">
              Cancel
            </button>
            {/* Only the name is required. Everything else can arrive later, and
                a piece she cannot categorise yet is still worth having. */}
            <span className="text-[12px] text-faint">Only the name is needed.</span>
          </div>
        </div>
      </Modal>
    </>
  );
}
