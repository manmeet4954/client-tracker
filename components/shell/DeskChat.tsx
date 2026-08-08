'use client';

// The desk's conversation — Level 1 of the restructure handoff, phase 6.
//
// The desk IS a chat. This is the main column: a thread that answers across
// every profile, suggested chips under it, and a composer pinned to the bottom.
// The frame around it — the sidebar, the phone header, the drawer — is
// `Shelf.tsx`. Nothing here knows about that frame.
//
// It loads ALREADY ANSWERING "what needs me today". She gets the standing
// answer without asking, as a normal message that scrolls away like any other.
// There is no separate Today block on this screen.
//
// EVERY ANSWER IS A LIST OF ROWS SHE CAN WALK INTO. A row is a door: tapping it
// lands inside that profile. Chrome is ink; a profile's hue paints exactly one
// thing here, the 8px dot at the head of its row.
//
// THE SEAM. This screen only FINDS. Whether the desk can also act — move a
// piece, send a preview, add a seed — is hers to answer and she has not. The
// path that already acts is untouched and lives elsewhere.
//
// The queries are `lib/shell/desk.ts`; the routing, the thread and the fold are
// `lib/shell/deskAnswers.ts`. Nothing is computed in this file that could be
// computed there.

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronDown } from 'lucide-react';
import type { AppState } from '@/types';
import type { DeskAnswer, DeskRow } from '@/lib/shell/desk';
import { DESK_UNREACHABLE, askDesk } from '@/lib/shell/desk';
import type { DeskMessage } from '@/lib/shell/deskAnswers';
import {
  answerQuestion, deskThread, foldModel, plainAnswer, recentTurns, visiblePrompts,
} from '@/lib/shell/deskAnswers';
import { renderProfile } from '@/lib/shell/profile';
import { renderState } from '@/lib/tree/render';

export default function DeskChat({ state, day }: { state: AppState; day: string }) {
  const [sent, setSent] = useState<DeskMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Record<number, boolean>>({});

  const scrollRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);

  // The opening answer is recomposed from her state on every render rather than
  // frozen at mount: the desk should be right when the data lands, not when the
  // component did.
  const thread = useMemo(() => deskThread(state, day, sent), [state, day, sent]);

  // The weekly read is a chip, not a block. Whether it exists at all is a
  // visibility question, so it goes through the resolver and nowhere else.
  const prompts = useMemo(() => {
    const pulseOn = (state.clients ?? []).some(c =>
      renderState(renderProfile(state, c.id, 'owner'), 'shelf.weekly_pulse', 'owner') === 'active');
    return visiblePrompts(pulseOn);
  }, [state]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [thread.length, busy]);

  async function send(question: string) {
    const q = question.trim();
    if (!q || busyRef.current) return;
    setDraft('');

    const local = answerQuestion(q, state, day);
    if (local) {
      setSent(prev => [...prev, { who: 'me', text: q }, { who: 'bot', ...local }]);
      return;
    }

    // Anything outside the five standing questions goes to the brain the app
    // already has. It never draws an empty bubble: a failure is one plain line.
    busyRef.current = true;
    setBusy(true);
    const recent = recentTurns(thread);
    setSent(prev => [...prev, { who: 'me', text: q }]);
    let reply: string | null = null;
    try {
      reply = await askDesk(q, state, recent);
    } catch {
      reply = null;
    }
    setSent(prev => [...prev, { who: 'bot', ...plainAnswer(reply ?? DESK_UNREACHABLE) }]);
    busyRef.current = false;
    setBusy(false);
  }

  return (
    <>
      {/* ── The thread ─────────────────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-5 pt-[18px] md:px-[34px] md:pt-[30px]">
        <div className="mx-auto flex max-w-[720px] flex-col gap-4">
          {thread.map((m, i) => (
            m.who === 'me'
              ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[82%] rounded-[18px_18px_5px_18px] bg-ink px-4 py-3 text-[15px] leading-[1.5] text-white">
                    {m.text}
                  </div>
                </div>
              )
              : (
                <div key={i} className="flex justify-start">
                  <BotMessage
                    message={m}
                    collapsed={!open[i]}
                    onToggle={() => setOpen(o => ({ ...o, [i]: !o[i] }))}
                  />
                </div>
              )
          ))}

          {busy && (
            <div className="flex justify-start">
              <div className="w-full rounded-[18px_18px_18px_5px] border border-hairline bg-surface px-[18px] py-4 shadow-card">
                <div className="text-[15px] leading-[1.6] text-faint">Looking across your profiles.</div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-[2px]">
            {prompts.map(q => (
              <button key={q.text} type="button" onClick={() => send(q.text)}
                className="rounded-full border border-hairline bg-surface px-[15px] py-2 text-[13px] font-semibold text-muted hover:border-[rgba(234,71,17,.4)] hover:text-accent-text">
                {q.text}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── The composer ───────────────────────────────────────────────────── */}
      <div className="flex-none border-t border-hairline bg-paper px-4 pb-[14px] pt-3 md:px-[34px] md:pb-[18px] md:pt-4">
        <div className="mx-auto flex max-w-[720px] items-center gap-[9px]">
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') send(draft); }}
            placeholder="Ask across every profile"
            aria-label="Ask across every profile"
            className="min-w-0 flex-1 rounded-[14px] border border-[rgba(23,21,26,.12)] bg-surface px-4 py-[13px] text-[15px] outline-none focus:border-[rgba(234,71,17,.5)]"
          />
          <button type="button" onClick={() => send(draft)} aria-label="Send"
            className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[14px] bg-ink text-white">
            <ArrowRight size={19} strokeWidth={2} />
          </button>
        </div>
        <div className="mx-auto mt-2 max-w-[720px] text-[11.5px] text-faint">
          It only ever answers about your profiles, and every answer is a row you can walk into.
        </div>
      </div>
    </>
  );
}

/**
 * One bot message: the headline, then the rows, then the note.
 *
 * PHONE FOLDING. An answer with more than two rows renders a persistent two-way
 * summary control instead of the rows. It toggles both ways and never
 * disappears. Desktop always shows the rows, so the control is phone-only and
 * the rows are simply revealed at `md`.
 *
 * The label's numbers are counted from `rows` in `foldModel`, never stated.
 */
function BotMessage({ message, collapsed, onToggle }: {
  message: DeskAnswer;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const fold = foldModel(message.rows, message.flag, collapsed);

  return (
    <div className="w-full rounded-[18px_18px_18px_5px] border border-hairline bg-surface px-[18px] py-4 shadow-card">
      <div className="text-[15px] leading-[1.6]">{message.text}</div>

      {fold.foldable && (
        <button type="button" onClick={onToggle} aria-expanded={!collapsed}
          className="mt-3 flex w-full items-center gap-[11px] rounded-[13px] bg-control px-[13px] py-[11px] md:hidden">
          <span className="h-2 w-2 flex-none rounded-full" style={{ backgroundColor: fold.dot }} />
          <span className="flex-1 text-left text-[14px] font-semibold">{fold.label}</span>
          <span className="text-[12.5px] font-semibold text-faint">{fold.action}</span>
          <span className={`flex text-faint ${collapsed ? '-rotate-90' : ''}`}>
            <ChevronDown size={15} strokeWidth={2.2} />
          </span>
        </button>
      )}

      <div className={fold.hidesRows ? 'hidden md:block' : ''}>
        {message.rows.map(r => <Row key={r.key} row={r} />)}
      </div>

      {message.note && (
        <div className={`mt-[10px] text-[12.5px] text-faint ${fold.hidesRows ? 'hidden md:block' : ''}`}>
          {message.note}
        </div>
      )}
    </div>
  );
}

/** A row is a door. Tapping it lands inside that profile, at that thing. */
function Row({ row }: { row: DeskRow }) {
  return (
    <Link href={row.href}
      className="mt-[2px] flex w-full items-center gap-[11px] border-t border-divider py-[11px]">
      <span className="h-2 w-2 flex-none rounded-full" style={{ backgroundColor: row.hue }} />
      <span className="min-w-0 flex-1 text-left text-[14.5px] font-semibold">{row.title}</span>
      <span className="whitespace-nowrap text-[12.5px] text-muted">{row.profile_name}</span>
      {row.when && (
        <span className="whitespace-nowrap text-[12.5px] font-semibold"
          style={{ color: row.late ? '#c2410c' : '#9b95a1' }}>
          {row.when}
        </span>
      )}
    </Link>
  );
}
