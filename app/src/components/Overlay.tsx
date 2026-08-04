interface OverlayProps {
  show: boolean;
  finalTime: string;
  finalScore: number;
  onPlayAgain: () => void;
}

export function Overlay({ show, finalTime, finalScore, onPlayAgain }: OverlayProps) {
  return (
    <div id="overlay" className={show ? 'show' : undefined}>
      <div className="card">
        <h2 className="stamp">FINISHED!</h2>
        <div className="small">Total Time</div>
        <div className="big">{finalTime}</div>
        <div className="small">Score</div>
        <div className="big">{finalScore}</div>
        <button onClick={onPlayAgain}>Play Again</button>
      </div>
    </div>
  );
}
