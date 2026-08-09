'use client';

// Strategy room → Facts. Strategy as a layer, not a gate.
//
// One simple page of eight facts per profile. She types into any box at any
// time. A blank box sits blank; nothing is gated by a blank. The status line
// at the top is derived from the data and never blocks anything.
//
// Every write goes through the dispatch actions the existing screens already
// use, so a fact typed here is the same fact the Brand page, the Journey tab
// and the boards read. No new storage, no new routes.

import { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import { generateId, CLIENT_COLORS } from '@/lib/utils';
import { CLIENT_GOALS, DEFAULT_PLATFORMS, type BrandOverview } from '@/types';
import { draftingNote, factsKnown, factsLine } from '@/lib/strategy/facts';
import {
  FACT_ASKS, askableBlanks, factAnswers, openFactsRound, type FactAnswer, type FactName,
} from '@/lib/intake/factsRound';

export default function Facts({ profileId, brandHref }: { profileId: string; brandHref: string }) {
  const { role, dispatch } = useApp();
  const { data } = useClient(profileId);

  // Owner only, always, in every switch position (spec 34 §2).
  if (role !== 'owner') return <p className="p-8 text-sm text-faint">This screen is hers.</p>;

  const brand = data.brand;
  const brandKit = data.brandKit ?? { colors: [], fonts: [] };
  const pillars = data.pillars ?? [];
  const platforms = data.platforms ?? [];
  const goals = data.goals ?? [];

  const count = factsKnown(data);
  const note = draftingNote(count);
  // What the client already answered, waiting under the box it was asked for.
  const answered = factAnswers(data.body);

  function saveBrand(patch: Partial<BrandOverview>) {
    dispatch({ type: 'UPDATE_BRAND', payload: { clientId: profileId, brand: { ...brand, ...patch } } });
  }

  function togglePlatform(name: string) {
    const next = platforms.includes(name)
      ? platforms.filter(p => p !== name)
      : [...platforms, name];
    dispatch({ type: 'SET_PLATFORMS', payload: { clientId: profileId, platforms: next } });
  }

  function toggleGoal(id: (typeof CLIENT_GOALS)[number]['id']) {
    const next = goals.includes(id) ? goals.filter(g => g !== id) : [...goals, id];
    dispatch({ type: 'SET_GOALS', payload: { clientId: profileId, goals: next } });
  }

  const platformNames = [...DEFAULT_PLATFORMS, ...platforms.filter(p => !DEFAULT_PLATFORMS.includes(p))];

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-4">
        <h2 className="font-display text-[21px] font-bold tracking-[-.02em] text-text">Facts</h2>
        <p className="tnum mt-1.5 text-[13.5px] font-semibold text-muted">{factsLine(count)}</p>
        {note && <p className="mt-1 text-[12.5px] leading-[1.6] text-faint">{note}</p>}
      </header>

      <div className="space-y-2.5">
        <TextFact
          label="Positioning"
          question="What do they do, and for whom?"
          value={brand.tagline}
          onSave={v => saveBrand({ tagline: v })}
          answer={answered.Positioning}
        />
        <TextFact
          label="Audience"
          question="Who are they talking to?"
          value={brand.audience}
          onSave={v => saveBrand({ audience: v })}
          answer={answered.Audience}
        />
        <TextFact
          label="Voice"
          question="What do they sound like?"
          value={brand.voice ?? ''}
          onSave={v => saveBrand({ voice: v })}
          answer={answered.Voice}
        />

        <PillarsFact profileId={profileId} />

        {/* Platforms */}
        <FactCard label="Platforms" question="Where do they post?">
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {platformNames.map(name => {
              const on = platforms.includes(name);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => togglePlatform(name)}
                  className={`rounded-[10px] px-[13px] py-[7px] text-[12.5px] font-semibold ${
                    on ? 'bg-ink text-white' : 'bg-control text-muted hover:text-text'
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </FactCard>

        {/* Cadence */}
        <CadenceFact
          value={data.postTarget ?? 0}
          onSave={n => dispatch({ type: 'SET_POST_TARGET', payload: { clientId: profileId, target: n } })}
        />

        {/* Goals */}
        <FactCard label="Goals" question="What would success look like?">
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {CLIENT_GOALS.map(g => {
              const on = goals.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleGoal(g.id)}
                  title={g.sub}
                  className={`rounded-[10px] px-[13px] py-[7px] text-[12.5px] font-semibold ${
                    on ? 'bg-ink text-white' : 'bg-control text-muted hover:text-text'
                  }`}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        </FactCard>

        {/* Look */}
        <FactCard label="Look" question="Colours, type, treatment.">
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

      <AskTheBlanks profileId={profileId} answered={answered} />
    </div>
  );
}

/**
 * The questionnaire, built FROM THE GAPS. Every blank fact is a chip, on by
 * default; she unticks what she would rather fill herself, and one button makes
 * the round and marks it sent. The client link is the one Intake already has.
 * A fact she has filled is never offered, so nothing is ever asked twice.
 */
function AskTheBlanks({ profileId, answered }: {
  profileId: string;
  answered: Partial<Record<FactName, FactAnswer>>;
}) {
  const { dispatch } = useApp();
  const { data } = useClient(profileId);
  const [skipped, setSkipped] = useState<FactName[]>([]);
  const [note, setNote] = useState('');

  const body = data.body;
  const blanks = askableBlanks(factsKnown(data))
    // A blank with their answer already under it does not need asking again.
    .filter(f => !answered[f]);
  const chosen = blanks.filter(f => !skipped.includes(f));

  if (!body || blanks.length === 0) return null;

  function send() {
    if (!body || chosen.length === 0) return;
    const { body: next, round } = openFactsRound(body, chosen, new Date().toISOString());
    dispatch({ type: 'SET_BODY', payload: { clientId: profileId, body: next } });
    setNote(`Round ${round.version} is ready, asking ${chosen.length === 1 ? 'one blank' : `${chosen.length} blanks`}. `);
  }

  return (
    <section className="mt-5 rounded-card border border-hairline bg-white p-4 shadow-card">
      <p className="text-[14.5px] font-semibold text-text">Ask the client to fill the blanks</p>
      <p className="mt-0.5 text-[12.5px] text-faint">
        One question per blank box, in plain words. Nothing already known is asked.
      </p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {blanks.map(f => {
          const on = !skipped.includes(f);
          return (
            <button key={f} type="button"
              onClick={() => setSkipped(s => on ? [...s, f] : s.filter(x => x !== f))}
              title={FACT_ASKS[f].question}
              className={`rounded-[10px] px-[13px] py-[7px] text-[12.5px] font-semibold ${
                on ? 'bg-ink text-white' : 'bg-control text-muted hover:text-text'
              }`}>
              {f}
            </button>
          );
        })}
      </div>
      {note ? (
        <p className="mt-3 text-[13px] text-muted">
          {note}
          <Link href={`/profile/${profileId}/intake`} className="font-semibold text-accent hover:underline">
            Copy the client link from Intake.
          </Link>
        </p>
      ) : (
        <button type="button" onClick={send} disabled={chosen.length === 0}
          className="mt-3 rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40">
          Make the round
        </button>
      )}
    </section>
  );
}

// ── The pieces ───────────────────────────────────────────────────────────────

function FactCard({ label, question, children }: {
  label: string; question: string; children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-hairline bg-white p-4 shadow-card">
      <p className="text-[14.5px] font-semibold text-text">{label}</p>
      <p className="mt-0.5 text-[12.5px] text-faint">{question}</p>
      {children}
    </section>
  );
}

/** A one-box text fact. Saves on blur, only when something changed. */
function TextFact({ label, question, value, onSave, answer }: {
  label: string; question: string; value: string; onSave: (v: string) => void;
  /** The client's raw answer, shown under a blank box. Her tap makes it true. */
  answer?: FactAnswer;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <FactCard label={label} question={question}>
      <textarea
        value={draft ?? value}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== null && draft.trim() !== value.trim()) onSave(draft.trim());
          setDraft(null);
        }}
        rows={2}
        placeholder="Type it when you know it"
        className="mt-2.5 w-full resize-y rounded-xl border border-[rgba(23,21,26,.12)] bg-white px-3 py-2.5 text-sm text-text placeholder:text-faint focus:border-accent focus:outline-none"
      />
      {answer && !value.trim() && (
        <div className="mt-2 rounded-xl bg-chip px-3 py-2.5">
          <p className="text-[11.5px] font-bold uppercase tracking-[.09em] text-muted">What they said</p>
          <p className="mt-1 text-[13px] leading-[1.55] text-text">{answer.value}</p>
          <button type="button" onClick={() => onSave(answer.value)}
            className="mt-2 rounded-lg bg-ink px-3 py-1.5 text-[12px] font-semibold text-white">
            Use this
          </button>
        </div>
      )}
    </FactCard>
  );
}

function CadenceFact({ value, onSave }: { value: number; onSave: (n: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <FactCard label="Cadence" question="How often do they post?">
      <div className="mt-2.5 flex items-center gap-2">
        <input
          type="number"
          min={0}
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
function PillarsFact({ profileId }: { profileId: string }) {
  const { dispatch } = useApp();
  const { data } = useClient(profileId);
  const pillars = data.pillars ?? [];

  const [name, setName] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const nextColor = color ?? CLIENT_COLORS[pillars.length % CLIENT_COLORS.length];

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
    <FactCard label="Pillars" question="What do they talk about?">
      {pillars.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {pillars.map(p => (
            <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full bg-control px-2.5 py-1 text-[12px] font-semibold text-text">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
              {p.name}
            </span>
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
            <button
              key={c}
              type="button"
              aria-label={`Use colour ${c}`}
              onClick={() => setColor(c)}
              className={`h-6 w-6 rounded-full ${c === nextColor ? 'ring-2 ring-ink ring-offset-1' : ''}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={add}
          disabled={!name.trim()}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40"
        >
          <Plus size={15} strokeWidth={2.2} />
          Add
        </button>
      </div>
    </FactCard>
  );
}
