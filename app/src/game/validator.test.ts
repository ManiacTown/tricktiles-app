import { describe, expect, it } from 'vitest';
import { createBoard } from './board';
import { validateBoard } from './validator';
import type { Board } from './types';

function place(board: Board, r: number, c: number, letter: string) {
  board[r][c] = { id: `${r}-${c}`, letter };
}

describe('validateBoard', () => {
  it('is complete for a single valid word with an empty rack', () => {
    const board = createBoard(5, 5);
    place(board, 0, 0, 'C');
    place(board, 0, 1, 'A');
    place(board, 0, 2, 'T');
    const result = validateBoard(board, true);
    expect(result.allWordsValid).toBe(true);
    expect(result.hasIsolatedTiles).toBe(false);
    expect(result.isConnected).toBe(true);
    expect(result.complete).toBe(true);
  });

  it('is not complete while the rack still has tiles', () => {
    const board = createBoard(5, 5);
    place(board, 0, 0, 'C');
    place(board, 0, 1, 'A');
    place(board, 0, 2, 'T');
    const result = validateBoard(board, false);
    expect(result.complete).toBe(false);
  });

  it('flags an invalid word and keeps the board incomplete', () => {
    const board = createBoard(5, 5);
    place(board, 0, 0, 'Z');
    place(board, 0, 1, 'X');
    place(board, 0, 2, 'Q');
    const result = validateBoard(board, true);
    expect(result.allWordsValid).toBe(false);
    expect(result.cellStatus.get('0,0')).toBe('invalid');
    expect(result.complete).toBe(false);
  });

  it('flags a disconnected second cluster even if both words are valid', () => {
    const board = createBoard(5, 5);
    place(board, 0, 0, 'C');
    place(board, 0, 1, 'A');
    place(board, 0, 2, 'T');
    place(board, 4, 0, 'D');
    place(board, 4, 1, 'O');
    place(board, 4, 2, 'G');
    const result = validateBoard(board, true);
    expect(result.allWordsValid).toBe(true);
    expect(result.isConnected).toBe(false);
    expect(result.complete).toBe(false);
  });

  it('flags a lone tile not part of any run as isolated', () => {
    const board = createBoard(5, 5);
    place(board, 0, 0, 'C');
    place(board, 0, 1, 'A');
    place(board, 0, 2, 'T');
    place(board, 0, 4, 'S');
    const result = validateBoard(board, true);
    expect(result.hasIsolatedTiles).toBe(true);
    expect(result.cellStatus.get('0,4')).toBe('incomplete');
    expect(result.complete).toBe(false);
  });
});
