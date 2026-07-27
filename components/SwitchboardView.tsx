'use client';

import { useMemo, useState } from 'react';
import { ToggleLeft, Radio } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import type { ProfileBody } from '@/lib/tree/body';
import { putEntry } from '@/lib/tree/body';
import type { PathState } from '@/lib/tree/contract';
import { cascadeOf, findSwitch, platformSwitchId, switchesForProfile } from '@/lib/tree/switches';
import {
  CHANNELS_PATH, setSwitchPosition, switchConfigFromBody, unsetSwitches,
} from '@/lib/strategy/derivation';
import ProfileBodyGate from './ProfileBodyGate';
import CascadeTrace from './shell/CascadeTrace';

const STATE_WORDS: Record<PathState, string> = {
  active: 'on',
  history: 'off, keep the history',
  hidden: 'off, not for this client',
};

/**
 * The switchboard step (spec 22 §8.5, PLAN §3.4).
 *
 * Her timing, locked: intake, then curation, then strategy, then the switches,
 * and only then creation. Every switch shows its suggested position marked as a
 * suggestion, what disappears if she moves it (her side AND the client's,
 * because switches design her dashboard too), and the strategy decision the
 * position comes out of.
 */
export default function SwitchboardView({ clientId }: { clientId: string }) {
  const { role, dispatch } = useApp();
  const { client, data } = useClient(clientId);
  // Spec 28 §5.6: moving any switch opens the generated trace BEFORE it commits.
  const [pending, setPending] = useState<{ id: string; state: PathState } | null>(null);

  const body = data.body;
  const platforms = useMemo(() => data.platforms ?? ['Instagram'], [data.platforms]);

  if (role !== 'owner') return <p className="p-8 text-sm text-stone-400">This screen is hers.</p>;
  if (!body) return <ProfileBodyGate clientId={clientId} />;

  const save = (next: ProfileBody) => dispatch({ type: 'SET_BODY', payload: { clientId, body: next } });
  const config = switchConfigFromBody(body);
  const missing = unsetSwitches(body, platforms);
  const suggested = client?.suggestedSwitches ?? {};
  const switches = switchesForProfile(platforms).filter(s => !s.fixed);
  const channels = (body.paths[CHANNELS_PATH] ?? []).map(e => e.data as { platform?: string });

  const groups = new Map<string, typeof switches>();
  for (const s of switches) {
    const app = s.id.split('.')[0];
    groups.set(app, [...(groups.get(app) ?? []), s]);
  }

  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-5">
        <h2 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
          <ToggleLeft size={18} className="text-stone-500" />
          The switches
        </h2>
        <p className="text-sm text-stone-500 mt-1">
          What this profile actually uses. Anything off is not greyed out anywhere, it simply is not
          there. {missing.length} still need a position from you.
        </p>
      </header>

      <ChannelStrip body={body} platforms={platforms} config={config} channels={channels} onSave={save} />

      <div className="space-y-5">
        {[...groups.entries()].map(([app, list]) => (
          <section key={app}>
            <h3 className="text-sm font-semibold text-stone-700 mb-2 capitalize">{app.replace(/_/g, ' ')}</h3>
            <div className="space-y-2">
              {list.map(s => {
                const setting = config[s.id];
                const isSuggestion = !setting || setting.suggested;
                const shown = setting?.state ?? suggested[s.id]?.state ?? s.suggested_default ?? 'hidden';
                return (
                  <div key={s.id} className="bg-white border border-stone-200 rounded-xl px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-stone-900">{s.id}</p>
                        <p className="text-xs text-stone-400">
                          {s.audience === 'client' ? 'the client feels this one' : s.audience === 'both' ? 'both sides' : 'your side'}
                          {s.derived_from && ` · comes from ${s.derived_from}`}
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        {s.allowed_states.map(state => (
                          <button key={state}
                            onClick={() => setPending({ id: s.id, state })}
                            className={`px-2.5 py-1 rounded-full text-xs border ${
                              shown === state && !isSuggestion
                                ? 'bg-stone-900 text-white border-stone-900'
                                : shown === state ? 'border-amber-300 text-amber-700 bg-amber-50'
                                : 'border-stone-200 text-stone-600'
                            }`}>
                            {STATE_WORDS[state]}
                          </button>
                        ))}
                      </div>
                    </div>
                    {isSuggestion && (
                      <p className="text-xs text-amber-700 mt-1.5">
                        This is only a suggestion. It does not count until you pick it.
                      </p>
                    )}
                    {s.note && <p className="text-xs text-stone-400 mt-1.5">{s.note}</p>}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {pending && (
        <CascadeTrace
          switchId={pending.id}
          to={pending.state}
          accent={client?.color ?? '#1c1917'}
          onCancel={() => setPending(null)}
          onApply={() => {
            save(setSwitchPosition(body, pending.id, pending.state, new Date().toISOString(), false));
            setPending(null);
          }}
        />
      )}
    </div>
  );
}

/** A channel per live platform, with the two things metrics cannot work without:
 *  the timezone, and whether we post or they do (S17, S7). */
function ChannelStrip({ body, platforms, config, channels, onSave }: {
  body: ProfileBody;
  platforms: string[];
  config: ReturnType<typeof switchConfigFromBody>;
  channels: { platform?: string }[];
  onSave: (b: ProfileBody) => void;
}) {
  const [handle, setHandle] = useState<Record<string, string>>({});
  const [zone, setZone] = useState<Record<string, string>>({});
  const live = platforms.filter(p => (config[platformSwitchId(p)]?.state ?? 'hidden') === 'active');
  const missing = live.filter(p => !channels.some(c => (c.platform ?? '').toLowerCase() === p.toLowerCase()));

  if (missing.length === 0) return null;

  function add(platform: string, posting: 'we-post' | 'client-posts') {
    const now = new Date().toISOString();
    const id = `ch-${platform.toLowerCase()}`;
    onSave(putEntry(body, CHANNELS_PATH, {
      id, type: 'channel',
      data: {
        platform, account_handle: handle[platform] ?? '', ownership: 'unknown',
        connection: 'never-connected', timezone: zone[platform] || null, posting_permission: posting,
      },
    }, { writer: 'owner', now }));
  }

  return (
    <div className="mb-5 bg-white border border-stone-200 rounded-xl p-4">
      <p className="text-sm font-medium text-stone-900 flex items-center gap-2">
        <Radio size={15} className="text-stone-500" /> Accounts still to record
      </p>
      <p className="text-xs text-stone-500 mt-1">
        A platform that is on needs its account. Without the timezone the numbers cannot be read by age,
        and without knowing who posts, publishing cannot be switched on.
      </p>
      {missing.map(p => (
        <div key={p} className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-stone-700 w-24">{p}</span>
          <input value={handle[p] ?? ''} onChange={e => setHandle(v => ({ ...v, [p]: e.target.value }))}
            placeholder="handle"
            className="text-sm border border-stone-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-stone-400" />
          <input value={zone[p] ?? ''} onChange={e => setZone(v => ({ ...v, [p]: e.target.value }))}
            placeholder="timezone, like Asia/Kolkata"
            className="text-sm border border-stone-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-stone-400" />
          <button onClick={() => add(p, 'we-post')}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-stone-900 text-white">we post</button>
          <button onClick={() => add(p, 'client-posts')}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-300 text-stone-700">they post</button>
        </div>
      ))}
    </div>
  );
}
