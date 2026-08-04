export interface Tile {
  id: string;
  letter: string;
}

export type Board = (Tile | null)[][];

export interface WordRun {
  word: string;
  cells: Array<[number, number]>;
  orientation: 'across' | 'down';
}

export type TileStatus = 'valid' | 'invalid' | 'incomplete';

export interface ValidationResult {
  runs: WordRun[];
  cellStatus: Map<string, TileStatus>;
  hasIsolatedTiles: boolean;
  allWordsValid: boolean;
  isConnected: boolean;
  complete: boolean;
}
