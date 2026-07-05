import { createClient } from '@supabase/supabase-js';
import { AppState, InstagramProfile, PreviewPost } from '@/types';

// Server-only Supabase access. Prefer the service role key (bypasses RLS) so
// public pages like /p/[shareId] can always read state without auth context.
// Falls back to the anon key in environments where service role isn't set.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const DB_ROW_ID = 'manmeet';

const supabase = createClient(url, key);

export async function readState(): Promise<AppState | null> {
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
  const { error } = await supabase
    .from('app_state')
    .upsert({ id: DB_ROW_ID, data: state, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
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
