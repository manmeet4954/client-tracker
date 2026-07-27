'use client';

// Strategy corner → Channels — spec 28 §5.2's re-homing of ConnectionsView, and
// §11.3's reason for it: a channel belongs to a PROFILE (S17, spec 22 §8.5).
//
// This is deliberately NOT the old cross-profile connections screen mounted in a
// frame. That screen lists every account and every profile name beside a picker,
// and nothing inside a profile may name another profile, in any form (§5.7).
// So the panel shows THIS profile's channels and THIS profile's connected
// accounts, and the token box connects an account straight to this profile.
//
// Tokens are pasted once, stored on the server, and returned to nobody
// (spec 26 §12). Nothing below ever renders one.

import { useCallback, useEffect, useState } from 'react';
import { Instagram } from 'lucide-react';
import { useClient } from '@/contexts/AppContext';

interface AccountRow {
  id: string;
  username: string;
  client_id: string | null;
  token_refreshed_at: string;
}

export default function ChannelsPanel({ profileId, accent }: { profileId: string; accent: string }) {
  const { data } = useClient(profileId);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/ig-accounts', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) { setNote(json.error ?? 'Could not load the accounts.'); return; }
      // Only this profile's accounts are ever put on screen.
      setAccounts((json.accounts ?? []).filter((a: AccountRow) => a.client_id === profileId));
    } catch {
      setNote('Could not load the accounts. Check your connection.');
    }
  }, [profileId]);

  useEffect(() => { void load(); }, [load]);

  async function connect() {
    const t = token.trim();
    if (!t) return;
    setBusy(true);
    setNote('');
    try {
      const res = await fetch('/api/ig-accounts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: t }),
      });
      const json = await res.json();
      if (!res.ok) { setNote(json.error ?? 'Could not connect the account.'); return; }
      // Tie it to this profile straight away — that is what ties its numbers here.
      if (json.account?.id) {
        await fetch('/api/ig-accounts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId: json.account.id, clientId: profileId }),
        });
      }
      setToken('');
      setNote('Connected.');
      await load();
    } finally {
      setBusy(false);
    }
  }

  const channels = (data.body?.paths?.['work-log/creation/channels'] ?? [])
    .map(e => ({ id: e.id, ...(e.data as { platform?: string; handle?: string; timezone?: string; posting_permission?: string }) }));

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section>
        <h3 className="mb-2 text-sm font-semibold text-stone-900">Channels</h3>
        {channels.length === 0
          ? <p className="rounded-xl border border-stone-200 bg-white px-4 py-4 text-sm text-stone-500">No channel yet for this profile.</p>
          : (
            <ul className="space-y-1.5">
              {channels.map(c => (
                <li key={c.id} className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm">
                  <span className="font-medium text-stone-900">{c.platform ?? 'Channel'}</span>
                  {c.handle ? <span className="text-stone-500"> · {c.handle}</span> : null}
                  {c.timezone ? <span className="text-stone-400"> · {c.timezone}</span> : null}
                  <span className="text-stone-400">
                    {c.posting_permission === 'we-post' ? ' · we post' : ' · they post'}
                  </span>
                </li>
              ))}
            </ul>
          )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-stone-900">Connected accounts</h3>
        {accounts.length === 0
          ? <p className="rounded-xl border border-stone-200 bg-white px-4 py-4 text-sm text-stone-500">No account is connected to this profile yet.</p>
          : (
            <ul className="space-y-1.5">
              {accounts.map(a => (
                <li key={a.id} className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm">
                  <Instagram size={15} className="text-stone-400" />
                  <span className="text-stone-900">@{a.username}</span>
                  <span className="ml-auto text-xs text-stone-400">
                    token refreshed {String(a.token_refreshed_at).slice(0, 10)}
                  </span>
                </li>
              ))}
            </ul>
          )}
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-stone-900">Connect an account</h3>
        <p className="mt-0.5 text-xs text-stone-500">
          Paste the access token once. It is stored on the server and never shown again.
        </p>
        <div className="mt-2 flex gap-2">
          <input value={token} onChange={e => setToken(e.target.value)} type="password"
            placeholder="Access token"
            className="min-w-0 flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm" />
          <button type="button" onClick={connect} disabled={busy || !token.trim()}
            className="rounded-lg px-3.5 py-2 text-sm text-white disabled:opacity-40"
            style={{ backgroundColor: accent }}>
            Connect
          </button>
        </div>
        {note && <p className="mt-2 text-xs text-stone-500">{note}</p>}
      </section>
    </div>
  );
}
