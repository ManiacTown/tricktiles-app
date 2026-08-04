package generate

import (
	"testing"
	"time"

	"tricktiles/solver/dictionary"
	"tricktiles/solver/tiles"
)

func TestGenerateDailyIsDeterministic(t *testing.T) {
	_, trie := dictionary.Load()

	a, err := GenerateDaily(trie, "2026-08-04")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	b, err := GenerateDaily(trie, "2026-08-04")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if a.Seed != b.Seed {
		t.Error("expected the same date to produce the same seed")
	}
	if len(a.Rounds) != len(b.Rounds) {
		t.Fatalf("expected same round count, got %d vs %d", len(a.Rounds), len(b.Rounds))
	}
	for i := range a.Rounds {
		if a.Rounds[i].Letters != b.Rounds[i].Letters {
			t.Errorf("round %d: expected identical letters for the same date, got %q vs %q",
				i+1, a.Rounds[i].Letters, b.Rounds[i].Letters)
		}
	}
}

func TestGenerateDailyDiffersByDate(t *testing.T) {
	_, trie := dictionary.Load()

	a, err := GenerateDaily(trie, "2026-08-04")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	b, err := GenerateDaily(trie, "2026-08-05")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if a.Seed == b.Seed {
		t.Error("expected different dates to produce different seeds")
	}
	same := true
	for i := range a.Rounds {
		if a.Rounds[i].Letters != b.Rounds[i].Letters {
			same = false
		}
	}
	if same {
		t.Error("expected different dates to (almost certainly) produce different tile sequences")
	}
}

func TestGenerateDailyMatchesDealSizesAndIsSolvable(t *testing.T) {
	_, trie := dictionary.Load()

	puzzle, err := GenerateDaily(trie, "2026-01-01")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(puzzle.Rounds) != len(tiles.Deals) {
		t.Fatalf("expected %d rounds, got %d", len(tiles.Deals), len(puzzle.Rounds))
	}

	totalLetters := 0
	for i, round := range puzzle.Rounds {
		if len(round.Letters) != tiles.Deals[i] {
			t.Errorf("round %d: expected %d letters, got %d", i+1, tiles.Deals[i], len(round.Letters))
		}
		totalLetters += len(round.Letters)
	}

	if len(puzzle.FinalBoard) != totalLetters {
		t.Errorf("expected final board to contain all %d dealt letters, got %d", totalLetters, len(puzzle.FinalBoard))
	}
	if !puzzle.FinalBoard.Connected() {
		t.Error("final board should be one connected cluster")
	}
	if puzzle.FinalBoard.HasIsolatedTile() {
		t.Error("final board should have no isolated tiles")
	}
	for _, run := range puzzle.FinalBoard.Runs() {
		if !trie.Has(run.Word) {
			t.Errorf("final board contains invalid word %q", run.Word)
		}
	}
}

func TestGenerateDailyAcrossManyDatesIsFast(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping multi-date generation sweep in short mode")
	}
	_, trie := dictionary.Load()

	base := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	for i := 0; i < 30; i++ {
		date := base.AddDate(0, 0, i).Format("2006-01-02")
		start := time.Now()
		puzzle, err := GenerateDaily(trie, date)
		elapsed := time.Since(start)
		if err != nil {
			t.Errorf("date %s: generation failed: %v", date, err)
			continue
		}
		if elapsed > 5*time.Second {
			t.Errorf("date %s: generation took too long: %s", date, elapsed)
		}
		t.Logf("date=%s elapsed=%s rounds=%d", date, elapsed, len(puzzle.Rounds))
	}
}
