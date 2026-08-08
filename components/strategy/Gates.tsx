'use client';

// Strategy room → Gates. Spec 34 §7.
//
// What this replaces: the word "gate", a coloured dot and a pill, with five
// empty text boxes underneath. Nothing on that screen ever showed the SENTENCE
// a piece is checked against, which is the only part of a gate that does any
// work.
//
// So this screen shows the sentences. Written ones read as sentences; the two
// that never vary sit below them, marked fixed, each saying why it never
// varies. Where no set exists yet it says what will produce one, in her words,
// instead of drawing five empty boxes.
//
// The writing path is unchanged and deliberately so: `buildGateSet` assembles
// the set, `gateSetViolations` says what is not ready, `writeGateSet` stores it,
// and a refined set becomes version N+1 while version N stays exactly as it is.
// A piece is still judged against the version it was born under (S15). This
// file rewrites none of that; it only stops rendering the machinery.

import { useState } from 'react';
import { Lock, Pencil, Plus, X } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import type { ProfileBody } from '@/lib/tree/body';
import {
  BRAND_GATE_COUNT, buildGateSet, gateSetViolations, readGateSet, writeGateSet, type GateDraft,
} from '@/lib/strategy/derivation';
import { GATES_PURPOSE, gatesWritable, readGates, type GateReading } from '@/lib/strategy/reading';
import ProfileBodyGate from '@/components/ProfileBodyGate';

export default function Gates({ profileId }: { profileId: string }) {
  const { role, dispatch } = useApp();
  const { data } = useClient(profileId);

  // Owner only, always, in every switch position (spec 34 §2).
  if (role !== 'owner') return <p className="p-8 text-sm text-faint">This screen is hers.</p>;
  if (!data.body) return <ProfileBodyGate clientId={profileId} />;

  return (
    <GatesScreen
      body={data.body}
      onSave={next => dispatch({ type: 'SET_BODY', payload: { clientId: profileId, body: next } })}
    />
  );
}

function GatesScreen({ body, onSave }: { body: ProfileBody; onSave: (b: ProfileBody) => void }) {
  const reading = readGates(body);
  const [writing, setWriting] = useState(false);

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-4">
        <h2 className="font-display text-[21px] font-bold tracking-[-.02em] text-text">
          What every piece is checked against
        </h2>
        <p className="mt-1.5 text-[13.5px] leading-[1.6] text-muted">{GATES_PURPOSE}</p>
      </header>

      <p className="tnum mb-2.5 text-[11.5px] font-bold uppercase tracking-[.09em] text-faint">
        {reading.headline}
      </p>

      {writing
        ? <Writer body={body} reading={reading} onSave={next => { onSave(next); setWriting(false); }}
            onCancel={() => setWriting(false)} />
        : <Reader reading={reading} onWrite={() => setWriting(true)} />}
    </div>
  );
}

// ── Reading: the sentences themselves ────────────────────────────────────────

function Reader({ reading, onWrite }: { reading: GateReading; onWrite: () => void }) {
  const writable = gatesWritable(reading);

  return (
    <>
      {reading.brand.length > 0 ? (
        <section className="space-y-2.5">
          {reading.brand.map((g, i) => (
            <article key={g.id} className="rounded-card border border-hairline bg-white p-4 shadow-card">
              <p className="tnum text-[11.5px] font-bold uppercase tracking-[.09em] text-faint">
                {String(i + 1).padStart(2, '0')} · {g.name}
              </p>
              <p className="mt-1.5 text-[15px] leading-[1.5] text-text">{g.sentence}</p>
            </article>
          ))}
        </section>
      ) : (
        // §7: where no set exists, say what will produce one. Never an empty list.
        <section className="rounded-card border border-hairline bg-white p-5 shadow-card">
          <p className="text-[14.5px] font-semibold text-text">
            The checks for this brand are not written yet
          </p>
          <p className="mt-1.5 text-[13.5px] leading-[1.6] text-muted">{reading.whatProduces}</p>
          {reading.missing.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {reading.missing.map(m => (
                <li key={m} className="flex items-start gap-2 text-[13.5px] text-muted">
                  <span className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                  {m}
                </li>
              ))}
            </ul>
          )}
          {writable && (
            <button
              type="button"
              onClick={onWrite}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-white"
            >
              <Plus size={15} strokeWidth={2.2} /> Write the {BRAND_GATE_COUNT} checks
            </button>
          )}
        </section>
      )}

      {/* The two that never vary, shown as fixed, each saying why. */}
      <section className="mt-4 rounded-card border border-hairline bg-sunken p-4">
        <p className="mb-2.5 text-[11.5px] font-bold uppercase tracking-[.09em] text-faint">
          Fixed for every brand
        </p>
        <div className="space-y-3">
          {reading.fixed.map(g => (
            <div key={g.id} className="flex items-start gap-2.5">
              <Lock size={15} strokeWidth={1.9} className="mt-[3px] flex-none text-faint" />
              <div className="min-w-0">
                <p className="text-[14.5px] leading-[1.5] text-text">{g.sentence}</p>
                <p className="mt-0.5 text-[12.5px] leading-[1.55] text-faint">{g.why}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {reading.brand.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onWrite}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[rgba(23,21,26,.14)] px-4 py-2.5 text-[13px] font-semibold text-text"
          >
            <Pencil size={14} strokeWidth={2} /> Change a check
          </button>
          <p className="text-[12.5px] leading-[1.55] text-faint">
            A change makes a new version. Everything already judged stays judged against the one it
            was made under.
          </p>
        </div>
      )}
    </>
  );
}

// ── Writing: still five sentences, and they read as sentences ────────────────

function Writer({ body, reading, onSave, onCancel }: {
  body: ProfileBody;
  reading: GateReading;
  onSave: (b: ProfileBody) => void;
  onCancel: () => void;
}) {
  const existing = readGateSet(body);
  const [gates, setGates] = useState<GateDraft[]>(() => {
    const rows: GateDraft[] = reading.brand.map(g => ({
      id: g.id, name: g.name, question: g.sentence, from: 'strategy',
    }));
    while (rows.length < BRAND_GATE_COUNT) {
      rows.push({ id: `gate-${rows.length + 1}`, name: '', question: '', from: 'voice' });
    }
    return rows;
  });

  const violations = gateSetViolations(body, gates);
  const nextVersion = (existing?.version ?? 0) + 1;

  function set(i: number, patch: Partial<GateDraft>) {
    setGates(rows => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  function write() {
    onSave(writeGateSet(
      body,
      buildGateSet(gates, existing ? nextVersion : 1, existing?.locked_with_strategy_version ?? 0, new Date().toISOString()),
      new Date().toISOString(),
    ));
  }

  return (
    <>
      {/* What they come out of, kept in sight while she writes them. */}
      <section className="mb-3 rounded-card border border-hairline bg-sunken p-4">
        <p className="mb-2 text-[11.5px] font-bold uppercase tracking-[.09em] text-faint">
          What these come out of
        </p>
        <p className="text-[13.5px] leading-[1.6] text-muted">
          <span className="font-semibold text-text">Voice.</span>{' '}
          {reading.voice ?? 'not decided yet'}
        </p>
        <p className="mt-1 text-[13.5px] leading-[1.6] text-muted">
          <span className="font-semibold text-text">Positioning.</span>{' '}
          {reading.positioning ?? 'not decided yet'}
        </p>
      </section>

      <div className="space-y-2.5">
        {gates.map((g, i) => (
          <div key={i} className="rounded-card border border-hairline bg-white p-4 shadow-card">
            <div className="flex items-center gap-2">
              <span className="tnum text-[11.5px] font-bold uppercase tracking-[.09em] text-faint">
                {String(i + 1).padStart(2, '0')}
              </span>
              <input
                value={g.name}
                onChange={e => set(i, { name: e.target.value })}
                placeholder="A short name for it"
                className="min-w-0 flex-1 border-b border-transparent pb-1 text-[14px] font-semibold text-text placeholder:text-faint focus:border-[rgba(23,21,26,.14)] focus:outline-none"
              />
            </div>
            <textarea
              value={g.question}
              onChange={e => set(i, { question: e.target.value })}
              rows={2}
              placeholder="The sentence a piece has to answer yes to"
              className="mt-2 w-full rounded-xl border border-[rgba(23,21,26,.12)] bg-white px-3 py-2 text-[14px] leading-[1.5] text-text placeholder:text-faint focus:border-accent focus:outline-none"
            />
          </div>
        ))}
      </div>

      {violations.length > 0 && (
        <ul className="mt-3 space-y-1">
          {violations.map((v, i) => (
            <li key={i} className="text-[13px] text-accent-text">{v}</li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={write}
          disabled={violations.length > 0}
          className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40"
        >
          {existing ? `Save as version ${nextVersion}` : 'Save these checks'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[rgba(23,21,26,.14)] px-4 py-2.5 text-[13px] font-semibold text-muted"
        >
          <X size={14} strokeWidth={2} /> Leave it
        </button>
      </div>

      {existing && (
        <p className="mt-2 text-[12.5px] leading-[1.55] text-faint">
          Version {existing.version} stays exactly as it is. New checks only apply to what comes next.
        </p>
      )}
    </>
  );
}
