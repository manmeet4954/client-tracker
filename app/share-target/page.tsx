'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, AlertCircle } from 'lucide-react';

type Status = 'saving' | 'saved' | 'empty' | 'error';

// Try to send the user straight back to the app they shared from.
function dismiss() {
  try { window.close(); } catch { /* ignore */ }
  // Fallback for browsers that won't let a tab close itself:
  try { history.length > 1 ? history.back() : (window.location.href = 'about:blank'); } catch { /* ignore */ }
}

export default function ShareTargetPage() {
  const [status, setStatus] = useState<Status>('saving');

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const url = p.get('url') ?? '';
    const text = p.get('text') ?? '';
    const title = p.get('title') ?? '';

    if (!url && !text && !title) { setStatus('empty'); return; }

    fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, text, title }),
    })
      .then(res => {
        if (!res.ok) { setStatus('error'); return; }
        setStatus('saved');
        // Flash the confirmation, then bounce back to the previous app.
        setTimeout(dismiss, 900);
      })
      .catch(() => setStatus('error'));
  }, []);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6 text-center"
      style={{ background: 'linear-gradient(120deg, #8c52ff 0%, #c35dcc 52%, #ff914d 100%)' }}
    >
      <div className="flex flex-col items-center">
        {status === 'saving' && (
          <>
            <Loader2 size={44} className="text-white animate-spin mb-4" />
            <p className="text-white font-semibold text-lg">Saving…</p>
          </>
        )}

        {status === 'saved' && (
          <>
            <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center mb-4 shadow-lg">
              <Check size={40} className="text-emerald-500" strokeWidth={3} />
            </div>
            <p className="text-white font-bold text-2xl">Saved ✓</p>
            <p className="text-white/75 text-sm mt-1">Back to your app…</p>
          </>
        )}

        {(status === 'error' || status === 'empty') && (
          <>
            <AlertCircle size={44} className="text-white mb-4" />
            <p className="text-white font-semibold text-lg">
              {status === 'empty' ? 'Nothing to save' : "Couldn't save"}
            </p>
            <p className="text-white/75 text-sm mt-1 max-w-xs">
              {status === 'empty'
                ? 'No link was shared.'
                : 'Please try sharing again.'}
            </p>
            <button
              onClick={dismiss}
              className="mt-5 px-5 py-2.5 rounded-xl font-semibold text-stone-900 bg-white hover:bg-white/90 transition-colors"
            >
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}
