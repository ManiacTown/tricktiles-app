import { useDroppable } from '@dnd-kit/core';
import { TileView } from './TileView';
import type { Board as BoardModel, TileStatus } from '../game/types';

interface CellProps {
  r: number;
  c: number;
  tile: BoardModel[number][number];
  status?: TileStatus;
  onHoverChange?: (cell: { r: number; c: number } | null) => void;
}

function Cell({ r, c, tile, status, onHoverChange }: CellProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `cell-${r}-${c}` });
  return (
    <div
      ref={setNodeRef}
      className={`cell${isOver ? ' dragover' : ''}`}
      onPointerEnter={() => onHoverChange?.({ r, c })}
      onPointerLeave={() => onHoverChange?.(null)}
    >
      {tile && <TileView tile={tile} status={status} />}
    </div>
  );
}

interface BoardProps {
  board: BoardModel;
  cellStatus: Map<string, TileStatus>;
  // Reports which cell the pointer is currently over (or null when it
  // leaves the board) — used for the keyboard-placement shortcut: press a
  // letter key to drop a matching rack tile wherever the mouse is hovering.
  onHoverCell?: (cell: { r: number; c: number } | null) => void;
}

export function Board({ board, cellStatus, onHoverCell }: BoardProps) {
  return (
    <div id="board">
      {board.map((row, r) =>
        row.map((tile, c) => (
          <Cell
            key={`${r}-${c}`}
            r={r}
            c={c}
            tile={tile}
            status={cellStatus.get(`${r},${c}`)}
            onHoverChange={onHoverCell}
          />
        )),
      )}
    </div>
  );
}
