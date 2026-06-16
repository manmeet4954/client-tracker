'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Users } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
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

// ── Component ───────────────────────────────────────────────────────────────

export default function Home() {
  const { state, role }  = useApp();
  const router     = useRouter();
  const [popping, setPopping] = useState(false);

  // Restricted roles don't get the personal home — send them to their clients.
  useEffect(() => {
    if (role !== 'owner') router.replace('/clients');
  }, [role, router]);

  const greeting = getGreeting();
  const dateLine  = getDateLine();

  const pendingTotal = (state.personalTasks ?? []).filter(t => !t.done).length;

  if (role !== 'owner') return null;

  function openMyDay() {
    setPopping(true);
    setTimeout(() => router.push('/me'), 260);
  }

  function visitClients() {
    router.push('/clients');
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

          {/* Giant name — tap to open My Day */}
          <div className="flex-1 flex flex-col items-center justify-center overflow-visible">
            <button
              onClick={openMyDay}
              aria-label="Open my personal dashboard"
              className={`text-white text-center select-none cursor-pointer transition-transform duration-200 hover:scale-[1.015] ${popping ? 'name-pop' : ''}`}
              style={{
                fontSize:      'clamp(68px, 18vw, 240px)',
                fontFamily:    "'Inter', sans-serif",
                fontWeight:    900,
                letterSpacing: '-0.025em',
                lineHeight:    0.88,
                background:    'none',
                border:        'none',
                padding:       0,
              }}
            >
              Manmeet
            </button>
          </div>

          {/* Two primary actions */}
          <div className="pb-12 md:pb-16 shrink-0 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={openMyDay}
              className="flex items-center gap-2.5 px-5 py-3 rounded-2xl transition-all duration-200 hover:scale-[1.04] active:scale-[0.97]"
              style={GLASS}
            >
              <Sparkles size={16} className="text-white" />
              <span className="text-white text-sm md:text-base font-semibold" style={{ fontFamily: "'Inter', sans-serif" }}>
                Open My Day
              </span>
              {pendingTotal > 0 && (
                <span className="text-[11px] text-white/80 bg-white/20 rounded-full px-2 py-0.5 font-medium">{pendingTotal}</span>
              )}
              <span className="text-white/45 text-sm">→</span>
            </button>

            <button
              onClick={visitClients}
              className="flex items-center gap-2.5 px-5 py-3 rounded-2xl transition-all duration-200 hover:scale-[1.04] active:scale-[0.97]"
              style={GLASS}
            >
              <Users size={16} className="text-white" />
              <span className="text-white text-sm md:text-base font-semibold" style={{ fontFamily: "'Inter', sans-serif" }}>
                Visit Clients
              </span>
              <span className="text-white/45 text-sm">→</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
