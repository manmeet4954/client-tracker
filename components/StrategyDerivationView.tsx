'use client';

import { useState } from 'react';
import { Compass, Check } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import type { ProfileBody } from '@/lib/tree/body';
import {
  DERIVATION_MAP, LOCKABLE_STRATEGY_PATHS, derivationRow, mayWriteStrategy, readStrategy,
  sourcesFor, strategyHistory, writeStrategy, type StrategyValue,
} from '@/lib/strategy/derivation';
import ProfileBodyGate from './ProfileBodyGate';

/**
 * The derivation surface (spec 22 §8.1 to §8.3).
 *
 * content-strategy is not collected. She derives it from the two detail
 * folders, and every panel shows the three things that matter: the sources, the
 * decision, and the reason. The reason is required. It is what makes the
 * strategy readable a year later, and what she shows a client who asks why
 * their pillar mix is what it is.
 *
 * Nothing here is generated. No AI writes strategy.
 */
export default function StrategyDerivationView({ clientId }: { clientId: string }) {
  const { role, dispatch } = useApp();
  const { data } = useClient(clientId);
  const [openPath, setOpenPath] = useState<string | null>(null);

  const body = data.body;
  if (role !== 'owner') return <p className="p-8 text-sm text-stone-400">This screen is hers.</p>;
  if (!body) return <ProfileBodyGate clientId={clientId} />;

  const save = (next: ProfileBody) => dispatch({ type: 'SET_BODY', payload: { clientId, body: next } });
  const written = LOCKABLE_STRATEGY_PATHS.filter(p => readStrategy(body, p)).length;

  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-5">
        <h2 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
          <Compass size={18} className="text-stone-500" />
          The strategy
        </h2>
        <p className="text-sm text-stone-500 mt-1">
          This is the brand book. It is not collected, you decide it from what they told you.
          {' '}{written} of {LOCKABLE_STRATEGY_PATHS.length} decided.
        </p>
      </header>

      <div className="space-y-2">
        {DERIVATION_MAP.filter(r => r.lockable).map(row => (
          <Panel
            key={row.path}
            path={row.path}
            body={body}
            open={openPath === row.path}
            onToggle={() => setOpenPath(openPath === row.path ? null : row.path)}
            onSave={save}
          />
        ))}
      </div>

      <p className="text-xs text-stone-400 mt-6">
        Pillars, formats, platform rules and gates carry their own detail inside these decisions.
        The parts that come from the universal library are marked as such.
      </p>
    </div>
  );
}

function Panel({ path, body, open, onToggle, onSave }: {
  path: string;
  body: ProfileBody;
  open: boolean;
  onToggle: () => void;
  onSave: (body: ProfileBody) => void;
}) {
  const row = derivationRow(path)!;
  const current = readStrategy(body, path);
  const sources = sourcesFor(body, path);
  const history = strategyHistory(body, path);

  const [value, setValue] = useState(current ? String(current.value ?? '') : '');
  const [reason, setReason] = useState(current?.reason ?? '');
  const [notApplicable, setNotApplicable] = useState(!!current?.not_applicable);
  const [ownerDeclared, setOwnerDeclared] = useState(!!current?.owner_declared);
  const [refusal, setRefusal] = useState('');

  function write() {
    const check = mayWriteStrategy(body, path, ownerDeclared);
    if (!check.ok) { setRefusal(check.why); return; }
    const decision: StrategyValue = {
      key: path.split('/').pop() ?? path,
      value: notApplicable ? null : value,
      not_applicable: notApplicable,
      reason,
      owner_declared: ownerDeclared,
      sources: sources.filter(s => s.curated).map(s => s.parameter_id),
      strategy_version: null,
    };
    setRefusal('');
    onSave(writeStrategy(body, path, decision, new Date().toISOString()));
  }

  const ready = reason.trim().length > 0 && (notApplicable || value.trim().length > 0);

  return (
    <section className="bg-white border border-stone-200 rounded-xl">
      <button onClick={onToggle} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left">
        <span className="min-w-0">
          <span className="block text-sm font-medium text-stone-900">{row.label}</span>
          <span className="block text-xs text-stone-400 truncate">
            {current
              ? (current.not_applicable ? 'not used here' : String(current.value ?? ''))
              : `${sources.filter(s => s.curated).length} of ${sources.length} sources ready`}
          </span>
        </span>
        {current
          ? <Check size={16} className="text-emerald-600 shrink-0" />
          : <span className="text-xs text-stone-400 shrink-0">{open ? 'close' : 'open'}</span>}
      </button>

      {open && (
        <div className="border-t border-stone-100 p-4 grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-stone-500 mb-2">What this comes from</p>
            {sources.length === 0 && <p className="text-sm text-stone-400">Nothing from intake feeds this one.</p>}
            <ul className="space-y-1.5">
              {sources.map(s => (
                <li key={s.parameter_id} className="text-sm">
                  <span className={s.curated ? 'text-stone-700' : 'text-stone-400'}>
                    {s.label}: {s.curated ? String(s.value ?? '') : 'we never got this'}
                  </span>
                  {s.confidence && s.confidence !== 'confirmed' && (
                    <span className="ml-1 text-xs text-amber-600">{s.confidence}</span>
                  )}
                </li>
              ))}
            </ul>
            {row.from_universal && <p className="text-xs text-stone-400 mt-3">{row.from_universal}</p>}
            {row.owner_declared && <p className="text-xs text-stone-400 mt-1">{row.owner_declared}</p>}
          </div>

          <div>
            <p className="text-xs font-medium text-stone-500 mb-2">Your decision</p>
            <textarea
              value={value}
              onChange={e => setValue(e.target.value)}
              disabled={notApplicable}
              rows={3}
              placeholder="What are we doing here"
              className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-stone-400 disabled:bg-stone-50"
            />
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
              placeholder="Why, in one line"
              className="mt-2 w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-stone-400"
            />
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-stone-600">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={notApplicable} onChange={e => setNotApplicable(e.target.checked)} />
                not used for this client
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={ownerDeclared} onChange={e => setOwnerDeclared(e.target.checked)} />
                deciding ahead of the answers
              </label>
            </div>

            <button onClick={write} disabled={!ready}
              className="mt-3 px-3.5 py-2 text-sm font-medium text-white rounded-lg bg-stone-900 disabled:opacity-40">
              {current ? 'Change it' : 'Decide it'}
            </button>
            {!ready && <p className="text-xs text-stone-400 mt-2">A decision needs its reason line before it can be saved.</p>}
            {refusal && <p className="text-xs text-amber-700 mt-2">{refusal}</p>}

            {current?.strategy_version && (
              <p className="text-xs text-stone-400 mt-3">Locked at version {current.strategy_version}.</p>
            )}
            {!current?.strategy_version && current && (
              <p className="text-xs text-stone-400 mt-3">Not locked yet, so the client cannot see this.</p>
            )}
            {history.length > 0 && (
              <p className="text-xs text-stone-400 mt-1">{history.length} earlier versions kept.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
