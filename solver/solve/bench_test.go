package solve

import (
	"testing"
	"time"

	"tricktiles/solver/dictionary"
)

// A sanity check against realistic per-round deal sizes (see
// app/src/game/rounds.ts DEALS: 10, 7, 7, 8, 8) rather than a Go benchmark,
// so it runs as part of the normal test suite and reports wall-clock time.
func TestSolveRealisticDealSizes(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping realistic-size solve in short mode")
	}
	_, trie := dictionary.Load()

	deals := []string{"CATSDOGRUN", "PLANETSY", "GARDENFL"}
	for _, letters := range deals {
		start := time.Now()
		result := Solve(trie, letters)
		elapsed := time.Since(start)
		t.Logf("letters=%s solvable=%v timedOut=%v elapsed=%s", letters, result.Solvable, result.TimedOut, elapsed)
		if elapsed > 10*time.Second {
			t.Errorf("solve for %q took too long: %s", letters, elapsed)
		}
	}
}
