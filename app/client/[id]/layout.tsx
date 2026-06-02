'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Kanban, BookMarked, Palette, Menu } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { useClient } from '@/contexts/AppContext';

const TABS = [
  { label: 'Dashboard', href: '', icon: LayoutDashboard },
  { label: 'Kanban', href: '/kanban', icon: Kanban },
  { label: 'References', href: '/references', icon: BookMarked },
  { label: 'Brand', href: '/brand', icon: Palette },
];

export default function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const { client } = useClient(params.id);
  const pathname = usePathname();
  const base = `/client/${params.id}`;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!client) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-stone-400">Client not found</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Desktop header */}
        <header className="hidden md:flex bg-white border-b border-stone-200 items-center gap-4 px-6 py-0 shrink-0">
          <div className="flex items-center gap-2.5 py-4">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: client.color }} />
            <h1 className="font-semibold text-stone-900">{client.name}</h1>
          </div>
          <nav className="flex items-center gap-1">
            {TABS.map(tab => {
              const href = `${base}${tab.href}`;
              const isActive = tab.href === '' ? pathname === base : pathname.startsWith(`${base}${tab.href}`);
              const Icon = tab.icon;
              return (
                <Link key={tab.href} href={href}
                  className={`flex items-center gap-1.5 px-3 py-3 text-sm border-b-2 transition-colors ${
                    isActive ? 'border-accent text-accent font-medium' : 'border-transparent text-stone-500 hover:text-stone-900'
                  }`}>
                  <Icon size={14} />
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </header>

        {/* Mobile header */}
        <header className="md:hidden bg-white border-b border-stone-200 shrink-0">
          <div className="flex items-center gap-3 px-4 py-3">
            <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg text-stone-600 hover:bg-stone-100 transition-colors">
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: client.color }} />
              <h1 className="font-semibold text-stone-900 text-sm">{client.name}</h1>
            </div>
          </div>
          {/* Mobile tab bar — horizontal scroll */}
          <nav className="flex overflow-x-auto border-t border-stone-100 px-2 no-scrollbar">
            {TABS.map(tab => {
              const href = `${base}${tab.href}`;
              const isActive = tab.href === '' ? pathname === base : pathname.startsWith(`${base}${tab.href}`);
              const Icon = tab.icon;
              return (
                <Link key={tab.href} href={href}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-xs whitespace-nowrap border-b-2 transition-colors shrink-0 ${
                    isActive ? 'border-accent text-accent font-medium' : 'border-transparent text-stone-500'
                  }`}>
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
