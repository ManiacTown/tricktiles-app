# Tricktiles — Build Plan & Backlog

Name is locked in: **Tricktiles** (domain, App Store/Play/GitHub/itch.io, and a basic trademark check all came back clean as of this writing — worth a final USPTO TESS confirmation and social handle grab before public launch). This doc is meant to be handed to Claude Code as a starting punch list, organized so you can tackle it in dependency order rather than randomly.

---

## 0. Decisions to lock in before coding starts — LOCKED 2026-08-04

These aren't bugs, they're design calls the prototype dodged. Pinned down before coding starts:

- **Board connectivity rule**: ✅ **Strict single cluster** (real Bananagrams rules) — every tile must connect to the rest via shared letters. Validator must do a flood-fill/graph connectivity check, not just per-run word checks.
- **Round pacing**: ✅ **Fixed tile counts per round**, same sequence for every player every day — required for a fair daily leaderboard.
- **Daily puzzle identity**: ✅ **Seeded random deal** (date string → hash → seeded PRNG), not pre-authored/curated content.
- **Losing/stuck states**: ✅ **Always solvable** — generator must run every candidate puzzle through the solver before serving it, regenerate on failure. No bad-luck unsolvable deals.
- **Scoring philosophy**: ✅ **Speed-first**, score as secondary flex — matches Pushdle's identity, completion time is the headline end-screen stat.

---

## 1. Core mechanic fixes (from the prototype)

- [x] **Connectivity validation** — done in `app/src/game/board.ts` (`isBoardConnected`, flood-fill) + `validator.ts`. Enforces the strict single-cluster rule locked in section 0.
- [x] **Real dictionary** — done. Swapped in ENABLE1 (public domain, 172k words, the standard free stand-in for TWL06/SOWPODS) in `app/src/data/enable1.txt`.
- [x] **Word list needs a trie/DAWG structure** — done, `app/src/game/trie.ts`. Client validator uses it now; solver service (section 4) should reuse the same structure.
- [x] **Touch/mobile drag-and-drop** — done, rebuilt on `dnd-kit` (Pointer Events under the hood) in `app/src/components/`. Verified working via headless-browser drag simulation.
- [x] **Tile swap on occupied cell** — done in `gameState.ts`'s `MOVE_TILE` reducer action, verified in-browser.
- [x] **Undo/redo** — done, history/future snapshot stacks in `gameState.ts`, wired to Undo/Redo buttons.
- [ ] **Board bounds** — still open. Kept 13x13 as a placeholder (matches prototype) since this wasn't one of the section 0 decisions locked in; revisit once real max tile count across rounds is decided.

---

## 2. Daily puzzle generation

This is the piece that needs the most design thought, not just code.

- [x] Decided (implicitly, by building it): **algorithmic**, not AI-assisted — `solver/generate/` deals from the real letter bag and proves solvability via the backtracking solver, no LLM step. Revisit if theming/variety ever becomes a goal worth an AI-assisted layer.
- [x] **Seeded RNG** — `solver/generate/generate.go`'s `seedFromDate`: SHA-256("tricktiles-daily:"+date) feeds a `math/rand/v2` PCG source. Verified deterministic (same date → byte-identical tile sequence *and* board layout across separate process runs) and distinct across different dates.
- [x] **Solvability guarantee** — implemented exactly as specified: draw a round's tiles, call the solver (extending from the previous rounds' board via `solve.SolveFrom`), accept if solvable, else redraw (up to 25 attempts/round) and retry. Verified: every generated puzzle's final board is connected, has no isolated tiles, and every run is a real dictionary word.
- [x] **Difficulty calibration groundwork** — `RoundResult` captures attempts-needed and elapsed time per round (the "solver stats" the plan asks for), though nothing persists or aggregates them into a difficulty curve yet — no storage layer exists until section 3.
- [x] **Timezone handling** — decided UTC: the date string fed into the seed is a UTC calendar date (`"2006-01-02"`). Pragmatic default, not a section 0 locked decision — revisit if player complaints about drop-time make it worth per-region handling.

**Known limitation:** generation is correct but not fast for later rounds — candidate-generation cost in the solver grows with existing board size, so round 4-5 (extending a 30+ tile board) can take seconds to tens of seconds per attempt (observed up to ~22s for one round-5 attempt; a full 5-round daily generation took ~19s end-to-end via the `/daily` endpoint). This is fine for an offline once-per-day batch job (the intended use — see `handleGenerateDaily`'s doc comment) but would not be acceptable on a live request path. Optimization (cross-check-set pruning, tighter per-attempt budgets, memoization) is a real follow-up, not yet done.

---

## 3. Backend & data (Supabase)

- [ ] **Schema**: users/profiles, daily_puzzles (date, seed, tile sequence, solution reference), game_sessions (user, puzzle, completion time, score, round-by-round timing), leaderboard views, badges/achievements table, badge_unlocks (user × badge).
- [ ] **Anti-cheat basics** — client-reported completion time is trivially fakeable. At minimum, validate round transitions server-side (don't trust "I finished in 4 seconds" without server-side timestamps on each round completion event).
- [ ] **Leaderboard scoping** — daily leaderboard, all-time leaderboard, and maybe friends-only if you want a social loop like Pushdle's Discord community.
- [ ] **Badge logic** — define trigger conditions (speed thresholds, word-length streaks, perfect rounds, etc.) as a first pass; this can start simple and grow.
- [ ] **Replay/history** — do players get to see their past boards? Worth deciding early since it affects what you store (just the final board, or every intermediate state).

---

## 4. Solver service (Go)

- [x] Stood up as a **standalone microservice** in `solver/` (net/http, no framework). `POST /solvability {letters}` -> `{solvable, timedOut, solution}`, `GET /health`.
- [x] Core data structure: **trie**, built from the same ENABLE1 word list as the client (`solver/dictionary/`, mirrors `app/src/game/trie.ts`). Copied file for now — worth a follow-up to generate both from one source of truth instead of hand-keeping two copies in sync.
- [x] **Solvability check** implemented — backtracking search (`solver/solve/`) that places all given letters into one connected, all-valid-words grid, or proves it can't. Move generation anchors on existing tiles (crossing/extension); every candidate is verified by recomputing runs against the dictionary. A budget cap distinguishes proven-unsolvable from an inconclusive timeout. Verified fast on realistic 8-10 letter round sizes (2-5ms) and on adversarial rare-letter/vowel-only inputs (no timeouts).
  - Known scope gap: doesn't search placements where two words are only edge-adjacent without sharing a letter — acceptable since the generator already regenerates on a failed check.
- [ ] **Best-move / hint generator** — not built yet. Deferred; not needed until the in-game hint system / post-game "how a top player solved it" feature is prioritized.
- [x] Decided implicitly by the solvability-check implementation: it reasons about the whole board (full backtracking solve), since "does at least one solution exist" requires that. A cheaper incremental validate/extend mode is still open for the eventual hint generator.

---

## 5. Scoring & feedback polish

- [ ] Cumulative vs per-round scoring — prototype recomputes live score from everything currently valid on the board. Decide if points should "lock in" per round (so rearranging later rounds doesn't retroactively change earlier round's score).
- [ ] Combo/bonus system — reward for longer words, using rare letters (Q/Z/X/J), or fast round completion, similar to how Pushdle rewards risk.
- [ ] End screen needs the actual final design pass — prototype's is a placeholder. Worth matching whatever visual identity you land on for the rest of the game.

---

## 6. Profile & social layer

- [ ] Profile page: stats (games played, average time, best time, badge case).
- [ ] Badge display/unlock animation.
- [ ] Share card for socials (similar function to Pushdle's shareable result — "here's my time/score" image or text block).
- [ ] Discord integration if you want the same community loop you built for Pushdle.

---

## 7. Branding notes

- [ ] Domain (tricktiles.com) and matching social handles (Instagram, X, TikTok) should be secured before any public-facing launch or marketing push — the name checked out clean during naming research, but that's a point-in-time result, not a permanent guarantee.
- [ ] "Trick" in the name doesn't map to a literal mechanic (no bluffing/deception system), so it's worth deciding early whether that's purely a brand-voice choice (clever tile placements = "tricks") or whether it's worth surfacing a literal "trick" moment in gameplay/copy so the name pays off for new players instead of just sounding cool.
- [ ] Visual identity hasn't been explored yet — the felt-green/wood-tile direction from the early prototype was a placeholder aesthetic, not a considered brand pass. Worth a proper design pass once core mechanics are locked, using the finalized name as the actual creative brief rather than "generic word game."

## Suggested build order

1. Lock in the section 0 decisions.
2. Fix connectivity validation + swap in real dictionary + rebuild drag/drop for touch (section 1) — this is the "make the core loop actually solid" pass.
3. Build the trie/word-lookup structure once, shared by client + solver.
4. Stand up the Go solver service with solvability-check mode.
5. Build the puzzle generator against the solver (generate → solve-check → serve).
6. Supabase schema + auth + basic leaderboard.
7. Badges, profile, social/share layer last — highest polish, lowest risk to defer.

This mirrors how Pushdle came together: core loop first, generation/fairness logic second, social layer last.
