'use client';

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import type { ProfileBody } from '@/lib/tree/body';
import { OPERATIONAL_GATES } from '@/lib/tree/objects';
import {
  BRAND_GATE_COUNT, buildGateSet, gateSetViolations, gateSources, readGateSet, writeGateSet,
  type GateDraft,
} from '@/lib/strategy/derivation';
import ProfileBodyGate from './ProfileBodyGate';

/**
 * The gate set, v1 (spec 22 §8.4, S14).
 *
 * Five brand gates that come OUT of what was decided in strategy: there is no
 * gate questionnaire, and some gates only appear after working with a client
 * for a while. Two operational gates never vary. Nothing reaches review until
 * all seven pass, and a gate version applies forward only: refining a gate
 * makes version 2, and version 1's records stay exactly as they are.
 */
export default function GateSetView({ clientId }: { clientId: string }) {
  const { role, dispatch } = useApp();
  const { data } = useClient(clientId);

  const body = data.body;
  if (role !== 'owner') return <p className="p-8 text-sm text-stone-400">This screen is hers.</p>;
  if (!body) return <ProfileBodyGate clientId={clientId} />;

  return <GateEditor body={body} onSave={next => dispatch({ type: 'SET_BODY', payload: { clientId, body: next } })} />;
}

function GateEditor({ body, onSave }: { body: ProfileBody; onSave: (b: ProfileBody) => void }) {
  const existing = readGateSet(body);
  const sources = gateSources(body);
  const [gates, setGates] = useState<GateDraft[]>(() => {
    const brand = (existing?.gates ?? []).filter(g => g.kind === 'brand');
    const rows: GateDraft[] = brand.map(g => ({ id: g.id, name: g.name, question: g.question, from: 'strategy' }));
    while (rows.length < BRAND_GATE_COUNT) rows.push({ id: `gate-${rows.length + 1}`, name: '', question: '', from: 'voice' });
    return rows;
  });

  const violations = gateSetViolations(body, gates);
  const nextVersion = (existing?.version ?? 0) + 1;

  function set(i: number, patch: Partial<GateDraft>) {
    setGates(rows => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  function write() {
    const version = existing ? nextVersion : 1;
    onSave(writeGateSet(body, buildGateSet(gates, version, existing?.locked_with_strategy_version ?? 0, new Date().toISOString()), new Date().toISOString()));
  }

  return (
    <div className="max-w-3xl mx-auto">
      <header className="mb-5">
        <h2 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
          <ShieldCheck size={18} className="text-stone-500" />
          The gates
        </h2>
        <p className="text-sm text-stone-500 mt-1">
          Five checks a piece has to pass for this brand, plus two that never change.
          They come out of the voice and the positioning you already decided.
        </p>
      </header>

      <div className="bg-white border border-stone-200 rounded-xl p-4 mb-4">
        <p className="text-xs font-medium text-stone-500 mb-2">What they come from</p>
        <p className="text-sm text-stone-700">
          Voice: {sources.voice ? String(sources.voice.value ?? '') : <span className="text-stone-400">not decided yet</span>}
        </p>
        <p className="text-sm text-stone-700 mt-1">
          Positioning: {sources.positioning ? String(sources.positioning.value ?? '') : <span className="text-stone-400">not decided yet</span>}
        </p>
      </div>

      <div className="space-y-2">
        {gates.map((g, i) => (
          <div key={i} className="bg-white border border-stone-200 rounded-xl p-4">
            <input
              value={g.name}
              onChange={e => set(i, { name: e.target.value })}
              placeholder={`Gate ${i + 1} name`}
              className="w-full text-sm font-medium text-stone-900 border-b border-transparent focus:outline-none focus:border-stone-300 pb-1"
            />
            <textarea
              value={g.question}
              onChange={e => set(i, { question: e.target.value })}
              rows={2}
              placeholder="The question a piece has to answer yes to"
              className="mt-2 w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-stone-400"
            />
            <div className="mt-2 flex gap-2 text-xs">
              {(['voice', 'positioning'] as const).map(from => (
                <button key={from} onClick={() => set(i, { from })}
                  className={`px-2.5 py-1 rounded-full border ${
                    g.from === from ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-600'
                  }`}>
                  from {from}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 bg-stone-50 border border-stone-200 rounded-xl p-4">
        <p className="text-xs font-medium text-stone-500 mb-2">Always on, for every brand</p>
        {OPERATIONAL_GATES.map(g => (
          <p key={g.id} className="text-sm text-stone-600">{g.name}: {g.question}</p>
        ))}
      </div>

      {violations.length > 0 && (
        <ul className="mt-4 space-y-1">
          {violations.map((v, i) => <li key={i} className="text-sm text-amber-700">{v}</li>)}
        </ul>
      )}

      <button onClick={write} disabled={violations.length > 0}
        className="mt-4 px-3.5 py-2 text-sm font-medium text-white rounded-lg bg-stone-900 disabled:opacity-40">
        {existing ? `Save as version ${nextVersion}` : 'Save the gates'}
      </button>
      {existing && (
        <p className="text-xs text-stone-400 mt-2">
          Version {existing.version} stays exactly as it is. New gates only apply to what comes next.
        </p>
      )}
    </div>
  );
}
