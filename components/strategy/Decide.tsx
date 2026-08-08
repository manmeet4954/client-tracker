'use client';

// Decide. The fourteen, each with the input its answer actually is (spec 34 §3).
//
// What this screen refuses to do, because the old one did all of it:
//   it never prints a path or a switch id
//   it never counts sources at her
//   it never asks for a written reason beside a tick box
//   it never gives two parameters the same form when their answers differ
//
// What it does not change: the record. Every decision still goes through
// `writeStrategy`, with the same fields it always had, so a strategy decided
// with chips is the same strategy a typed one made. Where the answer is a pick,
// the reason line is written from the pick itself, because the lock reads it.

import { useState } from 'react';
import Link from 'next/link';
import { Check, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import type { ProfileBody } from '@/lib/tree/body';
import {
  mayWriteStrategy, readStrategy, sourcesFor, strategyHistory, writeStrategy,
  type SourceReading, type StrategyValue,
} from '@/lib/strategy/derivation';
import {
  STRATEGY_INPUTS, autoReason, canSave, decidedLine, decodeValue, emptyValue, problems,
  reasonFor, rowStatus, type InputSpec, type InputValue,
  type AudienceValue, type BoundariesValue, type CadenceValue, type GoalItem,
  type ObligationsValue, type Pillar, type PlatformPick, type ProofItem,
  type VoiceValue, type WorkingModeValue,
} from '@/lib/strategy/inputs';
import ProfileBodyGate from '@/components/ProfileBodyGate';
import Platforms from './inputs/Platforms';
import Pillars from './inputs/Pillars';
import Goals from './inputs/Goals';
import {
  Audience, Boundaries, Cadence, Ctas, Obligations, Proof, Prose, Voice, WorkingMode,
} from './inputs/Simple';

export default function Decide({
  profileId, brandHref,
}: { profileId: string; brandHref: string }) {
  const { role, dispatch } = useApp();
  const { data } = useClient(profileId);
  const [open, setOpen] = useState<string | null>(null);

  const body = data.body;
  if (role !== 'owner') return <p className="p-8 text-sm text-faint">This screen is hers.</p>;
  if (!body) return <ProfileBodyGate clientId={profileId} />;

  const save = (next: ProfileBody) =>
    dispatch({ type: 'SET_BODY', payload: { clientId: profileId, body: next } });

  const decided = STRATEGY_INPUTS.filter(s => readStrategy(body, s.path)).length;
  const kit = data.brandKit ?? { colors: [], fonts: [] };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-4">
        <h1 className="font-display text-[23px] font-bold leading-[1.15] tracking-[-.02em] text-text">
          Decide
        </h1>
        <p className="mt-1 text-[13.5px] leading-[1.6] text-muted">
          {decidedLine(decided, STRATEGY_INPUTS.length)} You decide these from what they told you.
          Nothing here is written for you.
        </p>
      </header>

      <div className="space-y-1.5">
        {STRATEGY_INPUTS.map((spec, i) => (
          <ParameterRow
            key={spec.path}
            spec={spec}
            index={i + 1}
            body={body}
            open={open === spec.path}
            onToggle={() => setOpen(open === spec.path ? null : spec.path)}
            onSave={save}
            brandHref={brandHref}
            brandKit={kit}
          />
        ))}
      </div>
    </div>
  );
}

interface KitShape { colors: unknown[]; fonts: unknown[]; logos?: unknown[] }

function ParameterRow({
  spec, index, body, open, onToggle, onSave, brandHref, brandKit,
}: {
  spec: InputSpec;
  index: number;
  body: ProfileBody;
  open: boolean;
  onToggle: () => void;
  onSave: (body: ProfileBody) => void;
  brandHref: string;
  brandKit: KitShape;
}) {
  const current = readStrategy(body, spec.path);
  const sources = sourcesFor(body, spec.path);
  const said = sources.filter(s => s.curated);
  const history = strategyHistory(body, spec.path);

  const [value, setValue] = useState<InputValue>(() =>
    current && !current.not_applicable ? decodeValue(spec.kind, current.value) : emptyValue(spec.kind));
  const [typed, setTyped] = useState(spec.reasonRequired ? (current?.reason ?? '') : '');
  const [touched, setTouched] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [skipWhy, setSkipWhy] = useState(current?.not_applicable ? (current.reason ?? '') : '');
  const [refusal, setRefusal] = useState('');

  // Nothing they said feeds this one yet, so it is hers to declare. The old
  // screen made that a checkbox she had to find; here it is simply true, said
  // in one line.
  const ownerDeclared = said.length === 0;
  const status = rowStatus(spec, current);
  const wrong = problems(spec.kind, value);

  function write(next: Partial<StrategyValue> & { value: unknown; reason: string }) {
    const check = mayWriteStrategy(body, spec.path, ownerDeclared);
    if (!check.ok) { setRefusal(check.why); return; }
    setRefusal('');
    onSave(writeStrategy(body, spec.path, {
      key: spec.path.split('/').pop() ?? spec.path,
      not_applicable: false,
      owner_declared: ownerDeclared,
      sources: said.map(s => s.parameter_id),
      strategy_version: null,
      ...next,
    } as StrategyValue, new Date().toISOString()));
  }

  function commit() {
    write({ value: value as unknown, reason: reasonFor(spec, value, typed) });
  }

  function markNotUsed() {
    write({ value: null, not_applicable: true, reason: skipWhy.trim() });
    setSkipping(false);
  }

  const kitCount = [
    `${brandKit.colors.length} ${brandKit.colors.length === 1 ? 'colour' : 'colours'}`,
    `${brandKit.fonts.length} ${brandKit.fonts.length === 1 ? 'typeface' : 'typefaces'}`,
  ].join(', ');
  const kitEmpty = brandKit.colors.length === 0 && brandKit.fonts.length === 0;

  // The visual branding row shows what is in Brand kit right now, counted from
  // the arrays, rather than a number it wrote down once.
  const detail = spec.kind === 'brand-kit' && status.decided ? kitCount : status.detail;

  return (
    <section className="overflow-hidden rounded-card border border-hairline bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left md:px-4"
      >
        <span className="tnum w-[22px] shrink-0 text-[12.5px] font-semibold text-faint">
          {String(index).padStart(2, '0')}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-semibold leading-[1.3] text-text">{spec.label}</span>
          <span className={`mt-0.5 block truncate text-[12.5px] ${status.decided ? 'text-muted' : 'text-faint'}`}>
            {detail || status.state}
          </span>
        </span>
        {status.decided && <Check size={16} strokeWidth={2.4} className="shrink-0 text-positive" />}
        {open
          ? <ChevronDown size={17} strokeWidth={2} className="shrink-0 text-faint" />
          : <ChevronRight size={17} strokeWidth={2} className="shrink-0 text-faint" />}
      </button>

      {open && (
        <div className="border-t border-divider bg-paper px-3.5 py-4 md:px-4">
          <p className="mb-3.5 text-[13px] leading-[1.6] text-muted">{spec.help}</p>

          <WhatTheySaid said={said} ownerDeclared={ownerDeclared} />

          <div className="mt-4">
            {spec.kind === 'brand-kit' ? (
              <BrandKitRow
                href={brandHref}
                count={kitCount}
                empty={kitEmpty}
                decided={status.decided}
                onUse={() => write({ value: 'Set in Brand kit', reason: autoReason('brand-kit', '') })}
              />
            ) : (
              <Input
                spec={spec}
                value={value}
                onChange={next => { setTouched(true); setValue(next); }}
              />
            )}
          </div>

          {spec.reasonRequired && spec.kind !== 'brand-kit' && (
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[.12em] text-faint">
                Why this, and not something else
              </p>
              <textarea
                value={typed}
                onChange={e => setTyped(e.target.value)}
                rows={2}
                placeholder="One line. This is the one that is worth arguing about."
                className="w-full rounded-xl border border-hairline bg-white px-3 py-2.5 text-[14px] leading-[1.55] text-text placeholder:text-faint focus:border-[rgba(23,21,26,.3)] focus:outline-none"
              />
            </div>
          )}

          {/* Nothing is wrong with a row she has not touched yet. The list
              appears once she starts, and once there is a decision to hold. */}
          {wrong.length > 0 && spec.kind !== 'brand-kit' && (touched || status.decided) && (
            <ul className="mt-3 space-y-1">
              {wrong.map(w => (
                <li key={w} className="text-[12.5px] leading-[1.5] text-accent-text">{w}</li>
              ))}
            </ul>
          )}

          {spec.kind !== 'brand-kit' && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={commit}
                disabled={!canSave(spec, value, typed)}
                className="rounded-xl bg-ink px-[18px] py-2.5 text-[13.5px] font-semibold text-white disabled:opacity-30"
              >
                {status.decided ? 'Change it' : 'Decide it'}
              </button>
              <button
                type="button"
                onClick={() => setSkipping(!skipping)}
                className="rounded-xl border border-hairline bg-white px-[15px] py-2.5 text-[13.5px] font-semibold text-muted hover:text-text"
              >
                Not used here
              </button>
            </div>
          )}

          {skipping && (
            <div className="mt-2.5 rounded-card border border-hairline bg-white p-3">
              <p className="mb-2 text-[13px] text-muted">
                Say why in one line, so a year from now it still makes sense.
              </p>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={skipWhy}
                  onChange={e => setSkipWhy(e.target.value)}
                  placeholder="Why this one does not apply"
                  className="min-w-0 flex-1 rounded-[10px] border border-hairline bg-white px-3 py-2 text-[13.5px] text-text placeholder:text-faint focus:border-[rgba(23,21,26,.3)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={markNotUsed}
                  disabled={!skipWhy.trim()}
                  className="shrink-0 rounded-[10px] bg-ink px-3 py-2 text-[12.5px] font-semibold text-white disabled:opacity-30"
                >
                  File it
                </button>
              </div>
            </div>
          )}

          {refusal && <p className="mt-2.5 text-[12.5px] text-accent-text">{refusal}</p>}

          <p className="mt-3.5 text-[12px] leading-[1.55] text-faint">
            {current?.strategy_version
              ? `Locked at version ${current.strategy_version}. Changing it starts a new version.`
              : current
                ? 'Saved, and not locked yet, so the client cannot see it.'
                : 'Nothing is saved until you decide it.'}
            {history.length > 0 && ` ${history.length} earlier ${history.length === 1 ? 'version is' : 'versions are'} kept.`}
          </p>
        </div>
      )}
    </section>
  );
}

/** What they told her, inside the row, which is where a source is useful. */
function WhatTheySaid({ said, ownerDeclared }: { said: SourceReading[]; ownerDeclared: boolean }) {
  if (ownerDeclared) {
    return (
      <p className="text-[13px] leading-[1.6] text-muted">
        They have not told you anything that feeds this one yet, so this is your call.
      </p>
    );
  }
  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[.12em] text-faint">What they said</p>
      <ul className="space-y-1.5">
        {said.map(s => (
          <li key={s.parameter_id} className="text-[13px] leading-[1.55] text-muted">
            <span className="text-text">{s.label}:</span> {plain(s.value)}
            {s.confidence && s.confidence !== 'confirmed' && (
              <span className="ml-1.5 text-[12px] text-accent-text">{s.confidence}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BrandKitRow({
  href, count, empty, decided, onUse,
}: { href: string; count: string; empty: boolean; decided: boolean; onUse: () => void }) {
  return (
    <div className="rounded-card border border-hairline bg-white p-3.5">
      <p className="text-[13.5px] leading-[1.6] text-muted">
        Colours and type are not something to describe in a box. They live in Brand kit.
      </p>
      <p className="mt-1 text-[13.5px] font-semibold text-text">
        {empty ? 'Nothing in the kit yet.' : `In the kit now: ${count}.`}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={href}
          className="flex items-center gap-1.5 rounded-xl bg-ink px-[15px] py-2.5 text-[13.5px] font-semibold text-white"
        >
          Open Brand kit
          <ExternalLink size={14} strokeWidth={2.2} />
        </Link>
        <button
          type="button"
          onClick={onUse}
          disabled={empty}
          className="rounded-xl border border-hairline bg-white px-[15px] py-2.5 text-[13.5px] font-semibold text-muted hover:text-text disabled:opacity-30"
        >
          {decided ? 'Confirm it again' : 'That is the branding'}
        </button>
      </div>
    </div>
  );
}

function Input({
  spec, value, onChange,
}: { spec: InputSpec; value: InputValue; onChange: (next: InputValue) => void }) {
  switch (spec.kind) {
    case 'platforms':
      return <Platforms value={value as PlatformPick[]} onChange={onChange} />;
    case 'pillars':
      return <Pillars value={value as Pillar[]} onChange={onChange} />;
    case 'goals':
      return <Goals value={value as GoalItem[]} onChange={onChange} />;
    case 'voice':
      return <Voice value={value as VoiceValue} onChange={onChange} />;
    case 'chips':
      return <Ctas value={value as string[]} onChange={onChange} />;
    case 'boundaries':
      return <Boundaries value={value as BoundariesValue} onChange={onChange} />;
    case 'cadence':
      return <Cadence value={value as CadenceValue} onChange={onChange} />;
    case 'working-mode':
      return <WorkingMode value={value as WorkingModeValue} onChange={onChange} />;
    case 'obligations':
      return <Obligations value={value as ObligationsValue} onChange={onChange} />;
    case 'proof':
      return <Proof value={value as ProofItem[]} onChange={onChange} />;
    case 'audience':
      return <Audience value={value as AudienceValue} onChange={onChange} />;
    default:
      return (
        <Prose
          value={String(value ?? '')}
          onChange={onChange}
          placeholder={spec.label === 'Positioning'
            ? 'What this brand is, in a line or two'
            : 'How someone gets from a post to a sale'}
        />
      );
  }
}

/** A curated answer, said back as a person would read it. */
function plain(v: unknown): string {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map(x => plain(x)).filter(Boolean).join(', ');
  if (typeof v === 'object') return Object.values(v as Record<string, unknown>).map(plain).filter(Boolean).join(', ');
  return String(v);
}
