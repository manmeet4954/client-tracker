'use client';

// Creation → References — the restructure handoff, "References".
//
//   "Two groups, each a card with a header: What they shared and What we want
//    for them. Rows: title 15px/600, source 12.5px, date 12px tabular."
//
// The hard part is not the layout, it is the attribution. Spec 21 §8.7:
//
//   "Legacy rows carry no source signal, so they migrate to `our-vision/`
//    marked `source: unknown` with a one-time sort queue — NEVER attributed to
//    the client without evidence."
//
// So: an unsorted row sits under "What we want for them", wears a quiet "source
// unknown" pill, and carries one tap that moves it across. Nothing guesses. She
// is the evidence, and the tap is her saying so.
//
// Anything she adds from this screen is marked `us` at the moment she adds it,
// because that IS evidence: she is the one who put it there.

import { useState } from 'react';
import { ArrowLeftRight, ExternalLink, FileText, Image as ImageIcon, Link2, Plus, Trash2 } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import { generateId } from '@/lib/utils';
import type { Reference, ReferenceType } from '@/types';
import {
  flipProvenance, groupReferences, moveLabel, referencesLine,
} from '@/lib/creation/assets';
import type { Provenance, SortedReference } from '@/lib/creation/assets';

const CARD = 'rounded-card border border-hairline bg-surface shadow-card';
const KICKER = 'text-[11.5px] font-bold uppercase tracking-[.09em] text-muted';
const BTN_GHOST =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-[rgba(23,21,26,.14)] ' +
  'px-[15px] py-2 text-[13px] font-semibold text-text';
const BTN_DARK =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-ink px-[18px] py-2.5 ' +
  'text-[13.5px] font-semibold text-white disabled:opacity-50';
const INPUT =
  'w-full rounded-xl border border-hairline bg-paper px-3.5 py-2.5 text-sm text-text outline-none focus:border-accent';

const ADD_KINDS: { type: ReferenceType; label: string; icon: React.ReactNode; placeholder: string }[] = [
  { type: 'link', label: 'Link', icon: <Link2 size={14} strokeWidth={2} />, placeholder: 'https://' },
  { type: 'image', label: 'Image', icon: <ImageIcon size={14} strokeWidth={2} />, placeholder: 'https://' },
  { type: 'text', label: 'Note', icon: <FileText size={14} strokeWidth={2} />, placeholder: 'Write it down.' },
];

export default function ReferencesScreen({ profileId, onSetSource }: {
  profileId: string;
  /**
   * How a row is moved across. Supply it once `Reference.source` and a
   * `SET_REFERENCE_SOURCE` action exist and the screen will use it. Until then
   * it falls back to a delete-and-re-add that carries the field through, which
   * is what the interim below does. Row order does not depend on array
   * position, so the round trip does not reshuffle anything.
   */
  onSetSource?: (refId: string, source: Provenance) => void;
}) {
  const { dispatch, role } = useApp();
  const { data } = useClient(profileId);
  const isOwner = role === 'owner';

  const refs = data.references ?? [];
  const groups = groupReferences(refs);

  const [addType, setAddType] = useState<ReferenceType | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  function closeAdd() {
    setAddType(null);
    setTitle('');
    setContent('');
  }

  function addRef() {
    if (!addType || !content.trim()) return;
    // She added it, so it is ours. That is evidence, not a guess.
    const ref: SortedReference = {
      id: generateId(),
      type: addType,
      content: content.trim(),
      title: title.trim(),
      pinned: false,
      createdAt: new Date().toISOString(),
      source: 'us',
    };
    dispatch({ type: 'ADD_REFERENCE', payload: { clientId: profileId, ref } });
    closeAdd();
  }

  function setSource(ref: Reference, source: Provenance) {
    if (onSetSource) {
      onSetSource(ref.id, source);
      return;
    }
    // Interim: no SET_REFERENCE_SOURCE action exists yet, and this file may not
    // add one. Delete and re-add the same row, id and createdAt intact, with
    // the field carried. Both dispatches land in one tick, so one save follows.
    const moved: SortedReference = { ...(ref as SortedReference), source };
    dispatch({ type: 'DELETE_REFERENCE', payload: { clientId: profileId, refId: ref.id } });
    dispatch({ type: 'ADD_REFERENCE', payload: { clientId: profileId, ref: moved } });
  }

  function deleteRef(refId: string) {
    dispatch({ type: 'DELETE_REFERENCE', payload: { clientId: profileId, refId } });
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13.5px] text-muted">{referencesLine(refs)}</p>
        {addType === null && (
          <div className="flex flex-wrap items-center gap-2">
            {ADD_KINDS.map(k => (
              <button
                key={k.type}
                type="button"
                onClick={() => setAddType(k.type)}
                className={BTN_GHOST}
              >
                <Plus size={13} strokeWidth={2.2} />
                {k.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {addType !== null && (
        <div className={`${CARD} flex flex-col gap-2.5 p-3.5`}>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="What is it? Optional."
            className={INPUT}
          />
          {addType === 'text' ? (
            <textarea
              autoFocus
              rows={4}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={ADD_KINDS[2].placeholder}
              className={`${INPUT} resize-y leading-[1.6]`}
            />
          ) : (
            <input
              autoFocus
              value={content}
              onChange={e => setContent(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addRef(); if (e.key === 'Escape') closeAdd(); }}
              placeholder={ADD_KINDS.find(k => k.type === addType)?.placeholder}
              className={INPUT}
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={addRef} disabled={!content.trim()} className={BTN_DARK}>Keep it</button>
            <button type="button" onClick={closeAdd} className={BTN_GHOST}>Cancel</button>
            <span className="text-xs text-faint">It lands under what we want for them.</span>
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <div className={`${CARD} px-[18px] py-4 text-sm text-muted`}>
          Nothing kept here yet. Add a link, an image or a note and it stays with this profile.
        </div>
      ) : groups.map(group => (
        <div key={group.key} className={`${CARD} overflow-hidden`}>
          <div className="px-[18px] pb-3 pt-3.5">
            <div className={KICKER}>{group.label}</div>
            {group.note && <p className="mt-1.5 text-[12.5px] text-faint">{group.note}</p>}
          </div>
          {group.rows.map(row => (
            <div
              key={row.id}
              className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 border-t border-divider px-[18px] py-3.5"
            >
              <span className="min-w-[9rem] flex-1 text-[15px] font-semibold leading-snug text-text">
                {row.href ? (
                  <a
                    href={row.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-baseline gap-1.5 hover:text-accent-text"
                  >
                    {row.title}
                    <ExternalLink size={12} strokeWidth={2} className="shrink-0 self-center text-faint" />
                  </a>
                ) : row.title}
              </span>

              {row.provenance === 'unknown' && (
                <span className="rounded-full bg-control px-2.5 py-[3px] text-[11px] font-semibold text-faint">
                  source unknown
                </span>
              )}

              {row.source && <span className="text-[12.5px] text-muted">{row.source}</span>}
              <span className="text-xs tabular-nums text-faint">{row.date}</span>

              {isOwner && (
                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSource(row.ref, flipProvenance(row.provenance))}
                    title={moveLabel(row.provenance)}
                    aria-label={moveLabel(row.provenance)}
                    className="rounded-lg p-1.5 text-faint hover:text-accent-text"
                  >
                    <ArrowLeftRight size={15} strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteRef(row.id)}
                    title="Delete this reference"
                    aria-label="Delete this reference"
                    className="rounded-lg p-1.5 text-faint hover:text-overdue"
                  >
                    <Trash2 size={14} strokeWidth={2} />
                  </button>
                </span>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
