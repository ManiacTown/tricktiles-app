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
  // Fixed per-round letters for daily-puzzle mode (from Supabase's
  // daily_puzzles.rounds), sourced instead of the random letter bag.
  // Undefined in practice mode, where rounds deal randomly as before.
  roundLetters?: string[];
  // Per-round locked score deltas (index 0 = round 1, etc.), set once when
  // that round completes and never recomputed afterward — so rearranging
  // an earlier round's tiles while working on a later one can't
  // retroactively change what's already been "banked." Sum for the total.
  roundScores: number[];
  // Wall-clock time each round completed, parallel to roundScores — used
  // for the end screen's round-by-round breakdown.
  roundCompletedAt: number[];
}

interface Snapshot {
  board: Board;
  rack: Tile[];
}

// The subset of GameState worth persisting server-side so a player who
// closes the tab mid-round doesn't lose progress on the daily puzzle.
// Deliberately excludes undo history (fine to lose on reload) and
// roundLetters (already known independently from the fetched puzzle).
export interface PersistedGameState {
  board: Board;
  rack: Tile[];
  round: number;
  startTime: number;
  endTime: number | null;
  roundScores: number[];
  roundCompletedAt: number[];
}

export function toPersistedState(state: GameState): PersistedGameState {
  const { board, rack, round, startTime, endTime, roundScores, roundCompletedAt } = state;
  return { board, rack, round, startTime, endTime, roundScores, roundCompletedAt };
}

export function hydrateState(persisted: PersistedGameState, roundLetters?: string[]): GameState {
  return { ...persisted, history: [], roundLetters };
}

export type GameAction =
  | { type: 'MOVE_TILE'; tileId: string; to: { kind: 'rack' } | { kind: 'board'; r: number; c: number } }
  | { type: 'SHUFFLE_RACK' }
  // liveScore is the full-board score at the moment the round completes,
  // computed by the caller (which already has the validator result) — the
  // reducer derives this round's own delta from it rather than
  // re-running word validation itself.
  | { type: 'ADVANCE_ROUND'; liveScore: number }
  | { type: 'RESTART' }
  | { type: 'UNDO' }
  // Moves a whole set of board tiles (a marquee selection) by the same
  // (dr, dc) offset in one shot — used by both group-drag and arrow-key
  // nudging. If any tile in the group would go out of bounds or land on
  // a cell occupied by something outside the group, the whole move is
  // rejected (no-op) rather than partially applied — see gameState.ts's
  // moveGroup. Tiles moving into cells vacated by other group members are
  // always fine, since a rigid shift can never make group members
  // collide with each other.
  | { type: 'MOVE_GROUP'; tileIds: string[]; dr: number; dc: number }
  // Admin/testing shortcut: jump straight to a finished game with a given
  // (already-solved, already-translated-to-fit-the-board) board and final
  // score, skipping manual play entirely. See GameScreen's admin button.
  | { type: 'ADMIN_COMPLETE'; board: Board; score: number };

const MAX_HISTORY = 50;

function dealTiles(n: number): Tile[] {
  return dealLetters(n).map((letter) => ({ id: crypto.randomUUID(), letter }));
}

function lettersToTiles(letters: string): Tile[] {
  return [...letters].map((letter) => ({ id: crypto.randomUUID(), letter }));
}

function tilesForRound(round: number, roundLetters?: string[]): Tile[] {
  return roundLetters ? lettersToTiles(roundLetters[round]) : dealTiles(DEALS[round]);
}

export function createInitialState(roundLetters?: string[]): GameState {
  return {
    board: createBoard(ROWS, COLS),
    rack: tilesForRound(0, roundLetters),
    round: 0,
    startTime: Date.now(),
    endTime: null,
    history: [],
    roundLetters,
    roundScores: [],
    roundCompletedAt: [],
  };
}

function cloneSnapshot(state: GameState): Snapshot {
  return { board: structuredClone(state.board), rack: structuredClone(state.rack) };
}

function pushHistory(state: GameState): Pick<GameState, 'history'> {
  const history = [...state.history, cloneSnapshot(state)].slice(-MAX_HISTORY);
  return { history };
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

function moveGroup(state: GameState, tileIds: string[], dr: number, dc: number): GameState {
  const idSet = new Set(tileIds);
  const rows = state.board.length;
  const cols = state.board[0]?.length ?? 0;

  const positions = new Map<string, { r: number; c: number; tile: Tile }>();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = state.board[r][c];
      if (tile && idSet.has(tile.id)) positions.set(tile.id, { r, c, tile });
    }
  }

  for (const pos of positions.values()) {
    const nr = pos.r + dr;
    const nc = pos.c + dc;
    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) return state;
    const occupant = state.board[nr][nc];
    if (occupant && !idSet.has(occupant.id)) return state;
  }

  const board = state.board.map((row) => [...row]);
  for (const pos of positions.values()) board[pos.r][pos.c] = null;
  for (const pos of positions.values()) board[pos.r + dr][pos.c + dc] = pos.tile;

  return { ...state, ...pushHistory(state), board };
}

function shuffleRack(state: GameState): GameState {
  const rack = [...state.rack];
  for (let i = rack.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rack[i], rack[j]] = [rack[j], rack[i]];
  }
  return { ...state, rack };
}

function advanceRound(state: GameState, liveScore: number): GameState {
  const previouslyLocked = state.roundScores.reduce((a, b) => a + b, 0);
  const roundScores = [...state.roundScores, liveScore - previouslyLocked];
  const roundCompletedAt = [...state.roundCompletedAt, Date.now()];

  const nextRound = state.round + 1;
  if (nextRound >= ROUNDS) {
    return { ...state, round: ROUNDS, endTime: Date.now(), roundScores, roundCompletedAt };
  }
  return {
    ...state,
    round: nextRound,
    roundScores,
    roundCompletedAt,
    rack: [...state.rack, ...tilesForRound(nextRound, state.roundLetters)],
  };
}

function adminComplete(state: GameState, board: Board, score: number): GameState {
  const now = Date.now();
  const roundScores = Array.from({ length: ROUNDS }, (_, i) => (i === ROUNDS - 1 ? score : 0));
  const roundCompletedAt = Array.from({ length: ROUNDS }, () => now);
  return {
    ...state,
    board,
    rack: [],
    round: ROUNDS,
    endTime: now,
    roundScores,
    roundCompletedAt,
  };
}

function undo(state: GameState): GameState {
  if (state.history.length === 0) return state;
  const previous = state.history[state.history.length - 1];
  const history = state.history.slice(0, -1);
  return { ...state, board: previous.board, rack: previous.rack, history };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'MOVE_TILE':
      return moveTile(state, action);
    case 'SHUFFLE_RACK':
      return shuffleRack(state);
    case 'ADVANCE_ROUND':
      return advanceRound(state, action.liveScore);
    case 'RESTART':
      return createInitialState(state.roundLetters);
    case 'UNDO':
      return undo(state);
    case 'MOVE_GROUP':
      return moveGroup(state, action.tileIds, action.dr, action.dc);
    case 'ADMIN_COMPLETE':
      return adminComplete(state, action.board, action.score);
    default:
      return state;
  }
}
