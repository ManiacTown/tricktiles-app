// Package generate builds the daily puzzle: a seeded-random, fixed-pacing
// tile sequence (per the section 0 decisions — seeded deal, not
// pre-authored; fixed round sizes, not difficulty-scaled) that the solver
// has proven is fully completable before it's ever handed to a player.
//
// Performance note: this is designed to run offline, once per calendar
// date (e.g. a nightly batch/cron job), not per HTTP request. solve's
// candidate-generation cost grows with the number of tiles already on the
// board, so later rounds (extending a 30+ tile board) can take tens of
// seconds per attempt — observed up to ~22s for a single round-5 attempt
// against realistic deal sizes. That's a non-issue for a once-a-day batch
// job; it would not be acceptable on a live request path. Worth revisiting
// (cross-check-set pruning, tighter per-attempt budgets, memoization) if
// this ever needs to run synchronously.
package generate

import (
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"math/rand/v2"
	"time"

	"tricktiles/solver/board"
	"tricktiles/solver/dictionary"
	"tricktiles/solver/solve"
	"tricktiles/solver/tiles"
)

const maxAttemptsPerRound = 25

type RoundResult struct {
	Round    int
	Letters  string
	Attempts int
	Elapsed  time.Duration
}

type DailyPuzzle struct {
	Date       string
	Seed       uint64
	Rounds     []RoundResult
	FinalBoard board.Board
}

// seedFromDate derives a deterministic seed pair from a UTC calendar date
// string (format "2006-01-02"), so "midnight" for the daily puzzle means
// UTC midnight — a pragmatic default (not one of the section 0 locked
// decisions) rather than per-player local time, worth revisiting.
func seedFromDate(date string) (uint64, uint64) {
	h := sha256.Sum256([]byte("tricktiles-daily:" + date))
	return binary.BigEndian.Uint64(h[0:8]), binary.BigEndian.Uint64(h[8:16])
}

// GenerateDaily deterministically builds a full daily puzzle: the same
// date always produces the same tile sequence. Every round is verified
// solvable — continuing from the board the previous rounds left — via the
// solver before being accepted; a round whose random draw doesn't work is
// redrawn, per the build plan's "generate, solve-check, regenerate on
// failure" rule.
func GenerateDaily(trie *dictionary.Trie, date string) (DailyPuzzle, error) {
	seed1, seed2 := seedFromDate(date)
	rng := rand.New(rand.NewPCG(seed1, seed2))

	pool := tiles.Pool()
	brd := board.New()
	rounds := make([]RoundResult, 0, len(tiles.Deals))

	for i, n := range tiles.Deals {
		start := time.Now()
		accepted := false

		for attempt := 1; attempt <= maxAttemptsPerRound; attempt++ {
			drawn := drawWithoutReplacement(rng, &pool, n)
			result := solve.SolveFrom(trie, brd, string(drawn))
			if result.Solvable {
				brd = result.Board
				rounds = append(rounds, RoundResult{
					Round:    i + 1,
					Letters:  string(drawn),
					Attempts: attempt,
					Elapsed:  time.Since(start),
				})
				accepted = true
				break
			}
			pool = append(pool, drawn...)
		}

		if !accepted {
			return DailyPuzzle{}, fmt.Errorf(
				"round %d: no solvable %d-letter deal found after %d attempts",
				i+1, n, maxAttemptsPerRound,
			)
		}
	}

	return DailyPuzzle{Date: date, Seed: seed1, Rounds: rounds, FinalBoard: brd}, nil
}

func drawWithoutReplacement(rng *rand.Rand, pool *[]byte, n int) []byte {
	p := *pool
	out := make([]byte, 0, n)
	for i := 0; i < n && len(p) > 0; i++ {
		idx := rng.IntN(len(p))
		out = append(out, p[idx])
		p = append(p[:idx], p[idx+1:]...)
	}
	*pool = p
	return out
}
