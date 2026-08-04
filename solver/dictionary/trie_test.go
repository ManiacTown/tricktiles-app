package dictionary

import "testing"

func TestInsertAndHas(t *testing.T) {
	trie := NewTrie()
	trie.Insert("CAT")
	trie.Insert("CAR")

	if !trie.Has("CAT") {
		t.Error("expected CAT to be present")
	}
	if !trie.Has("CAR") {
		t.Error("expected CAR to be present")
	}
	if trie.Has("CA") {
		t.Error("CA should not be a word")
	}
	if trie.Has("DOG") {
		t.Error("DOG should not be present")
	}
}

func TestHasPrefix(t *testing.T) {
	trie := NewTrie()
	trie.Insert("CAT")

	if !trie.HasPrefix("CA") {
		t.Error("expected CA to be a valid prefix")
	}
	if trie.HasPrefix("DO") {
		t.Error("DO should not be a valid prefix")
	}
}
