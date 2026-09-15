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

// How many rows show at once — once the leaderboard has more entries than
// this, it splits into pages instead of one long scrolling list.
const PAGE_SIZE = 12;

export function Leaderboard() {
  const { loading: authLoading, session, profile, signUp, signIn } = useAuth();
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setError(null);
    getTodayPuzzle()
      .then((puzzle) => getLeaderboard(puzzle.id, 500))
      .then((r) => {
        if (!cancelled) {
          setRows(r);
          setPage(0);
        }
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
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageStart = page * PAGE_SIZE;
  const pageRows = rows.slice(pageStart, pageStart + PAGE_SIZE);

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
            {pageRows.map((row, i) => {
              // Rank is this row's position across the WHOLE leaderboard,
              // not just within this page — row 0 on page 2 is rank 11,
              // not rank 1. pageStart converts the on-page index back to
              // that real overall position.
              const rank = pageStart + i;
              const isMe = row.user_id === session.user.id;
              const rankClass = RANK_CLASSES[rank] ?? '';
              return (
                <div
                  className={`leaderboard-row${rankClass ? ` ${rankClass}` : ''}${isMe ? ' leaderboard-row-me' : ''}`}
                  key={row.session_id}
                >
                  <div className="leaderboard-rank">{RANK_MEDALS[rank] ?? rank + 1}</div>
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
          {totalPages > 1 && (
            <div className="leaderboard-pagination">
              <button type="button" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
                ← Prev
              </button>
              <div className="small">
                Page {page + 1} of {totalPages}
              </div>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages - 1}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
