import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './client';
import type { ProfileRow } from './types';

interface AuthState {
  loading: boolean;
  session: Session | null;
  profile: ProfileRow | null;
}

async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data as ProfileRow | null;
}

// Tracks the current Supabase auth session and, once signed in, the
// player's profile row (username). Both anonymous and (later) email
// accounts flow through the same auth.users table, so this hook doesn't
// need to know which sign-in method was used.
export function useAuth() {
  const [state, setState] = useState<AuthState>({ loading: true, session: null, profile: null });

  useEffect(() => {
    let cancelled = false;

    async function loadProfile(session: Session | null) {
      const profile = session ? await fetchProfile(session.user.id) : null;
      if (!cancelled) setState({ loading: false, session, profile });
    }

    supabase.auth.getSession().then(({ data }) => loadProfile(data.session));

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setState((prev) => ({ ...prev, loading: true }));
      loadProfile(session);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function signInWithUsername(username: string): Promise<void> {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    const userId = data.user!.id;

    const { error: profileError } = await supabase.from('profiles').insert({ id: userId, username });
    if (profileError) throw profileError;

    setState({ loading: false, session: data.session, profile: { id: userId, username, created_at: new Date().toISOString() } });
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut();
    setState({ loading: false, session: null, profile: null });
  }

  return { ...state, signInWithUsername, signOut };
}
