'use client';

// Creation → Assets — the restructure handoff, "Assets".
//
//   "Grid of sets, minmax(178px, 1fr). Each: 4:3 thumbnail on a #f4f1ee →
//    #e7e2dd gradient with an uppercase kind label, name 14.5px/600, meta 12px.
//    Originals are always kept; video opens in Drive. For profiles that sell
//    products, a Catalogue mode toggle switches the same screen to the product
//    catalogue — the catalogue is an assets MODE, not its own screen."
//
// Three things this file is careful about:
//
// 1. THE CATALOGUE IS A MODE. `components/CatalogueView.tsx` is mounted whole,
//    PDF export and all. It is not reimplemented and not wrapped in anything
//    that could break it. Where a profile has no catalogue there is no toggle
//    at all — not a disabled second pill.
// 2. THE CLIENT CAN UPLOAD (give-point 2). "Add photos" is NOT owner-gated, and
//    the upload path is the same signed direct-to-storage path the old screen
//    used: originals go up untouched, a small webp thumb rides alongside.
//    Deleting stays owner-only, as it was.
// 3. NO COUNT IS TYPED. Every number in every line comes out of
//    `lib/creation/assets.ts`, counted from the array the line describes.
//
// One deliberate deviation from the spec measurement, and only one: the grid is
// minmax(158px, 1fr) below the `sm` breakpoint and minmax(178px, 1fr) above it.
// At the 392px phone width the design targets, 178px yields a single column of
// full-width 4:3 tiles, which is a long scroll for a shoot with nine sets. 158px
// gives the two columns the layout clearly wants. Desktop is exactly as specced.

import { useRef, useState } from 'react';
import {
  Check, ChevronLeft, Download, ExternalLink, Pencil, Plus, Trash2, Upload, Video, X,
} from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { generateId } from '@/lib/utils';
import type { AssetItem, AssetSet } from '@/types';
import { Segmented } from '@/components/shell/Screen';
import CatalogueView from '@/components/CatalogueView';
import {
  assetModes, assetTiles, assetsLine, driveTile, fileSize, hasCatalogue,
  itemsInSet, resolveMode, setKind, setLine,
} from '@/lib/creation/assets';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
const THUMB_MAX = 600; // px, longest edge

// ── The upload path ──────────────────────────────────────────────────────────
// Kept behaviour-identical to the one the old screen shipped: same sign
// endpoint, same bucket, same item shape. The original is never resized and
// never recompressed; the thumbnail is a separate small webp.

/** Small webp preview for fast grids. The ORIGINAL is never touched. */
async function makeThumb(file: File): Promise<Blob | null> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, THUMB_MAX / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    return await new Promise(res => canvas.toBlob(res, 'image/webp', 0.8));
  } catch {
    return null;
  }
}

/** Ask the server for permission, then send the file STRAIGHT to storage. */
async function directUpload(file: Blob, ext: string, kind: 'orig' | 'thumb'): Promise<string> {
  const signRes = await fetch('/api/upload/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ext, kind }),
  });
  if (!signRes.ok) {
    const err = await signRes.json().catch(() => ({}));
    throw new Error(err.error ?? 'Could not get upload permission');
  }
  const { path, token, publicUrl } = await signRes.json();
  const { error } = await supabase.storage
    .from('assets')
    .uploadToSignedUrl(path, token, file, { contentType: file.type || undefined });
  if (error) throw new Error(error.message);
  return publicUrl as string;
}

// ── Shared bits of chrome ────────────────────────────────────────────────────

const CARD = 'rounded-card border border-hairline bg-surface shadow-card';
const KICKER = 'text-[11.5px] font-bold uppercase tracking-[.09em] text-muted';
const BTN_DARK =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-ink px-[18px] py-2.5 ' +
  'text-[13.5px] font-semibold text-white disabled:opacity-50';
const BTN_GHOST =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-[rgba(23,21,26,.14)] ' +
  'px-[17px] py-[9px] text-[13.5px] font-semibold text-text';
const GRID =
  'grid gap-[13px] grid-cols-[repeat(auto-fill,minmax(158px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(178px,1fr))]';
const THUMB =
  'flex aspect-[4/3] items-center justify-center bg-[linear-gradient(150deg,#f4f1ee,#e7e2dd)] ' +
  'text-[11.5px] font-semibold uppercase tracking-[.08em] text-faint';

export default function AssetsScreen({ profileId, catalogue }: {
  profileId: string;
  /**
   * Whether the catalogue mode renders at all. Leave it undefined and the
   * screen derives it from the profile's own catalogue rows — a profile that
   * does not sell products never sees the toggle.
   */
  catalogue?: boolean;
}) {
  const { role } = useApp();
  const { data } = useClient(profileId);

  const catalogueOn = catalogue ?? hasCatalogue(data.catalogueCategories, data.catalogueItems);
  const [wantedMode, setWantedMode] = useState('sets');
  const mode = resolveMode(catalogueOn, wantedMode);
  const modes = assetModes(catalogueOn);

  return (
    <div className="flex flex-col gap-3.5">
      {modes.length > 1 && (
        <div className="self-start">
          <Segmented
            segments={modes.map(m => ({ id: m.id, label: m.label }))}
            active={mode}
            onSelect={setWantedMode}
          />
        </div>
      )}
      {mode === 'catalogue'
        ? <div className="-mx-4 md:-mx-7"><CatalogueView clientId={profileId} /></div>
        : <SetsMode profileId={profileId} isOwner={role === 'owner'} />}
    </div>
  );
}

// ── Sets ─────────────────────────────────────────────────────────────────────

function SetsMode({ profileId, isOwner }: { profileId: string; isOwner: boolean }) {
  const { dispatch } = useApp();
  const { data } = useClient(profileId);

  const sets = data.assetSets ?? [];
  const items = data.assetItems ?? [];
  const driveUrl = (data.driveFolderUrl ?? '').trim();

  const [openSetId, setOpenSetId] = useState<string | null>(null);
  const [addingSet, setAddingSet] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [editingDrive, setEditingDrive] = useState(false);
  const [driveDraft, setDriveDraft] = useState('');

  const openSet = sets.find(s => s.id === openSetId) ?? null;
  if (openSet) {
    return (
      <SetDetail
        profileId={profileId}
        set={openSet}
        isOwner={isOwner}
        onBack={() => setOpenSetId(null)}
      />
    );
  }

  function addSet() {
    const name = newSetName.trim();
    if (!name) return;
    const set: AssetSet = { id: generateId(), name, createdAt: new Date().toISOString() };
    dispatch({ type: 'ADD_ASSET_SET', payload: { clientId: profileId, set } });
    setNewSetName('');
    setAddingSet(false);
    setOpenSetId(set.id);
  }

  function saveDrive() {
    dispatch({ type: 'SET_DRIVE_FOLDER', payload: { clientId: profileId, url: driveDraft.trim() } });
    setEditingDrive(false);
  }

  const tiles = assetTiles(sets, items);
  const drive = driveTile(driveUrl);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13.5px] text-muted">{assetsLine(sets, items, driveUrl)}</p>
        <div className="flex flex-wrap items-center gap-2">
          {!addingSet && (
            <button type="button" onClick={() => setAddingSet(true)} className={BTN_DARK}>
              <Plus size={15} strokeWidth={2.2} />
              New set
            </button>
          )}
          {isOwner && !editingDrive && (
            <button
              type="button"
              onClick={() => { setDriveDraft(driveUrl); setEditingDrive(true); }}
              className={BTN_GHOST}
            >
              <Pencil size={14} strokeWidth={2} />
              {drive ? 'Change the Drive folder' : 'Link a Drive folder'}
            </button>
          )}
        </div>
      </div>

      {addingSet && (
        <div className={`${CARD} flex flex-wrap items-center gap-2 p-3.5`}>
          <input
            autoFocus
            value={newSetName}
            onChange={e => setNewSetName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') addSet();
              if (e.key === 'Escape') { setAddingSet(false); setNewSetName(''); }
            }}
            placeholder="Name it. August shoot, product flatlays..."
            className="min-w-[12rem] flex-1 rounded-xl border border-hairline bg-paper px-3.5 py-2.5 text-sm text-text outline-none focus:border-accent"
          />
          <button type="button" onClick={addSet} disabled={!newSetName.trim()} className={BTN_DARK}>Add</button>
          <button
            type="button"
            onClick={() => { setAddingSet(false); setNewSetName(''); }}
            className={BTN_GHOST}
          >
            Cancel
          </button>
        </div>
      )}

      {editingDrive && (
        <div className={`${CARD} flex flex-wrap items-center gap-2 p-3.5`}>
          <input
            autoFocus
            value={driveDraft}
            onChange={e => setDriveDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveDrive(); if (e.key === 'Escape') setEditingDrive(false); }}
            placeholder="Paste the Drive folder link"
            className="min-w-[12rem] flex-1 rounded-xl border border-hairline bg-paper px-3.5 py-2.5 text-sm text-text outline-none focus:border-accent"
          />
          <button type="button" onClick={saveDrive} className={BTN_DARK}>
            <Check size={15} strokeWidth={2.2} />
            Save
          </button>
          <button type="button" onClick={() => setEditingDrive(false)} className={BTN_GHOST}>Cancel</button>
        </div>
      )}

      {tiles.length === 0 && !drive ? (
        <div className={`${CARD} px-[18px] py-4 text-sm text-muted`}>
          No sets yet. Make one, then drop photos in whenever you have them.
        </div>
      ) : (
        <div className={GRID}>
          {drive && (
            <a
              href={drive.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${CARD} block overflow-hidden`}
            >
              <div className={THUMB}>
                <span className="flex flex-col items-center gap-1.5 text-faint">
                  <Video size={22} strokeWidth={1.9} />
                  {drive.kind}
                </span>
              </div>
              <div className="px-3.5 py-3">
                <div className="flex items-center gap-1.5 text-[14.5px] font-semibold text-text">
                  {drive.name}
                  <ExternalLink size={13} strokeWidth={2} className="text-faint" />
                </div>
                <div className="mt-[3px] text-xs text-faint">{drive.meta}</div>
              </div>
            </a>
          )}

          {tiles.map(tile => (
            <button
              key={tile.id}
              type="button"
              onClick={() => setOpenSetId(tile.id)}
              className={`${CARD} block overflow-hidden text-left`}
            >
              <div className={`relative ${THUMB}`}>
                {tile.previewUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={tile.previewUrl}
                      alt={tile.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute left-2 top-2 rounded-md bg-white/90 px-2 py-[3px] text-[10.5px] font-bold uppercase tracking-[.08em] text-muted">
                      {tile.kind}
                    </span>
                  </>
                ) : tile.kind}
              </div>
              <div className="px-3.5 py-3">
                <div className="text-[14.5px] font-semibold leading-snug text-text">{tile.name}</div>
                <div className="mt-[3px] text-xs text-faint">{tile.meta}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── One set ──────────────────────────────────────────────────────────────────

function SetDetail({ profileId, set, isOwner, onBack }: {
  profileId: string;
  set: AssetSet;
  isOwner: boolean;
  onBack: () => void;
}) {
  const { dispatch, role } = useApp();
  const { data } = useClient(profileId);
  const items = itemsInSet(data.assetItems ?? [], set.id);

  const [lightbox, setLightbox] = useState<AssetItem | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [uploadError, setUploadError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  async function uploadFiles(files: File[]) {
    if (files.length === 0) return;
    setUploadError('');
    setProgress({ done: 0, total: files.length });
    let failed = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
        const url = await directUpload(file, ext, 'orig');
        let thumbUrl = url;
        const thumb = await makeThumb(file);
        if (thumb) {
          try { thumbUrl = await directUpload(thumb, 'webp', 'thumb'); } catch { /* the original serves as the thumb */ }
        }
        const item: AssetItem = {
          id: generateId(),
          setId: set.id,
          url,
          thumbUrl,
          fileName: file.name,
          size: file.size,
          uploadedBy: role ?? 'owner',
          createdAt: new Date().toISOString(),
        };
        dispatch({ type: 'ADD_ASSET_ITEM', payload: { clientId: profileId, item } });
      } catch (err) {
        failed++;
        setUploadError(err instanceof Error ? err.message : 'That upload did not go through');
      }
      setProgress({ done: i + 1, total: files.length });
    }
    setProgress(null);
    if (failed > 0) {
      setUploadError(prev => prev || `${failed} photo${failed === 1 ? '' : 's'} did not go up`);
    }
  }

  async function downloadOriginal(item: AssetItem) {
    try {
      const res = await fetch(item.url);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = item.fileName || 'photo.jpg';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(item.url, '_blank');
    }
  }

  function deleteItem(itemId: string) {
    dispatch({ type: 'DELETE_ASSET_ITEM', payload: { clientId: profileId, itemId } });
    if (lightbox?.id === itemId) setLightbox(null);
  }

  function deleteSet() {
    if (!confirm(`Delete "${set.name}" and its ${items.length} photo${items.length === 1 ? '' : 's'}?`)) return;
    dispatch({ type: 'DELETE_ASSET_SET', payload: { clientId: profileId, setId: set.id } });
    onBack();
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-hairline bg-surface p-2 text-muted"
          aria-label="Back to the sets"
        >
          <ChevronLeft size={18} strokeWidth={2} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[17px] font-semibold text-text">{set.name}</h3>
            <span className={KICKER}>{setKind(items)}</span>
          </div>
          <p className="mt-0.5 text-xs text-faint">{setLine(items)}</p>
        </div>
        <div className="flex items-center gap-2">
          {progress && (
            <span className="text-xs text-faint">
              Sending {progress.done} of {progress.total}
            </span>
          )}
          {/* Give-point 2: the client uploads here too. Never owner-gated. */}
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={!!progress}
            className={BTN_DARK}
          >
            <Upload size={15} strokeWidth={2} />
            Add photos
          </button>
          {isOwner && (
            <button
              type="button"
              onClick={deleteSet}
              className="rounded-xl border border-hairline bg-surface p-2 text-faint hover:text-overdue"
              aria-label="Delete this set"
            >
              <Trash2 size={16} strokeWidth={2} />
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept={`${IMAGE_TYPES.join(',')},image/*`}
            multiple
            className="hidden"
            onChange={e => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) uploadFiles(files);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {uploadError && (
        <div className="rounded-2xl border border-[rgba(234,71,17,.3)] bg-surface px-[18px] py-3 text-sm text-overdue">
          {uploadError}
        </div>
      )}

      {items.length === 0 ? (
        <div className={`${CARD} px-[18px] py-4 text-sm text-muted`}>
          {setLine(items)} Add photos and the originals stay exactly as they arrived.
        </div>
      ) : (
        <div className={GRID}>
          {items.map(item => (
            <div key={item.id} className="group relative overflow-hidden rounded-[14px] bg-control">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.thumbUrl || item.url}
                alt={item.fileName}
                loading="lazy"
                className="aspect-square w-full cursor-pointer object-cover"
                onClick={() => setLightbox(item)}
              />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/55 to-transparent p-2.5 opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100">
                <button
                  type="button"
                  onClick={() => downloadOriginal(item)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-[11.5px] font-semibold text-text"
                >
                  <Download size={11} strokeWidth={2.2} />
                  Original
                </button>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => deleteItem(item.id)}
                    className="rounded-lg bg-black/30 p-1.5 text-white"
                    aria-label="Delete this photo"
                  >
                    <Trash2 size={13} strokeWidth={2} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="flex shrink-0 items-center justify-between gap-2 p-4">
            <button
              type="button"
              onClick={() => setLightbox(null)}
              className="rounded-xl bg-white/10 p-2.5 text-white"
              aria-label="Close"
            >
              <X size={20} strokeWidth={2} />
            </button>
            <div className="flex items-center gap-2">
              <span className="mr-1 hidden text-xs text-white/40 sm:block">
                {lightbox.fileName} {fileSize(lightbox.size)}
              </span>
              <button
                type="button"
                onClick={() => downloadOriginal(lightbox)}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-text"
              >
                <Download size={15} strokeWidth={2} />
                Download the original
              </button>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => deleteItem(lightbox.id)}
                  className="rounded-xl bg-white/10 p-2.5 text-white"
                  aria-label="Delete this photo"
                >
                  <Trash2 size={18} strokeWidth={2} />
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-1 items-center justify-center p-4" onClick={() => setLightbox(null)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.url}
              alt={lightbox.fileName}
              className="max-h-full max-w-full rounded-xl object-contain"
              onClick={e => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
