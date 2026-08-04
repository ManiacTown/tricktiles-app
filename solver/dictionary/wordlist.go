package dictionary

import (
	_ "embed"
	"strings"
)

//go:embed data/enable1.txt
var rawWordList string

// Load parses the embedded ENABLE1 word list and returns both the flat
// word slice and a trie built from it.
func Load() ([]string, *Trie) {
	lines := strings.Split(rawWordList, "\n")
	words := make([]string, 0, len(lines))
	trie := NewTrie()
	for _, line := range lines {
		w := strings.ToUpper(strings.TrimSpace(line))
		if len(w) < minWordLength {
			continue
		}
		ok := true
		for i := 0; i < len(w); i++ {
			if !valid(w[i]) {
				ok = false
				break
			}
		}
		if !ok {
			continue
		}
		words = append(words, w)
		trie.Insert(w)
	}
	return words, trie
}
