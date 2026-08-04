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

// Creates the profile row for a session that doesn't have one yet, using
// the username captured at signup time (stored as auth user_metadata so
// it survives the gap between signUp() and email confirmation actually
// granting a session — see signUp below). If the insert loses a race
// against another code path creating the same row, just re-fetch; that's
// not a real error.
async function ensureProfile(userId: string, username: string): Promise<ProfileRow | null> {
  const { error } = await supabase.from('profiles').insert({ id: userId, username });
  if (error && error.code !== '23505') throw error;
  return fetchProfile(userId);
}

// Tracks the current Supabase auth session and, once signed in, the
// player's profile row (username).
export function useAuth() {
  const [state, setState] = useState<AuthState>({ loading: true, session: null, profile: null });

  useEffect(() => {
    let cancelled = false;

    async function loadProfile(session: Session | null) {
      if (!session) {
        if (!cancelled) setState({ loading: false, session: null, profile: null });
        return;
      }
      let profile = await fetchProfile(session.user.id);
      if (!profile) {
        const pendingUsername = session.user.user_metadata?.username as string | undefined;
        if (pendingUsername) profile = await ensureProfile(session.user.id, pendingUsername);
      }
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

  // options.data stashes the desired username on the auth user itself, so
  // it's available even if email confirmation delays session creation —
  // the onAuthStateChange listener picks it up via ensureProfile once a
  // session finally exists, whether that's immediately or after the user
  // clicks the confirmation link.
  async function signUp(email: string, password: string, username: string): Promise<{ needsEmailConfirmation: boolean }> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    if (error) throw error;

    if (!data.session || !data.user) {
      return { needsEmailConfirmation: true };
    }

    const { error: profileError } = await supabase.from('profiles').insert({ id: data.user.id, username });
    if (profileError) {
      const isUsernameConflict = profileError.code === '23505' && profileError.message.includes('username');
      if (isUsernameConflict) throw new Error('That username is already taken.');
      // Any other 23505 here is a benign race with the auth-state-change
      // listener's own ensureProfile insert for this same row — ignore it.
      if (profileError.code !== '23505') throw profileError;
    }
    return { needsEmailConfirmation: false };
  }

  async function signIn(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut();
  }

  return { ...state, signUp, signIn, signOut };
}
