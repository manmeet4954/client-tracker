'use client';

import { useState } from 'react';
import { Lock, CheckCircle2 } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import { lockStrategy, lockViolations, type LockFailure } from '@/lib/strategy/derivation';
import ProfileBodyGate from './ProfileBodyGate';

const FIX_WORDS: Record<LockFailure['fix'], string> = {
  derivation: 'The strategy',
  gates: 'The gates',
  switchboard: 'The switches',
  channels: 'The accounts',
};

/**
 * The lock (spec 22 §8.6). One action, and the gate between understanding a
 * client and making things for them.
 *
 * It validates first, and on failure nothing changes. There is no partial lock:
 * contradictions refuse activation. On success everything is stamped at once,
 * the profile moves from setup to active, creation opens, and the client's
 * strategy summary becomes visible.
 */
export default function StrategyLockView({ clientId }: { clientId: string }) {
  const { role, dispatch } = useApp();
  const { client, data } = useClient(clientId);
  const [message, setMessage] = useState('');

  const body = data.body;
  if (role !== 'owner') return <p className="p-8 text-sm text-stone-400">This screen is hers.</p>;
  if (!body) return <ProfileBodyGate clientId={clientId} />;

  const input = {
    body,
    lifecycle: client?.lifecycle ?? 'setup',
    owner_kind: client?.ownerKind ?? ('client' as const),
    platforms: data.platforms ?? ['Instagram'],
    now: new Date().toISOString(),
    goals: [],
  };
  const failures = lockViolations(input);
  const locked = typeof body.strategy_version === 'number';

  function lock() {
    const result = lockStrategy({ ...input, now: new Date().toISOString() });
    if (!result.ok) { setMessage('Still not ready. The list below is what is missing.'); return; }
    dispatch({ type: 'SET_BODY', payload: { clientId, body: result.body } });
    if (result.lifecycle !== input.lifecycle) {
      dispatch({ type: 'SET_LIFECYCLE', payload: { clientId, lifecycle: result.lifecycle } });
    }
    setMessage(`Locked at version ${result.strategy_version}. Creation is open, and the client can see their summary.`);
  }

  const grouped = new Map<LockFailure['fix'], LockFailure[]>();
  for (const f of failures) grouped.set(f.fix, [...(grouped.get(f.fix) ?? []), f]);

  return (
    <div className="max-w-3xl mx-auto">
      <header className="mb-5">
        <h2 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
          <Lock size={18} className="text-stone-500" />
          Lock the strategy
        </h2>
        <p className="text-sm text-stone-500 mt-1">
          One action. It is the line between working out who this client is and having the engine
          make things for them. Recording your work here saves either way.
        </p>
      </header>

      {locked && (
        <div className="mb-4 flex items-start gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-900">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>
            Locked at version {body.strategy_version}. Everything you change from here is a working edit,
            and the client keeps seeing the locked version until you lock again.
          </span>
        </div>
      )}

      {message && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">{message}</div>
      )}

      {failures.length === 0 ? (
        <p className="text-sm text-stone-600">Everything is in place.</p>
      ) : (
        <div className="space-y-4">
          {[...grouped.entries()].map(([fix, list]) => (
            <section key={fix} className="bg-white border border-stone-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-stone-900">{FIX_WORDS[fix]}</h3>
              <ul className="mt-2 space-y-1.5">
                {list.slice(0, 12).map((f, i) => (
                  <li key={i} className="text-sm text-stone-600">
                    <span className="text-stone-900">{f.where}</span>: {f.why}
                  </li>
                ))}
                {list.length > 12 && (
                  <li className="text-sm text-stone-400">and {list.length - 12} more of the same</li>
                )}
              </ul>
            </section>
          ))}
        </div>
      )}

      <button onClick={lock} disabled={failures.length > 0}
        className="mt-5 px-4 py-2.5 text-sm font-medium text-white rounded-lg bg-stone-900 disabled:opacity-40">
        {locked ? 'Lock the next version' : 'Lock it'}
      </button>
    </div>
  );
}
