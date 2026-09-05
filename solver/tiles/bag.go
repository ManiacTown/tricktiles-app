// Package tiles mirrors the client's letter bag and round pacing
// (app/src/game/letterBag.ts, app/src/game/rounds.ts). Kept as a manual
// port for now, same as the dictionary word list — worth generating both
// from one shared source of truth later rather than hand-syncing.
package tiles

var LetterBag = map[byte]int{
	'A': 9, 'B': 2, 'C': 2, 'D': 4, 'E': 12, 'F': 2, 'G': 3, 'H': 2, 'I': 9, 'J': 1,
	'K': 1, 'L': 4, 'M': 2, 'N': 6, 'O': 8, 'P': 2, 'Q': 1, 'R': 6, 'S': 4, 'T': 6,
	'U': 4, 'V': 2, 'W': 2, 'X': 1, 'Y': 2, 'Z': 1,
}

// Deals is the fixed per-round tile count sequence — section 0 locked fixed
// (not difficulty-scaled) pacing so every player faces the same deals.
var Deals = [4]int{9, 7, 7, 5}

// letterOrder fixes an iteration order over LetterBag (A-Z) so Pool is
// deterministic — ranging over the map directly isn't, since Go
// randomizes map iteration order per process, which would silently break
// the seeded generator's reproducibility despite a fixed RNG seed.
var letterOrder = [26]byte{
	'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
	'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
}

// Pool returns a fresh flat copy of the bag, one entry per available tile,
// in a fixed deterministic order.
func Pool() []byte {
	pool := make([]byte, 0, 100)
	for _, letter := range letterOrder {
		for i := 0; i < LetterBag[letter]; i++ {
			pool = append(pool, letter)
		}
	}
	return pool
}
