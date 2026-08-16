import { createClient } from '@supabase/supabase-js';
import { AppState, InstagramProfile, PreviewPost, CanvaToken } from '@/types';
import { applyScopes } from '@/lib/tree/scopes';

// Server-only Supabase access. Prefer the service role key (bypasses RLS) so
// public pages like /p/[shareId] can always read state without auth context.
// Falls back to the anon key in environments where service role isn't set.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const DB_ROW_ID = 'manmeet';
const CANVA_ROW_ID = 'canva_oauth';

/**
 * Local dev with no database.
 *
 * `createClient(undefined, undefined)` throws while the MODULE loads, so every
 * route that imports this file answers 500 and the app cannot draw a single
 * screen on a machine without the env file. CLAUDE.md already says the app runs
 * open as the owner in local dev; this is what makes that true.
 *
 * With no credentials the state reads as empty and writes go nowhere, so the
 * app runs on whatever is in memory. On Vercel the variables are always set and
 * nothing about this changes.
 */
const configured = Boolean(url && key);

/**
 * THE ROOT OF THE 2026-08-09/10 SAGA, found by the fact line: a request whose
 * page said "Preview not found" carried inBlob=true in the same breath. The
 * only difference between the query that missed and the query that hit was the
 * fetch URL - Next.js caches fetch() by URL, supabase-js rides on fetch, and
 * this client's two or three long-lived query URLs were being served from
 * Next's data cache at random. Stale reads, saves that clobbered from stale
 * bases, a client link flip-flopping: all of it was this.
 *
 * Every request this client makes is therefore pinned no-store. The database
 * is the cache.
 */
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });

const supabase = createClient(url || 'http://localhost:54321', key || 'local-dev-no-key', {
  global: { fetch: noStoreFetch },
});

export async function readState(): Promise<AppState | null> {
  if (!configured) return null;
  const { data, error } = await supabase
    .from('app_state')
    .select('data')
    .eq('id', DB_ROW_ID)
    .single();
  if (error) { console.error('[readState] Supabase error:', error.message, error.code); return null; }
  if (!data?.data) { console.error('[readState] No data row found for id:', DB_ROW_ID); return null; }
  return data.data as AppState;
}

export async function writeState(state: AppState): Promise<void> {
  if (!configured) return;   // local dev with no database: memory is the store
  const { error } = await supabase
    .from('app_state')
    .upsert({ id: DB_ROW_ID, data: state, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

// ── Compare-and-swap writes (2026-08-09) ─────────────────────────────────────
//
// Why this exists, in one line: the server's own log caught two saves minutes
// apart where the second one READ AN OLDER COPY of the row than the first
// (previews went 4 → 5 → 3 → 4), and every read-modify-write built on a stale
// copy silently erased whatever landed since. That is what ate every preview
// after 1 August, including the two that day that were blamed on a stale tab.
//
// The cure is not trusting reads at all: a write says "apply this ONLY IF the
// row still carries the version I read". A write built on a stale copy matches
// nothing, changes nothing, and the caller re-reads and tries again. Lost
// updates become impossible no matter what the reads are doing.

export interface VersionedState {
  state: AppState;
  /** The row's updated_at, verbatim. The token the conditional write matches on. */
  version: string | null;
}

export async function readStateVersioned(): Promise<VersionedState | null> {
  if (!configured) return null;
  const { data, error } = await supabase
    .from('app_state')
    .select('data, updated_at')
    .eq('id', DB_ROW_ID)
    .single();
  if (error) { console.error('[readStateVersioned] Supabase error:', error.message, error.code); return null; }
  if (!data?.data) return null;
  return { state: data.data as AppState, version: (data as { updated_at?: string }).updated_at ?? null };
}

/** Thrown when the row moved between our read and our write. Retry from a fresh read. */
export class StaleWriteError extends Error {
  constructor() { super('the row moved since it was read'); this.name = 'StaleWriteError'; }
}

export async function writeStateIfUnchanged(state: AppState, expectedVersion: string | null): Promise<void> {
  if (!configured) return;
  if (expectedVersion === null) {
    // No row yet (first ever save): plain upsert is the only move available.
    return writeState(state);
  }
  const { data, error } = await supabase
    .from('app_state')
    .update({ data: state, updated_at: new Date().toISOString() })
    .eq('id', DB_ROW_ID)
    .eq('updated_at', expectedVersion)
    .select('id');
  if (error) throw new Error(error.message);
  // Zero rows matched: the version we read is no longer the row's version.
  // Either someone else wrote meanwhile, or our read was a stale copy. Same
  // answer both ways: nothing was written, read again and retry.
  if (!data || data.length === 0) throw new StaleWriteError();
}

/**
 * The one way to read-modify-write the row safely. `mutate` gets a FRESH base
 * on every attempt and returns the next state, or null to abort untouched.
 * A stale write matches nothing and is retried from a fresh read; after five
 * stale rounds it throws rather than pretending.
 */
export async function mutateState(
  mutate: (base: AppState) => AppState | null,
): Promise<AppState | 'aborted' | 'no-row'> {
  if (!configured) return 'no-row';
  for (let attempt = 0; attempt < 5; attempt++) {
    const vs = await readStateVersioned();
    if (!vs) return 'no-row';
    const next = mutate(vs.state);
    if (next === null) return 'aborted';
    try {
      await writeStateIfUnchanged(next, vs.version);
      return next;
    } catch (e) {
      if (e instanceof StaleWriteError) {
        await new Promise(r => setTimeout(r, 150 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
  throw new Error('the row kept moving under this write; nothing was overwritten');
}

/**
 * The scoped compare-and-swap: carry ONLY the declared scopes of `next` onto a
 * fresh base, retrying until the row holds still. For writers that build their
 * `next` from a read taken earlier: whatever moved meanwhile survives, because
 * only the declared slices travel.
 */
export async function writeStateScoped(next: AppState, scopes: string[]): Promise<void> {
  const r = await mutateState(fresh => applyScopes(fresh, next, scopes));
  if (r === 'no-row') await writeState(next);   // first ever write: nothing to protect yet
}

// ── The preview mirror (2026-08-09) ──────────────────────────────────────────
//
// The ONE outward-facing page reads the ONE giant row, and that read was caught
// returning old copies at random — a client link living and dying by coin toss.
// So previews get a small dedicated row, rewritten at every preview save. The
// public page reads THIS first and falls back to the blob. Small, hot, and
// written in the same breath as the save it mirrors.

const PREVIEWS_ROW_ID = 'previews_mirror';

type PreviewMirror = Record<string, { previewPosts: PreviewPost[]; instagram: InstagramProfile }>;

export async function writePreviewMirror(state: AppState): Promise<void> {
  if (!configured) return;
  const mirror: PreviewMirror = {};
  for (const [cid, cd] of Object.entries(state.clientData ?? {})) {
    if ((cd.previewPosts ?? []).length) {
      mirror[cid] = { previewPosts: cd.previewPosts, instagram: cd.instagram ?? { handle: '', avatarUrl: '' } };
    }
  }
  const { error } = await supabase
    .from('app_state')
    .upsert({ id: PREVIEWS_ROW_ID, data: mirror, updated_at: new Date().toISOString() });
  // The mirror is belt-and-braces: its failure must never fail the save it rides on.
  if (error) console.error('[preview-mirror] write failed:', error.message);
}

async function findPreviewInMirror(
  shareId: string,
): Promise<{ post: PreviewPost; instagram: InstagramProfile } | null> {
  const { data, error } = await supabase
    .from('app_state')
    .select('data')
    .eq('id', PREVIEWS_ROW_ID)
    .single();
  if (error || !data?.data) return null;
  for (const entry of Object.values(data.data as PreviewMirror)) {
    const post = (entry.previewPosts ?? []).find(p => p.shareId === shareId);
    if (post) return { post, instagram: entry.instagram ?? { handle: '', avatarUrl: '' } };
  }
  return null;
}

// ── Canva token storage ──────────────────────────────────────────────────────
// Kept in its own row of the same app_state table (no new table needed) and
// only ever touched server-side, so the token never reaches the browser.

export async function readCanvaToken(): Promise<CanvaToken | null> {
  const { data, error } = await supabase
    .from('app_state')
    .select('data')
    .eq('id', CANVA_ROW_ID)
    .single();
  if (error || !data?.data) return null;
  return data.data as CanvaToken;
}

export async function writeCanvaToken(token: CanvaToken): Promise<void> {
  const { error } = await supabase
    .from('app_state')
    .upsert({ id: CANVA_ROW_ID, data: token, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export async function clearCanvaToken(): Promise<void> {
  await supabase.from('app_state').delete().eq('id', CANVA_ROW_ID);
}

// Upload raw bytes to a public Storage bucket and return the public URL. Used to
// re-host Canva export images (whose own URLs expire) in `post-images`.
export async function uploadToStorage(
  bucket: string, bytes: ArrayBuffer, contentType: string, ext: string,
): Promise<string> {
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(filename, bytes, { contentType, upsert: false });
  if (error) throw new Error(error.message);
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filename);
  return publicUrl;
}

/** Public preview lookup: find a post by its share token across all clients.
 *  Retries up to 4 times with increasing delays to handle the brief window
 *  between a confirmed write and it being visible on a fresh Supabase read
 *  (connection-pool / read-after-write lag). */
/** Facts for the /p/ page's invisible diagnostic: counts and clock times only. */
export async function previewDebugLine(shareId: string): Promise<string> {
  try {
    const vs = await readStateVersioned();
    const total = vs ? Object.values(vs.state.clientData ?? {}).reduce((n, d) => n + (d.previewPosts ?? []).length, 0) : -1;
    const inBlob = vs ? Object.values(vs.state.clientData ?? {}).some(d => (d.previewPosts ?? []).some(x => x.shareId === shareId)) : false;
    const { data } = await supabase.from('app_state').select('data, updated_at').eq('id', 'previews_mirror').single();
    const mirror = data?.data as Record<string, { previewPosts?: PreviewPost[] }> | undefined;
    const mTotal = mirror ? Object.values(mirror).reduce((n, d) => n + (d.previewPosts ?? []).length, 0) : -1;
    const inMirror = mirror ? Object.values(mirror).some(d => (d.previewPosts ?? []).some(x => x.shareId === shareId)) : false;
    return `blobAt=${vs?.version ?? 'null'} blobTotal=${total} inBlob=${inBlob} mirrorAt=${(data as { updated_at?: string } | null)?.updated_at ?? 'absent'} mirrorTotal=${mTotal} inMirror=${inMirror} now=${new Date().toISOString()}`;
  } catch (e) {
    return `debug-failed=${e instanceof Error ? e.message : 'unknown'}`;
  }
}

export async function findPreviewPost(
  shareId: string,
): Promise<{ post: PreviewPost; instagram: InstagramProfile } | null> {
  if (!shareId) return null;

  // The mirror first: small, hot, rewritten at every preview save. Then the
  // blob, with the old retries, for anything from before the mirror existed.
  const mirrored = await findPreviewInMirror(shareId);
  if (mirrored) return mirrored;

  const delays = [0, 600, 1200, 2000]; // ms before each attempt
  for (const delay of delays) {
    if (delay > 0) await new Promise(r => setTimeout(r, delay));
    const state = await readState();
    if (!state) continue;
    for (const data of Object.values(state.clientData ?? {})) {
      const post = (data.previewPosts ?? []).find(p => p.shareId === shareId);
      if (post) {
        // Self-healing: one successful blob read seeds the mirror, so this
        // link never has to win the coin toss again. Fire and forget.
        void writePreviewMirror(state).catch(() => {});
        return { post, instagram: data.instagram ?? { handle: '', avatarUrl: '' } };
      }
    }
  }
  return null;
}
