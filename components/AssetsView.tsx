'use client';

import { useState, useRef } from 'react';
import {
  ChevronLeft, Plus, Trash2, X, Upload, FolderOpen, Download,
  Video, ExternalLink, Pencil, Check, Images,
} from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { generateId } from '@/lib/utils';
import { AssetSet, AssetItem } from '@/types';

// Videos never live in the dashboard — they live in the client's Drive folder.
// These fallbacks wire known folders in until the owner sets one in the UI.
const DRIVE_FALLBACKS: { match: RegExp; url: string }[] = [
  { match: /divine/i, url: 'https://drive.google.com/drive/folders/1nguAZ1TkNxpBn3wiCUPYRHtLHXThFvIK' },
];

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
const THUMB_MAX = 600; // px, longest edge

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

/** Ask the server for permission, then send the file STRAIGHT to storage —
 *  skipping Vercel's request-size wall, originals untouched. */
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

function formatSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AssetsView({ clientId }: { clientId: string }) {
  const { dispatch, role } = useApp();
  const { client, data } = useClient(clientId);
  const isOwner = role === 'owner';

  const sets = data.assetSets ?? [];
  const allItems = data.assetItems ?? [];

  const [activeSet, setActiveSet] = useState<AssetSet | null>(null);
  const [lightboxItem, setLightboxItem] = useState<AssetItem | null>(null);
  const [addingSet, setAddingSet] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [editingDrive, setEditingDrive] = useState(false);
  const [driveDraft, setDriveDraft] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const driveFallback = DRIVE_FALLBACKS.find(f => f.match.test(client?.name ?? ''))?.url ?? '';
  const driveUrl = data.driveFolderUrl || driveFallback;

  function addSet() {
    const name = newSetName.trim();
    if (!name) return;
    const set: AssetSet = { id: generateId(), name, createdAt: new Date().toISOString() };
    dispatch({ type: 'ADD_ASSET_SET', payload: { clientId, set } });
    setNewSetName('');
    setAddingSet(false);
    setActiveSet(set);
  }

  function deleteSet(setId: string) {
    if (!confirm('Delete this set and all its photos?')) return;
    dispatch({ type: 'DELETE_ASSET_SET', payload: { clientId, setId } });
    if (activeSet?.id === setId) setActiveSet(null);
  }

  function deleteItem(itemId: string) {
    dispatch({ type: 'DELETE_ASSET_ITEM', payload: { clientId, itemId } });
    if (lightboxItem?.id === itemId) setLightboxItem(null);
  }

  function saveDrive() {
    dispatch({ type: 'SET_DRIVE_FOLDER', payload: { clientId, url: driveDraft.trim() } });
    setEditingDrive(false);
  }

  async function uploadFiles(files: File[]) {
    if (!activeSet || files.length === 0) return;
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
          try { thumbUrl = await directUpload(thumb, 'webp', 'thumb'); } catch { /* original serves as thumb */ }
        }
        const item: AssetItem = {
          id: generateId(),
          setId: activeSet.id,
          url,
          thumbUrl,
          fileName: file.name,
          size: file.size,
          uploadedBy: role ?? 'owner',
          createdAt: new Date().toISOString(),
        };
        dispatch({ type: 'ADD_ASSET_ITEM', payload: { clientId, item } });
      } catch (err) {
        failed++;
        setUploadError(err instanceof Error ? err.message : 'Upload failed');
      }
      setProgress({ done: i + 1, total: files.length });
    }
    setProgress(null);
    if (failed > 0) setUploadError(prev => prev || `${failed} photo${failed > 1 ? 's' : ''} failed to upload`);
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

  const setItems = activeSet ? allItems.filter(i => i.setId === activeSet.id) : [];

  // ── Set detail view ─────────────────────────────────────────────────────────
  if (activeSet) {
    return (
      <div className="p-4 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setActiveSet(null); setUploadError(''); }}
              className="p-2 rounded-xl bg-white border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <div>
              <h2 className="text-lg font-bold text-stone-900">{activeSet.name}</h2>
              <p className="text-xs text-stone-400">
                {setItems.length} {setItems.length === 1 ? 'photo' : 'photos'} · originals kept full quality
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {progress && (
              <span className="text-xs text-stone-400 animate-pulse">
                Uploading {progress.done} of {progress.total}...
              </span>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={!!progress}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-[#1f1f1f] text-white rounded-lg hover:bg-[#333] disabled:opacity-50 transition-colors"
            >
              <Upload size={14} />
              Add Photos
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept={IMAGE_TYPES.join(',') + ',image/*'}
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
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            {uploadError}
          </div>
        )}

        {setItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mb-4">
              <Upload size={28} className="text-stone-300" />
            </div>
            <p className="font-medium text-stone-600 mb-1">No photos yet</p>
            <p className="text-sm text-stone-400">Tap &ldquo;Add Photos&rdquo; to drop them in from your gallery.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {setItems.map(item => (
              <div key={item.id} className="group relative rounded-2xl overflow-hidden bg-stone-100 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.thumbUrl || item.url}
                  alt={item.fileName}
                  loading="lazy"
                  className="w-full aspect-square object-cover cursor-pointer"
                  onClick={() => setLightboxItem(item)}
                />
                <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between p-2.5 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity">
                  <button
                    onClick={() => downloadOriginal(item)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/90 text-stone-800 text-xs rounded-lg font-semibold shadow-sm"
                  >
                    <Download size={11} />
                    Original
                  </button>
                  {isOwner && (
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="p-1.5 bg-black/30 backdrop-blur-sm text-white rounded-lg hover:bg-red-500 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Lightbox */}
        {lightboxItem && (
          <div className="fixed inset-0 z-50 bg-black flex flex-col">
            <div className="flex items-center justify-between p-4 shrink-0">
              <button
                onClick={() => setLightboxItem(null)}
                className="p-2.5 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                <X size={20} />
              </button>
              <div className="flex items-center gap-2">
                <span className="text-white/40 text-xs mr-1 hidden sm:block">
                  {lightboxItem.fileName} {formatSize(lightboxItem.size)}
                </span>
                <button
                  onClick={() => downloadOriginal(lightboxItem)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white text-stone-900 text-sm rounded-xl font-semibold shadow-lg"
                >
                  <Download size={15} />
                  Download original
                </button>
                {isOwner && (
                  <button
                    onClick={() => deleteItem(lightboxItem.id)}
                    className="p-2.5 rounded-xl bg-white/10 text-white hover:bg-red-500/80 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>
            <div
              className="flex-1 flex items-center justify-center p-4"
              onClick={() => setLightboxItem(null)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxItem.url}
                alt={lightboxItem.fileName}
                className="max-w-full max-h-full object-contain rounded-xl"
                onClick={e => e.stopPropagation()}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Sets overview ───────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-stone-900">Assets</h2>
          <p className="text-sm text-stone-500 mt-0.5">Photos live here. Videos live in Drive.</p>
        </div>
        <button
          onClick={() => setAddingSet(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-[#1f1f1f] text-white rounded-lg hover:bg-[#333] transition-colors"
        >
          <Plus size={14} />
          New Set
        </button>
      </div>

      {/* ── Videos tile: the door to Drive ── */}
      <div className="mb-6 bg-white border border-stone-200 rounded-2xl p-4 flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-stone-100 flex items-center justify-center shrink-0">
          <Video size={20} className="text-stone-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-stone-900 text-sm">Videos</p>
          <p className="text-xs text-stone-400 mt-0.5 truncate">
            {driveUrl ? 'Stored in the shared Google Drive folder' : 'No video folder linked yet'}
          </p>
        </div>
        {editingDrive ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={driveDraft}
              onChange={e => setDriveDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveDrive(); if (e.key === 'Escape') setEditingDrive(false); }}
              placeholder="Paste Drive folder link..."
              className="w-48 md:w-72 text-xs border border-stone-300 rounded-lg px-2.5 py-2 focus:outline-none focus:border-stone-500"
            />
            <button onClick={saveDrive} className="p-2 text-emerald-500 hover:text-emerald-600">
              <Check size={15} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 shrink-0">
            {driveUrl && (
              <a
                href={driveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 text-sm bg-[#1f1f1f] text-white rounded-lg hover:bg-[#333] transition-colors"
              >
                <ExternalLink size={13} />
                Open Drive
              </a>
            )}
            {isOwner && (
              <button
                onClick={() => { setDriveDraft(data.driveFolderUrl || driveFallback); setEditingDrive(true); }}
                className="p-2 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-50 transition-colors"
                title="Set Drive folder link"
              >
                <Pencil size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {addingSet && (
        <div className="mb-6 bg-white border border-stone-200 rounded-xl p-4">
          <p className="text-sm font-medium text-stone-700 mb-3">New set name</p>
          <div className="flex gap-2">
            <input
              autoFocus
              value={newSetName}
              onChange={e => setNewSetName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') addSet();
                if (e.key === 'Escape') { setAddingSet(false); setNewSetName(''); }
              }}
              placeholder="e.g. March shoot, Products..."
              className="input-base flex-1"
            />
            <button onClick={addSet} disabled={!newSetName.trim()} className="btn-primary">Add</button>
            <button onClick={() => { setAddingSet(false); setNewSetName(''); }} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {sets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mb-4">
            <Images size={28} className="text-stone-300" />
          </div>
          <p className="font-medium text-stone-600 mb-1">No sets yet</p>
          <p className="text-sm text-stone-400 max-w-xs">
            Create a set like &ldquo;March shoot&rdquo; and drop photos in whenever you have them.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sets.map(set => {
            const items = allItems.filter(i => i.setId === set.id);
            const preview = items[0]?.thumbUrl || items[0]?.url;
            return (
              <div
                key={set.id}
                className="group relative bg-white border border-stone-200 rounded-2xl overflow-hidden cursor-pointer hover:shadow-lg hover:border-stone-300 transition-all active:scale-95"
                onClick={() => setActiveSet(set)}
              >
                <div className="aspect-square bg-stone-100 overflow-hidden">
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt={set.name} loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FolderOpen size={32} className="text-stone-300" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-semibold text-stone-900 text-sm leading-snug">{set.name}</p>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {items.length} {items.length === 1 ? 'photo' : 'photos'}
                  </p>
                </div>
                {isOwner && (
                  <button
                    onClick={e => { e.stopPropagation(); deleteSet(set.id); }}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/90 backdrop-blur-sm text-stone-400 hover:text-red-500 hover:bg-white opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
