'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Quote, Sparkles } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import type { ProfileBody } from '@/lib/tree/body';
import type { ResolvedCostume } from '@/lib/tree/objects';
import { findSeed } from '@/lib/engine/seeds';
import {
  DIMENSIONS, UNIVERSAL_LISTS, ctaOptions, enumerateVariants, formatOptions,
  formatSelectionKey, lengthOptions, mixLine, pillarOptions, platformOptions,
  proofGaps, proofOptions, seedSuggestions, voiceOptions,
  type CostumeDimension, type Option, type Selection, type VariantRow,
} from '@/lib/engine/costume';
import { resolveFormatRule } from '@/lib/engine/formats';
import { offerComparison, resolveVariants, writeComparison, CostumeRefused } from '@/lib/engine/resolve';
import { switchConfigFromBody, strategyLocked, readGateSet } from '@/lib/strategy/derivation';
import { effectiveState } from '@/lib/tree/switches';
import ProfileBodyGate from './ProfileBodyGate';
import PieceBuildPanel from './PieceBuildPanel';

/**
 * The costume surface — spec 24 §3.
 *
 * PLAN §3.10, on record and binding: "the engine is not a form that pushes you
 * to the next step. It is a separate, powerful space to brainstorm in — you sit
 * with the topic, you see the pillars fitted inside the platforms, the formats,
 * and you SELECT; only then does the entry go into build state."
 *
 * So: no wizard, no step counter, no next chain, and no required field until the
 * resolve step. She can open this, move eight pickers, look at the grid, and
 * leave without writing a thing.
 */

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export default function CostumeView({ clientId, seedId }: { clientId: string; seedId: string }) {
  const router = useRouter();
  const { role, dispatch } = useApp();
  const { client, data } = useClient(clientId);

  const [selection, setSelection] = useState<Selection>({});
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [batch, setBatch] = useState<{ ids: string[]; batch_id: string } | null>(null);
  const [openPiece, setOpenPiece] = useState<string | null>(null);
  const [hypothesis, setHypothesis] = useState('');

  const body = data.body;

  const save = (next: ProfileBody, message = '') => {
    dispatch({ type: 'SET_BODY', payload: { clientId, body: next } });
    setNote(message);
  };

  const config = useMemo(() => (body ? switchConfigFromBody(body) : {}), [body]);
  const record = useMemo(() => (body ? findSeed(body, seedId) : null), [body, seedId]);

  const rows = useMemo(
    () => (body ? enumerateVariants(body, config, selection) : []),
    [body, config, selection],
  );

  if (role !== 'owner') return <p className="p-8 text-sm text-stone-400">This screen is hers.</p>;
  if (!body) return <ProfileBodyGate clientId={clientId} />;

  const lifecycle = client?.lifecycle ?? 'active';
  const readOnly = lifecycle === 'paused' || lifecycle === 'closing' || lifecycle === 'archived';
  const surfaceOpen = effectiveState('creation.costume', config) !== 'hidden';
  const locked = strategyLocked(body);

  if (!surfaceOpen) {
    return (
      <Shell onBack={() => router.push(`/client/${clientId}/engine`)}>
        <p className="text-sm text-stone-500">
          The costume surface is switched off for this profile. Everything already made is still here.
        </p>
      </Shell>
    );
  }

  if (!locked) {
    return (
      <Shell onBack={() => router.push(`/client/${clientId}/engine`)}>
        <p className="text-sm text-stone-700">
          Strategy is still pending on this profile, so the costume surface is not open yet.
        </p>
        <p className="text-sm text-stone-500 mt-2">
          Recording work on the board still saves. This screen needs the strategy first, because the
          birth record it writes has to name a real gate version and a real strategy version.
        </p>
      </Shell>
    );
  }

  if (!record) {
    return (
      <Shell onBack={() => router.push(`/client/${clientId}/engine`)}>
        <p className="text-sm text-stone-500">That seed is not in the bank.</p>
      </Shell>
    );
  }

  const seed = record.seed;
  if (seed.status !== 'locked') {
    return (
      <Shell onBack={() => router.push(`/client/${clientId}/engine`)}>
        <p className="text-sm text-stone-700">
          Only a locked seed can make pieces. This one is at {seed.status}.
        </p>
      </Shell>
    );
  }

  // ── The pickers, each reading from where §3.3 says it reads ───────────────
  const pillars = pillarOptions(body, config);
  const platforms = platformOptions(body, config);
  const ctas = ctaOptions(body, config);
  const voices = voiceOptions(body, config);
  const proof = proofOptions(body, config);
  const suggestions = seedSuggestions(seed);
  const gaps = proofGaps(body, seed);
  const month = new Date().toISOString().slice(0, 7);

  const selected = (d: CostumeDimension) => selection[d] ?? [];
  const toggle = (d: CostumeDimension, value: string) => {
    const now = selected(d);
    const next = now.includes(value) ? now.filter(v => v !== value) : [...now, value];
    // Turning a platform off takes its formats with it: a format has no
    // existence outside its platform, and the picker makes that structural.
    if (d === 'platform' && !next.includes(value)) {
      setSelection(s => ({
        ...s, platform: next,
        format: (s.format ?? []).filter(f => !f.startsWith(`${value}::`)),
      }));
      return;
    }
    setSelection(s => ({ ...s, [d]: next }));
  };

  const addFreeText = (d: CostumeDimension, value: string) => {
    const v = value.trim();
    if (!v || selected(d).includes(v)) return;
    setSelection(s => ({ ...s, [d]: [...selected(d), v] }));
  };

  // Length options come from the resolved format rule, not from a universal list.
  const lengthBands = [...new Set(
    (selection.format ?? []).flatMap(key => {
      const [platform, format] = key.split('::');
      return lengthOptions(resolveFormatRule(body, platform, format));
    }),
  )];

  const kept = rows.filter(r => !unchecked.has(r.key));
  const ready = kept.filter(r => r.missing.length === 0);
  const blocked = kept.filter(r => r.missing.length > 0);

  // ── Send to build ─────────────────────────────────────────────────────────
  function sendToBuild() {
    if (readOnly || !ready.length) return;
    const batch_id = uid('batch');
    try {
      const result = resolveVariants({
        body: body!,
        seed_id: seedId,
        batch_id,
        rows: ready.map((row, i) => ({
          row,
          piece_id: uid(`piece-${i}`),
          title: [seed.name, row.costume.format, row.costume.angle].filter(Boolean).join(', '),
          override_reason: overrides[row.key],
        })),
        now: new Date().toISOString(),
        by: 'owner',
      });
      save(result.body, `${result.piece_ids.length} in build state.`);
      setBatch({ ids: result.piece_ids, batch_id });
    } catch (e) {
      setNote(e instanceof CostumeRefused ? e.message : 'That could not be sent to build.');
    }
  }

  // ── §5.6 The matched comparison offer ─────────────────────────────────────
  const compareActive = effectiveState('analysis.compare', config) === 'active';
  const offer = batch
    ? offerComparison({
      piece_ids: batch.ids,
      costumes: batch.ids
        .map(id => (body!.paths['work-log/creation'] ?? []).find(e => e.id === id))
        .map(e => ((e?.data as { costume?: Partial<ResolvedCostume> })?.costume ?? {})),
      compareActive,
    })
    : null;

  function recordComparison() {
    if (!offer?.offered) return;
    try {
      save(writeComparison(body!, {
        id: uid('cmp'), hypothesis, offer, now: new Date().toISOString(),
      }), 'Recorded. The verdict comes later, from the data.');
      setHypothesis('');
    } catch (e) {
      setNote(e instanceof CostumeRefused ? e.message : 'That could not be recorded.');
    }
  }

  if (openPiece) {
    return (
      <Shell onBack={() => setOpenPiece(null)} backLabel="Back to the batch">
        <PieceBuildPanel
          clientId={clientId} pieceId={openPiece} body={body}
          onBody={(next, message) => save(next, message ?? '')}
        />
      </Shell>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <button onClick={() => router.push(`/client/${clientId}/engine`)}
        className="flex items-center gap-1.5 text-sm text-stone-500 mb-4">
        <ArrowLeft size={15} /> Back to the room
      </button>

      {note && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">{note}</div>
      )}

      <div className="grid lg:grid-cols-[280px_1fr_360px] gap-6">
        {/* The seed, read-only. The understanding is already done. */}
        <aside className="bg-white border border-stone-200 rounded-xl p-4 h-fit">
          <p className="text-xs font-medium text-stone-500">The seed</p>
          <h2 className="text-base font-semibold text-stone-900 mt-1">{seed.name}</h2>
          <p className="mt-3 text-sm text-stone-700 flex gap-2">
            <Quote size={14} className="text-stone-300 shrink-0 mt-1" />
            <span className="whitespace-pre-wrap">{seed.raw_thought}</span>
          </p>
          {seed.core_message && (
            <p className="mt-3 text-sm text-stone-600"><span className="text-stone-400">Says: </span>{seed.core_message}</p>
          )}
          {seed.reframe && (
            <p className="mt-2 text-sm text-stone-600"><span className="text-stone-400">Instead: </span>{seed.reframe}</p>
          )}
          {gaps.some(g => !g.found) && (
            <p className="mt-3 text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
              This seed asks for proof the library does not hold yet:{' '}
              {gaps.filter(g => !g.found).map(g => g.required).join(', ')}. You can carry on.
            </p>
          )}
        </aside>

        {/* The dimensions */}
        <div className="space-y-4">
          {DIMENSIONS.map(d => {
            if (d.id === 'format') {
              return (
                <Picker key={d.id} label="Format" hint={platforms.length && selected('platform').length
                  ? undefined
                  : 'Pick a platform first. Formats live inside platforms.'}>
                  {selected('platform').length === 0
                    ? null
                    : selected('platform').map(p => (
                      <div key={p} className="w-full">
                        <p className="text-xs text-stone-400 mb-1">{p}</p>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {formatOptions(body!, config, p).map(f => (
                            <Chip key={f.id}
                              on={selected('format').includes(formatSelectionKey(p, f.id))}
                              onClick={() => toggle('format', formatSelectionKey(p, f.id))}>
                              {f.label}
                            </Chip>
                          ))}
                          {formatOptions(body!, config, p).length === 0 && (
                            <span className="text-xs text-stone-400">No formats recorded for {p} yet.</span>
                          )}
                        </div>
                      </div>
                    ))}
                </Picker>
              );
            }

            if (d.id === 'length') {
              return (
                <Picker key={d.id} label="Length" hint={lengthBands.length ? d.hint : 'Pick a format first. Length comes from its rule.'}>
                  {lengthBands.map(band => (
                    <Chip key={band} on={selected('length').includes(band)} onClick={() => toggle('length', band)}>
                      {band}
                    </Chip>
                  ))}
                  <FreeText onAdd={v => addFreeText('length', v)} />
                </Picker>
              );
            }

            const list = UNIVERSAL_LISTS[d.id];
            const options: Option[] = list
              ? list.map(v => ({ id: v, label: v }))
              : d.id === 'pillar_id' ? pillars
                : d.id === 'platform' ? platforms
                  : d.id === 'cta' ? ctas
                    : d.id === 'voice' ? voices
                      : d.id === 'proof' ? proof
                        : [];

            return (
              <Picker key={d.id} label={d.label} hint={d.hint}>
                {options.map(o => {
                  const suggested = (d.id === 'pillar_id' && suggestions.pillars.includes(o.id))
                    || (d.id === 'angle' && suggestions.angles.includes(o.id));
                  const needed = d.id === 'proof' && gaps.some(g => g.found?.id === o.id);
                  return (
                    <Chip key={o.id} on={selected(d.id).includes(o.id)} onClick={() => toggle(d.id, o.id)}
                      title={d.id === 'pillar_id' ? mixLine(body!, o.id, month) ?? undefined : o.detail}>
                      {o.label}
                      {suggested && <span className="ml-1.5 text-[10px] text-violet-600">this seed suggests</span>}
                      {needed && <span className="ml-1.5 text-[10px] text-emerald-700">this seed needs</span>}
                    </Chip>
                  );
                })}
                {options.length === 0 && !list && (
                  <span className="text-xs text-stone-400">Nothing in this folder yet.</span>
                )}
                {list && <FreeText onAdd={v => addFreeText(d.id, v)} />}
              </Picker>
            );
          })}
        </div>

        {/* The variant grid */}
        <aside className="space-y-3">
          <div className="bg-white border border-stone-200 rounded-xl p-4">
            <p className="text-base font-semibold text-stone-900">
              {ready.length} {ready.length === 1 ? 'piece' : 'pieces'}
            </p>
            <p className="text-xs text-stone-500 mt-0.5">
              Nothing is written until you send them. Cancel costs nothing.
            </p>
          </div>

          {rows.length === 0 && (
            <p className="text-sm text-stone-500 px-1">Pick a few things and the combinations show up here.</p>
          )}

          <ul className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {rows.map(row => (
              <GridRow
                key={row.key} row={row}
                checked={!unchecked.has(row.key)}
                reason={overrides[row.key] ?? ''}
                onToggle={() => setUnchecked(s => {
                  const next = new Set(s);
                  if (next.has(row.key)) next.delete(row.key); else next.add(row.key);
                  return next;
                })}
                onReason={v => setOverrides(o => ({ ...o, [row.key]: v }))}
              />
            ))}
          </ul>

          {blocked.length > 0 && (
            <p className="text-xs text-stone-500 px-1">
              {blocked.length} {blocked.length === 1 ? 'row is' : 'rows are'} still missing something. They stay here until they are dressed.
            </p>
          )}

          <button onClick={sendToBuild} disabled={!ready.length || readOnly}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white rounded-lg bg-stone-900 disabled:opacity-40">
            <Sparkles size={15} /> Send {ready.length || ''} to build
          </button>

          {batch && (
            <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-2">
              <p className="text-sm font-semibold text-stone-900">In build state</p>
              <ul className="space-y-1">
                {batch.ids.map(id => (
                  <li key={id}>
                    <button onClick={() => setOpenPiece(id)}
                      className="text-sm text-stone-700 underline decoration-stone-300 text-left">
                      {(body!.paths['work-log/creation'] ?? []).find(e => e.id === id)
                        ? (((body!.paths['work-log/creation'] ?? []).find(e => e.id === id)!.data as { title?: string }).title ?? id)
                        : id}
                    </button>
                  </li>
                ))}
              </ul>

              {offer && !offer.offered && (
                <p className="text-xs text-stone-500 pt-1">{offer.reason}</p>
              )}
              {offer?.offered && (
                <div className="pt-2 border-t border-stone-100">
                  <p className="text-sm text-stone-800">
                    These change one thing only: {offer.changed_variable}. Want to record it as a comparison?
                  </p>
                  <input value={hypothesis} onChange={e => setHypothesis(e.target.value)}
                    placeholder="What do you think will happen?"
                    className="mt-2 w-full text-sm border border-stone-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-stone-400" />
                  <button onClick={recordComparison} disabled={!hypothesis.trim()}
                    className="mt-2 px-3 py-1.5 text-sm rounded-lg border border-stone-300 text-stone-700 disabled:opacity-40">
                    Record the comparison
                  </button>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      {!readGateSet(body) && (
        <p className="mt-6 text-xs text-stone-400">
          This profile has no locked gate set, so briefs run without knowing what they will be judged by.
        </p>
      )}
    </div>
  );
}

// ── Small pieces ────────────────────────────────────────────────────────────

function Shell({ children, onBack, backLabel = 'Back to the room' }: {
  children: React.ReactNode; onBack: () => void; backLabel?: string;
}) {
  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-stone-500 mb-4">
        <ArrowLeft size={15} /> {backLabel}
      </button>
      {children}
    </div>
  );
}

function Picker({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-3">
      <p className="text-xs font-medium text-stone-500 mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5 items-center">{children}</div>
      {hint && <p className="text-xs text-stone-400 mt-2">{hint}</p>}
    </div>
  );
}

function Chip({ on, onClick, children, title }: {
  on: boolean; onClick: () => void; children: React.ReactNode; title?: string;
}) {
  return (
    <button onClick={onClick} title={title}
      className={`px-2.5 py-1 text-sm rounded-full border ${on
        ? 'bg-stone-900 text-white border-stone-900'
        : 'bg-white text-stone-700 border-stone-200 hover:border-stone-400'}`}>
      {children}
    </button>
  );
}

function FreeText({ onAdd }: { onAdd: (v: string) => void }) {
  const [draft, setDraft] = useState('');
  return (
    <span className="inline-flex items-center gap-1">
      <input value={draft} onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { onAdd(draft); setDraft(''); } }}
        placeholder="or type your own"
        className="text-sm border border-dashed border-stone-300 rounded-full px-2.5 py-1 w-36 focus:outline-none focus:border-stone-400" />
    </span>
  );
}

function GridRow({ row, checked, reason, onToggle, onReason }: {
  row: VariantRow; checked: boolean; reason: string;
  onToggle: () => void; onReason: (v: string) => void;
}) {
  const forbidden = row.forbidden.length > 0;
  return (
    <li className={`border rounded-xl p-3 ${forbidden ? 'border-amber-300 bg-amber-50' : 'border-stone-200 bg-white'}`}>
      <div className="flex items-start gap-2">
        <button onClick={onToggle}
          className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked
            ? 'bg-stone-900 border-stone-900 text-white' : 'border-stone-300'}`}>
          {checked && <Check size={11} />}
        </button>
        <div className="min-w-0">
          <p className="text-sm text-stone-800">{row.words}</p>
          <p className="text-xs text-stone-400 mt-0.5">{row.headline}</p>
          {row.missing.length > 0 && (
            <p className="text-xs text-stone-500 mt-1">Still needs: {row.missing.join(', ')}</p>
          )}
        </div>
      </div>
      {forbidden && (
        <div className="mt-2 pl-6">
          {row.forbidden.map((f, i) => (
            <p key={i} className="text-xs text-amber-900">Your rule says: {f.says}</p>
          ))}
          <input value={reason} onChange={e => onReason(e.target.value)}
            placeholder="Pass it anyway, with a reason"
            className="mt-1.5 w-full text-xs border border-amber-300 rounded-lg px-2 py-1 bg-white focus:outline-none" />
          <p className="text-[11px] text-amber-800 mt-1">
            The reason goes on the record, so analysis can see this one broke its own rule on purpose.
          </p>
        </div>
      )}
    </li>
  );
}
