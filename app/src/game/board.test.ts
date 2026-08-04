import { describe, expect, it } from 'vitest';
import { createBoard, getRuns, isBoardConnected } from './board';
import type { Board } from './types';

function place(board: Board, r: number, c: number, letter: string) {
  board[r][c] = { id: `${r}-${c}`, letter };
}

describe('getRuns', () => {
  it('finds a single across word', () => {
    const board = createBoard(5, 5);
    place(board, 0, 0, 'C');
    place(board, 0, 1, 'A');
    place(board, 0, 2, 'T');
    const runs = getRuns(board);
    expect(runs).toHaveLength(1);
    expect(runs[0].word).toBe('CAT');
    expect(runs[0].orientation).toBe('across');
  });

  it('does not treat a lone tile as a run', () => {
    const board = createBoard(5, 5);
    place(board, 2, 2, 'A');
    expect(getRuns(board)).toHaveLength(0);
  });

  it('finds crossing across and down words', () => {
    const board = createBoard(5, 5);
    // CAT across at row 0, and CAR down through the C
    place(board, 0, 0, 'C');
    place(board, 0, 1, 'A');
    place(board, 0, 2, 'T');
    place(board, 1, 0, 'A');
    place(board, 2, 0, 'R');
    const runs = getRuns(board);
    const words = runs.map((r) => r.word).sort();
    expect(words).toEqual(['CAR', 'CAT']);
  });
});

describe('isBoardConnected', () => {
  it('is trivially connected when empty or single tile', () => {
    const empty = createBoard(5, 5);
    expect(isBoardConnected(empty)).toBe(true);
    place(empty, 0, 0, 'A');
    expect(isBoardConnected(empty)).toBe(true);
  });

  it('is connected when tiles share edges', () => {
    const board = createBoard(5, 5);
    place(board, 0, 0, 'C');
    place(board, 0, 1, 'A');
    place(board, 0, 2, 'T');
    expect(isBoardConnected(board)).toBe(true);
  });

  it('is not connected when two separate clusters exist', () => {
    const board = createBoard(5, 5);
    place(board, 0, 0, 'C');
    place(board, 0, 1, 'A');
    place(board, 0, 2, 'T');
    place(board, 4, 4, 'D');
    place(board, 4, 3, 'O');
    place(board, 4, 2, 'G');
    expect(isBoardConnected(board)).toBe(false);
  });

  it('treats diagonal-only adjacency as disconnected', () => {
    const board = createBoard(5, 5);
    place(board, 0, 0, 'A');
    place(board, 1, 1, 'B');
    expect(isBoardConnected(board)).toBe(false);
  });
});
