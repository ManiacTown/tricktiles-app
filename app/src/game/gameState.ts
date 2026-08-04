import { createBoard } from './board';
import { dealLetters } from './letterBag';
import { COLS, DEALS, ROUNDS, ROWS } from './rounds';
import type { Board, Tile } from './types';

export interface GameState {
  board: Board;
  rack: Tile[];
  round: number; // 0-indexed, current round in progress
  startTime: number;
  endTime: number | null;
  history: Snapshot[];
  future: Snapshot[];
}

interface Snapshot {
  board: Board;
  rack: Tile[];
}

export type GameAction =
  | { type: 'MOVE_TILE'; tileId: string; to: { kind: 'rack' } | { kind: 'board'; r: number; c: number } }
  | { type: 'SHUFFLE_RACK' }
  | { type: 'ADVANCE_ROUND' }
  | { type: 'RESTART' }
  | { type: 'UNDO' }
  | { type: 'REDO' };

const MAX_HISTORY = 50;

function dealTiles(n: number): Tile[] {
  return dealLetters(n).map((letter) => ({ id: crypto.randomUUID(), letter }));
}

export function createInitialState(): GameState {
  return {
    board: createBoard(ROWS, COLS),
    rack: dealTiles(DEALS[0]),
    round: 0,
    startTime: Date.now(),
    endTime: null,
    history: [],
    future: [],
  };
}

function cloneSnapshot(state: GameState): Snapshot {
  return { board: structuredClone(state.board), rack: structuredClone(state.rack) };
}

function pushHistory(state: GameState): Pick<GameState, 'history' | 'future'> {
  const history = [...state.history, cloneSnapshot(state)].slice(-MAX_HISTORY);
  return { history, future: [] };
}

function findTile(state: GameState, tileId: string):
  | { source: 'rack' }
  | { source: 'board'; r: number; c: number }
  | null {
  if (state.rack.some((t) => t.id === tileId)) return { source: 'rack' };
  for (let r = 0; r < state.board.length; r++) {
    for (let c = 0; c < state.board[r].length; c++) {
      if (state.board[r][c]?.id === tileId) return { source: 'board', r, c };
    }
  }
  return null;
}

function moveTile(state: GameState, action: Extract<GameAction, { type: 'MOVE_TILE' }>): GameState {
  const location = findTile(state, action.tileId);
  if (!location) return state;

  const board = state.board.map((row) => [...row]);
  let rack = [...state.rack];
  let tile: Tile;

  if (location.source === 'rack') {
    tile = rack.find((t) => t.id === action.tileId)!;
    rack = rack.filter((t) => t.id !== action.tileId);
  } else {
    tile = board[location.r][location.c]!;
    board[location.r][location.c] = null;
  }

  if (action.to.kind === 'rack') {
    rack = [...rack, tile];
  } else {
    const { r, c } = action.to;
    const occupant = board[r][c];
    if (occupant && occupant.id !== tile.id) {
      rack = [...rack, occupant];
    }
    board[r][c] = tile;
  }

  return { ...state, ...pushHistory(state), board, rack };
}

function shuffleRack(state: GameState): GameState {
  const rack = [...state.rack];
  for (let i = rack.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rack[i], rack[j]] = [rack[j], rack[i]];
  }
  return { ...state, rack };
}

function advanceRound(state: GameState): GameState {
  const nextRound = state.round + 1;
  if (nextRound >= ROUNDS) {
    return { ...state, round: ROUNDS, endTime: Date.now() };
  }
  return {
    ...state,
    round: nextRound,
    rack: [...state.rack, ...dealTiles(DEALS[nextRound])],
  };
}

function undo(state: GameState): GameState {
  if (state.history.length === 0) return state;
  const previous = state.history[state.history.length - 1];
  const history = state.history.slice(0, -1);
  const future = [cloneSnapshot(state), ...state.future].slice(0, MAX_HISTORY);
  return { ...state, board: previous.board, rack: previous.rack, history, future };
}

function redo(state: GameState): GameState {
  if (state.future.length === 0) return state;
  const next = state.future[0];
  const future = state.future.slice(1);
  const history = [...state.history, cloneSnapshot(state)].slice(-MAX_HISTORY);
  return { ...state, board: next.board, rack: next.rack, history, future };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'MOVE_TILE':
      return moveTile(state, action);
    case 'SHUFFLE_RACK':
      return shuffleRack(state);
    case 'ADVANCE_ROUND':
      return advanceRound(state);
    case 'RESTART':
      return createInitialState();
    case 'UNDO':
      return undo(state);
    case 'REDO':
      return redo(state);
    default:
      return state;
  }
}
