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

export type WheelMode = 'scroll' | 'zoom';

export interface ProfileRow {
  id: string;
  username: string;
  created_at: string;
  // Rare-or-better badge emoji the player has equipped as flair — null
  // means none selected. Allowed values are DB-enforced (a check
  // constraint listing every rare+ badge's icon), not just client-side.
  selected_emoji: string | null;
  // Whether scrolling the mouse wheel over the board/rack/controls
  // scrolls the page ('scroll', default) or zooms them ('zoom'). See
  // GameScreen's zoom-wrap wheel handler.
  wheel_mode: WheelMode;
}

export type BadgeRarity = 'common' | 'rare' | 'legendary' | 'special';

export interface BadgeRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string | null;
  category: string;
  rarity: BadgeRarity;
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
  selected_emoji: string | null;
}
