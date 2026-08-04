import { useDraggable } from '@dnd-kit/core';
import { LETTER_VALUES } from '../game/letterBag';
import type { Tile, TileStatus } from '../game/types';

interface TileViewProps {
  tile: Tile;
  status?: TileStatus;
  // Right-click deletes the tile (moves it back to the rack) as a faster
  // alternative to dragging it out.
  onDelete?: (tileId: string) => void;
}

export function TileView({ tile, status, onDelete }: TileViewProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: tile.id,
  });

  const classes = ['tile'];
  if (status) classes.push(status);
  if (isDragging) classes.push('dragging');

  return (
    <div
      ref={setNodeRef}
      className={classes.join(' ')}
      {...listeners}
      {...attributes}
      onContextMenu={(e) => {
        e.preventDefault();
        onDelete?.(tile.id);
      }}
    >
      {tile.letter}
      <span className="pts">{LETTER_VALUES[tile.letter]}</span>
    </div>
  );
}
