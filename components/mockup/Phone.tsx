'use client';

// Spec 35 — the profile mockup, drawn as the phone.
//
// FIDELITY IS THE REQUIREMENT. Her instruction was "make it exactly like this",
// with a screenshot of @yourcareerbubble as the reference, and "no flair
// needed". So two rules govern every line in this file:
//
//   1. Nothing is added that Instagram does not have. No labels naming the
//      parts, no pencils hovering over the editable bits, no help text. A
//      client has to look at this and see Instagram, not a diagram of it.
//   2. Nothing is invented. What is not editable is FURNITURE, drawn from one
//      object in lib/mockup/profile.ts, never guessed at here.
//
// Editing therefore happens IN PLACE: tap the text and type it, tap the picture
// and pick a file. The only thing that ever appears on top of the phone is a
// file picker the browser draws itself.
//
// Read-only is the same component with `onChange` left off, which is what the
// client sees through a share link. There is no second renderer to drift.

import { useRef } from 'react';
import Image from 'next/image';
import { BadgeCheck, Bell, ChevronLeft, Link2, MoreHorizontal, Pin, UserPlus } from 'lucide-react';
import {
  FURNITURE, THEMES, displayLink, orderedTiles,
  type EditableField, type ProfileMockupRecord,
} from '@/lib/mockup/profile';

export interface PhoneProps {
  mockup: ProfileMockupRecord;
  /** Left off for the client's read-only view. Nothing edits without it. */
  onField?: (field: EditableField, value: string) => void;
  onAvatar?: (file: File) => void;
  onHighlightLabel?: (id: string, label: string) => void;
  onHighlightImage?: (id: string, file: File) => void;
  onTileImage?: (id: string, file: File) => void;
  onTogglePin?: (id: string) => void;
}

export default function Phone(props: PhoneProps) {
  const { mockup: m } = props;
  const editing = !!props.onField;
  // Every colour on the phone comes from here. Nothing below hardcodes one, so
  // light mode is a different palette rather than a second component.
  const t = THEMES[m.theme] ?? THEMES.dark;
  // §7.4's refusal is shown by the screen around this, not here: the phone
  // draws Instagram and nothing else. `togglePin` owns the rule either way.

  return (
    <div className="mx-auto w-full max-w-[392px] select-none"
      style={{
        background: t.bg,
        color: t.text,
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
      }}>

      {/* ── The top bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 pb-3 pt-4">
        <ChevronLeft size={26} strokeWidth={2.4} />
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <Text value={m.username} onChange={v => props.onField?.('username', v)} editing={editing}
            className="truncate text-[21px] font-bold tracking-[-.01em]" placeholder="username" />
          <BadgeCheck size={19} className="flex-none" fill="#3897f0" stroke={t.bg} strokeWidth={2.2} />
        </div>
        <Bell size={24} strokeWidth={1.9} />
        <MoreHorizontal size={24} strokeWidth={2.2} />
      </div>

      {/* ── Avatar, and the numbers ──────────────────────────────────────── */}
      <div className="flex items-center gap-6 px-4">
        {/* The ring never changes. Her words, and there is no control for it. */}
        <ImageSlot
          url={m.avatarUrl}
          onFile={props.onAvatar}
          editing={editing}
          className="h-[88px] w-[88px] rounded-full"
          wrapperClassName="flex-none rounded-full p-[3px]"
          wrapperStyle={{ background: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)' }}
          innerClassName="rounded-full border-[3px]"
          innerStyle={{ borderColor: t.bg }}
          label="profile picture"
        />
        <div className="flex flex-1 justify-between pr-1">
          {FURNITURE.stats.map(s => (
            <div key={s.label} className="text-center">
              <div className="text-[19px] font-bold tabular-nums leading-tight">{s.value}</div>
              <div className="text-[14px]" style={{ color: t.muted }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Name, bio, link ──────────────────────────────────────────────── */}
      <div className="px-4 pt-3">
        <Text value={m.fullName} onChange={v => props.onField?.('fullName', v)} editing={editing}
          className="block text-[15px] font-semibold leading-[1.35]" placeholder="Name | what they do" multiline />
        <Text value={m.bio} onChange={v => props.onField?.('bio', v)} editing={editing}
          className="mt-1 block whitespace-pre-wrap text-[15px] leading-[1.35]" placeholder="Bio" multiline />
        {(m.link || editing) && (
          <div className="mt-1 flex items-center gap-1.5 text-[15px]" style={{ color: t.link }}>
            <Link2 size={15} strokeWidth={2.2} className="flex-none -rotate-45" />
            <Text value={m.link} onChange={v => props.onField?.('link', v)} editing={editing}
              className="truncate" placeholder="add a link" display={displayLink(m.link)} />
          </div>
        )}
        <p className="mt-2 text-[13px] leading-[1.3]" style={{ color: t.faint }}>
          Followed by {FURNITURE.followedBy.names.join(', ')} and {FURNITURE.followedBy.others} others
        </p>
      </div>

      {/* ── The buttons ──────────────────────────────────────────────────── */}
      <div className="flex gap-1.5 px-4 pt-3">
        {FURNITURE.controls.map(c => (
          <div key={c} className="flex-1 rounded-[10px] py-[7px] text-center text-[14px] font-semibold"
            style={{ background: t.button, color: t.buttonText }}>
            {c}
          </div>
        ))}
        <div className="flex w-11 items-center justify-center rounded-[10px]"
          style={{ background: t.button, color: t.buttonText }}>
          <UserPlus size={17} strokeWidth={2.2} />
        </div>
      </div>

      {/* ── Highlights ───────────────────────────────────────────────────── */}
      <div className="flex gap-4 overflow-x-auto px-4 pb-1 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {m.highlights.map(h => (
          <div key={h.id} className="flex w-[72px] flex-none flex-col items-center gap-1.5">
            <ImageSlot
              url={h.imageUrl}
              onFile={props.onHighlightImage ? f => props.onHighlightImage!(h.id, f) : undefined}
              editing={editing}
              className="h-16 w-16 rounded-full"
              wrapperClassName="flex-none rounded-full border-[1.5px] p-[2px]"
              wrapperStyle={{ borderColor: t.border }}
              innerClassName="rounded-full"
              label="cover"
            />
            <Text value={h.label} onChange={v => props.onHighlightLabel?.(h.id, v)} editing={editing}
              className="w-full truncate text-center text-[12px]" placeholder="name" />
          </div>
        ))}
      </div>

      {/* ── The tab row, furniture ───────────────────────────────────────── */}
      <div className="mt-2 flex border-t" style={{ borderColor: t.border }}>
        {['grid', 'reels', 'repost', 'tagged'].map((tab, i) => (
          <div key={tab} className="flex-1 border-b-[1.5px] py-2.5"
            style={{ borderColor: i === 0 ? t.text : 'transparent' }}>
            <TabGlyph kind={tab} active={i === 0} on={t.text} off={t.tabIdle} />
          </div>
        ))}
      </div>

      {/* ── The grid. 4:5, three across (§4). ────────────────────────────── */}
      <div className="grid grid-cols-3 gap-[2px]">
        {orderedTiles(m).map(tile => (
          <div key={tile.id} className="relative aspect-[4/5]" style={{ background: t.empty }}>
            <ImageSlot
              url={tile.imageUrl}
              onFile={props.onTileImage ? f => props.onTileImage!(tile.id, f) : undefined}
              editing={editing}
              className="h-full w-full"
              wrapperClassName="h-full w-full"
              innerClassName=""
              label="post"
            />
            {(tile.pinned || editing) && (
              <button
                type="button"
                disabled={!editing}
                onClick={() => props.onTogglePin?.(tile.id)}
                aria-label={tile.pinned ? 'Unpin this post' : 'Pin this post'}
                className={`absolute right-1.5 top-1.5 ${tile.pinned ? '' : 'opacity-0 hover:opacity-70'}`}
              >
                <Pin size={19} fill={t.text} stroke={t.text} strokeWidth={1.5}
                  className="rotate-45 drop-shadow-[0_1px_2px_rgba(0,0,0,.5)]" />
              </button>
            )}
          </div>
        ))}
      </div>

    </div>
  );
}

/**
 * Text that edits where it sits.
 *
 * Not an input with a border: a `contentEditable` span that looks exactly like
 * the text it replaces, because a form field drawn on Instagram would be the
 * flair she said she does not want. The placeholder shows only while editing,
 * so a shared mockup with an empty bio shows an empty bio and not the word
 * "Bio".
 */
function Text({ value, onChange, editing, className, placeholder, multiline, display }: {
  value: string;
  onChange?: (v: string) => void;
  editing: boolean;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
  display?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const can = editing && !!onChange;

  if (!can) return <span className={className}>{display ?? value}</span>;

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={placeholder}
      onBlur={e => onChange!(e.currentTarget.innerText.replace(/\n+$/, ''))}
      onKeyDown={e => {
        if (e.key === 'Enter' && !multiline) { e.preventDefault(); e.currentTarget.blur(); }
        if (e.key === 'Escape') { e.currentTarget.innerText = value; e.currentTarget.blur(); }
      }}
      // The placeholder dims the INHERITED colour rather than being a colour of
      // its own, so it is legible in both themes. It was white, which meant it
      // simply vanished the first time the mockup was drawn in light mode.
      style={{ opacity: value ? 1 : 0.4 }}
      className={`${className ?? ''} cursor-text rounded-[3px] outline-none focus:bg-current/[.07]`}
    >
      {value || placeholder}
    </span>
  );
}

/**
 * A picture that replaces itself.
 *
 * The whole slot is the control: tap it, the browser's own file picker opens.
 * Nothing is drawn over the image, so a filled slot is just the picture. An
 * empty one is the flat grey Instagram would show, which is also honest: it is
 * a post she has not chosen yet.
 *
 * `object-cover` is what makes §7.3 true: a landscape photo fills a 4:5 tile by
 * cropping, never by stretching.
 */
function ImageSlot({ url, onFile, editing, className, wrapperClassName, wrapperStyle, innerClassName, innerStyle, label }: {
  url: string;
  onFile?: (file: File) => void;
  editing: boolean;
  className?: string;
  wrapperClassName?: string;
  wrapperStyle?: React.CSSProperties;
  innerClassName?: string;
  /** The avatar's inner border follows the page colour, so it reads as a gap. */
  innerStyle?: React.CSSProperties;
  label: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const can = editing && !!onFile;

  const picture = url
    ? <img src={url} alt="" style={innerStyle}
        className={`${className ?? ''} ${innerClassName ?? ''} object-cover`} />
    : <div style={innerStyle} className={`${className ?? ''} ${innerClassName ?? ''} bg-current opacity-10`} />;

  if (!can) return <div className={wrapperClassName} style={wrapperStyle}>{picture}</div>;

  return (
    <div className={wrapperClassName} style={wrapperStyle}>
      <button type="button" onClick={() => input.current?.click()}
        aria-label={`Change the ${label}`} className="block">
        {picture}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) onFile!(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

/** The four tab icons, drawn small. Furniture: none of them do anything. */
function TabGlyph({ kind, active, on, off }: { kind: string; active: boolean; on: string; off: string }) {
  const c = active ? on : off;
  const box = 'mx-auto block';
  if (kind === 'grid') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" className={box} fill={c}>
        {[0, 8.5, 17].flatMap(x => [0, 8.5, 17].map(y => (
          <rect key={`${x}-${y}`} x={x} y={y} width="6.4" height="6.4" rx="1" />
        )))}
      </svg>
    );
  }
  if (kind === 'reels') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" className={box} fill="none" stroke={c} strokeWidth="1.9">
        <rect x="2.5" y="2.5" width="19" height="19" rx="4.5" />
        <path d="M10 8.5v7l6-3.5z" fill={c} stroke="none" />
      </svg>
    );
  }
  if (kind === 'repost') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" className={box} fill="none" stroke={c} strokeWidth="1.9"
        strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 9h12l-3-3M20 15H8l3 3" />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" className={box} fill="none" stroke={c} strokeWidth="1.9">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="12" cy="10" r="3" />
      <path d="M6.5 20c1.2-3 3.2-4.5 5.5-4.5s4.3 1.5 5.5 4.5" />
    </svg>
  );
}
