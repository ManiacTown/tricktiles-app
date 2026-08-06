-- Adds p.selected_emoji to the leaderboard view so the Leaderboard page
-- can render each row's flair in the same query, instead of a second
-- round-trip joining profiles client-side. Otherwise identical to the
-- view's original definition (see the initial schema migration) — new
-- column appended at the end, since CREATE OR REPLACE VIEW can't insert a
-- column in the middle without renaming every column after it positionally.
create or replace view leaderboard
  with (security_invoker = true)
as
select
  gs.id as session_id,
  gs.user_id,
  p.username,
  gs.puzzle_id,
  dp.date as puzzle_date,
  gs.started_at,
  rc_last.completed_at as finished_at,
  extract(epoch from (rc_last.completed_at - gs.started_at))::int as elapsed_seconds,
  gs.client_score,
  p.selected_emoji
from game_sessions gs
join profiles p on p.id = gs.user_id
join daily_puzzles dp on dp.id = gs.puzzle_id
join lateral (
  select completed_at
  from round_completions rc
  where rc.session_id = gs.id
  order by round_number desc
  limit 1
) rc_last on true
where gs.status = 'completed';
