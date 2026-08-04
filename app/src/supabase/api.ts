import { supabase } from './client';
import { ROUNDS } from '../game/rounds';
import type { DailyPuzzleRow, GameSessionRow, LeaderboardRow } from './types';

// UTC calendar date, matching solver/generate's seedFromDate — see the
// timezone decision documented in tricktiles_build_plan.md section 2.
function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

// The client has no generated Database schema (see client.ts), so
// supabase-js's query builder falls back to loosely-typed results. Each
// function here casts the checked, non-null result to the hand-written row
// type from types.ts rather than fighting the generic inference.

export async function getTodayPuzzle(): Promise<DailyPuzzleRow> {
  const { data, error } = await supabase
    .from('daily_puzzles')
    .select('*')
    .eq('date', todayUTC())
    .single();
  if (error) throw error;
  return data as DailyPuzzleRow;
}

// Resumes today's in-progress session for the current user if one exists,
// otherwise starts a new one. Relies on the (user_id, puzzle_id) unique
// constraint plus RLS ("users can create their own sessions") rather than
// a client-side check-then-insert race.
export async function getOrCreateSession(puzzleId: string, userId: string): Promise<GameSessionRow> {
  const existing = await supabase
    .from('game_sessions')
    .select('*')
    .eq('puzzle_id', puzzleId)
    .eq('user_id', userId)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data as GameSessionRow;

  const { data, error } = await supabase
    .from('game_sessions')
    .insert({ puzzle_id: puzzleId, user_id: userId })
    .select('*')
    .single();
  if (error) throw error;
  return data as GameSessionRow;
}

// Records that the player finished a round. completed_at is set
// server-side inside complete_round() — the client never supplies a
// timestamp, which is the anti-cheat point (see the migration's comment).
export async function completeRound(sessionId: string, roundNumber: number): Promise<void> {
  const { error } = await supabase.rpc('complete_round', {
    p_session_id: sessionId,
    p_round_number: roundNumber,
    p_total_rounds: ROUNDS,
  });
  if (error) throw error;
}

export async function getLeaderboard(puzzleId: string, limit = 50): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase
    .from('leaderboard')
    .select('*')
    .eq('puzzle_id', puzzleId)
    .order('elapsed_seconds', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data as LeaderboardRow[];
}
