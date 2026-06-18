import { createClient } from '@supabase/supabase-js';
import { AppState } from '@/types';

// Server-only Supabase access. The keys are read from the environment here and
// never shipped to the browser, so the client bundle holds no DB credentials.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const DB_ROW_ID = 'manmeet';

const supabase = createClient(url, key);

export async function readState(): Promise<AppState | null> {
  const { data, error } = await supabase
    .from('app_state')
    .select('data')
    .eq('id', DB_ROW_ID)
    .single();
  if (error || !data?.data) return null;
  return data.data as AppState;
}

export async function writeState(state: AppState): Promise<void> {
  await supabase
    .from('app_state')
    .upsert({ id: DB_ROW_ID, data: state, updated_at: new Date().toISOString() });
}
