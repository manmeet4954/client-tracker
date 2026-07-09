import crypto from 'crypto';
import { CanvaToken } from '@/types';
import { readCanvaToken, writeCanvaToken } from './supabaseServer';

// Canva Connect API integration. Lets the owner pull a design's pages straight
// into a preview instead of exporting from Canva and re-uploading by hand.
//
// Setup (one time, done by Manmeet in the Canva Developer portal):
//   CANVA_CLIENT_ID     — the integration's client id
//   CANVA_CLIENT_SECRET — the integration's secret (server-side only)
//   CANVA_REDIRECT_URI  — must exactly match the redirect URL registered in the
//                         portal, e.g. https://<domain>/api/canva/callback
//
// Scopes: read design content (needed to export) + read design metadata.
export const CANVA_SCOPES = 'design:content:read design:meta:read';

const AUTH_BASE = 'https://www.canva.com/api/oauth/authorize';
const TOKEN_URL = 'https://api.canva.com/rest/v1/oauth/token';
const EXPORTS_URL = 'https://api.canva.com/rest/v1/exports';

export function canvaConfigured(): boolean {
  return !!(process.env.CANVA_CLIENT_ID && process.env.CANVA_CLIENT_SECRET && process.env.CANVA_REDIRECT_URI);
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// PKCE — a code verifier (kept in a cookie) and its hashed challenge (sent to
// Canva) so the auth code can't be exchanged by anyone but us.
export function makePkce() {
  const verifier = base64url(crypto.randomBytes(64));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

export function makeState(): string {
  return base64url(crypto.randomBytes(24));
}

export function authorizeUrl(challenge: string, state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.CANVA_CLIENT_ID!,
    redirect_uri: process.env.CANVA_REDIRECT_URI!,
    scope: CANVA_SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
  });
  return `${AUTH_BASE}?${params.toString()}`;
}

function basicAuthHeader(): string {
  const raw = `${process.env.CANVA_CLIENT_ID}:${process.env.CANVA_CLIENT_SECRET}`;
  return `Basic ${Buffer.from(raw).toString('base64')}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  scope: string;
}

function toStored(res: TokenResponse): CanvaToken {
  return {
    accessToken: res.access_token,
    refreshToken: res.refresh_token,
    // Refresh a minute early so we never send an already-expired token.
    expiresAt: Date.now() + (res.expires_in - 60) * 1000,
    scope: res.scope,
  };
}

// Exchange the authorization code (from the redirect) for tokens, and store them.
export async function exchangeCode(code: string, verifier: string): Promise<void> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    code_verifier: verifier,
    redirect_uri: process.env.CANVA_REDIRECT_URI!,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: basicAuthHeader(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`Canva token exchange failed (${res.status}): ${await res.text()}`);
  await writeCanvaToken(toStored((await res.json()) as TokenResponse));
}

async function refresh(token: CanvaToken): Promise<CanvaToken> {
  const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: token.refreshToken });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: basicAuthHeader(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`Canva token refresh failed (${res.status}): ${await res.text()}`);
  const stored = toStored((await res.json()) as TokenResponse);
  await writeCanvaToken(stored);
  return stored;
}

// Return a usable access token, refreshing first if it has (nearly) expired.
// null means the user has not connected Canva yet.
export async function getValidAccessToken(): Promise<string | null> {
  const token = await readCanvaToken();
  if (!token) return null;
  if (Date.now() < token.expiresAt) return token.accessToken;
  const refreshed = await refresh(token);
  return refreshed.accessToken;
}

export async function isConnected(): Promise<boolean> {
  return (await readCanvaToken()) !== null;
}

// A Canva design link looks like https://www.canva.com/design/<ID>/<...>. Accept
// either a full link or a bare design id.
export function designIdFromInput(input: string): string | null {
  const trimmed = input.trim();
  const m = trimmed.match(/canva\.com\/design\/([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{6,}$/.test(trimmed)) return trimmed;
  return null;
}

interface ExportJob {
  id: string;
  status: 'in_progress' | 'success' | 'failed';
  urls?: string[];
  error?: { message?: string };
}

// Kick off a PNG export of every page, poll until done, and return the page
// image URLs (Canva-hosted, valid ~24h — callers should re-host them).
export async function exportDesignPages(designId: string, accessToken: string): Promise<string[]> {
  const start = await fetch(EXPORTS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ design_id: designId, format: { type: 'png' } }),
  });
  if (!start.ok) throw new Error(`Canva export request failed (${start.status}): ${await start.text()}`);
  let job = ((await start.json()) as { job: ExportJob }).job;

  const deadline = Date.now() + 90_000; // give large decks time, but never hang forever
  while (job.status === 'in_progress') {
    if (Date.now() > deadline) throw new Error('Canva export timed out. Try again, or a smaller design.');
    await new Promise(r => setTimeout(r, 1500));
    const poll = await fetch(`${EXPORTS_URL}/${job.id}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!poll.ok) throw new Error(`Canva export status failed (${poll.status}): ${await poll.text()}`);
    job = ((await poll.json()) as { job: ExportJob }).job;
  }

  if (job.status !== 'success' || !job.urls?.length) {
    throw new Error(job.error?.message ?? 'Canva export did not produce any pages.');
  }
  return job.urls;
}
