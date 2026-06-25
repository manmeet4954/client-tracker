'use client';

import { useState, useRef } from 'react';
import { ChevronLeft, Plus, Share2, Trash2, X, Upload, LayoutGrid } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import { generateId } from '@/lib/utils';
import { CatalogueCategory, CatalogueItem } from '@/types';

export default function CatalogueView({ clientId }: { clientId: string }) {
  const { dispatch } = useApp();
  const { data } = useClient(clientId);
  const [activeCategory, setActiveCategory] = useState<CatalogueCategory | null>(null);
  const [lightboxItem, setLightboxItem] = useState<CatalogueItem | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = data.catalogueCategories ?? [];
  const allItems = data.catalogueItems ?? [];

  function addCategory() {
    if (!newCatName.trim()) return;
    dispatch({
      type: 'ADD_CATALOGUE_CATEGORY',
      payload: {
        clientId,
        category: { id: generateId(), name: newCatName.trim(), createdAt: new Date().toISOString() },
      },
    });
    setNewCatName('');
    setAddingCategory(false);
  }

  function deleteCategory(categoryId: string) {
    if (!confirm('Delete this category and all its photos?')) return;
    dispatch({ type: 'DELETE_CATALOGUE_CATEGORY', payload: { clientId, categoryId } });
    if (activeCategory?.id === categoryId) setActiveCategory(null);
  }

  function deleteItem(itemId: string) {
    dispatch({ type: 'DELETE_CATALOGUE_ITEM', payload: { clientId, itemId } });
    if (lightboxItem?.id === itemId) setLightboxItem(null);
  }

  async function uploadImage(file: File) {
    if (!activeCategory) return;
    setUploading(true);
    setUploadError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Upload failed');
      }
      const { url } = await res.json();
      const item: CatalogueItem = {
        id: generateId(),
        categoryId: activeCategory.id,
        imageUrl: url,
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: 'ADD_CATALOGUE_ITEM', payload: { clientId, item } });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Check Supabase storage setup.');
    } finally {
      setUploading(false);
    }
  }

  function shareImage(imageUrl: string) {
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ url: imageUrl }).catch(() => {});
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(imageUrl)}`, '_blank');
  }

  const categoryItems = activeCategory
    ? allItems.filter(i => i.categoryId === activeCategory.id)
    : [];

  // ── Category grid ──────────────────────────────────────────────────────────
  if (!activeCategory) {
    return (
      <div className="p-4 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-stone-900">Catalogue</h2>
            <p className="text-sm text-stone-500 mt-0.5">Tap a category to view &amp; add photos</p>
          </div>
          <button
            onClick={() => setAddingCategory(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-[#1f1f1f] text-white rounded-lg hover:bg-[#333] transition-colors"
          >
            <Plus size={14} />
            Add Category
          </button>
        </div>

        {addingCategory && (
          <div className="mb-6 bg-white border border-stone-200 rounded-xl p-4">
            <p className="text-sm font-medium text-stone-700 mb-3">New category name</p>
            <div className="flex gap-2">
              <input
                autoFocus
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') addCategory();
                  if (e.key === 'Escape') { setAddingCategory(false); setNewCatName(''); }
                }}
                placeholder="e.g. Bags, Flowers..."
                className="input-base flex-1"
              />
              <button onClick={addCategory} disabled={!newCatName.trim()} className="btn-primary">Add</button>
              <button onClick={() => { setAddingCategory(false); setNewCatName(''); }} className="btn-secondary">Cancel</button>
            </div>
          </div>
        )}

        {categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mb-4">
              <LayoutGrid size={28} className="text-stone-300" />
            </div>
            <p className="font-medium text-stone-600 mb-1">No categories yet</p>
            <p className="text-sm text-stone-400">Add a category to start building your catalogue.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {categories.map(cat => {
              const catItems = allItems.filter(i => i.categoryId === cat.id);
              const preview = catItems[0]?.imageUrl;
              return (
                <div
                  key={cat.id}
                  className="group relative bg-white border border-stone-200 rounded-2xl overflow-hidden cursor-pointer hover:shadow-lg hover:border-stone-300 transition-all active:scale-95"
                  onClick={() => setActiveCategory(cat)}
                >
                  <div className="aspect-square bg-stone-100 overflow-hidden">
                    {preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={preview} alt={cat.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <LayoutGrid size={32} className="text-stone-300" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-semibold text-stone-900 text-sm leading-snug">{cat.name}</p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {catItems.length} {catItems.length === 1 ? 'photo' : 'photos'}
                    </p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); deleteCategory(cat.id); }}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/90 backdrop-blur-sm text-stone-400 hover:text-red-500 hover:bg-white opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Category items view ────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setActiveCategory(null); setUploadError(''); }}
            className="p-2 rounded-xl bg-white border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <h2 className="text-lg font-bold text-stone-900">{activeCategory.name}</h2>
            <p className="text-xs text-stone-400">
              {categoryItems.length} {categoryItems.length === 1 ? 'photo' : 'photos'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {uploading && <span className="text-xs text-stone-400 animate-pulse">Uploading...</span>}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-[#1f1f1f] text-white rounded-lg hover:bg-[#333] disabled:opacity-50 transition-colors"
          >
            <Upload size={14} />
            Add Photo
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) uploadImage(file);
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

      {categoryItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mb-4">
            <Upload size={28} className="text-stone-300" />
          </div>
          <p className="font-medium text-stone-600 mb-1">No photos yet</p>
          <p className="text-sm text-stone-400">Tap &ldquo;Add Photo&rdquo; to start adding product images.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {categoryItems.map(item => (
            <div key={item.id} className="group relative rounded-2xl overflow-hidden bg-stone-100 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt="Product"
                className="w-full aspect-square object-cover cursor-pointer"
                onClick={() => setLightboxItem(item)}
              />
              <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between p-2.5 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity">
                <button
                  onClick={() => shareImage(item.imageUrl)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] text-white text-xs rounded-lg font-semibold shadow-sm"
                >
                  <Share2 size={11} />
                  WhatsApp
                </button>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="p-1.5 bg-black/30 backdrop-blur-sm text-white rounded-lg hover:bg-red-500 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
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
              <button
                onClick={() => shareImage(lightboxItem.imageUrl)}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#25D366] text-white text-sm rounded-xl font-semibold shadow-lg"
              >
                <Share2 size={15} />
                Share on WhatsApp
              </button>
              <button
                onClick={() => deleteItem(lightboxItem.id)}
                className="p-2.5 rounded-xl bg-white/10 text-white hover:bg-red-500/80 transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
          <div
            className="flex-1 flex items-center justify-center p-4"
            onClick={() => setLightboxItem(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxItem.imageUrl}
              alt="Product"
              className="max-w-full max-h-full object-contain rounded-xl"
              onClick={e => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
