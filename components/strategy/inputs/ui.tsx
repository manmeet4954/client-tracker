'use client';

// The small parts every Decide input is built from. Spec 34 §3.
//
// One rule runs through all of them: a control that is a choice looks like a
// choice. Nothing here is a text box pretending to be a decision.

import type { ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';

export function Kicker({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-bold uppercase tracking-[.12em] text-faint">{children}</p>
  );
}

export function Pick({
  on, children, onClick, title,
}: { on: boolean; children: ReactNode; onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`rounded-[10px] px-[13px] py-[7px] text-[12.5px] font-semibold transition-colors ${
        on ? 'bg-ink text-white' : 'border border-hairline bg-white text-muted hover:text-text'
      }`}
    >
      {children}
    </button>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-1.5">{children}</div>;
}

export function TextBox({
  value, onChange, placeholder, rows = 3,
}: { value: string; onChange: (v: string) => void; placeholder: string; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="w-full rounded-xl border border-hairline bg-white px-3 py-2.5 text-[14px] leading-[1.55] text-text placeholder:text-faint focus:border-[rgba(23,21,26,.3)] focus:outline-none"
    />
  );
}

export function LineBox({
  value, onChange, placeholder, wide,
}: { value: string; onChange: (v: string) => void; placeholder: string; wide?: boolean }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${wide ? 'flex-1 ' : ''}min-w-0 rounded-[10px] border border-hairline bg-white px-3 py-2 text-[13.5px] text-text placeholder:text-faint focus:border-[rgba(23,21,26,.3)] focus:outline-none`}
    />
  );
}

/** A word she picked, with the way to take it back off. */
export function Tag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[10px] bg-ink py-[6px] pl-[11px] pr-[7px] text-[12.5px] font-semibold text-white">
      {label}
      <button type="button" onClick={onRemove} aria-label={`Remove ${label}`} className="flex text-white/60 hover:text-white">
        <X size={13} strokeWidth={2.4} />
      </button>
    </span>
  );
}

/**
 * A group of words: the ones she picked, the ones on offer, and a box to add
 * one that is not. Used by voice, CTAs, boundaries and obligations.
 */
export function ChipGroup({
  value, onChange, suggestions = [], placeholder,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
  placeholder: string;
}) {
  const [draft, setDraft] = useState('');
  const has = (w: string) => value.some(v => v.toLowerCase() === w.toLowerCase());

  function add(word: string) {
    const w = word.trim();
    if (!w || has(w)) { setDraft(''); return; }
    onChange([...value, w]);
    setDraft('');
  }

  const offered = suggestions.filter(s => !has(s));

  return (
    <div>
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map(w => (
            <Tag key={w} label={w} onRemove={() => onChange(value.filter(v => v !== w))} />
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <LineBox value={draft} onChange={setDraft} placeholder={placeholder} wide />
        <button
          type="button"
          onClick={() => add(draft)}
          disabled={!draft.trim()}
          className="flex shrink-0 items-center gap-1 rounded-[10px] bg-ink px-3 py-2 text-[12.5px] font-semibold text-white disabled:opacity-30"
        >
          <Plus size={14} strokeWidth={2.4} />
          Add
        </button>
      </div>
      {offered.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {offered.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-[10px] border border-hairline bg-white px-[11px] py-[6px] text-[12.5px] text-muted hover:text-text"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-card border border-hairline bg-white p-3.5">{children}</div>;
}

export function IconButton({
  onClick, label, children,
}: { onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="flex shrink-0 text-faint hover:text-accent-text">
      {children}
    </button>
  );
}
