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

- [x] **Schema** — live at project `qpcocrzkccmbhhjpvhsu` (`supabase/migrations/20260804000000_initial_schema.sql`): profiles, daily_puzzles, game_sessions, round_completions, badges, badge_unlocks, plus a `leaderboard` view. Verified against the real project (not just written) — every table/view reachable via REST with the anon key, RLS confirmed working.
- [x] **Anti-cheat basics** — done to the stated minimum bar: `round_completions.completed_at` is always server `now()`, never client-supplied. The only write path is the `complete_round()` RPC (security-definer, checks session ownership) — verified live, rejecting an unauthorized/fake call exactly as designed. Deeper anti-cheat (validating the actual board content submitted per round, not just accepting a round-complete signal) is a real follow-up, not built.
- [x] **Leaderboard scoping** — daily leaderboard done via the `leaderboard` view, filterable by `puzzle_id`/date (see `getLeaderboard` in `app/src/supabase/api.ts`). All-time and friends-only are not built — natural extensions of the same view (a `group by user_id` for all-time best; a friends table + join for friends-only) once there's a reason to prioritize them.
- [ ] **Badge logic** — schema exists (`badges`, `badge_unlocks`), but no trigger conditions are implemented yet — no badges have been defined, and nothing evaluates session data to unlock one. First-pass rules engine still to build.
- [x] Decided pragmatically (not a section 0 lock): **replay/history** stores just the player's own final board (`game_sessions.final_board_state`), not full intermediate move-by-move state. Revisit if a real replay feature gets prioritized.

**Client wiring — done and verified live**: `app/src/App.tsx` now has two modes (tab switcher): **Daily Challenge** (auth-gated, real Supabase data) and **Practice** (the original random-deal loop, kept as-is). `GameScreen.tsx` was extracted from the old monolithic `App.tsx` so both modes share the same board/rack/validator/drag-and-drop; `DailyChallenge.tsx` wraps it with auth + puzzle/session fetching.

- **Auth**: anonymous sign-in + username (`useAuth.ts`, `SignIn.tsx`) — decided over email magic-link for now specifically because it's instant and fully testable end-to-end without needing inbox access; upgradeable to real email accounts later via Supabase's anonymous→permanent conversion. Requires "Anonymous Sign-Ins" enabled in the dashboard (off by default — had to be turned on manually).
- **Publishing**: `solver/cmd/publish` generates a date's puzzle and inserts it into `daily_puzzles` via the service_role key — 2026-08-04's puzzle is live in the real table right now.
- **Verified end-to-end in a real browser session** (not just unit tests): signed in anonymously, today's real puzzle loaded into the board (round 1's rack matched `daily_puzzles` exactly), solved round 1 using a genuine solver-computed solution, "Complete Round" fired `complete_round()`, round 2's real tiles loaded — and confirmed directly against Supabase (service-role query) that the `game_sessions` and `round_completions` rows were created correctly, server-timestamped. Test rows were cleaned up afterward.
- **Known gap**: resuming a session that's already `status = 'completed'` isn't handled — `DailyChallenge` would let the player replay from round 0 rather than showing their finished result. Not hit yet since no one has finished a real daily puzzle, but worth fixing before this is player-facing.

**Not yet done**: auth (sign-up/sign-in flow, anonymous vs named play), and no daily puzzle has actually been generated-and-inserted into `daily_puzzles` yet (the Go generator produces one; nothing has pushed its output into this table).

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

- [x] **Per-round score locking** — done. `gameState.ts`'s `advanceRound` locks each round's score as a delta from the cumulative live score the moment it completes (`roundScores: number[]`, immutable once set); the running total is just their sum. The HUD (`GameScreen.tsx`'s `displayScore`) floors at the locked total so temporarily disturbing an earlier round's words while building a new one never shows a scary live dip — but a round's *own* completion delta can legitimately be negative if you damage earlier value and don't fix it before completing, which is honest, not a bug. Covered by 4 new unit tests (lock-in, immutability, negative-delta, timestamps); the HUD wiring itself was only smoke-tested (no console errors), not deeply re-verified live, since the underlying logic is what actually matters for correctness.
- [ ] **Combo/bonus system** — explicitly deferred. Decided to ship plain letter-value-sum scoring for now rather than invent bonus thresholds without real play data to tune them against.
- [x] **End screen structure** (not full visual design) — added a round-by-round breakdown table (round number, time, score) to `Overlay.tsx`, using the existing placeholder felt/wood/card theme. Full visual redesign explicitly deferred to section 7, since the visual identity itself isn't decided yet. Not screenshot-verified in a real completed 5-round game this session — scripting a full deterministic win would need the solver to extend from an existing board per round, which only `solver/cmd/publish`'s internal `SolveFrom` does; the public `/solvability` endpoint only solves from empty. Logic is unit-tested; the table's exact rendering is unverified.

---

## 6. Profile & social layer

- [x] **Profile page** (stats only, no badge case yet — badges aren't built): `Profile.tsx`, new third App.tsx tab. `getProfileStats` in `api.ts` derives games played / best time / average time from the `leaderboard` view (completed sessions only, same server-timestamped elapsed time as everywhere else). Handles not-signed-in (reuses `SignIn`) and zero-games states. Verified live: sign-in gate, then correctly shows "you haven't completed a daily puzzle yet" with a real account and zero completed sessions. Fixed a real bug found while wiring this in: the three mode-tab buttons all reused `id="shuffleBtn"` (invalid duplicate-ID HTML, copy-paste leftover) — replaced with a proper `.mode-tab`/`.mode-tab.active` class.
- [ ] **Badge display/unlock animation** — explicitly deferred this session (needs badge content defined first, see section 3's badge logic gap).
- [ ] **Share card for socials** — deferred this session; needs a design-direction decision (text-only vs. generated image) before building.
- [ ] **Discord integration** — deferred this session; needs a Discord server/bot decision first, similar to how GitHub/Supabase needed account setup before any code could follow.

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
