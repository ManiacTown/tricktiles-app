interface ControlsProps {
  onShuffle: () => void;
  onUndo: () => void;
  onNext: () => void;
  canUndo: boolean;
  ready: boolean;
  isLastRound: boolean;
}

export function Controls({ onShuffle, onUndo, onNext, canUndo, ready, isLastRound }: ControlsProps) {
  return (
    <div className="controls">
      <button id="shuffleBtn" onClick={onShuffle}>
        Shuffle Rack
      </button>
      <button id="undoBtn" onClick={onUndo} disabled={!canUndo}>
        Undo
      </button>
      <button id="nextBtn" className={ready ? 'ready' : undefined} onClick={onNext}>
        {isLastRound ? 'Finish →' : 'Complete Round →'}
      </button>
    </div>
  );
}
