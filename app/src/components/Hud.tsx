import { ROUNDS } from '../game/rounds';

interface HudProps {
  round: number;
  elapsedSeconds: number;
  score: number;
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function Hud({ round, elapsedSeconds, score }: HudProps) {
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
    </div>
  );
}
