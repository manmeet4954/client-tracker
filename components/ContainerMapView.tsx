'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, Trash2, Pencil, ChevronDown, ChevronRight,
  CheckCircle2, Circle, Sparkles, Network, Check, X,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { generateId } from '@/lib/utils';
import { MapNode } from '@/types';

// ── layout constants (desktop canvas) ────────────────────────────────────────
// The map reads like the system runs: a numbered spine of stages flowing top
// to bottom, each stage branching right into the tasks that bring it to life.
// Clicking any card opens its full brief in the detail panel — the map is the
// reference; the wiki never needs opening for this.

const ROOT_W = 268;
const ROOT_H = 96;
const STAGE_W = 236;
const STAGE_H = 66;
const LEAF_W = 280;
const LEAF_H = 46;
const LEAF_GAP = 10;
const ADD_ROW_H = 34;
const BLOCK_GAP = 40;        // vertical gap between stage blocks
const ROOT_GAP = 52;         // gap between root and first stage
const GAP_STAGE_LEAF = 68;   // horizontal: stage → task
const PAD = 56;

const STAGE_COLORS = ['#8c52ff', '#ff914d', '#0ea5e9', '#22c55e', '#ec4899', '#eab308', '#14b8a6', '#f43f5e'];

interface Placed {
  node: MapNode;
  x: number;
  y: number;
  w: number;
  h: number;
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function ContainerMapView() {
  const { state, dispatch } = useApp();
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  const nodes = state.containerMap?.nodes ?? [];
  const root = nodes.find(n => !n.parentId);
  const stages = useMemo(
    () => nodes.filter(n => n.parentId === root?.id).sort((a, b) => a.order - b.order),
    [nodes, root?.id]
  );
  const tasksOf = (stageId: string) =>
    nodes.filter(n => n.parentId === stageId).sort((a, b) => a.order - b.order);

  // overall progress
  const checkables = nodes.filter(n => n.checkable);
  const doneCount = checkables.filter(n => n.done).length;
  const pct = checkables.length ? Math.round((doneCount / checkables.length) * 100) : 0;

  // ── selection / panel state ──
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelEditing, setPanelEditing] = useState(false);
  const selected = selectedId ? nodes.find(n => n.id === selectedId) : undefined;

  function select(id: string) {
    setSelectedId(id);
    setPanelEditing(false);
  }
  function closePanel() {
    setSelectedId(null);
    setPanelEditing(false);
  }

  // color + stage number context for the panel
  const stageOf = (n: MapNode): MapNode | undefined =>
    n.parentId && n.parentId !== root?.id ? nodes.find(x => x.id === n.parentId) : (n.parentId === root?.id ? n : undefined);
  const colorOf = (n: MapNode): string => {
    if (!n.parentId) return '#1f1f1f';
    if (n.parentId === root?.id) return n.color ?? '#8c52ff';
    return stageOf(n)?.color ?? '#8c52ff';
  };
  const numberOf = (n: MapNode): number | undefined => {
    const s = n.parentId === root?.id ? n : stageOf(n);
    if (!s) return undefined;
    const i = stages.findIndex(x => x.id === s.id);
    return i >= 0 ? i + 1 : undefined;
  };

  function toggleDone(n: MapNode) {
    dispatch({ type: 'UPDATE_MAP_NODE', payload: { node: { ...n, done: !n.done } } });
  }
  function toggleCollapse(n: MapNode) {
    dispatch({ type: 'UPDATE_MAP_NODE', payload: { node: { ...n, collapsed: !n.collapsed } } });
  }
  function savePanel(n: MapNode, label: string, note: string, detail: string) {
    const l = label.trim();
    if (l) {
      dispatch({
        type: 'UPDATE_MAP_NODE',
        payload: { node: { ...n, label: l, note: note.trim() || undefined, detail: detail.trim() || undefined } },
      });
    }
    setPanelEditing(false);
  }
  function addTask(stageId: string) {
    const siblings = tasksOf(stageId);
    const node: MapNode = {
      id: generateId(),
      parentId: stageId,
      label: '',
      checkable: true,
      done: false,
      order: (siblings[siblings.length - 1]?.order ?? 0) + 1,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_MAP_NODE', payload: { node } });
    setSelectedId(node.id);
    setPanelEditing(true);
  }
  function addStage() {
    if (!root) return;
    const node: MapNode = {
      id: generateId(),
      parentId: root.id,
      label: '',
      color: STAGE_COLORS[stages.length % STAGE_COLORS.length],
      order: (stages[stages.length - 1]?.order ?? 0) + 1,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_MAP_NODE', payload: { node } });
    setSelectedId(node.id);
    setPanelEditing(true);
  }
  function deleteNode(n: MapNode) {
    const kids = nodes.filter(x => x.parentId === n.id).length;
    if (kids > 0 && !window.confirm(`Delete "${n.label || 'this stage'}" and its ${kids} tasks?`)) return;
    if (selectedId === n.id) closePanel();
    dispatch({ type: 'DELETE_MAP_NODE', payload: { nodeId: n.id } });
  }

  // ── desktop layout: vertical spine, tasks to the right ──
  const layout = useMemo(() => {
    if (!root) return { placed: [] as Placed[], W: 800, H: 500 };
    const placed: Placed[] = [];

    const stageX = PAD + 8;
    const rootX = stageX + STAGE_W / 2 - ROOT_W / 2;
    const leafX = stageX + STAGE_W + GAP_STAGE_LEAF;

    const blockH = (s: MapNode) => {
      if (s.collapsed) return STAGE_H;
      const rows = tasksOf(s.id).length;
      const tasksH = rows * (LEAF_H + LEAF_GAP) + ADD_ROW_H; // tasks + add row
      return Math.max(STAGE_H, tasksH);
    };

    placed.push({ node: root, x: rootX, y: PAD, w: ROOT_W, h: ROOT_H });

    let y = PAD + ROOT_H + ROOT_GAP;
    for (const s of stages) {
      const bh = blockH(s);
      placed.push({ node: s, x: stageX, y: y + bh / 2 - STAGE_H / 2, w: STAGE_W, h: STAGE_H });
      if (!s.collapsed) {
        let ly = y;
        for (const t of tasksOf(s.id)) {
          placed.push({ node: t, x: leafX, y: ly, w: LEAF_W, h: LEAF_H });
          ly += LEAF_H + LEAF_GAP;
        }
      }
      y += bh + BLOCK_GAP;
    }

    const H = y - BLOCK_GAP + PAD;
    const W = leafX + LEAF_W + PAD;
    return { placed, W, H };
  }, [root, stages, nodes]); // eslint-disable-line react-hooks/exhaustive-deps

  // start the view at the top, spine centered
  const centeredRef = useRef(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || centeredRef.current || !root) return;
    el.scrollLeft = Math.max(0, (layout.W - el.clientWidth) / 2);
    el.scrollTop = 0;
    centeredRef.current = true;
  }, [layout.W, root]);

  const byId = new Map(layout.placed.map(p => [p.node.id, p]));

  // spine segment: bottom center of `from` → top center of `to`
  function spinePath(from: Placed, to: Placed): string {
    const fx = from.x + from.w / 2;
    const fy = from.y + from.h;
    const tx = to.x + to.w / 2;
    const ty = to.y;
    const my = (fy + ty) / 2;
    return `M ${fx} ${fy} C ${fx} ${my}, ${tx} ${my}, ${tx} ${ty}`;
  }
  // task connector: right edge of stage → left edge of task
  function taskPath(from: Placed, to: Placed): string {
    const fx = from.x + from.w;
    const fy = from.y + from.h / 2;
    const tx = to.x;
    const ty = to.y + to.h / 2;
    const mx = (fx + tx) / 2;
    return `M ${fx} ${fy} C ${mx} ${fy}, ${mx} ${ty}, ${tx} ${ty}`;
  }

  return (
    <div className="h-screen flex flex-col bg-[#F7F7F5]">
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
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#1f1f1f]">
            <Network size={14} className="text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-stone-900 text-sm leading-none">The Container</h1>
            <p className="text-[11px] text-stone-400 mt-0.5 hidden sm:block">Tap any card for its full brief — the map is the reference</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs font-medium text-stone-500 bg-stone-100 rounded-lg px-2.5 py-1.5">
            {doneCount}/{checkables.length} built · {pct}%
          </span>
          <button
            onClick={addStage}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-200 text-stone-600 hover:border-stone-400 transition-colors"
          >
            <Plus size={13} />
            <span className="hidden sm:inline">Stage</span>
          </button>
          <button
            onClick={() => router.push('/brain')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-200 text-stone-600 hover:border-stone-400 transition-colors"
          >
            <Sparkles size={13} className="text-[#8c52ff]" />
            <span className="hidden sm:inline">Brain Dump</span>
          </button>
        </div>
      </header>

      {!root ? (
        <div className="flex-1 flex items-center justify-center text-sm text-stone-400">Loading the map…</div>
      ) : (
        <div className="flex-1 flex min-h-0">
          {/* ── Desktop: the spine canvas ── */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-auto relative hidden md:block"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(31,31,31,0.06) 1px, transparent 1px)',
              backgroundSize: '26px 26px',
            }}
          >
            <div className="relative mx-auto" style={{ width: layout.W, height: layout.H }}>
              {/* edges */}
              <svg className="absolute inset-0" width={layout.W} height={layout.H} style={{ pointerEvents: 'none', zIndex: 0 }}>
                {stages.map((s, i) => {
                  const sp = byId.get(s.id);
                  if (!sp) return null;
                  const prev = i === 0 ? byId.get(root.id) : byId.get(stages[i - 1].id);
                  return (
                    <g key={s.id}>
                      {prev && (
                        <path d={spinePath(prev, sp)} fill="none" stroke={s.color ?? '#c9c5bd'} strokeWidth={2.5} strokeOpacity={0.6} />
                      )}
                      {!s.collapsed && tasksOf(s.id).map(t => {
                        const tp = byId.get(t.id);
                        if (!tp) return null;
                        return (
                          <path key={t.id} d={taskPath(sp, tp)} fill="none" stroke={s.color ?? '#c9c5bd'} strokeWidth={1.5} strokeOpacity={0.4} />
                        );
                      })}
                    </g>
                  );
                })}
              </svg>

              {/* root */}
              {(() => {
                const rp = byId.get(root.id);
                if (!rp) return null;
                return (
                  <div
                    onClick={() => select(root.id)}
                    className={`absolute rounded-2xl bg-[#1f1f1f] text-white shadow-lg px-5 py-4 flex flex-col justify-center cursor-pointer transition-shadow hover:shadow-xl ${selectedId === root.id ? 'ring-2 ring-stone-400' : ''}`}
                    style={{ left: rp.x, top: rp.y, width: rp.w, height: rp.h, zIndex: 10 }}
                  >
                    <p className="font-bold text-[15px] leading-tight">{root.label}</p>
                    {root.note && <p className="text-[11px] text-white/50 mt-0.5 leading-snug">{root.note}</p>}
                    <div className="mt-1.5 h-1.5 rounded-full bg-white/15 overflow-hidden">
                      <div className="h-full rounded-full bg-[#ff914d] transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })()}

              {/* stages + tasks */}
              {stages.map((s, i) => {
                const sp = byId.get(s.id);
                if (!sp) return null;
                const tasks = tasksOf(s.id);
                const sDone = tasks.filter(t => t.checkable && t.done).length;
                const sTotal = tasks.filter(t => t.checkable).length;
                return (
                  <div key={s.id}>
                    <StageCard
                      placed={sp}
                      number={i + 1}
                      done={sDone}
                      total={sTotal}
                      selected={selectedId === s.id}
                      onSelect={() => select(s.id)}
                      onToggleCollapse={() => toggleCollapse(s)}
                      onDelete={() => deleteNode(s)}
                    />
                    {!s.collapsed && tasks.map(t => {
                      const tp = byId.get(t.id);
                      if (!tp) return null;
                      return (
                        <TaskCard
                          key={t.id}
                          placed={tp}
                          color={s.color ?? '#8c52ff'}
                          selected={selectedId === t.id}
                          onSelect={() => select(t.id)}
                          onToggle={() => toggleDone(t)}
                          onDelete={() => deleteNode(t)}
                        />
                      );
                    })}
                    {/* add-task row under the task stack */}
                    {!s.collapsed && (() => {
                      const last = tasks.length ? byId.get(tasks[tasks.length - 1].id) : undefined;
                      const x = last ? last.x : sp.x + STAGE_W + GAP_STAGE_LEAF;
                      const y = last ? last.y + LEAF_H + LEAF_GAP : sp.y + STAGE_H / 2 - ADD_ROW_H / 2;
                      return (
                        <button
                          onClick={() => addTask(s.id)}
                          className="absolute flex items-center gap-1.5 px-3 text-xs text-stone-400 hover:text-stone-700 border border-dashed border-stone-300 hover:border-stone-400 rounded-xl transition-colors bg-white/40"
                          style={{ left: x, top: y, width: LEAF_W, height: ADD_ROW_H, zIndex: 5 }}
                        >
                          <Plus size={12} /> Add task
                        </button>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Desktop: detail panel ── */}
          {selected && (
            <aside className="hidden md:flex w-[400px] shrink-0 border-l border-stone-200 bg-white flex-col min-h-0">
              <DetailPanel
                node={selected}
                color={colorOf(selected)}
                number={numberOf(selected)}
                editing={panelEditing}
                onStartEdit={() => setPanelEditing(true)}
                onSave={(l, n, d) => savePanel(selected, l, n, d)}
                onCancelEdit={() => setPanelEditing(false)}
                onToggleDone={() => toggleDone(selected)}
                onDelete={() => deleteNode(selected)}
                onClose={closePanel}
              />
            </aside>
          )}

          {/* ── Mobile: the same spine as ordered, collapsible stages ── */}
          <div className="flex-1 overflow-y-auto md:hidden px-4 py-4">
            <div
              onClick={() => select(root.id)}
              className="rounded-2xl bg-[#1f1f1f] text-white px-4 py-3.5 mb-3 cursor-pointer"
            >
              <p className="font-bold text-[15px]">{root.label}</p>
              {root.note && <p className="text-[11px] text-white/50 mt-0.5">{root.note}</p>}
              <div className="mt-2 h-1.5 rounded-full bg-white/15 overflow-hidden">
                <div className="h-full rounded-full bg-[#ff914d]" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-[10px] text-white/40 mt-1">{doneCount} of {checkables.length} built · tap any card for its brief</p>
            </div>
            {stages.map((s, i) => {
              const tasks = tasksOf(s.id);
              const sDone = tasks.filter(t => t.checkable && t.done).length;
              const sTotal = tasks.filter(t => t.checkable).length;
              return (
                <div key={s.id} className="bg-white rounded-2xl border border-stone-200 mb-3 overflow-hidden">
                  <div className="w-full flex items-center gap-2.5 px-3.5 py-3">
                    <span
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                      style={{ background: s.color ?? '#8c52ff' }}
                    >
                      {i + 1}
                    </span>
                    <button onClick={() => select(s.id)} className="font-semibold text-sm text-stone-900 text-left flex-1">
                      {s.label || 'Untitled stage'}
                    </button>
                    <span className="text-[11px] text-stone-400 font-medium shrink-0">{sDone}/{sTotal}</span>
                    <button onClick={() => toggleCollapse(s)} className="p-1 shrink-0">
                      {s.collapsed ? <ChevronRight size={15} className="text-stone-400" /> : <ChevronDown size={15} className="text-stone-400" />}
                    </button>
                  </div>
                  {!s.collapsed && (
                    <div className="px-3 pb-3">
                      {s.note && <p className="text-[11px] text-stone-400 px-1 pb-2">{s.note}</p>}
                      {tasks.map(t => (
                        <div key={t.id} className="flex items-start gap-2.5 px-2 py-2 rounded-lg hover:bg-stone-50 transition-colors">
                          {t.checkable && (
                            <button onClick={() => toggleDone(t)} className="shrink-0 mt-0.5">
                              {t.done
                                ? <CheckCircle2 size={17} style={{ color: s.color ?? '#8c52ff' }} />
                                : <Circle size={17} className="text-stone-300" />}
                            </button>
                          )}
                          <button onClick={() => select(t.id)} className="flex-1 min-w-0 text-left">
                            <p className={`text-sm leading-snug ${t.done ? 'line-through text-stone-400' : 'text-stone-700'}`}>
                              {t.label || <span className="text-stone-300">Untitled task</span>}
                            </p>
                            {t.note && <p className="text-[11px] text-stone-400 mt-0.5 leading-snug">{t.note}</p>}
                          </button>
                          <ChevronRight size={14} className="text-stone-300 shrink-0 mt-1" />
                        </div>
                      ))}
                      <button
                        onClick={() => addTask(s.id)}
                        className="w-full flex items-center gap-1.5 px-2 py-2 mt-1 text-xs text-stone-400 hover:text-stone-700 border border-dashed border-stone-300 rounded-xl transition-colors"
                      >
                        <Plus size={12} /> Add task
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Mobile: bottom-sheet detail ── */}
          {selected && (
            <div className="md:hidden fixed inset-0 z-40 flex flex-col justify-end">
              <div className="absolute inset-0 bg-black/30" onClick={closePanel} />
              <div className="relative bg-white rounded-t-2xl max-h-[80vh] flex flex-col min-h-0 shadow-2xl">
                <DetailPanel
                  node={selected}
                  color={colorOf(selected)}
                  number={numberOf(selected)}
                  editing={panelEditing}
                  onStartEdit={() => setPanelEditing(true)}
                  onSave={(l, n, d) => savePanel(selected, l, n, d)}
                  onCancelEdit={() => setPanelEditing(false)}
                  onToggleDone={() => toggleDone(selected)}
                  onDelete={() => deleteNode(selected)}
                  onClose={closePanel}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Detail panel (desktop aside + mobile bottom sheet) ───────────────────────

function DetailPanel({
  node, color, number, editing, onStartEdit, onSave, onCancelEdit, onToggleDone, onDelete, onClose,
}: {
  node: MapNode;
  color: string;
  number?: number;
  editing: boolean;
  onStartEdit: () => void;
  onSave: (label: string, note: string, detail: string) => void;
  onCancelEdit: () => void;
  onToggleDone: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [l, setL] = useState(node.label);
  const [n, setN] = useState(node.note ?? '');
  const [d, setD] = useState(node.detail ?? '');

  // re-sync drafts when the selected node changes or editing starts
  useEffect(() => {
    setL(node.label);
    setN(node.note ?? '');
    setD(node.detail ?? '');
  }, [node.id, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const isStage = number !== undefined && !node.checkable;
  const isRoot = !node.parentId;

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* header */}
      <div className="shrink-0 px-4 py-3 border-b border-stone-100 flex items-start gap-2.5" style={{ borderTop: `3px solid ${color}` }}>
        {number !== undefined && (
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5"
            style={{ background: color }}
          >
            {number}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color }}>
            {isRoot ? 'The system' : isStage ? `Stage ${number}` : 'Task'}
          </p>
          <h2 className="font-semibold text-stone-900 text-[15px] leading-tight">{node.label || 'Untitled'}</h2>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors shrink-0">
          <X size={16} />
        </button>
      </div>

      {/* body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
        {editing ? (
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">Name</label>
              <input
                value={l}
                onChange={e => setL(e.target.value)}
                className="w-full text-sm text-stone-800 border-b border-stone-300 focus:border-stone-500 focus:outline-none pb-1 mt-0.5 bg-transparent"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">One-line note (shown on the card)</label>
              <input
                value={n}
                onChange={e => setN(e.target.value)}
                className="w-full text-sm text-stone-800 border-b border-stone-300 focus:border-stone-500 focus:outline-none pb-1 mt-0.5 bg-transparent"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">The full brief</label>
              <textarea
                value={d}
                onChange={e => setD(e.target.value)}
                rows={14}
                className="w-full text-sm text-stone-700 border border-stone-200 rounded-xl p-3 mt-1 focus:outline-none focus:border-stone-400 leading-relaxed"
              />
            </div>
          </div>
        ) : (
          <>
            {node.note && <p className="text-xs text-stone-400 italic mb-3">{node.note}</p>}
            {node.detail ? (
              <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">{node.detail}</p>
            ) : (
              <p className="text-sm text-stone-300">No brief yet — tap Edit to write one.</p>
            )}
          </>
        )}
      </div>

      {/* footer actions */}
      <div className="shrink-0 px-4 py-3 border-t border-stone-100 flex items-center gap-2">
        {editing ? (
          <>
            <button
              onClick={() => onSave(l, n, d)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1f1f1f] text-white text-xs font-medium hover:bg-stone-700 transition-colors"
            >
              <Check size={13} /> Save
            </button>
            <button
              onClick={onCancelEdit}
              className="px-3.5 py-2 rounded-xl border border-stone-200 text-stone-500 text-xs font-medium hover:border-stone-400 transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            {node.checkable && (
              <button
                onClick={onToggleDone}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-colors"
                style={node.done
                  ? { background: '#f5f5f4', color: '#78716c' }
                  : { background: color, color: 'white' }}
              >
                {node.done ? <><X size={13} /> Mark not built</> : <><Check size={13} /> Mark built</>}
              </button>
            )}
            <button
              onClick={onStartEdit}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-stone-200 text-stone-600 text-xs font-medium hover:border-stone-400 transition-colors"
            >
              <Pencil size={12} /> Edit
            </button>
            {!isRoot && (
              <button
                onClick={onDelete}
                className="ml-auto p-2 rounded-xl text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Desktop stage card ───────────────────────────────────────────────────────

function StageCard({
  placed, number, done, total, selected, onSelect, onToggleCollapse, onDelete,
}: {
  placed: Placed;
  number: number;
  done: number;
  total: number;
  selected: boolean;
  onSelect: () => void;
  onToggleCollapse: () => void;
  onDelete: () => void;
}) {
  const s = placed.node;
  return (
    <div
      onClick={onSelect}
      className={`absolute group bg-white rounded-xl border shadow-sm px-3 py-2 flex items-center gap-2.5 cursor-pointer transition-shadow hover:shadow-md ${selected ? 'ring-2' : 'border-stone-200'}`}
      style={{
        left: placed.x, top: placed.y, width: placed.w, minHeight: placed.h, zIndex: 10,
        ...(selected ? { ['--tw-ring-color' as string]: s.color ?? '#8c52ff' } : {}),
      }}
    >
      <span
        className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
        style={{ background: s.color ?? '#8c52ff' }}
      >
        {number}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[13px] text-stone-900 leading-tight truncate">{s.label || 'Untitled'}</p>
        <p className="text-[10px] text-stone-400 leading-tight mt-0.5 truncate">
          {total > 0 ? `${done}/${total} built` : 'no tasks yet'}{s.note ? ` · ${s.note}` : ''}
        </p>
      </div>
      <div className="flex items-center shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }}
          className="p-1 rounded text-stone-400 hover:text-stone-700"
          title={s.collapsed ? 'Expand' : 'Collapse'}
        >
          {s.collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="hidden group-hover:block p-1 rounded text-stone-400 hover:text-red-500"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

// ── Desktop task card ────────────────────────────────────────────────────────

function TaskCard({
  placed, color, selected, onSelect, onToggle, onDelete,
}: {
  placed: Placed;
  color: string;
  selected: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const n = placed.node;
  return (
    <div
      onClick={onSelect}
      className={`absolute group bg-white rounded-xl border shadow-sm px-2.5 flex items-center gap-2 cursor-pointer transition-shadow hover:shadow-md ${selected ? 'ring-2' : 'border-stone-200'}`}
      style={{
        left: placed.x, top: placed.y, width: placed.w, minHeight: placed.h, zIndex: 8,
        ...(selected ? { ['--tw-ring-color' as string]: color } : {}),
      }}
    >
      {n.checkable && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="shrink-0"
          title={n.done ? 'Mark not built' : 'Mark built'}
        >
          {n.done
            ? <CheckCircle2 size={16} style={{ color }} />
            : <Circle size={16} className="text-stone-300 hover:text-stone-500" />}
        </button>
      )}
      <p className={`flex-1 text-xs leading-snug py-1.5 ${n.done ? 'line-through text-stone-400' : 'text-stone-700'}`}>
        {n.label || <span className="text-stone-300">Untitled task</span>}
      </p>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="hidden group-hover:block p-1 rounded text-stone-400 hover:text-red-500 shrink-0"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}
