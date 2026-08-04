// Package board mirrors the client's board model (app/src/game/board.ts):
// word-run detection and flood-fill connectivity, adapted to an unbounded
// sparse grid since the solver isn't constrained to a fixed 13x13 board.
package board

type Point struct {
	R, C int
}

// Board is a sparse letter grid: absent keys are empty cells.
type Board map[Point]byte

func New() Board {
	return make(Board)
}

func (b Board) Clone() Board {
	out := make(Board, len(b))
	for p, l := range b {
		out[p] = l
	}
	return out
}

// Bounds returns the inclusive bounding box of occupied cells. ok is false
// for an empty board.
func (b Board) Bounds() (minR, minC, maxR, maxC int, ok bool) {
	first := true
	for p := range b {
		if first {
			minR, maxR, minC, maxC = p.R, p.R, p.C, p.C
			first = false
			continue
		}
		if p.R < minR {
			minR = p.R
		}
		if p.R > maxR {
			maxR = p.R
		}
		if p.C < minC {
			minC = p.C
		}
		if p.C > maxC {
			maxC = p.C
		}
	}
	return minR, minC, maxR, maxC, !first
}

type Orientation int

const (
	Across Orientation = iota
	Down
)

type Run struct {
	Word        string
	Cells       []Point
	Orientation Orientation
}

// Runs finds every maximal run of 2+ adjacent letters, horizontally and
// vertically, exactly as app/src/game/board.ts's getRuns does.
func (b Board) Runs() []Run {
	minR, minC, maxR, maxC, ok := b.Bounds()
	if !ok {
		return nil
	}

	var runs []Run

	for r := minR; r <= maxR; r++ {
		var cells []Point
		for c := minC; c <= maxC+1; c++ {
			_, occupied := b[Point{r, c}]
			if occupied {
				cells = append(cells, Point{r, c})
			} else {
				if len(cells) >= 2 {
					runs = append(runs, b.runFromCells(cells, Across))
				}
				cells = nil
			}
		}
	}

	for c := minC; c <= maxC; c++ {
		var cells []Point
		for r := minR; r <= maxR+1; r++ {
			_, occupied := b[Point{r, c}]
			if occupied {
				cells = append(cells, Point{r, c})
			} else {
				if len(cells) >= 2 {
					runs = append(runs, b.runFromCells(cells, Down))
				}
				cells = nil
			}
		}
	}

	return runs
}

func (b Board) runFromCells(cells []Point, orientation Orientation) Run {
	buf := make([]byte, len(cells))
	for i, p := range cells {
		buf[i] = b[p]
	}
	return Run{Word: string(buf), Cells: cells, Orientation: orientation}
}

var deltas = [4]Point{{-1, 0}, {1, 0}, {0, -1}, {0, 1}}

// Connected reports whether every occupied cell is orthogonally reachable
// from every other occupied cell (the strict single-cluster rule).
func (b Board) Connected() bool {
	if len(b) <= 1 {
		return true
	}
	var start Point
	for p := range b {
		start = p
		break
	}
	visited := map[Point]bool{start: true}
	stack := []Point{start}
	for len(stack) > 0 {
		p := stack[len(stack)-1]
		stack = stack[:len(stack)-1]
		for _, d := range deltas {
			np := Point{p.R + d.R, p.C + d.C}
			if _, occupied := b[np]; !occupied || visited[np] {
				continue
			}
			visited[np] = true
			stack = append(stack, np)
		}
	}
	return len(visited) == len(b)
}

// HasIsolatedTile reports whether any occupied cell is not part of any 2+
// letter run in either direction.
func (b Board) HasIsolatedTile() bool {
	inRun := make(map[Point]bool)
	for _, run := range b.Runs() {
		for _, p := range run.Cells {
			inRun[p] = true
		}
	}
	for p := range b {
		if !inRun[p] {
			return true
		}
	}
	return false
}
