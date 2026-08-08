'use client';

// Strategy room → Channels. Spec 34 §6.
//
// Her words about the screen this replaces: "I'm not able to understand
// Channels. What do you want to connect with the channels?" The old screen drew
// two headed lists — "Channels" and "Connected accounts" — and never once said
// what a channel is or why connecting one matters. That is spec 34 §1 exactly:
// the data model on screen instead of the work.
//
// So the first thing on this screen is the answer. This is where this brand
// posts, and where the numbers come from; connecting an account is what makes
// Analysis work at all. Everything below is one row per place it posts.
//
// Three rules this file holds to:
//
// 1. NOT CONNECTED IS NOT AN ERROR. No red, no warning triangle, no exclamation.
//    A channel with no account gets one plain line saying what stays
//    unavailable while it is that way, and the rest of the row is unchanged.
// 2. ONE CONNECT FLOW IN THIS APP. The token box below posts to
//    `/api/ig-accounts`, the same endpoint `components/ConnectionsView.tsx`
//    uses, and ties the account to this profile the same way. There is no
//    second connect mechanism and this file does not invent one.
// 3. NO COUNT IS TYPED. Every line comes out of `lib/strategy/reading.ts`,
//    counted from the array it describes.

import { useCallback, useEffect, useState } from 'react';
import { Check, Instagram, Linkedin, Plus, Youtube, AtSign } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import {
  CHANNELS_PURPOSE, buildChannelRows, canConnectHere, channelRecords, channelSummary, channelsNote,
  decidedPlatforms, type ChannelRow, type ConnectedAccount,
} from '@/lib/strategy/reading';

interface AccountRow {
  id: string;
  username: string;
  client_id: string | null;
  token_refreshed_at: string;
}

const ICONS: Record<string, typeof Instagram> = {
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
};

function iconFor(platform: string) {
  return ICONS[platform.trim().toLowerCase()] ?? AtSign;
}

export default function Channels({ profileId }: { profileId: string }) {
  const { role } = useApp();
  const { data } = useClient(profileId);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/ig-accounts', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) { setNote(json.error ?? 'The account list could not be read just now.'); return; }
      // Only this profile's accounts are ever put on screen: nothing inside a
      // profile may name another profile, in any form.
      setAccounts((json.accounts ?? []).filter((a: AccountRow) => a.client_id === profileId));
    } catch {
      setNote('The account list could not be read just now. Check your connection.');
    }
  }, [profileId]);

  useEffect(() => { void load(); }, [load]);

  // Owner only, always, in every switch position (spec 34 §2).
  if (role !== 'owner') return <p className="p-8 text-sm text-faint">This screen is hers.</p>;

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
      if (!res.ok) { setNote(json.error ?? 'That token did not work. Try pasting it again.'); return; }
      // Tie it to this profile straight away. That is what puts its numbers here.
      if (json.account?.id) {
        await fetch('/api/ig-accounts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId: json.account.id, clientId: profileId }),
        });
      }
      setToken('');
      setNote('Connected. The first numbers arrive with the next nightly sync.');
      await load();
    } catch {
      setNote('That did not go through. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }

  const linked: ConnectedAccount[] = accounts.map(a => ({ id: a.id, username: a.username }));
  const rows = buildChannelRows({
    channels: channelRecords(data.body),
    platforms: decidedPlatforms(data.body),
    accounts: linked,
  });
  const summary = channelSummary(rows);
  const footnote = channelsNote(rows);
  const offerConnect = canConnectHere(rows) || rows.length === 0;

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-4">
        <h2 className="font-display text-[21px] font-bold tracking-[-.02em] text-text">Channels</h2>
        <p className="mt-1.5 text-[13.5px] leading-[1.6] text-muted">{CHANNELS_PURPOSE}</p>
      </header>

      <p className="tnum mb-2.5 text-[11.5px] font-bold uppercase tracking-[.09em] text-faint">{summary}</p>

      {rows.length === 0 ? (
        <div className="rounded-card border border-hairline bg-white p-5 shadow-card">
          <p className="text-[14.5px] font-semibold text-text">No channel here yet</p>
          <p className="mt-1 text-[13.5px] leading-[1.6] text-muted">
            A channel is one place this brand posts. Decide the platforms first, or connect the
            account below and the channel comes with it.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map(row => <ChannelCard key={row.key} row={row} />)}
        </div>
      )}

      {footnote && <p className="mt-3 text-[12.5px] leading-[1.6] text-faint">{footnote}</p>}

      {offerConnect && (
        <section className="mt-5 rounded-card border border-hairline bg-white p-4 shadow-card md:p-5">
          <h3 className="text-[14.5px] font-semibold text-text">Connect an Instagram account</h3>
          <p className="mt-1 text-[13.5px] leading-[1.6] text-muted">
            Paste the access token once. It is kept on the server and never shown again, here or
            anywhere else.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={token}
              onChange={e => setToken(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void connect(); }}
              type="password"
              autoComplete="off"
              placeholder="Paste the access token"
              className="min-w-0 flex-1 rounded-xl border border-[rgba(23,21,26,.12)] bg-white px-3 py-2.5 text-sm text-text placeholder:text-faint focus:border-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void connect()}
              disabled={busy || !token.trim()}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40"
            >
              <Plus size={15} strokeWidth={2.2} />
              {busy ? 'Checking' : 'Connect'}
            </button>
          </div>
          {note && <p className="mt-2 text-[12.5px] text-muted">{note}</p>}
        </section>
      )}
    </div>
  );
}

/**
 * One channel. The account, whether it is connected, and what connecting gets
 * her — in that order, because that is the order she asks the questions in.
 */
function ChannelCard({ row }: { row: ChannelRow }) {
  const Icon = iconFor(row.platform);
  return (
    <article className="rounded-card border border-hairline bg-white p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-[11px] bg-control">
          <Icon size={17} strokeWidth={1.9} className="text-muted" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-text">{row.platform}</p>
          {/* Wraps rather than truncates: on a phone the account is the thing
              she came here to read, and half of it is worse than two lines. */}
          <p className="mt-0.5 text-[12.5px] leading-[1.5] text-faint">
            {row.account || 'No account named yet'} · {row.posting}
          </p>
        </div>
        {/* A state, never an alarm. Nothing here is red and nothing warns. */}
        {row.connected ? (
          <span className="inline-flex flex-none items-center gap-1 rounded-full bg-positive-bg px-2.5 py-1 text-[11.5px] font-bold text-positive">
            <Check size={12} strokeWidth={2.6} /> {row.state}
          </span>
        ) : (
          <span className="inline-flex flex-none items-center rounded-full bg-chip px-2.5 py-1 text-[11.5px] font-bold text-muted">
            {row.state}
          </span>
        )}
      </div>

      <p className="mt-3 text-[13.5px] leading-[1.6] text-muted">{row.gets}</p>

      {row.without && (
        <p className="mt-2 rounded-xl bg-sunken px-3 py-2.5 text-[13px] leading-[1.55] text-muted">
          {row.without}
        </p>
      )}
    </article>
  );
}
