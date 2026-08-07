import { useEffect, useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { TileView } from './TileView';
import type { Board as BoardModel, TileStatus } from '../game/types';

interface CellProps {
  r: number;
  c: number;
  tile: BoardModel[number][number];
  status?: TileStatus;
  isTypingCursor: boolean;
  isSelected: boolean;
  onHoverChange?: (cell: { r: number; c: number } | null) => void;
  onDeleteTile?: (tileId: string) => void;
  onMarqueeStart?: (cell: { r: number; c: number }) => void;
}

function Cell({
  r,
  c,
  tile,
  status,
  isTypingCursor,
  isSelected,
  onHoverChange,
  onDeleteTile,
  onMarqueeStart,
}: CellProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `cell-${r}-${c}` });
  const classes = ['cell'];
  if (isOver) classes.push('dragover');
  if (isTypingCursor) classes.push('typing-cursor');
  if (isSelected) classes.push('selected');
  return (
    <div
      ref={setNodeRef}
      className={classes.join(' ')}
      onPointerEnter={() => onHoverChange?.({ r, c })}
      onPointerLeave={() => onHoverChange?.(null)}
      onPointerDown={(e) => {
        // Marquee-select only starts from empty board space — starting on
        // a tile is left to dnd-kit's own drag handling. preventDefault
        // stops the browser's native click-and-drag text/content
        // selection from taking over the gesture instead — without it,
        // a real mouse drag can silently turn into a text selection and
        // the marquee never sees the pointer move.
        if (!tile) {
          e.preventDefault();
          onMarqueeStart?.({ r, c });
        }
      }}
    >
      {tile && <TileView tile={tile} status={status} onDelete={onDeleteTile} />}
    </div>
  );
}

interface BoardProps {
  board: BoardModel;
  cellStatus: Map<string, TileStatus>;
  // Reports which cell the pointer is currently over (or null when it
  // leaves the board) — used for the keyboard-placement shortcut: press a
  // letter key to drop a matching rack tile wherever the mouse is hovering.
  onHoverCell?: (cell: { r: number; c: number } | null) => void;
  // The cell the next typed letter will land in — either wherever the
  // mouse is actually hovering, or, after a keyboard placement, the
  // auto-advanced next cell (see GameScreen). Highlighted so the player
  // can see where the next keystroke will go without needing the mouse
  // to still be there.
  typingCursor?: { r: number; c: number } | null;
  onDeleteTile?: (tileId: string) => void;
  // Tile IDs currently selected (via marquee-drag) as a group — see
  // GameScreen for what selecting a group enables (drag/arrow-nudge them
  // together).
  selectedTileIds?: Set<string>;
  // Called once a marquee-drag finishes, with every tile ID whose cell
  // fell inside the dragged rectangle (possibly empty).
  onSelectionChange?: (tileIds: string[]) => void;
}

export function Board({
  board,
  cellStatus,
  onHoverCell,
  typingCursor,
  onDeleteTile,
  selectedTileIds,
  onSelectionChange,
}: BoardProps) {
  // Marquee (drag-select) for grouping multiple board tiles. Tracked as
  // cell coordinates rather than pixels — simpler, and correct at any
  // zoom level for free since it's driven by which cell the pointer is
  // actually over (real hit-testing), not geometry math.
  const [marqueeAnchor, setMarqueeAnchor] = useState<{ r: number; c: number } | null>(null);
  const [marqueeCurrent, setMarqueeCurrent] = useState<{ r: number; c: number } | null>(null);

  const boardRef = useRef(board);
  boardRef.current = board;
  const marqueeAnchorRef = useRef(marqueeAnchor);
  marqueeAnchorRef.current = marqueeAnchor;
  const marqueeCurrentRef = useRef(marqueeCurrent);
  marqueeCurrentRef.current = marqueeCurrent;
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;

  // Finalizing on a window-level pointerup (not just the board) so a
  // marquee that ends outside the board's bounds still resolves cleanly.
  useEffect(() => {
    function onPointerUp() {
      const anchor = marqueeAnchorRef.current;
      const current = marqueeCurrentRef.current;
      if (anchor && current) {
        const minR = Math.min(anchor.r, current.r);
        const maxR = Math.max(anchor.r, current.r);
        const minC = Math.min(anchor.c, current.c);
        const maxC = Math.max(anchor.c, current.c);
        const ids: string[] = [];
        for (let r = minR; r <= maxR; r++) {
          for (let c = minC; c <= maxC; c++) {
            const tile = boardRef.current[r]?.[c];
            if (tile) ids.push(tile.id);
          }
        }
        onSelectionChangeRef.current?.(ids);
      }
      setMarqueeAnchor(null);
      setMarqueeCurrent(null);
    }
    window.addEventListener('pointerup', onPointerUp);
    return () => window.removeEventListener('pointerup', onPointerUp);
  }, []);

  function isInMarqueeRect(r: number, c: number): boolean {
    if (!marqueeAnchor || !marqueeCurrent) return false;
    const minR = Math.min(marqueeAnchor.r, marqueeCurrent.r);
    const maxR = Math.max(marqueeAnchor.r, marqueeCurrent.r);
    const minC = Math.min(marqueeAnchor.c, marqueeCurrent.c);
    const maxC = Math.max(marqueeAnchor.c, marqueeCurrent.c);
    return r >= minR && r <= maxR && c >= minC && c <= maxC;
  }

  return (
    <div id="board">
      {board.map((row, r) =>
        row.map((tile, c) => (
          <Cell
            key={`${r}-${c}`}
            r={r}
            c={c}
            tile={tile}
            status={cellStatus.get(`${r},${c}`)}
            isTypingCursor={typingCursor?.r === r && typingCursor?.c === c}
            isSelected={Boolean(tile && selectedTileIds?.has(tile.id)) || isInMarqueeRect(r, c)}
            onHoverChange={(cell) => {
              onHoverCell?.(cell);
              if (cell && marqueeAnchor) setMarqueeCurrent(cell);
            }}
            onDeleteTile={onDeleteTile}
            onMarqueeStart={(cell) => {
              setMarqueeAnchor(cell);
              setMarqueeCurrent(cell);
            }}
          />
        )),
      )}
    </div>
  );
}
