import { describe, expect, it } from 'vitest';
import { boardFromSolution } from './adminSolve';
import { getRuns } from './board';
import { ROWS, COLS } from './rounds';

describe('boardFromSolution', () => {
  it('translates negative/arbitrary solver coordinates onto the fixed board', () => {
    // CAT across, sharing the C with CAR down — same shape used in the
    // solver's own tests, deliberately placed off-origin with negatives.
    const result = boardFromSolution([
      { r: -2, c: 5, letter: 'C' },
      { r: -2, c: 6, letter: 'A' },
      { r: -2, c: 7, letter: 'T' },
      { r: -1, c: 5, letter: 'A' },
      { r: 0, c: 5, letter: 'R' },
    ]);

    expect(result).not.toBeNull();
    const { board } = result!;

    for (const row of board) {
      expect(row).toHaveLength(COLS);
    }
    expect(board).toHaveLength(ROWS);

    const words = getRuns(board)
      .map((r) => r.word)
      .sort();
    expect(words).toEqual(['CAR', 'CAT']);
  });

  it('returns null for an empty solution', () => {
    expect(boardFromSolution([])).toBeNull();
  });

  it('returns null when the bounding box is too large for the board', () => {
    const cells = Array.from({ length: ROWS + 1 }, (_, i) => ({ r: i, c: 0, letter: 'A' }));
    expect(boardFromSolution(cells)).toBeNull();
  });

  it('keeps cells within board bounds after translation', () => {
    const result = boardFromSolution([
      { r: -6, c: -6, letter: 'A' },
      { r: -6, c: -5, letter: 'B' },
    ]);
    expect(result).not.toBeNull();
    let placedCount = 0;
    for (const row of result!.board) {
      for (const tile of row) {
        if (tile) placedCount++;
      }
    }
    expect(placedCount).toBe(2);
  });
});
