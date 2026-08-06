interface PauseOverlayProps {
  show: boolean;
  onResume: () => void;
}

export function PauseOverlay({ show, onResume }: PauseOverlayProps) {
  return (
    <div
      id="pause-overlay"
      className={`modal-backdrop${show ? ' show' : ''}`}
      // Only dismiss on a click that lands on the backdrop itself — one
      // that bubbles up from inside the card shouldn't resume.
      onClick={(e) => {
        if (e.target === e.currentTarget) onResume();
      }}
    >
      <div className="pause-card">
        <h2 className="stamp">Paused</h2>
        <button onClick={onResume}>Resume</button>
      </div>
    </div>
  );
}
