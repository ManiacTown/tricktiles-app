// Package dictionary provides a trie-backed word list shared in spirit with
// the client's TypeScript trie (app/src/game/trie.ts) — same ENABLE1 source
// data, same prefix/lookup shape, so the two validators can't drift.
package dictionary

// Node is exported so the solver package can walk the trie incrementally
// while it searches along a line of board cells.
type Node struct {
	Children [26]*Node
	IsWord   bool
}

type Trie struct {
	Root *Node
}

func NewTrie() *Trie {
	return &Trie{Root: &Node{}}
}

func idx(b byte) int {
	return int(b - 'A')
}

func valid(b byte) bool {
	return b >= 'A' && b <= 'Z'
}

// Child returns the child node for letter b, or nil if there is none.
func (n *Node) Child(b byte) *Node {
	if !valid(b) {
		return nil
	}
	return n.Children[idx(b)]
}

func (t *Trie) Insert(word string) {
	n := t.Root
	for i := 0; i < len(word); i++ {
		b := word[i]
		if !valid(b) {
			return
		}
		c := n.Children[idx(b)]
		if c == nil {
			c = &Node{}
			n.Children[idx(b)] = c
		}
		n = c
	}
	n.IsWord = true
}

func (t *Trie) Has(word string) bool {
	n := t.walk(word)
	return n != nil && n.IsWord
}

func (t *Trie) HasPrefix(prefix string) bool {
	return t.walk(prefix) != nil
}

func (t *Trie) walk(s string) *Node {
	n := t.Root
	for i := 0; i < len(s); i++ {
		b := s[i]
		if !valid(b) {
			return nil
		}
		n = n.Children[idx(b)]
		if n == nil {
			return nil
		}
	}
	return n
}
