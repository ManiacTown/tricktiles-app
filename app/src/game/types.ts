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

export interface CellStatus {
  status: 'valid' | 'invalid';
}

export interface ValidationResult {
  runs: WordRun[];
  cellStatus: Map<string, 'valid' | 'invalid'>;
  hasIsolatedTiles: boolean;
  allWordsValid: boolean;
  isConnected: boolean;
  complete: boolean;
}
