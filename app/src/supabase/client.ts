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
//
// keepalive: true on every request — without it, a save fired right as a
// tab is closing/reloading (e.g. GameScreen's flush-on-pause, which fires
// on the visibilitychange that a reload itself triggers just before
// navigating away) is liable to get cancelled mid-flight by the browser
// before the response ever comes back, silently dropping that save. A
// keepalive fetch is explicitly allowed to outlive the page that started
// it (subject to a small body-size cap, well above what a board-state
// save needs), which is exactly the guarantee needed here.
export const supabase = createClient(url, anonKey, {
  global: {
    fetch: (input, init) => fetch(input, { ...init, keepalive: true }),
  },
});
