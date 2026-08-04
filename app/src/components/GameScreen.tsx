import { useEffect, useMemo, useReducer, useState } from 'react';
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
import { isValidWord } from '../game/dictionary';
import { LETTER_VALUES } from '../game/letterBag';
import { ROUNDS } from '../game/rounds';
import { validateBoard } from '../game/validator';
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
}

export function GameScreen({ roundLetters, onRoundComplete, onPlayAgain }: GameScreenProps) {
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

  const score = useMemo(() => {
    let total = 0;
    for (const run of validation.runs) {
      if (isValidWord(run.word)) {
        total += run.cells.reduce((sum, [r, c]) => sum + LETTER_VALUES[state.board[r][c]!.letter], 0);
      }
    }
    return total;
  }, [validation.runs, state.board]);

  const allTiles = useMemo(() => {
    const map = new Map<string, Tile>();
    for (const t of state.rack) map.set(t.id, t);
    for (const row of state.board) for (const t of row) if (t) map.set(t.id, t);
    return map;
  }, [state.rack, state.board]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

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

  return (
    <>
      <Hud round={state.round} elapsedSeconds={elapsedSeconds} score={score} />

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <Board board={state.board} cellStatus={validation.cellStatus} />
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
          dispatch({ type: 'ADVANCE_ROUND' });
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

      <Overlay
        show={finished}
        finalTime={formatTime(elapsedSeconds)}
        finalScore={score}
        onPlayAgain={onPlayAgain ?? (() => dispatch({ type: 'RESTART' }))}
      />
    </>
  );
}
