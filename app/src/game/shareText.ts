// Wordle/Pushdle-style shareable result summary. puzzleNumber is undefined
// in practice mode (there's no puzzle to number), which reads as
// "(Practice)" instead of a "#N" — see the daily-only puzzle-number
// placeholder note in DailyChallenge.tsx.
export function buildShareText({
  puzzleNumber,
  time,
}: {
  puzzleNumber?: number;
  time: string;
}): string {
  const header = puzzleNumber != null ? `TrickTiles #${puzzleNumber}` : 'TrickTiles (Practice)';
  return `${header}\nTime: ${time}`;
}
