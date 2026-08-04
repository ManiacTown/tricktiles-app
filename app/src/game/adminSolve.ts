import { createBoard, getRuns } from './board';
import { scoreRuns } from './scoring';
import { ROWS, COLS } from './rounds';
import type { Board } from './types';

export interface SolutionCell {
  r: number;
  c: number;
  letter: string;
}

// Translates a solver-space solution (its coordinates can be negative or
// otherwise outside 0..ROWS/COLS — the solver isn't bound to a fixed grid)
// into the client's fixed board, centering it, and scores the result.
// Returns null if the solution's bounding box doesn't fit the board —
// shouldn't happen given real puzzle sizes vs. a 13x13 board, but checked
// rather than silently corrupting placement.
export function boardFromSolution(cells: SolutionCell[]): { board: Board; score: number } | null {
  if (cells.length === 0) return null;

  const rows = cells.map((c) => c.r);
  const cols = cells.map((c) => c.c);
  const minR = Math.min(...rows);
  const maxR = Math.max(...rows);
  const minC = Math.min(...cols);
  const maxC = Math.max(...cols);

  const height = maxR - minR + 1;
  const width = maxC - minC + 1;
  if (height > ROWS || width > COLS) return null;

  const offsetR = Math.floor((ROWS - height) / 2) - minR;
  const offsetC = Math.floor((COLS - width) / 2) - minC;

  const board = createBoard(ROWS, COLS);
  for (const cell of cells) {
    board[cell.r + offsetR][cell.c + offsetC] = { id: crypto.randomUUID(), letter: cell.letter };
  }

  const score = scoreRuns(getRuns(board), board);
  return { board, score };
}
