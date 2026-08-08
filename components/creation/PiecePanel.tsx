'use client';

// The piece panel — the restructure handoff, "CREATION → Board":
// "Review and scheduling are states of a piece, not screens."
//
// This is the change that kills the last second copy in the product. A preview
// used to be its own object on its own Previews screen: a second record of the
// same post, with its own images and its own caption and nothing pointing back
// at the piece it was made from. It points at one now, and this panel is where
// the piece and its review state live together.
//
// It is a PANEL, not a place (rule 2: three levels, hard). It rides over the
// screen the user is already on, so closing it returns them exactly where they
// were. Same geometry as the Strategy corner, to the pixel:
//   panel   470px desktop / full width phone · #faf8f6
//           shadow -16px 0 40px rgba(23,21,26,.22) · from the right
//   head    18px 20px, hairline underneath, title 18px/600
//   body    18px 20px, 18px between blocks
//
// Chrome is ink. The profile's hue never appears in here.

import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Send, X } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { formatDate, generateId, generateShareId } from '@/lib/utils';
import { CONTENT_STAGES, type ContentStage, type PreviewPost } from '@/types';
import { OPERATIONAL_GATES } from '@/lib/tree/objects';
import { readGateSet } from '@/lib/strategy/derivation';
import { renderProfile } from '@/lib/shell/profile';
import { previewFor, unattachedPreviews } from '@/lib/creation/board';
import {
  attachPreview, canMove, captionDrift, deliveryState, gateReading, locatePiece,
  newPreviewFor, pieceFields, sharePath, shareUrl, slideLine, whatsappHref,
} from '@/lib/creation/piece';
import InstagramPost from '@/components/InstagramPost';

/**
 * One piece, opened over whatever screen she was on.
 *
 * It takes the id of the piece and a way to close. Nothing else: the id
 * resolves to exactly one profile, so the panel is never told twice which
 * profile it is inside.
 */
export default function PiecePanel({ cardId, onClose }: {
  cardId: string;
  onClose: () => void;
}) {
  const { state, role, dispatch, saveNow } = useApp();
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState('');

  // The public link is only knowable in the browser, and the panel must render
  // the same on the server as it does before hydration.
  useEffect(() => setOrigin(window.location.origin), []);

  // Escape closes it, the same as the backdrop. A panel that traps her is worse
  // than no panel.
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const found = locatePiece(state.clientData ?? {}, cardId);

  if (found.kind === 'missing') {
    return (
      <Panel title="That piece is not here" onClose={onClose}>
        <p className="text-sm leading-[1.6] text-muted">
          It may have been deleted, or it belongs to a profile you cannot open. Close this and the
          board is exactly where you left it.
        </p>
      </Panel>
    );
  }

  if (found.kind === 'tree') {
    return (
      <Panel title={found.title} onClose={onClose}>
        <p className="text-sm leading-[1.6] text-muted">
          This one lives in the profile&apos;s record, not on the board. It is at {found.stage}.
          Everything kept about it is on the record; the board shows the cards.
        </p>
      </Panel>
    );
  }

  const { profileId, card } = found;
  const data = state.clientData?.[profileId];
  const locked = renderProfile(state, profileId, role).strategy_locked;

  const cards = data?.contentCards ?? [];
  const previews = data?.previewPosts ?? [];
  const preview = previewFor(previews, card.id);
  const orphans = unattachedPreviews(previews, cards);

  const pillar = (data?.pillars ?? []).find(p => p.id === card.pillarId);
  const seed = card.topicId ? (data?.topics ?? []).find(t => t.id === card.topicId) : undefined;
  const fields = pieceFields({
    card,
    pillarName: pillar?.name,
    seedName: seed?.name,
  });
  // The date reads as a date, not as a stored string.
  const dated = fields.map(f =>
    f.label === 'Goes live' && !f.missing ? { ...f, value: formatDate(card.scheduledDate) } : f);

  const gates = gateReading({
    gateSet: data?.body ? readGateSet(data.body) : null,
    operational: OPERATIONAL_GATES,
    stage: card.stage,
  });

  const link = preview && origin ? shareUrl(origin, preview.shareId) : '';
  const delivery = deliveryState(preview);
  const drifted = captionDrift(card, preview);

  function move(to: ContentStage) {
    const verdict = canMove({ locked, from: card.stage, to });
    if (!verdict.allowed) return;
    dispatch({ type: 'MOVE_CONTENT_CARD', payload: { clientId: profileId, cardId: card.id, stage: to } });
  }

  function attach(p: PreviewPost) {
    dispatch({
      type: 'UPDATE_PREVIEW_POST',
      payload: { clientId: profileId, post: attachPreview(p, card.id, new Date().toISOString()) },
    });
    void saveNow();
  }

  // A preview made from a piece in Review carries its cardId from birth. Its
  // name and its caption come off the piece, so nothing is asked twice.
  function makePreview() {
    dispatch({
      type: 'ADD_PREVIEW_POST',
      payload: {
        clientId: profileId,
        post: newPreviewFor({
          card,
          id: generateId(),
          shareId: generateShareId(),
          now: new Date().toISOString(),
        }),
      },
    });
    void saveNow();
  }

  function takeTheWords() {
    if (!preview) return;
    dispatch({
      type: 'UPDATE_PREVIEW_POST',
      payload: {
        clientId: profileId,
        post: { ...preview, caption: (card.content ?? '').trim(), updatedAt: new Date().toISOString() },
      },
    });
    void saveNow();
  }

  function copyLink() {
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const moveNote = canMove({ locked, from: card.stage, to: card.stage }).reason;

  return (
    <Panel title={card.title || 'Untitled post'} onClose={onClose}>
      {/* The six stages, the current one filled. Before the lock they are not
          buttons at all: a refused control is not drawn as a dead one. */}
      <div>
        <div className="flex flex-wrap gap-[7px]">
          {CONTENT_STAGES.map(s => {
            const on = s.id === card.stage;
            const cls = `rounded-full px-[13px] py-1.5 text-[12.5px] font-semibold ${
              on ? 'bg-ink text-white' : 'bg-chip text-muted'
            }`;
            return locked ? (
              <button key={s.id} type="button" onClick={() => move(s.id)} className={cls}>
                {s.label}
              </button>
            ) : (
              <span key={s.id} className={cls}>{s.label}</span>
            );
          })}
        </div>
        {moveNote && <p className="mt-2.5 text-[12.5px] text-faint">{moveNote}</p>}
      </div>

      {/* The five fields. Missing is said, never left blank. */}
      <div>
        {dated.map(f => (
          <div
            key={f.label}
            className="flex items-start justify-between gap-3.5 border-b border-divider py-[11px] text-sm last:border-b-0"
          >
            <span className="flex-none text-faint">{f.label}</span>
            {f.href ? (
              <a
                href={f.href}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 break-all text-right font-semibold text-muted underline"
              >
                {f.value}
              </a>
            ) : (
              <span className={`min-w-0 break-words text-right font-semibold ${f.missing ? 'text-faint' : 'text-text'}`}>
                {f.value}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Review. A state of this piece, not a screen of its own. */}
      {card.stage === 'review' && (
        <div className="overflow-hidden rounded-card border border-hairline bg-white">
          <p className="px-4 pb-3 pt-3.5 text-[11.5px] font-bold uppercase tracking-[.09em] text-muted">
            In review, which is a state, not a screen
          </p>

          {preview ? (
            <div className="px-4 pb-4">
              {/* An empty preview is not drawn as a black frame. It is said. */}
              {preview.images.length > 0 ? (
                <>
                  <div className="overflow-hidden rounded-[14px] border border-hairline">
                    <InstagramPost post={preview} instagram={data?.instagram ?? { handle: '', avatarUrl: '' }} />
                  </div>
                  <p className="mt-3 text-[13px] leading-[1.5] text-muted">
                    How it will look on the feed, {slideLine(preview).toLowerCase()}. The link below is
                    the only thing anyone outside ever sees.
                  </p>
                </>
              ) : (
                <p className="text-[13px] leading-[1.5] text-muted">
                  {slideLine(preview)}. The link works, but there is nothing to look at until the
                  slides are added.
                </p>
              )}

              <p className="mt-2.5 break-all rounded-[9px] bg-control px-2.5 py-2 font-mono text-[12.5px] text-text">
                {sharePath(preview.shareId)}
              </p>

              <div className="mt-2.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={copyLink}
                  className="flex items-center gap-1.5 rounded-[11px] bg-ink px-[15px] py-[9px] text-[13px] font-semibold text-white"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied' : 'Copy the link'}
                </button>
                <a
                  href={whatsappHref(link || sharePath(preview.shareId))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-[11px] border border-hairline px-[14px] py-2 text-[13px] font-semibold text-muted"
                >
                  <Send size={14} /> Send on WhatsApp
                </a>
                <a
                  href={sharePath(preview.shareId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-[11px] border border-hairline px-[14px] py-2 text-[13px] font-semibold text-muted"
                >
                  <ExternalLink size={14} /> Open it
                </a>
              </div>

              {!delivery.known && (
                <p className="mt-2.5 text-[12.5px] leading-[1.5] text-faint">{delivery.line}</p>
              )}

              {drifted && (
                <div className="mt-3 rounded-[11px] border border-hairline p-3">
                  <p className="text-[12.5px] leading-[1.5] text-muted">
                    The piece has been written since this preview was made, so the caption here is
                    the older wording.
                  </p>
                  <button
                    type="button"
                    onClick={takeTheWords}
                    className="mt-2 rounded-[11px] border border-hairline px-[14px] py-2 text-[13px] font-semibold text-muted"
                  >
                    Use the piece&apos;s words
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="px-4 pb-4">
              <p className="text-sm leading-[1.55] text-text">
                This piece has no preview yet, so there is nothing to send.
              </p>
              <button
                type="button"
                onClick={makePreview}
                className="mt-2.5 rounded-[11px] bg-ink px-[15px] py-[9px] text-[13px] font-semibold text-white"
              >
                Make its preview
              </button>
              <p className="mt-2 text-[12.5px] leading-[1.5] text-faint">
                It takes the piece&apos;s own title and words. Add the slides and the link is ready.
              </p>

              {orphans.length > 0 && (
                <div className="mt-3.5 border-t border-divider pt-3">
                  <p className="text-[12.5px] leading-[1.5] text-faint">
                    Or attach one that was made before a preview belonged to a piece. Pick the one
                    that is this piece:
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {orphans.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => attach(p)}
                        className="flex w-full items-center gap-3 rounded-[11px] border border-hairline px-3 py-2.5 text-left"
                      >
                        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-text">
                          {p.name || 'Untitled preview'}
                        </span>
                        <span className="flex-none text-[12px] text-faint">{slideLine(p)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Out of review, but the preview is still its review state. */}
      {card.stage !== 'review' && preview && (
        <p className="text-[12.5px] leading-[1.5] text-faint">
          Its preview is at {sharePath(preview.shareId)}. Move the piece back to Review to send it
          again.
        </p>
      )}

      {/* The gates. Counted from the profile's own gate set, never invented. */}
      <div>
        <p className="mb-[9px] text-[11.5px] font-bold uppercase tracking-[.09em] text-muted">
          {gates.known ? gates.headline : 'Gates'}
        </p>
        {gates.known ? (
          <>
            {gates.rows.map(g => (
              <div key={g.id} className="flex items-start gap-3 border-b border-divider py-2.5">
                <span
                  className={`mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full ${
                    g.passed ? 'bg-positive text-white' : 'border-2 border-[#d9d4d0]'
                  }`}
                >
                  {g.passed && <Check size={10} strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-text">{g.name}</span>
                  <span className="block text-[12.5px] leading-[1.5] text-faint">{g.question}</span>
                </span>
                <span className="flex-none text-[12px] text-faint">
                  {g.passed ? 'passed' : 'not yet'}
                </span>
              </div>
            ))}
            <p className="pt-2.5 text-[12px] leading-[1.5] text-faint">
              A gate is marked when the piece has come out of review. Nothing here is ticked by hand.
            </p>
          </>
        ) : (
          <p className="text-[13px] leading-[1.55] text-muted">{gates.line}</p>
        )}
      </div>
    </Panel>
  );
}

// ── The panel itself ─────────────────────────────────────────────────────────

function Panel({ title, onClose, children }: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[rgba(23,21,26,.34)]">
      <button
        type="button"
        aria-label="Close the piece"
        onClick={onClose}
        className="flex-1 cursor-default"
      />
      <div
        role="dialog"
        aria-label={title}
        className="flex w-full max-w-full flex-col bg-paper shadow-panel md:w-[470px]"
      >
        <div className="flex flex-none items-center gap-3 border-b border-hairline px-5 py-[18px]">
          <span className="min-w-0 flex-1 text-[18px] font-semibold leading-tight tracking-[-.015em] text-text">
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the piece"
            className="flex flex-none text-faint hover:text-text"
          >
            <X size={19} strokeWidth={2.2} />
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-[18px] overflow-y-auto px-5 py-[18px]">
          {children}
        </div>
      </div>
    </div>
  );
}
