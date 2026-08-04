// Package solve implements a backtracking search for whether a given set of
// letters can be fully arranged into a single connected, all-valid-words
// Bananagrams grid (the "solvability check" the daily-puzzle generator
// needs before it will ever serve a puzzle to a player).
//
// Scope (deliberate v1 limitation): every new word placed during the search
// must share at least one cell with the existing structure (it either
// crosses an existing letter, or extends an existing run in place). This
// covers the large majority of real Bananagrams boards — including the
// classic "branch a new word off an existing letter" and "extend CAT into
// CATS" moves — but does not search placements where two words are only
// edge-adjacent without sharing a letter (e.g. CAT directly above DOG with
// no overlap). A "not solvable" result under this scope is therefore not an
// absolute proof; treat it the way the build plan already intends
// (generate → solve-check → regenerate on failure), where an occasional
// false negative just costs one extra regeneration attempt, not correctness.
package solve

import (
	"sort"
	"strconv"
	"strings"

	"tricktiles/solver/board"
	"tricktiles/solver/dictionary"
)

const (
	maxWordLen    = 12
	defaultBudget = 300_000
)

type Result struct {
	Board    board.Board
	Solvable bool
	// TimedOut is true when the search budget ran out before either a
	// solution was found or the space was fully explored — an
	// inconclusive result, distinct from a proven "no solution exists".
	TimedOut bool
}

type solver struct {
	trie   *dictionary.Trie
	budget int
}

// Solve searches for a full arrangement of letters into one connected,
// valid Bananagrams grid, starting from an empty board.
func Solve(trie *dictionary.Trie, letters string) Result {
	return SolveFrom(trie, board.New(), letters)
}

// SolveFrom searches for a way to place `letters` onto an existing,
// already-valid board such that the result is still one connected,
// all-valid-words grid. This is what the daily-puzzle generator uses to
// prove each round's deal can extend the previous rounds' board, rather
// than just being solvable in isolation.
func SolveFrom(trie *dictionary.Trie, start board.Board, letters string) Result {
	remaining := dictionary.LetterCounts(letters)
	s := &solver{trie: trie, budget: defaultBudget}
	brd, ok := s.search(start.Clone(), remaining)
	return Result{Board: brd, Solvable: ok, TimedOut: !ok && s.budget <= 0}
}

func (s *solver) search(brd board.Board, remaining [26]int) (board.Board, bool) {
	if s.budget <= 0 {
		return nil, false
	}
	s.budget--

	if isZero(remaining) {
		if len(brd) > 0 {
			return brd, true
		}
		return nil, false
	}

	for _, cand := range s.candidates(brd, remaining) {
		next := brd.Clone()
		var used [26]int
		for p, l := range cand {
			next[p] = l
			used[idx(l)]++
		}
		if !allRunsValid(s.trie, next) {
			continue
		}
		nextRemaining := remaining
		for i := 0; i < 26; i++ {
			nextRemaining[i] -= used[i]
		}
		if result, ok := s.search(next, nextRemaining); ok {
			return result, true
		}
		if s.budget <= 0 {
			return nil, false
		}
	}
	return nil, false
}

// candidates returns candidate moves: each is the set of newly-filled cells
// (letters) for one word placement. On an empty board, every dictionary
// word formable from the available letters is a candidate, placed at the
// origin. Otherwise, every occupied cell is tried as an anchor that a new
// (or extended) word must touch.
func (s *solver) candidates(brd board.Board, remaining [26]int) []map[board.Point]byte {
	if len(brd) == 0 {
		words := s.trie.WordsFromCounts(remaining)
		out := make([]map[board.Point]byte, 0, len(words))
		for _, w := range words {
			cand := make(map[board.Point]byte, len(w))
			for i := 0; i < len(w); i++ {
				cand[board.Point{R: 0, C: i}] = w[i]
			}
			out = append(out, cand)
		}
		return out
	}

	var out []map[board.Point]byte
	seen := map[string]bool{}
	dirs := [2]board.Point{{R: 0, C: 1}, {R: 1, C: 0}}
	// Sorted rather than ranged directly: map iteration order is randomized
	// per process, which would make the specific solution layout chosen
	// (though always valid) non-reproducible across runs of the same input.
	for _, anchor := range sortedPoints(brd) {
		for _, dir := range dirs {
			for k := 0; k < maxWordLen; k++ {
				start := board.Point{R: anchor.R - dir.R*k, C: anchor.C - dir.C*k}
				s.collectLine(brd, remaining, start, dir, anchor, &out, seen)
			}
		}
	}
	return out
}

// collectLine walks the trie alongside the board cells on the line starting
// at `start` heading in direction `dir`, matching pre-existing letters
// exactly and choosing freely among the remaining pool for empty cells.
// Every point where the trie says "this is a word" and the path has covered
// `anchor` is emitted as a candidate (deduped by its exact new-cell set).
func (s *solver) collectLine(
	brd board.Board,
	remaining [26]int,
	start, dir, anchor board.Point,
	out *[]map[board.Point]byte,
	seen map[string]bool,
) {
	path := make(map[board.Point]byte)

	var rec func(node *dictionary.Node, pos board.Point, depth int, rem [26]int, anchorSeen bool)
	rec = func(node *dictionary.Node, pos board.Point, depth int, rem [26]int, anchorSeen bool) {
		if node == nil || depth >= maxWordLen {
			return
		}
		anchorSeen = anchorSeen || pos == anchor
		next := board.Point{R: pos.R + dir.R, C: pos.C + dir.C}

		if existing, occupied := brd[pos]; occupied {
			child := node.Child(existing)
			if child == nil {
				return
			}
			if child.IsWord && depth >= 1 && anchorSeen {
				emit(path, out, seen)
			}
			rec(child, next, depth+1, rem, anchorSeen)
			return
		}

		for i := 0; i < 26; i++ {
			if rem[i] == 0 {
				continue
			}
			letter := byte('A' + i)
			child := node.Child(letter)
			if child == nil {
				continue
			}
			path[pos] = letter
			rem[i]--
			if child.IsWord && depth >= 1 && anchorSeen {
				emit(path, out, seen)
			}
			rec(child, next, depth+1, rem, anchorSeen)
			rem[i]++
			delete(path, pos)
		}
	}

	rec(s.trie.Root, start, 0, remaining, false)
}

func emit(path map[board.Point]byte, out *[]map[board.Point]byte, seen map[string]bool) {
	if len(path) == 0 {
		return
	}
	key := canonicalKey(path)
	if seen[key] {
		return
	}
	seen[key] = true
	cp := make(map[board.Point]byte, len(path))
	for p, l := range path {
		cp[p] = l
	}
	*out = append(*out, cp)
}

func sortedPoints(brd board.Board) []board.Point {
	pts := make([]board.Point, 0, len(brd))
	for p := range brd {
		pts = append(pts, p)
	}
	sort.Slice(pts, func(i, j int) bool {
		if pts[i].R != pts[j].R {
			return pts[i].R < pts[j].R
		}
		return pts[i].C < pts[j].C
	})
	return pts
}

func canonicalKey(path map[board.Point]byte) string {
	pts := sortedPoints(path)
	var sb strings.Builder
	for _, p := range pts {
		sb.WriteString(strconv.Itoa(p.R))
		sb.WriteByte(',')
		sb.WriteString(strconv.Itoa(p.C))
		sb.WriteByte('=')
		sb.WriteByte(path[p])
		sb.WriteByte(';')
	}
	return sb.String()
}

func allRunsValid(trie *dictionary.Trie, brd board.Board) bool {
	for _, run := range brd.Runs() {
		if !trie.Has(run.Word) {
			return false
		}
	}
	return true
}

func isZero(counts [26]int) bool {
	for _, c := range counts {
		if c != 0 {
			return false
		}
	}
	return true
}

func idx(b byte) int {
	return int(b - 'A')
}
