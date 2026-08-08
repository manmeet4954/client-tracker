'use client';

// Strategy room → Brand kit. Spec 34 §8.
//
// "She says it is fine. The content does not change. The layout gets the same
// treatment as everything else on the screen."
//
// So this is a LAYOUT job and nothing else. It holds the same three things the
// old screen held, colours, type and logo files, reads them from the same
// place, and writes them back through the same action:
//
//   read   data.brandKit          (colors, fonts, logos)
//   write  UPDATE_BRAND_KIT       (the whole kit, unchanged in shape)
//
// Not one field is added, renamed or dropped. A colour saved here is byte for
// byte the colour the old screen saved. Logo files go up the same signed path
// through `/api/upload` that they already did.
//
// What changes is only what she looks at: the room's type, the room's colours,
// the room's spacing, section headers at the same rhythm as Channels and Gates,
// and every count read off the array it describes.

import { useRef, useState } from 'react';
import { Download, Image as ImageIcon, Loader2, Palette, Pencil, Plus, Trash2, Type } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import { generateId } from '@/lib/utils';
import type { BrandColor, BrandFont, BrandKit as BrandKitShape, BrandLogo } from '@/types';
import {
  BRAND_KIT_PURPOSE, brandKitCounts, brandKitEmpty, brandKitSummary,
} from '@/lib/strategy/reading';
import Modal from '@/components/Modal';

const BTN_DARK =
  'inline-flex items-center justify-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40';
const BTN_GHOST =
  'inline-flex items-center justify-center gap-1.5 rounded-xl border border-[rgba(23,21,26,.14)] px-[15px] py-[7px] text-[12.5px] font-semibold text-text disabled:opacity-40';
const FIELD =
  'w-full rounded-xl border border-[rgba(23,21,26,.12)] bg-white px-3 py-2 text-sm text-text placeholder:text-faint focus:border-accent focus:outline-none';
const LABEL = 'mb-1 block text-[11.5px] font-bold uppercase tracking-[.09em] text-muted';
const KICKER = 'text-[11.5px] font-bold uppercase tracking-[.09em] text-faint';

const COLOR_ROLES = ['Primary', 'Secondary', 'Neutral', 'Accent', 'Other'];
const FONT_ROLES = ['Headlines', 'Body Copy', 'Emphasis', 'Accent', 'Other'];

/** Unchanged from the old screen: how a stored font name is drawn. */
function toCssFamily(name: string): string {
  const serif = ['Newsreader', 'Lora', 'Merriweather', 'Playfair Display', 'Georgia'];
  const mono = ['JetBrains Mono', 'Fira Code', 'Source Code Pro', 'Courier'];
  if (serif.some(s => name.includes(s))) return `'${name}', serif`;
  if (mono.some(s => name.includes(s))) return `'${name}', monospace`;
  return `'${name}', sans-serif`;
}

export default function BrandKit({ profileId }: { profileId: string }) {
  const { role, dispatch } = useApp();
  const { data } = useClient(profileId);
  const kit: BrandKitShape = data.brandKit ?? { colors: [], fonts: [] };

  // Owner only, always, in every switch position (spec 34 §2).
  if (role !== 'owner') return <p className="p-8 text-sm text-faint">This screen is hers.</p>;

  function update(patch: Partial<BrandKitShape>) {
    dispatch({ type: 'UPDATE_BRAND_KIT', payload: { clientId: profileId, brandKit: { ...kit, ...patch } } });
  }

  const counts = brandKitCounts(kit);

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-4">
        <h2 className="font-display text-[21px] font-bold tracking-[-.02em] text-text">Brand kit</h2>
        <p className="mt-1.5 text-[13.5px] leading-[1.6] text-muted">{BRAND_KIT_PURPOSE}</p>
      </header>

      <p className={`tnum mb-2.5 ${KICKER}`}>{brandKitSummary(counts)}</p>

      <div className="space-y-2.5">
        <Colors colors={kit.colors} onUpdate={colors => update({ colors })} />
        <Fonts fonts={kit.fonts} onUpdate={fonts => update({ fonts })} />
        <Logos logos={kit.logos ?? []} onUpdate={logos => update({ logos })} />
      </div>
    </div>
  );
}

// ── One section frame, so all three keep the same rhythm ─────────────────────

function Section({ icon, title, count, action, children }: {
  icon: React.ReactNode;
  title: string;
  count: number;
  action: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-hairline bg-white shadow-card">
      <div className="flex items-center gap-2.5 border-b border-divider px-4 py-3.5">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[10px] bg-control">
          {icon}
        </span>
        <h3 className="text-[14.5px] font-semibold text-text">{title}</h3>
        <span className="tnum text-[12.5px] text-faint">{count}</span>
        <span className="ml-auto">{action}</span>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

// ── Colours ──────────────────────────────────────────────────────────────────

function Colors({ colors, onUpdate }: { colors: BrandColor[]; onUpdate: (c: BrandColor[]) => void }) {
  const [editing, setEditing] = useState<BrandColor | 'new' | null>(null);

  function save(c: BrandColor) {
    onUpdate(colors.some(x => x.id === c.id) ? colors.map(x => (x.id === c.id ? c : x)) : [...colors, c]);
    setEditing(null);
  }

  return (
    <Section
      icon={<Palette size={16} strokeWidth={1.9} className="text-muted" />}
      title="Colours"
      count={colors.length}
      action={
        <button type="button" onClick={() => setEditing('new')} className={BTN_GHOST}>
          <Plus size={13} strokeWidth={2.2} /> Add
        </button>
      }
    >
      {colors.length === 0 ? (
        <p className="text-[13.5px] leading-[1.6] text-faint">{brandKitEmpty('colors')}</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {colors.map(c => (
            <div key={c.id} className="group w-[74px]">
              <button
                type="button"
                onClick={() => setEditing(c)}
                style={{ background: c.hex }}
                aria-label={`Edit ${c.name}`}
                className="h-[58px] w-full rounded-[14px] border border-hairline shadow-card"
              />
              <p className="mt-1.5 truncate text-[12.5px] font-semibold text-text">{c.name}</p>
              <p className="tnum text-[11px] uppercase text-faint">{c.hex}</p>
              {c.role && <p className={`mt-0.5 ${KICKER}`}>{c.role}</p>}
              <button
                type="button"
                onClick={() => onUpdate(colors.filter(x => x.id !== c.id))}
                aria-label={`Remove ${c.name}`}
                className="mt-1 text-faint hover:text-accent-text md:opacity-0 md:transition-opacity md:group-hover:opacity-100"
              >
                <Trash2 size={12} strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      )}

      {editing !== null && (
        <ColorModal
          existing={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
    </Section>
  );
}

function ColorModal({ existing, onClose, onSave }: {
  existing: BrandColor | null;
  onClose: () => void;
  onSave: (c: BrandColor) => void;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [hex, setHex] = useState(existing?.hex ?? '#1c1a21');
  const [role, setRole] = useState(existing?.role ?? 'Primary');

  function save() {
    if (!name.trim()) return;
    onSave({ id: existing?.id ?? generateId(), name: name.trim(), hex, role });
  }

  return (
    <Modal open onClose={onClose} title={existing ? 'Change this colour' : 'Add a colour'} size="sm">
      <div className="space-y-4 p-5">
        <div className="flex items-center gap-4">
          <input
            type="color"
            value={hex}
            onChange={e => setHex(e.target.value)}
            aria-label="Pick the colour"
            className="h-16 w-16 flex-none cursor-pointer rounded-[14px] border border-hairline"
          />
          <div className="flex-1 space-y-2">
            <div>
              <label className={LABEL}>What it is called</label>
              <input autoFocus value={name} onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') save(); }}
                placeholder="Brand orange" className={FIELD} />
            </div>
            <div>
              <label className={LABEL}>Hex</label>
              <input value={hex} onChange={e => setHex(e.target.value)} className={`${FIELD} tnum`} />
            </div>
          </div>
        </div>
        <div>
          <label className={LABEL}>Where it is used</label>
          <div className="flex flex-wrap gap-1.5">
            {COLOR_ROLES.map(r => (
              <button key={r} type="button" onClick={() => setRole(r)}
                className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${
                  role === r ? 'bg-ink text-white' : 'bg-chip text-muted'
                }`}>
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={BTN_GHOST}>Cancel</button>
          <button type="button" onClick={save} disabled={!name.trim()} className={BTN_DARK}>
            {existing ? 'Save it' : 'Add it'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Type ─────────────────────────────────────────────────────────────────────

function Fonts({ fonts, onUpdate }: { fonts: BrandFont[]; onUpdate: (f: BrandFont[]) => void }) {
  const [editing, setEditing] = useState<BrandFont | 'new' | null>(null);

  function save(f: BrandFont) {
    onUpdate(fonts.some(x => x.id === f.id) ? fonts.map(x => (x.id === f.id ? f : x)) : [...fonts, f]);
    setEditing(null);
  }

  return (
    <Section
      icon={<Type size={16} strokeWidth={1.9} className="text-muted" />}
      title="Type"
      count={fonts.length}
      action={
        <button type="button" onClick={() => setEditing('new')} className={BTN_GHOST}>
          <Plus size={13} strokeWidth={2.2} /> Add
        </button>
      }
    >
      {fonts.length === 0 ? (
        <p className="text-[13.5px] leading-[1.6] text-faint">{brandKitEmpty('fonts')}</p>
      ) : (
        <div className="space-y-2">
          {fonts.map(f => (
            <div key={f.id} className="group flex items-center gap-3 rounded-[14px] border border-hairline px-3 py-2.5">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px] bg-sunken">
                <span style={{ fontFamily: toCssFamily(f.name), fontWeight: 600, fontSize: 18 }} className="text-text">
                  Aa
                </span>
              </span>
              {/* The role rides in the meta line rather than a pill, because on a
                  phone a pill beside the name is what truncates the name. */}
              <span className="min-w-0 flex-1">
                <span style={{ fontFamily: toCssFamily(f.name) }} className="block truncate text-[14.5px] font-semibold text-text">
                  {f.name}
                </span>
                <span className="block truncate text-[12.5px] text-faint">
                  {f.role}{f.weights ? ` · ${f.weights}` : ''}
                </span>
              </span>
              {/* Always reachable on a phone: there is no hover there. */}
              <span className="flex flex-none items-center gap-1 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
                <button type="button" onClick={() => setEditing(f)} aria-label={`Edit ${f.name}`} className="p-1 text-faint hover:text-text">
                  <Pencil size={13} strokeWidth={2} />
                </button>
                <button type="button" onClick={() => onUpdate(fonts.filter(x => x.id !== f.id))}
                  aria-label={`Remove ${f.name}`} className="p-1 text-faint hover:text-accent-text">
                  <Trash2 size={13} strokeWidth={2} />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {editing !== null && (
        <FontModal
          existing={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
    </Section>
  );
}

function FontModal({ existing, onClose, onSave }: {
  existing: BrandFont | null;
  onClose: () => void;
  onSave: (f: BrandFont) => void;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [role, setRole] = useState(existing?.role ?? 'Headlines');
  const [weights, setWeights] = useState(existing?.weights ?? '');

  function save() {
    if (!name.trim()) return;
    onSave({ id: existing?.id ?? generateId(), name: name.trim(), role, weights: weights.trim() });
  }

  return (
    <Modal open onClose={onClose} title={existing ? 'Change this face' : 'Add a face'} size="sm">
      <div className="space-y-4 p-5">
        <div>
          <label className={LABEL}>The name, as Google Fonts has it</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Manrope" className={FIELD} />
          {name && (
            <p style={{ fontFamily: `'${name}', sans-serif` }} className="mt-2 text-lg text-muted">
              The quick brown fox
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Used for</label>
            <select value={role} onChange={e => setRole(e.target.value)} className={FIELD}>
              {FONT_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Weights</label>
            <input value={weights} onChange={e => setWeights(e.target.value)} placeholder="Regular, Bold" className={FIELD} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={BTN_GHOST}>Cancel</button>
          <button type="button" onClick={save} disabled={!name.trim()} className={BTN_DARK}>
            {existing ? 'Save it' : 'Add it'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Logo files ───────────────────────────────────────────────────────────────

function Logos({ logos, onUpdate }: { logos: BrandLogo[]; onUpdate: (l: BrandLogo[]) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // The same upload path the old screen used. No second mechanism.
  async function upload(files: FileList) {
    setUploading(true);
    setError('');
    try {
      const added: BrandLogo[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('bucket', 'assets');
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.url) throw new Error(json.error || 'That file did not go up');
        added.push({ id: generateId(), name: file.name.replace(/\.[^.]+$/, ''), url: json.url });
      }
      onUpdate([...logos, ...added]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That file did not go up');
    } finally {
      setUploading(false);
    }
  }

  async function download(logo: BrandLogo) {
    try {
      const res = await fetch(logo.url);
      const blob = await res.blob();
      const ext = logo.url.split('.').pop()?.split('?')[0] || 'png';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${logo.name}.${ext}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(logo.url, '_blank');
    }
  }

  return (
    <Section
      icon={<ImageIcon size={16} strokeWidth={1.9} className="text-muted" />}
      title="Logo files"
      count={logos.length}
      action={
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className={BTN_GHOST}>
          {uploading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} strokeWidth={2.2} />}
          {uploading ? 'Sending' : 'Add'}
        </button>
      }
    >
      <input ref={fileRef} type="file" accept="image/*,.svg" multiple className="hidden"
        onChange={e => { if (e.target.files?.length) void upload(e.target.files); e.target.value = ''; }} />

      {logos.length === 0 ? (
        <p className="text-[13.5px] leading-[1.6] text-faint">{brandKitEmpty('logos')}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {logos.map(logo => (
            <div key={logo.id} className="group overflow-hidden rounded-[14px] border border-hairline">
              <div className="flex aspect-square items-center justify-center bg-[repeating-conic-gradient(#f6f3f0_0%_25%,#ffffff_0%_50%)] bg-[length:16px_16px] p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logo.url} alt={logo.name} className="max-h-full max-w-full object-contain" />
              </div>
              <div className="border-t border-divider px-2.5 py-2">
                <p className="truncate text-[12.5px] font-semibold text-text">{logo.name}</p>
                <div className="mt-1.5 flex items-center gap-1">
                  <button type="button" onClick={() => void download(logo)}
                    className="inline-flex items-center gap-1 rounded-lg border border-hairline px-2 py-1 text-[11px] font-semibold text-muted">
                    <Download size={11} strokeWidth={2} /> Download
                  </button>
                  <button type="button" onClick={() => onUpdate(logos.filter(l => l.id !== logo.id))}
                    aria-label={`Remove ${logo.name}`}
                    className="ml-auto p-1 text-faint hover:text-accent-text md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
                    <Trash2 size={12} strokeWidth={2} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {error && <p className="mt-2 text-[12.5px] text-accent-text">{error}</p>}
    </Section>
  );
}
