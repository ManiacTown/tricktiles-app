import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — copy app/.env.example to app/.env and fill them in.',
  );
}

// Untyped client: a hand-written Database generic doesn't match
// supabase-js's exact structural expectations (it's meant to be
// CLI-generated — `npx supabase gen types typescript`, not hand-rolled).
// api.ts annotates each query's return shape with .returns<T>() instead —
// swap this for a generated Database type once a live project exists.
export const supabase = createClient(url, anonKey);
