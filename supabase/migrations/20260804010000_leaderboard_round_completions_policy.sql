-- Bug fix: the leaderboard view's `security_invoker` join to
-- round_completions was silently empty for anyone other than a session's
-- own owner, because round_completions only had an "own rows" SELECT
-- policy. The `join lateral (...) on true` (not a left join) then dropped
-- the whole game_sessions row whenever that subquery returned zero rows —
-- so the leaderboard was invisible to everyone except each row's owner,
-- defeating the entire point of a public leaderboard. Verified against
-- the live project: game_sessions correctly returned a completed session
-- via the anon key, but round_completions returned [] for that same
-- session, and the leaderboard view returned [] too.
--
-- Fix: allow public read of round_completions rows that belong to an
-- already-completed session (in-progress sessions' round completions stay
-- private to the owner — no reason to leak someone's live attempt).
create policy "round completions for completed sessions are publicly readable"
  on round_completions for select
  using (
    exists (
      select 1 from game_sessions gs
      where gs.id = round_completions.session_id
        and gs.status = 'completed'
    )
  );
