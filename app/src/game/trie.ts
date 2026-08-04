export class TrieNode {
  children: Map<string, TrieNode> = new Map();
  isWord = false;
}

export class Trie {
  private root = new TrieNode();

  insert(word: string): void {
    let node = this.root;
    for (const letter of word) {
      let next = node.children.get(letter);
      if (!next) {
        next = new TrieNode();
        node.children.set(letter, next);
      }
      node = next;
    }
    node.isWord = true;
  }

  has(word: string): boolean {
    const node = this.walk(word);
    return node !== null && node.isWord;
  }

  hasPrefix(prefix: string): boolean {
    return this.walk(prefix) !== null;
  }

  private walk(str: string): TrieNode | null {
    let node = this.root;
    for (const letter of str) {
      const next = node.children.get(letter);
      if (!next) return null;
      node = next;
    }
    return node;
  }

  static fromWordList(words: Iterable<string>): Trie {
    const trie = new Trie();
    for (const word of words) trie.insert(word);
    return trie;
  }
}
