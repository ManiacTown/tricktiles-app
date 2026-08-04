import { useDraggable } from '@dnd-kit/core';
import { LETTER_VALUES } from '../game/letterBag';
import type { Tile, TileStatus } from '../game/types';

interface TileViewProps {
  tile: Tile;
  status?: TileStatus;
}

export function TileView({ tile, status }: TileViewProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: tile.id,
  });

  const classes = ['tile'];
  if (status) classes.push(status);
  if (isDragging) classes.push('dragging');

  return (
    <div ref={setNodeRef} className={classes.join(' ')} {...listeners} {...attributes}>
      {tile.letter}
      <span className="pts">{LETTER_VALUES[tile.letter]}</span>
    </div>
  );
}
