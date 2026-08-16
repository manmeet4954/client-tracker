'use client';

// Settings → people. Giving access without a deploy, 2026-08-11.
//
// HER QUESTION: "How can I not go through the route where I have to add
// passcodes for them every time, but still want to make sure that they get
// access to their own profiles with the selected settings and things I want
// them to see? I cannot register everyone's password every time."
//
// She types a name, ticks which profiles it opens, and the app makes a code.
// She sends the link and the code. No deploy, no server setting, no me.
//
// THE CODE IS SHOWN, PERMANENTLY AND ON PURPOSE. Every instinct says hash it
// and show it once. That instinct is wrong here: the person she is inviting
// will lose it, and will ask her for it again, in a week, over WhatsApp. If she
// cannot read it back she has to revoke and reissue, which means the client
// gets a second code and the first message becomes a lie. The threat this
// guards against is not "someone reads the code off her screen" but "her client
// cannot get in", so the code stays readable and Take back is one tap.

import { useState } from 'react';
import { Check, Copy, Plus, Undo2 } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { generateId } from '@/lib/utils';
import {
  bindingsFor, codeFrom, inviteLine, isLive, makeInvite, revoke, roleForInvite, type Invite,
} from '@/lib/access/invites';

/** Twelve random letters, from the browser's own generator. */
function newCode(): string {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return codeFrom([...bytes]);
}

export default function People() {
  const { state, dispatch } = useApp();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const invites = state.invites ?? [];
  const profiles = (state.clients ?? []).filter(c => (c.lifecycle ?? 'active') !== 'archived');
  const nameOf = (id: string) => profiles.find(p => p.id === id)?.name ?? 'a profile';

  /**
   * Save the invites AND the bindings together.
   *
   * Bindings for guests are rebuilt wholesale from the live invites every time,
   * and the fixed logins' bindings are carried through untouched. That is what
   * makes revoking actually revoke: a taken-back invite contributes no binding,
   * so the door shuts in the same write that closes the code.
   */
  function save(next: Invite[]) {
    const others = (state.bindings ?? []).filter(b => !b.role.startsWith('guest:'));
    const guests = next.filter(isLive).flatMap(bindingsFor);
    dispatch({ type: 'SET_INVITES', payload: { invites: next, bindings: [...others, ...guests] } });
  }

  function create() {
    const who = name.trim();
    if (!who) return;
    const invite = makeInvite({
      id: generateId(), name: who, code: newCode(), profileIds: picked,
      now: new Date().toISOString(),
    });
    save([...invites, invite]);
    setName('');
    setPicked([]);
    setAdding(false);
  }

  function toggleProfile(inviteId: string, profileId: string) {
    save(invites.map(i => i.id === inviteId
      ? {
        ...i,
        profileIds: i.profileIds.includes(profileId)
          ? i.profileIds.filter(p => p !== profileId)
          : [...i.profileIds, profileId],
      }
      : i));
  }

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text).catch(() => undefined);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const live = invites.filter(isLive);
  const gone = invites.filter(i => !isLive(i));

  return (
    <section className="mt-6">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-[17px] font-bold tracking-[-.01em] text-text">People</h2>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-accent hover:underline">
            <Plus size={14} strokeWidth={2.3} />
            Invite someone
          </button>
        )}
      </div>
      <p className="mb-2.5 text-[12.5px] leading-[1.6] text-faint">
        Anyone you invite gets their own code. They see only the profiles you tick, and inside
        those, only what you allow above.
      </p>

      {adding && (
        <div className="mb-2 rounded-card border border-hairline bg-white p-4 shadow-card">
          <input value={name} onChange={e => setName(e.target.value)} autoFocus
            onKeyDown={e => { if (e.key === 'Enter') create(); if (e.key === 'Escape') setAdding(false); }}
            placeholder="Who is it for?"
            className="w-full rounded-xl border border-[rgba(23,21,26,.12)] px-3 py-2.5 text-[14px] text-text placeholder:text-faint focus:border-accent focus:outline-none" />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {profiles.map(p => {
              const on = picked.includes(p.id);
              return (
                <button key={p.id} type="button"
                  onClick={() => setPicked(v => on ? v.filter(x => x !== p.id) : [...v, p.id])}
                  className={`rounded-[10px] px-[13px] py-[7px] text-[12.5px] font-semibold ${
                    on ? 'bg-ink text-white' : 'bg-control text-muted hover:text-text'
                  }`}>
                  {p.name}
                </button>
              );
            })}
          </div>
          <div className="mt-2.5 flex gap-2">
            <button type="button" onClick={create} disabled={!name.trim()}
              className="rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40">
              Make their code
            </button>
            <button type="button" onClick={() => setAdding(false)}
              className="rounded-xl px-3 py-2.5 text-[13px] font-semibold text-muted hover:text-text">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {live.map(invite => {
          const link = typeof window !== 'undefined' ? window.location.origin : '';
          return (
            <div key={invite.id} className="rounded-card border border-hairline bg-white p-4 shadow-card">
              <div className="flex items-start gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-text">{invite.name}</span>
                  <span className="mt-0.5 block text-[12.5px] leading-[1.5] text-faint">
                    {inviteLine(invite, nameOf)}
                  </span>
                </span>
                <button type="button" onClick={() => save(revoke(invites, invite.id, new Date().toISOString()))}
                  className="inline-flex flex-none items-center gap-1.5 text-[12.5px] font-semibold text-muted hover:text-text">
                  <Undo2 size={14} strokeWidth={2.2} />
                  Take back
                </button>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-xl bg-chip px-3 py-2.5">
                <code className="tnum text-[15px] font-bold tracking-[.06em] text-text">{invite.code}</code>
                <button type="button" onClick={() => copy(invite.code, `${invite.id}-code`)}
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-muted hover:text-text">
                  {copied === `${invite.id}-code` ? <Check size={13} strokeWidth={2.4} /> : <Copy size={13} strokeWidth={2.2} />}
                  {copied === `${invite.id}-code` ? 'Copied' : 'Code'}
                </button>
                <button type="button" onClick={() => copy(`Sign in at ${link}/login with the code ${invite.code}`, `${invite.id}-both`)}
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-muted hover:text-text">
                  {copied === `${invite.id}-both` ? <Check size={13} strokeWidth={2.4} /> : <Copy size={13} strokeWidth={2.2} />}
                  {copied === `${invite.id}-both` ? 'Copied' : 'Link and code'}
                </button>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {profiles.map(p => {
                  const on = invite.profileIds.includes(p.id);
                  return (
                    <button key={p.id} type="button" onClick={() => toggleProfile(invite.id, p.id)}
                      className={`rounded-[10px] px-[11px] py-[6px] text-[12px] font-semibold ${
                        on ? 'bg-ink text-white' : 'bg-control text-muted hover:text-text'
                      }`}>
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {gone.length > 0 && (
        <p className="mt-2.5 text-[12.5px] text-faint">
          Taken back: {gone.map(i => i.name).join(', ')}. Their codes no longer work.
        </p>
      )}

      {/* The five that cannot be changed from here, said once rather than hidden. */}
      <p className="mt-3 text-[12px] leading-[1.6] text-faint">
        Your own login, and the four set up before this screen existed, still live in the server
        settings and are not listed here.
      </p>
    </section>
  );
}
