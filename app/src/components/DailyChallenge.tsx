import { useEffect, useState } from 'react';
import { useAuth } from '../supabase/useAuth';
import { getTodayPuzzle, getOrCreateSession, completeRound, saveSessionState } from '../supabase/api';
import { ROUNDS } from '../game/rounds';
import type { PersistedGameState } from '../game/gameState';
import type { DailyPuzzleRow, GameSessionRow } from '../supabase/types';
import { SignIn } from './SignIn';
import { GameScreen } from './GameScreen';

interface DailyChallengeProps {
  active?: boolean;
}

export function DailyChallenge({ active = true }: DailyChallengeProps) {
  const { loading: authLoading, session, profile, signUp, signIn } = useAuth();
  const [puzzle, setPuzzle] = useState<DailyPuzzleRow | null>(null);
  const [gameSession, setGameSession] = useState<GameSessionRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session || !profile) return;
    let cancelled = false;
    (async () => {
      try {
        const todayPuzzle = await getTodayPuzzle();
        const todaySession = await getOrCreateSession(todayPuzzle.id, session.user.id);
        if (!cancelled) {
          setPuzzle(todayPuzzle);
          setGameSession(todaySession);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load today's puzzle.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, profile]);

  if (authLoading) {
    return <div className="status">Loading...</div>;
  }

  if (!session || !profile) {
    return <SignIn onSignUp={signUp} onSignIn={signIn} />;
  }

  if (error) {
    return <div className="status">{error}</div>;
  }

  if (!puzzle || !gameSession) {
    return <div className="status">Loading today's puzzle...</div>;
  }

  // Sessions completed before auto-save existed (or that lost the race
  // between the last checkpoint and complete_round() flipping status, since
  // RLS silently no-ops saves once a session is no longer in_progress) have
  // no board to resume or replay — there's nothing useful for GameScreen to
  // render in that case, so show a plain message instead of a blank board.
  if (gameSession.status === 'completed' && !gameSession.final_board_state) {
    return (
      <div className="status" style={{ marginTop: '40px' }}>
        You've already completed today's puzzle! Come back tomorrow for a new one.
      </div>
    );
  }

  const roundLetters = [...puzzle.rounds].sort((a, b) => a.round - b.round).map((r) => r.letters);
  const savedState = (gameSession.final_board_state as PersistedGameState | null) ?? undefined;

  return (
    <GameScreen
      key={gameSession.id}
      active={active}
      roundLetters={roundLetters}
      savedState={savedState}
      onSaveState={(state) => {
        saveSessionState(gameSession.id, state).catch((err) => {
          console.error('Failed to save session state:', err);
        });
      }}
      onRoundComplete={(round) => {
        completeRound(gameSession.id, round).catch((err) => {
          console.error('Failed to record round completion:', err);
        });
      }}
      adminSolution={puzzle.final_board}
      onAdminComplete={async () => {
        for (let round = 1; round <= ROUNDS; round++) {
          try {
            await completeRound(gameSession.id, round);
          } catch (err) {
            console.error(`Admin complete: failed to record round ${round}:`, err);
          }
        }
      }}
    />
  );
}
