'use client';

import { useState } from 'react';
import { Lock, ArrowRight } from 'lucide-react';

export default function PasscodeGate({ onSubmit, error }: {
  onSubmit: (passcode: string) => void | Promise<void>;
  error?: string;
}) {
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!pass.trim() || busy) return;
    setBusy(true);
    await onSubmit(pass.trim());
    setBusy(false);
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'linear-gradient(120deg, #8c52ff 0%, #c35dcc 52%, #ff914d 100%)' }}
    >
      <div
        className="w-full max-w-sm rounded-3xl p-7"
        style={{
          background: 'rgba(255,255,255,0.16)',
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
          border: '1px solid rgba(255,255,255,0.28)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.18)',
        }}
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
          style={{ background: 'rgba(255,255,255,0.22)', border: '1px solid rgba(255,255,255,0.3)' }}
        >
          <Lock size={20} className="text-white" />
        </div>

        <h1 className="text-white text-xl font-bold" style={{ fontFamily: "'Inter', sans-serif" }}>
          Enter passcode
        </h1>
        <p className="text-white/70 text-sm mt-1 mb-5">This dashboard is private.</p>

        <input
          autoFocus
          type="password"
          inputMode="text"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          value={pass}
          onChange={e => setPass(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Passcode"
          className="w-full px-4 py-3 rounded-xl text-white placeholder-white/50 focus:outline-none"
          style={{
            background: 'rgba(255,255,255,0.14)',
            border: '1px solid rgba(255,255,255,0.28)',
          }}
        />

        {error && <p className="text-white text-xs mt-2 font-medium bg-red-500/30 rounded-lg px-3 py-1.5">{error}</p>}

        <button
          onClick={submit}
          disabled={!pass.trim() || busy}
          className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-stone-900 bg-white hover:bg-white/90 disabled:opacity-50 transition-colors"
        >
          {busy ? 'Checking…' : <>Enter <ArrowRight size={16} /></>}
        </button>
      </div>
    </div>
  );
}
