// Package api exposes the solver over a small stateless JSON HTTP API, as
// called for in the build plan: input is a board state / tile set, output
// is a solvability result. Kept dependency-free (net/http only) since this
// is a standalone microservice with a narrow, stable contract.
package api

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strings"

	"tricktiles/solver/board"
	"tricktiles/solver/dictionary"
	"tricktiles/solver/generate"
	"tricktiles/solver/solve"
)

type Server struct {
	trie *dictionary.Trie
}

func NewServer(trie *dictionary.Trie) *Server {
	return &Server{trie: trie}
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", s.handleHealth)
	mux.HandleFunc("POST /solvability", s.handleSolvability)
	mux.HandleFunc("POST /daily", s.handleGenerateDaily)
	return mux
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

type solvabilityRequest struct {
	Letters string `json:"letters"`
}

type cellDTO struct {
	R      int    `json:"r"`
	C      int    `json:"c"`
	Letter string `json:"letter"`
}

type solvabilityResponse struct {
	Solvable bool      `json:"solvable"`
	TimedOut bool      `json:"timedOut"`
	Solution []cellDTO `json:"solution,omitempty"`
}

func (s *Server) handleSolvability(w http.ResponseWriter, r *http.Request) {
	var req solvabilityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}

	letters := strings.ToUpper(strings.TrimSpace(req.Letters))
	if letters == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "letters must not be empty"})
		return
	}
	for i := 0; i < len(letters); i++ {
		if letters[i] < 'A' || letters[i] > 'Z' {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "letters must be A-Z only"})
			return
		}
	}

	result := solve.Solve(s.trie, letters)
	resp := solvabilityResponse{Solvable: result.Solvable, TimedOut: result.TimedOut}
	if result.Solvable {
		resp.Solution = toCells(result.Board)
	}
	writeJSON(w, http.StatusOK, resp)
}

var dateRE = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

type dailyRequest struct {
	Date string `json:"date"`
}

type roundDTO struct {
	Round    int    `json:"round"`
	Letters  string `json:"letters"`
	Attempts int    `json:"attempts"`
}

type dailyResponse struct {
	Date       string     `json:"date"`
	Seed       uint64     `json:"seed"`
	Rounds     []roundDTO `json:"rounds"`
	FinalBoard []cellDTO  `json:"finalBoard"`
}

// handleGenerateDaily is an internal/admin operation, not something a
// player's client calls directly — see the performance note on
// generate.GenerateDaily. It's meant to be triggered by an offline job
// (once per calendar date) whose result then gets persisted (Supabase
// daily_puzzles, section 3) for clients to read from.
func (s *Server) handleGenerateDaily(w http.ResponseWriter, r *http.Request) {
	var req dailyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	if !dateRE.MatchString(req.Date) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "date must be in YYYY-MM-DD format"})
		return
	}

	puzzle, err := generate.GenerateDaily(s.trie, req.Date)
	if err != nil {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
		return
	}

	rounds := make([]roundDTO, len(puzzle.Rounds))
	for i, rnd := range puzzle.Rounds {
		rounds[i] = roundDTO{Round: rnd.Round, Letters: rnd.Letters, Attempts: rnd.Attempts}
	}
	writeJSON(w, http.StatusOK, dailyResponse{
		Date:       puzzle.Date,
		Seed:       puzzle.Seed,
		Rounds:     rounds,
		FinalBoard: toCells(puzzle.FinalBoard),
	})
}

func toCells(b board.Board) []cellDTO {
	out := make([]cellDTO, 0, len(b))
	for p, l := range b {
		out = append(out, cellDTO{R: p.R, C: p.C, Letter: string(l)})
	}
	return out
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
