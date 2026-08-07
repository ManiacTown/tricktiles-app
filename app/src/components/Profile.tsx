import { useEffect, useState } from 'react';
import { useAuth } from '../supabase/useAuth';
import { getProfileStats, type ProfileStats } from '../supabase/api';
import type { WheelMode } from '../supabase/types';
import { SignIn } from './SignIn';

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Every keyboard/mouse shortcut GameScreen actually wires up — kept as a
// plain static list (rather than derived from the code) since it's meant
// to be read by a human, not exhaustively mechanical; update it by hand
// alongside GameScreen's own keydown/wheel/pointer handlers if either
// changes.
const MOUSE_CONTROLS: Array<{ action: string; description: string }> = [
  { action: 'Drag a tile', description: 'Move it between the rack and the board, or between board cells.' },
  { action: 'Drag onto the rack', description: 'Send a placed tile back to the rack.' },
  { action: 'Right-click a tile', description: 'Send it straight back to the rack.' },
  {
    action: 'Click-drag empty board cells',
    description: 'Marquee-select a group of tiles — drag any one of them afterward to move the whole group together.',
  },
  { action: 'Scroll wheel over the board area', description: 'Zoom in/out — only when Config below is set to "Zoom."' },
  { action: 'Pinch (touch)', description: 'Zoom in/out — always available, regardless of the Config setting.' },
];

const KEYBOARD_CONTROLS: Array<{ action: string; description: string }> = [
  { action: 'Type a letter', description: 'Place a matching rack tile at the highlighted cell, then auto-advance.' },
  { action: 'Arrow keys', description: 'Move the currently selected group of tiles.' },
  { action: 'Shift + Arrow keys', description: 'Shift the entire board one cell in that direction.' },
  { action: 'Enter', description: 'Complete the current round (same as the Complete Round / Finish button).' },
  { action: 'Backspace', description: 'Undo the last move.' },
  { action: 'Delete', description: 'Remove the tile at the currently highlighted cell.' },
  { action: 'Escape', description: 'Clear the current tile selection.' },
];

export function Profile() {
  const { loading: authLoading, session, profile, signUp, signIn, signOut, updateWheelMode } = useAuth();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wheelModeSaving, setWheelModeSaving] = useState(false);
  const [wheelModeError, setWheelModeError] = useState<string | null>(null);

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

  async function handleWheelModeChange(mode: WheelMode) {
    if (mode === profile!.wheel_mode) return;
    setWheelModeSaving(true);
    setWheelModeError(null);
    try {
      await updateWheelMode(mode);
    } catch (err) {
      setWheelModeError(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setWheelModeSaving(false);
    }
  }

  return (
    <>
      <div className="profile-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 className="stamp" style={{ margin: 0 }}>
              {profile.username}
            </h2>
            {profile.selected_emoji && <span style={{ fontSize: '20px' }}>{profile.selected_emoji}</span>}
          </div>
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

      <div className="profile-panel">
        <h3>Config</h3>
        <div className="config-row">
          <div>
            <div className="config-row-label">Mouse Wheel</div>
            <div className="small">
              Choose what scrolling the mouse wheel over the board does. Synced to your account.
            </div>
          </div>
          <div className="config-toggle" role="group" aria-label="Mouse wheel behavior">
            <button
              type="button"
              className={profile.wheel_mode === 'scroll' ? 'active' : undefined}
              disabled={wheelModeSaving}
              onClick={() => handleWheelModeChange('scroll')}
            >
              Scroll
            </button>
            <button
              type="button"
              className={profile.wheel_mode === 'zoom' ? 'active' : undefined}
              disabled={wheelModeSaving}
              onClick={() => handleWheelModeChange('zoom')}
            >
              Zoom
            </button>
          </div>
        </div>
        {wheelModeError && <div style={{ color: 'var(--invalid)', fontSize: '12px' }}>{wheelModeError}</div>}
      </div>

      <div className="profile-panel">
        <h3>Controls</h3>
        <div className="controls-list-label">Mouse</div>
        <table className="controls-table">
          <tbody>
            {MOUSE_CONTROLS.map((c) => (
              <tr key={c.action}>
                <td className="controls-action">{c.action}</td>
                <td>{c.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="controls-list-label" style={{ marginTop: '14px' }}>
          Keyboard
        </div>
        <table className="controls-table">
          <tbody>
            {KEYBOARD_CONTROLS.map((c) => (
              <tr key={c.action}>
                <td className="controls-action">{c.action}</td>
                <td>{c.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
