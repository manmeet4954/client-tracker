import { createClient } from '@supabase/supabase-js';
import { AppState, InstagramProfile, PreviewPost, CanvaToken } from '@/types';

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
const supabase = createClient(url || 'http://localhost:54321', key || 'local-dev-no-key');

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
export async function findPreviewPost(
  shareId: string,
): Promise<{ post: PreviewPost; instagram: InstagramProfile } | null> {
  if (!shareId) return null;

  const delays = [0, 600, 1200, 2000]; // ms before each attempt
  for (const delay of delays) {
    if (delay > 0) await new Promise(r => setTimeout(r, delay));
    const state = await readState();
    if (!state) continue;
    for (const data of Object.values(state.clientData ?? {})) {
      const post = (data.previewPosts ?? []).find(p => p.shareId === shareId);
      if (post) return { post, instagram: data.instagram ?? { handle: '', avatarUrl: '' } };
    }
  }
  return null;
}
