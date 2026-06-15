'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Kanban, BookMarked, Palette, Repeat, Menu, Sparkles, PhoneCall } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { useClient } from '@/contexts/AppContext';

const TABS = [
  { label: 'Dashboard', href: '', icon: LayoutDashboard },
  { label: 'Kanban', href: '/kanban', icon: Kanban },
  { label: 'Evergreen', href: '/evergreen', icon: Repeat },
  { label: 'References', href: '/references', icon: BookMarked },
  { label: 'Brand', href: '/brand', icon: Palette },
  { label: 'Studio', href: '/studio', icon: Sparkles },
];

/** Pick the best accent colour for a client:
 *  1. Brand kit color with role containing "primary" or "accent"
 *  2. First brand kit color (whatever it is)
 *  3. Fall back to the client's stored color */
function pickAccent(brandColors: { hex: string; role?: string }[], fallback: string): string {
  const primary = brandColors.find(c => /primary|accent/i.test(c.role ?? ''));
  return primary?.hex ?? brandColors[0]?.hex ?? fallback;
}

export default function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const { client, data } = useClient(params.id);
  const pathname = usePathname();
  const base = `/client/${params.id}`;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Derive accent from brand kit; falls back to the client's stored color
  const accent = client ? pickAccent(data.brandKit?.colors ?? [], client.color) : '#ea4711';

  if (!client) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-stone-400">Client not found</p>
      </div>
    );
  }

  // Cold Calls is a Divine Studio–specific lead tracker
  const isDivine = /divine/i.test(client.name);
  const tabs = isDivine
    ? [...TABS, { label: 'Cold Calls', href: '/coldcalls', icon: PhoneCall }]
    : TABS;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Desktop header */}
        <header className="hidden md:flex flex-col bg-white border-b border-stone-200 shrink-0">
          {/* Identity band */}
          <div
            className="flex items-center gap-3 px-6 py-3.5"
            style={{
              background: `linear-gradient(to right, ${accent}22 0%, ${accent}08 45%, transparent 75%)`,
              borderBottom: `1px solid ${accent}18`,
            }}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${accent}25` }}
            >
              <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: accent }} />
            </div>
            <h1 className="font-bold text-stone-900 text-base leading-none">{client.name}</h1>
          </div>
          {/* Tab nav */}
          <nav className="flex items-center gap-1 px-6">
            {tabs.map(tab => {
              const href = `${base}${tab.href}`;
              const isActive = tab.href === '' ? pathname === base : pathname.startsWith(`${base}${tab.href}`);
              const Icon = tab.icon;
              return (
                <Link key={tab.href} href={href}
                  className={`flex items-center gap-1.5 px-3 py-3 text-sm border-b-2 transition-colors font-medium ${
                    isActive ? '' : 'border-transparent text-stone-500 hover:text-stone-900 !font-normal'
                  }`}
                  style={isActive ? { borderColor: accent, color: accent } : {}}>
                  <Icon size={14} />
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </header>

        {/* Mobile header */}
        <header className="md:hidden bg-white border-b border-stone-200 shrink-0">
          {/* Identity band */}
          <div
            className="flex items-center gap-3 px-4 py-3"
            style={{
              background: `linear-gradient(to right, ${accent}22 0%, transparent 70%)`,
            }}
          >
            <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg text-stone-600 hover:bg-black/5 transition-colors">
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${accent}28` }}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: accent }} />
              </div>
              <h1 className="font-bold text-stone-900 text-sm">{client.name}</h1>
            </div>
          </div>
          {/* Mobile tab bar — horizontal scroll */}
          <nav className="flex overflow-x-auto border-t border-stone-100 px-2 no-scrollbar">
            {tabs.map(tab => {
              const href = `${base}${tab.href}`;
              const isActive = tab.href === '' ? pathname === base : pathname.startsWith(`${base}${tab.href}`);
              const Icon = tab.icon;
              return (
                <Link key={tab.href} href={href}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-xs whitespace-nowrap border-b-2 transition-colors shrink-0 font-medium ${
                    isActive ? '' : 'border-transparent text-stone-500 !font-normal'
                  }`}
                  style={isActive ? { borderColor: accent, color: accent } : {}}>
                  <Icon size={13} />
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="flex-1 overflow-y-auto bg-[#F7F7F5]">
          {children}
        </main>
      </div>
    </div>
  );
}
