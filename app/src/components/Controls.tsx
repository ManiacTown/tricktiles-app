interface ControlsProps {
  // Shifts every placed board tile by one cell in the given direction —
  // a rigid whole-board move, not just the tiles in a selection. See
  // GameScreen's handleShiftBoard, which reuses MOVE_GROUP with every
  // board tile's ID as the group.
  onShift: (dr: number, dc: number) => void;
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

export function Controls({ onShift, onUndo, onNext, canUndo, ready, isLastRound, disabled = false }: ControlsProps) {
  return (
    <div className="controls">
      <div className="shift-controls" role="group" aria-label="Shift board">
        <button
          className="shift-btn"
          onClick={() => onShift(0, -1)}
          disabled={disabled}
          aria-label="Shift board left"
        >
          ←
        </button>
        <button className="shift-btn" onClick={() => onShift(-1, 0)} disabled={disabled} aria-label="Shift board up">
          ↑
        </button>
        <button
          className="shift-btn"
          onClick={() => onShift(1, 0)}
          disabled={disabled}
          aria-label="Shift board down"
        >
          ↓
        </button>
        <button
          className="shift-btn"
          onClick={() => onShift(0, 1)}
          disabled={disabled}
          aria-label="Shift board right"
        >
          →
        </button>
      </div>
      <button id="undoBtn" onClick={onUndo} disabled={disabled || !canUndo}>
        Undo
      </button>
      <button id="nextBtn" className={ready && !disabled ? 'ready' : undefined} onClick={onNext} disabled={disabled}>
        {isLastRound ? 'Finish →' : 'Complete Round →'}
      </button>
    </div>
  );
}
