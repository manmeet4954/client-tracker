'use client';

// The desk — Level 1 of the restructure handoff. Her login's landing, and the
// only screen in the product that knows about more than one profile.
//
// IT IS A CHAT. The main column is a conversation that answers across every
// profile, and every answer is a list of rows she can walk into. The left
// sidebar (desktop) or drawer (phone) is the profile list. There is no board
// here, no calendar, no analytics, no settings — status only.
//
// It loads ALREADY ANSWERING "what needs me today", as a normal first message
// in the thread that scrolls away like any other.
//
// Chrome is ink. A profile's hue is IDENTITY ONLY: the avatar square and the
// dot beside a row. It never paints a rail, a tab, a button or a header.
//
// The answers are composed in `lib/shell/desk.ts`, which reads the counters
// that already exist in `lib/shell/shelf.ts` and adds no second counter.

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronDown, LogOut, Menu, MoreHorizontal, X, SlidersHorizontal } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import Modal from '@/components/Modal';
import type { DeskAnswer, DeskProfile, DeskRow } from '@/lib/shell/desk';
import type { Lifecycle } from '@/lib/tree/objects';
import {
  DESK_PROMPTS, DESK_UNREACHABLE, answerToday, askDesk, composeDeskProfiles, runDesk,
} from '@/lib/shell/desk';
// The standing questions moved into their own file when phase 6 started, so the
// desk's answers can be read and tested without the screen around them. This
// import is the seam: `answerQuestion` is what `localAnswer` used to be.
import { answerQuestion } from '@/lib/shell/deskAnswers';
import { renderProfile } from '@/lib/shell/profile';
import { renderState } from '@/lib/tree/render';
import { CLIENT_COLORS, generateId } from '@/lib/utils';

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Message =
  | { who: 'me'; text: string }
  | ({ who: 'bot' } & DeskAnswer);

export default function Shelf() {
  const { state, dispatch, logout } = useApp();

  // NOT component state. The thread lives in `chatLog`, the one place the
  // conversation is kept, shared with the floating bubble: same brain, same
  // conversation, seen from two places. It used to be a useState here, which is
  // why refreshing the page threw the conversation away.
  const sent = useMemo<Message[]>(
    () => (state.chatLog ?? []).map(m => (
      m.who === 'me'
        ? { who: 'me', text: m.text }
        : { who: 'bot', text: m.text, rows: (m.rows ?? []) as DeskRow[], note: m.note ?? '', flag: 'slipped' }
    )),
    [state.chatLog],
  );
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [menuOpen, setMenuOpen] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [colour, setColour] = useState(CLIENT_COLORS[0]);
  const [ownerKind, setOwnerKind] = useState<'hers' | 'client'>('client');

  const scrollRef = useRef<HTMLDivElement>(null);
  const day = today();

  const profiles = useMemo(() => composeDeskProfiles(state, day), [state, day]);

  // The standing answer, recomposed from her state on every render rather than
  // frozen at mount: the desk should be right when the data lands, not when the
  // component did.
  const opening = useMemo<Message>(
    () => ({ who: 'bot', ...answerToday(state, day) }),
    [state, day],
  );
  const thread = useMemo<Message[]>(() => [opening, ...sent], [opening, sent]);

  // The weekly read is a chip, not a block. Whether it exists at all is a
  // visibility question, so it goes through the resolver and nowhere else.
  const prompts = useMemo(() => {
    const pulseOn = (state.clients ?? []).some(c =>
      renderState(renderProfile(state, c.id, 'owner'), 'shelf.weekly_pulse', 'owner') === 'active');
    return DESK_PROMPTS.filter(p => p.needs !== 'shelf.weekly_pulse' || pulseOn);
  }, [state]);

  const dateLine = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date());

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [thread.length, busy]);

  /** One line into the kept conversation. Nothing here is component state. */
  function keep(who: 'me' | 'dash', text: string, rows?: DeskRow[], note?: string) {
    dispatch({
      type: 'ADD_CHAT_MESSAGE',
      payload: {
        message: {
          id: generateId(), who, text, createdAt: new Date().toISOString(),
          ...(rows?.length ? { rows } : {}),
          ...(note ? { note } : {}),
        },
      },
    });
  }

  /**
   * `fromChip` is the whole distinction. A TAPPED CHIP is one of the five
   * standing questions and is answered here, from her state, instantly and
   * without a model call. ANYTHING SHE TYPES goes to the harness.
   *
   * It used to classify everything she typed through `answerQuestion` first, and
   * that is why the desk could not be talked to. The triggers include `today`,
   * `yes`, `go`, `due` and `review` as whole words, so "I posted the Career
   * Bubble reel today" matched `today`, was answered with the standing today
   * list, and her actual instruction was thrown away. Nothing is lost by sending
   * typed text to the harness: its `across_profiles` tool answers those same
   * five standing questions from the same counters.
   */
  async function send(question: string, fromChip = false) {
    const q = question.trim();
    if (!q || busy) return;
    setDraft('');
    setMenuOpen(false);

    if (fromChip) {
      const local = answerQuestion(q, state, day);
      if (local) {
        keep('me', q);
        keep('dash', local.text, local.rows, local.note);
        return;
      }
    }

    setBusy(true);
    const recent = thread.slice(-8).map(m => ({ who: m.who, text: m.text }));
    keep('me', q);

    // One brain, two surfaces: the same tool loop the floating chat calls. When
    // it actually did something, the tab reads the state back, so what she sees
    // next is what landed and not what the chat believes it did. It syncs rather
    // than loads, because a plain load would replace `chatLog` with the server's
    // copy and eat the message she just sent.
    const done = await runDesk(q, recent, day).catch(() => null);
    if (done) {
      if (done.did.length) {
        const fresh = await fetch('/api/state')
          .then(r => (r.ok ? r.json() : null)).catch(() => null);
        if (fresh?.state) dispatch({ type: 'SYNC_FROM_SERVER', payload: fresh.state });
      }
      keep('dash', done.reply);
      setBusy(false);
      return;
    }

    // The harness is unreachable or has no key: the older text-only brain,
    // exactly as before, so the desk still answers rather than going dead. It
    // never draws an empty bubble: a failure is one plain line.
    let reply: string | null = null;
    try {
      reply = await askDesk(q, state, recent);
    } catch {
      reply = null;
    }
    keep('dash', reply ?? DESK_UNREACHABLE);
    setBusy(false);
  }

  function addProfile() {
    const n = name.trim();
    if (!n) return;
    // The shell's ONE write. Born at lifecycle `setup`, owner_kind chosen, no
    // switch positions set, no strategy version.
    dispatch({ type: 'ADD_CLIENT', payload: { name: n, color: colour, ownerKind, lifecycle: 'setup' } });
    setName('');
    setAddOpen(false);
  }

  /**
   * Spec 31. One dispatch, and it is the one that already existed: this adds no
   * state and no new way to write a lifecycle. What it adds is a place to reach
   * it from, and a consequence when she does.
   */
  function rest(id: string, to: Lifecycle) {
    dispatch({ type: 'SET_LIFECYCLE', payload: { clientId: id, lifecycle: to } });
  }

  const list = (labelled: boolean) => (
    <ProfileList profiles={profiles} labelled={labelled}
      onAdd={() => { setMenuOpen(false); setAddOpen(true); }} onLogout={logout} onRest={rest} />
  );

  return (
    <div className="relative flex h-[100dvh] overflow-hidden bg-paper text-text">

      {/* ── The sidebar, desktop ─────────────────────────────────────────── */}
      <aside className="hidden w-[262px] flex-none flex-col bg-ink px-[14px] pb-4 pt-[22px] text-white md:flex">
        <div className="px-[10px] pb-[18px]">
          <div className="text-[10.5px] font-bold uppercase tracking-[.2em] text-white/40">{dateLine}</div>
          <div className="mt-[7px] font-display text-[22px] font-bold tracking-[-.02em]">The desk</div>
        </div>
        {list(true)}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">

        {/* ── The header, phone ──────────────────────────────────────────── */}
        <header className="flex flex-none items-center gap-[13px] bg-ink p-4 text-white md:hidden">
          <button type="button" onClick={() => setMenuOpen(true)} aria-label="Show profiles"
            className="flex items-center text-white/80">
            <Menu size={22} strokeWidth={2} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-[10.5px] font-bold uppercase tracking-[.2em] text-white/40">{dateLine}</div>
            <div className="mt-[3px] font-display text-[22px] font-bold tracking-[-.02em]">Ask the desk</div>
          </div>
        </header>

        {/* ── The thread ─────────────────────────────────────────────────── */}
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
                <button key={q.text} type="button" onClick={() => send(q.text, true)}
                  className="rounded-full border border-hairline bg-surface px-[15px] py-2 text-[13px] font-semibold text-muted hover:border-[rgba(234,71,17,.4)] hover:text-accent-text">
                  {q.text}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── The composer ───────────────────────────────────────────────── */}
        <div className="flex-none border-t border-hairline bg-paper px-4 pb-[14px] pt-3 md:px-[34px] md:pb-[18px] md:pt-4">
          <div className="mx-auto flex max-w-[720px] items-center gap-[9px]">
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send(draft); }}
              placeholder="Ask across every profile"
              className="min-w-0 flex-1 rounded-[14px] border border-[rgba(23,21,26,.12)] bg-surface px-4 py-[13px] text-[15px] outline-none"
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
      </div>

      {/* ── The drawer, phone ────────────────────────────────────────────── */}
      {menuOpen && (
        <div className="md:hidden">
          <button type="button" aria-label="Close profiles" onClick={() => setMenuOpen(false)}
            className="absolute inset-0 z-[20] bg-[rgba(23,21,26,.4)]" />
          <div className="absolute bottom-0 left-0 top-0 z-[21] flex w-[270px] flex-col bg-ink px-[14px] pb-4 pt-5 text-white shadow-drawer">
            <div className="flex items-center justify-between px-[10px] pb-4">
              <span className="text-[10.5px] font-bold uppercase tracking-[.16em] text-white/40">Profiles</span>
              <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close"
                className="flex text-white/60">
                <X size={18} strokeWidth={2.2} />
              </button>
            </div>
            {list(false)}
          </div>
        </div>
      )}

      <Modal open={addOpen} onClose={() => { setAddOpen(false); setName(''); }} title="New profile" size="sm">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-stone-500">Name</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addProfile()}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-stone-500">Colour</label>
            <div className="flex flex-wrap gap-1.5">
              {CLIENT_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColour(c)}
                  aria-label={`Colour ${c}`}
                  className={`h-7 w-7 rounded-full ${colour === c ? 'ring-2 ring-stone-900 ring-offset-2' : ''}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-stone-500">Whose is it</label>
            <div className="flex gap-1.5">
              {(['client', 'hers'] as const).map(k => (
                <button key={k} type="button" onClick={() => setOwnerKind(k)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm ${
                    ownerKind === k ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 text-stone-600'
                  }`}>
                  {k === 'hers' ? 'Mine' : 'A client'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setAddOpen(false); setName(''); }} className="btn-secondary">Cancel</button>
            <button type="button" onClick={addProfile} className="btn-primary">Add profile</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/**
 * The profile list, identical in the sidebar and the drawer. The status line is
 * whatever `lib/shell/desk.ts` composed for that profile; a profile with
 * nothing true to say shows no line at all, never a zero.
 */
/**
 * One row. The whole row navigates; the small control on the right does not.
 *
 * Spec 31 §3: pausing is one tap and reversible, so it does not ask twice.
 * Archiving asks once, because it reads as final even though it is not.
 */
function ProfileRow({ p, onRest }: { p: DeskProfile; onRest: (id: string, to: Lifecycle) => void }) {
  const { dispatch } = useApp();
  const [menu, setMenu] = useState(false);
  // Renaming, 2026-08-11: "when we tap on the three dots for each client to
  // edit, so I can edit their name if needed, like if I misspell anything".
  // It renames in place rather than opening a dialog, because a typo in a name
  // is a two-second fix and a modal would be the longer half of it.
  //
  // Safe by construction: access binds by profile ID, never by name (spec 21
  // §6), so renaming can no longer open or cut off a login the way it once did.
  const [renaming, setRenaming] = useState<string | null>(null);

  function saveName() {
    const name = (renaming ?? '').trim();
    if (name && name !== p.name) dispatch({ type: 'RENAME_CLIENT', payload: { id: p.id, name } });
    setRenaming(null);
  }

  if (renaming !== null) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-white/[.08] px-[10px] py-[7px]">
        <input
          autoFocus
          value={renaming}
          onChange={e => setRenaming(e.target.value)}
          onBlur={saveName}
          onKeyDown={e => {
            if (e.key === 'Enter') saveName();
            if (e.key === 'Escape') setRenaming(null);
          }}
          aria-label={`Rename ${p.name}`}
          className="min-w-0 flex-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-[14px] font-semibold text-white outline-none ring-1 ring-white/20 focus:ring-white/50"
        />
      </div>
    );
  }

  return (
    <div className="group relative flex items-center rounded-xl pr-1 hover:bg-white/[.08]">
      <Link href={p.href}
        className="flex min-w-0 flex-1 items-center gap-[10px] rounded-xl px-[10px] py-[9px] text-white/85">
        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-[9px] text-[12.5px] font-bold text-white"
          style={{ backgroundColor: p.hue }}>
          {p.initial}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold tracking-[-.01em]">{p.name}</span>
          {p.line && (
            <span className="mt-[2px] block truncate text-[11.5px]"
              style={{ color: p.alert ? '#ff8a5c' : 'rgba(255,255,255,.42)' }}>
              {p.line}
            </span>
          )}
        </span>
      </Link>

      <button type="button" onClick={() => setMenu(v => !v)}
        aria-label={`What to do with ${p.name}`}
        className="flex-none rounded-lg p-1.5 text-white/40 opacity-0 hover:text-white/80 focus:opacity-100 group-hover:opacity-100 md:opacity-0">
        <MoreHorizontal size={16} strokeWidth={2.2} />
      </button>

      {menu && (
        <div className="absolute right-1 top-[calc(100%-4px)] z-30 w-[184px] overflow-hidden rounded-xl bg-white py-1 shadow-panel">
          <MenuItem label="Rename" sub="Fix a spelling"
            onClick={() => { setRenaming(p.name); setMenu(false); }} />
          {p.resting ? (
            <MenuItem label="Bring it back" onClick={() => { onRest(p.id, 'active'); setMenu(false); }} />
          ) : (
            <>
              <MenuItem label="Pause it" sub="Not now, coming back"
                onClick={() => { onRest(p.id, 'paused'); setMenu(false); }} />
              <MenuItem label="Archive it" sub="Done, kept forever"
                onClick={() => {
                  if (confirm(`Archive ${p.name}? Everything is kept, and you can bring it back.`)) {
                    onRest(p.id, 'archived');
                  }
                  setMenu(false);
                }} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({ label, sub, onClick }: { label: string; sub?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="block w-full px-3.5 py-2 text-left hover:bg-chip">
      <span className="block text-[13px] font-semibold text-text">{label}</span>
      {sub && <span className="mt-[1px] block text-[11.5px] text-faint">{sub}</span>}
    </button>
  );
}

function ProfileList({ profiles, labelled, onAdd, onLogout, onRest }: {
  profiles: DeskProfile[];
  /** The drawer carries its own "Profiles" header, so it does not want a second. */
  labelled: boolean;
  onAdd: () => void;
  onLogout: () => void;
  onRest: (id: string, to: Lifecycle) => void;
}) {
  // Spec 31 §2. Resting profiles leave the list. The fold is shut, and when
  // nothing is resting it is not drawn at all: off means absent.
  const [restOpen, setRestOpen] = useState(false);
  const working = profiles.filter(p => !p.resting);
  const resting = profiles.filter(p => p.resting);

  return (
    <>
      {labelled && (
        <div className="px-[10px] pb-2 text-[10.5px] font-bold uppercase tracking-[.16em] text-white/40">
          Profiles
        </div>
      )}
      <div className="flex flex-1 flex-col gap-[2px] overflow-y-auto">
        {working.map(p => <ProfileRow key={p.id} p={p} onRest={onRest} />)}

        {resting.length > 0 && (
          <>
            <button type="button" onClick={() => setRestOpen(v => !v)}
              className="mt-1 flex items-center gap-2 rounded-xl px-[10px] py-2 text-left text-[11.5px] font-semibold text-white/40 hover:bg-white/[.06]">
              <ChevronDown size={14} strokeWidth={2.2}
                className={restOpen ? '' : '-rotate-90'} />
              Resting ({resting.length})
            </button>
            {restOpen && resting.map(p => (
              <div key={p.id} className="opacity-50">
                <ProfileRow p={p} onRest={onRest} />
              </div>
            ))}
          </>
        )}
      </div>
      <button type="button" onClick={onAdd}
        className="mt-3 rounded-xl border border-dashed border-white/[.24] p-[10px] text-center text-[13px] font-semibold text-white/60">
        + Add a profile
      </button>
      {/* Settings had no way in until 2026-08-11. It was built, deployed, and
          reachable only by typing the address, so from her side it did not
          exist. A screen with no door is not a shipped screen. */}
      <a href="/settings"
        className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-white/[.14] p-[10px] text-[12.5px] font-semibold text-white/70 hover:text-white">
        <SlidersHorizontal size={13} strokeWidth={2.2} />
        Settings and access
      </a>
      <button type="button" onClick={onLogout}
        className="mt-3 flex items-center justify-center gap-1.5 text-[11.5px] text-white/35">
        <LogOut size={13} />
        Log out
      </button>
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
 */
function BotMessage({ message, collapsed, onToggle }: {
  message: DeskAnswer;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const rows = message.rows;
  const foldable = rows.length > 2;
  const late = rows.filter(r => r.late).length;
  const hidden = foldable && collapsed;

  return (
    <div className="w-full rounded-[18px_18px_18px_5px] border border-hairline bg-surface px-[18px] py-4 shadow-card">
      <div className="text-[15px] leading-[1.6]">{message.text}</div>

      {foldable && (
        <button type="button" onClick={onToggle}
          className="mt-3 flex w-full items-center gap-[11px] rounded-[13px] bg-control px-[13px] py-[11px] md:hidden">
          <span className="h-2 w-2 flex-none rounded-full"
            style={{ backgroundColor: late > 0 ? '#ea4711' : '#9b95a1' }} />
          <span className="flex-1 text-left text-[14px] font-semibold">
            {rows.length} items{late > 0 ? `, ${late} ${message.flag}` : ''}
          </span>
          <span className="text-[12.5px] font-semibold text-faint">{collapsed ? 'Open' : 'Hide'}</span>
          <span className={`flex text-faint ${collapsed ? '-rotate-90' : ''}`}>
            <ChevronDown size={15} strokeWidth={2.2} />
          </span>
        </button>
      )}

      <div className={hidden ? 'hidden md:block' : ''}>
        {rows.map(r => <Row key={r.key} row={r} />)}
      </div>

      {message.note && (
        <div className={`mt-[10px] text-[12.5px] text-faint ${hidden ? 'hidden md:block' : ''}`}>
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
