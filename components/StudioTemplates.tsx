'use client';

import { useRef, useState, useEffect } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { BrandKit } from '@/types';

// ── Constants ─────────────────────────────────────────────────────────────

const BG_DARK = '#0d0d0d';
const INK     = '#f7f7f5';

const ASPECTS = [
  { key: '1:1',  label: '1:1',  w: 1080, h: 1080 },
  { key: '4:5',  label: '4:5',  w: 1080, h: 1350 },
  { key: '16:9', label: '16:9', w: 1080, h: 608  },
  { key: '9:16', label: '9:16', w: 608,  h: 1080 },
] as const;
type Aspect = typeof ASPECTS[number];

const PREVIEW_MAX = 440;

const BG_PRESETS = [
  { key: 'dark',     label: 'Dark'     },
  { key: 'glow',     label: 'Glow'     },
  { key: 'grid',     label: 'Grid'     },
  { key: 'gradient', label: 'Gradient' },
  { key: 'light',    label: 'Light'    },
];

function bgCss(preset: string, accent: string): React.CSSProperties {
  switch (preset) {
    case 'glow':
      return { background: BG_DARK, backgroundImage: `radial-gradient(55% 60% at 80% 15%, ${accent}45 0%, transparent 70%)` };
    case 'grid':
      return { background: BG_DARK, backgroundImage: 'linear-gradient(rgba(247,247,245,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(247,247,245,0.05) 1px,transparent 1px)', backgroundSize: '54px 54px' };
    case 'gradient':
      return { background: `linear-gradient(145deg,${BG_DARK} 0%,${accent}30 100%)` };
    case 'light':
      return { background: '#f0efed' };
    default:
      return { background: BG_DARK };
  }
}

// ── Template definitions ───────────────────────────────────────────────────

type TemplateKey = 'quote' | 'stat' | 'list' | 'steps' | 'announce' | 'testimonial';

interface Fields {
  eyebrow: string;
  title: string;
  sub: string;
  footer: string;
  items: string;
  stat: string;
  author: string;
}

const TEMPLATES: { key: TemplateKey; label: string; desc: string }[] = [
  { key: 'quote',       label: 'Quote',       desc: 'Power statement' },
  { key: 'stat',        label: 'Stat',        desc: 'Big number / metric' },
  { key: 'list',        label: 'List',        desc: 'Tips or takeaways' },
  { key: 'steps',       label: 'Steps',       desc: 'Step-by-step how-to' },
  { key: 'announce',    label: 'Announce',    desc: 'Launch or update' },
  { key: 'testimonial', label: 'Testimonial', desc: 'Client review' },
];

const DEFAULTS: Record<TemplateKey, Fields> = {
  quote: {
    eyebrow: 'CONTENT STRATEGY',
    title: 'Great content\nis not about\nbeing perfect.',
    sub: "It's about being consistent.",
    footer: '',
    items: '',
    stat: '',
    author: '',
  },
  stat: {
    eyebrow: 'MAY 2026',
    stat: '12',
    title: 'posts this month',
    sub: 'Consistent, on-brand, every week.',
    footer: '',
    items: '',
    author: '',
  },
  list: {
    eyebrow: '5 THINGS',
    title: 'That actually\ngrow your account.',
    sub: '',
    footer: '',
    items: 'Post consistently, not daily\nKnow your audience deeply\nUse hooks that stop the scroll\nEngage before you expect engagement\nTrack what works and double down',
    stat: '',
    author: '',
  },
  steps: {
    eyebrow: 'HOW IT WORKS',
    title: '3 steps to better content.',
    sub: '',
    footer: '',
    items: "Research your audience's pain points\nCreate value-first content\nRepurpose what performs",
    stat: '',
    author: '',
  },
  announce: {
    eyebrow: 'NOW OPEN',
    title: 'New batch\nstarting soon.',
    sub: 'Limited spots available.',
    footer: 'DM us to book your spot',
    items: '',
    stat: '',
    author: '',
  },
  testimonial: {
    eyebrow: 'CLIENT LOVE',
    title: '"The quality of content\ncompletely changed."',
    sub: '',
    footer: '',
    items: '',
    stat: '',
    author: 'Priya S. — Studio Member',
  },
};

// ── Per-field style overrides ──────────────────────────────────────────────

interface FieldStyle {
  font?: string;
  size?: number;
  weight?: number;
  color?: string;
}

const FIELD_META: Record<string, { label: string }> = {
  eyebrow: { label: 'Eyebrow' },
  title:   { label: 'Title / Quote' },
  stat:    { label: 'Big Stat' },
  sub:     { label: 'Subtitle' },
  items:   { label: 'List Items' },
  author:  { label: 'Author' },
  footer:  { label: 'Footer / CTA' },
};

// ── Card body renderers ────────────────────────────────────────────────────

function CardBody({ template, f, accent, dims, bgPreset, headlineFont, bodyFont, fieldStyles = {} }: {
  template: TemplateKey;
  f: Fields;
  accent: string;
  dims: Aspect;
  bgPreset: string;
  headlineFont: string;
  bodyFont: string;
  fieldStyles?: Record<string, FieldStyle>;
}) {
  const isLight = bgPreset === 'light';
  const ink     = isLight ? '#1c1917' : INK;
  const inkFade = isLight ? 'rgba(28,25,23,0.5)' : 'rgba(247,247,245,0.5)';
  const pad     = Math.round(dims.w * 0.074);
  const w       = dims.w;

  // Helper: merge per-field overrides onto a base style
  const fs = (field: string): FieldStyle => fieldStyles[field] ?? {};

  const box: React.CSSProperties = {
    padding: pad, width: '100%', height: '100%',
    display: 'flex', flexDirection: 'column', justifyContent: 'center',
    position: 'relative', boxSizing: 'border-box',
    fontFamily: headlineFont,
  };
  const eyebrowStyle: React.CSSProperties = {
    fontFamily: fs('eyebrow').font ?? bodyFont,
    fontSize:   fs('eyebrow').size ?? Math.round(w * 0.022),
    fontWeight: fs('eyebrow').weight ?? 500,
    color:      fs('eyebrow').color ?? accent,
    letterSpacing: '0.12em',
    textTransform: 'uppercase', marginBottom: Math.round(w * 0.028),
  };
  const titleStyle: React.CSSProperties = {
    fontFamily: fs('title').font ?? headlineFont,
    fontSize:   fs('title').size ?? Math.round(w * 0.078),
    fontWeight: fs('title').weight ?? 700,
    color:      fs('title').color ?? ink,
    lineHeight: 1.06, whiteSpace: 'pre-line',
    marginBottom: Math.round(w * 0.022),
  };
  const subStyle: React.CSSProperties = {
    fontFamily: fs('sub').font ?? bodyFont,
    fontSize:   fs('sub').size ?? Math.round(w * 0.030),
    fontWeight: fs('sub').weight ?? 400,
    color:      fs('sub').color ?? inkFade,
    lineHeight: 1.5,
  };
  const dividerStyle: React.CSSProperties = {
    width: Math.round(w * 0.09), height: 3,
    background: accent, borderRadius: 2,
    marginBottom: Math.round(w * 0.032),
  };
  const footerStyle: React.CSSProperties = {
    fontFamily: fs('footer').font ?? bodyFont,
    fontSize:   fs('footer').size ?? Math.round(w * 0.022),
    fontWeight: fs('footer').weight ?? 500,
    color:      fs('footer').color ?? accent,
    position: 'absolute', bottom: pad, left: pad,
  };

  if (template === 'quote') {
    return (
      <div style={box}>
        {f.eyebrow && <div style={eyebrowStyle}>{f.eyebrow}</div>}
        <div style={dividerStyle} />
        <div style={titleStyle}>
          {f.title}<span style={{ color: accent }}>.</span>
        </div>
        {f.sub && <div style={{ ...subStyle, marginTop: Math.round(w * 0.016) }}>— {f.sub}</div>}
        {f.footer && <div style={footerStyle}>{f.footer}</div>}
      </div>
    );
  }

  if (template === 'stat') {
    return (
      <div style={box}>
        {f.eyebrow && <div style={eyebrowStyle}>{f.eyebrow}</div>}
        <div style={{ fontFamily: fs('stat').font ?? headlineFont, fontSize: fs('stat').size ?? Math.round(w * 0.22), fontWeight: fs('stat').weight ?? 700, color: fs('stat').color ?? accent, lineHeight: 0.88, marginBottom: Math.round(w * 0.016) }}>
          {f.stat}
        </div>
        <div style={{ ...titleStyle, fontSize: Math.round(w * 0.058), marginBottom: Math.round(w * 0.018) }}>
          {f.title}
        </div>
        {f.sub && <div style={subStyle}>{f.sub}</div>}
        {f.footer && <div style={footerStyle}>{f.footer}</div>}
      </div>
    );
  }

  if (template === 'list') {
    const items = f.items.split('\n').filter(Boolean);
    return (
      <div style={box}>
        {f.eyebrow && <div style={eyebrowStyle}>{f.eyebrow}</div>}
        <div style={{ ...titleStyle, fontSize: Math.round(w * 0.062), marginBottom: Math.round(w * 0.034) }}>
          {f.title}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: Math.round(w * 0.016) }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: Math.round(w * 0.020) }}>
              <span style={{ color: accent, fontWeight: 700, fontSize: Math.round(w * 0.030), flexShrink: 0, lineHeight: 1.45, minWidth: Math.round(w * 0.042) }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{ fontFamily: fs('items').font ?? bodyFont, fontSize: fs('items').size ?? Math.round(w * 0.032), fontWeight: fs('items').weight ?? 400, color: fs('items').color ?? ink, lineHeight: 1.45 }}>
                {item}
              </span>
            </div>
          ))}
        </div>
        {f.footer && <div style={footerStyle}>{f.footer}</div>}
      </div>
    );
  }

  if (template === 'steps') {
    const items = f.items.split('\n').filter(Boolean);
    return (
      <div style={box}>
        {f.eyebrow && <div style={eyebrowStyle}>{f.eyebrow}</div>}
        <div style={{ ...titleStyle, fontSize: Math.round(w * 0.062), marginBottom: Math.round(w * 0.040) }}>
          {f.title}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: Math.round(w * 0.030), paddingBottom: Math.round(w * 0.028) }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ width: Math.round(w * 0.050), height: Math.round(w * 0.050), borderRadius: '50%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: Math.round(w * 0.026), color: '#fff', flexShrink: 0 }}>
                  {i + 1}
                </div>
                {i < items.length - 1 && <div style={{ width: 2, flex: 1, background: `${accent}40`, marginTop: 4 }} />}
              </div>
              <div style={{ fontFamily: fs('items').font ?? bodyFont, fontSize: fs('items').size ?? Math.round(w * 0.034), fontWeight: fs('items').weight ?? 400, color: fs('items').color ?? ink, lineHeight: 1.5, paddingTop: Math.round(w * 0.008) }}>
                {item}
              </div>
            </div>
          ))}
        </div>
        {f.footer && <div style={footerStyle}>{f.footer}</div>}
      </div>
    );
  }

  if (template === 'announce') {
    return (
      <div style={{ ...box, justifyContent: 'center' }}>
        {f.eyebrow && <div style={eyebrowStyle}>{f.eyebrow}</div>}
        <div style={{ ...dividerStyle, width: Math.round(w * 0.12) }} />
        <div style={{ ...titleStyle, fontSize: Math.round(w * 0.088) }}>
          {f.title}
        </div>
        {f.sub && <div style={{ ...subStyle, marginTop: Math.round(w * 0.018) }}>{f.sub}</div>}
        {f.footer && (
          <div style={{ position: 'absolute', bottom: pad, left: pad, fontSize: Math.round(w * 0.026), fontWeight: 600, color: accent }}>
            {f.footer}
          </div>
        )}
      </div>
    );
  }

  if (template === 'testimonial') {
    return (
      <div style={box}>
        {f.eyebrow && <div style={eyebrowStyle}>{f.eyebrow}</div>}
        <div style={{ fontSize: Math.round(w * 0.20), fontWeight: 700, color: accent, lineHeight: 0.75, marginBottom: Math.round(w * 0.014) }}>
          "
        </div>
        <div style={{ ...titleStyle, fontSize: Math.round(w * 0.060), fontStyle: 'italic' }}>
          {f.title}
        </div>
        {f.author && (
          <div style={{ fontFamily: fs('author').font ?? bodyFont, fontSize: fs('author').size ?? Math.round(w * 0.026), fontWeight: fs('author').weight ?? 400, color: fs('author').color ?? inkFade, marginTop: Math.round(w * 0.022) }}>
            — {f.author}
          </div>
        )}
        {f.footer && <div style={footerStyle}>{f.footer}</div>}
      </div>
    );
  }

  return null;
}

// ── Field components ───────────────────────────────────────────────────────

function FieldRow({ label, children, active = false }: { label: string; children: React.ReactNode; active?: boolean }) {
  return (
    <div className={active ? 'pl-2 border-l-2 border-accent' : ''}>
      <label className={`block text-xs font-medium mb-1 ${active ? 'text-accent' : 'text-stone-400'}`}>{label}</label>
      {children}
    </div>
  );
}

// ── Properties panel (desktop) ─────────────────────────────────────────────

function PropsPanel({ activeField, fieldStyles, fonts, onSetFs, onClearFs }: {
  activeField: string | null;
  fieldStyles: Record<string, FieldStyle>;
  fonts: { label: string; css: string }[];
  onSetFs: (field: string, patch: Partial<FieldStyle>) => void;
  onClearFs: (field: string) => void;
}) {
  if (!activeField) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-stone-400 text-sm font-medium">Aa</div>
        <p className="text-xs text-stone-400 leading-relaxed">Click a field on<br/>the left to style it</p>
      </div>
    );
  }
  const fs: FieldStyle = fieldStyles[activeField] ?? {};
  const meta = FIELD_META[activeField];
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-3 border-b border-stone-100 shrink-0">
        <div className="text-xs font-semibold text-stone-800">{meta?.label ?? activeField}</div>
        <div className="text-[11px] text-stone-400 mt-0.5">Typography overrides</div>
      </div>
      <div className="p-3 space-y-3 flex-1">
        {/* Font */}
        <div>
          <label className="block text-[11px] font-medium text-stone-400 mb-1">Font</label>
          <select
            value={fs.font ?? ''}
            onChange={e => onSetFs(activeField, { font: e.target.value || undefined })}
            className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-white text-stone-700 focus:outline-none focus:ring-1 focus:ring-accent">
            <option value="">— default —</option>
            {fonts.map(f => <option key={f.css} value={f.css}>{f.label}</option>)}
          </select>
        </div>
        {/* Size */}
        <div>
          <label className="block text-[11px] font-medium text-stone-400 mb-1">Size (px)</label>
          <input
            type="number" min={8} max={300}
            value={fs.size ?? ''}
            onChange={e => { const v = e.target.value; onSetFs(activeField, { size: v ? Number(v) : undefined }); }}
            placeholder="auto"
            className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-white text-stone-700 focus:outline-none focus:ring-1 focus:ring-accent" />
        </div>
        {/* Weight */}
        <div>
          <label className="block text-[11px] font-medium text-stone-400 mb-1">Weight</label>
          <select
            value={fs.weight ?? ''}
            onChange={e => { const v = e.target.value; onSetFs(activeField, { weight: v ? Number(v) : undefined }); }}
            className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-white text-stone-700 focus:outline-none focus:ring-1 focus:ring-accent">
            <option value="">— default —</option>
            <option value="300">Light (300)</option>
            <option value="400">Regular (400)</option>
            <option value="500">Medium (500)</option>
            <option value="600">SemiBold (600)</option>
            <option value="700">Bold (700)</option>
          </select>
        </div>
        {/* Color */}
        <div>
          <label className="block text-[11px] font-medium text-stone-400 mb-1">Color</label>
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              value={fs.color && fs.color.match(/^#[0-9a-fA-F]{6}$/) ? fs.color : '#f7f7f5'}
              onChange={e => onSetFs(activeField, { color: e.target.value })}
              className="w-7 h-7 rounded border border-stone-200 cursor-pointer shrink-0 p-0.5 bg-white" />
            <input
              type="text" value={fs.color ?? ''}
              onChange={e => onSetFs(activeField, { color: e.target.value || undefined })}
              placeholder="default"
              className="flex-1 text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-white text-stone-700 focus:outline-none focus:ring-1 focus:ring-accent font-mono" />
          </div>
        </div>
      </div>
      <div className="p-3 border-t border-stone-100 shrink-0">
        <button
          onClick={() => onClearFs(activeField)}
          className="w-full text-xs text-stone-500 hover:text-red-500 border border-stone-200 hover:border-red-200 rounded-lg px-3 py-1.5 transition-colors">
          Reset {meta?.label ?? activeField}
        </button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

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

export default function StudioTemplates({ clientId, accent, brandKit }: { clientId: string; accent: string; brandKit: BrandKit }) {
  const [template, setTemplate]         = useState<TemplateKey>('quote');
  const [fields, setFields]             = useState<Record<TemplateKey, Fields>>(DEFAULTS);
  const [aspect, setAspect]             = useState<Aspect>(ASPECTS[0]);
  const [bg, setBg]                     = useState('dark');
  const [exporting, setExporting]       = useState(false);
  const [canvasMaxW, setCanvasMaxW]     = useState(440);
  const [activeField, setActiveField]   = useState<string | null>(null);
  const [allFieldStyles, setAllFieldStyles] = useState<Record<string, Record<string, FieldStyle>>>({});

  const cardRef            = useRef<HTMLDivElement>(null);
  const mobileContainerRef = useRef<HTMLDivElement>(null);
  const desktopContainerRef = useRef<HTMLDivElement>(null);

  // Measure the visible canvas container (mobile vs desktop) to compute responsive scale
  useEffect(() => {
    const update = () => {
      const isMobile = window.innerWidth < 768;
      const el = isMobile ? mobileContainerRef.current : desktopContainerRef.current;
      if (!el) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      setCanvasMaxW(Math.max(100, Math.min(w - 40, h > 200 ? h - 40 : w - 40, 520)));
    };
    update();
    const ro = new ResizeObserver(update);
    if (mobileContainerRef.current)  ro.observe(mobileContainerRef.current);
    if (desktopContainerRef.current) ro.observe(desktopContainerRef.current);
    window.addEventListener('resize', update);
    return () => { ro.disconnect(); window.removeEventListener('resize', update); };
  }, []);

  // Use brand kit fonts if available, otherwise defaults
  const FONTS = brandKit.fonts.length > 0
    ? brandKit.fonts.map(f => ({ label: `${f.name} — ${f.role}`, css: toCssFamily(f.name) }))
    : DEFAULT_FONTS;

  // Brand kit accent: use first non-white/non-black color if available
  const kitAccent = brandKit.colors.find(c => !['#ffffff', '#fff', '#000000', '#000'].includes(c.hex.toLowerCase()))?.hex ?? accent;

  // Resolve headline + body fonts for template canvas rendering
  const kitHeadline = brandKit.fonts.find(f => /headline/i.test(f.role)) ?? brandKit.fonts[0];
  const kitBody     = brandKit.fonts.find(f => /body/i.test(f.role)) ?? brandKit.fonts[1] ?? kitHeadline;
  const headlineFont = kitHeadline ? toCssFamily(kitHeadline.name) : "'Space Grotesk', 'Inter', sans-serif";
  const bodyFont     = kitBody     ? toCssFamily(kitBody.name)     : "'Inter', sans-serif";

  const f     = fields[template];
  const setF  = (patch: Partial<Fields>) => setFields(p => ({ ...p, [template]: { ...p[template], ...patch } }));
  const reset = () => { setFields(p => ({ ...p, [template]: DEFAULTS[template] })); setAllFieldStyles(p => ({ ...p, [template]: {} })); };
  const scale = Math.min(canvasMaxW / aspect.w, canvasMaxW / aspect.h, 1);

  // Per-field style helpers
  const fieldStyles = allFieldStyles[template] ?? {};
  const setFs = (field: string, patch: Partial<FieldStyle>) =>
    setAllFieldStyles(p => ({
      ...p,
      [template]: { ...(p[template] ?? {}), [field]: { ...(p[template]?.[field] ?? {}), ...patch } },
    }));
  const clearFs = (field: string) =>
    setAllFieldStyles(p => {
      const copy = { ...(p[template] ?? {}) };
      delete copy[field];
      return { ...p, [template]: copy };
    });

  async function exportPng() {
    if (!cardRef.current) return;
    setExporting(true);
    await new Promise(r => setTimeout(r, 40));
    try {
      const { toPng } = await import('html-to-image');
      if ((document as any).fonts?.ready) await (document as any).fonts.ready;
      const url = await toPng(cardRef.current, {
        width: aspect.w, height: aspect.h, pixelRatio: 2, cacheBust: true,
        backgroundColor: bg === 'light' ? '#f0efed' : BG_DARK,
      });
      const a = document.createElement('a');
      a.href = url;
      a.download = `studio-${template}-${aspect.key.replace(':', 'x')}.png`;
      a.click();
    } finally { setExporting(false); }
  }

  // ── Canvas (mobile preview only — export always targets cardRef on desktop) ──
  const canvasEl = (
    <div ref={mobileContainerRef} className="flex items-center justify-center p-4 bg-[#F7F7F5]">
      <div>
        <div style={{ width: Math.round(aspect.w * scale), height: Math.round(aspect.h * scale) }}>
          <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            <div ref={cardRef}
              style={{ width: aspect.w, height: aspect.h, position: 'relative', overflow: 'hidden', ...bgCss(bg, kitAccent) }}>
              <CardBody template={template} f={f} accent={kitAccent} dims={aspect} bgPreset={bg} headlineFont={headlineFont} bodyFont={bodyFont} fieldStyles={fieldStyles} />
            </div>
          </div>
        </div>
        <p className="text-center text-xs text-stone-400 mt-2">{aspect.w} × {aspect.h}px</p>
      </div>
    </div>
  );

  return (
    <div className="h-full bg-[#F7F7F5] overflow-y-auto md:overflow-hidden flex flex-col md:flex-row">

      {/* ── Mobile: canvas at top ─────────────────────────────── */}
      <div className="md:hidden">
        {canvasEl}
      </div>

      {/* ── Controls panel ───────────────────────────────────── */}
      <div className="w-full md:w-72 bg-white md:border-r border-stone-200 flex flex-col md:overflow-y-auto shrink-0">

        {/* Template picker — horizontal scroll chips on mobile, grid on desktop */}
        <div className="md:hidden flex overflow-x-auto gap-2 px-4 py-3 border-b border-stone-100 no-scrollbar">
          {TEMPLATES.map(t => (
            <button key={t.key} onClick={() => setTemplate(t.key)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs border font-medium transition-colors ${
                template === t.key ? 'border-accent bg-accent/10 text-stone-900' : 'border-stone-200 text-stone-500 bg-white'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="hidden md:block p-4 border-b border-stone-100">
          <p className="text-xs font-medium text-stone-400 mb-2 uppercase tracking-wide">Template</p>
          <div className="grid grid-cols-2 gap-1.5">
            {TEMPLATES.map(t => (
              <button key={t.key} onClick={() => setTemplate(t.key)}
                className={`text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                  template === t.key ? 'border-accent bg-accent/5 text-stone-900 font-medium' : 'border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-50'
                }`}>
                <div className="font-medium">{t.label}</div>
                <div className="text-stone-400 text-[11px]">{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Aspect + BG — single compact row on mobile */}
        <div className="px-4 py-3 border-b border-stone-100">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="flex gap-1">
              {ASPECTS.map(a => (
                <button key={a.key} onClick={() => setAspect(a)}
                  className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${aspect.key === a.key ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-600'}`}>
                  {a.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1 flex-wrap">
              {BG_PRESETS.map(p => (
                <button key={p.key} onClick={() => setBg(p.key)}
                  className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${bg === p.key ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-600'}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Fields */}
        <div className="p-4 space-y-3 flex-1">
          <p className="text-xs font-medium text-stone-400 uppercase tracking-wide">Content
            <span className="normal-case font-normal ml-1 text-stone-300">— click a field to style it</span>
          </p>

          <FieldRow label="Eyebrow" active={activeField === 'eyebrow'}>
            <input value={f.eyebrow} onChange={e => setF({ eyebrow: e.target.value })}
              onFocus={() => setActiveField('eyebrow')}
              className={`input-base text-xs ${activeField === 'eyebrow' ? 'ring-2 ring-accent/40 border-accent' : ''}`}
              placeholder="CATEGORY or DATE" />
          </FieldRow>

          {template === 'stat' && (
            <FieldRow label="Big Number" active={activeField === 'stat'}>
              <input value={f.stat} onChange={e => setF({ stat: e.target.value })}
                onFocus={() => setActiveField('stat')}
                className={`input-base text-xs ${activeField === 'stat' ? 'ring-2 ring-accent/40 border-accent' : ''}`}
                placeholder="e.g. 12 or 3×" />
            </FieldRow>
          )}

          <FieldRow label={template === 'quote' || template === 'testimonial' ? 'Quote / Text' : 'Title'} active={activeField === 'title'}>
            <textarea value={f.title} onChange={e => setF({ title: e.target.value })}
              onFocus={() => setActiveField('title')}
              rows={3} className={`input-base text-xs resize-none ${activeField === 'title' ? 'ring-2 ring-accent/40 border-accent' : ''}`}
              placeholder="Your main text (use Enter for line breaks)" />
          </FieldRow>

          {(template === 'list' || template === 'steps') && (
            <FieldRow label={template === 'list' ? 'Items (one per line)' : 'Steps (one per line)'} active={activeField === 'items'}>
              <textarea value={f.items} onChange={e => setF({ items: e.target.value })}
                onFocus={() => setActiveField('items')}
                rows={4} className={`input-base text-xs resize-none ${activeField === 'items' ? 'ring-2 ring-accent/40 border-accent' : ''}`}
                placeholder="One item per line" />
            </FieldRow>
          )}

          {template !== 'list' && template !== 'steps' && (
            <FieldRow label="Subtitle / Context" active={activeField === 'sub'}>
              <input value={f.sub} onChange={e => setF({ sub: e.target.value })}
                onFocus={() => setActiveField('sub')}
                className={`input-base text-xs ${activeField === 'sub' ? 'ring-2 ring-accent/40 border-accent' : ''}`}
                placeholder="Supporting line (optional)" />
            </FieldRow>
          )}

          {template === 'testimonial' && (
            <FieldRow label="Author" active={activeField === 'author'}>
              <input value={f.author} onChange={e => setF({ author: e.target.value })}
                onFocus={() => setActiveField('author')}
                className={`input-base text-xs ${activeField === 'author' ? 'ring-2 ring-accent/40 border-accent' : ''}`}
                placeholder="Name — Role" />
            </FieldRow>
          )}

          <FieldRow label="Footer / CTA" active={activeField === 'footer'}>
            <input value={f.footer} onChange={e => setF({ footer: e.target.value })}
              onFocus={() => setActiveField('footer')}
              className={`input-base text-xs ${activeField === 'footer' ? 'ring-2 ring-accent/40 border-accent' : ''}`}
              placeholder="Bottom label (optional)" />
          </FieldRow>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-stone-100 flex gap-2">
          <button onClick={reset} className="btn-secondary flex items-center gap-1.5 text-xs flex-1 justify-center">
            <RefreshCw size={12} /> Reset
          </button>
          <button onClick={exportPng} disabled={exporting}
            className="btn-primary flex items-center gap-1.5 text-xs flex-1 justify-center">
            <Download size={12} />
            {exporting ? 'Exporting…' : 'Export PNG'}
          </button>
        </div>
      </div>

      {/* ── Desktop: canvas center ──────────────────────────── */}
      <div ref={desktopContainerRef} className="hidden md:flex flex-1 items-center justify-center p-8 overflow-auto">
        <div>
          <div style={{ width: Math.round(aspect.w * scale), height: Math.round(aspect.h * scale) }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
              <div ref={cardRef}
                style={{ width: aspect.w, height: aspect.h, position: 'relative', overflow: 'hidden', ...bgCss(bg, kitAccent) }}>
                <CardBody template={template} f={f} accent={kitAccent} dims={aspect} bgPreset={bg} headlineFont={headlineFont} bodyFont={bodyFont} fieldStyles={fieldStyles} />
              </div>
            </div>
          </div>
          <p className="text-center text-xs text-stone-400 mt-3">{aspect.w} × {aspect.h}px</p>
        </div>
      </div>

      {/* ── Properties panel (desktop only) ──────────────────── */}
      <div className="hidden md:flex w-52 shrink-0 bg-white border-l border-stone-200 flex-col">
        <PropsPanel
          activeField={activeField}
          fieldStyles={fieldStyles}
          fonts={FONTS}
          onSetFs={setFs}
          onClearFs={clearFs}
        />
      </div>
    </div>
  );
}
