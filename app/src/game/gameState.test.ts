import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBoard } from './board';
import { COLS, DEALS, ROUNDS, ROWS } from './rounds';
import { createInitialState, gameReducer, type GameState } from './gameState';

function stateWithRackTiles(letters: string[]): GameState {
  return {
    board: createBoard(ROWS, COLS),
    rack: letters.map((letter, i) => ({ id: `tile-${i}`, letter })),
    round: 0,
    startTime: Date.now(),
    endTime: null,
    history: [],
    future: [],
  };
}

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0);
});

describe('createInitialState', () => {
  it('deals the first round from the letter bag', () => {
    const state = createInitialState();
    expect(state.rack).toHaveLength(DEALS[0]);
    expect(state.round).toBe(0);
    expect(state.endTime).toBeNull();
  });
});

describe('MOVE_TILE', () => {
  it('moves a tile from the rack onto the board', () => {
    const state = stateWithRackTiles(['A', 'B']);
    const next = gameReducer(state, {
      type: 'MOVE_TILE',
      tileId: 'tile-0',
      to: { kind: 'board', r: 3, c: 3 },
    });
    expect(next.board[3][3]?.letter).toBe('A');
    expect(next.rack.map((t) => t.id)).toEqual(['tile-1']);
  });

  it('swaps the occupant back to the rack when dropped on an occupied cell', () => {
    let state = stateWithRackTiles(['A', 'B']);
    state = gameReducer(state, {
      type: 'MOVE_TILE',
      tileId: 'tile-0',
      to: { kind: 'board', r: 3, c: 3 },
    });
    const next = gameReducer(state, {
      type: 'MOVE_TILE',
      tileId: 'tile-1',
      to: { kind: 'board', r: 3, c: 3 },
    });
    expect(next.board[3][3]?.letter).toBe('B');
    expect(next.rack.map((t) => t.id)).toEqual(['tile-0']);
  });

  it('moves a board tile back to the rack', () => {
    let state = stateWithRackTiles(['A']);
    state = gameReducer(state, {
      type: 'MOVE_TILE',
      tileId: 'tile-0',
      to: { kind: 'board', r: 3, c: 3 },
    });
    const next = gameReducer(state, { type: 'MOVE_TILE', tileId: 'tile-0', to: { kind: 'rack' } });
    expect(next.board[3][3]).toBeNull();
    expect(next.rack.map((t) => t.id)).toEqual(['tile-0']);
  });
});

describe('UNDO/REDO', () => {
  it('undoes and redoes a tile move', () => {
    const state = stateWithRackTiles(['A']);
    const moved = gameReducer(state, {
      type: 'MOVE_TILE',
      tileId: 'tile-0',
      to: { kind: 'board', r: 0, c: 0 },
    });
    expect(moved.board[0][0]?.letter).toBe('A');

    const undone = gameReducer(moved, { type: 'UNDO' });
    expect(undone.board[0][0]).toBeNull();
    expect(undone.rack.map((t) => t.id)).toEqual(['tile-0']);

    const redone = gameReducer(undone, { type: 'REDO' });
    expect(redone.board[0][0]?.letter).toBe('A');
  });

  it('is a no-op when there is nothing to undo or redo', () => {
    const state = stateWithRackTiles(['A']);
    expect(gameReducer(state, { type: 'UNDO' })).toBe(state);
    expect(gameReducer(state, { type: 'REDO' })).toBe(state);
  });
});

describe('ADVANCE_ROUND', () => {
  it('deals the next round tiles into the rack and increments round', () => {
    const state = stateWithRackTiles([]);
    const next = gameReducer(state, { type: 'ADVANCE_ROUND' });
    expect(next.round).toBe(1);
    expect(next.rack).toHaveLength(DEALS[1]);
    expect(next.endTime).toBeNull();
  });

  it('finishes the game after the last round', () => {
    let state = stateWithRackTiles([]);
    for (let i = 0; i < ROUNDS - 1; i++) {
      state = gameReducer(state, { type: 'ADVANCE_ROUND' });
    }
    expect(state.round).toBe(ROUNDS - 1);
    const finished = gameReducer(state, { type: 'ADVANCE_ROUND' });
    expect(finished.round).toBe(ROUNDS);
    expect(finished.endTime).not.toBeNull();
  });
});
