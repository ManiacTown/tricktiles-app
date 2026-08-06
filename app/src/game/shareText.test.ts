import { describe, expect, it } from 'vitest';
import { buildShareText } from './shareText';

describe('buildShareText', () => {
  it('formats a daily result with the puzzle number', () => {
    const text = buildShareText({ puzzleNumber: 122, time: '12:34', score: 45 });
    expect(text).toBe('TrickTiles #122\nTime: 12:34\nScore: 45');
  });

  it('falls back to a practice label with no puzzle number', () => {
    const text = buildShareText({ time: '1:02', score: 10 });
    expect(text).toBe('TrickTiles (Practice)\nTime: 1:02\nScore: 10');
  });
});
