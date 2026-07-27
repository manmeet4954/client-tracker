'use client';

import { useMemo, useState } from 'react';
import { Paperclip, PenLine, Send, Sparkles } from 'lucide-react';
import type { ProfileBody } from '@/lib/tree/body';
import { readPath } from '@/lib/tree/body';
import type { MaterialRef } from '@/lib/tree/objects';
import { findPiece } from '@/lib/engine/resolve';
import {
  briefBatchEstimate, briefSubject, emptyBriefDraft, herEdit, readBriefs, resolveBrief,
  writeBrief, BRIEF_PROSE_FIELDS, type BriefDraft, type StoredBrief,
} from '@/lib/engine/brief';
import { describeMergedRule } from '@/lib/engine/formats';
import { attachMaterial, detachMaterial, materialsOf, MaterialRefused } from '@/lib/engine/materials';
import { exportHandoff, handoffChain, importReturn, HandoffRefused } from '@/lib/engine/handoff';
import { writeRun, type EngineRun } from '@/lib/engine/runs';
import { belowTheBar } from '@/lib/engine/feedback';
import { proofOptions } from '@/lib/engine/costume';

/**
 * A piece at `build` — spec 24 §8.1. It holds its resolved costume and its birth
 * snapshot (neither of which will ever be rewritten), its brief at some version,
 * and its materials, attached by reference. Zero copy: copy is spec 25's.
 */

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const FIELD_LABEL: Record<string, string> = {
  one_point: 'The one point',
  tension: 'The tension',
  realization: 'The realization',
  takeaway: 'The takeaway',
  product_role: 'Where the product fits',
  tone: 'Tone',
  ending: 'How it ends',
};

export default function PieceBuildPanel({ clientId, pieceId, body, onBody }: {
  clientId: string;
  pieceId: string;
  body: ProfileBody;
  onBody: (next: ProfileBody, note?: string) => void;
}) {
  const [working, setWorking] = useState(false);
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState<BriefDraft | null>(null);
  const [tool, setTool] = useState('');
  const [deliverable, setDeliverable] = useState('');

  const record = findPiece(body, pieceId);
  const brief = useMemo(() => resolveBrief(body, pieceId), [body, pieceId]);
  const versions = useMemo(() => readBriefs(body, pieceId), [body, pieceId]);
  const handoffs = useMemo(() => handoffChain(body, pieceId), [body, pieceId]);
  const proof = useMemo(() => proofOptions(body), [body]);

  if (!record) return <p className="text-sm text-stone-500">That piece is not here.</p>;
  const piece = record.piece;

  const subject = (() => {
    try {
      return briefSubject(body, pieceId);
    } catch {
      return null;
    }
  })();

  const attached = materialsOf(body, pieceId);

  const assets = readPath(body, 'work-log/assets/sets').filter(e => e.state === 'active');
  const references = (() => {
    try {
      return readPath(body, 'work-log/references').filter(e => e.state === 'active');
    } catch {
      return [];
    }
  })();

  // ── The brief ─────────────────────────────────────────────────────────────
  async function writeTheBrief() {
    if (working) return;
    setWorking(true);
    setNote('');
    try {
      const res = await fetch('/api/engine/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, pieceId, runId: uid('run'), packetId: uid('pkt') }),
      });
      const out = await res.json();
      if (!res.ok) {
        setNote(out.detail ?? 'The engine could not write it just now. Your costume is still here.');
        setWorking(false);
        return;
      }

      let next = body;
      if (out.brief && subject) {
        const previous = resolveBrief(body, pieceId);
        next = writeBrief(next, {
          piece_id: pieceId, draft: out.brief, origin: 'engine',
          now: new Date().toISOString(), by: 'engine:content', rule: subject.rule,
          badges: out.badges, run_id: out.run?.id, packet_id: out.run?.packet?.packet_id,
          context_version: out.run?.packet?.context_version,
          field_sources: previous?.field_sources,
        });
      }
      next = writeRun(next, out.run as EngineRun);
      onBody(next, out.message ?? '');
    } catch {
      setNote('That did not go through. Your costume is saved, and you can try again.');
    } finally {
      setWorking(false);
    }
  }

  function startMyOwn() {
    const previous = resolveBrief(body, pieceId);
    setEditing(previous
      ? herEdit(previous, {}).draft
      : emptyBriefDraft((piece.costume ?? {}) as never));
  }

  function saveMine() {
    if (!editing || !subject) return;
    const previous = resolveBrief(body, pieceId);
    const edit = previous ? herEdit(previous, editing) : null;
    onBody(writeBrief(body, {
      piece_id: pieceId,
      draft: edit ? edit.draft : editing,
      origin: 'hers',
      now: new Date().toISOString(), by: 'owner', rule: subject.rule,
      field_sources: edit ? edit.field_sources : undefined,
    }), 'Saved as the next version. The one before it is still readable.');
    setEditing(null);
  }

  function markBelowBar() {
    if (!brief?.run_id) return;
    const reason = window.prompt('What was wrong with it?') ?? '';
    if (!reason.trim()) return;
    onBody(belowTheBar(body, {
      id: uid('fb'), run_id: brief.run_id, context_version: brief.context_version ?? 0,
      reason: reason.trim(), target_id: pieceId,
    }, new Date().toISOString()), 'Noted. That goes on the record against this run.');
  }

  // ── Materials ─────────────────────────────────────────────────────────────
  function attach(kind: MaterialRef['kind'], id: string) {
    try {
      const result = attachMaterial(body, {
        piece_id: pieceId, kind, id, now: new Date().toISOString(), by: 'owner',
      });
      onBody(result.body, result.message);
    } catch (e) {
      setNote(e instanceof MaterialRefused ? e.message : 'That could not be attached.');
    }
  }

  function detach(m: MaterialRef) {
    onBody(detachMaterial(body, {
      piece_id: pieceId, kind: m.kind, id: m.id, now: new Date().toISOString(), by: 'owner',
    }), 'Removed from this piece. Nothing at the source changed.');
  }

  // ── The handoff ───────────────────────────────────────────────────────────
  function sendOut() {
    try {
      const open = handoffs.find(h => h.import_status === 'pending');
      const result = exportHandoff(body, {
        id: uid('handoff'), piece_id: pieceId,
        destination_tool: tool, expected_deliverable: deliverable,
        now: new Date().toISOString(),
        ...(open ? { supersedes: open.id } : {}),
      });
      onBody(result.body, 'Exported. Paste this into the tool.');
      setTool('');
      setDeliverable('');
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        void navigator.clipboard.writeText(result.payload);
      }
    } catch (e) {
      setNote(e instanceof HandoffRefused ? e.message : 'That could not be exported.');
    }
  }

  function bringBack(handoffId: string) {
    const url = window.prompt('Where is the finished file?') ?? '';
    if (!url.trim()) return;
    try {
      const result = importReturn(body, {
        handoff_id: handoffId,
        asset: { id: uid('asset'), url: url.trim(), version: 1, name: `${piece.title} back` },
        now: new Date().toISOString(), by: 'owner',
      });
      onBody(result.body, result.message || 'It came back and it is attached to this same piece.');
    } catch (e) {
      setNote(e instanceof HandoffRefused ? e.message : 'That could not be brought back.');
    }
  }

  return (
    <div className="space-y-4">
      {note && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">{note}</div>
      )}

      <div className="bg-white border border-stone-200 rounded-xl p-4">
        <h2 className="text-base font-semibold text-stone-900">{piece.title}</h2>
        <p className="text-xs text-stone-500 mt-1">
          {[piece.costume.platform, piece.costume.format, piece.costume.length,
            piece.costume.objective, piece.costume.angle, piece.costume.hook_type]
            .filter(Boolean).join(' · ')}
        </p>
        <p className="text-xs text-stone-400 mt-1">
          At build. Born {piece.birth?.at?.slice(0, 10) ?? 'before the engine'}
          {piece.birth?.taken_late ? ', recorded late' : ''}
          {piece.birth?.rule_overrides?.length ? ', with a rule passed on purpose' : ''}.
        </p>
        {subject && (
          <details className="mt-3">
            <summary className="text-xs text-stone-500 cursor-pointer">The format rule it is written to</summary>
            <ul className="mt-1 space-y-0.5">
              {describeMergedRule(subject.rule).map((l, i) => (
                <li key={i} className="text-xs text-stone-600">{l}</li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {/* The brief */}
      <div className="bg-white border border-stone-200 rounded-xl p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-stone-900">
            The brief{brief ? ` (version ${brief.brief_version})` : ''}
          </p>
          {versions.length > 1 && (
            <span className="text-xs text-stone-400">{versions.length} versions kept</span>
          )}
        </div>

        {!brief && !editing && (
          <p className="text-sm text-stone-500 mt-1">
            Nothing yet. The brief comes before any copy, and it is the thing you can argue with.
          </p>
        )}

        {brief && !editing && (
          <>
            <dl className="mt-3 space-y-2">
              {BRIEF_PROSE_FIELDS.map(f => (
                <div key={f}>
                  <dt className="text-xs text-stone-400 flex items-center gap-2">
                    {FIELD_LABEL[f as string]}
                    {brief.field_sources?.[f as string] === 'engine' && (
                      <span className="px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700 text-[10px]">
                        engine wrote this
                      </span>
                    )}
                  </dt>
                  <dd className="text-sm text-stone-800">
                    {String((brief as unknown as Record<string, unknown>)[f as string] ?? 'none')}
                  </dd>
                </div>
              ))}
              {brief.leave_out.length > 0 && (
                <div>
                  <dt className="text-xs text-stone-400">Leave out</dt>
                  <dd className="text-sm text-stone-800">
                    <ul className="list-disc pl-4">
                      {brief.leave_out.map((l, i) => <li key={i}>{l}</li>)}
                    </ul>
                  </dd>
                </div>
              )}
            </dl>
            {(brief.badges ?? []).map((b, i) => (
              <p key={i} className="mt-2 text-xs bg-amber-50 text-amber-900 rounded-lg px-3 py-2">
                {b.label}. {b.detail}
              </p>
            ))}
          </>
        )}

        {editing && (
          <div className="mt-3 space-y-2">
            {BRIEF_PROSE_FIELDS.map(f => (
              <label key={f} className="block">
                <span className="text-xs text-stone-500">{FIELD_LABEL[f as string]}</span>
                <textarea
                  value={String((editing as unknown as Record<string, unknown>)[f as string] ?? '')}
                  onChange={e => setEditing({ ...editing, [f]: e.target.value } as BriefDraft)}
                  rows={2}
                  className="mt-1 w-full text-sm border border-stone-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-stone-400" />
              </label>
            ))}
            <div className="flex gap-2">
              <button onClick={saveMine}
                className="px-3 py-1.5 text-sm rounded-lg bg-stone-900 text-white">Save it</button>
              <button onClick={() => setEditing(null)}
                className="px-3 py-1.5 text-sm rounded-lg border border-stone-300 text-stone-700">Cancel</button>
            </div>
          </div>
        )}

        {!editing && (
          <div className="mt-3 flex flex-wrap gap-2 items-center">
            <button onClick={writeTheBrief} disabled={working || !subject}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-stone-900 text-white disabled:opacity-40">
              <Sparkles size={14} /> {working ? 'Writing it.' : brief ? 'Write it again' : 'Write the brief'}
            </button>
            <button onClick={startMyOwn}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-stone-300 text-stone-700">
              <PenLine size={14} /> Write it myself
            </button>
            {brief?.run_id && (
              <button onClick={markBelowBar} className="text-xs text-stone-400 hover:text-stone-700">
                Below the bar
              </button>
            )}
            <span className="text-xs text-stone-400">{briefBatchEstimate(1).words}</span>
          </div>
        )}
      </div>

      {/* Materials */}
      <div className="bg-white border border-stone-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-stone-900">Materials</p>
        <p className="text-xs text-stone-400 mt-0.5">
          Attached by reference. Removing one here changes nothing where it lives.
        </p>

        {attached.materials.length > 0 && (
          <ul className="mt-2 space-y-1">
            {attached.materials.map(m => (
              <li key={`${m.kind}-${m.id}`} className="text-sm text-stone-700 flex items-start gap-2">
                <span className="flex-1">
                  {m.kind} · {m.id}
                  {m.rights_state === 'blocked' && (
                    <span className="block text-xs text-amber-800">{m.rights_note}</span>
                  )}
                </span>
                <button onClick={() => detach(m)} className="text-xs text-stone-400 hover:text-stone-700">remove</button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 space-y-2">
          <AttachRow label="Assets" items={assets.map(a => ({ id: a.id, label: String((a.data as { name?: string }).name ?? a.id) }))}
            onPick={id => attach('asset', id)} />
          <AttachRow label="References" items={references.map(r => ({ id: r.id, label: String((r.data as { title?: string }).title ?? r.id) }))}
            onPick={id => attach('reference', id)} />
          <AttachRow label="Proof" items={proof.map(p => ({ id: p.id, label: p.label }))}
            onPick={id => attach('proof', id)} />
        </div>

        {attached.blocked.length > 0 && (
          <p className="mt-3 text-xs bg-amber-50 text-amber-900 rounded-lg px-3 py-2">
            This piece carries a rights block. You can keep building. Publishing is what waits.
          </p>
        )}
      </div>

      {/* The handoff */}
      <div className="bg-white border border-stone-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-stone-900">Send it out</p>
        <p className="text-xs text-stone-400 mt-0.5">
          The brief leaves, the finished file comes back onto this same piece. No second entry, ever.
        </p>

        {handoffs.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {handoffs.map(h => (
              <li key={h.id} className="text-sm text-stone-700">
                {h.destination_tool} · brief v{h.brief_version} · {h.import_status}
                {h.supersedes && <span className="text-xs text-stone-400"> (replaces {h.supersedes})</span>}
                {h.import_status === 'pending' && (
                  <button onClick={() => bringBack(h.id)}
                    className="ml-2 text-xs text-stone-500 underline">it came back</button>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 space-y-2">
          <input value={tool} onChange={e => setTool(e.target.value)} placeholder="Which tool"
            className="w-full text-sm border border-stone-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-stone-400" />
          <input value={deliverable} onChange={e => setDeliverable(e.target.value)}
            placeholder="What should come back, in your words"
            className="w-full text-sm border border-stone-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-stone-400" />
          <button onClick={sendOut} disabled={!tool.trim() || !deliverable.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-stone-300 text-stone-700 disabled:opacity-40">
            <Send size={14} /> Export the brief
          </button>
          {!brief && (
            <p className="text-xs text-stone-500">
              It needs a brief first. A design tool cannot be handed a piece with no point.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function AttachRow({ label, items, onPick }: {
  label: string; items: { id: string; label: string }[]; onPick: (id: string) => void;
}) {
  const [value, setValue] = useState('');
  if (!items.length) return null;
  return (
    <div className="flex items-center gap-2">
      <Paperclip size={14} className="text-stone-300" />
      <select value={value} onChange={e => { setValue(''); if (e.target.value) onPick(e.target.value); }}
        className="flex-1 text-sm border border-stone-200 rounded-lg px-2 py-1.5 focus:outline-none">
        <option value="">Attach {label.toLowerCase()}</option>
        {items.map(i => <option key={i.id} value={i.id}>{i.label}</option>)}
      </select>
    </div>
  );
}
