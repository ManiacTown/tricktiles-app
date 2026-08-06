import { useEffect, useState } from 'react';
import { useAuth } from '../supabase/useAuth';
import { getTodayPuzzle, getOrCreateSession, completeRound, saveSessionState, getSessionElapsedSeconds } from '../supabase/api';
import { ROUNDS } from '../game/rounds';
import type { PersistedGameState } from '../game/gameState';
import type { DailyPuzzleRow, GameSessionRow } from '../supabase/types';
import { SignIn } from './SignIn';
import { GameScreen } from './GameScreen';

interface DailyChallengeProps {
  active?: boolean;
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function DailyChallenge({ active = true }: DailyChallengeProps) {
  const { loading: authLoading, session, profile, signUp, signIn } = useAuth();
  const [puzzle, setPuzzle] = useState<DailyPuzzleRow | null>(null);
  const [gameSession, setGameSession] = useState<GameSessionRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Populated only in the no-proper-snapshot fallback below — we don't
  // have the player's actual board there, but the server-timestamped
  // round_completions it's derived from (see getSessionElapsedSeconds)
  // still knows how long they took, which beats a bare "come back
  // tomorrow" with nothing to show for the finish at all.
  const [fallbackElapsed, setFallbackElapsed] = useState<number | null>(null);

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

  const rawSavedState = (gameSession?.final_board_state as PersistedGameState | null) ?? undefined;

  // Sessions completed before auto-save existed, or that lost the race
  // between the last checkpoint and complete_round() flipping status (RLS
  // silently no-ops saves once a session is no longer in_progress), have
  // no board — or worse, a *stale* one whose endTime is still null because
  // it was captured a moment before the round actually finished. Passing
  // that stale snapshot to GameScreen as "resumable" would hydrate a
  // technically-completed session back into a live, timer-ticking board
  // (the round/session status is 'completed' server-side, but the client
  // would render as if it weren't) — so gameSession.status, not whatever
  // final_board_state happens to contain, is what decides "is this really
  // still playable." Anything completed without a properly-finished
  // snapshot falls back to a plain message instead of a broken resume.
  const needsFallback = gameSession?.status === 'completed' && rawSavedState?.endTime == null;

  useEffect(() => {
    if (!needsFallback || !gameSession) return;
    let cancelled = false;
    getSessionElapsedSeconds(gameSession.id)
      .then((seconds) => {
        if (!cancelled) setFallbackElapsed(seconds);
      })
      .catch((err) => console.error('Failed to fetch fallback elapsed time:', err));
    return () => {
      cancelled = true;
    };
  }, [needsFallback, gameSession]);

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

  if (needsFallback) {
    return (
      <div className="status" style={{ marginTop: '40px' }}>
        You've already completed today's puzzle
        {fallbackElapsed != null ? ` in ${formatTime(fallbackElapsed)}` : ''}! Come back tomorrow for a new one.
      </div>
    );
  }

  const roundLetters = [...puzzle.rounds].sort((a, b) => a.round - b.round).map((r) => r.letters);
  const savedState = rawSavedState;

  return (
    <GameScreen
      key={gameSession.id}
      active={active}
      roundLetters={roundLetters}
      savedState={savedState}
      // Placeholder — daily_puzzles has no sequential puzzle number yet
      // (just a date). Swap for the real count once that's added.
      puzzleNumber={122}
      // Returns the promise (rather than firing-and-forgetting it) so
      // GameScreen's handleCompleteRound can await the final round's save
      // and guarantee it lands before onRoundComplete's RPC below flips
      // the session to 'completed' — see that function's own comment.
      onSaveState={(state) =>
        saveSessionState(gameSession.id, state).catch((err) => {
          console.error('Failed to save session state:', err);
        })
      }
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
