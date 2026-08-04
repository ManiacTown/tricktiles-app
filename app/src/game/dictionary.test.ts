import { describe, expect, it } from 'vitest';
import { isValidWord, WORDS } from './dictionary';

describe('dictionary', () => {
  it('loads a large real word list', () => {
    expect(WORDS.length).toBeGreaterThan(100000);
  });

  it('accepts common real words case-insensitively', () => {
    expect(isValidWord('CAT')).toBe(true);
    expect(isValidWord('cat')).toBe(true);
    expect(isValidWord('QUIZ')).toBe(true);
  });

  it('rejects non-words', () => {
    expect(isValidWord('ZZQX')).toBe(false);
    expect(isValidWord('')).toBe(false);
  });
});
