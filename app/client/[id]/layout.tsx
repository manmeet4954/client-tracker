'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, BookMarked, Palette, Menu, PhoneCall, ClipboardList, ShoppingBag, Images, Instagram, Columns3, FolderOpen, MessageCircle, ListTodo, Flag, BarChart3, BookOpen, Compass, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Tab = { label: string; href: string; icon: LucideIcon };
import Sidebar from '@/components/Sidebar';
import { useClient, useApp } from '@/contexts/AppContext';
import { isCutOver, staysOnLegacy } from '@/lib/shell/profile';
import { legacyDestination } from '@/lib/shell/routes';

const TABS = [
  { label: 'Dashboard', href: '', icon: LayoutDashboard },
  { label: 'Content', href: '/content', icon: Columns3 },
  { label: 'Journey', href: '/journey', icon: Flag },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { label: 'Lists', href: '/lists', icon: ListTodo },
  { label: 'Assets', href: '/assets', icon: FolderOpen },
  { label: 'References', href: '/references', icon: BookMarked },
  { label: 'Brand', href: '/brand', icon: Palette },
  { label: 'Previews', href: '/previews', icon: Instagram },
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
  const { role, state } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const base = `/client/${params.id}`;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Spec 28 §11.2 and §16.5 — the per-profile cutover, in ONE place ────────
  //
  // Every legacy address keeps rendering, unchanged, until THAT profile cuts
  // over: a migrated body AND a locked strategy (§16.3). After that it
  // permanently redirects to its new address. Nothing is deleted, nothing is
  // copied, and no data is written by the cutover — it is a routing change over
  // data that already moved.
  //
  // §19's interim ruling holds here too: a staff binding and Sonia's binding
  // keep these screens for that profile until she answers.
  const bindingKind = (state.bindings ?? [])
    .find(b => b.role === role && b.profileId === params.id)?.kind;
  const movesOn = !staysOnLegacy(role, bindingKind) && isCutOver(data);
  const newAddress = movesOn ? legacyDestination(pathname, params.id) : null;
  useEffect(() => {
    if (newAddress) router.replace(newAddress);
  }, [newAddress, router]);

  // Shiva's login doesn't get the Dashboard tab, so her landing page is the
  // Content board. Merushri has the full workspace including Dashboard.
  const isClientRole = role === 'shiva' || role === 'merushri';
  useEffect(() => {
    if (role === 'shiva' && pathname === base) router.replace(`${base}/content`);
  }, [role, pathname, base, router]);

  // Derive accent from brand kit; falls back to the client's stored color
  const accent = client ? pickAccent(data.brandKit?.colors ?? [], client.color) : '#ea4711';

  if (!client) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-stone-400">Client not found</p>
      </div>
    );
  }
  if (newAddress) return null;   // this profile has cut over; the redirect is running

  // Client-specific extra tabs
  const tabs: Tab[] = [...TABS];

  // Spec 22: intake, curation and strategy are HERS. The client never sees the
  // workshop, and staff logins do not run a profile's strategy.
  if (role === 'owner') {
    tabs.push({ label: 'Intake', href: '/intake', icon: ClipboardList });
    tabs.push({ label: 'Curation', href: '/curation', icon: BookOpen });
    tabs.push({ label: 'Strategy', href: '/strategy', icon: Compass });
    // Spec 23: the Engine Room. Hers, always — the workshop rule is absolute.
    tabs.push({ label: 'Engine', href: '/engine', icon: Sparkles });
  }
  if (/divine/i.test(client.name)) {
    tabs.push({ label: 'Cold Calls', href: '/coldcalls', icon: PhoneCall });
    tabs.push({ label: 'Answers', href: '/answers', icon: MessageCircle });
  }
  if (/shiva/i.test(client.name)) tabs.push({ label: 'Onboarding', href: '/onboarding', icon: ClipboardList });
  if (/sonia|crochet/i.test(client.name)) {
    tabs.push({ label: 'Orders', href: '/orders', icon: ShoppingBag });
    tabs.push({ label: 'Catalogue', href: '/catalogue', icon: Images });
  }

  // Restricted roles get a reduced tab set:
  //  - Sonia: References, Orders, Catalogue
  //  - Shiva: Content, Analytics, Assets, References, Brand, Previews
  //  - Merushri: the full workspace (Dashboard, Content, Journey, Analytics,
  //    Lists, Assets, References, Brand, Previews)
  // Analytics is client-facing by design (Spec 05): each client login only
  // ever reaches its own client's tab, and the /api/analytics route re-checks
  // that server side.
  const visibleTabs = role === 'sonia'
    ? tabs.filter(t => ['/references', '/orders', '/catalogue'].includes(t.href))
    : role === 'shiva'
    ? tabs.filter(t => ['/content', '/analytics', '/assets', '/references', '/brand', '/previews'].includes(t.href))
    : tabs;

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
            {visibleTabs.map(tab => {
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
            {visibleTabs.map(tab => {
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
