import crypto from 'crypto';
import type { Role } from './access';

/**
 * Auth is OPT-IN. Until OWNER_PASSCODE is set in the environment, the app runs
 * in "open mode" exactly as before (everyone is the owner, no gate). Setting
 * OWNER_PASSCODE (and INTERN_PASSCODE) turns on the passcode gate + roles.
 */
export function authConfigured(): boolean {
  return !!process.env.OWNER_PASSCODE;
}

function secret(): string {
  const o = process.env.OWNER_PASSCODE ?? '';
  const i = process.env.INTERN_PASSCODE ?? '';
  const m = process.env.MOM_PASSCODE ?? '';
  return `${o}::${i}::${m}::dash-session-v1`;
}

/** Match a submitted passcode to a role, or null if it matches none.
 *  Trims both sides so a stray space/newline in the env value can't break it. */
export function roleForPasscode(passcode: string): Role | null {
  const p = passcode.trim();
  const o = process.env.OWNER_PASSCODE?.trim();
  const i = process.env.INTERN_PASSCODE?.trim();
  const m = process.env.MOM_PASSCODE?.trim();
  if (o && p === o) return 'owner';
  if (i && p === i) return 'intern';
  if (m && p === m) return 'sonia';
  return null;
}

/** True for roles that should stay logged in across app opens. */
export function rolePersists(role: Role): boolean {
  return role === 'sonia';
}

/** Sign a role into a tamper-proof session token (role.hmac). */
export function signRole(role: Role): string {
  const sig = crypto.createHmac('sha256', secret()).update(role).digest('hex');
  return `${role}.${sig}`;
}

/** Verify a session token and return its role, or null if invalid/forged. */
export function verifyToken(token: string | undefined | null): Role | null {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot < 0) return null;
  const role = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (role !== 'owner' && role !== 'intern' && role !== 'sonia') return null;
  const expected = crypto.createHmac('sha256', secret()).update(role).digest('hex');
  if (sig.length !== expected.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return role;
}

export const SESSION_COOKIE = 'dash_session';

// Cookie lifetime depends on role:
//  - persistent roles (mom) get a 1-year cookie → stay logged in
//  - everyone else gets a session cookie → re-auth on each fresh open
export function cookieOptionsForRole(role: Role) {
  const base = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/' };
  return rolePersists(role) ? { ...base, maxAge: 60 * 60 * 24 * 365 } : base;
}
