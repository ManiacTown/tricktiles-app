interface RoundSummary {
  round: number;
  score: number;
  elapsedSeconds: number;
}

interface OverlayProps {
  show: boolean;
  finalTime: string;
  finalScore: number;
  rounds: RoundSummary[];
  onPlayAgain: () => void;
}

function formatRoundTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function Overlay({ show, finalTime, finalScore, rounds, onPlayAgain }: OverlayProps) {
  return (
    <div id="overlay" className={show ? 'show' : undefined}>
      <div className="card">
        <h2 className="stamp">FINISHED!</h2>
        <div className="small">Total Time</div>
        <div className="big">{finalTime}</div>
        <div className="small">Score</div>
        <div className="big">{finalScore}</div>

        {rounds.length > 0 && (
          <table style={{ width: '100%', marginTop: '16px', fontSize: '12px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ opacity: 0.6 }}>
                <th style={{ textAlign: 'left', fontWeight: 600, padding: '4px 0' }}>Round</th>
                <th style={{ textAlign: 'right', fontWeight: 600, padding: '4px 0' }}>Time</th>
                <th style={{ textAlign: 'right', fontWeight: 600, padding: '4px 0' }}>Score</th>
              </tr>
            </thead>
            <tbody>
              {rounds.map((r) => (
                <tr key={r.round} style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                  <td style={{ textAlign: 'left', padding: '4px 0' }}>{r.round}</td>
                  <td style={{ textAlign: 'right', padding: '4px 0' }}>{formatRoundTime(r.elapsedSeconds)}</td>
                  <td style={{ textAlign: 'right', padding: '4px 0' }}>{r.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <button onClick={onPlayAgain}>Play Again</button>
      </div>
    </div>
  );
}
