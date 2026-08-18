'use client';

// The eight fact rows, extracted from components/strategy/Facts.tsx so that
// Intake and Strategy render the SAME boxes rather than two that drift.
//
// Why this file exists at all, in her words on 2026-08-11: "I am particularly
// annoyed with the intake section... make it simple... have a proper UI/UX
// working: what will proceed where." The old answer was three screens holding
// one set of information — Strategy → Facts had the boxes, Intake → Rounds sent
// the questions, Intake → Curation filed what came back. Nothing told her which
// was the real one.
//
// So the boxes move here, both screens render them, and asking happens in ONE
// place (Intake). Nothing about the storage changed: every row still writes
// through the dispatch actions the boards already read.

import { useState } from 'react';
import Link from 'next/link';
import { Pencil, Plus } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import { generateId, CLIENT_COLORS } from '@/lib/utils';
import { CLIENT_GOALS, DEFAULT_PLATFORMS, type BrandOverview, type ContentPillar } from '@/types';
import { factAnswers, type FactAnswer } from '@/lib/intake/factsRound';

export default function FactRows({ profileId, brandHref }: {
  profileId: string;
  /** Where "edit in the brand kit" goes. Differs by which shell renders us. */
  brandHref: string;
}) {
  const { dispatch } = useApp();
  const { data } = useClient(profileId);

  const brand = data.brand;
  const brandKit = data.brandKit ?? { colors: [], fonts: [] };
  const platforms = data.platforms ?? [];
  const goals = data.goals ?? [];
  // What the client already said, waiting under the box it was asked for.
  const answered = factAnswers(data.body);

  function saveBrand(patch: Partial<BrandOverview>) {
    dispatch({ type: 'UPDATE_BRAND', payload: { clientId: profileId, brand: { ...brand, ...patch } } });
  }

  function togglePlatform(name: string) {
    const next = platforms.includes(name) ? platforms.filter(p => p !== name) : [...platforms, name];
    dispatch({ type: 'SET_PLATFORMS', payload: { clientId: profileId, platforms: next } });
  }

  function toggleGoal(id: (typeof CLIENT_GOALS)[number]['id']) {
    const next = goals.includes(id) ? goals.filter(g => g !== id) : [...goals, id];
    dispatch({ type: 'SET_GOALS', payload: { clientId: profileId, goals: next } });
  }

  const platformNames = [...DEFAULT_PLATFORMS, ...platforms.filter(p => !DEFAULT_PLATFORMS.includes(p))];

  return (
    <div className="space-y-2.5">
      <TextFact label="Positioning" question="What do they do, and for whom?"
        value={brand.tagline} onSave={v => saveBrand({ tagline: v })} answer={answered.Positioning} />
      <TextFact label="Audience" question="Who are they talking to?"
        value={brand.audience} onSave={v => saveBrand({ audience: v })} answer={answered.Audience} />
      <TextFact label="Voice" question="What do they sound like?"
        value={brand.voice ?? ''} onSave={v => saveBrand({ voice: v })} answer={answered.Voice} />

      <PillarsFact profileId={profileId} answer={answered.Pillars} />

      <FactCard label="Platforms" question="Where do they post?" answer={answered.Platforms}>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {platformNames.map(name => {
            const on = platforms.includes(name);
            return (
              <button key={name} type="button" onClick={() => togglePlatform(name)}
                className={`rounded-[10px] px-[13px] py-[7px] text-[12.5px] font-semibold ${
                  on ? 'bg-ink text-white' : 'bg-control text-muted hover:text-text'
                }`}>
                {name}
              </button>
            );
          })}
        </div>
      </FactCard>

      <CadenceFact
        value={data.postTarget ?? 0}
        onSave={n => dispatch({ type: 'SET_POST_TARGET', payload: { clientId: profileId, target: n } })}
        answer={answered.Cadence}
      />

      <GoalsFact goals={goals} onToggle={toggleGoal} answer={answered.Goals} />

      <FactCard label="Look" question="Colours, type, treatment." answer={answered.Look}>
        {brandKit.colors.length === 0 && brandKit.fonts.length === 0 ? (
          <p className="mt-2 text-[13px] text-faint">Nothing in the brand kit yet.</p>
        ) : (
          <div className="mt-2.5 space-y-2">
            {brandKit.colors.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {brandKit.colors.map(c => (
                  <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full bg-control px-2.5 py-1 text-[11.5px] font-semibold text-muted">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c.hex }} />
                    {c.name || c.hex}
                  </span>
                ))}
              </div>
            )}
            {brandKit.fonts.length > 0 && (
              <p className="text-[13px] text-muted">
                {brandKit.fonts.map(f => `${f.name}${f.role ? ` (${f.role})` : ''}`).join(' · ')}
              </p>
            )}
          </div>
        )}
        <Link href={brandHref} className="mt-2.5 inline-block text-[12.5px] font-semibold text-accent hover:underline">
          Edit in the brand kit
        </Link>
      </FactCard>
    </div>
  );
}

// ── The pieces ───────────────────────────────────────────────────────────────

/**
 * One card. `answer` is the client's raw words, and it is shown on EVERY shape,
 * not only the text ones (the old page dropped it on pillars, platforms,
 * cadence, goals and look — five of eight — so a client could answer and she
 * would never see it). Where the shape cannot take it with one tap, it is shown
 * to read and copy from, which is honest about what the box can do.
 */
export function FactCard({ label, question, children, answer, onUse }: {
  label: string; question: string; children: React.ReactNode;
  answer?: FactAnswer;
  /** Given only where one tap can land it. Otherwise their words just show. */
  onUse?: (value: string) => void;
}) {
  return (
    <section className="rounded-card border border-hairline bg-white p-4 shadow-card">
      <p className="text-[14.5px] font-semibold text-text">{label}</p>
      <p className="mt-0.5 text-[12.5px] text-faint">{question}</p>
      {children}
      {answer && <TheirWords answer={answer} onUse={onUse} />}
    </section>
  );
}

function TheirWords({ answer, onUse }: { answer: FactAnswer; onUse?: (v: string) => void }) {
  return (
    <div className="mt-2 rounded-xl bg-chip px-3 py-2.5">
      <p className="text-[11.5px] font-bold uppercase tracking-[.09em] text-muted">What they said</p>
      <p className="mt-1 whitespace-pre-wrap text-[13px] leading-[1.55] text-text">{answer.value}</p>
      {onUse && (
        <button type="button" onClick={() => onUse(answer.value)}
          className="mt-2 rounded-lg bg-ink px-3 py-1.5 text-[12px] font-semibold text-white">
          Use this
        </button>
      )}
    </div>
  );
}

/**
 * A one-box text fact — read first, edit on the pencil (2026-08-11).
 *
 * Her note, looking at Riti's filled profile: "make sure the box takes shape
 * of the answers and the answer is visible and readable completely, and also
 * incorporate an edit pen for edits." A filled box used to stay a two-row
 * textarea with its own scrollbar, so a five-line answer showed two lines of
 * itself. A recorded answer is a thing to READ; the box is only for changing
 * it. So: filled renders as text at its full height with a pencil, blank
 * renders as the box straight away, and the textarea sizes to the content
 * while it is open.
 */
function TextFact({ label, question, value, onSave, answer }: {
  label: string; question: string; value: string; onSave: (v: string) => void;
  answer?: FactAnswer;
}) {
  return (
    <FactCard label={label} question={question}
      answer={answer && !value.trim() ? answer : undefined} onUse={onSave}>
      <GrowingText value={value} onSave={onSave} placeholder="Type it when you know it" />
    </FactCard>
  );
}

/** Read view with a pencil when filled; a content-sized textarea when editing
 *  or empty. Shared by every prose box on this screen. */
export function GrowingText({ value, onSave, placeholder }: {
  value: string; onSave: (v: string) => void; placeholder: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);

  const filled = !!value.trim();
  const text = draft ?? value;
  // The box takes the shape of the answer: sized to its lines, capped so a
  // pasted essay scrolls rather than swallowing the screen.
  const rows = Math.min(24, Math.max(3, text.split('\n').length + 1));

  if (filled && !editing) {
    return (
      <div className="group relative mt-2.5 rounded-xl bg-chip px-3 py-2.5 pr-10">
        <p className="whitespace-pre-wrap text-[14px] leading-[1.65] text-text">{value}</p>
        <button type="button" aria-label="Edit"
          onClick={() => { setDraft(value); setEditing(true); }}
          className="absolute right-2 top-2 rounded-lg p-1.5 text-faint hover:bg-white hover:text-text">
          <Pencil size={14} strokeWidth={2.1} />
        </button>
      </div>
    );
  }

  return (
    <textarea
      autoFocus={editing}
      value={text}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null && draft.trim() !== value.trim()) onSave(draft.trim());
        setDraft(null);
        setEditing(false);
      }}
      rows={rows}
      placeholder={placeholder}
      className="mt-2.5 w-full resize-y rounded-xl border border-[rgba(23,21,26,.12)] bg-white px-3 py-2.5 text-sm leading-[1.65] text-text placeholder:text-faint focus:border-accent focus:outline-none"
    />
  );
}

function CadenceFact({ value, onSave, answer }: {
  value: number; onSave: (n: number) => void; answer?: FactAnswer;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <FactCard label="Cadence" question="How often do they post?" answer={value > 0 ? undefined : answer}>
      <div className="mt-2.5 flex items-center gap-2">
        <input
          type="number" min={0}
          value={draft ?? (value > 0 ? String(value) : '')}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => {
            if (draft !== null) {
              const n = Math.max(0, Math.round(Number(draft) || 0));
              if (n !== value) onSave(n);
            }
            setDraft(null);
          }}
          placeholder="0"
          className="tnum w-24 rounded-xl border border-[rgba(23,21,26,.12)] bg-white px-3 py-2.5 text-sm text-text placeholder:text-faint focus:border-accent focus:outline-none"
        />
        <span className="text-[13px] text-muted">posts each month</span>
      </div>
    </FactCard>
  );
}

/** The pillars fact: the list as it is, and an inline add. Reuses ADD_PILLAR. */
function PillarsFact({ profileId, answer }: { profileId: string; answer?: FactAnswer }) {
  const { dispatch } = useApp();
  const { data } = useClient(profileId);
  const pillars = data.pillars ?? [];

  const [name, setName] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const nextColor = color ?? CLIENT_COLORS[pillars.length % CLIENT_COLORS.length];

  // Editing one that already exists (2026-08-17).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState<string | null>(null);

  function saveEdit(p: ContentPillar) {
    const n = editName.trim();
    if (!n) return;                                  // a nameless pillar is not a pillar
    if (n !== p.name || (editColor && editColor !== p.color)) {
      dispatch({
        type: 'UPDATE_PILLAR',
        payload: { clientId: profileId, pillar: { ...p, name: n, color: editColor ?? p.color } },
      });
    }
    setEditingId(null);
  }

  /**
   * Removing a pillar does NOT remove the work filed under it: the reducer
   * moves those posts to Unsorted, and only the legacy topic cards go with it.
   * The old Pillars screen asked "Delete this pillar and all its topic cards?",
   * which reads as though a month of posts is about to vanish. It is not, and
   * the question should say what actually happens.
   */
  function remove(p: ContentPillar) {
    const filed = (data.contentCards ?? []).filter(c => c.pillarId === p.id).length;
    const line = filed
      ? `Remove "${p.name}"? The ${filed} post${filed === 1 ? '' : 's'} filed under it stay, and move to Unsorted.`
      : `Remove "${p.name}"?`;
    if (!confirm(line)) return;
    dispatch({ type: 'DELETE_PILLAR', payload: { clientId: profileId, pillarId: p.id } });
    setEditingId(null);
  }

  function add() {
    const n = name.trim();
    if (!n) return;
    dispatch({
      type: 'ADD_PILLAR',
      payload: {
        clientId: profileId,
        pillar: { id: generateId(), name: n, color: nextColor, createdAt: new Date().toISOString() },
      },
    });
    setName('');
    setColor(null);
  }

  return (
    <FactCard label="Pillars" question="What do they talk about?"
      answer={pillars.length ? undefined : answer}>
      {/* A pillar is EDITABLE here (2026-08-17, her request: "give me edit
          access to rename or delete the pillars"). It was add-only, so a typo
          was permanent and a pillar she stopped using could never leave.
          UPDATE_PILLAR and DELETE_PILLAR already existed and are what the old
          Pillars screen used; this is the same feature at the address she
          actually works from, not a second one. Tap a pillar to open it. */}
      {pillars.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {pillars.map(p => (
            editingId === p.id ? (
              <span key={p.id} className="inline-flex w-full flex-col gap-2 rounded-xl border border-[rgba(23,21,26,.12)] bg-white p-2.5 sm:w-auto sm:flex-row sm:items-center">
                <input
                  autoFocus
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveEdit(p);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="min-w-0 flex-1 rounded-lg border border-[rgba(23,21,26,.12)] px-2.5 py-1.5 text-[13px] text-text focus:border-accent focus:outline-none"
                />
                <span className="flex items-center gap-1.5">
                  {CLIENT_COLORS.slice(0, 6).map(c => (
                    <button key={c} type="button" aria-label={`Use colour ${c}`} onClick={() => setEditColor(c)}
                      className={`h-5 w-5 rounded-full ${c === (editColor ?? p.color) ? 'ring-2 ring-ink ring-offset-1' : ''}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </span>
                <span className="flex items-center gap-1.5">
                  <button type="button" onClick={() => saveEdit(p)}
                    className="rounded-lg bg-ink px-3 py-1.5 text-[12px] font-semibold text-white">
                    Save
                  </button>
                  <button type="button" onClick={() => setEditingId(null)}
                    className="rounded-lg px-2 py-1.5 text-[12px] font-semibold text-muted hover:text-text">
                    Cancel
                  </button>
                  <button type="button" onClick={() => remove(p)}
                    className="rounded-lg px-2 py-1.5 text-[12px] font-semibold text-muted hover:text-accent-text">
                    Remove
                  </button>
                </span>
              </span>
            ) : (
              <button
                key={p.id}
                type="button"
                title={`Edit ${p.name}`}
                onClick={() => { setEditingId(p.id); setEditName(p.name); setEditColor(null); }}
                className="inline-flex items-center gap-1.5 rounded-full bg-control px-2.5 py-1 text-[12px] font-semibold text-text hover:bg-[rgba(23,21,26,.09)]"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                {p.name}
              </button>
            )
          ))}
        </div>
      )}
      <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add(); }}
          placeholder="New pillar name"
          className="min-w-0 flex-1 rounded-xl border border-[rgba(23,21,26,.12)] bg-white px-3 py-2.5 text-sm text-text placeholder:text-faint focus:border-accent focus:outline-none"
        />
        <div className="flex items-center gap-1.5">
          {CLIENT_COLORS.slice(0, 6).map(c => (
            <button key={c} type="button" aria-label={`Use colour ${c}`} onClick={() => setColor(c)}
              className={`h-6 w-6 rounded-full ${c === nextColor ? 'ring-2 ring-ink ring-offset-1' : ''}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
        <button type="button" onClick={add} disabled={!name.trim()}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40">
          <Plus size={15} strokeWidth={2.2} />
          Add
        </button>
      </div>
    </FactCard>
  );
}


/**
 * Goals, with hers beside the suggestions — 2026-08-11.
 *
 * The three standard goals were a closed list, and her note was "give me more
 * options, let me add options". So the three stay as suggestions and anything
 * she types joins them as a chip of equal standing: toggled the same way,
 * stored in the same list, removable by unticking. Nothing downstream treats a
 * typed goal differently, because nothing downstream ever did more than count
 * and list them.
 */
function GoalsFact({ goals, onToggle, answer }: {
  goals: string[];
  onToggle: (goal: string) => void;
  answer?: FactAnswer;
}) {
  const [adding, setAdding] = useState('');

  const suggested = CLIENT_GOALS.map(g => g.id);
  const custom = goals.filter(g => !suggested.includes(g));

  function addOwn() {
    const goal = adding.trim();
    if (!goal || goals.includes(goal)) { setAdding(''); return; }
    onToggle(goal);
    setAdding('');
  }

  return (
    <FactCard label="Goals" question="What would success look like?"
      answer={goals.length ? undefined : answer}>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {CLIENT_GOALS.map(g => {
          const on = goals.includes(g.id);
          return (
            <button key={g.id} type="button" onClick={() => onToggle(g.id)} title={g.sub}
              className={`rounded-[10px] px-[13px] py-[7px] text-[12.5px] font-semibold ${
                on ? 'bg-ink text-white' : 'bg-control text-muted hover:text-text'
              }`}>
              {g.label}
            </button>
          );
        })}
        {custom.map(g => (
          <button key={g} type="button" onClick={() => onToggle(g)} title="Remove this goal"
            className="rounded-[10px] bg-ink px-[13px] py-[7px] text-[12.5px] font-semibold text-white">
            {g}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5">
        <input
          value={adding}
          onChange={e => setAdding(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addOwn(); }}
          placeholder="Add your own goal"
          className="min-w-0 flex-1 rounded-xl border border-[rgba(23,21,26,.12)] bg-white px-3 py-2 text-[13px] text-text placeholder:text-faint focus:border-accent focus:outline-none"
        />
        <button type="button" onClick={addOwn} disabled={!adding.trim()}
          className="rounded-xl bg-ink px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-40">
          Add
        </button>
      </div>
    </FactCard>
  );
}
