'use client';

import { useState } from 'react';
import { Plus, Trash2, Pencil, Check, X, Target, Briefcase, Users, Lightbulb, DollarSign, Palette, Type as TypeIcon } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import { generateId } from '@/lib/utils';
import { BrandOverview, BrandService, BrandKit, BrandColor, BrandFont } from '@/types';
import Modal from './Modal';

export default function BrandView({ clientId }: { clientId: string }) {
  const { dispatch } = useApp();
  const { data } = useClient(clientId);
  const brand = data.brand;
  const brandKit: BrandKit = data.brandKit ?? { colors: [], fonts: [] };

  function updateBrand(patch: Partial<BrandOverview>) {
    dispatch({ type: 'UPDATE_BRAND', payload: { clientId, brand: { ...brand, ...patch } } });
  }
  function updateKit(patch: Partial<BrandKit>) {
    dispatch({ type: 'UPDATE_BRAND_KIT', payload: { clientId, brandKit: { ...brandKit, ...patch } } });
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-5">
      {/* Brand Kit */}
      <BrandKitSection kit={brandKit} onUpdate={updateKit} />

      {/* Tagline */}
      <TaglineEditor tagline={brand.tagline} onSave={tagline => updateBrand({ tagline })} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Goals */}
        <GoalsPanel
          goals={brand.goals}
          onUpdate={goals => updateBrand({ goals })}
        />

        {/* Audience */}
        <TextPanel
          title="Audience"
          icon={<Users size={16} className="text-sky-500" />}
          bg="bg-sky-50"
          value={brand.audience}
          placeholder="Who are you reaching? Describe demographics, mindset, pain points, and what they care about..."
          onSave={audience => updateBrand({ audience })}
        />

        {/* Strategy */}
        <TextPanel
          title="Brand Strategy"
          icon={<Lightbulb size={16} className="text-amber-500" />}
          bg="bg-amber-50"
          value={brand.strategy}
          placeholder="What's the overall content and brand strategy? Tone, pillars, positioning..."
          onSave={strategy => updateBrand({ strategy })}
        />

        {/* Services placeholder - full row below */}
        <div className="hidden" />
      </div>

      {/* Services — full width */}
      <ServicesPanel
        services={brand.services}
        onUpdate={services => updateBrand({ services })}
      />
    </div>
  );
}

// ── Brand Kit ────────────────────────────────────────────────────────────────

function toCssFamily(name: string): string {
  const serif = ['Newsreader', 'Lora', 'Merriweather', 'Playfair Display', 'Georgia'];
  const mono = ['JetBrains Mono', 'Fira Code', 'Source Code Pro', 'Courier'];
  if (serif.some(s => name.includes(s))) return `'${name}', serif`;
  if (mono.some(s => name.includes(s))) return `'${name}', monospace`;
  return `'${name}', sans-serif`;
}

function BrandKitSection({ kit, onUpdate }: { kit: BrandKit; onUpdate: (p: Partial<BrandKit>) => void }) {
  const [colorModal, setColorModal] = useState<BrandColor | null | 'new'>(null);
  const [fontModal, setFontModal]   = useState<BrandFont  | null | 'new'>(null);

  function saveColor(c: BrandColor) {
    const existing = kit.colors.find(x => x.id === c.id);
    onUpdate({ colors: existing ? kit.colors.map(x => x.id === c.id ? c : x) : [...kit.colors, c] });
    setColorModal(null);
  }
  function deleteColor(id: string) { onUpdate({ colors: kit.colors.filter(c => c.id !== id) }); }

  function saveFont(f: BrandFont) {
    const existing = kit.fonts.find(x => x.id === f.id);
    onUpdate({ fonts: existing ? kit.fonts.map(x => x.id === f.id ? f : x) : [...kit.fonts, f] });
    setFontModal(null);
  }
  function deleteFont(id: string) { onUpdate({ fonts: kit.fonts.filter(f => f.id !== id) }); }

  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
          <Palette size={14} className="text-violet-600" />
        </div>
        <h3 className="font-semibold text-stone-900 text-sm">Brand Kit</h3>
        <span className="text-xs text-stone-400 ml-1">— colors and fonts used in Studio</span>
      </div>

      <div className="p-5 space-y-6">

        {/* Colors */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Colors</p>
            <button onClick={() => setColorModal('new')}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors">
              <Plus size={11} /> Add
            </button>
          </div>
          {kit.colors.length === 0 ? (
            <p className="text-sm text-stone-400 italic">No colors yet — add your brand palette.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {kit.colors.map(c => (
                <div key={c.id} className="group flex flex-col items-center gap-1.5">
                  <button
                    onClick={() => setColorModal(c)}
                    style={{ background: c.hex }}
                    className="w-14 h-14 rounded-xl border border-stone-200 shadow-sm hover:scale-105 transition-transform"
                  />
                  <p className="text-xs font-medium text-stone-700 text-center max-w-[56px] truncate">{c.name}</p>
                  <p className="text-[10px] text-stone-400 font-mono">{c.hex.toUpperCase()}</p>
                  <button onClick={() => deleteColor(c.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-stone-300 hover:text-red-500">
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fonts */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Fonts</p>
            <button onClick={() => setFontModal('new')}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors">
              <Plus size={11} /> Add
            </button>
          </div>
          {kit.fonts.length === 0 ? (
            <p className="text-sm text-stone-400 italic">No fonts yet — add your brand typefaces.</p>
          ) : (
            <div className="space-y-2">
              {kit.fonts.map(f => (
                <div key={f.id} className="group flex items-center gap-4 p-3 border border-stone-100 rounded-xl hover:border-stone-200 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-stone-50 flex items-center justify-center shrink-0">
                    <span style={{ fontFamily: toCssFamily(f.name), fontWeight: 600, fontSize: 18, color: '#292524' }}>Aa</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontFamily: toCssFamily(f.name) }} className="text-sm font-semibold text-stone-900">{f.name}</p>
                    <p className="text-xs text-stone-400">{f.weights}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 bg-stone-100 text-stone-600 rounded-full shrink-0">{f.role}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => setFontModal(f)} className="p-1 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-100"><Pencil size={12} /></button>
                    <button onClick={() => deleteFont(f.id)} className="p-1 rounded text-stone-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Color modal */}
      {colorModal !== null && (
        <ColorModal
          existing={colorModal === 'new' ? null : colorModal}
          onClose={() => setColorModal(null)}
          onSave={saveColor}
        />
      )}

      {/* Font modal */}
      {fontModal !== null && (
        <FontModal
          existing={fontModal === 'new' ? null : fontModal}
          onClose={() => setFontModal(null)}
          onSave={saveFont}
        />
      )}
    </div>
  );
}

function ColorModal({ existing, onClose, onSave }: { existing: BrandColor | null; onClose: () => void; onSave: (c: BrandColor) => void }) {
  const [name, setName] = useState(existing?.name ?? '');
  const [hex, setHex]   = useState(existing?.hex ?? '#000000');

  function save() {
    if (!name.trim()) return;
    onSave({ id: existing?.id ?? generateId(), name: name.trim(), hex });
  }

  return (
    <Modal open onClose={onClose} title={existing ? 'Edit Color' : 'Add Color'} size="sm">
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-4">
          <input type="color" value={hex} onChange={e => setHex(e.target.value)}
            className="w-16 h-16 rounded-xl border border-stone-200 cursor-pointer shrink-0" />
          <div className="flex-1 space-y-2">
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Color Name</label>
              <input autoFocus value={name} onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && save()}
                placeholder="e.g. Green" className="input-base w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Hex Code</label>
              <input value={hex} onChange={e => setHex(e.target.value)}
                placeholder="#25B763" className="input-base w-full font-mono" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={!name.trim()} className="btn-primary">{existing ? 'Save' : 'Add Color'}</button>
        </div>
      </div>
    </Modal>
  );
}

function FontModal({ existing, onClose, onSave }: { existing: BrandFont | null; onClose: () => void; onSave: (f: BrandFont) => void }) {
  const [name,    setName]    = useState(existing?.name ?? '');
  const [role,    setRole]    = useState(existing?.role ?? 'Headlines');
  const [weights, setWeights] = useState(existing?.weights ?? '');

  const ROLES = ['Headlines', 'Body Copy', 'Emphasis', 'Accent', 'Other'];

  function save() {
    if (!name.trim()) return;
    onSave({ id: existing?.id ?? generateId(), name: name.trim(), role, weights: weights.trim() });
  }

  return (
    <Modal open onClose={onClose} title={existing ? 'Edit Font' : 'Add Font'} size="sm">
      <div className="p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">Font Name (Google Fonts)</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. Manrope" className="input-base w-full" />
          {name && (
            <p style={{ fontFamily: `'${name}', sans-serif` }}
              className="mt-2 text-lg text-stone-700">The quick brown fox</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Role</label>
            <select value={role} onChange={e => setRole(e.target.value)} className="input-base w-full">
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Weights</label>
            <input value={weights} onChange={e => setWeights(e.target.value)}
              placeholder="e.g. Regular, Bold" className="input-base w-full" />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={!name.trim()} className="btn-primary">{existing ? 'Save' : 'Add Font'}</button>
        </div>
      </div>
    </Modal>
  );
}

// ── Tagline ────────────────────────────────────────────────────────────────────

function TaglineEditor({ tagline, onSave }: { tagline: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tagline);

  function save() { onSave(draft); setEditing(false); }

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5">
      <label className="text-xs font-medium text-stone-400 uppercase tracking-wide block mb-2">Brand Tagline</label>
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
            placeholder="A short tagline or positioning statement..."
            className="flex-1 text-lg font-medium text-stone-900 border-b border-accent focus:outline-none bg-transparent pb-1"
          />
          <button onClick={save} className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded transition-colors"><Check size={16} /></button>
          <button onClick={() => setEditing(false)} className="p-1.5 text-stone-400 hover:bg-stone-100 rounded transition-colors"><X size={16} /></button>
        </div>
      ) : (
        <button onClick={() => { setDraft(tagline); setEditing(true); }} className="text-left w-full group">
          {tagline ? (
            <p className="text-lg font-medium text-stone-900 group-hover:text-accent transition-colors">{tagline}</p>
          ) : (
            <p className="text-lg text-stone-300 italic">Click to add a tagline...</p>
          )}
        </button>
      )}
    </div>
  );
}

function GoalsPanel({ goals, onUpdate }: { goals: string[]; onUpdate: (g: string[]) => void }) {
  const [newGoal, setNewGoal] = useState('');
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState('');

  function add() {
    const g = newGoal.trim();
    if (!g) return;
    onUpdate([...goals, g]);
    setNewGoal('');
  }

  function remove(i: number) { onUpdate(goals.filter((_, idx) => idx !== i)); }

  function startEdit(i: number) { setEditIdx(i); setEditDraft(goals[i]); }
  function saveEdit() {
    if (editIdx === null) return;
    const updated = [...goals];
    updated[editIdx] = editDraft.trim() || goals[editIdx];
    onUpdate(updated);
    setEditIdx(null);
  }

  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
          <Target size={14} className="text-emerald-600" />
        </div>
        <h3 className="font-semibold text-stone-900 text-sm">Brand Goals</h3>
      </div>
      <div className="p-4 space-y-1">
        {goals.length === 0 && (
          <p className="text-sm text-stone-400 py-2">No goals yet. Add your brand's key objectives.</p>
        )}
        {goals.map((g, i) => (
          <div key={i} className="group flex items-center gap-2 p-2 rounded-lg hover:bg-stone-50">
            <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0 mt-0.5" />
            {editIdx === i ? (
              <input
                autoFocus
                value={editDraft}
                onChange={e => setEditDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditIdx(null); }}
                onBlur={saveEdit}
                className="flex-1 text-sm text-stone-700 bg-transparent border-b border-accent focus:outline-none"
              />
            ) : (
              <span onDoubleClick={() => startEdit(i)} className="flex-1 text-sm text-stone-700 cursor-default">{g}</span>
            )}
            <button onClick={() => remove(i)} className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-red-500 transition-all">
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1">
          <Plus size={14} className="text-stone-400 shrink-0" />
          <input
            value={newGoal}
            onChange={e => setNewGoal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="Add a goal..."
            className="flex-1 text-sm text-stone-700 placeholder-stone-400 bg-transparent focus:outline-none"
          />
          <button onClick={add} disabled={!newGoal.trim()} className="btn-primary py-0.5 px-2 text-xs disabled:opacity-30">Add</button>
        </div>
      </div>
    </div>
  );
}

function TextPanel({
  title,
  icon,
  bg,
  value,
  placeholder,
  onSave,
}: {
  title: string;
  icon: React.ReactNode;
  bg: string;
  value: string;
  placeholder: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function save() { onSave(draft); setEditing(false); }

  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}>{icon}</div>
          <h3 className="font-semibold text-stone-900 text-sm">{title}</h3>
        </div>
        {!editing && (
          <button onClick={() => { setDraft(value); setEditing(true); }} className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded transition-colors">
            <Pencil size={13} />
          </button>
        )}
      </div>
      <div className="p-4">
        {editing ? (
          <>
            <textarea
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder={placeholder}
              rows={5}
              className="w-full text-sm text-stone-700 placeholder-stone-400 bg-transparent border border-stone-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent resize-none"
            />
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => setEditing(false)} className="btn-secondary text-xs py-1 px-3">Cancel</button>
              <button onClick={save} className="btn-primary text-xs py-1 px-3">Save</button>
            </div>
          </>
        ) : value ? (
          <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">{value}</p>
        ) : (
          <button onClick={() => { setDraft(''); setEditing(true); }} className="text-sm text-stone-400 italic hover:text-stone-600 transition-colors text-left w-full">
            {placeholder}
          </button>
        )}
      </div>
    </div>
  );
}

function ServicesPanel({ services, onUpdate }: { services: BrandService[]; onUpdate: (s: BrandService[]) => void }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editService, setEditService] = useState<BrandService | null>(null);

  function deleteService(id: string) { onUpdate(services.filter(s => s.id !== id)); }
  function saveService(s: BrandService) {
    if (editService) {
      onUpdate(services.map(x => x.id === s.id ? s : x));
    } else {
      onUpdate([...services, s]);
    }
    setModalOpen(false);
    setEditService(null);
  }

  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
            <Briefcase size={14} className="text-violet-600" />
          </div>
          <h3 className="font-semibold text-stone-900 text-sm">Services</h3>
          <span className="text-xs text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded-full">{services.length}</span>
        </div>
        <button
          onClick={() => { setEditService(null); setModalOpen(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
        >
          <Plus size={13} />
          Add Service
        </button>
      </div>

      <div className="p-4">
        {services.length === 0 ? (
          <div className="py-6 text-center text-stone-400 text-sm">
            No services added. Describe what you offer for this client.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {services.map(s => (
              <ServiceCard
                key={s.id}
                service={s}
                onEdit={() => { setEditService(s); setModalOpen(true); }}
                onDelete={() => deleteService(s.id)}
              />
            ))}
          </div>
        )}
      </div>

      <ServiceModal
        key={editService?.id ?? 'new'}
        open={modalOpen}
        existing={editService}
        onClose={() => { setModalOpen(false); setEditService(null); }}
        onSave={saveService}
      />
    </div>
  );
}

function ServiceCard({ service, onEdit, onDelete }: { service: BrandService; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="group border border-stone-200 rounded-xl p-4 hover:border-stone-300 hover:shadow-sm transition-all relative">
      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} className="p-1 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors">
          <Pencil size={12} />
        </button>
        <button onClick={onDelete} className="p-1 rounded text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors">
          <Trash2 size={12} />
        </button>
      </div>
      <p className="font-semibold text-stone-900 text-sm pr-12 leading-snug">{service.name}</p>
      {service.price && (
        <div className="flex items-center gap-1 mt-1.5">
          <DollarSign size={11} className="text-emerald-500" />
          <span className="text-xs font-medium text-emerald-600">{service.price}</span>
        </div>
      )}
      {service.description && (
        <p className="text-xs text-stone-500 mt-2 leading-relaxed">{service.description}</p>
      )}
    </div>
  );
}

function ServiceModal({
  open,
  existing,
  onClose,
  onSave,
}: {
  open: boolean;
  existing: BrandService | null;
  onClose: () => void;
  onSave: (s: BrandService) => void;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [price, setPrice] = useState(existing?.price ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');

  function save() {
    if (!name.trim()) return;
    onSave({
      id: existing?.id ?? generateId(),
      name: name.trim(),
      price: price.trim(),
      description: description.trim(),
    });
    setName(''); setPrice(''); setDescription('');
  }

  return (
    <Modal open={open} onClose={onClose} title={existing ? 'Edit Service' : 'Add Service'} size="sm">
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Service Name *</label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Instagram Management"
            className="input-base w-full"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Price</label>
          <input
            value={price}
            onChange={e => setPrice(e.target.value)}
            placeholder="e.g. ₹15,000/month"
            className="input-base w-full"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What's included in this service..."
            rows={3}
            className="input-base w-full resize-none"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={!name.trim()} className="btn-primary">
            {existing ? 'Save' : 'Add Service'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
