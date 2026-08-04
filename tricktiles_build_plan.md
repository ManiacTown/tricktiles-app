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

- [ ] Decide generation approach: **algorithmic** (build backward from a target word set, guarantee solvability) vs **AI-assisted** (LLM proposes tile sets/word themes, algorithmic layer validates/repairs). A hybrid is realistic: AI for variety/theming, algorithm for the solvability guarantee.
- [ ] **Seeded RNG** so the same calendar date produces the same puzzle for everyone — needs a deterministic seed (e.g. date string → hash → seeded PRNG), not `Math.random()`.
- [ ] **Solvability guarantee** — every generated puzzle should have at least one valid solution path using the solver (see section 4) before it's ever served to a player. Generate, solve-check, regenerate if it fails.
- [ ] **Difficulty calibration** — track letter rarity (Q, Z, X, J are hard to place), average word length required, and total tile count as difficulty knobs. Worth logging solver stats (time to solve, number of valid arrangements found) per generated puzzle to build a difficulty curve over time.
- [ ] **Timezone handling for "daily"** — decide what "midnight" means (UTC vs player-local) and be consistent, or players in different timezones get different puzzle-drop times.

---

## 3. Backend & data (Supabase)

- [ ] **Schema**: users/profiles, daily_puzzles (date, seed, tile sequence, solution reference), game_sessions (user, puzzle, completion time, score, round-by-round timing), leaderboard views, badges/achievements table, badge_unlocks (user × badge).
- [ ] **Anti-cheat basics** — client-reported completion time is trivially fakeable. At minimum, validate round transitions server-side (don't trust "I finished in 4 seconds" without server-side timestamps on each round completion event).
- [ ] **Leaderboard scoping** — daily leaderboard, all-time leaderboard, and maybe friends-only if you want a social loop like Pushdle's Discord community.
- [ ] **Badge logic** — define trigger conditions (speed thresholds, word-length streaks, perfect rounds, etc.) as a first pass; this can start simple and grow.
- [ ] **Replay/history** — do players get to see their past boards? Worth deciding early since it affects what you store (just the final board, or every intermediate state).

---

## 4. Solver service (Go)

- [ ] Stand this up as a **standalone microservice** with a clean API boundary (input: current board state + available tiles, output: valid placement / best move / solvability check) — same reasoning as before: it's stateless, CPU-bound, and doesn't need to share a language with the rest of the app.
- [ ] Core data structure: **trie or DAWG** built from the same word list as the client, for fast prefix/anagram lookups.
- [ ] Two solver modes worth separating:
  - **Solvability check** (used by the puzzle generator — "does at least one solution exist?")
  - **Best-move / hint generator** (used in-game if you want a hint system, and for any "here's how a top player solved it" feature post-game)
- [ ] Decide early whether the solver needs to reason about the *whole* board (full Bananagrams solve, expensive) or just validate/extend incrementally (cheaper, probably sufficient for hints).

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
