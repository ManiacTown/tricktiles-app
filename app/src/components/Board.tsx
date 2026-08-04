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
  onHoverChange?: (cell: { r: number; c: number } | null) => void;
  onDeleteTile?: (tileId: string) => void;
}

function Cell({ r, c, tile, status, isTypingCursor, onHoverChange, onDeleteTile }: CellProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `cell-${r}-${c}` });
  const classes = ['cell'];
  if (isOver) classes.push('dragover');
  if (isTypingCursor) classes.push('typing-cursor');
  return (
    <div
      ref={setNodeRef}
      className={classes.join(' ')}
      onPointerEnter={() => onHoverChange?.({ r, c })}
      onPointerLeave={() => onHoverChange?.(null)}
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
}

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 1.8;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function touchDistance(a: Touch, b: Touch) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

export function Board({ board, cellStatus, onHoverCell, typingCursor, onDeleteTile }: BoardProps) {
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const wrapRef = useRef<HTMLDivElement>(null);
  const pinch = useRef<{ startDistance: number; startZoom: number } | null>(null);

  // Wheel (desktop) and pinch (touch) zoom. Attached via native listeners
  // with { passive: false } rather than React's onWheel/onTouch* props,
  // since preventDefault is required to stop the page itself from
  // scrolling/zooming and React's synthetic handlers don't reliably allow
  // that for these event types. Zoom is read from a ref inside the
  // handlers so the listeners can be attached once (empty deps) instead
  // of being torn down and re-added on every zoom change.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      setZoom(clamp(zoomRef.current - e.deltaY * 0.0015, MIN_ZOOM, MAX_ZOOM));
    }

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        pinch.current = {
          startDistance: touchDistance(e.touches[0], e.touches[1]),
          startZoom: zoomRef.current,
        };
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (e.touches.length === 2 && pinch.current) {
        e.preventDefault();
        const ratio = touchDistance(e.touches[0], e.touches[1]) / pinch.current.startDistance;
        setZoom(clamp(pinch.current.startZoom * ratio, MIN_ZOOM, MAX_ZOOM));
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (e.touches.length < 2) pinch.current = null;
    }

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  return (
    <div className="board-zoom-wrap" ref={wrapRef}>
      <div id="board" style={{ transform: `scale(${zoom})` }}>
        {board.map((row, r) =>
          row.map((tile, c) => (
            <Cell
              key={`${r}-${c}`}
              r={r}
              c={c}
              tile={tile}
              status={cellStatus.get(`${r},${c}`)}
              isTypingCursor={typingCursor?.r === r && typingCursor?.c === c}
              onHoverChange={onHoverCell}
              onDeleteTile={onDeleteTile}
            />
          )),
        )}
      </div>
    </div>
  );
}
