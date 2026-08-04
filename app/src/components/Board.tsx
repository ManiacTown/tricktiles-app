import { useDroppable } from '@dnd-kit/core';
import { TileView } from './TileView';
import type { Board as BoardModel, TileStatus } from '../game/types';

interface CellProps {
  r: number;
  c: number;
  tile: BoardModel[number][number];
  status?: TileStatus;
}

function Cell({ r, c, tile, status }: CellProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `cell-${r}-${c}` });
  return (
    <div ref={setNodeRef} className={`cell${isOver ? ' dragover' : ''}`}>
      {tile && <TileView tile={tile} status={status} />}
    </div>
  );
}

interface BoardProps {
  board: BoardModel;
  cellStatus: Map<string, TileStatus>;
}

export function Board({ board, cellStatus }: BoardProps) {
  return (
    <div id="board">
      {board.map((row, r) =>
        row.map((tile, c) => (
          <Cell key={`${r}-${c}`} r={r} c={c} tile={tile} status={cellStatus.get(`${r},${c}`)} />
        )),
      )}
    </div>
  );
}
