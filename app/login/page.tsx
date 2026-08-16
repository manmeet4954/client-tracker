'use client';

// `/login` — the door to the sign-in screen. 2026-08-11.
//
// Until tonight this address did not exist, and its absence broke the whole
// invite flow from her side: the app link walks straight into whatever session
// the browser already holds, so SHE — signed in as herself — could never reach
// the code screen at all. Her verdict was earned: "they made the link and code
// for me, but the link is just the app link... there is no way to add the
// code." A client on a fresh phone would have seen the gate; the person who
// needed to VERIFY that never could.
//
// Visiting this address signs the current session out and lands on the gate,
// every time, whoever you were. That makes it the right link to send with an
// invite code (a client on a shared or already-signed-in device still gets the
// gate) and the way she tests any client's code herself.

import { useEffect } from 'react';

export default function LoginPage() {
  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth', { method: 'DELETE' })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) window.location.replace('/');
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper">
      <p className="text-sm text-muted">Opening the sign-in screen…</p>
    </div>
  );
}
