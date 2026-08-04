import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { Board } from './Board';
import { Rack } from './Rack';
import { Hud } from './Hud';
import { Controls } from './Controls';
import { Overlay } from './Overlay';
import { createInitialState, gameReducer } from '../game/gameState';
import { LETTER_VALUES } from '../game/letterBag';
import { COLS, ROUNDS, ROWS } from '../game/rounds';
import { validateBoard } from '../game/validator';
import { scoreRuns } from '../game/scoring';
import { boardFromSolution, type SolutionCell } from '../game/adminSolve';
import type { Board as BoardModel, Tile } from '../game/types';

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function statusMessage(
  complete: boolean,
  rackLength: number,
  hasIsolatedTiles: boolean,
  isConnected: boolean,
  allWordsValid: boolean,
  round: number,
): string {
  if (complete) {
    return round < ROUNDS - 1
      ? 'All tiles placed! Ready for the next round.'
      : 'Board complete — finish the game!';
  }
  if (rackLength > 0) {
    return `${rackLength} tile${rackLength === 1 ? '' : 's'} left to place.`;
  }
  if (hasIsolatedTiles) return 'Every tile needs to be part of a word (2+ letters).';
  if (!isConnected) return 'All your words need to connect into one group.';
  if (!allWordsValid) return "Some letters don't form a valid word.";
  return '';
}

const NOT_READY_MESSAGES = [
  "Hold your horses — the board isn't finished yet.",
  'Not so fast! A few tiles are still homeless.',
  "Nice try, but this board's not done cooking.",
];

interface GameScreenProps {
  // Fixed per-round letters for daily-puzzle mode; omitted for practice
  // mode, which deals randomly from the local letter bag instead.
  roundLetters?: string[];
  // Called with the 1-indexed round number right as it's completed —
  // daily mode uses this to record the completion server-side.
  onRoundComplete?: (round: number) => void;
  onPlayAgain?: () => void;
  // Admin/testing shortcut: when provided, shows a "Complete Puzzle"
  // button that jumps straight to the finished state using this
  // pre-solved reference board (see build plan section 6). Only wired up
  // for daily mode, which has one available for free from the generator.
  adminSolution?: SolutionCell[];
  onAdminComplete?: () => void;
  // Whether this GameScreen is the currently-visible tab. App.tsx keeps
  // every tab mounted (to preserve state across switches) rather than
  // conditionally rendering them, which means a hidden GameScreen's own
  // window-level keydown listener would otherwise still fire — typing on
  // one tab could silently place tiles on another, hidden one. Defaults
  // to true for callers that don't need tab-switching (there's only ever
  // one instance in that case).
  active?: boolean;
}

export function GameScreen({
  roundLetters,
  onRoundComplete,
  onPlayAgain,
  adminSolution,
  onAdminComplete,
  active = true,
}: GameScreenProps) {
  const [state, dispatch] = useReducer(gameReducer, roundLetters, createInitialState);
  const [activeTileId, setActiveTileId] = useState<string | null>(null);
  // The dragged tile's own on-screen size at the moment the drag starts —
  // applied explicitly to the DragOverlay clone so it renders at its real
  // original size (rack tile, or whatever size the board cell currently
  // is, zoom included) instead of falling back to the base .tile CSS's
  // percentage sizing, which has no meaningful parent to resolve against
  // inside the overlay portal.
  const [activeTileSize, setActiveTileSize] = useState<{ width: number; height: number } | null>(null);
  const [, forceTick] = useState(0);

  const finished = state.endTime !== null;

  useEffect(() => {
    if (finished) return;
    const id = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [finished]);

  const elapsedSeconds = Math.floor(((state.endTime ?? Date.now()) - state.startTime) / 1000);

  const validation = useMemo(
    () => validateBoard(state.board, state.rack.length === 0),
    [state.board, state.rack.length],
  );

  // Live, whole-board recompute — used to know what completing the current
  // round would lock in, and as the ceiling once it does. Not shown
  // directly once a round is locked; see displayScore below.
  const liveScore = useMemo(
    () => scoreRuns(validation.runs, state.board),
    [validation.runs, state.board],
  );

  const lockedTotal = useMemo(
    () => state.roundScores.reduce((a, b) => a + b, 0),
    [state.roundScores],
  );

  // Floored at the locked total so temporarily disturbing an earlier
  // round's words while building the current one never shows as a scary
  // dip — the number can only drop for real once the round is completed
  // and locks in (see gameState.ts's advanceRound).
  const displayScore = Math.max(lockedTotal, liveScore);

  const allTiles = useMemo(() => {
    const map = new Map<string, Tile>();
    for (const t of state.rack) map.set(t.id, t);
    for (const row of state.board) for (const t of row) if (t) map.set(t.id, t);
    return map;
  }, [state.rack, state.board]);

  // A smaller activation distance means the drag itself starts responding
  // sooner after a pointer-down; closestCenter (rather than the default
  // rectangle-overlap detection) picks whichever cell's center the
  // pointer is nearest to, so a cell can register as the drop target
  // before the dragged tile is even fully over it — the "magnetic" feel.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 2 } }));

  // The cell the next keyboard action targets — real mouse hover normally,
  // or an auto-advanced cell right after a keyboard letter placement (see
  // below). It's React state (not just a ref) because it needs to be
  // visible: Board highlights whichever cell this points at.
  const [typingCursor, setTypingCursor] = useState<{ r: number; c: number } | null>(null);
  const typingCursorRef = useRef(typingCursor);
  typingCursorRef.current = typingCursor;

  const rackRef = useRef(state.rack);
  rackRef.current = state.rack;
  const boardRef = useRef<BoardModel>(state.board);
  boardRef.current = state.board;

  // Marquee-selected board tiles (see Board.tsx) that drag or arrow keys
  // move together as a rigid group instead of individually. A selection
  // of exactly one tile is treated as no selection at all — dragging it
  // falls back to the normal single-tile path, which supports swapping
  // onto an occupied cell; MOVE_GROUP deliberately doesn't (it rejects
  // the whole move instead), since that's the right behavior for a real
  // multi-tile group but would be a regression for ordinary single drags.
  const [selectedTileIds, setSelectedTileIds] = useState<Set<string>>(new Set());
  const selectedTileIdsRef = useRef(selectedTileIds);
  selectedTileIdsRef.current = selectedTileIds;

  const [notReadyMessage, setNotReadyMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!notReadyMessage) return;
    const id = setTimeout(() => setNotReadyMessage(null), 2200);
    return () => clearTimeout(id);
  }, [notReadyMessage]);

  function handleCompleteRound() {
    if (!validation.complete) {
      setNotReadyMessage(NOT_READY_MESSAGES[Math.floor(Math.random() * NOT_READY_MESSAGES.length)]);
      return;
    }
    onRoundComplete?.(state.round + 1);
    dispatch({ type: 'ADVANCE_ROUND', liveScore });
    setSelectedTileIds(new Set());
  }

  function handleDeleteTileAt(r: number, c: number) {
    const tile = boardRef.current[r]?.[c];
    if (!tile) return;
    dispatch({ type: 'MOVE_TILE', tileId: tile.id, to: { kind: 'rack' } });
  }

  // Refs so the keydown effect below can be attached once (empty deps)
  // while always calling the latest version of these instead of going
  // stale after the first render.
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const handleCompleteRoundRef = useRef(handleCompleteRound);
  handleCompleteRoundRef.current = handleCompleteRound;
  const deleteTileAtRef = useRef(handleDeleteTileAt);
  deleteTileAtRef.current = handleDeleteTileAt;
  const activeRef = useRef(active);
  activeRef.current = active;

  // Keyboard shortcuts, attached once via refs/callbacks rather than
  // depending on state directly, so the listener never goes stale without
  // needing to be torn down and re-attached on every render.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!activeRef.current) return;
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        handleCompleteRoundRef.current();
        return;
      }

      if (e.key === 'Backspace') {
        e.preventDefault();
        dispatchRef.current({ type: 'UNDO' });
        return;
      }

      if (e.key === 'Delete') {
        const cell = typingCursorRef.current;
        if (cell) deleteTileAtRef.current(cell.r, cell.c);
        return;
      }

      if (e.key === 'Escape') {
        setSelectedTileIds(new Set());
        return;
      }

      const ARROW_DELTAS: Record<string, [number, number]> = {
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
      };
      if (e.key in ARROW_DELTAS && selectedTileIdsRef.current.size > 0) {
        e.preventDefault();
        const [dr, dc] = ARROW_DELTAS[e.key];
        dispatchRef.current({ type: 'MOVE_GROUP', tileIds: Array.from(selectedTileIdsRef.current), dr, dc });
        return;
      }

      const letter = e.key.toUpperCase();
      if (letter.length !== 1 || letter < 'A' || letter > 'Z') return;
      const cell = typingCursorRef.current;
      if (!cell) return;
      const tile = rackRef.current.find((t) => t.letter === letter);
      if (!tile) return;

      dispatchRef.current({ type: 'MOVE_TILE', tileId: tile.id, to: { kind: 'board', r: cell.r, c: cell.c } });

      // Auto-advance so the player can keep typing to spell a word without
      // touching the mouse. Vertical continuation (down) when there's a
      // tile directly above and nothing to the left suggesting a
      // horizontal word instead; otherwise the default is rightward.
      const board = boardRef.current;
      const above = cell.r > 0 ? board[cell.r - 1][cell.c] : null;
      const left = cell.c > 0 ? board[cell.r][cell.c - 1] : null;
      const vertical = above && !left;
      const dr = vertical ? 1 : 0;
      const dc = vertical ? 0 : 1;
      const inBounds = (p: { r: number; c: number }) => p.r >= 0 && p.r < ROWS && p.c >= 0 && p.c < COLS;

      let next = { r: cell.r + dr, c: cell.c + dc };
      if (inBounds(next) && board[next.r][next.c]) {
        // A single occupied cell in the way — hop over it and keep going
        // in the same direction, rather than landing on (and offering to
        // overwrite) an existing tile that's likely part of the word
        // already. Only for exactly one tile of blockage: if the cell
        // beyond that is also occupied, this isn't a quick hop-over
        // anymore, so just stop at the blocked cell as before.
        const afterNext = { r: next.r + dr, c: next.c + dc };
        if (inBounds(afterNext) && !board[afterNext.r][afterNext.c]) {
          next = afterNext;
        }
      }
      setTypingCursor(inBounds(next) ? next : null);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function handleDragStart(event: DragStartEvent) {
    setActiveTileId(event.active.id as string);
    // Measured directly from the DOM via the tile's data-tile-id rather
    // than dnd-kit's own rect.current.initial — with a small activation
    // distance (needed for the "magnetic" drag feel), onDragStart can
    // fire before dnd-kit's internal rect measurement finishes, leaving
    // rect.current.initial null and silently breaking the overlay
    // (nothing throws, it just never renders). The DOM node is always
    // there and measurable the moment the drag starts, so query for it
    // directly instead of relying on dnd-kit's timing.
    const node = document.querySelector<HTMLElement>(`[data-tile-id="${CSS.escape(String(event.active.id))}"]`);
    const rect = node?.getBoundingClientRect() ?? event.active.rect.current.initial;
    setActiveTileSize(rect ? { width: rect.width, height: rect.height } : null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTileId(null);
    setActiveTileSize(null);
    const { active, over } = event;
    if (!over) return;
    const tileId = active.id as string;
    const overId = over.id as string;

    if (overId === 'rack') {
      dispatch({ type: 'MOVE_TILE', tileId, to: { kind: 'rack' } });
      return;
    }
    if (!overId.startsWith('cell-')) return;
    const [, rStr, cStr] = overId.split('-');
    const targetR = Number(rStr);
    const targetC = Number(cStr);

    const selected = selectedTileIdsRef.current;
    if (selected.size > 1 && selected.has(tileId)) {
      const board = boardRef.current;
      let origin: { r: number; c: number } | null = null;
      outer: for (let r = 0; r < board.length; r++) {
        for (let c = 0; c < board[r].length; c++) {
          if (board[r][c]?.id === tileId) {
            origin = { r, c };
            break outer;
          }
        }
      }
      if (origin) {
        const dr = targetR - origin.r;
        const dc = targetC - origin.c;
        if (dr !== 0 || dc !== 0) {
          dispatch({ type: 'MOVE_GROUP', tileIds: Array.from(selected), dr, dc });
        }
        return;
      }
    }

    dispatch({ type: 'MOVE_TILE', tileId, to: { kind: 'board', r: targetR, c: targetC } });
  }

  const activeTile = activeTileId ? (allTiles.get(activeTileId) ?? null) : null;
  const isLastRound = state.round >= ROUNDS - 1;

  function handleAdminComplete() {
    if (!adminSolution) return;
    const result = boardFromSolution(adminSolution);
    if (!result) return;
    dispatch({ type: 'ADMIN_COMPLETE', board: result.board, score: result.score });
    onAdminComplete?.();
  }

  return (
    <>
      <Hud round={state.round} elapsedSeconds={elapsedSeconds} score={displayScore} />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <Board
          board={state.board}
          cellStatus={validation.cellStatus}
          typingCursor={typingCursor}
          onHoverCell={(cell) => setTypingCursor(cell)}
          onDeleteTile={(tileId) => dispatch({ type: 'MOVE_TILE', tileId, to: { kind: 'rack' } })}
          selectedTileIds={selectedTileIds}
          onSelectionChange={(ids) => setSelectedTileIds(new Set(ids))}
        />
        <Rack rack={state.rack} />
        <DragOverlay>
          {activeTile && activeTileSize ? (
            <div
              className="tile drag-overlay"
              style={{ width: activeTileSize.width, height: activeTileSize.height }}
            >
              {activeTile.letter}
              <span className="pts">{LETTER_VALUES[activeTile.letter]}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Controls
        onShuffle={() => dispatch({ type: 'SHUFFLE_RACK' })}
        onUndo={() => dispatch({ type: 'UNDO' })}
        onNext={handleCompleteRound}
        canUndo={state.history.length > 0}
        ready={validation.complete}
        isLastRound={isLastRound}
      />

      <div className="status">
        {notReadyMessage ??
          statusMessage(
            validation.complete,
            state.rack.length,
            validation.hasIsolatedTiles,
            validation.isConnected,
            validation.allWordsValid,
            state.round,
          )}
      </div>

      {adminSolution && !finished && (
        <button className="admin-btn" style={{ marginTop: '12px' }} onClick={handleAdminComplete}>
          Admin: Complete Puzzle
        </button>
      )}

      <Overlay
        show={finished}
        finalTime={formatTime(elapsedSeconds)}
        finalScore={lockedTotal}
        rounds={state.roundScores.map((roundScore, i) => ({
          round: i + 1,
          score: roundScore,
          elapsedSeconds: Math.floor(
            (state.roundCompletedAt[i] - (i === 0 ? state.startTime : state.roundCompletedAt[i - 1])) / 1000,
          ),
        }))}
        onPlayAgain={
          onPlayAgain ??
          (() => {
            dispatch({ type: 'RESTART' });
            setSelectedTileIds(new Set());
          })
        }
      />
    </>
  );
}
