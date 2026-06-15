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
  return `${o}::${i}::dash-session-v1`;
}

/** Match a submitted passcode to a role, or null if it matches neither. */
export function roleForPasscode(passcode: string): Role | null {
  const o = process.env.OWNER_PASSCODE;
  const i = process.env.INTERN_PASSCODE;
  if (o && passcode === o) return 'owner';
  if (i && passcode === i) return 'intern';
  return null;
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
  if (role !== 'owner' && role !== 'intern') return null;
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
export const SESSION_MAX_AGE = 60 * 60 * 24 * 365; // 1 year (refreshed on each visit)

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_MAX_AGE,
  };
}
