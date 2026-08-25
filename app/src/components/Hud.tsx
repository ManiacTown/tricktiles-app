import { useState } from 'react';
import { ROUNDS } from '../game/rounds';
import { isSoundMuted, setSoundMuted } from '../sound';

interface HudProps {
  round: number;
  elapsedSeconds: number;
  score: number;
  onPause: () => void;
  pauseDisabled: boolean;
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function Hud({ round, elapsedSeconds, score, onPause, pauseDisabled }: HudProps) {
  const [muted, setMuted] = useState(isSoundMuted());

  function toggleMuted() {
    const next = !muted;
    setMuted(next);
    setSoundMuted(next);
  }

  return (
    <div className="hud">
      <div className="hud-item">
        <div className="hud-label">Round</div>
        <div className="hud-value">
          {Math.min(round + 1, ROUNDS)} / {ROUNDS}
        </div>
      </div>
      <div className="hud-item">
        <div className="hud-label">Time</div>
        <div className="hud-value">{formatTime(elapsedSeconds)}</div>
      </div>
      <div className="hud-item">
        <div className="hud-label">Score</div>
        <div className="hud-value">{score}</div>
      </div>
      <button className="hud-pause-btn" onClick={toggleMuted} aria-label={muted ? 'Unmute' : 'Mute'}>
        {muted ? '🔇' : '🔊'}
      </button>
      <button className="hud-pause-btn" onClick={onPause} disabled={pauseDisabled} aria-label="Pause">
        ⏸
      </button>
    </div>
  );
}
