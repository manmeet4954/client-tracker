'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Type, Square, Circle, Image as ImageIcon, Download, Trash2,
  Copy, ChevronUp, ChevronDown, Save, FolderOpen, X, Plus,
  AlignLeft, AlignCenter, AlignRight, RotateCcw, Search,
} from 'lucide-react';
import * as LucideAll from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import { generateId } from '@/lib/utils';
import { StudioLayer, StudioComposition, LType, BrandKit } from '@/types';

// ── Constants ──────────────────────────────────────────────────────────────

const BG_DARK = '#0d0d0d';
const INK     = '#f7f7f5';

const ASPECTS = [
  { key: '1:1',  label: '1:1',  w: 1080, h: 1080 },
  { key: '4:5',  label: '4:5',  w: 1080, h: 1350 },
  { key: '16:9', label: '16:9', w: 1080, h: 608  },
  { key: '9:16', label: '9:16', w: 608,  h: 1080 },
] as const;
type Aspect = typeof ASPECTS[number];

const PREVIEW_MAX = 420;

const BG_PRESETS = ['dark', 'glow', 'grid', 'gradient', 'light'];

function bgCss(preset: string, accent: string): React.CSSProperties {
  switch (preset) {
    case 'glow':     return { background: BG_DARK, backgroundImage: `radial-gradient(55% 60% at 80% 15%,${accent}45 0%,transparent 70%)` };
    case 'grid':     return { background: BG_DARK, backgroundImage: 'linear-gradient(rgba(247,247,245,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(247,247,245,0.05) 1px,transparent 1px)', backgroundSize: '54px 54px' };
    case 'gradient': return { background: `linear-gradient(145deg,${BG_DARK} 0%,${accent}30 100%)` };
    case 'light':    return { background: '#f0efed' };
    default:         return { background: BG_DARK };
  }
}

const DEFAULT_FONTS = [
  { label: 'Grotesk', css: "'Space Grotesk', sans-serif" },
  { label: 'Inter',   css: "'Inter', sans-serif" },
  { label: 'Mono',    css: "'JetBrains Mono', monospace" },
  { label: 'Serif',   css: "'Lora', serif" },
];

function toCssFamily(name: string): string {
  const serif = ['Newsreader', 'Lora', 'Merriweather', 'Playfair Display', 'Georgia'];
  const mono  = ['JetBrains Mono', 'Fira Code', 'Source Code Pro', 'Courier'];
  if (serif.some(s => name.includes(s))) return `'${name}', serif`;
  if (mono.some(s => name.includes(s))) return `'${name}', monospace`;
  return `'${name}', sans-serif`;
}

// Curated icon set for the picker
const ICON_NAMES = [
  'Star','Heart','Zap','Check','CheckCircle','X','Plus','Minus','ArrowRight','ArrowLeft','ArrowUp','ArrowDown',
  'ChevronRight','ChevronUp','Target','Lightbulb','Flame','Trophy','Medal','Award','TrendingUp','BarChart2',
  'Users','User','UserCheck','MessageCircle','MessageSquare','Mail','Calendar','Clock','Bell','BellRing',
  'Bookmark','Flag','Tag','Hash','AtSign','Link','Globe','Camera','Video','Play','Pause','Smartphone',
  'Laptop','Monitor','Pencil','Pen','PenTool','Edit3','Layers','Grid','Lock','Shield','ShieldCheck',
  'Rocket','Compass','Map','Sun','Moon','Sparkles','Wand2','Coffee','Briefcase','Building2','Package',
  'Gift','ShoppingBag','DollarSign','CreditCard','Headphones','Music','Mic','BookOpen','GraduationCap',
  'FileText','Send','Share2','Download','Upload','Eye','EyeOff','Search','Settings','Code','Database',
  'Handshake','ThumbsUp','ThumbsDown','Smile','Instagram','Youtube','Linkedin','Twitter','Github',
  'Figma','Notion','Chrome','Dribbble',
];

function LIcon({ name, size, color }: { name: string; size?: number; color?: string }) {
  const Comp = (LucideAll as Record<string, any>)[name];
  return Comp ? <Comp size={size} color={color} /> : null;
}

// ── Layer helpers ──────────────────────────────────────────────────────────

function uid() { return generateId(); }

function defaultLayer(type: LType, accent: string, dims: Aspect): Omit<StudioLayer, 'id'> {
  const cx = Math.round(dims.w / 2);
  const cy = Math.round(dims.h / 2);
  switch (type) {
    case 'text':  return { type, x: cx - 200, y: cy - 50, w: 400, h: 100, rot: 0, opacity: 1, text: 'Your text here', font: DEFAULT_FONTS[0].css, size: 80, weight: 700, align: 'left', color: INK };
    case 'icon':  return { type, x: cx - 60,  y: cy - 60, w: 120, h: 120, rot: 0, opacity: 1, icon: 'Star', color: accent, fill: false };
    case 'shape': return { type, x: cx - 80,  y: cy - 80, w: 160, h: 160, rot: 0, opacity: 1, shape: 'rect', color: accent, fill: true };
    case 'image': return { type, x: cx - 160, y: cy - 120, w: 320, h: 240, rot: 0, opacity: 1, src: '', frame: 'none' };
    default:      return { type: 'text', x: cx, y: cy, w: 200, h: 60, rot: 0, opacity: 1 };
  }
}

// ── Element renderer ───────────────────────────────────────────────────────

function ElementBody({ layer, isEditing, onCommitText }: {
  layer: StudioLayer;
  isEditing: boolean;
  onCommitText: (text: string) => void;
}) {
  if (layer.type === 'text') {
    return (
      <div
        contentEditable={isEditing}
        suppressContentEditableWarning
        onBlur={e => { if (isEditing) onCommitText(e.currentTarget.textContent ?? ''); }}
        style={{
          width: '100%', height: '100%',
          fontFamily: layer.font ?? DEFAULT_FONTS[0].css,
          fontSize: layer.size ?? 80,
          fontWeight: layer.weight ?? 700,
          color: layer.color ?? INK,
          textAlign: layer.align ?? 'left',
          lineHeight: 1.1,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          outline: 'none',
          cursor: isEditing ? 'text' : 'inherit',
          userSelect: isEditing ? 'text' : 'none',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {layer.text}
      </div>
    );
  }

  if (layer.type === 'icon') {
    const Comp = (LucideAll as Record<string, any>)[layer.icon ?? 'Star'];
    return Comp ? (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Comp size={Math.min(layer.w, layer.h) * 0.75} color={layer.color ?? INK} strokeWidth={layer.fill ? 0 : 2} fill={layer.fill ? layer.color : 'none'} />
      </div>
    ) : null;
  }

  if (layer.type === 'shape') {
    const c = layer.color ?? INK;
    const fill = layer.fill ?? true;
    if (layer.shape === 'circle') return (
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <circle cx="50" cy="50" r="48" fill={fill ? c : 'none'} stroke={fill ? 'none' : c} strokeWidth="4" />
      </svg>
    );
    if (layer.shape === 'ring') return (
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <circle cx="50" cy="50" r="42" fill="none" stroke={c} strokeWidth="8" />
      </svg>
    );
    if (layer.shape === 'line') return (
      <svg width="100%" height="100%" viewBox="0 0 100 10" preserveAspectRatio="none">
        <line x1="0" y1="5" x2="100" y2="5" stroke={c} strokeWidth="4" strokeLinecap="round" />
      </svg>
    );
    // rect (default)
    return (
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <rect x="1" y="1" width="98" height="98" rx="8" fill={fill ? c : 'none'} stroke={fill ? 'none' : c} strokeWidth="4" />
      </svg>
    );
  }

  if (layer.type === 'image') {
    const img = (
      <img src={layer.src} alt="" crossOrigin="anonymous"
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    );
    if (layer.frame === 'browser') {
      return (
        <div style={{ width: '100%', height: '100%', background: '#1e1e1e', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ height: '8%', background: '#2d2d2d', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 6 }}>
            {['#ff5f57','#febc2e','#28c840'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
          </div>
          <div style={{ height: '92%', overflow: 'hidden' }}>{img}</div>
        </div>
      );
    }
    if (layer.frame === 'phone') {
      return (
        <div style={{ width: '100%', height: '100%', background: '#111', borderRadius: 20, overflow: 'hidden', border: '3px solid #333' }}>
          <div style={{ height: '5%', background: '#111', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ width: 40, height: 6, borderRadius: 3, background: '#333' }} />
          </div>
          <div style={{ height: '95%', overflow: 'hidden' }}>{img}</div>
        </div>
      );
    }
    return layer.src
      ? <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>{img}</div>
      : (
        <div style={{ width: '100%', height: '100%', border: '2px dashed rgba(247,247,245,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(247,247,245,0.4)', fontSize: 14, flexDirection: 'column', gap: 8 }}>
          <ImageIcon size={24} color="rgba(247,247,245,0.3)" />
          <span>No image</span>
        </div>
      );
  }

  return null;
}

// ── Layer view (drag + resize wrapper) ─────────────────────────────────────

const HANDLE = 12; // resize handle size px (screen)

function LayerView({ layer, scale, selected, editing, onDown, onResizeDown, onDblClick, onCommitText, exporting }: {
  layer: StudioLayer;
  scale: number;
  selected: boolean;
  editing: boolean;
  onDown: (e: React.PointerEvent) => void;
  onResizeDown: (e: React.PointerEvent) => void;
  onDblClick: () => void;
  onCommitText: (t: string) => void;
  exporting: boolean;
}) {
  return (
    <div
      onPointerDown={onDown}
      onDoubleClick={onDblClick}
      style={{
        position: 'absolute',
        left: layer.x,
        top: layer.y,
        width: layer.w,
        height: layer.h,
        transform: `rotate(${layer.rot}deg)`,
        opacity: layer.opacity,
        cursor: editing ? 'text' : 'grab',
        outline: !exporting && selected ? `${2 / scale}px solid #ea4711` : 'none',
        outlineOffset: `${3 / scale}px`,
        boxSizing: 'border-box',
      }}
    >
      <ElementBody layer={layer} isEditing={editing} onCommitText={onCommitText} />

      {/* Resize handle — bottom-right */}
      {selected && !exporting && (
        <div
          onPointerDown={e => { e.stopPropagation(); onResizeDown(e); }}
          style={{
            position: 'absolute',
            right: -HANDLE / scale / 2,
            bottom: -HANDLE / scale / 2,
            width: HANDLE / scale,
            height: HANDLE / scale,
            background: '#ea4711',
            borderRadius: 2,
            cursor: 'se-resize',
          }}
        />
      )}
    </div>
  );
}

// ── Icon picker modal ──────────────────────────────────────────────────────

function IconPicker({ onPick, onClose }: { onPick: (name: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const filtered = q
    ? ICON_NAMES.filter(n => n.toLowerCase().includes(q.toLowerCase())).slice(0, 80)
    : ICON_NAMES;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-[480px] max-h-[560px] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 p-4 border-b border-stone-100">
          <Search size={15} className="text-stone-400" />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search icons…" className="flex-1 text-sm outline-none text-stone-900 placeholder-stone-400" />
          <button onClick={onClose}><X size={16} className="text-stone-400" /></button>
        </div>
        <div className="grid grid-cols-8 gap-1 p-3 overflow-y-auto">
          {filtered.map(name => (
            <button key={name} title={name} onClick={() => { onPick(name); onClose(); }}
              className="p-2 rounded-lg hover:bg-stone-100 flex items-center justify-center transition-colors">
              <LIcon name={name} size={20} color="#1c1917" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main freeform editor ───────────────────────────────────────────────────

export default function StudioFreeform({ clientId, accent, brandKit }: { clientId: string; accent: string; brandKit: BrandKit }) {
  const { dispatch } = useApp();
  const { data } = useClient(clientId);
  const compositions = data.studioCompositions ?? [];

  const [layers, setLayers]     = useState<StudioLayer[]>([]);
  const [selIds, setSelIds]     = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [aspect, setAspect]     = useState<Aspect>(ASPECTS[0]);
  const [bg, setBg]             = useState('dark');
  const [exporting, setExporting] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    mode: 'move' | 'resize';
    sx: number; sy: number;
    id: string; ow: number; oh: number;
    origins: { id: string; ox: number; oy: number }[];
  } | null>(null);

  const scale = Math.min(PREVIEW_MAX / aspect.w, PREVIEW_MAX / aspect.h, 1);
  const selId = selIds[selIds.length - 1] ?? null;
  const selLayer = layers.find(l => l.id === selId) ?? null;

  // ── Layer ops ────────────────────────────────────────────────

  const addLayer = useCallback((type: LType) => {
    const layer: StudioLayer = { id: uid(), ...defaultLayer(type, accent, aspect) };
    setLayers(prev => [...prev, layer]);
    setSelIds([layer.id]);
    setEditingId(null);
  }, [accent, aspect]);

  const patch = useCallback((id: string, changes: Partial<StudioLayer>) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...changes } : l));
  }, []);

  const removeLayer = useCallback((id: string) => {
    setLayers(prev => prev.filter(l => l.id !== id));
    setSelIds(prev => prev.filter(s => s !== id));
    if (editingId === id) setEditingId(null);
  }, [editingId]);

  const dupLayer = useCallback((id: string) => {
    const src = layers.find(l => l.id === id);
    if (!src) return;
    const dup = { ...src, id: uid(), x: src.x + 30, y: src.y + 30 };
    setLayers(prev => [...prev, dup]);
    setSelIds([dup.id]);
  }, [layers]);

  const reorder = useCallback((id: string, dir: 1 | -1) => {
    setLayers(prev => {
      const idx = prev.findIndex(l => l.id === id);
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });
  }, []);

  // ── Pointer drag handlers ─────────────────────────────────────

  const onLayerDown = useCallback((e: React.PointerEvent, id: string) => {
    if ((e.target as HTMLElement).closest('[data-resize]')) return;
    e.stopPropagation();
    if (editingId) { setEditingId(null); return; }

    const shift = e.shiftKey || e.metaKey || e.ctrlKey;
    const newSel = shift
      ? (selIds.includes(id) ? selIds.filter(x => x !== id) : [...selIds, id])
      : (selIds.includes(id) ? selIds : [id]);
    setSelIds(newSel);

    const movingIds = newSel;
    const origins = movingIds.map(mid => {
      const l = layers.find(x => x.id === mid)!;
      return { id: mid, ox: l.x, oy: l.y };
    });
    const l = layers.find(x => x.id === id)!;
    dragRef.current = { mode: 'move', sx: e.clientX, sy: e.clientY, id, ow: l.w, oh: l.h, origins };

    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current!;
      const dx = (ev.clientX - d.sx) / scale;
      const dy = (ev.clientY - d.sy) / scale;
      setLayers(prev => prev.map(ly => {
        const o = d.origins.find(o => o.id === ly.id);
        return o ? { ...ly, x: Math.round(o.ox + dx), y: Math.round(o.oy + dy) } : ly;
      }));
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [editingId, layers, selIds, scale]);

  const onResizeDown = useCallback((e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    const l = layers.find(x => x.id === id)!;
    dragRef.current = { mode: 'resize', sx: e.clientX, sy: e.clientY, id, ow: l.w, oh: l.h, origins: [] };

    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current!;
      const dx = (ev.clientX - d.sx) / scale;
      const dy = (ev.clientY - d.sy) / scale;
      patch(d.id, { w: Math.max(40, Math.round(d.ow + dx)), h: Math.max(40, Math.round(d.oh + dy)) });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [layers, scale, patch]);

  // ── Export ────────────────────────────────────────────────────

  async function exportPng() {
    if (!cardRef.current) return;
    const prevSel = selIds;
    setSelIds([]);
    setEditingId(null);
    setExporting(true);
    await new Promise(r => setTimeout(r, 50));
    try {
      const { toPng } = await import('html-to-image');
      if ((document as any).fonts?.ready) await (document as any).fonts.ready;
      const url = await toPng(cardRef.current, {
        width: aspect.w, height: aspect.h,
        pixelRatio: 2, cacheBust: true,
        backgroundColor: bg === 'light' ? '#f0efed' : BG_DARK,
      });
      const a = document.createElement('a');
      a.href = url;
      a.download = `studio-freeform-${aspect.key.replace(':', 'x')}.png`;
      a.click();
    } finally {
      setExporting(false);
      setSelIds(prevSel);
    }
  }

  // ── Save / load compositions ──────────────────────────────────

  function saveComp() {
    const name = saveName.trim() || `Canvas ${new Date().toLocaleDateString()}`;
    const comp: StudioComposition = {
      id: uid(), name, aspectKey: aspect.key, bg, layers,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    dispatch({ type: 'SAVE_STUDIO_COMP', payload: { clientId, comp } });
    setSaveName('');
    setShowSaveInput(false);
  }

  function loadComp(comp: StudioComposition) {
    const a = ASPECTS.find(x => x.key === comp.aspectKey) ?? ASPECTS[0];
    setAspect(a);
    setBg(comp.bg);
    setLayers(comp.layers.map(l => ({ ...l, id: uid() })));
    setSelIds([]);
    setEditingId(null);
    setShowSaved(false);
  }

  // ── Brand Kit: derive font list ───────────────────────────────
  const FONTS = brandKit.fonts.length > 0
    ? brandKit.fonts.map(f => ({ label: `${f.name} — ${f.role}`, css: toCssFamily(f.name) }))
    : DEFAULT_FONTS;

  // ── Keyboard shortcut: delete key removes selected ────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;
        selIds.forEach(id => removeLayer(id));
      }
      if (e.key === 'Escape') { setSelIds([]); setEditingId(null); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selIds, removeLayer]);

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col">

      {/* ── Mobile notice ─────────────────────────────────────── */}
      <div className="md:hidden flex-1 flex flex-col items-center justify-center p-8 text-center gap-4 bg-[#F7F7F5]">
        <div className="w-14 h-14 rounded-2xl bg-white border border-stone-200 flex items-center justify-center shadow-sm">
          <LIcon name="MousePointer2" size={24} color="#78716c" />
        </div>
        <div>
          <p className="font-semibold text-stone-700 mb-1">Freeform editor</p>
          <p className="text-sm text-stone-400 max-w-xs leading-relaxed">
            The drag-and-drop layer editor works best on a larger screen.<br />
            Open this on your laptop or tablet.
          </p>
        </div>
      </div>

      {/* ── Full editor (desktop only) ────────────────────────── */}
      <div className="hidden md:flex flex-1 overflow-hidden bg-[#F7F7F5]">

      {/* ── Left panel ───────────────────────────────────────────── */}
      <div className="w-56 bg-white border-r border-stone-200 flex flex-col shrink-0 overflow-y-auto">
        {/* Add tools */}
        <div className="p-3 border-b border-stone-100">
          <p className="text-xs font-medium text-stone-400 mb-2 uppercase tracking-wide">Add element</p>
          <div className="grid grid-cols-2 gap-1.5">
            {([
              { type: 'text' as LType,  icon: Type,       label: 'Text'  },
              { type: 'icon' as LType,  icon: Sparkle,    label: 'Icon'  },
              { type: 'shape' as LType, icon: Square,     label: 'Shape' },
              { type: 'image' as LType, icon: ImageIcon,  label: 'Image' },
            ] as const).map(({ type, label }) => {
              const Icon = type === 'text' ? Type : type === 'shape' ? Square : type === 'image' ? ImageIcon : null;
              return (
                <button key={type}
                  onClick={() => {
                    if (type === 'icon') { addLayer('icon'); setShowIconPicker(true); }
                    else addLayer(type);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-2 text-xs border border-stone-200 rounded-lg text-stone-600 hover:bg-stone-50 hover:border-stone-300 transition-colors">
                  {Icon && <Icon size={13} />}
                  {!Icon && <LIcon name="Star" size={13} color="#78716c" />}
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Canvas settings */}
        <div className="p-3 border-b border-stone-100 space-y-2.5">
          <div>
            <p className="text-xs font-medium text-stone-400 mb-1.5">Aspect</p>
            <div className="flex flex-wrap gap-1">
              {ASPECTS.map(a => (
                <button key={a.key} onClick={() => setAspect(a)}
                  className={`px-2 py-0.5 text-xs rounded border transition-colors ${aspect.key === a.key ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-600 hover:border-stone-300'}`}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-stone-400 mb-1.5">Background</p>
            <div className="flex flex-wrap gap-1">
              {BG_PRESETS.map(p => (
                <button key={p} onClick={() => setBg(p)}
                  className={`px-2 py-0.5 text-xs rounded border capitalize transition-colors ${bg === p ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-600 hover:border-stone-300'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Layer list */}
        {layers.length > 0 && (
          <div className="p-3 flex-1">
            <p className="text-xs font-medium text-stone-400 mb-1.5 uppercase tracking-wide">Layers</p>
            <div className="space-y-1">
              {[...layers].reverse().map(l => (
                <button key={l.id} onClick={() => setSelIds([l.id])}
                  className={`w-full text-left px-2.5 py-1.5 text-xs rounded-md transition-colors flex items-center gap-2 ${selIds.includes(l.id) ? 'bg-accent/10 text-stone-900' : 'text-stone-600 hover:bg-stone-50'}`}>
                  <span className="text-stone-400 capitalize">{l.type}</span>
                  <span className="truncate text-stone-500">
                    {l.type === 'text' ? (l.text ?? '').slice(0, 18) : l.type === 'icon' ? l.icon : l.shape ?? l.type}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Save/load */}
        <div className="p-3 border-t border-stone-100 space-y-1.5">
          {showSaveInput ? (
            <div className="flex gap-1">
              <input autoFocus value={saveName} onChange={e => setSaveName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveComp(); if (e.key === 'Escape') setShowSaveInput(false); }}
                placeholder="Canvas name…" className="flex-1 px-2 py-1.5 text-xs border border-stone-200 rounded-lg focus:outline-none focus:border-accent" />
              <button onClick={saveComp} className="px-2.5 py-1.5 text-xs bg-stone-900 text-white rounded-lg">Save</button>
            </div>
          ) : (
            <button onClick={() => setShowSaveInput(true)} disabled={layers.length === 0}
              className="w-full flex items-center gap-1.5 px-2.5 py-2 text-xs border border-stone-200 rounded-lg text-stone-600 hover:bg-stone-50 disabled:opacity-40 transition-colors">
              <Save size={12} /> Save canvas
            </button>
          )}
          {compositions.length > 0 && (
            <button onClick={() => setShowSaved(s => !s)}
              className="w-full flex items-center gap-1.5 px-2.5 py-2 text-xs border border-stone-200 rounded-lg text-stone-600 hover:bg-stone-50 transition-colors">
              <FolderOpen size={12} /> Saved ({compositions.length})
            </button>
          )}
          {showSaved && (
            <div className="border border-stone-200 rounded-lg overflow-hidden">
              {compositions.map(c => (
                <div key={c.id} className="flex items-center gap-1 px-2.5 py-2 border-b border-stone-100 last:border-0">
                  <button onClick={() => loadComp(c)} className="flex-1 text-left text-xs text-stone-700 hover:text-stone-900 truncate">{c.name}</button>
                  <button onClick={() => dispatch({ type: 'DELETE_STUDIO_COMP', payload: { clientId, compId: c.id } })}
                    className="text-stone-300 hover:text-red-500 p-0.5">
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Canvas ───────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-auto">
        <div>
          <div style={{ width: Math.round(aspect.w * scale), height: Math.round(aspect.h * scale) }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
              <div
                ref={cardRef}
                onPointerDown={() => { setSelIds([]); setEditingId(null); }}
                style={{ width: aspect.w, height: aspect.h, position: 'relative', overflow: 'hidden', ...bgCss(bg, accent) }}
              >
                {layers.map(layer => (
                  <LayerView
                    key={layer.id}
                    layer={layer}
                    scale={scale}
                    selected={selIds.includes(layer.id)}
                    editing={editingId === layer.id}
                    exporting={exporting}
                    onDown={e => onLayerDown(e, layer.id)}
                    onResizeDown={e => onResizeDown(e, layer.id)}
                    onDblClick={() => { if (layer.type === 'text') { setSelIds([layer.id]); setEditingId(layer.id); } }}
                    onCommitText={t => { patch(layer.id, { text: t }); setEditingId(null); }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="text-xs text-stone-400">{aspect.w}×{aspect.h}px</span>
            <span className="text-stone-300">·</span>
            <button onClick={exportPng} disabled={exporting || layers.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-stone-900 text-white rounded-lg hover:bg-stone-800 disabled:opacity-40 transition-colors">
              <Download size={12} />
              {exporting ? 'Exporting…' : 'Export PNG'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Properties panel ─────────────────────────────────────── */}
      <div className="w-56 bg-white border-l border-stone-200 flex flex-col overflow-y-auto shrink-0">
        {!selLayer ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <p className="text-xs text-stone-400 text-center">Select a layer<br />to edit properties</p>
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {/* Layer actions */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-stone-700 capitalize">{selLayer.type} layer</span>
              <div className="flex items-center gap-0.5">
                <button onClick={() => reorder(selId!, -1)} title="Move back" className="p-1 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-100"><ChevronDown size={13} /></button>
                <button onClick={() => reorder(selId!, 1)} title="Move forward" className="p-1 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-100"><ChevronUp size={13} /></button>
                <button onClick={() => dupLayer(selId!)} title="Duplicate" className="p-1 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-100"><Copy size={13} /></button>
                <button onClick={() => removeLayer(selId!)} title="Delete" className="p-1 rounded text-stone-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={13} /></button>
              </div>
            </div>

            {/* Position + size */}
            <PropSection label="Position & Size">
              <div className="grid grid-cols-2 gap-1.5">
                {(['x','y','w','h'] as const).map(k => (
                  <div key={k}>
                    <label className="text-[10px] text-stone-400 uppercase">{k}</label>
                    <input type="number" value={selLayer[k]} onChange={e => patch(selId!, { [k]: Number(e.target.value) })}
                      className="w-full px-2 py-1 text-xs border border-stone-200 rounded focus:outline-none focus:border-accent" />
                  </div>
                ))}
              </div>
            </PropSection>

            {/* Rotation + Opacity */}
            <PropSection label="Transform">
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="text-[10px] text-stone-400 uppercase">Rotation</label>
                  <input type="number" value={selLayer.rot} onChange={e => patch(selId!, { rot: Number(e.target.value) })}
                    className="w-full px-2 py-1 text-xs border border-stone-200 rounded focus:outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="text-[10px] text-stone-400 uppercase">Opacity</label>
                  <input type="number" min={0} max={1} step={0.1} value={selLayer.opacity}
                    onChange={e => patch(selId!, { opacity: Number(e.target.value) })}
                    className="w-full px-2 py-1 text-xs border border-stone-200 rounded focus:outline-none focus:border-accent" />
                </div>
              </div>
            </PropSection>

            {/* Text-specific */}
            {selLayer.type === 'text' && (
              <>
                <PropSection label="Text">
                  <textarea value={selLayer.text ?? ''} onChange={e => patch(selId!, { text: e.target.value })}
                    rows={3} className="w-full px-2 py-1.5 text-xs border border-stone-200 rounded resize-none focus:outline-none focus:border-accent" />
                </PropSection>
                <PropSection label="Font">
                  <select value={selLayer.font} onChange={e => patch(selId!, { font: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs border border-stone-200 rounded focus:outline-none focus:border-accent">
                    {FONTS.map(f => <option key={f.label} value={f.css}>{f.label}</option>)}
                  </select>
                </PropSection>
                <PropSection label="Size & Weight">
                  <div className="flex gap-1.5">
                    <input type="number" value={selLayer.size ?? 80} onChange={e => patch(selId!, { size: Number(e.target.value) })}
                      className="flex-1 px-2 py-1 text-xs border border-stone-200 rounded focus:outline-none focus:border-accent" />
                    <select value={selLayer.weight ?? 700} onChange={e => patch(selId!, { weight: Number(e.target.value) })}
                      className="flex-1 px-2 py-1 text-xs border border-stone-200 rounded focus:outline-none focus:border-accent">
                      <option value={400}>Regular</option>
                      <option value={500}>Medium</option>
                      <option value={600}>Semi</option>
                      <option value={700}>Bold</option>
                    </select>
                  </div>
                </PropSection>
                <PropSection label="Align">
                  <div className="flex gap-1">
                    {(['left','center','right'] as const).map(a => (
                      <button key={a} onClick={() => patch(selId!, { align: a })}
                        className={`flex-1 p-1.5 rounded border transition-colors flex items-center justify-center ${selLayer.align === a ? 'bg-stone-900 border-stone-900 text-white' : 'border-stone-200 text-stone-500 hover:border-stone-300'}`}>
                        {a === 'left' ? <AlignLeft size={13} /> : a === 'center' ? <AlignCenter size={13} /> : <AlignRight size={13} />}
                      </button>
                    ))}
                  </div>
                </PropSection>
                <PropSection label="Color">
                  <input type="color" value={selLayer.color ?? INK} onChange={e => patch(selId!, { color: e.target.value })}
                    className="w-full h-8 rounded border border-stone-200 cursor-pointer" />
                </PropSection>
              </>
            )}

            {/* Icon-specific */}
            {selLayer.type === 'icon' && (
              <>
                <PropSection label="Icon">
                  <button onClick={() => setShowIconPicker(true)}
                    className="w-full flex items-center gap-2 px-2.5 py-2 border border-stone-200 rounded-lg text-xs text-stone-700 hover:border-stone-300 transition-colors">
                    <LIcon name={selLayer.icon ?? 'Star'} size={16} color={selLayer.color ?? INK} />
                    {selLayer.icon ?? 'Star'}
                  </button>
                </PropSection>
                <PropSection label="Color">
                  <input type="color" value={selLayer.color ?? accent} onChange={e => patch(selId!, { color: e.target.value })}
                    className="w-full h-8 rounded border border-stone-200 cursor-pointer" />
                </PropSection>
                <PropSection label="Style">
                  <label className="flex items-center gap-2 text-xs text-stone-600">
                    <input type="checkbox" checked={selLayer.fill ?? false} onChange={e => patch(selId!, { fill: e.target.checked })} />
                    Filled
                  </label>
                </PropSection>
              </>
            )}

            {/* Shape-specific */}
            {selLayer.type === 'shape' && (
              <>
                <PropSection label="Shape">
                  <div className="grid grid-cols-2 gap-1">
                    {(['rect','circle','ring','line'] as const).map(s => (
                      <button key={s} onClick={() => patch(selId!, { shape: s })}
                        className={`py-1 text-xs rounded border capitalize transition-colors ${selLayer.shape === s ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-600 hover:border-stone-300'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </PropSection>
                <PropSection label="Color">
                  <input type="color" value={selLayer.color ?? accent} onChange={e => patch(selId!, { color: e.target.value })}
                    className="w-full h-8 rounded border border-stone-200 cursor-pointer" />
                </PropSection>
                <PropSection label="Style">
                  <label className="flex items-center gap-2 text-xs text-stone-600">
                    <input type="checkbox" checked={selLayer.fill ?? true} onChange={e => patch(selId!, { fill: e.target.checked })} />
                    Filled
                  </label>
                </PropSection>
              </>
            )}

            {/* Image-specific */}
            {selLayer.type === 'image' && (
              <>
                <PropSection label="Upload Image">
                  <label className="flex items-center gap-2 px-2.5 py-2 border border-stone-200 rounded-lg text-xs text-stone-600 cursor-pointer hover:bg-stone-50 transition-colors">
                    <ImageIcon size={13} />
                    Choose file
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = ev => patch(selId!, { src: ev.target?.result as string });
                      reader.readAsDataURL(file);
                    }} />
                  </label>
                </PropSection>
                <PropSection label="Frame">
                  <div className="flex gap-1">
                    {(['none','browser','phone'] as const).map(f => (
                      <button key={f} onClick={() => patch(selId!, { frame: f })}
                        className={`flex-1 py-1 text-xs rounded border capitalize transition-colors ${selLayer.frame === f ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-600 hover:border-stone-300'}`}>
                        {f}
                      </button>
                    ))}
                  </div>
                </PropSection>
              </>
            )}
          </div>
        )}
      </div>

      {/* Icon picker modal */}
      {showIconPicker && (
        <IconPicker
          onPick={name => { if (selId) patch(selId, { icon: name }); }}
          onClose={() => setShowIconPicker(false)}
        />
      )}
      </div>{/* end hidden md:flex wrapper */}

    </div>
  );
}

function PropSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-medium text-stone-400 uppercase tracking-wide mb-1.5">{label}</p>
      {children}
    </div>
  );
}

// Needed because we reference Sparkle in the JSX above — use the Star icon from lucide instead
function Sparkle(props: any) { return <LIcon name="Sparkles" {...props} />; }
