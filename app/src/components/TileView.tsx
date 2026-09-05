import { useDraggable } from '@dnd-kit/core';
import type { Tile, TileStatus } from '../game/types';

interface TileViewProps {
  tile: Tile;
  status?: TileStatus;
  // Right-click deletes the tile (moves it back to the rack) as a faster
  // alternative to dragging it out.
  onDelete?: (tileId: string) => void;
  // Tap-to-place alternative to dragging — only wired up for rack tiles
  // (Rack.tsx); a board-placed tile is clicked via its enclosing Cell
  // instead (Board.tsx), which bubbles up to the same click without this
  // tile needing its own handler there.
  onClick?: (tileId: string) => void;
  // Whether THIS tile is the one currently picked up for tap-to-place —
  // renders a visual "armed" indicator so it's clear which tile a
  // subsequent cell click will place, especially on touch where there's
  // no hover state to fall back on.
  held?: boolean;
}

export function TileView({ tile, status, onDelete, onClick, held }: TileViewProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: tile.id,
  });

  const classes = ['tile'];
  if (status) classes.push(status);
  if (isDragging) classes.push('dragging');
  if (held) classes.push('held');

  return (
    <div
      ref={setNodeRef}
      className={classes.join(' ')}
      data-tile-id={tile.id}
      {...listeners}
      {...attributes}
      onClick={() => onClick?.(tile.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        onDelete?.(tile.id);
      }}
    >
      {tile.letter}
    </div>
  );
}
