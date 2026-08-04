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
    roundScores: [],
    roundCompletedAt: [],
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

describe('UNDO', () => {
  it('undoes a tile move', () => {
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
  });

  it('is a no-op when there is nothing to undo', () => {
    const state = stateWithRackTiles(['A']);
    expect(gameReducer(state, { type: 'UNDO' })).toBe(state);
  });
});

describe('MOVE_GROUP', () => {
  function stateWithBoardTiles(placements: Array<[number, number, string]>): GameState {
    let state = stateWithRackTiles(placements.map(([, , letter]) => letter));
    placements.forEach(([r, c], i) => {
      state = gameReducer(state, { type: 'MOVE_TILE', tileId: `tile-${i}`, to: { kind: 'board', r, c } });
    });
    return state;
  }

  it('moves every tile in the group by the same offset', () => {
    const state = stateWithBoardTiles([
      [2, 2, 'A'],
      [2, 3, 'B'],
    ]);
    const next = gameReducer(state, { type: 'MOVE_GROUP', tileIds: ['tile-0', 'tile-1'], dr: 1, dc: 0 });
    expect(next.board[2][2]).toBeNull();
    expect(next.board[2][3]).toBeNull();
    expect(next.board[3][2]?.letter).toBe('A');
    expect(next.board[3][3]?.letter).toBe('B');
  });

  it('allows a shift where a group member moves into a cell another group member is vacating', () => {
    const state = stateWithBoardTiles([
      [2, 2, 'A'],
      [2, 3, 'B'],
    ]);
    // Shifting right by 1: tile-0 moves into tile-1's old cell (2,3),
    // which is fine since tile-1 is moving away in the same shift.
    const next = gameReducer(state, { type: 'MOVE_GROUP', tileIds: ['tile-0', 'tile-1'], dr: 0, dc: 1 });
    expect(next.board[2][3]?.letter).toBe('A');
    expect(next.board[2][4]?.letter).toBe('B');
  });

  it('rejects the whole move (no-op) if any tile would go out of bounds', () => {
    const state = stateWithBoardTiles([
      [0, 2, 'A'],
      [2, 2, 'B'],
    ]);
    const next = gameReducer(state, { type: 'MOVE_GROUP', tileIds: ['tile-0', 'tile-1'], dr: -1, dc: 0 });
    expect(next).toBe(state);
  });

  it('rejects the whole move (no-op) if any tile would collide with a tile outside the group', () => {
    const state = stateWithBoardTiles([
      [2, 2, 'A'],
      [2, 3, 'B'],
      [3, 2, 'C'],
    ]);
    // Moving {A, B} down by 1 would put A on top of C, which isn't in the group.
    const next = gameReducer(state, { type: 'MOVE_GROUP', tileIds: ['tile-0', 'tile-1'], dr: 1, dc: 0 });
    expect(next).toBe(state);
  });
});

describe('ADVANCE_ROUND', () => {
  it('deals the next round tiles into the rack and increments round', () => {
    const state = stateWithRackTiles([]);
    const next = gameReducer(state, { type: 'ADVANCE_ROUND', liveScore: 10 });
    expect(next.round).toBe(1);
    expect(next.rack).toHaveLength(DEALS[1]);
    expect(next.endTime).toBeNull();
  });

  it('finishes the game after the last round', () => {
    let state = stateWithRackTiles([]);
    for (let i = 0; i < ROUNDS - 1; i++) {
      state = gameReducer(state, { type: 'ADVANCE_ROUND', liveScore: 10 * (i + 1) });
    }
    expect(state.round).toBe(ROUNDS - 1);
    const finished = gameReducer(state, { type: 'ADVANCE_ROUND', liveScore: 100 });
    expect(finished.round).toBe(ROUNDS);
    expect(finished.endTime).not.toBeNull();
  });

  it('locks each round score as a delta from the cumulative live score', () => {
    let state = stateWithRackTiles([]);
    state = gameReducer(state, { type: 'ADVANCE_ROUND', liveScore: 15 });
    expect(state.roundScores).toEqual([15]);

    state = gameReducer(state, { type: 'ADVANCE_ROUND', liveScore: 40 });
    expect(state.roundScores).toEqual([15, 25]);
  });

  it("keeps round 1's locked delta immutable even when round 2 damages earlier value", () => {
    let state = stateWithRackTiles([]);
    state = gameReducer(state, { type: 'ADVANCE_ROUND', liveScore: 20 });
    // The player broke an earlier word while placing round 2's tiles and
    // didn't fix it before completing the round — round 2's own delta is
    // honestly negative, but round 1's already-locked entry (20) never
    // changes; only the running total reflects the damage.
    state = gameReducer(state, { type: 'ADVANCE_ROUND', liveScore: 12 });
    expect(state.roundScores).toEqual([20, -8]);
    expect(state.roundScores.reduce((a, b) => a + b, 0)).toBe(12);
  });

  it('records a completion timestamp per round', () => {
    let state = stateWithRackTiles([]);
    state = gameReducer(state, { type: 'ADVANCE_ROUND', liveScore: 10 });
    expect(state.roundCompletedAt).toHaveLength(1);
    state = gameReducer(state, { type: 'ADVANCE_ROUND', liveScore: 20 });
    expect(state.roundCompletedAt).toHaveLength(2);
  });
});
