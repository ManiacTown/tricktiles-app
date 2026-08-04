import { useEffect, useState } from 'react';
import { useAuth } from '../supabase/useAuth';
import { getProfileStats, type ProfileStats } from '../supabase/api';
import { SignIn } from './SignIn';

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function Profile() {
  const { loading: authLoading, session, profile, signInWithUsername } = useAuth();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    getProfileStats(session.user.id)
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load stats.');
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (authLoading) {
    return <div className="status">Loading...</div>;
  }

  if (!session || !profile) {
    return <SignIn onSignIn={signInWithUsername} />;
  }

  return (
    <div className="card" style={{ margin: '20px auto' }}>
      <h2 className="stamp">{profile.username}</h2>
      <div className="small" style={{ marginBottom: '16px' }}>
        Daily challenge stats
      </div>

      {error && <div style={{ color: 'var(--invalid)', fontSize: '12px' }}>{error}</div>}

      {!error && !stats && <div className="small">Loading...</div>}

      {!error && stats && stats.gamesPlayed === 0 && (
        <div className="small">You haven't completed a daily puzzle yet — finish one to see your stats here.</div>
      )}

      {!error && stats && stats.gamesPlayed > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '8px' }}>
          <div>
            <div className="small">Games Played</div>
            <div className="big" style={{ fontSize: '22px' }}>
              {stats.gamesPlayed}
            </div>
          </div>
          <div>
            <div className="small">Best Time</div>
            <div className="big" style={{ fontSize: '22px' }}>
              {formatTime(stats.bestTimeSeconds!)}
            </div>
          </div>
          <div>
            <div className="small">Avg Time</div>
            <div className="big" style={{ fontSize: '22px' }}>
              {formatTime(stats.averageTimeSeconds!)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
