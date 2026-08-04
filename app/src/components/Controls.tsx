interface ControlsProps {
  onShuffle: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onNext: () => void;
  canUndo: boolean;
  canRedo: boolean;
  ready: boolean;
  isLastRound: boolean;
}

export function Controls({
  onShuffle,
  onUndo,
  onRedo,
  onNext,
  canUndo,
  canRedo,
  ready,
  isLastRound,
}: ControlsProps) {
  return (
    <div className="controls">
      <button id="shuffleBtn" onClick={onShuffle}>
        Shuffle Rack
      </button>
      <button id="undoBtn" onClick={onUndo} disabled={!canUndo}>
        Undo
      </button>
      <button id="redoBtn" onClick={onRedo} disabled={!canRedo}>
        Redo
      </button>
      <button id="nextBtn" className={ready ? 'ready' : undefined} onClick={onNext}>
        {isLastRound ? 'Finish →' : 'Complete Round →'}
      </button>
    </div>
  );
}
