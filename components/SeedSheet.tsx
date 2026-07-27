'use client';

import { useMemo, useState } from 'react';
import { Lock, MessageSquarePlus, Quote, Sparkles } from 'lucide-react';
import type { ProfileBody } from '@/lib/tree/body';
import type { Seed, SeedStatus } from '@/lib/tree/objects';
import {
  LOCK_GATES, SEED_STATUSES, findSeed, isCaptureInputShell, lockGaps, pillarsForProfile,
  seedHistory, seedPieces, amendSeed, SeedRefused,
} from '@/lib/engine/seeds';
import { capturesForSeed } from '@/lib/engine/captures';

/**
 * The seed template as entry fields — spec 23 §6.1. One field per row, all
 * optional except the six lock gates, in the order the spec sets.
 *
 * Everything about this screen is built against PLAN §3.10: the engine serves,
 * never rails. No wizard, no step counter, no next chain, no required field
 * anywhere except the gates.
 */

const ANGLES = [
  'question', 'contrarian', 'mistake', 'founder observation', 'framework', 'case study',
  'personal story', 'before-and-after', 'tutorial', 'product demo', 'myth', 'warning', 'prediction',
];

type TextField = {
  key: keyof Seed;
  label: string;
  hint?: string;
  rows?: number;
};

const TEXT_FIELDS: TextField[] = [
  { key: 'core_message', label: 'The one thing this says', hint: 'One sentence.' },
  { key: 'visible_problem', label: 'The problem they see' },
  { key: 'deeper_problem', label: 'The problem underneath' },
  { key: 'common_belief', label: 'What people assume' },
  { key: 'reframe', label: 'What you say instead' },
  { key: 'audience_value', label: 'What they get without buying' },
  { key: 'product_connection', label: 'Where the product honestly fits' },
  { key: 'nuance', label: 'The nuance you must keep' },
  { key: 'prohibited_interpretation', label: 'What this must never be read as' },
];

const STATUS_LABEL: Record<SeedStatus, string> = {
  draft: 'Draft', discussed: 'Talked about', validated: 'Stands up', locked: 'Locked',
};

export default function SeedSheet({ clientId, seedId, body, onBody, onTalkMore, onMakePiece }: {
  clientId: string;
  seedId: string;
  body: ProfileBody;
  onBody: (next: ProfileBody, note?: string) => void;
  onTalkMore: (seedId: string) => void;
  onMakePiece?: (seedId: string) => void;
}) {
  const record = findSeed(body, seedId);
  const [note, setNote] = useState('');
  const pillars = useMemo(() => pillarsForProfile(body), [body]);

  if (!record) return <p className="text-sm text-stone-400">That seed is not here.</p>;
  const { entry, seed } = record;
  const gaps = lockGaps(seed);
  const pieces = seedPieces(body, seedId);
  const talkedOut = capturesForSeed(body, seedId);
  const history = seedHistory(entry);
  const shell = isCaptureInputShell(seed);

  const now = () => new Date().toISOString();

  function change(field: keyof Seed, value: unknown, what: string) {
    try {
      const sources = { ...(seed.field_sources ?? {}) };
      sources[field as string] = 'her';
      onBody(
        amendSeed(body, seedId, { [field]: value, field_sources: sources },
          { at: now(), by: 'owner', note: what }),
      );
      setNote('');
    } catch (e) {
      setNote(e instanceof SeedRefused ? e.message : 'That could not be saved.');
    }
  }

  function moveTo(status: SeedStatus) {
    try {
      onBody(amendSeed(body, seedId, { status }, {
        at: now(), by: 'owner',
        note: status === 'locked' ? 'Locked it' : `Moved it to ${STATUS_LABEL[status].toLowerCase()}`,
      }));
      setNote('');
    } catch (e) {
      setNote(e instanceof SeedRefused ? e.message : 'That could not be saved.');
    }
  }

  return (
    <div className="space-y-5">
      {note && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">{note}</div>
      )}

      {shell && (
        <div className="rounded-xl bg-stone-100 border border-stone-200 px-4 py-3">
          <p className="text-sm font-medium text-stone-900">Not a seed yet — talk it out.</p>
          <p className="text-xs text-stone-500 mt-1">
            This came over as a subject, not a seed. Say it out loud once and the engine can build
            from it. Until then it cannot be locked.
          </p>
          <button
            onClick={() => onTalkMore(seedId)}
            className="mt-3 flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white rounded-lg bg-stone-900"
          >
            <MessageSquarePlus size={14} /> Talk it out
          </button>
        </div>
      )}

      {/* The name */}
      <Row label="Name">
        <input
          defaultValue={seed.name}
          onBlur={e => e.target.value !== seed.name && change('name', e.target.value, 'Renamed it')}
          className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-stone-400"
        />
      </Row>

      {/* The raw thought — pinned, quoted, read-only forever */}
      <div className="bg-stone-900 text-stone-50 rounded-xl p-4">
        <p className="text-xs uppercase tracking-wide text-stone-400 flex items-center gap-1.5">
          <Quote size={12} /> What you actually said
        </p>
        {seed.raw_thought
          ? <p className="mt-2 text-sm whitespace-pre-wrap leading-relaxed">{seed.raw_thought}</p>
          : <p className="mt-2 text-sm text-stone-400">Nothing yet.</p>}
        <p className="mt-3 text-xs text-stone-500">
          Kept exactly as you said it, forever. This is what keeps the point from turning into
          marketing speak.
        </p>
      </div>

      {(seed.raw_material ?? []).length > 0 && (
        <details className="bg-white border border-stone-200 rounded-xl">
          <summary className="px-4 py-3 text-sm font-medium text-stone-800 cursor-pointer">
            Everything it came from ({(seed.raw_material ?? []).length})
          </summary>
          <ul className="px-4 pb-3 space-y-2">
            {(seed.raw_material ?? []).map((m, i) => (
              <li key={i} className="text-sm text-stone-600 bg-stone-50 rounded-lg px-3 py-2 whitespace-pre-wrap">
                {m.text}
                <span className="block text-xs text-stone-400 mt-1">{m.source} · {m.at.slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {TEXT_FIELDS.map(f => (
        <Row key={f.key as string} label={f.label} hint={f.hint}
          engine={seed.field_sources?.[f.key as string] === 'engine'}>
          <textarea
            defaultValue={(seed[f.key] as string) ?? ''}
            rows={f.rows ?? 2}
            onBlur={e => e.target.value !== ((seed[f.key] as string) ?? '')
              && change(f.key, e.target.value, `Wrote ${f.label.toLowerCase()}`)}
            className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-stone-400"
          />
        </Row>
      ))}

      <ListRow label="Real examples" values={seed.examples ?? []}
        onChange={v => change('examples', v, 'Changed the examples')} />
      <ListRow label="Proof this needs before it ships" values={seed.proof_required ?? []}
        onChange={v => change('proof_required', v, 'Changed the proof needed')}
        hint="Pick from the proof library, or name what is missing." />

      {/* Pillars — read live from strategy, so a fourth pillar shows up the
          moment it exists, with no code change and nothing blank (law 3). */}
      <Row label="Pillars this could serve" engine={seed.field_sources?.possible_pillars === 'engine'}>
        {pillars.length === 0
          ? <p className="text-sm text-stone-400">No pillars on this profile yet.</p>
          : (
            <div className="flex flex-wrap gap-1.5">
              {pillars.map(p => {
                const on = (seed.possible_pillars ?? []).includes(p.id);
                return (
                  <button key={p.id}
                    onClick={() => change('possible_pillars',
                      on ? (seed.possible_pillars ?? []).filter(x => x !== p.id)
                        : [...(seed.possible_pillars ?? []), p.id],
                      'Changed the pillars')}
                    className={`px-2.5 py-1 rounded-full text-xs border ${
                      on ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-600'
                    }`}>
                    {p.name}
                  </button>
                );
              })}
            </div>
          )}
      </Row>

      <Row label="Angles this could take" engine={seed.field_sources?.possible_angles === 'engine'}>
        <div className="flex flex-wrap gap-1.5">
          {ANGLES.map(a => {
            const on = (seed.possible_angles ?? []).includes(a);
            return (
              <button key={a}
                onClick={() => change('possible_angles',
                  on ? (seed.possible_angles ?? []).filter(x => x !== a)
                    : [...(seed.possible_angles ?? []), a],
                  'Changed the angles')}
                className={`px-2.5 py-1 rounded-full text-xs border ${
                  on ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-600'
                }`}>
                {a}
              </button>
            );
          })}
        </div>
      </Row>

      {/* The ladder: four taps, not a dropdown. Moving back is not a failure
          state and is not warned about (§6.5). */}
      <div className="bg-white border border-stone-200 rounded-xl p-4">
        <p className="text-xs font-medium text-stone-500 mb-2">Where this stands</p>
        <div className="flex flex-wrap gap-1.5">
          {SEED_STATUSES.map(s => (
            <button key={s} onClick={() => moveTo(s)}
              disabled={s === 'locked' && gaps.length > 0}
              className={`px-3 py-1.5 rounded-lg text-sm border ${
                seed.status === s ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-600'
              } disabled:opacity-40`}>
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        {gaps.length > 0 ? (
          <p className="text-xs text-stone-500 mt-3">
            Before it can be locked it needs: {gaps.map(g => g.label).join(', ')}.
          </p>
        ) : seed.status !== 'locked' ? (
          <p className="text-xs text-stone-500 mt-3 flex items-center gap-1.5">
            <Lock size={12} /> All {LOCK_GATES.length} things are there. It can be locked whenever you want.
          </p>
        ) : null}
      </div>

      {/* Its pieces — read from where the pieces live, never copied (S2). */}
      <div className="bg-white border border-stone-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-stone-900">Its pieces</p>
        {pieces.length === 0
          ? <p className="text-xs text-stone-500 mt-1">Nothing has been made from this one yet.</p>
          : (
            <ul className="mt-2 space-y-1.5">
              {pieces.map(p => (
                <li key={p.id} className="text-sm text-stone-700 flex flex-wrap gap-2 items-baseline">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">{p.piece.stage}</span>
                  {p.piece.title}
                  <span className="text-xs text-stone-400">
                    {[p.piece.costume?.platform, p.piece.costume?.format].filter(Boolean).join(' · ')}
                  </span>
                  {p.piece.live_link && (
                    <a href={p.piece.live_link} target="_blank" rel="noreferrer"
                      className="text-xs text-blue-600 underline">live</a>
                  )}
                </li>
              ))}
            </ul>
          )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => onTalkMore(seedId)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50">
            <MessageSquarePlus size={14} /> Talk more about this one
          </button>
          <button
            onClick={() => onMakePiece?.(seedId)}
            disabled={seed.status !== 'locked'}
            title={seed.status !== 'locked' ? 'Lock it first. Only a locked seed can make pieces.' : undefined}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-stone-900 text-white disabled:opacity-40">
            <Sparkles size={14} /> Make a piece from this
          </button>
        </div>
        {seed.status !== 'locked' && (
          <p className="text-xs text-stone-400 mt-2">
            Lock it first. Only a locked seed can make pieces.
          </p>
        )}
      </div>

      {talkedOut.length > 0 && (
        <details className="bg-white border border-stone-200 rounded-xl">
          <summary className="px-4 py-3 text-sm font-medium text-stone-800 cursor-pointer">
            Times you talked about this ({talkedOut.length})
          </summary>
          <ul className="px-4 pb-3 space-y-2">
            {talkedOut.map(c => (
              <li key={c.id} className="text-sm text-stone-600 bg-stone-50 rounded-lg px-3 py-2 whitespace-pre-wrap">
                {c.text}
                <span className="block text-xs text-stone-400 mt-1">{c.at.slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {history.length > 0 && (
        <details className="bg-white border border-stone-200 rounded-xl">
          <summary className="px-4 py-3 text-sm font-medium text-stone-800 cursor-pointer">
            History ({history.length})
          </summary>
          <ul className="px-4 pb-3 space-y-1">
            {history.map((h, i) => (
              <li key={i} className="text-xs text-stone-500">
                {h.note} on {new Date(h.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="text-xs text-stone-400">Seed {seed.id} · profile {clientId}</p>
    </div>
  );
}

function Row({ label, hint, engine, children }: {
  label: string; hint?: string; engine?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-stone-500 mb-1.5 flex items-center gap-2">
        {label}
        {engine && (
          <span className="px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700 text-[10px]">
            engine wrote this
          </span>
        )}
      </p>
      {children}
      {hint && <p className="text-xs text-stone-400 mt-1">{hint}</p>}
    </div>
  );
}

function ListRow({ label, values, onChange, hint }: {
  label: string; values: string[]; onChange: (v: string[]) => void; hint?: string;
}) {
  const [draft, setDraft] = useState('');
  return (
    <Row label={label} hint={hint}>
      <ul className="space-y-1 mb-1.5">
        {values.map((v, i) => (
          <li key={i} className="text-sm text-stone-700 flex items-start gap-2">
            <span className="flex-1">{v}</span>
            <button onClick={() => onChange(values.filter((_, j) => j !== i))}
              className="text-xs text-stone-400 hover:text-stone-700">remove</button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input value={draft} onChange={e => setDraft(e.target.value)}
          placeholder="Add one"
          className="flex-1 text-sm border border-stone-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-stone-400" />
        <button
          onClick={() => { if (draft.trim()) { onChange([...values, draft.trim()]); setDraft(''); } }}
          className="px-3 py-1.5 text-sm rounded-lg border border-stone-300 text-stone-700">Add</button>
      </div>
    </Row>
  );
}
