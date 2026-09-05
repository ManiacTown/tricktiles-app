import { useDroppable } from '@dnd-kit/core';
import { TileView } from './TileView';
import type { Tile } from '../game/types';

interface RackProps {
  rack: Tile[];
  // Tap-to-place alternative to dragging (see GameScreen). onTileClick
  // fires for a click on a specific tile; onAreaClick fires only for a
  // click on the rack's own empty background — guarded below by
  // e.target === e.currentTarget, the same pattern Overlay.tsx/
  // PauseOverlay.tsx already use for backdrop-only dismiss, so clicking a
  // tile doesn't also (redundantly) trigger the area click via bubbling.
  onTileClick?: (tileId: string) => void;
  onAreaClick?: () => void;
  // The tile currently picked up, if any — used to show which one a
  // board-cell click will place.
  heldTileId?: string | null;
}

export function Rack({ rack, onTileClick, onAreaClick, heldTileId }: RackProps) {
  const { setNodeRef, isOver } = useDroppable({ id: 'rack' });
  return (
    <div id="rackWrap">
      <div id="rackLabel">Your Tiles — drag or tap onto the board</div>
      <div
        ref={setNodeRef}
        id="rack"
        className={isOver ? 'dragover' : undefined}
        onClick={(e) => {
          if (e.target === e.currentTarget) onAreaClick?.();
        }}
      >
        {rack.map((tile) => (
          <TileView key={tile.id} tile={tile} onClick={onTileClick} held={tile.id === heldTileId} />
        ))}
      </div>
    </div>
  );
}
