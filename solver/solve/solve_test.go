package solve

import (
	"testing"

	"tricktiles/solver/board"
	"tricktiles/solver/dictionary"
)

func TestSolveSimpleWord(t *testing.T) {
	_, trie := dictionary.Load()
	result := Solve(trie, "CAT")

	if !result.Solvable {
		t.Fatal("expected CAT to be solvable")
	}
	if !result.Board.Connected() {
		t.Error("solution should be connected")
	}
	if result.Board.HasIsolatedTile() {
		t.Error("solution should not have isolated tiles")
	}
	for _, run := range result.Board.Runs() {
		if !trie.Has(run.Word) {
			t.Errorf("solution contains invalid word %q", run.Word)
		}
	}
	if len(result.Board) != 3 {
		t.Errorf("expected all 3 letters placed, got %d", len(result.Board))
	}
}

func TestSolveCrossingWords(t *testing.T) {
	// C,A,T,A,R can form CAT (across) and CAR (down) sharing the C.
	_, trie := dictionary.Load()
	result := Solve(trie, "CATAR")

	if !result.Solvable {
		t.Fatal("expected CATAR letters to be solvable via a crossing placement")
	}
	if len(result.Board) != 5 {
		t.Errorf("expected all 5 letters placed, got %d", len(result.Board))
	}
	if !result.Board.Connected() {
		t.Error("solution should be connected")
	}
}

func TestSolveUnsolvableSingleLetter(t *testing.T) {
	_, trie := dictionary.Load()
	result := Solve(trie, "Q")

	if result.Solvable {
		t.Fatal("a single leftover letter can never form a 2+ letter word")
	}
	if result.TimedOut {
		t.Error("this trivial case should be proven unsolvable, not time out")
	}
}

func TestSolveExtendsAWord(t *testing.T) {
	// CAT + S should be solvable by extending to CATS (or some other
	// valid arrangement using all 4 letters).
	_, trie := dictionary.Load()
	result := Solve(trie, "CATS")

	if !result.Solvable {
		t.Fatal("expected CATS letters to be solvable")
	}
	if len(result.Board) != 4 {
		t.Errorf("expected all 4 letters placed, got %d", len(result.Board))
	}
}

func TestAllRunsValidHelper(t *testing.T) {
	_, trie := dictionary.Load()
	b := board.New()
	b[board.Point{R: 0, C: 0}] = 'C'
	b[board.Point{R: 0, C: 1}] = 'A'
	b[board.Point{R: 0, C: 2}] = 'T'
	if !allRunsValid(trie, b) {
		t.Error("CAT should be a valid board")
	}

	b[board.Point{R: 1, C: 0}] = 'Z'
	b[board.Point{R: 2, C: 0}] = 'Z'
	if allRunsValid(trie, b) {
		t.Error("ZZ column should make the board invalid")
	}
}
