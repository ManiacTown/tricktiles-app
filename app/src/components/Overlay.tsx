import { useState } from 'react';
import { buildShareText } from '../game/shareText';

interface RoundSummary {
  round: number;
  elapsedSeconds: number;
}

interface OverlayProps {
  show: boolean;
  finalTime: string;
  rounds: RoundSummary[];
  // Daily-only — see the hardcoded placeholder note where this is passed
  // in from DailyChallenge.tsx. Undefined in practice mode, where the
  // puzzle-number line and share text both fall back to a plain label.
  puzzleNumber?: number;
  onExit: () => void;
}

function formatRoundTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function Overlay({ show, finalTime, rounds, puzzleNumber, onExit }: OverlayProps) {
  const [shareStatus, setShareStatus] = useState('');

  function flashStatus(message: string) {
    setShareStatus(message);
    setTimeout(() => setShareStatus(''), 2500);
  }

  async function handleShare() {
    const text = buildShareText({ puzzleNumber, time: finalTime });
    // Native share sheet on mobile when available; clipboard everywhere
    // else. navigator.share rejects on user-cancel — swallowed rather than
    // falling through to the clipboard path, which would show a
    // misleading "cancel = copied" success message.
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        // cancelled — not a failure
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      flashStatus('Copied to clipboard!');
    } catch {
      flashStatus('Could not copy — try again.');
    }
  }

  // Always copies, regardless of navigator.share support — for people who
  // specifically want the clipboard path (e.g. to paste into a chat)
  // rather than whatever the OS share sheet offers.
  async function handleCopy() {
    const text = buildShareText({ puzzleNumber, time: finalTime });
    try {
      await navigator.clipboard.writeText(text);
      flashStatus('Copied to clipboard!');
    } catch {
      flashStatus('Could not copy — try again.');
    }
  }

  return (
    <div
      id="overlay"
      className={`modal-backdrop${show ? ' show' : ''}`}
      // Only dismiss on a click that lands on the backdrop itself — one
      // that bubbles up from inside the card (e.g. a button) shouldn't
      // close it.
      onClick={(e) => {
        if (e.target === e.currentTarget) onExit();
      }}
    >
      <div className="result-card">
        <div className="stamp result-wordmark">TRICKTILES</div>
        {puzzleNumber != null && <div className="result-puzzle-number">Daily Puzzle #{puzzleNumber}</div>}
        <h2 className="stamp result-title">Solved!</h2>

        <div className="result-stats">
          <div className="stat-tile">
            <div className="stat-value">{finalTime}</div>
            <div className="stat-label">Time</div>
          </div>
        </div>

        {rounds.length > 0 && (
          <table className="result-rounds">
            <thead>
              <tr>
                <th>Round</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {rounds.map((r) => (
                <tr key={r.round}>
                  <td>{r.round}</td>
                  <td>{formatRoundTime(r.elapsedSeconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="result-actions">
          <button className="result-share-btn" onClick={handleShare}>
            Share Result
          </button>
          <button className="result-copy-btn" onClick={handleCopy}>
            Copy Result
          </button>
        </div>
        {shareStatus && <div className="result-status">{shareStatus}</div>}

        <button className="admin-btn result-exit" onClick={onExit}>
          Exit
        </button>
      </div>
    </div>
  );
}
