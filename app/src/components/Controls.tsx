interface ControlsProps {
  onShuffle: () => void;
  onUndo: () => void;
  onNext: () => void;
  canUndo: boolean;
  ready: boolean;
  isLastRound: boolean;
  // Force every button off regardless of the individual canUndo/ready
  // flags — set once the whole game is finished, since none of these
  // actions mean anything once the result overlay has something to show.
  disabled?: boolean;
}

export function Controls({ onShuffle, onUndo, onNext, canUndo, ready, isLastRound, disabled = false }: ControlsProps) {
  return (
    <div className="controls">
      <button id="shuffleBtn" onClick={onShuffle} disabled={disabled}>
        Shuffle Rack
      </button>
      <button id="undoBtn" onClick={onUndo} disabled={disabled || !canUndo}>
        Undo
      </button>
      <button id="nextBtn" className={ready && !disabled ? 'ready' : undefined} onClick={onNext} disabled={disabled}>
        {isLastRound ? 'Finish →' : 'Complete Round →'}
      </button>
    </div>
  );
}
