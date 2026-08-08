'use client';

// The rest of the inputs, each small enough to live beside the others:
// cadence, working mode, voice, boundaries, obligations, proof, and the three
// that genuinely are prose.

import { Minus, Plus, Trash2 } from 'lucide-react';
import {
  AUDIENCE_STAGES, BOUNDARY_GROUPS, CTA_SUGGESTIONS, VOICE_SUGGESTIONS,
  WORKING_MODE_IDEAS, WORKING_MODE_POSTING,
  type AudienceValue, type BoundariesValue, type CadenceValue, type ObligationsValue,
  type ProofItem, type VoiceValue, type WorkingModeValue,
} from '@/lib/strategy/inputs';
import { ChipGroup, IconButton, Kicker, LineBox, Pick, TextBox } from './ui';

// ── Cadence: a number, per week or per month ────────────────────────────────

export function Cadence({
  value, onChange,
}: { value: CadenceValue; onChange: (next: CadenceValue) => void }) {
  const n = value.count ?? 0;
  return (
    <div>
      <Kicker>How much goes out</Kicker>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-[10px] border border-hairline bg-white px-2 py-1.5">
          <IconButton onClick={() => onChange({ ...value, count: Math.max(0, n - 1) || null })} label="One less">
            <Minus size={16} strokeWidth={2.2} />
          </IconButton>
          <input
            type="number"
            min={0}
            value={value.count ?? ''}
            onChange={e => {
              const v = Number(e.target.value);
              onChange({ ...value, count: e.target.value === '' || Number.isNaN(v) ? null : v });
            }}
            className="tnum w-[54px] border-0 bg-transparent text-center text-[18px] font-semibold text-text focus:outline-none"
          />
          <IconButton onClick={() => onChange({ ...value, count: n + 1 })} label="One more">
            <Plus size={16} strokeWidth={2.2} />
          </IconButton>
        </div>
        <span className="text-[13.5px] text-muted">pieces</span>
        <Pick on={value.per === 'week'} onClick={() => onChange({ ...value, per: 'week' })}>a week</Pick>
        <Pick on={value.per === 'month'} onClick={() => onChange({ ...value, per: 'month' })}>a month</Pick>
      </div>
    </div>
  );
}

// ── Working mode: two picks ─────────────────────────────────────────────────

export function WorkingMode({
  value, onChange,
}: { value: WorkingModeValue; onChange: (next: WorkingModeValue) => void }) {
  return (
    <div className="space-y-3.5">
      <div>
        <Kicker>Where the ideas come from</Kicker>
        <div className="flex flex-wrap gap-1.5">
          {WORKING_MODE_IDEAS.map(o => (
            <Pick key={o.id} on={value.ideas === o.id} onClick={() => onChange({ ...value, ideas: o.id })}>
              {o.label}
            </Pick>
          ))}
        </div>
      </div>
      <div>
        <Kicker>Who presses post</Kicker>
        <div className="flex flex-wrap gap-1.5">
          {WORKING_MODE_POSTING.map(o => (
            <Pick key={o.id} on={value.posting === o.id} onClick={() => onChange({ ...value, posting: o.id })}>
              {o.label}
            </Pick>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Voice: word chips, two groups ───────────────────────────────────────────

export function Voice({
  value, onChange,
}: { value: VoiceValue; onChange: (next: VoiceValue) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <Kicker>Sounds like</Kicker>
        <ChipGroup
          value={value.sounds_like}
          onChange={v => onChange({ ...value, sounds_like: v })}
          suggestions={VOICE_SUGGESTIONS.sounds_like}
          placeholder="A word it sounds like"
        />
      </div>
      <div>
        <Kicker>Never says</Kicker>
        <ChipGroup
          value={value.never_says}
          onChange={v => onChange({ ...value, never_says: v })}
          suggestions={VOICE_SUGGESTIONS.never_says}
          placeholder="A word it never says"
        />
      </div>
    </div>
  );
}

// ── CTAs: chips ─────────────────────────────────────────────────────────────

export function Ctas({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  return (
    <div>
      <Kicker>The asks you will use</Kicker>
      <ChipGroup value={value} onChange={onChange} suggestions={CTA_SUGGESTIONS} placeholder="Another ask" />
    </div>
  );
}

// ── Boundaries: chips, three groups ─────────────────────────────────────────

export function Boundaries({
  value, onChange,
}: { value: BoundariesValue; onChange: (next: BoundariesValue) => void }) {
  return (
    <div className="space-y-4">
      {BOUNDARY_GROUPS.map(g => (
        <div key={g.id}>
          <Kicker>{g.label}</Kicker>
          <ChipGroup
            value={value[g.id]}
            onChange={v => onChange({ ...value, [g.id]: v })}
            placeholder="Add a line"
          />
        </div>
      ))}
    </div>
  );
}

// ── Obligations: two lists ──────────────────────────────────────────────────

export function Obligations({
  value, onChange,
}: { value: ObligationsValue; onChange: (next: ObligationsValue) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <Kicker>What they owe us</Kicker>
        <ChipGroup
          value={value.theirs}
          onChange={v => onChange({ ...value, theirs: v })}
          placeholder="Photos each month, and so on"
        />
      </div>
      <div>
        <Kicker>What we owe them</Kicker>
        <ChipGroup
          value={value.ours}
          onChange={v => onChange({ ...value, ours: v })}
          placeholder="The calendar by the 25th, and so on"
        />
      </div>
    </div>
  );
}

// ── Proof library: a list of items, each a line and a link ──────────────────

export function Proof({
  value, onChange,
}: { value: ProofItem[]; onChange: (next: ProofItem[]) => void }) {
  function set(i: number, patch: Partial<ProofItem>) {
    onChange(value.map((p, n) => (n === i ? { ...p, ...patch } : p)));
  }
  return (
    <div>
      <Kicker>What we are allowed to show</Kicker>
      <div className="space-y-2">
        {value.map((p, i) => (
          <div key={i} className="rounded-card border border-hairline bg-white p-3">
            <div className="flex items-center gap-2">
              <LineBox value={p.line} onChange={v => set(i, { line: v })} placeholder="The win, in one line" wide />
              <IconButton onClick={() => onChange(value.filter((_, n) => n !== i))} label="Remove this one">
                <Trash2 size={16} strokeWidth={1.9} />
              </IconButton>
            </div>
            <div className="mt-2">
              <LineBox value={p.link} onChange={v => set(i, { link: v })} placeholder="Where it lives, if it lives somewhere" wide />
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...value, { line: '', link: '' }])}
        className="mt-2.5 flex items-center gap-1.5 rounded-[10px] bg-ink px-3 py-2 text-[12.5px] font-semibold text-white"
      >
        <Plus size={14} strokeWidth={2.4} />
        Add proof
      </button>
    </div>
  );
}

// ── The three that genuinely are prose ──────────────────────────────────────

export function Prose({
  value, onChange, placeholder,
}: { value: string; onChange: (next: string) => void; placeholder: string }) {
  return (
    <div>
      <Kicker>Your decision</Kicker>
      <TextBox value={value} onChange={onChange} placeholder={placeholder} rows={4} />
    </div>
  );
}

export function Audience({
  value, onChange,
}: { value: AudienceValue; onChange: (next: AudienceValue) => void }) {
  return (
    <div className="space-y-3.5">
      <div>
        <Kicker>Who this talks to</Kicker>
        <TextBox
          value={value.who}
          onChange={v => onChange({ ...value, who: v })}
          placeholder="Who they are, and what they are stuck on"
          rows={3}
        />
      </div>
      <div>
        <Kicker>How far along they already are</Kicker>
        <div className="flex flex-wrap gap-1.5">
          {AUDIENCE_STAGES.map(s => {
            const on = value.stages.includes(s);
            return (
              <Pick
                key={s}
                on={on}
                onClick={() => onChange({
                  ...value,
                  stages: on ? value.stages.filter(x => x !== s) : [...value.stages, s],
                })}
              >
                {s}
              </Pick>
            );
          })}
        </div>
      </div>
    </div>
  );
}
