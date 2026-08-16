'use client';

// Strategy room → What they see. 2026-08-11.
//
// HER BRIEF: "build a settings feature in my dashboard where I can select what
// exactly the client can view while adding the profile, and what not."
//
// Five rows, one per window a client can open, in her words. A tick sets every
// switch that window needs; presets set all five at once. She never has to know
// that Results is `analysis.digest_client` plus `analysis.client_publication`,
// which is what she has been doing by hand, per profile, until today.
//
// TWO HONESTIES THIS SCREEN OWES HER, both drawn rather than assumed:
//   1. A window she has ticked that still will not render says so (Brand needs
//      a locked strategy). Better here than from the client.
//   2. It says who the "they" is. A window is worthless without a login bound
//      to the profile, so when nobody is bound, the screen says that first.
//
// It grants nothing. `windowsForBinding` in lib/access.ts remains the only
// authority on what a client reaches; this sets the switches she would have set
// and reads back what they mean.

import { useState } from 'react';
import { Check } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import { setSwitchPosition, switchConfigFromBody } from '@/lib/strategy/derivation';
import {
  ACCESS_PRESETS, WINDOW_CHOICES, accessLine, moveFor, movePart, movesForPreset, readPosition,
  windowsOn,
} from '@/lib/access/windowChoice';
import type { PathState } from '@/lib/tree/contract';

export default function ClientAccess({ profileId }: { profileId: string }) {
  const { role, state, dispatch } = useApp();
  const { client, data } = useClient(profileId);
  const [note, setNote] = useState('');

  if (role !== 'owner') return <p className="p-8 text-sm text-faint">This screen is hers.</p>;

  const body = data.body;
  if (!body) {
    return <p className="p-8 text-sm text-faint">This profile is not in the new structure yet.</p>;
  }

  const config = switchConfigFromBody(body);
  const positions: Record<string, PathState | undefined> =
    Object.fromEntries(Object.entries(config).map(([id, v]) => [id, v.state]));
  const on = windowsOn(positions);

  // Who "they" actually are. A binding is what turns these ticks into a person
  // who can log in; with none, every tick below is theory.
  const bound = (state.bindings ?? []).filter(b => b.profileId === profileId && b.kind !== 'staff');

  function apply(moves: { id: string; state: PathState }[], said: string) {
    let next = body!;
    const now = new Date().toISOString();
    for (const m of moves) next = setSwitchPosition(next, m.id, m.state, now);
    dispatch({ type: 'SET_BODY', payload: { clientId: profileId, body: next } });
    setNote(said);
  }

  return (
    <div className="w-full max-w-5xl">
      <header className="mb-4">
        <h2 className="font-display text-[21px] font-bold tracking-[-.02em] text-text">What they see</h2>
        <p className="mt-1.5 text-[13.5px] font-semibold text-muted">{accessLine(on)}</p>
        {bound.length === 0 && (
          <p className="mt-1 text-[12.5px] leading-[1.6] text-accent-text">
            Nobody has a login for {client?.name ?? 'this profile'} yet, so none of this reaches
            anyone until you give one.
          </p>
        )}
      </header>

      {/* The presets first: the common cases are one tap, not five decisions. */}
      <div className="flex flex-wrap gap-1.5">
        {ACCESS_PRESETS.map(p => {
          const isOn = [...p.windows].sort().join(',') === [...on].sort().join(',');
          return (
            <button key={p.id} type="button" title={p.line}
              onClick={() => apply(movesForPreset(p.windows), `Set to ${p.label.toLowerCase()}.`)}
              className={`rounded-[10px] px-[13px] py-[7px] text-[12.5px] font-semibold ${
                isOn ? 'bg-ink text-white' : 'bg-control text-muted hover:text-text'
              }`}>
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 space-y-2.5">
        {WINDOW_CHOICES.map(w => {
          const isOn = on.includes(w.key);
          return (
            <section key={w.key} className="rounded-card border border-hairline bg-white p-4 shadow-card">
              <div className="flex items-start gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-semibold text-text">{w.label}</span>
                  <span className="mt-0.5 block text-[12.5px] leading-[1.5] text-faint">{w.line}</span>
                </span>
                <Toggle
                  on={isOn}
                  label={`${isOn ? 'Hide' : 'Show'} ${w.label.toLowerCase()}`}
                  onClick={() => apply(
                    moveFor(w.key, !isOn),
                    isOn ? `${w.label} is hidden from them.` : `${w.label} is open to them.`,
                  )}
                />
              </div>

              {/* The window's parts, each its own switch (2026-08-11): "in
                  content there are multiple things... choose what to show and
                  what to hide". Shown while the window is on; the master
                  toggle above moves all of them at once. */}
              {isOn && w.parts && (
                <div className="mt-2.5 space-y-1.5 border-t border-hairline pt-2.5">
                  {w.parts.map(part => {
                    // Position-or-default, the same reading windowsOn uses
                    // (2026-08-16): a part she never touched shows its truth.
                    const partOn = readPosition(positions, part.switch) === 'active';
                    return (
                      <div key={part.key} className="flex items-start gap-3 pl-3">
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-semibold text-text">{part.label}</span>
                          <span className="mt-px block text-[12px] leading-[1.45] text-faint">{part.line}</span>
                        </span>
                        <Toggle
                          on={partOn}
                          label={`${partOn ? 'Hide' : 'Show'} ${part.label.toLowerCase()}`}
                          onClick={() => apply(
                            movePart(w.key, part.key, !partOn),
                            partOn ? `${part.label} is hidden from them.` : `${part.label} is open to them.`,
                          )}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {note && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted">
          <Check size={14} strokeWidth={2.4} />
          {note}
        </p>
      )}
    </div>
  );
}

/** A plain switch. Deliberately not a checkbox: this is a door, not a form. */
function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`relative h-[26px] w-[44px] flex-none rounded-full transition-colors ${
        on ? 'bg-ink' : 'bg-control'
      }`}
    >
      <span
        className={`absolute top-[3px] h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
          on ? 'left-[21px]' : 'left-[3px]'
        }`}
      />
    </button>
  );
}
