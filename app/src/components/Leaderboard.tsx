import { useEffect, useState } from 'react';
import { useAuth } from '../supabase/useAuth';
import { getTodayPuzzle, getLeaderboard } from '../supabase/api';
import type { LeaderboardRow } from '../supabase/types';
import { SignIn } from './SignIn';

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const RANK_MEDALS = ['🥇', '🥈', '🥉'];
const RANK_CLASSES = ['leaderboard-row-gold', 'leaderboard-row-silver', 'leaderboard-row-bronze'];

export function Leaderboard() {
  const { loading: authLoading, session, profile, signUp, signIn } = useAuth();
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setError(null);
    getTodayPuzzle()
      .then((puzzle) => getLeaderboard(puzzle.id, 500))
      .then((r) => {
        if (!cancelled) setRows(r);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load the leaderboard.");
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (authLoading) {
    return <div className="status">Loading...</div>;
  }

  if (!session || !profile) {
    return <SignIn onSignUp={signUp} onSignIn={signIn} />;
  }

  if (error) {
    return <div className="status">{error}</div>;
  }

  if (!rows) {
    return <div className="status">Loading leaderboard...</div>;
  }

  const myRank = rows.findIndex((row) => row.user_id === session.user.id);

  return (
    <>
      <div className="badges-header">
        <h2 className="stamp" style={{ margin: 0 }}>
          Leaderboard
        </h2>
        <div className="subtitle" style={{ marginTop: '4px' }}>
          Today's Daily Challenge
        </div>
      </div>

      {rows.length === 0 && (
        <div className="status" style={{ marginTop: '20px' }}>
          No one's finished today's puzzle yet — be the first!
        </div>
      )}

      {rows.length > 0 && (
        <div className="profile-panel">
          {myRank >= 0 && <div className="leaderboard-you-banner">You are rank #{myRank + 1}</div>}
          <div className="leaderboard-list">
            {rows.map((row, i) => {
              const isMe = row.user_id === session.user.id;
              const rankClass = RANK_CLASSES[i] ?? '';
              return (
                <div
                  className={`leaderboard-row${rankClass ? ` ${rankClass}` : ''}${isMe ? ' leaderboard-row-me' : ''}`}
                  key={row.session_id}
                >
                  <div className="leaderboard-rank">{RANK_MEDALS[i] ?? i + 1}</div>
                  <div className="leaderboard-name">
                    {row.username}
                    {row.selected_emoji && <span className="leaderboard-flair">{row.selected_emoji}</span>}
                    {isMe && <span className="leaderboard-you-tag">YOU</span>}
                  </div>
                  <div className="leaderboard-time">{formatTime(row.elapsed_seconds)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
