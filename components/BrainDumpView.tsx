'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, Link2, Pencil, Trash2, Lightbulb, Sparkles,
  Check, ChevronDown, X,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { generateId } from '@/lib/utils';
import { BrainNode, BrainNodeKind, Client } from '@/types';

// ── constants ────────────────────────────────────────────────────────────────

const WORLD_W = 2800;
const WORLD_H = 2000;
const NODE_W = 210;
const KIND_COLOR: Record<BrainNodeKind, string> = {
  thought: '#8c52ff',
  idea: '#ff914d',
};

function pickAccent(brandColors: { hex: string; role?: string }[] | undefined, fallback: string): string {
  if (!brandColors?.length) return fallback;
  const primary = brandColors.find(c => /primary|accent/i.test(c.role ?? ''));
  return primary?.hex ?? brandColors[0]?.hex ?? fallback;
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function BrainDumpView() {
  const { state, dispatch } = useApp();
  const router = useRouter();

  const nodes = state.brainDump?.nodes ?? [];
  const edges = state.brainDump?.edges ?? [];

  const scrollRef = useRef<HTMLDivElement>(null);

  // live drag positions (not yet committed to global state)
  const [live, setLive] = useState<Record<string, { x: number; y: number }>>({});
  const [drag, setDrag] = useState<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);
  // measured heights for edge anchoring
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);

  const posOf = (n: BrainNode) => live[n.id] ?? { x: n.x, y: n.y };
  const heightOf = (id: string) => heights[id] ?? 64;

  const accentFor = (clientId?: string): string => {
    if (!clientId) return '#8c52ff';
    const c = state.clients.find(x => x.id === clientId);
    if (!c) return '#8c52ff';
    return pickAccent(state.clientData[clientId]?.brandKit?.colors, c.color);
  };

  // ── drag handling ──
  function startDrag(node: BrainNode, e: React.PointerEvent) {
    if (linkFrom) return; // in link mode, nodes are tap-targets, not draggable
    setDrag({ id: node.id, sx: e.clientX, sy: e.clientY, ox: node.x, oy: node.y });
  }

  useEffect(() => {
    if (!drag) return;
    function move(e: PointerEvent) {
      const dx = e.clientX - drag!.sx;
      const dy = e.clientY - drag!.sy;
      setLive(l => ({ ...l, [drag!.id]: { x: Math.max(0, drag!.ox + dx), y: Math.max(0, drag!.oy + dy) } }));
    }
    function up() {
      setLive(l => {
        const pos = l[drag!.id];
        if (pos) {
          const node = nodes.find(n => n.id === drag!.id);
          if (node) dispatch({ type: 'UPDATE_BRAIN_NODE', payload: { node: { ...node, x: pos.x, y: pos.y } } });
        }
        const { [drag!.id]: _omit, ...rest } = l;
        return rest;
      });
      setDrag(null);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [drag, nodes, dispatch]);

  const reportHeight = useCallback((id: string, h: number) => {
    setHeights(prev => (prev[id] === h ? prev : { ...prev, [id]: h }));
  }, []);

  // ── add a new thought near the current viewport center ──
  function addNode(kind: BrainNodeKind) {
    const el = scrollRef.current;
    let x = WORLD_W / 2 - NODE_W / 2;
    let y = WORLD_H / 2 - 60;
    if (el) {
      x = el.scrollLeft + el.clientWidth / 2 - NODE_W / 2 + (Math.random() * 60 - 30);
      y = el.scrollTop + el.clientHeight / 2 - 50 + (Math.random() * 60 - 30);
    }
    const node: BrainNode = {
      id: generateId(),
      text: '',
      x: Math.max(0, x),
      y: Math.max(0, y),
      kind,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_BRAIN_NODE', payload: { node } });
    setEditingId(node.id);
  }

  // ── link two nodes ──
  function onNodeTap(node: BrainNode) {
    if (!linkFrom) return;
    if (linkFrom !== node.id) {
      dispatch({ type: 'ADD_BRAIN_EDGE', payload: { edge: { id: generateId(), from: linkFrom, to: node.id } } });
    }
    setLinkFrom(null);
  }

  function center(n: BrainNode) {
    const p = posOf(n);
    return { cx: p.x + NODE_W / 2, cy: p.y + heightOf(n.id) / 2 };
  }

  const nodeById = (id: string) => nodes.find(n => n.id === id);

  return (
    <div className="h-screen flex flex-col bg-[#F4F2F7]">
      {/* ── Header ── */}
      <header className="shrink-0 bg-white border-b border-stone-200 px-4 md:px-6 py-3 flex items-center gap-3 z-20">
        <button
          onClick={() => router.push('/me')}
          className="flex items-center gap-1.5 text-stone-500 hover:text-stone-900 text-sm font-medium transition-colors"
        >
          <ArrowLeft size={16} />
          <span className="hidden sm:inline">My Day</span>
        </button>

        <div className="flex items-center gap-2 ml-1">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#8c52ff,#ff914d)' }}>
            <Sparkles size={14} className="text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-stone-900 text-sm leading-none">Brain Dump</h1>
            <p className="text-[11px] text-stone-400 mt-0.5 hidden sm:block">Drop a thought, then connect the dots</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {linkFrom && (
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-violet-600 bg-violet-50 px-2.5 py-1.5 rounded-lg">
              <Link2 size={12} /> Tap another node to connect
              <button onClick={() => setLinkFrom(null)} className="ml-1 text-violet-400 hover:text-violet-700"><X size={12} /></button>
            </span>
          )}
          <button
            onClick={() => addNode('idea')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-200 text-stone-600 hover:border-stone-400 transition-colors"
          >
            <Lightbulb size={13} style={{ color: KIND_COLOR.idea }} />
            <span className="hidden sm:inline">Idea</span>
          </button>
          <button
            onClick={() => addNode('thought')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#1f1f1f] text-white hover:bg-stone-700 transition-colors"
          >
            <Plus size={14} />
            Thought
          </button>
        </div>
      </header>

      {/* ── Canvas ── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto relative"
        onClick={() => { setSelectedEdge(null); if (linkFrom) setLinkFrom(null); }}
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(140,82,255,0.10) 1px, transparent 1px)',
          backgroundSize: '26px 26px',
        }}
      >
        {/* empty state */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-6">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg,#8c52ff,#ff914d)' }}>
              <Sparkles size={28} className="text-white" />
            </div>
            <p className="font-semibold text-stone-700 mb-1">Your mind, on a canvas</p>
            <p className="text-sm text-stone-400 max-w-xs">
              Drop any thought — personal or client. Drag to arrange, then link related ones to connect the dots.
            </p>
          </div>
        )}

        {/* world */}
        <div className="relative" style={{ width: WORLD_W, height: WORLD_H }}>
          {/* edges */}
          <svg className="absolute inset-0" width={WORLD_W} height={WORLD_H} style={{ pointerEvents: 'none', zIndex: 0 }}>
            {edges.map(edge => {
              const a = nodeById(edge.from);
              const b = nodeById(edge.to);
              if (!a || !b) return null;
              const A = center(a);
              const B = center(b);
              const sel = selectedEdge === edge.id;
              return (
                <g key={edge.id}>
                  <line
                    x1={A.cx} y1={A.cy} x2={B.cx} y2={B.cy}
                    stroke={sel ? '#8c52ff' : '#c9b6e6'}
                    strokeWidth={sel ? 3 : 2}
                  />
                  {/* fat invisible hit-line for easy selection */}
                  <line
                    x1={A.cx} y1={A.cy} x2={B.cx} y2={B.cy}
                    stroke="transparent" strokeWidth={18}
                    style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); setSelectedEdge(sel ? null : edge.id); }}
                  />
                </g>
              );
            })}
          </svg>

          {/* edge delete button (when selected) */}
          {selectedEdge && (() => {
            const edge = edges.find(e => e.id === selectedEdge);
            if (!edge) return null;
            const a = nodeById(edge.from); const b = nodeById(edge.to);
            if (!a || !b) return null;
            const A = center(a); const B = center(b);
            const mx = (A.cx + B.cx) / 2; const my = (A.cy + B.cy) / 2;
            return (
              <button
                onClick={(e) => { e.stopPropagation(); dispatch({ type: 'DELETE_BRAIN_EDGE', payload: { edgeId: edge.id } }); setSelectedEdge(null); }}
                className="absolute w-6 h-6 rounded-full bg-white border border-stone-300 shadow-md flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors"
                style={{ left: mx - 12, top: my - 12, zIndex: 5 }}
                title="Remove link"
              >
                <Trash2 size={12} />
              </button>
            );
          })()}

          {/* nodes */}
          {nodes.map(node => {
            const p = posOf(node);
            return (
              <NodeCard
                key={node.id}
                node={node}
                x={p.x}
                y={p.y}
                accent={accentFor(node.clientId)}
                client={node.clientId ? state.clients.find(c => c.id === node.clientId) : undefined}
                clients={state.clients}
                accentFor={accentFor}
                editing={editingId === node.id}
                linking={linkFrom !== null}
                isLinkSource={linkFrom === node.id}
                onReportHeight={reportHeight}
                onPointerDownBody={(e) => startDrag(node, e)}
                onTap={() => onNodeTap(node)}
                onStartLink={() => setLinkFrom(node.id)}
                onEdit={() => setEditingId(node.id)}
                onCloseEdit={() => setEditingId(null)}
                onChange={(patch) => dispatch({ type: 'UPDATE_BRAIN_NODE', payload: { node: { ...node, ...patch } } })}
                onDelete={() => { dispatch({ type: 'DELETE_BRAIN_NODE', payload: { nodeId: node.id } }); if (editingId === node.id) setEditingId(null); }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Node card ────────────────────────────────────────────────────────────────

function NodeCard({
  node, x, y, accent, client, clients, accentFor, editing, linking, isLinkSource,
  onReportHeight, onPointerDownBody, onTap, onStartLink, onEdit, onCloseEdit, onChange, onDelete,
}: {
  node: BrainNode;
  x: number; y: number;
  accent: string;
  client?: Client;
  clients: Client[];
  accentFor: (id?: string) => string;
  editing: boolean;
  linking: boolean;
  isLinkSource: boolean;
  onReportHeight: (id: string, h: number) => void;
  onPointerDownBody: (e: React.PointerEvent) => void;
  onTap: () => void;
  onStartLink: () => void;
  onEdit: () => void;
  onCloseEdit: () => void;
  onChange: (patch: Partial<BrainNode>) => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(node.text);

  // Apply a non-text patch while preserving the in-progress draft text,
  // so toggling kind/client mid-edit never reverts what you've typed.
  const applyPatch = (patch: Partial<BrainNode>) => onChange({ text: draft.trim(), ...patch });

  // report height for edge anchoring
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(() => {
      if (ref.current) onReportHeight(node.id, ref.current.offsetHeight);
    });
    ro.observe(ref.current);
    onReportHeight(node.id, ref.current.offsetHeight);
    return () => ro.disconnect();
  }, [node.id, onReportHeight]);

  const kindColor = KIND_COLOR[node.kind];

  return (
    <div
      ref={ref}
      className="absolute select-none"
      style={{
        left: x, top: y, width: NODE_W, zIndex: editing ? 30 : 10,
        touchAction: editing ? 'auto' : 'none',
      }}
      onClick={(e) => { if (linking) { e.stopPropagation(); onTap(); } }}
    >
      <div
        className={`bg-white rounded-xl border shadow-sm transition-shadow ${
          isLinkSource ? 'ring-2 ring-violet-400' : ''
        } ${linking && !isLinkSource ? 'cursor-pointer hover:ring-2 hover:ring-violet-300' : ''}`}
        style={{ borderColor: '#e7e5e4', borderLeft: `4px solid ${kindColor}` }}
      >
        {/* drag handle / header */}
        <div
          onPointerDown={editing || linking ? undefined : onPointerDownBody}
          className={`flex items-center gap-1.5 px-3 pt-2.5 pb-1 ${editing || linking ? '' : 'cursor-grab active:cursor-grabbing'}`}
        >
          {node.kind === 'idea'
            ? <Lightbulb size={13} style={{ color: kindColor }} />
            : <Sparkles size={13} style={{ color: kindColor }} />}
          <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: kindColor }}>
            {node.kind === 'idea' ? 'Idea' : 'Thought'}
          </span>
          {client && (
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-stone-500">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accent }} />
              <span className="max-w-[70px] truncate">{client.name}</span>
            </span>
          )}
        </div>

        {/* body */}
        <div className="px-3 pb-2">
          {editing ? (
            <>
              <textarea
                autoFocus
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={() => onChange({ text: draft.trim() })}
                placeholder="What's on your mind…"
                rows={3}
                className="w-full text-sm text-stone-700 bg-transparent focus:outline-none resize-none placeholder-stone-300"
              />
              {/* edit controls */}
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <button
                  onClick={() => applyPatch({ kind: node.kind === 'idea' ? 'thought' : 'idea' })}
                  className="flex items-center gap-1 px-2 py-1 rounded-md border border-stone-200 text-[11px] text-stone-500 hover:border-stone-400 transition-colors"
                >
                  {node.kind === 'idea' ? <Lightbulb size={11} /> : <Sparkles size={11} />}
                  {node.kind === 'idea' ? 'Idea' : 'Thought'}
                </button>
                <NodeClientPicker clients={clients} value={node.clientId} accentFor={accentFor}
                  onChange={(id) => applyPatch({ clientId: id })} />
                <button
                  onClick={() => { onChange({ text: draft.trim() }); onCloseEdit(); }}
                  className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#1f1f1f] text-white text-[11px] font-medium hover:bg-stone-700 transition-colors"
                >
                  <Check size={11} /> Done
                </button>
              </div>
            </>
          ) : (
            <p
              onClick={(e) => { if (!linking) { e.stopPropagation(); onEdit(); } }}
              className="text-sm text-stone-700 whitespace-pre-wrap leading-snug cursor-text min-h-[20px]"
            >
              {node.text || <span className="text-stone-300">Empty — tap to write…</span>}
            </p>
          )}
        </div>

        {/* action bar */}
        {!editing && !linking && (
          <div className="flex items-center gap-0.5 px-2 py-1 border-t border-stone-100">
            <button onClick={(e) => { e.stopPropagation(); onStartLink(); }} title="Connect"
              className="p-1.5 rounded text-stone-400 hover:text-violet-600 hover:bg-violet-50 transition-colors">
              <Link2 size={13} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onEdit(); }} title="Edit"
              className="p-1.5 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors">
              <Pencil size={13} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Delete"
              className="p-1.5 rounded text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors ml-auto">
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Compact client picker for a node ─────────────────────────────────────────

function NodeClientPicker({
  clients, value, onChange, accentFor,
}: {
  clients: Client[];
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  accentFor: (id?: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const selected = value ? clients.find(c => c.id === value) : undefined;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-2 py-1 rounded-md border border-stone-200 text-[11px] text-stone-500 hover:border-stone-400 transition-colors"
      >
        {selected ? (
          <>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accentFor(selected.id) }} />
            <span className="max-w-[64px] truncate">{selected.name}</span>
          </>
        ) : <span className="text-stone-400">Tag</span>}
        <ChevronDown size={11} />
      </button>
      {open && (
        <div className="absolute left-0 bottom-full mb-1 z-40 w-40 bg-white border border-stone-200 rounded-lg shadow-lg py-1 max-h-52 overflow-y-auto">
          <button onClick={() => { onChange(undefined); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-stone-500 hover:bg-stone-50 transition-colors">
            {value === undefined && <Check size={11} />}
            <span className={value === undefined ? 'text-stone-900 font-medium' : ''}>Personal</span>
          </button>
          {clients.map(c => (
            <button key={c.id} onClick={() => { onChange(c.id); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-stone-50 transition-colors">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: accentFor(c.id) }} />
              <span className={`truncate ${value === c.id ? 'text-stone-900 font-medium' : 'text-stone-600'}`}>{c.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
