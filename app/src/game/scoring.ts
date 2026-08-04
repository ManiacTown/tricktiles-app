import { isValidWord } from './dictionary';
import { LETTER_VALUES } from './letterBag';
import type { Board, WordRun } from './types';

export function scoreRuns(runs: WordRun[], board: Board): number {
  let total = 0;
  for (const run of runs) {
    if (isValidWord(run.word)) {
      total += run.cells.reduce((sum, [r, c]) => sum + LETTER_VALUES[board[r][c]!.letter], 0);
    }
  }
  return total;
}
