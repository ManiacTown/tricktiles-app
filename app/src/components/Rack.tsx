import { useDroppable } from '@dnd-kit/core';
import { TileView } from './TileView';
import type { Tile } from '../game/types';

interface RackProps {
  rack: Tile[];
}

export function Rack({ rack }: RackProps) {
  const { setNodeRef, isOver } = useDroppable({ id: 'rack' });
  return (
    <div id="rackWrap">
      <div id="rackLabel">Your Tiles — drag onto the board</div>
      <div ref={setNodeRef} id="rack" className={isOver ? 'dragover' : undefined}>
        {rack.map((tile) => (
          <TileView key={tile.id} tile={tile} />
        ))}
      </div>
    </div>
  );
}
