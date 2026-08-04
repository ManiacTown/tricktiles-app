import { getRuns, isBoardConnected } from './board';
import { isValidWord } from './dictionary';
import type { Board, ValidationResult } from './types';

export function validateBoard(board: Board, rackEmpty: boolean): ValidationResult {
  const runs = getRuns(board);
  const cellStatus = new Map<string, 'valid' | 'invalid'>();
  const inRun = new Set<string>();
  let allWordsValid = true;

  for (const run of runs) {
    const ok = isValidWord(run.word);
    if (!ok) allWordsValid = false;
    for (const [r, c] of run.cells) {
      const key = `${r},${c}`;
      inRun.add(key);
      const existing = cellStatus.get(key);
      const next = ok ? 'valid' : 'invalid';
      cellStatus.set(key, existing === 'invalid' ? 'invalid' : next);
    }
  }

  let hasIsolatedTiles = false;
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!board[r][c]) continue;
      const key = `${r},${c}`;
      if (!inRun.has(key)) {
        hasIsolatedTiles = true;
        cellStatus.set(key, 'invalid');
      }
    }
  }

  const isConnected = isBoardConnected(board);
  const boardHasTiles = board.some((row) => row.some((t) => t));
  const complete =
    boardHasTiles && rackEmpty && allWordsValid && !hasIsolatedTiles && isConnected;

  return { runs, cellStatus, hasIsolatedTiles, allWordsValid, isConnected, complete };
}
