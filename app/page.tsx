'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import Modal from '@/components/Modal';
import type { Client } from '@/types';

// ── Greeting helpers ────────────────────────────────────────────────────────

const GREETINGS = {
  morning:   ['Good morning',   'Rise and create',    'Morning'],
  afternoon: ['Good afternoon', 'Deep work o\'clock', 'Afternoon'],
  evening:   ['Good evening',   'Still at it',        'Evening hustle'],
  night:     ['Night mode on',  'Late-night session', 'Still creating'],
} as const;

function getGreeting(): string {
  const h   = new Date().getHours();
  const day = new Date().getDate();
  const pool =
    h >= 5 && h < 12 ? GREETINGS.morning
    : h < 17          ? GREETINGS.afternoon
    : h < 21          ? GREETINGS.evening
    :                   GREETINGS.night;
  return pool[day % pool.length];
}

function getDateLine(): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date());
}

// ── Floating icon definitions ───────────────────────────────────────────────
// match: tested against client name (case-insensitive)
// pos:   absolute placement within the full-screen container
// anim:  references one of the float1–float4 keyframes

const FLOATING_LOGOS = [
  {
    src:   '/logos/career-bubble.png',
    match: (n: string) => /career/i.test(n),
    pos:   { top: '28%', left: '6vw' } as React.CSSProperties,
    anim:  'float1 6s ease-in-out infinite',
  },
  {
    src:   '/logos/krnl.png',
    match: (n: string) => /krnl/i.test(n),
    pos:   { bottom: '26%', left: '10vw' } as React.CSSProperties,
    anim:  'float2 7.5s ease-in-out infinite',
    delay: '-2s',
  },
  {
    src:   '/logos/resume-guru.png',
    match: (n: string) => /resume/i.test(n),
    pos:   { top: '20%', right: '6vw' } as React.CSSProperties,
    anim:  'float3 5.5s ease-in-out infinite',
    delay: '-1s',
  },
  {
    src:   '/logos/divine-studio.png',
    match: (n: string) => /divine/i.test(n),
    pos:   { bottom: '24%', right: '6vw' } as React.CSSProperties,
    anim:  'float4 8s ease-in-out infinite',
    delay: '-3s',
  },
];

// ── Glass pill style ────────────────────────────────────────────────────────

const GLASS: React.CSSProperties = {
  background:           'rgba(255,255,255,0.14)',
  backdropFilter:       'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border:               '1px solid rgba(255,255,255,0.22)',
  boxShadow:            '0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.14)',
};

const GLASS_ADD: React.CSSProperties = {
  background:           'rgba(255,255,255,0.07)',
  backdropFilter:       'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border:               '1px dashed rgba(255,255,255,0.28)',
};

// ── Component ───────────────────────────────────────────────────────────────

export default function Home() {
  const { state, dispatch } = useApp();
  const router               = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');

  const greeting = getGreeting();
  const dateLine  = getDateLine();

  function addClient() {
    const n = newName.trim();
    if (!n) return;
    dispatch({ type: 'ADD_CLIENT', payload: { name: n } });
    setNewName('');
    setAddOpen(false);
  }

  // Find matching client for each logo definition
  function findClient(matcher: (n: string) => boolean): Client | undefined {
    return state.clients.find(c => matcher(c.name));
  }

  return (
    <>
      {/* ── Full-screen gradient stage ──────────────────────── */}
      <div
        className="min-h-screen relative overflow-hidden flex flex-col"
        style={{
          background:     'linear-gradient(-45deg, #8c52ff, #c35dcc, #ff914d, #c35dcc, #8c52ff)',
          backgroundSize: '400% 400%',
          animation:      'gradientDrift 14s ease infinite',
        }}
      >
        {/* Grain texture */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            opacity: 0.04,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat',
            backgroundSize:   '256px 256px',
          }}
        />

        {/* ── Floating client icons ──────────────────────────── */}
        {FLOATING_LOGOS.map((def) => {
          const client = findClient(def.match);
          const iconSize = 'clamp(90px, 12vw, 140px)';
          return (
            <div
              key={def.src}
              className="absolute"
              style={{
                ...def.pos,
                width:     iconSize,
                height:    iconSize,
                animation: def.anim,
                animationDelay: def.delay ?? '0s',
                zIndex: 20,
                cursor: client ? 'pointer' : 'default',
              }}
              onClick={() => client && router.push(`/client/${client.id}`)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={def.src}
                alt={client?.name ?? ''}
                className="w-full h-full object-contain transition-transform duration-200 hover:scale-110 active:scale-95"
                style={{
                  filter:       'drop-shadow(0 14px 28px rgba(0,0,0,0.28)) drop-shadow(0 4px 8px rgba(0,0,0,0.18))',
                  borderRadius: '22%',
                }}
                draggable={false}
              />
            </div>
          );
        })}

        {/* ── Content column ────────────────────────────────── */}
        <div className="relative flex flex-col min-h-screen px-5 md:px-14 lg:px-20" style={{ zIndex: 10 }}>

          {/* Date + greeting */}
          <div className="pt-14 md:pt-16 shrink-0 text-center">
            <p className="text-white/50 text-[11px] font-medium tracking-[0.22em] uppercase mb-2">
              {dateLine}
            </p>
            <p
              className="text-white/80 text-base md:text-lg"
              style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500 }}
            >
              {greeting},&nbsp;
              <span className="text-white" style={{ fontWeight: 700 }}>Manmeet.</span>
            </p>
          </div>

          {/* Giant name */}
          <div className="flex-1 flex items-center justify-center overflow-visible">
            <h1
              className="text-white text-center select-none"
              style={{
                fontSize:      'clamp(68px, 18vw, 240px)',
                fontFamily:    "'Inter', sans-serif",
                fontWeight:    900,
                letterSpacing: '-0.025em',
                lineHeight:    0.88,
              }}
            >
              Manmeet
            </h1>
          </div>

          {/* Glass client pills */}
          <div className="pb-10 md:pb-14 shrink-0 flex flex-col items-center">
            <p className="text-white/40 text-[10px] font-medium tracking-[0.22em] uppercase mb-3 mt-5">
              {state.clients.length === 0 ? 'No clients yet' : 'Clients'}
            </p>
            <div className="flex flex-wrap justify-center gap-2.5">
              {state.clients.map(client => (
                <button
                  key={client.id}
                  onClick={() => router.push(`/client/${client.id}`)}
                  className="group flex items-center gap-2.5 pl-3 pr-4 py-2.5 rounded-2xl
                             transition-all duration-200 hover:scale-[1.04] active:scale-[0.97]"
                  style={GLASS}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: client.color }} />
                  <span
                    className="text-white text-sm"
                    style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600 }}
                  >
                    {client.name}
                  </span>
                  <span className="text-white/35 text-xs ml-0.5 transition-colors group-hover:text-white/65">↗</span>
                </button>
              ))}

              <button
                onClick={() => setAddOpen(true)}
                className="flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-2xl
                           transition-all duration-200 hover:scale-[1.04] active:scale-[0.97]"
                style={GLASS_ADD}
              >
                <Plus size={12} className="text-white/50" />
                <span className="text-white/50 text-sm" style={{ fontFamily: "'Inter', sans-serif" }}>
                  Add client
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Add-client modal ──────────────────────────────────── */}
      <Modal
        open={addOpen}
        onClose={() => { setAddOpen(false); setNewName(''); }}
        title="New Client"
        size="sm"
      >
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Client name</label>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addClient()}
              placeholder="e.g. CareerBubble"
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setAddOpen(false); setNewName(''); }} className="btn-secondary">Cancel</button>
            <button onClick={addClient} disabled={!newName.trim()} className="btn-primary">Add</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
