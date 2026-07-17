'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Instagram, Plus } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';

// Owner-only screen (Spec 03): connect Instagram accounts and link each one
// to its dashboard client. Tokens are pasted here once, stored on the server,
// and never shown again. The list below never contains a token.

interface IgAccountRow {
  id: string;
  username: string;
  client_id: string | null;
  token_refreshed_at: string;
  created_at: string;
}

export default function ConnectionsView() {
  const { state, role } = useApp();
  const router = useRouter();
  const isOwner = role === 'owner';

  const [accounts, setAccounts] = useState<IgAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [token, setToken] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  // Server enforces owner-only too; this just keeps others off the page.
  useEffect(() => {
    if (!isOwner) router.replace('/clients');
  }, [isOwner, router]);

  async function loadAccounts() {
    setLoadError('');
    try {
      const res = await fetch('/api/ig-accounts', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) { setLoadError(data.error ?? 'Could not load accounts.'); return; }
      setAccounts(data.accounts ?? []);
    } catch {
      setLoadError('Could not load accounts. Check your connection.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isOwner) loadAccounts();
  }, [isOwner]);

  async function connect() {
    const t = token.trim();
    if (!t) return;
    setConnecting(true);
    setConnectError('');
    try {
      const res = await fetch('/api/ig-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: t }),
      });
      const data = await res.json();
      if (!res.ok) { setConnectError(data.error ?? 'Could not connect the account.'); return; }
      setToken('');
      await loadAccounts();
    } catch {
      setConnectError('Could not connect the account. Try again.');
    } finally {
      setConnecting(false);
    }
  }

  async function setLink(accountId: string, clientId: string) {
    setSavingId(accountId);
    // Show the choice right away; reload confirms it.
    setAccounts(prev => prev.map(a => a.id === accountId ? { ...a, client_id: clientId || null } : a));
    try {
      await fetch('/api/ig-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, clientId }),
      });
      await loadAccounts();
    } finally {
      setSavingId(null);
    }
  }

  if (!isOwner) return null;

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      {/* Header band */}
      <header
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(120deg, #8c52ff 0%, #c35dcc 52%, #ff914d 100%)' }}
      >
        <div className="relative z-10 px-5 md:px-10 pt-6 pb-7 max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium transition-colors"
            >
              <ArrowLeft size={16} />
              Home
            </button>
          </div>
          <h1
            className="text-white"
            style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: 'clamp(28px, 5vw, 44px)', letterSpacing: '-0.02em' }}
          >
            Connections
          </h1>
          <p className="text-white/70 text-sm mt-1">
            Instagram accounts the dashboard pulls numbers from, once a day.
          </p>
        </div>
      </header>

      <main className="px-4 md:px-10 py-6 max-w-3xl mx-auto space-y-6">
        {/* Connected accounts */}
        <section className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100">
            <h2 className="font-semibold text-stone-900 text-sm">Connected accounts</h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Pick which client each account belongs to. That is what ties its numbers to the right workspace.
            </p>
          </div>

          {loading ? (
            <p className="px-5 py-6 text-sm text-stone-400">Loading...</p>
          ) : loadError ? (
            <p className="px-5 py-6 text-sm text-red-500">{loadError}</p>
          ) : accounts.length === 0 ? (
            <p className="px-5 py-6 text-sm text-stone-400">
              No accounts yet. Connect the first one below.
            </p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {accounts.map(account => (
                <li key={account.id} className="px-5 py-4 flex flex-wrap items-center gap-3">
                  <span className="w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center shrink-0">
                    <Instagram size={16} className="text-stone-500" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-stone-900 truncate">@{account.username}</p>
                    <p className="text-xs text-stone-400">
                      Token last refreshed {new Date(account.token_refreshed_at).toLocaleDateString()}
                    </p>
                  </div>
                  <select
                    value={account.client_id ?? ''}
                    onChange={e => setLink(account.id, e.target.value)}
                    disabled={savingId === account.id}
                    className="px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent disabled:opacity-50"
                  >
                    <option value="">Not linked yet</option>
                    {state.clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Connect a new account */}
        <section className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100">
            <h2 className="font-semibold text-stone-900 text-sm">Connect a new account</h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Paste the access token from the Meta app. It is saved on the server and never shown again.
            </p>
          </div>
          <div className="px-5 py-4 space-y-3">
            <input
              value={token}
              onChange={e => setToken(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && connect()}
              placeholder="Paste the access token here"
              autoComplete="off"
              className="input-base"
            />
            {connectError && <p className="text-xs text-red-500">{connectError}</p>}
            <div className="flex justify-end">
              <button
                onClick={connect}
                disabled={!token.trim() || connecting}
                className="btn-primary flex items-center gap-1.5"
              >
                <Plus size={14} />
                {connecting ? 'Checking...' : 'Connect'}
              </button>
            </div>
          </div>
        </section>

        <p className="text-xs text-stone-400 px-1">
          New numbers arrive with the nightly sync. Post links on content cards are matched then too.
        </p>
      </main>
    </div>
  );
}
