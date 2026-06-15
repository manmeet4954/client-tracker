'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Plus, Phone, MapPin, Pencil, Trash2, Search, ChevronDown, PhoneCall, Upload,
} from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import { generateId } from '@/lib/utils';
import { ColdCall, ColdCallStatus, COLD_CALL_STATUSES } from '@/types';
import Modal from './Modal';

// Parse pasted lead lines → { name, phone, location }.
// Prefers an explicit "|" / tab delimiter; otherwise grabs the longest
// digit-run (>=10 digits) as the phone so dates/times in names aren't mistaken.
function parseLeadLines(text: string): { name: string; phone: string; location: string }[] {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => {
      let name = '';
      let phone = '';
      const pipe = line.lastIndexOf('|');
      const tab = line.indexOf('\t');
      if (pipe >= 0) {
        name = line.slice(0, pipe).trim();
        phone = line.slice(pipe + 1).replace(/[^\d+]/g, '');
      } else if (tab >= 0) {
        name = line.slice(0, tab).trim();
        phone = line.slice(tab + 1).replace(/[^\d+]/g, '');
      } else {
        let best = '';
        const matches = Array.from(line.matchAll(/\+?\d[\d\s-]{8,}\d/g));
        for (const m of matches) {
          const digits = m[0].replace(/\D/g, '');
          if (digits.length >= 10 && digits.length >= best.replace(/\D/g, '').length) best = m[0];
        }
        if (best) {
          phone = best.replace(/[^\d+]/g, '');
          name = line.replace(best, '').trim();
        } else {
          name = line;
        }
      }
      name = name.replace(/[,–-]\s*$/, '').trim();
      const location = /ambala/i.test(name) ? 'Ambala' : '';
      return { name, phone, location };
    })
    .filter(l => l.name || l.phone);
}

function statusMeta(id: ColdCallStatus) {
  return COLD_CALL_STATUSES.find(s => s.id === id) ?? COLD_CALL_STATUSES[0];
}

function pickAccent(brandColors: { hex: string; role?: string }[] | undefined, fallback: string): string {
  if (!brandColors?.length) return fallback;
  const primary = brandColors.find(c => /primary|accent/i.test(c.role ?? ''));
  return primary?.hex ?? brandColors[0]?.hex ?? fallback;
}

export default function ColdCallsView({ clientId }: { clientId: string }) {
  const { dispatch } = useApp();
  const { client, data } = useClient(clientId);

  const calls = data.coldCalls ?? [];
  const accent = pickAccent(data.brandKit?.colors, client?.color ?? '#0ea5e9');

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ColdCallStatus | ''>('');
  const [editing, setEditing] = useState<ColdCall | null | 'new'>(null);
  const [importOpen, setImportOpen] = useState(false);

  const visible = calls.filter(c => {
    if (filter && c.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = COLD_CALL_STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s.id] = calls.filter(c => c.status === s.id).length;
    return acc;
  }, {});

  function setStatus(call: ColdCall, status: ColdCallStatus) {
    dispatch({ type: 'UPDATE_COLD_CALL', payload: { clientId, call: { ...call, status } } });
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
            <PhoneCall size={18} style={{ color: accent }} />
            Cold Calls
          </h2>
          <p className="text-sm text-stone-400 mt-0.5">
            Lead tracker — {calls.length} {calls.length === 1 ? 'contact' : 'contacts'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-stone-600 border border-stone-200 bg-white rounded-lg hover:border-stone-400 transition-colors"
          >
            <Upload size={14} />
            Import
          </button>
          <button
            onClick={() => setEditing('new')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white rounded-lg transition-opacity hover:opacity-90"
            style={{ backgroundColor: accent }}
          >
            <Plus size={15} />
            Add Lead
          </button>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-2 border border-stone-200 bg-white rounded-lg px-3 py-1.5 flex-1 max-w-xs">
          <Search size={14} className="text-stone-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, number, location…"
            className="text-sm bg-transparent focus:outline-none text-stone-700 placeholder-stone-400 flex-1"
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <FilterPill label="All" count={calls.length} active={filter === ''} onClick={() => setFilter('')} />
          {COLD_CALL_STATUSES.map(s => (
            <FilterPill
              key={s.id}
              label={s.label}
              count={counts[s.id] ?? 0}
              active={filter === s.id}
              color={s.color}
              onClick={() => setFilter(filter === s.id ? '' : s.id)}
            />
          ))}
        </div>
      </div>

      {/* Empty state */}
      {calls.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: `${accent}1a` }}>
            <PhoneCall size={24} style={{ color: accent }} />
          </div>
          <p className="font-medium text-stone-600 mb-1">No leads yet</p>
          <p className="text-sm text-stone-400">Add your first cold-call lead to start tracking outreach.</p>
        </div>
      )}

      {calls.length > 0 && visible.length === 0 && (
        <p className="text-sm text-stone-400 text-center py-10">No leads match your search/filter.</p>
      )}

      {/* ── Desktop table ── */}
      {visible.length > 0 && (
        <div className="hidden md:block bg-white border border-stone-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-stone-400 border-b border-stone-100 bg-stone-50/60">
                <th className="font-medium px-4 py-2.5">Name</th>
                <th className="font-medium px-4 py-2.5">Number</th>
                <th className="font-medium px-4 py-2.5">Location</th>
                <th className="font-medium px-4 py-2.5">Status</th>
                <th className="font-medium px-4 py-2.5">What they said</th>
                <th className="font-medium px-4 py-2.5">Notes</th>
                <th className="px-4 py-2.5 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map(call => (
                <tr key={call.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60 group transition-colors align-top">
                  <td className="px-4 py-3 font-medium text-stone-900">{call.name}</td>
                  <td className="px-4 py-3">
                    {call.phone ? (
                      <a href={`tel:${call.phone}`} className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-800" onClick={e => e.stopPropagation()}>
                        <Phone size={12} /> {call.phone}
                      </a>
                    ) : <span className="text-stone-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {call.location
                      ? <span className="inline-flex items-center gap-1"><MapPin size={12} className="text-stone-400" />{call.location}</span>
                      : <span className="text-stone-300">—</span>}
                  </td>
                  <td className="px-4 py-3"><StatusDropdown value={call.status} onChange={s => setStatus(call, s)} /></td>
                  <td className="px-4 py-3 text-stone-600 max-w-[200px]">
                    <span className="line-clamp-2">{call.response || <span className="text-stone-300">—</span>}</span>
                  </td>
                  <td className="px-4 py-3 text-stone-500 max-w-[180px]">
                    <span className="line-clamp-2">{call.notes || <span className="text-stone-300">—</span>}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditing(call)} className="p-1.5 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"><Pencil size={13} /></button>
                      <button onClick={() => dispatch({ type: 'DELETE_COLD_CALL', payload: { clientId, callId: call.id } })} className="p-1.5 rounded text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Mobile cards ── */}
      {visible.length > 0 && (
        <div className="md:hidden space-y-2.5">
          {visible.map(call => (
            <div key={call.id} className="bg-white border border-stone-200 rounded-xl p-3.5">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-stone-900">{call.name}</p>
                <StatusDropdown value={call.status} onChange={s => setStatus(call, s)} />
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs">
                {call.phone && (
                  <a href={`tel:${call.phone}`} className="inline-flex items-center gap-1 text-sky-600">
                    <Phone size={12} /> {call.phone}
                  </a>
                )}
                {call.location && (
                  <span className="inline-flex items-center gap-1 text-stone-500"><MapPin size={12} className="text-stone-400" />{call.location}</span>
                )}
              </div>
              {call.response && (
                <p className="text-xs text-stone-600 mt-2"><span className="text-stone-400">Said:</span> {call.response}</p>
              )}
              {call.notes && (
                <p className="text-xs text-stone-500 mt-1"><span className="text-stone-400">Notes:</span> {call.notes}</p>
              )}
              <div className="flex items-center gap-1 mt-2.5 pt-2.5 border-t border-stone-100">
                <button onClick={() => setEditing(call)} className="flex items-center gap-1 px-2 py-1 text-xs text-stone-500 hover:text-stone-900 rounded transition-colors"><Pencil size={12} /> Edit</button>
                <button onClick={() => dispatch({ type: 'DELETE_COLD_CALL', payload: { clientId, callId: call.id } })} className="flex items-center gap-1 px-2 py-1 text-xs text-stone-400 hover:text-red-500 rounded transition-colors ml-auto"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / edit modal */}
      {editing !== null && (
        <ColdCallModal
          existing={editing === 'new' ? null : editing}
          accent={accent}
          onClose={() => setEditing(null)}
          onSave={call => {
            if (editing === 'new') dispatch({ type: 'ADD_COLD_CALL', payload: { clientId, call } });
            else dispatch({ type: 'UPDATE_COLD_CALL', payload: { clientId, call } });
            setEditing(null);
          }}
        />
      )}

      {/* Bulk import modal */}
      {importOpen && (
        <ImportModal
          accent={accent}
          existingPhones={new Set(calls.map(c => c.phone.replace(/\D/g, '')))}
          onClose={() => setImportOpen(false)}
          onImport={newCalls => {
            if (newCalls.length) dispatch({ type: 'ADD_COLD_CALLS', payload: { clientId, calls: newCalls } });
            setImportOpen(false);
          }}
        />
      )}
    </div>
  );
}

function ImportModal({ accent, existingPhones, onClose, onImport }: {
  accent: string;
  existingPhones: Set<string>;
  onClose: () => void;
  onImport: (calls: ColdCall[]) => void;
}) {
  const [text, setText] = useState('');
  const parsed = parseLeadLines(text);
  // de-dupe within the batch and against existing leads (by digits-only phone)
  const seen = new Set<string>();
  const fresh = parsed.filter(p => {
    const key = p.phone.replace(/\D/g, '');
    if (key && (existingPhones.has(key) || seen.has(key))) return false;
    if (key) seen.add(key);
    return true;
  });
  const dupes = parsed.length - fresh.length;

  function doImport() {
    const now = new Date().toISOString();
    const calls: ColdCall[] = fresh.map(p => ({
      id: generateId(),
      name: p.name,
      phone: p.phone,
      location: p.location,
      status: 'open',
      response: '',
      notes: '',
      createdAt: now,
    }));
    onImport(calls);
  }

  return (
    <Modal open onClose={onClose} title="Import Leads" size="md">
      <div className="p-5 space-y-3">
        <p className="text-xs text-stone-500 leading-relaxed">
          Paste one lead per line. Use <code className="px-1 py-0.5 bg-stone-100 rounded">Name | Number</code> per line
          (a plain list of names + numbers also works). Everything imports as <strong>Open</strong>; “Ambala” in a name
          auto-fills the location.
        </p>
        <textarea
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          rows={10}
          placeholder={'Aditi Gupta City Vartika | +919971778474\nAman Preet Maam City | +919467857587'}
          className="input-base w-full resize-none font-mono text-xs"
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-stone-500">
            {parsed.length === 0 ? 'Nothing pasted yet'
              : <><strong className="text-stone-800">{fresh.length}</strong> new lead{fresh.length !== 1 ? 's' : ''}{dupes > 0 && <span className="text-stone-400"> · {dupes} duplicate{dupes !== 1 ? 's' : ''} skipped</span>}</>}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button
              onClick={doImport}
              disabled={fresh.length === 0}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-40 transition-opacity hover:opacity-90"
              style={{ backgroundColor: accent }}
            >
              Import {fresh.length || ''}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function FilterPill({ label, count, active, color, onClick }: {
  label: string; count: number; active: boolean; color?: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
        active ? 'border-stone-800 bg-stone-900 text-white' : 'border-stone-200 bg-white text-stone-600 hover:border-stone-400'
      }`}
    >
      {color && !active && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />}
      {label}
      <span className={`${active ? 'text-white/70' : 'text-stone-400'}`}>{count}</span>
    </button>
  );
}

function StatusDropdown({ value, onChange }: { value: ColdCallStatus; onChange: (s: ColdCallStatus) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const meta = statusMeta(value);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-opacity hover:opacity-80"
        style={{ color: meta.color, backgroundColor: meta.bg }}
      >
        {meta.label}
        <ChevronDown size={11} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 w-40 bg-white border border-stone-200 rounded-lg shadow-lg py-1">
          {COLD_CALL_STATUSES.map(s => (
            <button
              key={s.id}
              onClick={() => { onChange(s.id); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-stone-50 transition-colors"
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
              <span className={value === s.id ? 'text-stone-900 font-medium' : 'text-stone-600'}>{s.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ColdCallModal({ existing, accent, onClose, onSave }: {
  existing: ColdCall | null;
  accent: string;
  onClose: () => void;
  onSave: (call: ColdCall) => void;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [location, setLocation] = useState(existing?.location ?? '');
  const [status, setStatus] = useState<ColdCallStatus>(existing?.status ?? 'open');
  const [response, setResponse] = useState(existing?.response ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');

  function save() {
    if (!name.trim()) return;
    onSave({
      id: existing?.id ?? generateId(),
      name: name.trim(),
      phone: phone.trim(),
      location: location.trim(),
      status,
      response: response.trim(),
      notes: notes.trim(),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    });
  }

  return (
    <Modal open onClose={onClose} title={existing ? 'Edit Lead' : 'Add Lead'} size="md">
      <div className="p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">Client name *</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Who are you calling?" className="input-base w-full" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Number</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91…" className="input-base w-full" inputMode="tel" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Location</label>
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="City / area" className="input-base w-full" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Status</label>
          <div className="flex flex-wrap gap-1.5">
            {COLD_CALL_STATUSES.map(s => (
              <button
                key={s.id}
                onClick={() => setStatus(s.id)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all"
                style={status === s.id
                  ? { color: s.color, backgroundColor: s.bg, borderColor: s.color }
                  : { color: '#78716c', backgroundColor: '#fff', borderColor: '#e7e5e4' }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">What they said</label>
          <textarea value={response} onChange={e => setResponse(e.target.value)} rows={2} placeholder="Their response on the call…" className="input-base w-full resize-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Follow-up, context, anything…" className="input-base w-full resize-none" />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={!name.trim()} className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-40 transition-opacity hover:opacity-90" style={{ backgroundColor: accent }}>
            {existing ? 'Save' : 'Add Lead'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
