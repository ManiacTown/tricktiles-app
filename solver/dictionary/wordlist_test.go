package dictionary

import "testing"

func TestLoad(t *testing.T) {
	words, trie := Load()

	if len(words) < 100000 {
		t.Errorf("expected a large word list, got %d words", len(words))
	}
	if !trie.Has("CAT") {
		t.Error("expected CAT to be loaded")
	}
	if !trie.Has("QUIZ") {
		t.Error("expected QUIZ to be loaded")
	}
	if trie.Has("ZZQX") {
		t.Error("ZZQX should not be a word")
	}
}

func TestWordsFromCounts(t *testing.T) {
	_, trie := Load()
	counts := LetterCounts("CTA")

	words := trie.WordsFromCounts(counts)

	found := map[string]bool{}
	for _, w := range words {
		found[w] = true
	}
	if !found["CAT"] {
		t.Error("expected CAT to be formable from C,T,A")
	}
	for _, w := range words {
		if len(w) < 2 {
			t.Errorf("word %q shorter than minimum length", w)
		}
	}
}

func TestWordsFromCountsRespectsLetterMultiplicity(t *testing.T) {
	_, trie := Load()
	// Only a single 'Z' available; no valid word needs exactly one Z with
	// no vowels, so this should never crash and should return no words
	// requiring two Zs.
	counts := LetterCounts("Z")
	words := trie.WordsFromCounts(counts)
	if len(words) != 0 {
		t.Errorf("expected no words from a single Z, got %v", words)
	}
}
