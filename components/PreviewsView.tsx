'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Plus, Trash2, Pencil, Copy, Check, ExternalLink, Instagram,
  ChevronLeft, ChevronRight, X, ImagePlus, Layers, Loader2, Play, Download,
} from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import { generateId, generateShareId, isVideoUrl } from '@/lib/utils';
import { PreviewPost, MAX_CAROUSEL_SLIDES } from '@/types';
import Modal from './Modal';
import { supabase } from '@/lib/supabase';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
const MAX_BYTES = 50 * 1024 * 1024; // 50 MB — Supabase Storage limit

// Upload directly from the browser to Supabase Storage, bypassing Vercel's
// 4.5 MB serverless-function body cap that caused larger images to fail.
async function uploadImage(file: File): Promise<string> {
  const isImage = IMAGE_TYPES.has(file.type);
  const isVideo = VIDEO_TYPES.has(file.type);
  if (!isImage && !isVideo) {
    throw new Error('That file type is not supported. Use JPG, PNG, WebP, GIF, or MP4/MOV video.');
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`File is too large (max 50 MB). Yours is ${(file.size / 1024 / 1024).toFixed(1)} MB.`);
  }
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from('post-images')
    .upload(filename, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { data: { publicUrl } } = supabase.storage.from('post-images').getPublicUrl(filename);
  return publicUrl;
}

function shareUrl(shareId: string): string {
  return `${window.location.origin}/p/${shareId}`;
}

export default function PreviewsView({ clientId }: { clientId: string }) {
  const { dispatch, saveNow } = useApp();
  const { data } = useClient(clientId);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<PreviewPost | null>(null);

  const posts = data.previewPosts ?? [];
  const instagram = data.instagram ?? { handle: '', avatarUrl: '' };

  function openNew() {
    setEditingPost(null);
    setEditorOpen(true);
  }

  function openEdit(post: PreviewPost) {
    setEditingPost(post);
    setEditorOpen(true);
  }

  // Persist the post and wait for the server to confirm before returning, so the
  // public /p/[shareId] page (server-rendered) can find it the instant the link
  // is shared. Returns false if the save didn't land.
  async function savePost(post: PreviewPost): Promise<boolean> {
    if (editingPost) {
      dispatch({ type: 'UPDATE_PREVIEW_POST', payload: { clientId, post } });
    } else {
      dispatch({ type: 'ADD_PREVIEW_POST', payload: { clientId, post } });
    }
    const ok = await saveNow();
    if (ok) { setEditorOpen(false); setEditingPost(null); }
    return ok;
  }

  function deletePost(postId: string) {
    dispatch({ type: 'DELETE_PREVIEW_POST', payload: { clientId, postId } });
    void saveNow();
  }

  return (
    <div className="p-4 md:p-8">
      {/* Instagram identity + new post */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <IdentityCard
          handle={instagram.handle}
          avatarUrl={instagram.avatarUrl}
          onSave={(handle, avatarUrl) =>
            dispatch({ type: 'UPDATE_INSTAGRAM', payload: { clientId, instagram: { handle, avatarUrl } } })
          }
        />
        <button onClick={openNew} className="btn-primary flex items-center gap-1.5 ml-auto">
          <Plus size={15} />
          New Post
        </button>
      </div>

      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center mb-4">
            <Instagram size={24} className="text-stone-300" />
          </div>
          <p className="font-medium text-stone-600 mb-1">No previews yet</p>
          <p className="text-sm text-stone-400">Create a post, upload the slides, and share the link with your client.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {posts.map(post => (
            <PostCard key={post.id} post={post} onEdit={() => openEdit(post)} onDelete={() => deletePost(post.id)} />
          ))}
        </div>
      )}

      {editorOpen && (
        <PostEditorModal
          post={editingPost}
          onClose={() => { setEditorOpen(false); setEditingPost(null); }}
          onSave={savePost}
        />
      )}
    </div>
  );
}

// ── Instagram identity (handle + avatar) ─────────────────────────────────────

function IdentityCard({ handle, avatarUrl, onSave }: {
  handle: string;
  avatarUrl: string;
  onSave: (handle: string, avatarUrl: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftHandle, setDraftHandle] = useState(handle);
  const [draftAvatar, setDraftAvatar] = useState(avatarUrl);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function pickAvatar(file: File) {
    setUploading(true);
    try {
      setDraftAvatar(await uploadImage(file));
    } catch {
      alert('Avatar upload failed. Check the storage bucket setup.');
    } finally {
      setUploading(false);
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => { setDraftHandle(handle); setDraftAvatar(avatarUrl); setEditing(true); }}
        className="flex items-center gap-2.5 border border-stone-200 bg-white rounded-lg pl-2 pr-3 py-1.5 hover:border-stone-400 transition-colors"
        title="Edit the Instagram handle and profile picture shown on previews"
      >
        <Avatar url={avatarUrl} size={28} />
        <span className="text-sm text-stone-700">
          {handle ? `@${handle}` : 'Set Instagram handle'}
        </span>
        <Pencil size={12} className="text-stone-400" />
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border border-stone-200 bg-white rounded-lg px-2 py-1.5">
      <button
        onClick={() => fileRef.current?.click()}
        className="relative shrink-0 rounded-full overflow-hidden"
        title="Upload profile picture"
      >
        <Avatar url={draftAvatar} size={28} />
        <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-white">
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />}
        </span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) pickAvatar(f); e.target.value = ''; }}
      />
      <div className="flex items-center gap-1 text-sm text-stone-700">
        <span className="text-stone-400">@</span>
        <input
          autoFocus
          value={draftHandle}
          onChange={e => setDraftHandle(e.target.value.replace(/[@\s]/g, ''))}
          onKeyDown={e => e.key === 'Enter' && (onSave(draftHandle.trim(), draftAvatar), setEditing(false))}
          placeholder="username"
          className="bg-transparent focus:outline-none w-36"
        />
      </div>
      <button
        onClick={() => { onSave(draftHandle.trim(), draftAvatar); setEditing(false); }}
        className="p-1 rounded text-emerald-600 hover:bg-emerald-50 transition-colors"
      >
        <Check size={14} />
      </button>
      <button onClick={() => setEditing(false)} className="p-1 rounded text-stone-400 hover:bg-stone-100 transition-colors">
        <X size={14} />
      </button>
    </div>
  );
}

function Avatar({ url, size }: { url: string; size: number }) {
  if (!url) {
    return (
      <span
        className="rounded-full bg-stone-200 flex items-center justify-center shrink-0"
        style={{ width: size, height: size }}
      >
        <Instagram size={size * 0.5} className="text-stone-400" />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="Profile" className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />;
}

// ── Post card ────────────────────────────────────────────────────────────────

function PostCard({ post, onEdit, onDelete }: {
  post: PreviewPost;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    navigator.clipboard.writeText(shareUrl(post.shareId)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden group hover:shadow-md hover:border-stone-300 transition-all">
      <div className="relative aspect-square bg-stone-100">
        {post.images[0] && (
          isVideoUrl(post.images[0]) ? (
            <video src={post.images[0]} muted playsInline preload="metadata" className="w-full h-full object-cover bg-black" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.images[0]} alt={post.name} className="w-full h-full object-cover" />
          )
        )}
        {post.images.length > 1 ? (
          <span className="absolute top-2 right-2 flex items-center gap-1 bg-black/55 text-white text-[10px] font-medium rounded-full px-2 py-0.5">
            <Layers size={10} />
            {post.images.length}
          </span>
        ) : post.images[0] && isVideoUrl(post.images[0]) ? (
          <span className="absolute top-2 right-2 flex items-center justify-center bg-black/55 text-white rounded-full w-5 h-5">
            <Play size={11} className="fill-white" />
          </span>
        ) : null}
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-stone-900 truncate">{post.name || 'Untitled post'}</p>
        <p className="text-[11px] text-stone-400 mt-0.5">
          {post.postType === 'carousel'
            ? `Carousel · ${post.images.length} slides`
            : post.images[0] && isVideoUrl(post.images[0]) ? 'Video' : 'Static post'}
        </p>
        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-stone-50">
          <button
            onClick={copyLink}
            className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border transition-colors ${
              copied
                ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                : 'border-stone-200 text-stone-600 hover:border-stone-400'
            }`}
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? 'Copied' : 'Copy link'}
          </button>
          <a
            href={`/p/${post.shareId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 rounded text-stone-400 hover:text-stone-700 transition-colors"
            title="Open preview"
          >
            <ExternalLink size={13} />
          </a>
          <button onClick={onEdit} className="p-1 rounded text-stone-400 hover:text-stone-700 transition-colors" title="Edit">
            <Pencil size={13} />
          </button>
          <button
            onClick={() => { if (confirm('Delete this preview? The share link will stop working.')) onDelete(); }}
            className="p-1 rounded text-stone-400 hover:text-red-500 transition-colors ml-auto"
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Post editor ──────────────────────────────────────────────────────────────

// ── Canva import ─────────────────────────────────────────────────────────────
// Pulls a design's pages straight into the slide list. Shows nothing until the
// integration is set up (env vars present); then a Connect button until the
// owner has authorised, and an Import box after that.

type CanvaStatus = { configured: boolean; connected: boolean };

function CanvaImport({ onImport, disabled }: { onImport: (urls: string[]) => void; disabled: boolean }) {
  const [status, setStatus] = useState<CanvaStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    fetch('/api/canva/status')
      .then(r => (r.ok ? r.json() : null))
      .then(s => { if (alive && s) setStatus(s); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!status?.configured) return null;

  if (!status.connected) {
    return (
      <button
        type="button"
        onClick={() => { window.location.href = `/api/canva/connect?from=${encodeURIComponent(window.location.pathname)}`; }}
        className="mt-2 flex items-center gap-1.5 text-xs text-sky-600 hover:text-sky-800"
      >
        <Download size={13} /> Connect Canva to import slides
      </button>
    );
  }

  async function runImport() {
    if (!link.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/canva/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link: link.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Import failed. Check the link and try again.');
      if (!json.images?.length) throw new Error('That design had no pages to import.');
      onImport(json.images as string[]);
      setLink('');
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="mt-2 flex items-center gap-1.5 text-xs text-sky-600 hover:text-sky-800 disabled:opacity-40"
      >
        <Download size={13} /> Import slides from Canva
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-sky-200 bg-sky-50/50 p-2.5">
      <label className="block text-[11px] font-medium text-stone-500 mb-1.5">Paste a Canva design link</label>
      <div className="flex gap-2">
        <input
          autoFocus
          value={link}
          onChange={e => setLink(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && runImport()}
          placeholder="https://www.canva.com/design/..."
          className="input-base flex-1 text-[13px]"
          inputMode="url"
        />
        <button onClick={runImport} disabled={!link.trim() || busy} className="btn-primary flex items-center gap-1.5 disabled:opacity-40">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          {busy ? 'Importing...' : 'Import'}
        </button>
        <button onClick={() => { setOpen(false); setError(''); }} className="btn-secondary" disabled={busy}>Cancel</button>
      </div>
      {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
      <p className="text-[11px] text-stone-400 mt-1.5">Every page comes in as a slide, in order. Large designs take a few seconds.</p>
    </div>
  );
}

function PostEditorModal({ post, onClose, onSave }: {
  post: PreviewPost | null;
  onClose: () => void;
  onSave: (post: PreviewPost) => Promise<boolean>;
}) {
  const [name, setName] = useState(post?.name ?? '');
  const [caption, setCaption] = useState(post?.caption ?? '');
  const [images, setImages] = useState<string[]>(post?.images ?? []);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const uploading = uploadingCount > 0;

  async function addFiles(files: FileList) {
    setUploadError('');
    const room = MAX_CAROUSEL_SLIDES - images.length;
    const list = Array.from(files).slice(0, room);
    if (files.length > room) setUploadError(`A carousel holds at most ${MAX_CAROUSEL_SLIDES} slides.`);
    setUploadingCount(c => c + list.length);
    // Sequential so the slide order matches the order the files were picked in.
    for (const file of list) {
      try {
        const url = await uploadImage(file);
        setImages(prev => prev.length < MAX_CAROUSEL_SLIDES ? [...prev, url] : prev);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploadingCount(c => c - 1);
      }
    }
  }

  function move(index: number, dir: -1 | 1) {
    setImages(prev => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeAt(index: number) {
    setImages(prev => prev.filter((_, i) => i !== index));
  }

  // Append already-hosted slide URLs (e.g. imported from Canva), capped at the
  // carousel limit and in the order returned.
  function addImageUrls(urls: string[]) {
    setImages(prev => [...prev, ...urls].slice(0, MAX_CAROUSEL_SLIDES));
  }

  async function save() {
    if (images.length === 0 || saving) return;
    setSaveError('');
    setSaving(true);
    const now = new Date().toISOString();
    const ok = await onSave({
      id: post?.id ?? generateId(),
      shareId: post?.shareId ?? generateShareId(),
      name: name.trim(),
      postType: images.length > 1 ? 'carousel' : 'static',
      images,
      caption,
      createdAt: post?.createdAt ?? now,
      updatedAt: now,
    });
    setSaving(false);
    if (!ok) setSaveError('Could not save to the server. Check your connection and try again.');
  }

  return (
    <Modal open onClose={onClose} title={post ? 'Edit Preview' : 'New Preview'} size="lg">
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Post name (only you see this)</label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. July launch carousel"
            className="input-base w-full"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-stone-500">
              Slides ({images.length}/{MAX_CAROUSEL_SLIDES}) · first slide is the cover
            </label>
            {images.length > 0 && (
              <span className="text-[11px] text-stone-400">
                {images.length > 1 ? 'Carousel' : isVideoUrl(images[0]) ? 'Video' : 'Static post'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {images.map((url, i) => (
              <div key={`${url}-${i}`} className="relative aspect-square rounded-lg overflow-hidden border border-stone-200 group">
                {isVideoUrl(url) ? (
                  <video src={url} muted playsInline preload="metadata" className="w-full h-full object-cover bg-black" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={`Slide ${i + 1}`} className="w-full h-full object-cover" />
                )}
                <span className="absolute top-1 left-1 bg-black/55 text-white text-[10px] rounded-full w-4.5 h-4.5 min-w-[18px] min-h-[18px] flex items-center justify-center px-1">
                  {i + 1}
                </span>
                {isVideoUrl(url) && (
                  <span className="absolute top-1 right-1 flex items-center justify-center bg-black/55 text-white rounded-full w-4 h-4">
                    <Play size={9} className="fill-white" />
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-black/45 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="p-0.5 text-white disabled:opacity-30">
                    <ChevronLeft size={13} />
                  </button>
                  <button onClick={() => removeAt(i)} className="p-0.5 text-white hover:text-red-300">
                    <Trash2 size={12} />
                  </button>
                  <button onClick={() => move(i, 1)} disabled={i === images.length - 1} className="p-0.5 text-white disabled:opacity-30">
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            ))}

            {images.length < MAX_CAROUSEL_SLIDES && (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="aspect-square rounded-lg border-2 border-dashed border-stone-300 flex flex-col items-center justify-center gap-1 text-stone-400 hover:border-stone-400 hover:text-stone-600 transition-colors disabled:opacity-60"
              >
                {uploading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
                <span className="text-[10px]">{uploading ? 'Uploading...' : 'Add slides'}</span>
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
            multiple
            className="hidden"
            onChange={e => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }}
          />
          {uploadError && <p className="text-xs text-red-500 mt-1.5">{uploadError}</p>}

          <CanvaImport
            disabled={uploading || images.length >= MAX_CAROUSEL_SLIDES}
            onImport={addImageUrls}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Caption</label>
          <textarea
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="Write the caption exactly as it will be posted..."
            rows={4}
            className="input-base w-full resize-none"
          />
        </div>

        {saveError && <p className="text-xs text-red-500">{saveError}</p>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary" disabled={saving}>Cancel</button>
          <button onClick={save} disabled={images.length === 0 || uploading || saving} className="btn-primary flex items-center gap-1.5">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Saving...' : post ? 'Save changes' : 'Create preview'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
