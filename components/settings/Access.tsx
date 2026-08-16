'use client';

// Settings → who gets in, and what they see. 2026-08-11.
//
// HER PROPOSAL, and I agreed: "should we have the settings tab outside the app?
// Inside the settings tab, I can decide who to give access to and what to give
// access to whom, and then maybe a link is generated to share with them."
//
// She then asked the right follow-up: "after that as well, do we need the
// settings option in the strategy?" No. Keeping both would repeat the exact
// duplication she had just finished catching, so the per-profile copy is gone
// from the Strategy room and this is the only place access is decided.
//
// It RENDERS `ClientAccess` per profile rather than restating it, for the same
// reason: one set of toggles, one file, no drift.
//
// THE CEILING THAT WAS HERE IS GONE, same day. This file used to end with a
// paragraph explaining that a new person could not be added, because logins
// were five roles mapped to five environment passcodes. Her answer was "I
// cannot register everyone's password every time", which was the right answer,
// so people became DATA. See components/settings/People and
// lib/access/invites.ts. Her own login stays in the environment on purpose: it
// must not depend on a database read.

import { useState } from 'react';
import Link from 'next/link';
import { Check, ChevronDown, ChevronLeft, ChevronRight, Link2 } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import ClientAccess from '@/components/strategy/ClientAccess';
import People from '@/components/settings/People';
import { switchConfigFromBody } from '@/lib/strategy/derivation';
import { accessLine, windowsOn } from '@/lib/access/windowChoice';
import { clientView } from '@/lib/access/clientPreview';
import type { PathState } from '@/lib/tree/contract';

export default function Access() {
  const { state, role } = useApp();
  const [openId, setOpenId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  if (role !== 'owner') {
    return <p className="p-8 text-sm text-faint">This screen is hers.</p>;
  }

  const profiles = (state.clients ?? []).filter(c => (c.lifecycle ?? 'active') !== 'archived');

  function copyLink(profileId: string) {
    navigator.clipboard?.writeText(`${window.location.origin}/profile/${profileId}`)
      .catch(() => undefined);
    setCopied(profileId);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="w-full max-w-5xl p-4 md:p-8">
      <header className="mb-5">
        {/* The way back (2026-08-11). Settings shipped with no exit: reachable
            from the desk, returnable by nothing but the browser. A screen you
            can enter and not leave is a trap, not a screen. */}
        <Link href="/shelf"
          className="mb-3 inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[.12em] text-faint hover:text-text">
          <ChevronLeft size={14} strokeWidth={2.4} />
          The desk
        </Link>
        <h1 className="font-display text-[24px] font-bold tracking-[-.02em] text-text">Settings</h1>
        <p className="mt-1.5 text-[13.5px] leading-[1.6] text-muted">
          Who gets into which profile, and what they can open once they are in. Invite anyone
          without asking me: they get their own code.
        </p>
      </header>

      <div className="space-y-2">
        {profiles.map(c => {
          const bound = (state.bindings ?? []).filter(b => b.profileId === c.id && b.kind !== 'staff');
          const body = state.clientData?.[c.id]?.body;
          const positions: Record<string, PathState | undefined> = body
            ? Object.fromEntries(Object.entries(switchConfigFromBody(body)).map(([id, v]) => [id, v.state]))
            : {};
          const on = windowsOn(positions);
          const isOpen = openId === c.id;

          return (
            <section key={c.id} className="overflow-hidden rounded-card border border-hairline bg-white shadow-card">
              <div className="flex items-start gap-2 p-4">
                <button type="button" onClick={() => setOpenId(isOpen ? null : c.id)}
                  className="flex min-w-0 flex-1 items-start gap-2.5 text-left">
                  {isOpen
                    ? <ChevronDown size={16} strokeWidth={2.2} className="mt-1 flex-none text-faint" />
                    : <ChevronRight size={16} strokeWidth={2.2} className="mt-1 flex-none text-faint" />}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-text">{c.name}</span>
                    <span className="mt-0.5 block text-[12.5px] leading-[1.5] text-faint">
                      {bound.length === 0
                        ? 'Nobody can open this one.'
                        : `${bound.map(b => b.role).join(', ')} · ${accessLine(on)}`}
                    </span>
                  </span>
                </button>
                <button type="button" onClick={() => copyLink(c.id)}
                  className="inline-flex flex-none items-center gap-1.5 rounded-xl border border-hairline px-3 py-2 text-[12.5px] font-semibold text-muted hover:text-text">
                  {copied === c.id ? <Check size={14} strokeWidth={2.3} /> : <Link2 size={14} strokeWidth={2.2} />}
                  {copied === c.id ? 'Copied' : 'Link'}
                </button>
              </div>

              {isOpen && (
                <div className="border-t border-hairline px-4 pb-4 pt-3">
                  {bound.length === 0 && (
                    <p className="mb-3 text-[12.5px] leading-[1.5] text-accent-text">
                      Nobody is bound to {c.name}, so nothing below reaches anyone yet.
                    </p>
                  )}
                  <ClientAccess profileId={c.id} />
                  <TheirView profileId={c.id} name={c.name} />
                  <Link href={`/profile/${c.id}/strategy/lifecycle`}
                    className="mt-3 inline-block text-[12.5px] font-semibold text-accent hover:underline">
                    Pause or archive {c.name}
                  </Link>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <People />
    </div>
  );
}

/**
 * What this client would see if they logged in right now — 2026-08-11.
 *
 * Asked by the real access rules (`windowsForBinding`, via clientView), never a
 * mock, so this list cannot flatter. The reasons under closed windows are what
 * used to be discovered by the client opening an empty screen.
 */
function TheirView({ profileId, name }: { profileId: string; name: string }) {
  const { state } = useApp();
  const view = clientView(state, profileId);

  return (
    <div className="mt-4 rounded-xl bg-chip p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11.5px] font-bold uppercase tracking-[.09em] text-muted">
          If {name} logged in right now
        </p>
        {/* Her question, 2026-08-11: "how will they see it." A list of window
            names is not their screen; this opens their screen. */}
        <Link href={`/profile/${profileId}/client-preview`}
          className="text-[12.5px] font-semibold text-accent hover:underline">
          See it as they will
        </Link>
      </div>
      {/* 2026-08-11, after she tested the link herself and saw everything: the
          profile link shows each LOGIN its own view. Signed in as her, it is
          her whole dashboard; a client with a client code gets only the
          windows above. Said here because this is where she copies the link. */}
      <p className="mt-1 text-[12px] leading-[1.5] text-faint">
        Opening the link yourself shows your own full view, because you are signed in as you.
        What a client sees is only what is ticked above, and the preview shows it exactly.
      </p>

      {view.nothing ? (
        <p className="mt-1.5 text-[13px] font-semibold text-accent-text">
          They would see nothing at all.
        </p>
      ) : (
        <p className="mt-1.5 text-[13px] text-text">
          <span className="font-semibold">They can open: </span>
          {view.open.map(w => w.label).join(', ')}.
        </p>
      )}

      {view.closed.length > 0 && (
        <ul className="mt-2 space-y-1">
          {view.closed.map(w => (
            <li key={w.key} className="flex items-baseline gap-2 text-[12.5px]">
              <span className="font-semibold text-muted">{w.label}:</span>
              <span className="text-faint">{w.why}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
