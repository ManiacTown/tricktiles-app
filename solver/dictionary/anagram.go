package dictionary

const minWordLength = 2

// LetterCounts builds a 26-slot letter-frequency count from an uppercase
// A-Z string, as used throughout the solver to represent a rack/pool.
func LetterCounts(letters string) [26]int {
	var counts [26]int
	for i := 0; i < len(letters); i++ {
		b := letters[i]
		if valid(b) {
			counts[idx(b)]++
		}
	}
	return counts
}

// WordsFromCounts returns every dictionary word (length >= 2) that can be
// spelled using no more of each letter than is available in counts.
func (t *Trie) WordsFromCounts(counts [26]int) []string {
	var out []string
	var buf [64]byte
	var walk func(n *Node, depth int, remaining [26]int)
	walk = func(n *Node, depth int, remaining [26]int) {
		if n.IsWord && depth >= minWordLength {
			out = append(out, string(buf[:depth]))
		}
		if depth == len(buf) {
			return
		}
		for i := 0; i < 26; i++ {
			if remaining[i] == 0 || n.Children[i] == nil {
				continue
			}
			buf[depth] = byte('A' + i)
			remaining[i]--
			walk(n.Children[i], depth+1, remaining)
			remaining[i]++
		}
	}
	walk(t.Root, 0, counts)
	return out
}
