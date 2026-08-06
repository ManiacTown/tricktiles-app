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
  const { loading: authLoading, session, profile, signUp, signIn, signOut } = useAuth();
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
    return <SignIn onSignUp={signUp} onSignIn={signIn} />;
  }

  const statTiles = stats
    ? [
        { label: 'Games Played', value: String(stats.gamesPlayed) },
        { label: 'Best Time', value: formatTime(stats.bestTimeSeconds!) },
        { label: 'Avg Time', value: formatTime(stats.averageTimeSeconds!) },
      ]
    : [];

  return (
    <>
      <div className="profile-header">
        <div>
          <h2 className="stamp" style={{ margin: 0 }}>
            {profile.username}
          </h2>
          <div className="subtitle" style={{ marginTop: '4px' }}>
            Daily Challenge Stats
          </div>
        </div>
        <button className="admin-btn" onClick={signOut}>
          Sign Out
        </button>
      </div>

      <div className="profile-panel">
        <h3>Stats</h3>

        {error && <div style={{ color: 'var(--invalid)', fontSize: '12px' }}>{error}</div>}

        {!error && !stats && <div className="small">Loading...</div>}

        {!error && stats && stats.gamesPlayed === 0 && (
          <div className="small">You haven't completed a daily puzzle yet — finish one to see your stats here.</div>
        )}

        {!error && stats && stats.gamesPlayed > 0 && (
          <div className="stat-grid">
            {statTiles.map((tile) => (
              <div className="stat-tile" key={tile.label}>
                <div className="stat-value">{tile.value}</div>
                <div className="stat-label">{tile.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
