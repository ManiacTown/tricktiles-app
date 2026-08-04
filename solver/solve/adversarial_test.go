package solve

import (
	"testing"
	"time"

	"tricktiles/solver/dictionary"
)

func TestSolveAdversarialRareLetters(t *testing.T) {
	_, trie := dictionary.Load()
	cases := []string{"QZXJKV", "QQZZXX", "AEIOU"}
	for _, letters := range cases {
		start := time.Now()
		result := Solve(trie, letters)
		elapsed := time.Since(start)
		t.Logf("letters=%s solvable=%v timedOut=%v elapsed=%s", letters, result.Solvable, result.TimedOut, elapsed)
		if elapsed > 15*time.Second {
			t.Errorf("solve for %q took too long: %s", letters, elapsed)
		}
	}
}
