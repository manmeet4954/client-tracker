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

// Every role's passcode env var, in one place so secret() and
// roleForPasscode() can never drift apart.
const PASSCODE_ENVS: [Role, string][] = [
  ['owner', 'OWNER_PASSCODE'],
  ['intern', 'INTERN_PASSCODE'],
  ['sonia', 'MOM_PASSCODE'],
  ['shiva', 'SHIVA_PASSCODE'],
  ['merushri', 'MERUSHRI_PASSCODE'],
];

const ALL_ROLES: Role[] = PASSCODE_ENVS.map(([r]) => r);

function secret(): string {
  const parts = PASSCODE_ENVS.map(([, env]) => process.env[env] ?? '');
  return `${parts.join('::')}::dash-session-v1`;
}

/** Match a submitted passcode to a role, or null if it matches none.
 *  Trims both sides so a stray space/newline in the env value can't break it. */
export function roleForPasscode(passcode: string): Role | null {
  const p = passcode.trim();
  for (const [role, env] of PASSCODE_ENVS) {
    const v = process.env[env]?.trim();
    if (v && p === v) return role;
  }
  return null;
}

/** True for roles that should stay logged in across app opens.
 *  Everyone except the owner persists (intern, mom, client logins). */
export function rolePersists(role: Role): boolean {
  return role !== 'owner';
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
  const role = token.slice(0, dot) as Role;
  const sig = token.slice(dot + 1);
  if (!ALL_ROLES.includes(role)) return null;
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
