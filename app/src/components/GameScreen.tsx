import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
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
import { ROUNDS } from '../game/rounds';
import { validateBoard } from '../game/validator';
import { scoreRuns } from '../game/scoring';
import { boardFromSolution, type SolutionCell } from '../game/adminSolve';
import type { Tile } from '../game/types';

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
}

export function GameScreen({
  roundLetters,
  onRoundComplete,
  onPlayAgain,
  adminSolution,
  onAdminComplete,
}: GameScreenProps) {
  const [state, dispatch] = useReducer(gameReducer, roundLetters, createInitialState);
  const [activeTileId, setActiveTileId] = useState<string | null>(null);
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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Keyboard-placement shortcut: press a letter key to drop a matching
  // rack tile at whatever board cell the mouse is currently hovering.
  // Refs (not state) so the listener is attached once and never goes
  // stale, rather than re-attaching on every hover/rack change.
  const hoveredCellRef = useRef<{ r: number; c: number } | null>(null);
  const rackRef = useRef(state.rack);
  rackRef.current = state.rack;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const letter = e.key.toUpperCase();
      if (letter.length !== 1 || letter < 'A' || letter > 'Z') return;
      const cell = hoveredCellRef.current;
      if (!cell) return;
      const tile = rackRef.current.find((t) => t.letter === letter);
      if (!tile) return;
      dispatch({ type: 'MOVE_TILE', tileId: tile.id, to: { kind: 'board', r: cell.r, c: cell.c } });
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function handleDragStart(event: DragStartEvent) {
    setActiveTileId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTileId(null);
    const { active, over } = event;
    if (!over) return;
    const tileId = active.id as string;
    const overId = over.id as string;
    if (overId === 'rack') {
      dispatch({ type: 'MOVE_TILE', tileId, to: { kind: 'rack' } });
    } else if (overId.startsWith('cell-')) {
      const [, r, c] = overId.split('-');
      dispatch({ type: 'MOVE_TILE', tileId, to: { kind: 'board', r: Number(r), c: Number(c) } });
    }
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

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <Board
          board={state.board}
          cellStatus={validation.cellStatus}
          onHoverCell={(cell) => {
            hoveredCellRef.current = cell;
          }}
        />
        <Rack rack={state.rack} />
        <DragOverlay>
          {activeTile ? (
            <div className="tile">
              {activeTile.letter}
              <span className="pts">{LETTER_VALUES[activeTile.letter]}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Controls
        onShuffle={() => dispatch({ type: 'SHUFFLE_RACK' })}
        onUndo={() => dispatch({ type: 'UNDO' })}
        onRedo={() => dispatch({ type: 'REDO' })}
        onNext={() => {
          if (!validation.complete) return;
          onRoundComplete?.(state.round + 1);
          dispatch({ type: 'ADVANCE_ROUND', liveScore });
        }}
        canUndo={state.history.length > 0}
        canRedo={state.future.length > 0}
        ready={validation.complete}
        isLastRound={isLastRound}
      />

      <div className="status">
        {statusMessage(
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
        onPlayAgain={onPlayAgain ?? (() => dispatch({ type: 'RESTART' }))}
      />
    </>
  );
}
