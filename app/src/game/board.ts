import type { Board, WordRun } from './types';

export function createBoard(rows: number, cols: number): Board {
  return Array.from({ length: rows }, () => Array(cols).fill(null));
}

export function getRuns(board: Board): WordRun[] {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const runs: WordRun[] = [];

  for (let r = 0; r < rows; r++) {
    let run: Array<[number, number]> = [];
    for (let c = 0; c <= cols; c++) {
      const tile = c < cols ? board[r][c] : null;
      if (tile) {
        run.push([r, c]);
      } else {
        if (run.length >= 2) {
          runs.push(runFromCells(board, run, 'across'));
        }
        run = [];
      }
    }
  }

  for (let c = 0; c < cols; c++) {
    let run: Array<[number, number]> = [];
    for (let r = 0; r <= rows; r++) {
      const tile = r < rows ? board[r][c] : null;
      if (tile) {
        run.push([r, c]);
      } else {
        if (run.length >= 2) {
          runs.push(runFromCells(board, run, 'down'));
        }
        run = [];
      }
    }
  }

  return runs;
}

function runFromCells(
  board: Board,
  cells: Array<[number, number]>,
  orientation: 'across' | 'down',
): WordRun {
  const word = cells.map(([r, c]) => board[r][c]!.letter).join('');
  return { word, cells, orientation };
}

/**
 * Whole-board connectivity per the strict single-cluster rule: every placed
 * tile must be orthogonally reachable from every other placed tile.
 */
export function isBoardConnected(board: Board): boolean {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const placed: Array<[number, number]> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c]) placed.push([r, c]);
    }
  }
  if (placed.length <= 1) return true;

  const visited = new Set<string>();
  const stack: Array<[number, number]> = [placed[0]];
  visited.add(`${placed[0][0]},${placed[0][1]}`);

  const deltas = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];

  while (stack.length) {
    const [r, c] = stack.pop()!;
    for (const [dr, dc] of deltas) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (!board[nr][nc]) continue;
      const key = `${nr},${nc}`;
      if (visited.has(key)) continue;
      visited.add(key);
      stack.push([nr, nc]);
    }
  }

  return visited.size === placed.length;
}
