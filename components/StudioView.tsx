'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Layers } from 'lucide-react';
import { useClient } from '@/contexts/AppContext';
import StudioTemplates from './StudioTemplates';
import StudioFreeform from './StudioFreeform';
import { BrandKit } from '@/types';

type Mode = 'templates' | 'freeform';

export default function StudioView({ clientId }: { clientId: string }) {
  const { client, data } = useClient(clientId);
  const [mode, setMode] = useState<Mode>('templates');
  const brandKit: BrandKit = data.brandKit ?? { colors: [], fonts: [] };

  // Dynamically inject Google Fonts for any custom brand fonts
  useEffect(() => {
    if (!brandKit.fonts.length) return;
    const families = brandKit.fonts
      .map(f => `family=${f.name.replace(/ /g, '+')}:wght@300;400;500;600;700`)
      .join('&');
    const href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
    const existing = document.head.querySelector(`link[href="${href}"]`);
    if (existing) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }, [JSON.stringify(brandKit.fonts)]);

  if (!client) return null;

  return (
    <div className="h-full flex flex-col">
      {/* Mode toggle header */}
      <div className="bg-white border-b border-stone-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-stone-400" />
          <span className="text-sm font-medium text-stone-700">Studio</span>
          <span className="text-xs text-stone-400 ml-1">— create on-brand visuals</span>
        </div>
        <div className="flex items-center bg-stone-100 rounded-lg p-0.5 gap-0.5">
          <button
            onClick={() => setMode('templates')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
              mode === 'templates' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            <Sparkles size={12} />
            Templates
          </button>
          <button
            onClick={() => setMode('freeform')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
              mode === 'freeform' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            <Layers size={12} />
            Freeform
          </button>
        </div>
      </div>

      {/* Mode content */}
      <div className="flex-1 overflow-hidden">
        {mode === 'templates'
          ? <StudioTemplates clientId={clientId} accent={client.color} brandKit={brandKit} />
          : <StudioFreeform clientId={clientId} accent={client.color} brandKit={brandKit} />
        }
      </div>
    </div>
  );
}
