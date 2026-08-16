'use client';

// Their view, on her screen — 2026-08-11.
//
// The Settings panel listed which windows a client can open, and her question
// exposed the gap: "how will they see it." A list of window names is not their
// screen. This page IS their screen: the same components a client login
// renders, mounted for her, behind the same access answer (`clientView` asks
// `windowsForBinding`, the function that grants a real client their windows).
//
// LOOKING, NOT TOUCHING. Every window is wrapped in pointer-events-none, so
// she cannot accidentally approve her own post as the client or file an answer
// as them. The banner says so. A preview that can write is not a preview.

import { useState } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Eye } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import { clientView } from '@/lib/access/clientPreview';
import {
  AnalysisWindow, BrandWindow, ClientIntakeWindow,
} from '@/components/shell/ClientWindows';
import Board from '@/components/creation/Board';
import { accentFor } from '@/lib/shell/profile';

export default function ClientPreviewPage({ params }: { params: { id: string } }) {
  const { state, role } = useApp();
  const { client, data } = useClient(params.id);
  const [picked, setPicked] = useState<string | null>(null);

  if (role !== 'owner') notFound();

  const view = clientView(state, params.id);
  const active = view.open.find(w => w.id === picked) ?? view.open[0];
  const name = client?.name ?? 'this client';

  return (
    <div className="min-h-screen bg-paper">
      {/* The banner: whose eyes these are, and that hands are off. */}
      <div className="flex flex-wrap items-center gap-3 bg-ink px-4 py-3 text-white md:px-6">
        <Link href="/settings"
          className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[.12em] text-white/60 hover:text-white">
          <ChevronLeft size={14} strokeWidth={2.4} />
          Settings
        </Link>
        <span className="flex items-center gap-2 text-[13.5px] font-semibold">
          <Eye size={15} strokeWidth={2} />
          This is what {name}&apos;s client sees right now
        </span>
        <span className="text-[12px] text-white/55">Looking only. Nothing here can be pressed.</span>
      </div>

      {view.open.length === 0 ? (
        <div className="mx-auto max-w-2xl p-8">
          <p className="text-[15px] font-semibold text-text">They would see nothing at all.</p>
          <ul className="mt-3 space-y-1.5">
            {view.closed.map(w => (
              <li key={w.key} className="text-[13px] text-muted">
                <span className="font-semibold">{w.label}:</span>{' '}
                <span className="text-faint">{w.why}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          {/* Their navigation: exactly the windows the rules grant, no more. */}
          <div className="flex gap-1.5 overflow-x-auto border-b border-hairline bg-white px-4 py-2.5 md:px-6">
            {view.open.map(w => (
              <button key={w.id} type="button" onClick={() => setPicked(w.id)}
                className={`shrink-0 rounded-[10px] px-[13px] py-[7px] text-[12.5px] font-semibold ${
                  w.id === active?.id ? 'bg-ink text-white' : 'bg-control text-muted'
                }`}>
                {w.label}
              </button>
            ))}
          </div>

          {/* The window itself, the client's own component, hands off.
              2026-08-16: the windows are her folders now — Creation previews
              the real board read only, Analysis the approved publication. */}
          <div className="pointer-events-none select-none" aria-hidden="true">
            {active?.id === 'brand' && <BrandWindow profileId={params.id} />}
            {active?.id === 'intake' && <ClientIntakeWindow profileId={params.id} />}
            {active?.id === 'creation' && (
              <Board profileId={params.id} hue={accentFor(client, data)} readOnly
                onOpenPiece={() => undefined} />
            )}
            {active?.id === 'analysis' && <AnalysisWindow profileId={params.id} />}
          </div>
        </>
      )}
    </div>
  );
}
