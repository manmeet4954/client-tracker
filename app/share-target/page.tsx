'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, AlertCircle, BookMarked } from 'lucide-react';

type Status = 'saving' | 'saved' | 'empty' | 'error';

export default function ShareTargetPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('saving');
  const [clientName, setClientName] = useState('');
  const [savedUrl, setSavedUrl] = useState('');

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const url = p.get('url') ?? '';
    const text = p.get('text') ?? '';
    const title = p.get('title') ?? '';
    setSavedUrl(url || (text.match(/https?:\/\/\S+/)?.[0] ?? text));

    if (!url && !text && !title) { setStatus('empty'); return; }

    fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, text, title }),
    })
      .then(async res => {
        if (!res.ok) { setStatus('error'); return; }
        const d = await res.json().catch(() => ({}));
        setClientName(d.clientName ?? 'References');
        setStatus('saved');
      })
      .catch(() => setStatus('error'));
  }, []);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6 text-center"
      style={{ background: 'linear-gradient(120deg, #8c52ff 0%, #c35dcc 52%, #ff914d 100%)' }}
    >
      <div
        className="w-full max-w-sm rounded-3xl p-8 flex flex-col items-center"
        style={{
          background: 'rgba(255,255,255,0.16)',
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
          border: '1px solid rgba(255,255,255,0.28)',
        }}
      >
        {status === 'saving' && (
          <>
            <Loader2 size={40} className="text-white animate-spin mb-4" />
            <p className="text-white font-semibold text-lg">Saving…</p>
          </>
        )}

        {status === 'saved' && (
          <>
            <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mb-4">
              <Check size={32} className="text-emerald-500" strokeWidth={3} />
            </div>
            <p className="text-white font-bold text-xl">Saved!</p>
            <p className="text-white/80 text-sm mt-1">
              Added to <strong>{clientName}</strong> references.
            </p>
            {savedUrl && (
              <p className="text-white/55 text-xs mt-3 break-all line-clamp-2 max-w-full">{savedUrl}</p>
            )}
            <button
              onClick={() => router.replace('/clients')}
              className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-stone-900 bg-white hover:bg-white/90 transition-colors"
            >
              <BookMarked size={16} /> Open dashboard
            </button>
            <p className="text-white/50 text-xs mt-3">You can close this and keep scrolling.</p>
          </>
        )}

        {(status === 'error' || status === 'empty') && (
          <>
            <AlertCircle size={40} className="text-white mb-4" />
            <p className="text-white font-semibold text-lg">
              {status === 'empty' ? 'Nothing to save' : "Couldn't save"}
            </p>
            <p className="text-white/75 text-sm mt-1">
              {status === 'empty'
                ? 'No link was shared.'
                : 'Try again, or open the dashboard and add it manually.'}
            </p>
            <button
              onClick={() => router.replace('/clients')}
              className="mt-6 px-5 py-2.5 rounded-xl font-semibold text-stone-900 bg-white hover:bg-white/90 transition-colors"
            >
              Open dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}
