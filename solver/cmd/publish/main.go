// Command publish generates the daily puzzle for a given date (default:
// today, UTC) and inserts it into Supabase's daily_puzzles table via the
// REST API, using the service_role key — this is the offline/admin
// operation the api.handleGenerateDaily doc comment refers to. Meant to
// run as a once-daily batch job (cron, GitHub Action, etc.), not on any
// user-facing request path — see the performance note in
// solver/generate/generate.go.
package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"tricktiles/solver/dictionary"
	"tricktiles/solver/generate"
)

type roundDTO struct {
	Round    int    `json:"round"`
	Letters  string `json:"letters"`
	Attempts int    `json:"attempts"`
}

type cellDTO struct {
	R      int    `json:"r"`
	C      int    `json:"c"`
	Letter string `json:"letter"`
}

type dailyPuzzleInsert struct {
	Date       string     `json:"date"`
	Seed       int64      `json:"seed"`
	Rounds     []roundDTO `json:"rounds"`
	FinalBoard []cellDTO  `json:"final_board"`
}

func main() {
	loadDotEnv(".env")

	date := os.Getenv("PUBLISH_DATE")
	if date == "" {
		date = time.Now().UTC().Format("2006-01-02")
	}

	supabaseURL := strings.TrimSuffix(os.Getenv("SUPABASE_URL"), "/")
	serviceKey := os.Getenv("SUPABASE_SERVICE_ROLE_KEY")
	if supabaseURL == "" || serviceKey == "" {
		fmt.Fprintln(os.Stderr, "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (env or solver/.env)")
		os.Exit(1)
	}

	fmt.Printf("generating daily puzzle for %s...\n", date)
	_, trie := dictionary.Load()
	puzzle, err := generate.GenerateDaily(trie, date)
	if err != nil {
		fmt.Fprintf(os.Stderr, "generation failed: %v\n", err)
		os.Exit(1)
	}

	body, err := json.Marshal(toInsert(puzzle))
	if err != nil {
		fmt.Fprintf(os.Stderr, "marshal failed: %v\n", err)
		os.Exit(1)
	}

	if err := insert(supabaseURL, serviceKey, body); err != nil {
		fmt.Fprintf(os.Stderr, "publish failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("published daily puzzle for %s (%d rounds, %d tiles)\n",
		puzzle.Date, len(puzzle.Rounds), len(puzzle.FinalBoard))
}

func toInsert(puzzle generate.DailyPuzzle) dailyPuzzleInsert {
	rounds := make([]roundDTO, len(puzzle.Rounds))
	for i, r := range puzzle.Rounds {
		rounds[i] = roundDTO{Round: r.Round, Letters: r.Letters, Attempts: r.Attempts}
	}
	finalBoard := make([]cellDTO, 0, len(puzzle.FinalBoard))
	for p, l := range puzzle.FinalBoard {
		finalBoard = append(finalBoard, cellDTO{R: p.R, C: p.C, Letter: string(l)})
	}
	return dailyPuzzleInsert{
		Date: puzzle.Date,
		// bit-reinterpreted uint64 -> int64 to fit Postgres bigint; only
		// ever stored/retrieved as an opaque seed, never used in
		// arithmetic, so the reinterpretation is harmless and reversible.
		Seed:       int64(puzzle.Seed),
		Rounds:     rounds,
		FinalBoard: finalBoard,
	}
}

func insert(supabaseURL, serviceKey string, body []byte) error {
	req, err := http.NewRequest(http.MethodPost, supabaseURL+"/rest/v1/daily_puzzles", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("apikey", serviceKey)
	req.Header.Set("Authorization", "Bearer "+serviceKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=minimal")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		var respBody bytes.Buffer
		_, _ = respBody.ReadFrom(resp.Body)
		return fmt.Errorf("supabase returned %d: %s", resp.StatusCode, respBody.String())
	}
	return nil
}

// loadDotEnv is a minimal KEY=VALUE .env reader (no external dependency,
// consistent with the rest of this module) — missing file is not an error,
// since env vars may already be set some other way (CI, shell export).
func loadDotEnv(path string) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		if _, alreadySet := os.LookupEnv(key); alreadySet {
			continue
		}
		os.Setenv(key, strings.TrimSpace(value))
	}
}
