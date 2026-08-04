package board

import "testing"

func TestRunsAcrossAndDown(t *testing.T) {
	b := New()
	// CAT across at row 0, CAR down through the C
	b[Point{0, 0}] = 'C'
	b[Point{0, 1}] = 'A'
	b[Point{0, 2}] = 'T'
	b[Point{1, 0}] = 'A'
	b[Point{2, 0}] = 'R'

	runs := b.Runs()
	words := map[string]bool{}
	for _, r := range runs {
		words[r.Word] = true
	}
	if !words["CAT"] || !words["CAR"] {
		t.Errorf("expected CAT and CAR, got %v", words)
	}
	if len(runs) != 2 {
		t.Errorf("expected exactly 2 runs, got %d", len(runs))
	}
}

func TestLoneTileIsNotARun(t *testing.T) {
	b := New()
	b[Point{2, 2}] = 'A'
	if runs := b.Runs(); len(runs) != 0 {
		t.Errorf("expected no runs, got %v", runs)
	}
	if !b.HasIsolatedTile() {
		t.Error("expected the lone tile to be isolated")
	}
}

func TestConnected(t *testing.T) {
	b := New()
	if !b.Connected() {
		t.Error("empty board should be trivially connected")
	}
	b[Point{0, 0}] = 'A'
	if !b.Connected() {
		t.Error("single tile should be trivially connected")
	}
	b[Point{0, 1}] = 'B'
	if !b.Connected() {
		t.Error("adjacent tiles should be connected")
	}
	b[Point{5, 5}] = 'C'
	if b.Connected() {
		t.Error("a disconnected tile should break connectivity")
	}
}

func TestDiagonalAdjacencyDoesNotConnect(t *testing.T) {
	b := New()
	b[Point{0, 0}] = 'A'
	b[Point{1, 1}] = 'B'
	if b.Connected() {
		t.Error("diagonal-only adjacency should not count as connected")
	}
}
