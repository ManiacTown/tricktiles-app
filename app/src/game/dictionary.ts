import wordListRaw from '../data/enable1.txt?raw';
import { Trie } from './trie';

const MIN_WORD_LENGTH = 2;

function loadWords(): string[] {
  return wordListRaw
    .split('\n')
    .map((w) => w.trim().toUpperCase())
    .filter((w) => w.length >= MIN_WORD_LENGTH && /^[A-Z]+$/.test(w));
}

export const WORDS = loadWords();
export const dictionary = Trie.fromWordList(WORDS);

export function isValidWord(word: string): boolean {
  return dictionary.has(word.toUpperCase());
}
