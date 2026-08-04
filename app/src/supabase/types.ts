// Hand-written to match supabase/migrations/20260804000000_initial_schema.sql.
// Once a live project exists, regenerate with:
//   npx supabase gen types typescript --project-id <ref> > src/supabase/types.ts
// and this file (plus this comment) goes away.

export interface DailyPuzzleRow {
  id: string;
  date: string;
  seed: number;
  rounds: Array<{ round: number; letters: string; attempts: number }>;
  final_board: Array<{ r: number; c: number; letter: string }>;
  created_at: string;
}

export interface GameSessionRow {
  id: string;
  user_id: string;
  puzzle_id: string;
  started_at: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  client_score: number | null;
  final_board_state: unknown | null;
}

export interface ProfileRow {
  id: string;
  username: string;
  created_at: string;
}

export interface BadgeRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string | null;
}

export interface BadgeUnlockRow {
  id: string;
  user_id: string;
  badge_id: string;
  session_id: string | null;
  unlocked_at: string;
}

export interface LeaderboardRow {
  session_id: string;
  user_id: string;
  username: string;
  puzzle_id: string;
  puzzle_date: string;
  started_at: string;
  finished_at: string;
  elapsed_seconds: number;
  client_score: number | null;
}
