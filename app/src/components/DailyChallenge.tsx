import { useEffect, useState } from 'react';
import { useAuth } from '../supabase/useAuth';
import { getTodayPuzzle, getOrCreateSession, completeRound } from '../supabase/api';
import { ROUNDS } from '../game/rounds';
import type { DailyPuzzleRow, GameSessionRow } from '../supabase/types';
import { SignIn } from './SignIn';
import { GameScreen } from './GameScreen';

export function DailyChallenge() {
  const { loading: authLoading, session, profile, signInWithUsername } = useAuth();
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
    return <SignIn onSignIn={signInWithUsername} />;
  }

  if (error) {
    return <div className="status">{error}</div>;
  }

  if (!puzzle || !gameSession) {
    return <div className="status">Loading today's puzzle...</div>;
  }

  const roundLetters = [...puzzle.rounds].sort((a, b) => a.round - b.round).map((r) => r.letters);

  return (
    <GameScreen
      key={gameSession.id}
      roundLetters={roundLetters}
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
