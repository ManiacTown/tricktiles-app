import { supabase } from './client';
import { ROUNDS } from '../game/rounds';
import type { PersistedGameState } from '../game/gameState';
import type { BadgeRow, DailyPuzzleRow, GameSessionRow, LeaderboardRow } from './types';

// UTC calendar date, matching solver/generate's seedFromDate — see the
// timezone decision documented in tricktiles_build_plan.md section 2.
//
// VITE_DEBUG_DATE is a local-only testing override — set it in your own
// app/.env (gitignored, never committed) to a date like '2026-09-14' to
// load a past puzzle instead of today's, e.g. when today's hasn't been
// published yet. Leave it unset for normal use.
function todayUTC(): string {
  const debugDate = import.meta.env.VITE_DEBUG_DATE as string | undefined;
  return debugDate || new Date().toISOString().slice(0, 10);
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

// Auto-save checkpoint for an in-progress daily session, so closing the tab
// mid-round doesn't lose progress. The RLS policy "users can update their
// own in-progress sessions" scopes this to status = 'in_progress' — once a
// session is completed, the UPDATE matches zero rows and silently no-ops
// rather than erroring, which is fine since GameScreen stops calling this
// once the round is finished.
export async function saveSessionState(sessionId: string, state: PersistedGameState): Promise<void> {
  const { error } = await supabase
    .from('game_sessions')
    .update({ final_board_state: state })
    .eq('id', sessionId);
  if (error) throw error;
}

// Fallback for a completed session with no proper final_board_state (see
// DailyChallenge's "already completed" message) — even without the
// player's actual board, the server-timestamped round_completions this is
// derived from (same source the leaderboard itself uses) still knows how
// long they actually took, so the fallback can show that instead of
// nothing at all.
export async function getSessionElapsedSeconds(sessionId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('leaderboard')
    .select('elapsed_seconds')
    .eq('session_id', sessionId)
    .maybeSingle();
  if (error) throw error;
  return (data as { elapsed_seconds: number } | null)?.elapsed_seconds ?? null;
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

export interface ProfileStats {
  gamesPlayed: number;
  bestTimeSeconds: number | null;
  averageTimeSeconds: number | null;
}

// Derived from the same leaderboard view (completed sessions only, elapsed
// time from server-timestamped round_completions) rather than a separate
// query — one source of truth for "how fast did this player finish."
export async function getProfileStats(userId: string): Promise<ProfileStats> {
  const { data, error } = await supabase
    .from('leaderboard')
    .select('elapsed_seconds')
    .eq('user_id', userId)
    .returns<Array<{ elapsed_seconds: number }>>();
  if (error) throw error;

  const times = (data ?? []).map((row) => row.elapsed_seconds);
  if (times.length === 0) {
    return { gamesPlayed: 0, bestTimeSeconds: null, averageTimeSeconds: null };
  }
  return {
    gamesPlayed: times.length,
    bestTimeSeconds: Math.min(...times),
    averageTimeSeconds: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
  };
}

// "badges are publicly readable" (see the schema) — no auth needed for the
// catalog itself, just for knowing which ones a given player has earned.
export async function getBadges(): Promise<BadgeRow[]> {
  const { data, error } = await supabase.from('badges').select('*').order('name');
  if (error) throw error;
  return data as BadgeRow[];
}

// RLS scopes badge_unlocks to "own rows only," so this is implicitly
// "this user's" unlocks regardless of the userId passed in — kept as a
// parameter anyway since every other per-user query in this file takes
// one, rather than silently relying on the caller already being the
// signed-in user.
export async function getUnlockedBadgeIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from('badge_unlocks').select('badge_id').eq('user_id', userId);
  if (error) throw error;
  return new Set((data as Array<{ badge_id: string }>).map((row) => row.badge_id));
}
