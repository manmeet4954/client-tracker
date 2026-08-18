'use client';

// Spec 35 — the screen around the phone.
//
// Everything that is NOT Instagram lives here: the list of mockups, the name
// and date, copy, share, delete. The phone itself carries no chrome of its own,
// because the moment a control is drawn on top of it, it stops being a picture
// of the client's profile and becomes a picture of our software.
//
// So the split is exactly: `Phone.tsx` is what the client sees, this is what
// she works with, and the two never mix.

import { useState } from 'react';
import { Copy, Link2, Plus, Trash2 } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { generateId } from '@/lib/utils';
import Phone from '@/components/mockup/Phone';
import Compare from '@/components/mockup/Compare';
import {
  archiveMockup, copyMockup, copyName, findMockup, newMockup, prettyDate, readMockups,
  setBeforeImage, setFraming,
  rename, setAvatar, setField, setHighlightImage, setHighlightLabel, setTheme, setTileImage,
  togglePin, writeMockup, mockupLine,
  type EditableField, type MockupTheme, type ProfileMockupRecord,
} from '@/lib/mockup/profile';

/** The same signed direct-to-storage path Assets uses. No second uploader. */
async function upload(file: Blob, ext: string): Promise<string> {
  const signRes = await fetch('/api/upload/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ext, kind: 'orig' }),
  });
  if (!signRes.ok) throw new Error('upload-permission');
  const { path, token, publicUrl } = await signRes.json();
  const { error } = await supabase.storage
    .from('assets')
    .uploadToSignedUrl(path, token, file, { contentType: file.type || undefined });
  if (error) throw new Error(error.message);
  return publicUrl as string;
}

function extOf(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  return file.type.includes('png') ? 'png' : file.type.includes('webp') ? 'webp' : 'jpg';
}

export default function MockupScreen({ profileId }: { profileId: string }) {
  const { dispatch } = useApp();
  const { data } = useClient(profileId);
  const body = data.body;

  const mockups = body ? readMockups(body) : [];
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const current = body && openId ? findMockup(body, openId) : null;

  function save(next: ProfileMockupRecord) {
    if (!body) return;
    dispatch({
      type: 'SET_BODY',
      payload: { clientId: profileId, body: writeMockup(body, next, new Date().toISOString()) },
    });
  }

  /** One place where an upload turns into a saved url, so failures read alike. */
  async function withUpload(file: File, apply: (url: string) => void) {
    setNote('');
    try {
      apply(await upload(file, extOf(file)));
    } catch {
      setNote('That picture could not be uploaded. Nothing else was changed.');
    }
  }

  function start() {
    if (!body) return;
    const now = new Date().toISOString();
    const made = newMockup({
      id: generateId(),
      shareId: generateId() + generateId(),
      name: `Profile mockup ${mockups.length + 1}`,
      date: now.slice(0, 10),
      now,
    });
    save(made);
    setOpenId(made.id);
  }

  if (!body) {
    return <p className="p-8 text-sm text-faint">This profile is not in the new structure yet.</p>;
  }

  // ── The list ──────────────────────────────────────────────────────────────
  if (!current) {
    return (
      <div className="w-full max-w-5xl p-4 md:p-8">
        <p className="text-[13.5px] leading-[1.6] text-muted">
          How their profile will look once you have optimised it. Build it, show it to them, and
          keep the old one so you can put the two side by side.
        </p>

        <div className="mt-5 space-y-2">
          {mockups.map(m => (
            <button key={m.id} type="button" onClick={() => setOpenId(m.id)}
              className="flex w-full items-center gap-3 rounded-2xl border border-hairline bg-white p-4 text-left hover:border-[rgba(234,71,17,.3)]">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-text">{m.name}</span>
                <span className="mt-[2px] block text-[12.5px] text-faint">
                  {prettyDate(m.date)} · {mockupLine(m)}
                </span>
              </span>
            </button>
          ))}
        </div>

        <button type="button" onClick={start}
          className="mt-3 flex items-center gap-2 rounded-2xl border border-dashed border-[rgba(23,21,26,.24)] px-4 py-3 text-[13px] font-semibold text-muted hover:border-[rgba(234,71,17,.4)]">
          <Plus size={16} strokeWidth={2.2} />
          {mockups.length ? 'Another one' : 'Build one'}
        </button>
      </div>
    );
  }

  // ── One mockup ────────────────────────────────────────────────────────────
  const share = typeof window !== 'undefined' ? `${window.location.origin}/p/${current.shareId}` : '';

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <button type="button" onClick={() => { setOpenId(null); setNote(''); }}
        className="text-[12.5px] font-semibold text-muted hover:text-text">
        All mockups
      </button>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={current.name}
          onChange={e => save(rename(current, e.target.value, current.date, new Date().toISOString()))}
          aria-label="What to call this mockup"
          className="min-w-0 flex-1 rounded-xl border border-hairline bg-white px-3 py-2 text-[14px] font-semibold text-text outline-none focus:border-[rgba(234,71,17,.4)]"
        />
        <input
          type="date"
          value={current.date}
          onChange={e => save(rename(current, current.name, e.target.value, new Date().toISOString()))}
          aria-label="The date this is for"
          className="rounded-xl border border-hairline bg-white px-3 py-2 text-[13px] text-muted outline-none"
        />
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <Action icon={<Copy size={14} strokeWidth={2.2} />} label="Make a copy"
          onClick={() => {
            const now = new Date().toISOString();
            const dup = copyMockup(current, {
              id: generateId(), shareId: generateId() + generateId(),
              name: copyName(current.name), date: now.slice(0, 10), now,
            });
            save(dup);
            setOpenId(dup.id);
          }} />
        {/* TWO LINKS, ONE MOCKUP (2026-08-17). Her request: the link she sends
            showed only the optimized profile, and she wants the comparison as
            a link of its own. Same shareId, same record — only `?view=compare`
            differs — so editing the mockup updates both at once and neither
            can go stale against the other.

            The comparison link only appears once a screenshot exists, because
            a comparison with one side missing is not a comparison, and a link
            that quietly falls back to the solo view would be a link she thinks
            she sent and did not. */}
        <Action icon={<Link2 size={14} strokeWidth={2.2} />} label="Copy the link"
          onClick={() => {
            navigator.clipboard?.writeText(share);
            setNote('Link copied. It shows the new profile on its own.');
          }} />
        {current.beforeImageUrl && (
          <Action icon={<Link2 size={14} strokeWidth={2.2} />} label="Copy the before and after link"
            onClick={() => {
              navigator.clipboard?.writeText(`${share}?view=compare`);
              setNote('Link copied. It shows their profile now beside the new one.');
            }} />
        )}
        <Action icon={<Trash2 size={14} strokeWidth={2.2} />} label="Remove it"
          onClick={() => {
            if (!confirm(`Remove "${current.name}"? It is kept, not deleted.`)) return;
            dispatch({
              type: 'SET_BODY',
              payload: { clientId: profileId, body: archiveMockup(body, current.id, new Date().toISOString()) },
            });
            setOpenId(null);
          }} />
      </div>

      {note && <p className="mt-2 text-[12.5px] text-accent-text">{note}</p>}

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-[12.5px] text-faint">
          Tap any text to write it. Tap any picture to change it.
        </p>
        {/* Both are real: plenty of people run their phone in light mode, and a
            mockup in the wrong one does not look like their phone. */}
        <div className="flex flex-none rounded-full border border-hairline bg-white p-[3px]">
          {(['dark', 'light'] as MockupTheme[]).map(th => (
            <button key={th} type="button"
              onClick={() => save(setTheme(current, th, new Date().toISOString()))}
              className={`rounded-full px-3 py-1 text-[12px] font-semibold capitalize ${
                current.theme === th ? 'bg-ink text-white' : 'text-muted'
              }`}>
              {th}
            </button>
          ))}
        </div>
      </div>

      {/* BEFORE AND AFTER (2026-08-17). Their real profile, screenshotted, beside
          the one being built. It is the thing she actually shows a client, so
          it sits above the editor rather than behind a tab. The same component
          renders on a client's Brand window with the upload absent. */}
      <div className="mt-4">
        <Compare
          mockup={current}
          onBefore={f => withUpload(f, url => save(setBeforeImage(current, url, new Date().toISOString())))}
          onClearBefore={() => save(setBeforeImage(current, '', new Date().toISOString()))}
          onSize={pct => save(setFraming(current, 'after', { zoom: pct }, new Date().toISOString()))}
        />
      </div>

      {/* The phone, editable. Nothing is drawn on top of it. */}
      <p className="mt-6 text-[11.5px] font-bold uppercase tracking-[.11em] text-faint">Edit the new one</p>
      <div className="mt-1.5 overflow-hidden rounded-[28px] border border-hairline">
        <Phone
          mockup={current}
          onField={(f: EditableField, v: string) =>
            save(setField(current, f, v, new Date().toISOString()))}
          onAvatar={f => withUpload(f, url => save(setAvatar(current, url, new Date().toISOString())))}
          onHighlightLabel={(id, label) =>
            save(setHighlightLabel(current, id, label, new Date().toISOString()))}
          onHighlightImage={(id, f) =>
            withUpload(f, url => save(setHighlightImage(current, id, url, new Date().toISOString())))}
          onTileImage={(id, f) =>
            withUpload(f, url => save(setTileImage(current, id, url, new Date().toISOString())))}
          onTogglePin={id => {
            const r = togglePin(current, id, new Date().toISOString());
            // A refused pin comes back with the record untouched, so saving it
            // anyway would be harmless and confusing. It says why instead.
            if (r.error) { setNote(r.error); return; }
            save(r.mockup);
            setNote('');
          }}
        />
      </div>
    </div>
  );
}

function Action({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-1.5 rounded-full border border-hairline bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-muted hover:border-[rgba(234,71,17,.4)] hover:text-accent-text">
      {icon}
      {label}
    </button>
  );
}
