import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Local dev with no database: `createClient(undefined, undefined)` throws while
// this module LOADS, which takes the whole browser bundle down before a screen
// can draw. Falling back to a placeholder keeps the app renderable locally;
// calls against it simply fail. On Vercel the variables are always set.
export const supabase = createClient(
  supabaseUrl || 'http://localhost:54321',
  supabaseKey || 'local-dev-no-key',
);
