'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, PenLine, Search, Sparkles } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import type { ProfileBody } from '@/lib/tree/body';
import type { SeedStatus } from '@/lib/tree/objects';
import {
  filterSeeds, isCaptureInputShell, pieceCounts, pillarsForProfile, readSeeds, sortSeeds,
  writeSeed, type SeedFilter,
} from '@/lib/engine/seeds';
import { writeCapture } from '@/lib/engine/captures';
import {
  dismissProposal, pickUpProposal, waitingProposals, writeProposal, ProposalRefused,
  type StoredProposal,
} from '@/lib/engine/proposals';
import { writeRun, spendSoFar, type EngineRun } from '@/lib/engine/runs';
import { dismissalFeedback, belowTheBar } from '@/lib/engine/feedback';
import { switchConfigFromBody, strategyLocked } from '@/lib/strategy/derivation';
import { effectiveState } from '@/lib/tree/switches';
import { extractionAvailability } from '@/lib/engine/extraction';
import type { Badge } from '@/lib/engine/checks';
import ProfileBodyGate from './ProfileBodyGate';
import SeedSheet from './SeedSheet';

/**
 * The Engine Room — spec 23 §3.
 *
 * PLAN §3.10, binding: "the engine is not a form that pushes you to the next
 * step. It is a separate, powerful space to brainstorm in… the engine serves,
 * never rails." So: no wizard, no step counter, no next chain, no progress bar,
 * no counter telling her how many seeds she should have, and no nagging empty
 * state. She can walk in and walk out having created nothing.
 */

const STATUS_LABEL: Record<SeedStatus, string> = {
  draft: 'Draft', discussed: 'Talked about', validated: 'Stands up', locked: 'Locked',
};
const STATUS_DOT: Record<SeedStatus, string> = {
  draft: 'bg-stone-300', discussed: 'bg-amber-400', validated: 'bg-sky-400', locked: 'bg-emerald-500',
};

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export default function EngineRoomView({ clientId }: { clientId: string }) {
  const router = useRouter();
  const { role, dispatch } = useApp();
  const { client, data } = useClient(clientId);

  const [box, setBox] = useState('');
  const [talkingAbout, setTalkingAbout] = useState<string | null>(null);
  const [openSeed, setOpenSeed] = useState<string | null>(null);
  const [filter, setFilter] = useState<SeedFilter>({});
  const [working, setWorking] = useState(false);
  const [note, setNote] = useState('');

  const body = data.body;
  const save = (next: ProfileBody, message = '') => {
    dispatch({ type: 'SET_BODY', payload: { clientId, body: next } });
    if (message !== undefined) setNote(message);
  };

  const pillars = useMemo(() => (body ? pillarsForProfile(body) : []), [body]);

  if (role !== 'owner') return <p className="p-8 text-sm text-stone-400">This screen is hers.</p>;
  if (!body) return <ProfileBodyGate clientId={clientId} />;

  const config = switchConfigFromBody(body);
  const lifecycle = client?.lifecycle ?? 'active';
  const roomOpen = effectiveState('creation.engine', config) !== 'hidden';
  const readOnly = lifecycle === 'paused' || lifecycle === 'closing' || lifecycle === 'archived';
  const availability = extractionAvailability({
    // The browser cannot see the key. The room asks the server, and until it
    // has an answer it assumes the key is there — the server refuses honestly
    // and says why, rather than the screen guessing.
    hasApiKey: true,
    extractionSwitchActive: effectiveState('creation.seed_extraction', config) === 'active',
    strategyLocked: strategyLocked(body),
    lifecycle,
  });

  const all = sortSeeds(readSeeds(body));
  const shown = filterSeeds(body, all, filter);
  const proposals = waitingProposals(body);
  const spend = spendSoFar(body);

  if (!roomOpen) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <p className="text-sm text-stone-500">
          The engine is switched off for this profile. Everything already in it is still here.
        </p>
      </div>
    );
  }

  // ── Extraction: SHE triggers it, and nothing else ever does ───────────────
  async function findTheSeeds(text: string, seedId?: string) {
    if (!text.trim() || working) return;
    setWorking(true);
    setNote('');
    const now = new Date().toISOString();
    const captureId = uid('cap');

    // The capture is written FIRST, before the model is called. If the call
    // fails the capture is still here and she can retry against it (§4.1).
    let next: ProfileBody;
    try {
      next = writeCapture(body!, {
        id: captureId,
        text,                                  // verbatim, untouched
        arrival: text.length > 400 ? 'pasted' : 'typed',
        seed_id: seedId,
      }, now);
      save(next, '');
    } catch (e) {
      setWorking(false);
      setNote(e instanceof Error ? e.message : 'That could not be saved.');
      return;
    }

    try {
      const res = await fetch('/api/engine/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId, captureId, captureText: text, seedId,
          runId: uid('run'), packetId: uid('pkt'),
        }),
      });
      const out = await res.json();
      if (!res.ok) {
        setNote(out.detail ?? 'The engine could not run just now. Your capture is saved.');
        setWorking(false);
        return;
      }

      // The run log is written whatever happened — success, refusal or error.
      const run = out.run as EngineRun;
      const cards = (out.proposals ?? []) as { proposal: StoredProposal['proposal']; badges: Badge[] }[];
      const ids: string[] = [];
      for (const card of cards) {
        const id = uid('prop');
        ids.push(id);
        next = writeProposal(next, {
          id, kind: card.proposal.kind, fed_by: 'engine:content',
          run_id: run.id, capture_id: captureId,
          proposal: card.proposal, badges: card.badges,
        // `model` is nullable since spec 25 (a short-circuited gate run makes no
        // call). An extraction always made one, so the fallback never fires.
        }, now, run.model ?? 'claude-opus-5');
      }
      next = writeRun(next, { ...run, proposal_ids: ids });
      save(next, out.message ?? '');
      if (seedId) setTalkingAbout(null);
      setBox('');
    } catch {
      setNote('That did not go through. Your capture is saved — you can try again.');
    } finally {
      setWorking(false);
    }
  }

  function writeOneMyself() {
    const id = uid('seed');
    save(writeSeed(body!, {
      id, name: 'Untitled seed', raw_thought: box.trim(), origin: 'hers',
      raw_material: box.trim()
        ? [{ at: new Date().toISOString(), source: 'written by hand', text: box.trim() }]
        : [],
    }, new Date().toISOString()), '');
    setBox('');
    setOpenSeed(id);
  }

  function pickUp(p: StoredProposal) {
    try {
      const now = new Date().toISOString();
      const capture = p.capture_id
        ? { at: now, source: `capture ${p.capture_id}`, text: p.proposal.raw_thought ?? '' }
        : undefined;
      const result = pickUpProposal(body!, {
        proposal_id: p.id, new_seed_id: uid('seed'), now,
        capture: capture?.text ? capture : undefined,
      });
      save(result.body, result.conflicts.length
        ? `Kept your own wording on ${result.conflicts.map(c => c.field).join(', ')}. The engine's version is on the proposal if you want it.`
        : '');
      setOpenSeed(result.seed_id);
    } catch (e) {
      setNote(e instanceof ProposalRefused ? e.message : 'That could not be picked up.');
    }
  }

  function dismiss(p: StoredProposal) {
    const reason = window.prompt('Why not? (optional — it stays on the record)') ?? '';
    try {
      let next = dismissProposal(body!, p.id, new Date().toISOString(), reason || undefined);
      if (reason.trim()) {
        next = dismissalFeedback(next, { id: uid('fb'), proposal_id: p.id, reason: reason.trim() },
          new Date().toISOString());
      }
      save(next, '');
    } catch (e) {
      setNote(e instanceof ProposalRefused ? e.message : 'That could not be dismissed.');
    }
  }

  function markBelowBar(p: StoredProposal) {
    const reason = window.prompt('What was wrong with it?') ?? '';
    if (!reason.trim()) return;
    save(belowTheBar(body!, {
      id: uid('fb'), run_id: p.run_id, context_version: body!.context_version ?? 0,
      reason: reason.trim(), target_id: p.id,
    }, new Date().toISOString()), 'Noted. That goes on the record against this run.');
  }

  // ── The seed sheet, full screen ───────────────────────────────────────────
  if (openSeed) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto">
        <button onClick={() => setOpenSeed(null)}
          className="flex items-center gap-1.5 text-sm text-stone-500 mb-4">
          <ArrowLeft size={15} /> Back to the room
        </button>
        <SeedSheet
          clientId={clientId} seedId={openSeed} body={body}
          onBody={(next, message) => save(next, message ?? '')}
          onTalkMore={id => { setOpenSeed(null); setTalkingAbout(id); }}
          // Spec 24 §3.2: this is the door the costume surface sits behind.
          onMakePiece={id => router.push(`/client/${clientId}/engine/costume/${id}`)}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      {note && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">{note}</div>
      )}

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        {/* Left: the open box */}
        <div>
          <h2 className="text-lg font-semibold text-stone-900">What are we talking about today?</h2>
          <textarea
            value={talkingAbout ? '' : box}
            onChange={e => setBox(e.target.value)}
            disabled={!!talkingAbout || readOnly}
            rows={12}
            className="mt-3 w-full text-sm border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:border-stone-400 disabled:bg-stone-50"
          />
          <p className="text-xs text-stone-500 mt-2">
            Paste anything. Transcripts, client messages, your own rambling. Length is welcome.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={() => findTheSeeds(box)}
              disabled={!box.trim() || working || !availability.available || readOnly}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg bg-stone-900 disabled:opacity-40">
              <Sparkles size={15} /> {working ? 'Reading it.' : 'Find the seeds in this'}
            </button>
            <button onClick={writeOneMyself} disabled={readOnly}
              className="flex items-center gap-1.5 text-sm text-stone-600 underline disabled:opacity-40">
              <PenLine size={14} /> Write a seed myself
            </button>
          </div>
          {!availability.available && (
            <p className="text-xs text-stone-500 mt-2">{availability.reason}</p>
          )}
          {readOnly && (
            <p className="text-xs text-stone-500 mt-2">
              This profile is not running, so nothing new is written here. Everything still reads.
            </p>
          )}
          {working && <p className="text-xs text-stone-500 mt-2">Reading it. This usually takes under a minute.</p>}

          {talkingAbout && (
            <TalkMore
              seedName={all.find(s => s.seed.id === talkingAbout)?.seed.name ?? talkingAbout}
              working={working}
              disabled={!availability.available || readOnly}
              onCancel={() => setTalkingAbout(null)}
              onSend={text => findTheSeeds(text, talkingAbout)}
            />
          )}

          {/* Proposals: a distinct block above the bank, never inline among her
              seeds, and untouchable until she picks one up (§8.2). */}
          {proposals.length > 0 && (
            <div className="mt-8 space-y-3">
              <h3 className="text-sm font-semibold text-stone-900">The engine proposed these</h3>
              {proposals.map(p => (
                <ProposalCard key={p.id} p={p}
                  onPickUp={() => pickUp(p)} onDismiss={() => dismiss(p)}
                  onBelowBar={() => markBelowBar(p)} />
              ))}
            </div>
          )}
        </div>

        {/* Right: the seed bank shelf */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Search size={15} className="text-stone-400" />
            <input
              value={filter.search ?? ''}
              onChange={e => setFilter({ ...filter, search: e.target.value || undefined })}
              placeholder="Search what you actually said"
              className="flex-1 text-sm border border-stone-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-stone-400"
            />
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3">
            <Chip on={!filter.status} onClick={() => setFilter({ ...filter, status: undefined })}>All</Chip>
            {(Object.keys(STATUS_LABEL) as SeedStatus[]).map(s => (
              <Chip key={s} on={filter.status === s} onClick={() => setFilter({ ...filter, status: s })}>
                {STATUS_LABEL[s]}
              </Chip>
            ))}
            <Chip on={filter.pieces === 'none'}
              onClick={() => setFilter({ ...filter, pieces: filter.pieces === 'none' ? undefined : 'none' })}>
              Nothing made yet
            </Chip>
            <Chip on={filter.origin === 'engine:content'}
              onClick={() => setFilter({ ...filter, origin: filter.origin ? undefined : 'engine:content' })}>
              Engine proposed
            </Chip>
            {pillars.map(p => (
              <Chip key={p.id} on={filter.pillar === p.id}
                onClick={() => setFilter({ ...filter, pillar: filter.pillar === p.id ? undefined : p.id })}>
                {p.name}
              </Chip>
            ))}
          </div>

          {all.length === 0 ? (
            <p className="text-sm text-stone-400">Nothing here yet. Talk something out when you&apos;re ready.</p>
          ) : (
            <ul className="space-y-2">
              {shown.map(({ seed, entry }) => {
                const counts = pieceCounts(body, seed.id);
                return (
                  <li key={seed.id}>
                    <button onClick={() => setOpenSeed(seed.id)}
                      className="w-full text-left bg-white border border-stone-200 rounded-xl px-4 py-3 hover:border-stone-300">
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${STATUS_DOT[seed.status]}`} />
                        <span className="text-sm font-medium text-stone-900 truncate">{seed.name}</span>
                      </span>
                      {isCaptureInputShell(seed) && (
                        <span className="block mt-1 text-xs text-amber-700">Not a seed yet — talk it out.</span>
                      )}
                      <span className="block text-xs text-stone-400 mt-1">
                        {counts.total} {counts.total === 1 ? 'piece' : 'pieces'}
                        {counts.posted > 0 && ` · ${counts.posted} posted`}
                        {seed.origin && seed.origin !== 'hers' && ' · engine proposed'}
                      </span>
                      {(seed.possible_pillars ?? []).length > 0 && (
                        <span className="flex flex-wrap gap-1 mt-1.5">
                          {(seed.possible_pillars ?? []).map(pid => (
                            <span key={pid} className="text-[10px] px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-600">
                              {pillars.find(p => p.id === pid)?.name ?? pid}
                            </span>
                          ))}
                        </span>
                      )}
                      <span className="sr-only">{entry.updated_at}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {spend.runs > 0 && (
            <p className="text-xs text-stone-400 mt-4">
              {spend.runs} {spend.runs === 1 ? 'run' : 'runs'} so far, about ${spend.usd.toFixed(2)}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs border ${
        on ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-600'
      }`}>
      {children}
    </button>
  );
}

function TalkMore({ seedName, working, disabled, onCancel, onSend }: {
  seedName: string; working: boolean; disabled: boolean;
  onCancel: () => void; onSend: (text: string) => void;
}) {
  const [text, setText] = useState('');
  return (
    <div className="mt-6 bg-white border border-stone-200 rounded-xl p-4">
      <p className="text-sm font-semibold text-stone-900">Talk more about {seedName}</p>
      <p className="text-xs text-stone-500 mt-1">
        What you said before stays exactly as it is. This adds to it.
      </p>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={6}
        className="mt-2 w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-stone-400" />
      <div className="mt-2 flex gap-2">
        <button onClick={() => onSend(text)} disabled={!text.trim() || working || disabled}
          className="px-3.5 py-2 text-sm font-medium text-white rounded-lg bg-stone-900 disabled:opacity-40">
          {working ? 'Reading it.' : 'Read this too'}
        </button>
        <button onClick={onCancel} className="px-3 py-2 text-sm text-stone-600">Cancel</button>
      </div>
    </div>
  );
}

function ProposalCard({ p, onPickUp, onDismiss, onBelowBar }: {
  p: StoredProposal; onPickUp: () => void; onDismiss: () => void; onBelowBar: () => void;
}) {
  return (
    <div className="bg-white border border-violet-200 rounded-xl p-4">
      <p className="text-[10px] uppercase tracking-wide text-violet-700">
        Engine proposed · {p.at.slice(0, 10)} · {p.model}
      </p>
      <p className="text-sm font-semibold text-stone-900 mt-1">{p.proposal.name}</p>
      <p className="text-sm text-stone-600 mt-1">{p.proposal.why}</p>
      {p.proposal.confidence === 'thin' && (
        <p className="text-xs text-amber-700 mt-1">
          Thin — you did not really say this. Worth talking out more.
        </p>
      )}
      {p.badges.length > 0 && (
        <ul className="mt-2 space-y-1">
          {p.badges.map((b, i) => (
            <li key={i} className="text-xs text-amber-800 bg-amber-50 rounded-lg px-2 py-1">
              {b.label}{b.detail ? ` — ${b.detail}` : ''}
            </li>
          ))}
        </ul>
      )}
      {p.proposal.raw_thought && (
        <p className="mt-2 text-xs text-stone-500 border-l-2 border-stone-200 pl-2 whitespace-pre-wrap">
          {p.proposal.raw_thought}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={onPickUp}
          className="px-3 py-1.5 text-sm font-medium text-white rounded-lg bg-stone-900">Pick this up</button>
        <button onClick={onDismiss}
          className="px-3 py-1.5 text-sm rounded-lg border border-stone-300 text-stone-700">Not this one</button>
        <button onClick={onBelowBar}
          className="px-3 py-1.5 text-sm text-stone-500 underline">Below the bar</button>
      </div>
    </div>
  );
}
